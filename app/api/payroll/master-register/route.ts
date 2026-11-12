import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import {
  calculateMasterPayrollRow,
  calculateRegisterTotals,
  calculateEmployeeLopDays,
  MasterPayrollEmployee,
  calculateEmployeePayrollDays,
  MasterPayrollRow,
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

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const today = new Date();

    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const currentPeriod = currentYear * 12 + currentMonth;

    // Default to the last completed month
    const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const defaultYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const month = monthParam ? Number(monthParam) : defaultMonth;
    const year = yearParam ? Number(yearParam) : defaultYear;

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid month parameter" }, { status: 400 });
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
    }

    // HR cannot open or run current or future months — only completed past months!
    const requestedPeriod = year * 12 + month;
    if (requestedPeriod >= currentPeriod) {
      return NextResponse.json(
        {
          error:
            "Payroll can only be opened or generated after the payroll month is completed. Current and future months are locked.",
        },
        { status: 400 }
      );
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const admin = await createAdminClient();

    // 1. Fetch eligible employees
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
        department:departments(name),
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
      console.error("[Master Register] Employee query error:", empError);
      return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
    }

    const employees = (employeeRows ?? []).map((emp: any) => ({
      ...emp,
      department: emp.department?.name || "General",
    })) as MasterPayrollEmployee[];

    // 2. Fetch existing saved payslips for this period
    const { data: payslipRows, error: payslipsError } = await admin
      .from("payslips")
      .select("*")
      .eq("payroll_month", month)
      .eq("payroll_year", year);

    if (payslipsError) {
      console.error("[Master Register] Payslip query error:", payslipsError);
    }

    const payslipsByEmployee = new Map<string, any>();
    for (const p of payslipRows ?? []) {
      payslipsByEmployee.set(p.employee_id, p);
    }

    // 3. Fetch attendance logs and approved leaves to calculate LOP
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

    const workingSaturdays = await DataStore.getWorkingSaturdays(year, month);

    // Map attendance & unpaid leave per employee to get LOP days
    // Business rules:
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


    

    // 4. Fetch previous month's pending PF/ESI contributions from when employee was absent
    const prevDate = new Date(year, month - 2, 1);
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

    

    // 5. Calculate rows for all employees
    const rows: MasterPayrollRow[] = employees.map((emp) => {
      const existingSlip = payslipsByEmployee.get(emp.id);
      const calculatedLop = lopDaysByEmployee.get(emp.id) ?? 0;
      const pendingStatutory = pendingByEmployee.get(emp.id);

      

      // Extract saved adjustments from existing payslip if present
      let adjustments;
      if (existingSlip) {
        const earningsBreakup = Array.isArray(existingSlip.earnings_breakup)
          ? existingSlip.earnings_breakup
          : [];
        const deductionsBreakup = Array.isArray(existingSlip.deductions_breakup)
          ? existingSlip.deductions_breakup
          : [];

        const arrearsItem = earningsBreakup.find(
          (b: any) => b.code === "ARREARS" || b.name === "Arrears"
        );
        const advanceItem = deductionsBreakup.find(
          (b: any) => b.code === "ADVANCE" || b.name === "Advance"
        );
        const tdsItem = deductionsBreakup.find(
          (b: any) => b.code === "TDS" || b.name === "TDS"
        );
        const remarkItem = deductionsBreakup.find(
          (b: any) => b.type === "remark" || b.code === "REMARK"
        );
        const hasRecoveredStatutory = deductionsBreakup.some(
          (b: any) => b.code === "STATUTORY_RECOVERY"
        );

        adjustments = {
          incentive: Number(existingSlip.incentive || 0),
          arrears: Number(arrearsItem?.amount || 0),
          advance: Number(advanceItem?.amount || 0),
          tds: Number(tdsItem?.amount || 0),
          lopDays:
            existingSlip.lop_days !== undefined && Number(existingSlip.lop_days) > 0
              ? Number(existingSlip.lop_days)
              : calculatedLop,
          remarks: remarkItem?.text || existingSlip.remarks || "",
          recoverPendingStatutory: hasRecoveredStatutory,
        };
      }

      const employeeDaysInPeriod = calculateEmployeePayrollDays(
        emp.joining_date,
        emp.exit_date,
        monthStart,
        monthEnd
      );

      return calculateMasterPayrollRow(
        emp,
        daysInMonth,
        calculatedLop,
        adjustments,
        existingSlip,
        pendingStatutory,
        employeeDaysInPeriod
      );
    });

    // 5. Calculate register totals
    const totals = calculateRegisterTotals(rows);

    const hasSavedRun = rows.some((r) => Boolean(r.payslip_id));

    return NextResponse.json({
      period: {
        month,
        year,
        monthName: MONTH_NAMES[month - 1],
        daysInMonth,
        startDate: monthStart,
        endDate: monthEnd,
      },
      hasSavedRun,
      employeeCount: rows.length,
      rows,
      totals,
    });
  } catch (error) {
    console.error("[Master Register GET] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading master register.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      employeeId,
      month,
      year,
      incentive,
      arrears,
      advance,
      tds,
      lopDays,
      remarks,
      recoverPendingStatutory,
    } = body;

    if (!employeeId || !month || !year) {
      return NextResponse.json(
        { error: "Employee ID, month, and year are required" },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    // Fetch employee
    const { data: employee, error: empError } = await admin
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch previous month pending statutory
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = prevDate.getMonth() + 1;
    const prevYear = prevDate.getFullYear();

    const { data: prevSlip } = await admin
      .from("payslips")
      .select("pf_pending_amount, esi_pending_amount")
      .eq("employee_id", employeeId)
      .eq("payroll_month", prevMonth)
      .eq("payroll_year", prevYear)
      .maybeSingle();

    const pendingStatutory = {
      pf: Number(prevSlip?.pf_pending_amount || 0),
      esi: Number(prevSlip?.esi_pending_amount || 0),
    };

    // Fetch existing payslip
    const { data: existingSlip } = await admin
      .from("payslips")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("payroll_month", month)
      .eq("payroll_year", year)
      .maybeSingle();

    const adjustments = {
      incentive: incentive !== undefined ? Number(incentive) : Number(existingSlip?.incentive || 0),
      arrears: arrears !== undefined ? Number(arrears) : 0,
      advance: advance !== undefined ? Number(advance) : 0,
      tds: tds !== undefined ? Number(tds) : 0,
      lopDays: lopDays !== undefined ? Number(lopDays) : Number(existingSlip?.lop_days || 0),
      remarks: remarks !== undefined ? String(remarks) : "",
      recoverPendingStatutory: Boolean(recoverPendingStatutory),
    };

    const row = calculateMasterPayrollRow(
      employee as MasterPayrollEmployee,
      daysInMonth,
      0,
      adjustments,
      existingSlip,
      pendingStatutory
    );

    // If payslip exists or is being saved, update it
    if (existingSlip) {
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

      await admin
        .from("payslips")
        .update({
          working_days: row.working_days,
          present_days: row.pay_days,
          lop_days: row.lop_days,
          gross_salary: row.ctc + row.incentive + row.arrears,
          lop_deduction: row.loss_of_pay,
          total_earnings: row.ctc + row.incentive + row.arrears,
          total_deductions: row.total_deductions,
          net_salary: row.net_payout,
          employer_pf: row.employer_pf,
          incentive: row.incentive,
          earnings_breakup: earningsBreakup,
          deductions_breakup: deductionsBreakup,
        })
        .eq("id", existingSlip.id);

      // If pending statutory was recovered, clear the previous month's pending balance
      if (recoverPendingStatutory && (pendingStatutory.pf > 0 || pendingStatutory.esi > 0)) {
        await admin
          .from("payslips")
          .update({
            pf_pending_amount: 0,
            esi_pending_amount: 0,
          })
          .eq("employee_id", employeeId)
          .eq("payroll_month", prevMonth)
          .eq("payroll_year", prevYear);
      }
    }

    return NextResponse.json({
      success: true,
      row,
    });
  } catch (error) {
    console.error("[Master Register PATCH] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while updating adjustments.",
      },
      { status: 500 }
    );
  }
}
