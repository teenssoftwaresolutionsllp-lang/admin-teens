import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';

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
    // PREVENT FUTURE PAYROLL
    // =========================================================

    const now = new Date();

    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const requestedPeriod = payrollYear * 12 + payrollMonth;
    const currentPeriod = currentYear * 12 + currentMonth;

    if (requestedPeriod >= currentPeriod) {
      return NextResponse.json(
        {
          error: " can only be generated after the payroll month is completed",
        },
        { status: 400 }
      );
    }


    // =========================================================
    // GET EMPLOYEE
    // =========================================================

    const employee = await DataStore.getEmployeeById(employeeId);

    if (!employee) {
      return NextResponse.json(
        {
          error: "Employee not found.",
        },
        { status: 404 }
      );
    }

    // =========================================================
    // PREVENT PAYROLL BEFORE JOINING MONTH
    //
    // Example:
    // Joining Date: October 1, 2026
    //
    // September 2026 -> BLOCKED
    // October 2026   -> ALLOWED
    // November 2026  -> Future / BLOCKED
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

    const [joiningYear, joiningMonth] = joiningDateString
      .split("-")
      .map(Number);

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


    // Insentive nad bonus validation
    const allowedAdditionalEarningTypes = ["Incentive","Bonus","Compensation",] as const;

    const requestedAdditionalEarnings = Array.isArray(additionalEarnings)? additionalEarnings: [];

    for (const earning of requestedAdditionalEarnings) {
      if (!allowedAdditionalEarningTypes.includes(earning.type)) {
        return NextResponse.json(
          {
            error: `Invalid additional earning type: ${earning.type}`,
          },
          { status: 400 }
        );
      }

      const amount = Number(earning.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          {
            error: `Invalid amount for ${earning.type}.`,
          },
          { status: 400 }
        );
      }
    }


    const requestedTypes = requestedAdditionalEarnings.map((earning: 
      {
        type: "Incentive" | "Bonus" | "Compensation";
        amount: number;
      }) => earning.type
    );

    if (new Set(requestedTypes).size !== requestedTypes.length) {
      return NextResponse.json(
        {
          error: "The same additional earning cannot be added more than once.",
        },
        { status: 400 }
      );
    }


    // =========================================================
    // PREVENT DUPLICATE ADDITIONAL EARNINGS
    // =========================================================

    const { data: existingPayslip, error: existingPayslipError } =
      await supabase
        .from("payslips")
        .select("incentive, bonus, compensation")
        .eq("employee_id", employee.id)
        .eq("payroll_month", payrollMonth)
        .eq("payroll_year", payrollYear)
        .maybeSingle();

    if (existingPayslipError) {
      console.error(
        "Failed to check existing payslip:",
        existingPayslipError
      );

      return NextResponse.json(
        {
          error: "Failed to check existing payroll.",
        },
        { status: 500 }
      );
    }

    const duplicateAdditionalEarning =
      requestedAdditionalEarnings.find((earning: {
        type: "Incentive" | "Bonus" | "Compensation";
        amount: number;
      }) => {
        if (earning.type === "Incentive") {
          return Number(existingPayslip?.incentive || 0) > 0;
        }

        if (earning.type === "Bonus") {
          return Number(existingPayslip?.bonus || 0) > 0;
        }

        if (earning.type === "Compensation") {
          return Number(existingPayslip?.compensation || 0) > 0;
        }

        return false;
      });

    if (duplicateAdditionalEarning) {
      return NextResponse.json(
        {
          error: `${duplicateAdditionalEarning.type} has already been added for ${monthNames[payrollMonth - 1]} ${payrollYear}.`,
        },
        { status: 400 }
      );
    }

    // =========================================================
    // GENERATE PAYROLL
    // =========================================================

    const result = await DataStore.generateMonthlyPayroll({
      employeeId,
      month: payrollMonth,
      year: payrollYear,
      additionalEarnings:requestedAdditionalEarnings,
    });

    return NextResponse.json({
      success: true,
      generatedCount: result.generatedCount,
      payslips: result.payslips,
    });

  } catch (error: any) {
    console.error("Payroll generation error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to generate payroll",
      },
      { status: 500 }
    );
  }
}