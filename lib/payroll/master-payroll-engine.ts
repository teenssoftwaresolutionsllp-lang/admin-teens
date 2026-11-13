/**
 * Master Payroll Calculation Engine
 * 
 * Accurately implements the exact company payroll structure as defined in the
 * master register spreadsheet:
 * 
 * Columns:
 * 1. Emp. Code
 * 2. Name
 * 3. DOJ
 * 4. CTC
 * 5. Designation
 * 6. Bank Account No
 * "IFSC Code",
 * 7. Bank Name
 * 8. PF A/c No.
 * 9. PF UAN
 * 10. PAN
 * 11. Basic (50% of CTC)
 * 12. HRA (50% of Basic / 25% of CTC)
 * 13. Conveyance (1,600)
 * 14. Medical Allowance (1,250)
 * 15. Leave Travel All (0)
 * 16. Employer PF (min(12% of Basic, 3,000))
 * 17. Special Allowance (CTC - Basic - HRA - Conv - Med - LTA - Employer PF)
 * 18. Arrears
 * 19. No. Of Days
 * 20. Pay Days (No. Of Days - LOP Days)
 * 21. Gross Salary (CTC * Pay Days / No. Of Days)
 * 22. Incentive
 * 23. Loss of pay (CTC * LOP Days / No. Of Days)
 * 24. Advance
 * 25. TDS
 * 26. PT (200 if PT eligible)
 * 27. EPF (Employee PF: 4,800 for CTC >= 50k, 4,200 for 39k, 3,000 for 25k, or 12% of Basic)
 * 28. ESIC-Emp (0.75% of Gross if CTC <= 21,000)
 * 29. Other Deduction
 * 30. ESIC-Empr (3.25% of Gross if CTC <= 21,000)
 * 31. PF Admin (150 if PF eligible)
 * 32. Total Deduction (Advance + TDS + PT + EPF + ESIC-Emp + Other Deduction)
 * 33. Net Payout (Gross Salary + Incentive + Arrears - Total Deduction)
 * 34. Remarks
 */


/**
 * Master Payroll Calculation Engine
 *
 * Payroll rules:
 * - No. Of Days is based on the employee's active employment dates
 *   within the selected payroll month.
 * - Joining date and exit date are inclusive.
 * - Dates before joining and after exit are not LOP.
 * - Gross Salary and LOP use employee-eligible calendar days.
 * - Existing salary components and statutory rules are preserved.
 */

export interface MasterPayrollEmployee {
  id: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  joining_date: string | null;
  designation: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  pan_number: string | null;
  uan_number: string | null;
  pf_number?: string | null;
  salary: number | string | null;
  status: string;
  department?: string | null;
  department_name?: string | null;
  pf_eligible?: boolean | null;
  esi_healthcare_eligible?: boolean | null;
  pt_eligible?: boolean | null;
  tds_eligible?: boolean | null;
  exit_date?: string | null;
}

export interface MasterPayrollAdjustments {
  incentive?: number;
  arrears?: number;
  advance?: number;
  tds?: number;
  lopDays?: number;
  remarks?: string;
  epfOverride?: number;
  ptOverride?: number;
  recoverPendingStatutory?: boolean;
}

export interface MasterPayrollRow {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  joining_date: string;
  ctc: number;
  designation: string;
  department?: string;
  bank_account_number: string;
  ifsc_code: string;
  bank_name: string;
  pf_account_number: string;
  uan_number: string;
  pan_number: string;

  basic: number;
  hra: number;
  conveyance: number;
  medical_allowance: number;
  leave_travel_allowance: number;
  employer_pf: number;
  special_allowance: number;
  arrears: number;

  working_days: number;
  pay_days: number;
  gross_salary: number;

  incentive: number;

  loss_of_pay: number;
  lop_days: number;
  advance: number;
  tds: number;
  pt: number;
  epf: number;
  esic_emp: number;
  other_deduction: number;

  has_pending_statutory?: boolean;
  pending_pf?: number;
  pending_esi?: number;
  recovered_statutory?: number;

