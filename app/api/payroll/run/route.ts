import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { DataStore } from '@/lib/data-store';
import {
  calculateMasterPayrollRow,
  calculateEmployeeLopDays,
  MasterPayrollEmployee,
  MasterPayrollAdjustments,
  RawAttendanceLog,
  RawLeaveRequest,
} from '@/lib/payroll/master-payroll-engine';

const monthNames = [
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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { employeeId, month, year, additionalEarnings = [] } = body;

    // =========================================================
    // BASIC VALIDATION
    // =========================================================

    if (!employeeId) {
      return NextResponse.json(
        { error: "Please select an employee" },
        { status: 400 }
      );
    }

    const payrollMonth = Number(month);
    const payrollYear = Number(year);

    if (
      !Number.isInteger(payrollMonth) ||
      payrollMonth < 1 ||
      payrollMonth > 12
    ) {
      return NextResponse.json(
        { error: "Invalid payroll month" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(payrollYear)) {
      return NextResponse.json(
        { error: "Invalid payroll year" },
        { status: 400 }
      );
    }

    // =========================================================
    // PREVENT CURRENT & FUTURE MONTH PAYROLL
    // =========================================================

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const requestedPeriod = payrollYear * 12 + payrollMonth;
    const currentPeriod = currentYear * 12 + currentMonth;

    if (requestedPeriod >= currentPeriod) {
      return NextResponse.json(
        {
          error: "Payroll can only be generated after the payroll month is completed. Current and future months are locked.",
        },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    // =========================================================
    // GET EMPLOYEE DETAILS
    // =========================================================

    const { data: employee, error: empError } = await admin
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
      .eq("id", employeeId)
      .maybeSingle();

    if (empError || !employee) {
      return NextResponse.json(
        {
          error: "Employee not found.",
        },
        { status: 404 }
      );
    }

    // =========================================================
    // PREVENT PAYROLL BEFORE JOINING MONTH
    // =========================================================

    if (!employee.joining_date) {
      return NextResponse.json(
        {
          error: "Employee joining date is missing.",
        },
        { status: 400 }
      );
    }

    const joiningDateString = String(employee.joining_date).slice(0, 10);
    const [joiningYear, joiningMonth] = joiningDateString.split("-").map(Number);

    if (
      !Number.isInteger(joiningYear) ||
      !Number.isInteger(joiningMonth) ||
      joiningMonth < 1 ||
      joiningMonth > 12
    ) {
      return NextResponse.json(
        {
          error: "Employee has an invalid joining date.",
        },
        { status: 400 }
      );
    }

    const joiningPeriod = joiningYear * 12 + joiningMonth;

    if (requestedPeriod < joiningPeriod) {
      const joiningMonthName = monthNames[joiningMonth - 1];
      return NextResponse.json(
        {
          error: `Payroll cannot be generated for ${monthNames[payrollMonth - 1]} ${payrollYear}. Employee joined in ${joiningMonthName} ${joiningYear}.`,
        },
        { status: 400 }
      );
    }

    // =========================================================
    // ADDITIONAL EARNINGS PARSING
    // =========================================================
    const requestedAdditionalEarnings = Array.isArray(additionalEarnings) ? additionalEarnings : [];
    let parsedIncentive = 0;
    let parsedArrears = 0;

    for (const earning of requestedAdditionalEarnings) {
      const amount = Number(earning.amount) || 0;
      if (earning.type === "Incentive" || earning.type === "Bonus") {
        parsedIncentive += amount;
      } else if (earning.type === "Compensation") {
        parsedArrears += amount;
      }
    }

    const monthName = monthNames[payrollMonth - 1];
    const daysInMonth = new Date(payrollYear, payrollMonth, 0).getDate();
    const monthStart = `${payrollYear}-${String(payrollMonth).padStart(2, "0")}-01`;
    const monthEnd = `${payrollYear}-${String(payrollMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    // =========================================================
    // FETCH ATTENDANCE LOGS & APPROVED LEAVES (LOP RULES)
    // =========================================================
    const { data: attendanceLogs } = await admin
      .from("attendance_logs")
      .select("employee_id, attendance_date, status")
      .eq("employee_id", employeeId)
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
      .eq("employee_id", employeeId)
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

    // Calculate LOP using master business rules:
    // 1. Absent: Counts as LOP (+1.0 LOP per day) if not covered by approved paid leave.
    // 2. Half day: NO LOP (0 LOP).
    // 3. Approved leave: Paid leave (SL/CL is_paid=true) -> NO LOP. LOP/unpaid leave -> Counts as LOP.
    // 4. Full month absence: 0 present days & 0 paid leaves -> all calendar days count as LOP (0 pay days).
    const calculatedLopDays = calculateEmployeeLopDays(
      employeeId,
      (attendanceLogs ?? []) as RawAttendanceLog[],
      (leaveRequests ?? []) as RawLeaveRequest[],
      monthStart,
      monthEnd,
      {
        joiningDate: employee.joining_date,
        exitDate: employee.exit_date,
        holidays: holidays ?? [],
        workingSaturdays,
      }
    );

    // =========================================================
    // FETCH PREVIOUS MONTH PENDING STATUTORY CONTRIBUTIONS
    // =========================================================
    const prevDate = new Date(payrollYear, payrollMonth - 2, 1);
    const prevMonth = prevDate.getMonth() + 1;
    const prevYear = prevDate.getFullYear();

    const { data: prevPayslip } = await admin
      .from("payslips")
      .select("employee_id, pf_pending_amount, esi_pending_amount")
      .eq("employee_id", employeeId)
      .eq("payroll_month", prevMonth)
      .eq("payroll_year", prevYear)
      .maybeSingle();

    const pendingPf = Number(prevPayslip?.pf_pending_amount || 0);
    const pendingEsi = Number(prevPayslip?.esi_pending_amount || 0);
    const pendingStatutory = pendingPf > 0 || pendingEsi > 0 ? { pf: pendingPf, esi: pendingEsi } : undefined;

    // Check for existing payslip for this month to preserve adjustments
    const { data: existingPayslips } = await admin
      .from("payslips")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("payroll_month", payrollMonth)
      .eq("payroll_year", payrollYear)
      .order("created_at", { ascending: false });

    const existingPayslip = existingPayslips?.[0] || null;

    // Clean up any older duplicate payslips if they exist
    if (existingPayslips && existingPayslips.length > 1) {
      const duplicateIds = existingPayslips.slice(1).map((p) => p.id);
      await admin.from("payslips").delete().in("id", duplicateIds);
    }

    const empAdjustments: MasterPayrollAdjustments = {
      incentive: parsedIncentive > 0 ? parsedIncentive : existingPayslip?.incentive ? Number(existingPayslip.incentive) : 0,
      arrears: parsedArrears > 0 ? parsedArrears : existingPayslip?.compensation ? Number(existingPayslip.compensation) : 0,
      recoverPendingStatutory: Boolean(pendingStatutory),
    };

    // Calculate payroll row with exact master payroll engine
    const row = calculateMasterPayrollRow(
      employee as MasterPayrollEmployee,
      daysInMonth,
      calculatedLopDays,
      empAdjustments,
      existingPayslip || undefined,
      pendingStatutory
    );

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

    const isAbsentMonth = row.pay_days === 0;
    const pendingPfForAbsence = isAbsentMonth && employee.pf_eligible !== false ? row.epf : 0;
    const pendingEsiForAbsence = isAbsentMonth && row.esic_emp > 0 ? row.esic_emp : 0;

    const payslipRecord = {
      employee_id: employee.id,
      payroll_month: payrollMonth,
      payroll_year: payrollYear,
      month_name: monthName,
      working_days: row.working_days,
      present_days: row.pay_days,
      paid_leaves: 0,
      lop_days: row.lop_days,
      gross_salary: row.ctc + row.incentive + row.arrears,
      lop_deduction: row.loss_of_pay,
      total_earnings: row.ctc + row.incentive + row.arrears,
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
    };

    // Save payslip: update if already exists, insert if new
    let savedPayslip = null;

    if (existingPayslip?.id) {
      const { data: updated, error: updateError } = await admin
        .from("payslips")
        .update(payslipRecord)
        .eq("id", existingPayslip.id)
        .select("*")
        .single();

      if (updateError || !updated) {
        console.error("[Individual Payroll Run] Update failed:", updateError);
        return NextResponse.json(
          { error: `Failed to save payslip: ${updateError?.message || "Unknown error"}` },
          { status: 500 }
        );
      }
      savedPayslip = updated;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("payslips")
        .insert([payslipRecord])
        .select("*")
        .single();

      if (insertError || !inserted) {
        console.error("[Individual Payroll Run] Insert failed:", insertError);
        return NextResponse.json(
          { error: `Failed to save payslip: ${insertError?.message || "Unknown error"}` },
          { status: 500 }
        );
      }
      savedPayslip = inserted;
    }

    // Clear recovered statutory if applicable
    if (row.recovered_statutory && row.recovered_statutory > 0) {
      await admin
        .from("payslips")
        .update({ pf_pending_amount: 0, esi_pending_amount: 0 })
        .eq("employee_id", employeeId)
        .eq("payroll_month", prevMonth)
        .eq("payroll_year", prevYear);
    }

    // Send in-app notification
    try {
      await admin.from("notifications").insert([
        {
          employee_id: employeeId,
          title: "Payslip Generated",
          message: `Your payslip for ${monthName} ${payrollYear} has been generated.`,
          type: "payslip",
          is_read: false,
        },
      ]);
    } catch (notifErr) {
      console.error("[Individual Payroll Run] Notification non-blocking error:", notifErr);
    }

    const clientPayslip = {
      ...savedPayslip,
      employee,
    };

    return NextResponse.json({
      success: true,
      generatedCount: 1,
      payslips: [clientPayslip],
    });
  } catch (error: unknown) {
    console.error("Payroll generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate payroll";
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
