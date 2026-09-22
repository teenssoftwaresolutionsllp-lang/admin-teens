import { Employee, SalaryComponent, PayslipBreakupItem, AttendanceStatus } from "./types";

/**
 * Calculates employee profile completion percentage and identifies missing fields.
 * Returns a score from 0 to 100, turning full solid green at 100%.
 */
export function calculateProfileCompletion(employee: Partial<Employee> | null | undefined): {
  percentage: number;
  missingFields: string[];
  completedFieldsCount: number;
  totalFieldsCount: number;
  isComplete: boolean;
} {
  if (!employee) {
    return { percentage: 0, missingFields: ["Employee Record"], completedFieldsCount: 0, totalFieldsCount: 1, isComplete: false };
  }

  const checklist: { key: keyof Employee; label: string; weight: number }[] = [
    // Personal Info (25%)
    { key: "first_name", label: "First Name", weight: 4 },
    { key: "last_name", label: "Last Name", weight: 4 },
    { key: "email", label: "Official Email", weight: 4 },
    { key: "phone", label: "Phone Number", weight: 4 },
    { key: "date_of_birth", label: "Date of Birth", weight: 3 },
    { key: "gender", label: "Gender", weight: 3 },
    { key: "blood_group", label: "Blood Group", weight: 3 },

    // Address & Emergency (25%)
    { key: "address", label: "Address", weight: 7 },
    { key: "city", label: "City", weight: 3 },
    { key: "state", label: "State", weight: 3 },
    { key: "pincode", label: "Pincode", weight: 4 },
    { key: "emergency_contact_name", label: "Emergency Contact Name", weight: 4 },
    { key: "emergency_contact_phone", label: "Emergency Contact Phone", weight: 4 },

    // Bank & Identity KYC (30%)
    { key: "bank_name", label: "Bank Name", weight: 6 },
    { key: "bank_account_number", label: "Account Number", weight: 7 },
    { key: "ifsc_code", label: "IFSC Code", weight: 5 },
    { key: "pan_number", label: "PAN Card Number", weight: 6 },
    { key: "aadhar_number", label: "Aadhaar Card Number", weight: 6 },

    // Employment Details (20%)
    { key: "department_id", label: "Department", weight: 5 },
    { key: "designation", label: "Designation", weight: 5 },
    { key: "joining_date", label: "Joining Date", weight: 5 },
    { key: "employment_type", label: "Employment Type", weight: 5 },
  ];

  let earnedScore = 0;
  let totalScore = 0;
  let completedCount = 0;
  const missingFields: string[] = [];

  for (const item of checklist) {
    totalScore += item.weight;
    const val = employee[item.key];
    const isFilled = val !== null && val !== undefined && String(val).trim().length > 0;
    if (isFilled) {
      earnedScore += item.weight;
      completedCount++;
    } else {
      missingFields.push(item.label);
    }
  }

  const rawPercentage = Math.round((earnedScore / totalScore) * 100);
  const percentage = Math.min(100, Math.max(0, rawPercentage));

  return {
    percentage,
    missingFields,
    completedFieldsCount: completedCount,
    totalFieldsCount: checklist.length,
    isComplete: percentage === 100,
  };
}

/**
 * Evaluates attendance check-in based on project shift timings and grace periods.
 * Example Shift 09:00, Grace 30m:
 * <= 09:30: Present
 * 09:31 - 11:30: Present (Late)
 * > 11:30: Half Day
 */
export function evaluateAttendancePunch(
  checkInDate: Date,
  shiftStartTime: string = "09:00",
  gracePeriodMinutes: number = 30,
  halfDayCutoffMinutes: number = 150
): { status: AttendanceStatus; isLate: boolean; lateMinutes: number } {
  const [shiftHours, shiftMins] = shiftStartTime.split(":").map(Number);
  const shiftStart = new Date(checkInDate);
  shiftStart.setHours(shiftHours, shiftMins, 0, 0);

  const diffMs = checkInDate.getTime() - shiftStart.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes <= gracePeriodMinutes) {
    return { status: "present", isLate: false, lateMinutes: 0 };
  } else if (diffMinutes <= halfDayCutoffMinutes) {
    return { status: "present", isLate: true, lateMinutes: diffMinutes - gracePeriodMinutes };
  } else {
    return { status: "half_day", isLate: true, lateMinutes: diffMinutes - gracePeriodMinutes };
  }
}

/**
 * Calculates monthly salary breakdown taking into account:
 * - Gross Salary
 * - LOP (Loss of Pay / unpaid leaves) deduction
 * - Active HR-configured salary components (Basic, HRA, Special Allowance, PF, ESI, PT, TDS)
 */