  esic_empr: number;
  pf_admin: number;

  total_deductions: number;
  net_payout: number;
  remarks: string;

  status: "draft" | "processed" | "paid";
  payslip_id?: string;
}

export interface MasterRegisterTotals {
  ctc: number;
  basic: number;
  hra: number;
  conveyance: number;
  medical_allowance: number;
  leave_travel_allowance: number;
  employer_pf: number;
  special_allowance: number;
  arrears: number;
  working_days: number;
  pay_days: number;
  gross_salary: number;
  incentive: number;
  loss_of_pay: number;
  advance: number;
  tds: number;
  pt: number;
  epf: number;
  esic_emp: number;
  other_deduction: number;
  esic_empr: number;
  pf_admin: number;
  total_deductions: number;
  net_payout: number;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/**
 * Counts inclusive calendar days within the employee's employment period.
 * Joining date and exit date are both included.
 */
export function calculateEmployeePayrollDays(
  joiningDate: string | null | undefined,
  exitDate: string | null | undefined,
  monthStart: string,
  monthEnd: string
): number {
  const normalizedJoin = normalizeDate(joiningDate);
  const normalizedExit = normalizeDate(exitDate);

  const start =
    normalizedJoin && normalizedJoin > monthStart
      ? normalizedJoin
      : monthStart;

  const end =
    normalizedExit && normalizedExit < monthEnd
      ? normalizedExit
      : monthEnd;

  if (start > end) return 0;

  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;

  return Math.floor((endTime - startTime) / 86400000) + 1;
}

/**
 * Normalizes salary to Monthly CTC.
 */
export function getMonthlyCtc(
  salary: number | string | null | undefined
): number {
  const num = Number(salary ?? 0);

  if (!Number.isFinite(num) || num <= 0) return 0;

  if (num <= 100) {
    return round2((num * 100000) / 12);
  }

  if (num >= 1000000) {
    return round2(num / 12);
  }

  return round2(num);
}

export function calculateStandardEpf(
  ctc: number,
  basic: number,
  pfEligible: boolean
): number {
  if (!pfEligible) return 0;
  if (ctc >= 50000) return 4800;
  if (ctc >= 35000) return 4200;
  if (ctc >= 20000) return 3000;

  return round2(Math.min(basic * 0.12, 4800));
}

export function calculateMasterPayrollRow(
  emp: MasterPayrollEmployee,
  daysInMonth: number,
  calculatedLopDays: number = 0,
  adjustments?: MasterPayrollAdjustments,
  existingPayslip?: Record<string, unknown> | null,
  pendingStatutory?: { pf: number; esi: number },
  employeeDaysInPeriod?: number
): MasterPayrollRow {
  const ctc = getMonthlyCtc(emp.salary);

  const fullName = [emp.first_name, emp.last_name]
    .filter(Boolean)
    .join(" ");

  const joiningDate = normalizeDate(emp.joining_date) || "—";

  const pfEligible = emp.pf_eligible !== false;
  const ptEligible = emp.pt_eligible !== false;
  const esiEligible =
    Boolean(emp.esi_healthcare_eligible) && ctc <= 21000;

  const workingDays = Math.max(
    0,
    Math.floor(employeeDaysInPeriod ?? daysInMonth)
  );

  const requestedLopDays = Math.max(
    0,
    adjustments?.lopDays !== undefined
      ? Number(adjustments.lopDays)
      : calculatedLopDays !== undefined
        ? Number(calculatedLopDays)
        : Number(existingPayslip?.lop_days || 0)
  );

  const lopDays = round2(Math.min(workingDays, requestedLopDays));
  const payDays = Math.max(0, workingDays - lopDays);

  // Earnings components
  const basic = round2(ctc * 0.5);
  const hra = round2(basic * 0.5);
  const conveyance = 1600;
  const medicalAllowance = 1250;
  const leaveTravelAllowance = 0;

  const employerPf = pfEligible
    ? round2(Math.min(basic * 0.12, 3000))
    : 0;

  const specialAllowance = Math.max(
    0,
    round2(
      ctc -
        (basic +
          hra +
          conveyance +
          medicalAllowance +
          leaveTravelAllowance +
          employerPf)
    )
  );

  const arrears = round2(
    adjustments?.arrears !== undefined
      ? Number(adjustments.arrears)
      : Number(existingPayslip?.arrears || 0)
  );

  // Gross and LOP use employee-eligible calendar days.
  const lossOfPay =
    workingDays > 0
      ? round2((ctc * lopDays) / workingDays)
      : 0;

  const grossSalary =
    workingDays > 0
      ? round2((ctc * payDays) / workingDays)
      : 0;

  const incentive = round2(
    adjustments?.incentive !== undefined
      ? Number(adjustments.incentive)
      : Number(existingPayslip?.incentive || 0)
  );

  const advance = round2(
    adjustments?.advance !== undefined
      ? Number(adjustments.advance)
      : Number(existingPayslip?.advance || 0)
  );

  const tds = round2(
    adjustments?.tds !== undefined
      ? Number(adjustments.tds)
      : Number(existingPayslip?.tds || 0)
  );

  const pt =
    adjustments?.ptOverride !== undefined
      ? Number(adjustments.ptOverride)
      : ptEligible && grossSalary > 0
        ? 200
        : 0;

  const epf =
    adjustments?.epfOverride !== undefined
      ? Number(adjustments.epfOverride)
      : calculateStandardEpf(ctc, basic, pfEligible);

  const esicEmp = esiEligible
    ? round2(grossSalary * 0.0075)
    : 0;

  const esicEmpr = esiEligible
    ? round2(grossSalary * 0.0325)
    : 0;

  const pfAdmin = pfEligible ? 150 : 0;

  const pendingPf = pendingStatutory?.pf ?? 0;
  const pendingEsi = pendingStatutory?.esi ?? 0;

  const hasPendingStatutory = pendingPf > 0 || pendingEsi > 0;

  const shouldRecover =
    adjustments?.recoverPendingStatutory === true ||
    (Array.isArray(existingPayslip?.deductions_breakup) &&
      (existingPayslip.deductions_breakup as Array<Record<string, unknown>>).some(
        (b) => b.code === "STATUTORY_RECOVERY"
      ));

  const recoveredStatutory = shouldRecover
    ? round2(pendingPf + pendingEsi)
    : 0;

  const otherDeduction = round2(recoveredStatutory);

  const totalDeductions =
    payDays === 0
      ? 0
      : round2(
          advance +
            tds +
            pt +
            epf +
            esicEmp +
            otherDeduction
        );

  const netPayout =
    payDays === 0
      ? 0
      : round2(
          grossSalary +
            incentive +
            arrears -
            totalDeductions
        );

  let remarks: string =
    adjustments?.remarks !== undefined
      ? String(adjustments.remarks)
      : String(existingPayslip?.remarks || "");

  if (payDays === 0 && workingDays > 0) {
    const absenceNote =
      `Full month absence (Pay Days: 0, PF ₹${epf} carried to pending)`;

    remarks = remarks
      ? `${remarks} · ${absenceNote}`
      : absenceNote;
  }

  if (recoveredStatutory > 0 && !remarks.includes("recovered")) {
    const recoveryNote =
      `Recovered previous pending statutory (PF: ₹${pendingPf}${
        pendingEsi > 0 ? `, ESI: ₹${pendingEsi}` : ""
      })`;

    remarks = remarks
      ? `${remarks} · ${recoveryNote}`
      : recoveryNote;
  }

  const status: "draft" | "processed" | "paid" =
    (existingPayslip?.payment_status as "draft" | "processed" | "paid") || "draft";

  return {
    employee_id: emp.id,
    employee_code: emp.employee_id || "—",
    employee_name: fullName || "—",
    joining_date: joiningDate,
    ctc,
    designation: emp.designation || "—",
    department: emp.department || emp.department_name || "General",

    bank_account_number: emp.bank_account_number || "—",
    ifsc_code: emp.ifsc_code || "—",
    bank_name: emp.bank_name || "—",
    pf_account_number: emp.pf_number || emp.uan_number || "—",
    uan_number: emp.uan_number || "—",
    pan_number: emp.pan_number || "—",

    basic,
    hra,
    conveyance,
    medical_allowance: medicalAllowance,
    leave_travel_allowance: leaveTravelAllowance,
    employer_pf: employerPf,
    special_allowance: specialAllowance,
    arrears,

    working_days: workingDays,
    pay_days: payDays,
    gross_salary: grossSalary,

    incentive,
    loss_of_pay: lossOfPay,
    lop_days: lopDays,
    advance,
    tds,
    pt,
    epf,
    esic_emp: esicEmp,
    other_deduction: otherDeduction,

    has_pending_statutory: hasPendingStatutory,
    pending_pf: pendingPf,
    pending_esi: pendingEsi,
    recovered_statutory: recoveredStatutory,

    esic_empr: esicEmpr,
    pf_admin: pfAdmin,

    total_deductions: totalDeductions,
    net_payout: netPayout,
    remarks,

    status,
    payslip_id: existingPayslip?.id ? String(existingPayslip.id) : undefined,
  };
}

export function calculateRegisterTotals(
  rows: MasterPayrollRow[]
): MasterRegisterTotals {
  const totals: MasterRegisterTotals = {
    ctc: 0,
    basic: 0,
    hra: 0,
    conveyance: 0,
    medical_allowance: 0,
    leave_travel_allowance: 0,
    employer_pf: 0,
    special_allowance: 0,
    arrears: 0,
    working_days: 0,
    pay_days: 0,
    gross_salary: 0,
    incentive: 0,
    loss_of_pay: 0,
    advance: 0,
    tds: 0,
    pt: 0,
    epf: 0,
    esic_emp: 0,
    other_deduction: 0,
    esic_empr: 0,
    pf_admin: 0,
    total_deductions: 0,
    net_payout: 0,
  };

  for (const row of rows) {
    totals.ctc += row.ctc;
    totals.basic += row.basic;
    totals.hra += row.hra;
    totals.conveyance += row.conveyance;
    totals.medical_allowance += row.medical_allowance;
    totals.leave_travel_allowance += row.leave_travel_allowance;
    totals.employer_pf += row.employer_pf;
    totals.special_allowance += row.special_allowance;
    totals.arrears += row.arrears;
    totals.working_days += row.working_days;
    totals.pay_days += row.pay_days;
    totals.gross_salary += row.gross_salary;
    totals.incentive += row.incentive;
    totals.loss_of_pay += row.loss_of_pay;
    totals.advance += row.advance;
    totals.tds += row.tds;
    totals.pt += row.pt;
    totals.epf += row.epf;
    totals.esic_emp += row.esic_emp;
    totals.other_deduction += row.other_deduction;
    totals.esic_empr += row.esic_empr;
    totals.pf_admin += row.pf_admin;
    totals.total_deductions += row.total_deductions;
    totals.net_payout += row.net_payout;
  }

  for (const key of Object.keys(totals) as Array<keyof MasterRegisterTotals>) {
    totals[key] = round2(totals[key]);
  }

  return totals;
}

export function generateExcelCsv(
  rows: MasterPayrollRow[],
  monthName: string,
  year: number,
  companyName = "NYTP",
  companyAddress = "Hyderabad",
  companyContact = "Ph: 8008001898, www.nytp.com"
): string {
  const totals = calculateRegisterTotals(rows);

  const headerLines = [
    `Company Name: ${companyName}` + ",".repeat(33),
    `Address: ${companyAddress}` + ",".repeat(33),
    `Month: ${monthName} ${year},,,"${companyContact}"` + ",".repeat(30),
    [
      "Emp. Code",
      "Name",
      "DOJ",
      "CTC",
      "Designation",
      "Bank Account No",
      "IFSC Code",
      "Bank Name",
      "PF A/c No.",
      "PF UAN",
      "PAN",
      "Basic",
      "HRA",
      "Conveyance",
      "Medical Allowance",
      "Leave Travel All",
      "Employer PF",
      "Special Allowance",
      "Arrears",
      "No. Of Days",
      "Pay Days",
      "Gross Salary",
      "Incentive",
      "Loss of pay",
      "Advance",
      "TDS",
      "PT",
      "EPF ",
      "ESIC-Emp",
      "Other Deduction",
      "ESIC-Empr",
      "PF Admin",
      "Total Deduction",
      "Net Payout ",
      "Remarks",
    ].join(","),
  ];

  const dataLines = rows.map((r) =>
    [
      `"${r.employee_code}"`,
      `"${r.employee_name}"`,
      r.joining_date === "—" ? "" : r.joining_date,
      r.ctc,
      `"${r.designation}"`,
      `"${r.bank_account_number}"`,
      `"${r.ifsc_code}"`,
      `"${r.bank_name}"`,
      `"${r.pf_account_number}"`,
      `"${r.uan_number}"`,
      `"${r.pan_number}"`,
      r.basic,
      r.hra,
      r.conveyance,
      r.medical_allowance,
      r.leave_travel_allowance,
      r.employer_pf,
      r.special_allowance,
      r.arrears,
      r.working_days,
      r.pay_days,
      r.gross_salary,
      r.incentive,
      r.loss_of_pay,
      r.advance,
      r.tds,
      r.pt,
      r.epf,
      r.esic_emp,
      r.other_deduction,
      r.esic_empr,
      r.pf_admin,
      r.total_deductions,
      r.net_payout,
      `"${r.remarks.replace(/"/g, '""')}"`,
    ].join(",")
  );

  const totalLine = [
    "",
    "Total",
    "",
    totals.ctc,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    totals.basic,
    totals.hra,
    totals.conveyance,
    totals.medical_allowance,
    totals.leave_travel_allowance,
    totals.employer_pf,
    totals.special_allowance,
    totals.arrears,
    totals.working_days,
    totals.pay_days,
    totals.gross_salary,
    totals.incentive,
    totals.loss_of_pay,
    totals.advance,
    totals.tds,
    totals.pt,
    totals.epf,
    totals.esic_emp,
    totals.other_deduction,
    totals.esic_empr,
    totals.pf_admin,
    totals.total_deductions,
    totals.net_payout,
    "",
  ].join(",");

  return [...headerLines, ...dataLines, totalLine].join("\n");
}

// ====================================================
// ATTENDANCE & LEAVE LOP CALCULATION ENGINE
// ====================================================

export interface RawAttendanceLog {
  employee_id: string;
  attendance_date: string;
  status: string;
}

export interface RawLeaveRequest {
  id?: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days?: number | string;
  is_half_day?: boolean;
  status?: string;
  leave_types?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    is_paid?: boolean | null;
  } | null;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isLeaveConsideredLop(leave: RawLeaveRequest): boolean {
  const lt = leave.leave_types;
  if (!lt) return false;

  if (lt.is_paid === false) return true;

  const code = String(lt.code || "").toUpperCase().trim();

  if (code === "LOP" || code === "UNPAID") return true;

  const name = String(lt.name || "").toLowerCase().trim();

  return (
    name.includes("loss of pay") ||
    name.includes("lop") ||
    name.includes("unpaid")
  );
}

export interface LopCalculationOptions {
  joiningDate?: string | null;
  exitDate?: string | null;
  holidays?: Array<{
    holiday_date: string;
    is_working_day?: boolean;
    is_optional?: boolean;
  }>;
  workingSaturdays?: number[];
}

export function calculateEmployeeLopDays(
  employeeId: string,
  attendanceLogs: RawAttendanceLog[],
  leaveRequests: RawLeaveRequest[],
  monthStart?: string,
  monthEnd?: string,
  options?: LopCalculationOptions
): number {
  if (!monthStart || !monthEnd) return 0;

  const holidayDates = new Set<string>();

  for (const h of options?.holidays ?? []) {
    if (
      h.is_working_day !== true &&
      h.is_optional !== true &&
      h.holiday_date
    ) {
      holidayDates.add(String(h.holiday_date).slice(0, 10));
    }
  }

  const workingSatSet = new Set(options?.workingSaturdays ?? []);

  const joinDateStr = normalizeDate(options?.joiningDate);
  const exitDateStr = normalizeDate(options?.exitDate);

  const empLeaves = leaveRequests.filter(
    (l) =>
      l.employee_id === employeeId &&
      (l.status === undefined || l.status === "approved")
  );

  const leaveCoveredDays = new Map<
    string,
    { isLop: boolean; isHalfDay: boolean }
  >();

  for (const leave of empLeaves) {
    const isLop = isLeaveConsideredLop(leave);

    const startDate = parseLocalDate(
      String(leave.start_date).slice(0, 10)
    );

    const endDate = parseLocalDate(
      String(leave.end_date || leave.start_date).slice(0, 10)
    );

    const cur = new Date(startDate);

    while (cur <= endDate) {
      const dateStr = formatDateStr(cur);

      if (dateStr >= monthStart && dateStr <= monthEnd) {
        leaveCoveredDays.set(dateStr, {
          isLop,
          isHalfDay: Boolean(leave.is_half_day),
        });
      }

      cur.setDate(cur.getDate() + 1);
    }
  }

  const empLogs = attendanceLogs.filter(
    (a) => a.employee_id === employeeId
  );

  const logByDate = new Map<string, RawAttendanceLog>();

  for (const log of empLogs) {
    if (log.attendance_date) {
      logByDate.set(
        String(log.attendance_date).slice(0, 10),
        log
      );
    }
  }

  let presentDays = 0;
  let paidLeaveDays = 0;
  let lopDays = 0;
  let totalWorkingDays = 0;
  let totalCalendarDays = 0;

  const cur = parseLocalDate(monthStart);
  const end = parseLocalDate(monthEnd);

  while (cur <= end) {
    const dateStr = formatDateStr(cur);
    const dayOfWeek = cur.getDay();
    const dayOfMonth = cur.getDate();

    // Dates outside the employee's employment period are ignored.
    if (
      (joinDateStr && dateStr < joinDateStr) ||
      (exitDateStr && dateStr > exitDateStr)
    ) {
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    totalCalendarDays++;

    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const isWorkingSaturday =
      isSaturday && workingSatSet.has(dayOfMonth);
    const isHoliday = holidayDates.has(dateStr);

    const isWorkingDay =
      !isSunday &&
      (!isSaturday || isWorkingSaturday) &&
      !isHoliday;

    if (!isWorkingDay) {
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    totalWorkingDays++;

    if (leaveCoveredDays.has(dateStr)) {
      const leaveInfo = leaveCoveredDays.get(dateStr)!;

      if (leaveInfo.isLop) {
        lopDays += leaveInfo.isHalfDay ? 0.5 : 1;
      } else {
        paidLeaveDays += leaveInfo.isHalfDay ? 0.5 : 1;
      }

      cur.setDate(cur.getDate() + 1);
      continue;
    }

    const log = logByDate.get(dateStr);

    if (!log) {
      lopDays += 1;
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    const st = String(log.status || "").toLowerCase().trim();

    if (st === "present" || st === "half_day") {
      presentDays += 1;
    } else {
      lopDays += 1;
    }

    cur.setDate(cur.getDate() + 1);
  }

  // Full-month absence: count only eligible calendar days,
  // never dates before joining or after exit.
  if (
    totalWorkingDays > 0 &&
    presentDays === 0 &&
    paidLeaveDays === 0
  ) {
    return Number(totalCalendarDays.toFixed(1));
  }

  return Number(Math.max(0, lopDays).toFixed(1));
}