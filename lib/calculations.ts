import {Employee,SalaryComponent,PayslipBreakupItem,AttendanceStatus} from "./types";

/**
 * Calculates employee profile completion percentage and identifies missing fields.
 */
export function calculateProfileCompletion(
  employee: Partial<Employee> | null | undefined
): {
  percentage: number;
  missingFields: string[];
  completedFieldsCount: number;
  totalFieldsCount: number;
  isComplete: boolean;
} {
  if (!employee) {
    return {
      percentage: 0,
      missingFields: ["Employee Record"],
      completedFieldsCount: 0,
      totalFieldsCount: 1,
      isComplete: false,
    };
  }

  const ignoredKeys = new Set([
    "id",
    "user_id",
    "created_at",
    "updated_at",
    "department",
    "project",
  ]);

  const checklist = Object.keys(employee)
    .filter((key) => !ignoredKeys.has(key))
    .map((key) => ({
      key,
      label: formatProfileFieldLabel(key),
      weight: 1,
    }));

  let earnedScore = 0;
  let totalScore = 0;
  let completedCount = 0;
  const missingFields: string[] = [];

  for (const item of checklist) {
    totalScore += item.weight;

    const val = employee[item.key as keyof Employee];

    const isFilled =
      val !== null &&
      val !== undefined &&
      String(val).trim().length > 0;

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
 */
export function evaluateAttendancePunch(
  checkInDate: Date,
  shiftStartTime: string = "09:00",
  gracePeriodMinutes: number = 30,
  halfDayCutoffMinutes: number = 150,
  shiftStartInstant?: Date
): {
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
} {
  const [shiftHours, shiftMins] = shiftStartTime.split(":").map(Number);

  const shiftStart = shiftStartInstant
    ? new Date(shiftStartInstant)
    : new Date(checkInDate);

  if (!shiftStartInstant) {
    shiftStart.setHours(shiftHours, shiftMins, 0, 0);
  }

  const diffMs = checkInDate.getTime() - shiftStart.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes <= gracePeriodMinutes) {
    return {
      status: "present",
      isLate: false,
      lateMinutes: 0,
    };
  } else if (diffMinutes <= halfDayCutoffMinutes) {
    return {
      status: "present",
      isLate: true,
      lateMinutes: diffMinutes - gracePeriodMinutes,
    };
  } else {
    return {
      status: "half_day",
      isLate: true,
      lateMinutes: diffMinutes - gracePeriodMinutes,
    };
  }
}

/**
 * Calculates monthly salary breakdown.
 *
 * Preserves:
 * - Existing HR-configured employee deductions
 * - Employee PF and ESI eligibility
 * - PT and TDS eligibility
 * - Existing LOP calculation method
 * - PF-first and ESI-second deduction priority
 *
 * New salary defaults:
 * - Basic: 50% of monthly CTC
 * - Conveyance: ₹1,600
 * - Medical: ₹1,250
 * - LTA: ₹0
 * - Special Allowance: balancing amount after Employer PF
 *
 * employerPfAmount is supplied by generateMonthlyPayroll.
 */
export function calculateSalaryBreakdown({
  grossSalary,
  totalDaysInMonth = 30,
  lopDays = 0,
  activeComponents,
  pfEligible = false,
  esiEligible = false,
  ptEligible = false,
  tdsEligible = false,
  employerPfAmount = 0,
}: {
  grossSalary: number;
  totalDaysInMonth?: number;
  lopDays?: number;
  activeComponents: SalaryComponent[];
  pfEligible?: boolean;
  esiEligible?: boolean;
  ptEligible?: boolean;
  tdsEligible?: boolean;
  employerPfAmount?: number;
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

  pfEligibleAmount: number;
  pfDeductedAmount: number;
  pfPendingAmount: number;

  esiEligibleAmount: number;
  esiDeductedAmount: number;
  esiPendingAmount: number;
} {
  const workingDays = Math.max(totalDaysInMonth, 1);

  // ---------------------------------------------------------
  // EMPLOYEE EARNINGS
  // ---------------------------------------------------------

  const earningsComponents = activeComponents.filter(
    (component) =>
      component.type === "earning" &&
      component.is_active &&
      component.code !== "GRATUITY"
  );

  // Default allowances are added only when no active
  // employee/master component with that code is supplied.
  // Existing employee-specific values take priority.
  const defaultAllowances: Array<{
    code: string;
    name: string;
    value: number;
  }> = [
    {
      code: "CONVEYANCE",
      name: "Conveyance Allowance",
      value: 1600,
    },
    {
      code: "MEDICAL",
      name: "Medical Allowance",
      value: 1250,
    },
    {
      code: "LTA",
      name: "Leave Travel Allowance",
      value: 0,
    },
  ];

  for (const allowance of defaultAllowances) {
    if (!earningsComponents.some((c) => c.code === allowance.code)) {
      earningsComponents.push({
        id: allowance.code,
        name: allowance.name,
        code: allowance.code,
        type: "earning",
        calculation_type: "fixed",
        value: allowance.value,
        affects_lop: false,
        is_active: true,
        is_statutory: false,
        description: "Default payroll allowance",
      });
    }
  }

  // ---------------------------------------------------------
  // EMPLOYEE DEDUCTIONS
  //
  // Employer PF and gratuity are never employee deductions.
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

  // Employee-specific or master value takes priority.
  // Default is now 50%.
  const basicPercent = basicComp?.value ?? 50;

  const basicAmount = Number(
    ((grossSalary * basicPercent) / 100).toFixed(2)
  );

  // ---------------------------------------------------------
  // LOP BASE COMPONENTS
  //
  // Existing approach preserved:
  // Gross Salary - eligible PF - eligible ESI - eligible PT
  // ---------------------------------------------------------

  const pfComponent = deductionsComponents.find(
    (component) => component.code === "PF"
  );

  const esiComponent = deductionsComponents.find(
    (component) => component.code === "ESI"
  );

  const ptComponent = deductionsComponents.find(
    (component) => component.code === "PT"
  );

  // Employee PF
  const pfAmount =
    pfComponent && pfEligible
      ? Number(
          ((basicAmount * (pfComponent.value ?? 12)) / 100).toFixed(2)
        )
      : 0;

  // Employee ESI
  const esiAmount =
    esiComponent && grossSalary <= 21000 && esiEligible
      ? Number(((grossSalary * esiComponent.value) / 100).toFixed(2))
      : 0;

  // Professional Tax
  const ptAmount =
    ptComponent && ptEligible ? Number(ptComponent.value || 0) : 0;

  // ---------------------------------------------------------
  // LOP BASE
  // ---------------------------------------------------------

  const lopBaseComponents = deductionsComponents.filter(
    (component) =>
      component.affects_lop &&
      ["PF", "ESI", "PT"].includes(component.code)
  );

  const lopAdjustment = lopBaseComponents.reduce((total, component) => {
    if (component.code === "PF") {
      return total + pfAmount;
    }

    if (component.code === "ESI") {
      return total + esiAmount;
    }

    if (component.code === "PT") {
      return total + ptAmount;
    }

    return total;
  }, 0);

  const employeeGross = Math.max(
    0,
    Number((grossSalary - employerPfAmount).toFixed(2))
  );

  const lopBase = Math.max(
    0,
    Number((employeeGross - lopAdjustment).toFixed(2))
  );

  // ---------------------------------------------------------
  // LOP PER DAY
  // ---------------------------------------------------------

  const perDayRate = Number((lopBase / workingDays).toFixed(2));

  // ---------------------------------------------------------
  // LOP DEDUCTION
  // ---------------------------------------------------------

  const lopDeduction = lopDays >= totalDaysInMonth ? Number(lopBase.toFixed(2)) : Number((lopDays * perDayRate).toFixed(2));

  // ---------------------------------------------------------
  // ADJUSTED GROSS
  // ---------------------------------------------------------

  const adjustedGross = Math.max(
    0,
    Number((employeeGross - lopDeduction).toFixed(2))
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
      // Calculated after all other earnings.
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
    } else if (
      component.calculation_type === "percentage_of_ctc"
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
  //
  // Monthly CTC
  // - Basic
  // - HRA
  // - Conveyance
  // - Medical
  // - LTA
  // - Employer PF
  // = Special Allowance
  //
  // Employer PF is an employer-side contribution and is
  // excluded from employee earnings.
  // ---------------------------------------------------------

  const specialComp = earningsComponents.find(
    (component) => component.code === "SPECIAL_ALLOWANCE"
  );

  if (specialComp?.is_active === true) {
    const specialAllowance = Math.max(
      0,
      Number(
        (grossSalary - employerPfAmount - accountedEarnings).toFixed(2)
      )
    );

    if (specialAllowance > 0) {
      earningsBreakdown.push({
        component_id: specialComp.id,
        name: specialComp.name,
        code: "SPECIAL_ALLOWANCE",
        type: "earning",
        amount: specialAllowance,
      });

      accountedEarnings += specialAllowance;
    }
  }

  const totalEarnings = Number(accountedEarnings.toFixed(2));

  const totalSalaryCost = Number((totalEarnings + employerPfAmount).toFixed(2));

  if (totalSalaryCost > grossSalary + 0.01) throw new Error(`Salary components exceed monthly CTC by ₹${(totalSalaryCost - grossSalary).toFixed(2)}`)

  // ---------------------------------------------------------
  // EMPLOYEE DEDUCTIONS
  // ---------------------------------------------------------

  const deductionsBreakdown: PayslipBreakupItem[] = [];

  let totalDeductions = 0;

  // ---------------------------------------------------------
  // LOP
  // ---------------------------------------------------------

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

  // ---------------------------------------------------------
  // OTHER DEDUCTIONS FIRST
  // PT, TDS and other configured deductions.
  // ---------------------------------------------------------

  let otherDeductions = 0;

  for (const component of deductionsComponents) {
    if (component.code === "PF" || component.code === "ESI") {
      continue;
    }

    let amount = 0;

    if (component.code === "PT") {
      if (ptEligible && adjustedGross > 0) {
        amount = Number(component.value || 0);
      }
    } else if (component.code === "TDS") {
      if (tdsEligible && adjustedGross > 0) {
        if (component.calculation_type === "percentage_of_basic") {
          amount = Number(
            ((basicAmount * component.value) / 100).toFixed(2)
          );
        } else if (
          component.calculation_type === "percentage_of_gross"
        ) {
          amount = Number(
            ((grossSalary * component.value) / 100).toFixed(2)
          );
        } else if (
          component.calculation_type === "percentage_of_ctc"
        ) {
          amount = Number(
            ((grossSalary * component.value) / 100).toFixed(2)
          );
        } else {
          amount = Number(component.value || 0);
        }
      }
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
    } else if (
      component.calculation_type === "percentage_of_ctc"
    ) {
      amount = Number(
        ((grossSalary * component.value) / 100).toFixed(2)
      );
    } else {
      amount = Number(component.value || 0);
    }

    amount = Math.max(0, amount);

    if (amount > 0) {
      deductionsBreakdown.push({
        component_id: component.id,
        name: component.name,
        code: component.code,
        type: "deduction",
        amount,
      });

      otherDeductions += amount;
    }
  }

  // ---------------------------------------------------------
  // AVAILABLE SALARY FOR PF AND ESI
  // ---------------------------------------------------------

  const availableForStatutory = Math.max(
    0,
    Number((adjustedGross - otherDeductions).toFixed(2))
  );

  // ---------------------------------------------------------
  // PF FIRST PRIORITY
  // ---------------------------------------------------------

  const pfEligibleAmount = pfEligible ? pfAmount : 0;

  const pfDeductedAmount = Number(
    Math.min(pfEligibleAmount, availableForStatutory).toFixed(2)
  );

  const pfPendingAmount = Number(
    Math.max(0, pfEligibleAmount - pfDeductedAmount).toFixed(2)
  );

  // ---------------------------------------------------------
  // ESI SECOND PRIORITY
  // ---------------------------------------------------------

  const remainingAfterPf = Math.max(
    0,
    Number((availableForStatutory - pfDeductedAmount).toFixed(2))
  );

  const esiEligibleAmount = esiEligible ? esiAmount : 0;

  const esiDeductedAmount = Number(
    Math.min(esiEligibleAmount, remainingAfterPf).toFixed(2)
  );

  const esiPendingAmount = Number(
    Math.max(0, esiEligibleAmount - esiDeductedAmount).toFixed(2)
  );

  // ---------------------------------------------------------
  // ADD ACTUAL PF DEDUCTION
  // ---------------------------------------------------------

  if (pfDeductedAmount > 0 && pfComponent) {
    deductionsBreakdown.push({
      component_id: pfComponent.id,
      name: pfComponent.name,
      code: "PF",
      type: "deduction",
      amount: pfDeductedAmount,
    });
  }

  // ---------------------------------------------------------
  // ADD ACTUAL ESI DEDUCTION
  // ---------------------------------------------------------

  if (esiDeductedAmount > 0 && esiComponent) {
    deductionsBreakdown.push({
      component_id: esiComponent.id,
      name: esiComponent.name,
      code: "ESI",
      type: "deduction",
      amount: esiDeductedAmount,
    });
  }

  // ---------------------------------------------------------
  // TOTAL DEDUCTIONS
  // ---------------------------------------------------------

  totalDeductions = Number(
    (
      lopDeduction +
      otherDeductions +
      pfDeductedAmount +
      esiDeductedAmount
    ).toFixed(2)
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

    pfEligibleAmount,
    pfDeductedAmount,
    pfPendingAmount,

    esiEligibleAmount,
    esiDeductedAmount,
    esiPendingAmount,
  };
}

// ---------------------------------------------------------
// GRATUITY
// ---------------------------------------------------------

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

  // 6 months or more = next year.
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
 * Converts numbers into Indian Currency Words.
 */
export function numberToWordsIndian(amount: number): string {
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];

  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const num = Math.floor(amount);

  if (num === 0) {
    return "Zero Rupees Only";
  }

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
