import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import {
  calculateMasterPayrollRow,
  calculateRegisterTotals,
  calculateEmployeeLopDays,
  MasterPayrollEmployee,
  MasterPayrollAdjustments,
  calculateEmployeePayrollDays
} from "@/lib/payroll/master-payroll-engine";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

async function checkAdminAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["ceo", "hr"].includes(profile.role)) {
    return { ok: false, error: "Forbidden: HR or CEO access required", status: 403 };
  }

  return { ok: true, user, role: profile.role };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { month, year, adjustments = {} } = body as {
      month: number;
      year: number;
      adjustments?: Record<string, MasterPayrollAdjustments>;
    };

    const payrollMonth = Number(month);
    const payrollYear = Number(year);

    if (
      !Number.isInteger(payrollMonth) ||
      payrollMonth < 1 ||
      payrollMonth > 12
    ) {
      return NextResponse.json({ error: "Invalid payroll month." }, { status: 400 });
    }

    if (
      !Number.isInteger(payrollYear) ||
      payrollYear < 2000 ||
      payrollYear > 2100
    ) {
      return NextResponse.json({ error: "Invalid payroll year." }, { status: 400 });
    }

    // HR cannot run current or future months — only completed past months!
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentPeriod = currentYear * 12 + currentMonth;
    const requestedPeriod = payrollYear * 12 + payrollMonth;

    if (requestedPeriod >= currentPeriod) {
      return NextResponse.json(
        {
          error:
            "Payroll can only be generated after the payroll month is completed. Current and future months are locked.",
        },
        { status: 400 }
      );
    }

    const monthName = MONTH_NAMES[payrollMonth - 1];
    const daysInMonth = new Date(payrollYear, payrollMonth, 0).getDate();
    const monthStart = `${payrollYear}-${String(payrollMonth).padStart(2, "0")}-01`;
    const monthEnd = `${payrollYear}-${String(payrollMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const admin = await createAdminClient();

    // 1. Fetch eligible active/on-notice employees
    const { data: employeeRows, error: empError } = await admin
      .from("employees")
      .select(`
        id,
        employee_id,
        first_name,
        last_name,
        designation,
        joining_date,
        bank_name,
        bank_account_number,
        ifsc_code,
        pan_number,
        uan_number,
        salary,
        status,
        department_id,
        project_id,
        pf_eligible,
        esi_healthcare_eligible,
        pt_eligible,
        tds_eligible,
        exit_date
      `)
      .in("status", ["active", "on_notice"])
      .lte("joining_date", monthEnd)
      .or(`exit_date.is.null,exit_date.gte.${monthStart}`)
      .order("employee_id", { ascending: true });

    if (empError) {
      console.error("[Run All Payroll] Employee lookup failed:", empError);
      return NextResponse.json({ error: "Failed to load employees." }, { status: 500 });
    }

    const employees = (employeeRows ?? []) as MasterPayrollEmployee[];

    

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "No eligible employees found for this payroll month." },
        { status: 400 }
      );
    }

    // 2. Fetch previous month's pending PF/ESI contributions from when employee was absent
    const prevDate = new Date(payrollYear, payrollMonth - 2, 1);
    const prevMonth = prevDate.getMonth() + 1;
    const prevYear = prevDate.getFullYear();

    const { data: prevPayslips } = await admin
      .from("payslips")
      .select("employee_id, pf_pending_amount, esi_pending_amount")
      .eq("payroll_month", prevMonth)
      .eq("payroll_year", prevYear);

    const pendingByEmployee = new Map<string, { pf: number; esi: number }>();
    for (const p of prevPayslips ?? []) {
      const pf = Number(p.pf_pending_amount || 0);
      const esi = Number(p.esi_pending_amount || 0);
      if (pf > 0 || esi > 0) {
        pendingByEmployee.set(p.employee_id, { pf, esi });
      }
    }

    // Fetch existing payslips for the target period so we update them cleanly without relying on DB unique constraints
    const { data: currentMonthPayslips } = await admin
      .from("payslips")
      .select("id, employee_id")
      .eq("payroll_month", payrollMonth)
      .eq("payroll_year", payrollYear);

    const existingPayslipMap = new Map<string, string>();
    for (const p of currentMonthPayslips ?? []) {
      if (!existingPayslipMap.has(p.employee_id)) {
        existingPayslipMap.set(p.employee_id, p.id);
      }
    }
    

    // 3. Load attendance logs & approved leaves
    const { data: attendanceLogs } = await admin
      .from("attendance_logs")
      .select("employee_id, attendance_date, status")
      .gte("attendance_date", monthStart)
      .lte("attendance_date", monthEnd);

    const { data: leaveRequests } = await admin
      .from("leave_requests")
      .select(`
        id,
        employee_id,
        start_date,
        end_date,
        total_days,
        is_half_day,
        status,
        leave_types ( id, name, code, is_paid )
      `)
      .eq("status", "approved")
      .lte("start_date", monthEnd)
      .gte("end_date", monthStart);

    // Fetch holidays & working Saturdays
    const { data: holidays } = await admin
      .from("holidays")
      .select("holiday_date, is_working_day, is_optional")
      .gte("holiday_date", monthStart)
      .lte("holiday_date", monthEnd);

    

    const workingSaturdays = await DataStore.getWorkingSaturdays(payrollYear, payrollMonth);

    // Map LOP days per employee based on company policy:
    // 1. Absent: Counts as LOP (+1.0 LOP per day) if not covered by approved paid leave.
    // 2. Half day: NO LOP (0 LOP).
    // 3. Approved leave: Paid leave (SL/CL is_paid=true) -> NO LOP. LOP/unpaid leave -> Counts as LOP.
    // 4. Full month absence: 0 present days & 0 paid leaves -> all calendar days count as LOP (0 pay days).
    const lopDaysByEmployee = new Map<string, number>();

    const safeAttendanceLogs = (attendanceLogs ?? []) as any[];
    const safeLeaveRequests = (leaveRequests ?? []) as any[];

    for (const emp of employees) {
      const empLop = calculateEmployeeLopDays(
        emp.id,
        safeAttendanceLogs,
        safeLeaveRequests,
        monthStart,
        monthEnd,
        {
          joiningDate: emp.joining_date,
          exitDate: emp.exit_date,
          holidays: holidays ?? [],
          workingSaturdays,
        }
      );
      lopDaysByEmployee.set(emp.id, empLop);
    }

    // 4. Calculate rows and prepare upsert records
    const calculatedRows = [];
    const payslipUpserts = [];
    const employeesWithRecoveredStatutory: string[] = [];

    for (const emp of employees) {
      const calculatedLop = lopDaysByEmployee.get(emp.id) ?? 0;
      const empAdjustments = adjustments[emp.id];
      const pendingStatutory = pendingByEmployee.get(emp.id);

      const employeeDaysInPeriod = calculateEmployeePayrollDays(
        emp.joining_date,
        emp.exit_date,
        monthStart,
        monthEnd
      );

      const row = calculateMasterPayrollRow(
        emp,
        daysInMonth,
        calculatedLop,
        empAdjustments,
        undefined,
        pendingStatutory,
        employeeDaysInPeriod
      );

      calculatedRows.push(row);




      if (row.recovered_statutory && row.recovered_statutory > 0) {
        employeesWithRecoveredStatutory.push(emp.id);
      }

      const earningsBreakup = [
        { code: "BASIC", name: "Basic Salary", type: "earning", amount: row.basic },
        { code: "HRA", name: "House Rent Allowance", type: "earning", amount: row.hra },
        { code: "CONVEYANCE", name: "Conveyance Allowance", type: "earning", amount: row.conveyance },
        { code: "MEDICAL", name: "Medical Allowance", type: "earning", amount: row.medical_allowance },
        { code: "LTA", name: "Leave Travel Allowance", type: "earning", amount: row.leave_travel_allowance },
        { code: "EMPLOYER_PF", name: "Employer PF", type: "earning", amount: row.employer_pf },
        { code: "SPECIAL_ALLOWANCE", name: "Special Allowance", type: "earning", amount: row.special_allowance },
        ...(row.arrears > 0
          ? [{ code: "ARREARS", name: "Arrears of Salary", type: "earning", amount: row.arrears }]
          : []),
        ...(row.incentive > 0
          ? [{ code: "INCENTIVE", name: "Incentive", type: "earning", amount: row.incentive }]
          : []),
      ];

      const deductionsBreakup = [
        ...(row.pt > 0 ? [{ code: "PT", name: "Professional Tax", type: "deduction", amount: row.pt }] : []),
        ...(row.epf > 0 ? [{ code: "PF", name: "EPF", type: "deduction", amount: row.epf }] : []),
        ...(row.tds > 0 ? [{ code: "TDS", name: "TDS", type: "deduction", amount: row.tds }] : []),
        ...(row.advance > 0
          ? [{ code: "ADVANCE", name: "Advance", type: "deduction", amount: row.advance }]
          : []),
        ...(row.other_deduction > 0
          ? [
              {
                code: "STATUTORY_RECOVERY",
                name: "Pending Statutory Recovery",
                type: "deduction",
                amount: row.other_deduction,
              },
            ]
          : []),
        ...(row.remarks
          ? [{ code: "REMARK", name: "Remarks", type: "remark", text: row.remarks }]
          : []),
      ];

      // If employee is 100% absent (pay_days === 0), record pending employee PF/ESI
      // that company had to pay on their behalf to government
      const isAbsentMonth = row.pay_days === 0;
      const pendingPfForAbsence = isAbsentMonth && emp.pf_eligible !== false ? row.epf : 0;
      const pendingEsiForAbsence = isAbsentMonth && row.esic_emp > 0 ? row.esic_emp : 0;

      payslipUpserts.push({
        employee_id: emp.id,
        payroll_month: payrollMonth,
        payroll_year: payrollYear,
        month_name: monthName,
        working_days: row.working_days,
        present_days: row.pay_days,
        paid_leaves: 0,
        lop_days: row.lop_days,
        gross_salary: row.gross_salary + row.incentive + row.arrears,
        lop_deduction: row.loss_of_pay,
        total_earnings: row.gross_salary + row.incentive + row.arrears,
        total_deductions: row.total_deductions,
        net_salary: row.net_payout,
        pf_pending_amount: pendingPfForAbsence,
        esi_pending_amount: pendingEsiForAbsence,
        earnings_breakup: earningsBreakup,
        deductions_breakup: deductionsBreakup,
        payment_status: "processed",
        employer_pf: row.employer_pf,
        gratuity_provision: Math.round(((row.basic * 15) / (26 * 12)) * 100) / 100,
        incentive: row.incentive,
        bonus: 0,
        compensation: row.arrears,
      });
    }

    // 5. Save into payslips (handle existing vs new without relying on DB unique constraints)
    const savedPayslipIds: { id: string; employee_id: string }[] = [];

    const newRecords = payslipUpserts.filter((p) => !existingPayslipMap.has(p.employee_id));
    if (newRecords.length > 0) {
      const { data: inserted, error: insertError } = await admin
        .from("payslips")
        .insert(newRecords)
        .select("id, employee_id");

      if (insertError) {
        console.error("[Run All Payroll] Insert into payslips failed:", insertError);
        return NextResponse.json(
          { error: `Failed to save payslips: ${insertError.message}` },
          { status: 500 }
        );
      }
      if (inserted) {
        savedPayslipIds.push(...inserted);
      }
    }

    const updateRecords = payslipUpserts.filter((p) => existingPayslipMap.has(p.employee_id));
    for (const rec of updateRecords) {
      const existingId = existingPayslipMap.get(rec.employee_id)!;
      const { data: updated, error: updateError } = await admin
        .from("payslips")
        .update(rec)
        .eq("id", existingId)
        .select("id, employee_id")
        .single();

      if (updateError) {
        console.error(`[Run All Payroll] Update payslip for ${rec.employee_id} failed:`, updateError);
      } else if (updated) {
        savedPayslipIds.push(updated);
      }
    }

    // Clear previous pending statutory for employees who had it recovered
    if (employeesWithRecoveredStatutory.length > 0) {
      await admin
        .from("payslips")
        .update({
          pf_pending_amount: 0,
          esi_pending_amount: 0,
        })
        .in("employee_id", employeesWithRecoveredStatutory)
        .eq("payroll_month", prevMonth)
        .eq("payroll_year", prevYear);
    }

    // Assign saved payslip IDs back to rows
    const payslipIdMap = new Map<string, string>();
    for (const p of savedPayslipIds) {
      payslipIdMap.set(p.employee_id, p.id);
    }

    for (const r of calculatedRows) {
      r.payslip_id = payslipIdMap.get(r.employee_id);
      r.status = "processed";
    }

    // 5. Send notifications to employees
    try {
      const notificationRows = employees.map((emp) => ({
        employee_id: emp.id,
        title: "Payslip Generated",
        message: `Your payslip for ${monthName} ${payrollYear} has been generated.`,
        type: "payslip",
        is_read: false,
      }));

      await admin.from("notifications").insert(notificationRows);
    } catch (notifErr) {
      console.error("[Run All Payroll] Non-blocking notification error:", notifErr);
    }

    const totals = calculateRegisterTotals(calculatedRows);

    return NextResponse.json({
      success: true,
      message: `Successfully ran payroll for ${calculatedRows.length} employee(s) for ${monthName} ${payrollYear}.`,
      count: calculatedRows.length,
      period: {
        month: payrollMonth,
        year: payrollYear,
        monthName,
        daysInMonth,
      },
      rows: calculatedRows,
      totals,
    });
  } catch (error) {
    console.error("[Run All Payroll POST] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while generating all employee payroll.",
      },
      { status: 500 }
    );
  }
}