export function calculateSalaryBreakdown({
  grossSalary,
  totalDaysInMonth = 30,
  lopDays = 0,
  activeComponents,
}: {
  grossSalary: number;
  totalDaysInMonth?: number;
  lopDays?: number;
  activeComponents: SalaryComponent[];
}): {
  grossSalary: number;
  lopDays: number;
  perDayRate: number;
  lopDeduction: number;
  adjustedGross: number;
  earningsBreakdown: PayslipBreakupItem[];
  deductionsBreakdown: PayslipBreakupItem[];
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
} {
  const perDayRate = Number((grossSalary / totalDaysInMonth).toFixed(2));
  const lopDeduction = Number((lopDays * perDayRate).toFixed(2));
  const adjustedGross = Math.max(0, grossSalary - lopDeduction);

  const earningsComponents = activeComponents.filter((c) => c.type === "earning" && c.is_active);
  const deductionsComponents = activeComponents.filter((c) => c.type === "deduction" && c.is_active);

  // 1. Calculate Basic Pay (standard 50% of gross)
  const basicComp = earningsComponents.find((c) => c.code === "BASIC");
  const basicPercent = basicComp?.value ?? 50;
  const basicAmount = Number(((grossSalary * basicPercent) / 100).toFixed(2));

  // 2. Compute each active Earning
  const earningsBreakdown: PayslipBreakupItem[] = [];
  let accountedEarnings = 0;

  for (const comp of earningsComponents) {
    let amount = 0;
    if (comp.code === "BASIC") {
      amount = basicAmount;
    } else if (comp.code === "HRA") {
      // Typically 40% of Basic
      const hraPercent = comp.value ?? 40;
      amount = Number(((basicAmount * hraPercent) / 100).toFixed(2));
    } else if (comp.code === "SPECIAL_ALLOWANCE") {
      // Floating balancing component: Gross - (Basic + HRA + other fixed earnings)
      amount = 0; // calculated after others
    } else if (comp.calculation_type === "percentage_of_basic") {
      amount = Number(((basicAmount * comp.value) / 100).toFixed(2));
    } else if (comp.calculation_type === "percentage_of_gross") {
      amount = Number(((grossSalary * comp.value) / 100).toFixed(2));
    } else {
      amount = Number(comp.value);
    }

    if (comp.code !== "SPECIAL_ALLOWANCE") {
      accountedEarnings += amount;
      earningsBreakdown.push({
        component_id: comp.id,
        name: comp.name,
        code: comp.code,
        type: "earning",
        amount,
      });
    }
  }

  // Handle Special Allowance as balancing figure if active
  const specialComp = earningsComponents.find((c) => c.code === "SPECIAL_ALLOWANCE");
  if (specialComp) {
    const specialAllowance = Math.max(0, Number((grossSalary - accountedEarnings).toFixed(2)));
    earningsBreakdown.push({
      component_id: specialComp.id,
      name: specialComp.name,
      code: specialComp.code,
      type: "earning",
      amount: specialAllowance,
    });
    accountedEarnings += specialAllowance;
  }

  const totalEarnings = grossSalary;

  // 3. Compute each active Deduction
  const deductionsBreakdown: PayslipBreakupItem[] = [];
  let totalDeductions = 0;

  // Add LOP Deduction as an item if lopDays > 0
  if (lopDays > 0 && lopDeduction > 0) {
    deductionsBreakdown.push({
      component_id: "lop_deduction",
      name: `Loss of Pay (${lopDays} day${lopDays > 1 ? "s" : ""})`,
      code: "LOP",
      type: "deduction",
      amount: lopDeduction,
    });
    totalDeductions += lopDeduction;
  }

  for (const comp of deductionsComponents) {
    let amount = 0;
    if (comp.code === "PF") {
      // Statutory PF: 12% of Basic Pay (commonly capped at 12% of ₹15,000 = ₹1,800 or 12% of basic)
      const pfPercent = comp.value ?? 12;
      amount = Number(((basicAmount * pfPercent) / 100).toFixed(2));
    } else if (comp.code === "ESI") {
      // ESI: 0.75% of Gross if gross <= 21,000
      if (grossSalary <= 21000) {
        amount = Number(((grossSalary * 0.75) / 100).toFixed(2));
      } else {
        amount = 0;
      }
    } else if (comp.code === "PT") {
      // Professional tax: flat standard ₹200
      amount = comp.value || 200;
    } else if (comp.calculation_type === "percentage_of_basic") {
      amount = Number(((basicAmount * comp.value) / 100).toFixed(2));
    } else if (comp.calculation_type === "percentage_of_gross") {
      amount = Number(((grossSalary * comp.value) / 100).toFixed(2));
    } else {
      amount = Number(comp.value);
    }

    if (amount > 0) {
      deductionsBreakdown.push({
        component_id: comp.id,
        name: comp.name,
        code: comp.code,
        type: "deduction",
        amount,
      });
      totalDeductions += amount;
    }
  }

  const netSalary = Math.max(0, Number((totalEarnings - totalDeductions).toFixed(2)));

  return {
    grossSalary,
    lopDays,
    perDayRate,
    lopDeduction,
    adjustedGross,
    earningsBreakdown,
    deductionsBreakdown,
    totalEarnings,
    totalDeductions,
    netSalary,
  };
}

/**
 * Converts numbers into Indian Currency Words (e.g. ₹54,200 -> Fifty Four Thousand Two Hundred Rupees Only)
 */
export function numberToWordsIndian(amount: number): string {
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ",
    "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const num = Math.floor(amount);
  if (num === 0) return "Zero Rupees Only";

  const numStr = ("000000000" + num).substr(-9);
  const crore = Number(numStr.substr(0, 2));
  const lakh = Number(numStr.substr(2, 2));
  const thousand = Number(numStr.substr(4, 2));
  const hundred = Number(numStr.substr(6, 1));
  const tens = Number(numStr.substr(7, 2));

  let str = "";

  function getTens(n: number) {
    if (n === 0) return "";
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + " " + a[n % 10];
  }

  if (crore > 0) str += getTens(crore) + "Crore ";
  if (lakh > 0) str += getTens(lakh) + "Lakh ";
  if (thousand > 0) str += getTens(thousand) + "Thousand ";
  if (hundred > 0) str += a[hundred] + "Hundred ";
  if (tens > 0) str += getTens(tens);

  return str.trim() + " Rupees Only";
}
