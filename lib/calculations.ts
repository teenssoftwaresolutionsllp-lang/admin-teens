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

  const ignoredKeys = new Set(["id", "user_id", "created_at", "updated_at", "department", "project"]);
  const checklist = Object.keys(employee)
    .filter((key) => !ignoredKeys.has(key))
    .map((key) => ({ key, label: formatProfileFieldLabel(key), weight: 1 }));

  let earnedScore = 0;
  let totalScore = 0;
  let completedCount = 0;
  const missingFields: string[] = [];

  for (const item of checklist) {
    totalScore += item.weight;
    const val = employee[item.key as keyof Employee];
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

function formatProfileFieldLabel(key: string): string {
  return key
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
  const perDayRate = Number(
    (grossSalary / Math.max(totalDaysInMonth, 1)).toFixed(2)
  );

  const lopDeduction = Number(
    (lopDays * perDayRate).toFixed(2)
  );

  const adjustedGross = Math.max(
    0,
    Number((grossSalary - lopDeduction).toFixed(2))
  );

  // ---------------------------------------------------------
  // EMPLOYEE EARNINGS
  // ---------------------------------------------------------

  const earningsComponents = activeComponents.filter(
    (component) =>
      component.type === "earning" &&
      component.is_active &&
      component.code !== "GRATUITY"
  );

  // ---------------------------------------------------------
  // EMPLOYEE DEDUCTIONS
  // Employer PF must NEVER be deducted from employee salary.
  // Gratuity must NEVER be deducted from employee salary.
  // ---------------------------------------------------------

  const deductionsComponents = activeComponents.filter(
    (component) =>
      component.type === "deduction" &&
      component.is_active &&
      component.code !== "EMPLOYER_PF" &&
      component.code !== "GRATUITY"
  );

  // ---------------------------------------------------------
  // BASIC
  // ---------------------------------------------------------

  const basicComp = earningsComponents.find(
    (component) => component.code === "BASIC"
  );

  const basicPercent = basicComp?.value ?? 47;

  const basicAmount = Number(
    ((grossSalary * basicPercent) / 100).toFixed(2)
  );

  // ---------------------------------------------------------
  // EARNINGS BREAKDOWN
  // ---------------------------------------------------------

  const earningsBreakdown: PayslipBreakupItem[] = [];

  let accountedEarnings = 0;

  for (const component of earningsComponents) {
    let amount = 0;

    if (component.code === "BASIC") {
      amount = basicAmount;
    } else if (component.code === "HRA") {
      const hraPercent = component.value ?? 50;

      amount = Number(
        ((basicAmount * hraPercent) / 100).toFixed(2)
      );
    } else if (component.code === "SPECIAL_ALLOWANCE") {
      // Calculated after all fixed/percentage earnings.
      continue;
    } else if (
      component.calculation_type === "percentage_of_basic"
    ) {
      amount = Number(
        ((basicAmount * component.value) / 100).toFixed(2)
      );
    } else if (
      component.calculation_type === "percentage_of_gross"
    ) {
      amount = Number(
        ((grossSalary * component.value) / 100).toFixed(2)
      );
    } else {
      amount = Number(component.value);
    }

    if (amount > 0) {
      accountedEarnings += amount;

      earningsBreakdown.push({
        component_id: component.id,
        name: component.name,
        code: component.code,
        type: "earning",
        amount,
      });
    }
  }

  // ---------------------------------------------------------
  // SPECIAL ALLOWANCE
  // Remaining amount required to make employee earnings
  // equal to gross salary.
  // ---------------------------------------------------------

  const specialComp = earningsComponents.find(
    (component) => component.code === "SPECIAL_ALLOWANCE"
  );

  if (specialComp) {
    const specialAllowance = Math.max(
      0,
      Number((grossSalary - accountedEarnings).toFixed(2))
    );

    earningsBreakdown.push({
      component_id: specialComp.id,
      name: specialComp.name,
      code: specialComp.code,
      type: "earning",
      amount: specialAllowance,
    });

    accountedEarnings += specialAllowance;
  }

  const totalEarnings = Number(
    accountedEarnings.toFixed(2)
  );

  // ---------------------------------------------------------
  // EMPLOYEE DEDUCTIONS
  // ---------------------------------------------------------

  const deductionsBreakdown: PayslipBreakupItem[] = [];

  let totalDeductions = 0;

  // LOP
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

  for (const component of deductionsComponents) {
    let amount = 0;

    if (component.code === "PF") {
      const pfPercent = component.value ?? 12;

      amount = Number(
        ((basicAmount * pfPercent) / 100).toFixed(2)
      );
    } else if (component.code === "ESI") {
      // Employee ESI applies only when gross salary
      // is within the ESI wage limit.
      if (grossSalary <= 21000) {
        amount = Number(
          ((grossSalary * component.value) / 100).toFixed(2)
        );
      }
    } else if (component.code === "PT") {
      amount = Number(component.value || 0);
    } else if (
      component.calculation_type === "percentage_of_basic"
    ) {
      amount = Number(
        ((basicAmount * component.value) / 100).toFixed(2)
      );
    } else if (
      component.calculation_type === "percentage_of_gross"
    ) {
      amount = Number(
        ((grossSalary * component.value) / 100).toFixed(2)
      );
    } else {
      amount = Number(component.value || 0);
    }

    if (amount > 0) {
      deductionsBreakdown.push({
        component_id: component.id,
        name: component.name,
        code: component.code,
        type: "deduction",
        amount,
      });

      totalDeductions += amount;
    }
  }

  totalDeductions = Number(
    totalDeductions.toFixed(2)
  );

  // ---------------------------------------------------------
  // NET SALARY
  // ---------------------------------------------------------

  const netSalary = Math.max(
    0,
    Number((totalEarnings - totalDeductions).toFixed(2))
  );

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

// gratuity
export function calculateGratuity(
  joiningDate: string,
  basicSalary: number,
  asOfDate = new Date()
): {
  completedYears: number;
  completedMonths: number;
  serviceYearsText: string;
  gratuityServiceYears: number;
  gratuityAmount: number;
} {
  const joining = new Date(joiningDate);

  if (Number.isNaN(joining.getTime())) {
    return {
      completedYears: 0,
      completedMonths: 0,
      serviceYearsText: "0 Years",
      gratuityServiceYears: 0,
      gratuityAmount: 0,
    };
  }

  let years = asOfDate.getFullYear() - joining.getFullYear();
  let months = asOfDate.getMonth() - joining.getMonth();

  if (asOfDate.getDate() < joining.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  years = Math.max(0, years);
  months = Math.max(0, months);

  // Gratuity calculation:
  // 6 months or more = next year
  const gratuityServiceYears =
    months >= 6 ? years + 1 : years;

  const gratuityAmount =
    gratuityServiceYears >= 5
      ? Number(
          (
            (basicSalary * 15 * gratuityServiceYears) /
            26
          ).toFixed(2)
        )
      : 0;

  const serviceYearsText =
    months === 0
      ? `${years} ${years === 1 ? "Year" : "Years"}`
      : `${years} ${years === 1 ? "Year" : "Years"} ${months} ${
          months === 1 ? "Month" : "Months"
        }`;

  return {
    completedYears: years,
    completedMonths: months,
    serviceYearsText,
    gratuityServiceYears,
    gratuityAmount,
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
