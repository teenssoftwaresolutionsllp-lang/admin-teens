import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { calculateGratuity } from "@/lib/calculations";

export async function GET(request: NextRequest,{ params }: { params: Promise<{ id: string }> }) 
{
  try {
    const { id: employeeId } = await params;
    const supabase = await createAdminClient();

    // =========================================================
    // GET EMPLOYEE
    // =========================================================

    const {
      data: employee,
      error: employeeError,
    } = await supabase
      .from("employees")
      .select(`
        id,
        joining_date,
        salary,
        status,
        exit_date
      `)
      .eq("id", employeeId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // =========================================================
    // GET EMPLOYEE SALARY COMPONENTS
    // =========================================================

    const {
      data: salaryComponents,
      error: salaryComponentError,
    } = await supabase
      .from("employee_salary_components")
      .select(`
        id,
        salary_component_id,
        value,
        gratuity_5_year_taken,
        gratuity_5_year_taken_date,
        gratuity_5_year_amount,
        gratuity_10_year_taken,
        gratuity_10_year_taken_date,
        gratuity_10_year_amount
      `)
      .eq("employee_id", employeeId)
      .eq("is_active", true);

    if (salaryComponentError) {
      throw new Error(
        `Failed to load employee salary components: ${salaryComponentError.message}`
      );
    }

    if (!salaryComponents || salaryComponents.length === 0) {
      return NextResponse.json(
        {
          error: "Employee salary components not found",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // GET MASTER SALARY COMPONENTS
    // =========================================================

    const salaryComponentIds = salaryComponents.map(
      (component) => component.salary_component_id
    );

    const {
      data: masterComponents,
      error: masterError,
    } = await supabase
      .from("salary_components")
      .select("id, code")
      .in("id", salaryComponentIds);

    if (masterError) {
      throw new Error(`Failed to load salary components: ${masterError.message}`);
    }

    // =========================================================
    // FIND BASIC MASTER COMPONENT
    // =========================================================

    const basicMaster = masterComponents?.find(
      (component) => component.code === "BASIC"
    );

    if (!basicMaster) {
      return NextResponse.json(
        {
          error: "BASIC salary component is not configured",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // FIND EMPLOYEE BASIC COMPONENT
    // =========================================================

    const basicComponent = salaryComponents.find(
      (component) =>
        component.salary_component_id === basicMaster.id
    );

    if (!basicComponent) {
      return NextResponse.json(
        {
          error: "Employee BASIC salary component not found",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // CALCULATE MONTHLY GROSS
    // Employee salary is Annual CTC in lakhs
    // =========================================================

    const annualCtcLakh = Number(employee.salary || 0);

    const annualCtc = annualCtcLakh * 100000;

    const monthlyGross = Number((annualCtc / 12).toFixed(2));

    // =========================================================
    // CALCULATE MONTHLY BASIC
    // =========================================================

    const basicPercent = Number(basicComponent.value || 47);

    const monthlyBasic = Number(((monthlyGross * basicPercent) / 100).toFixed(2));

    // =========================================================
    // DETERMINE GRATUITY CALCULATION DATE
    //
    // Active employee:
    //   Use today's date.
    //
    // Resigned employee:
    //   Use exit_date if available.
    // =========================================================

    const employeeStatus = employee.status?.toLowerCase();

    const isResigned = employeeStatus === "resigned";

    const asOfDate = isResigned && employee.exit_date ? new Date(employee.exit_date) : new Date();

    // =========================================================
    // CALCULATE DYNAMIC GRATUITY
    //
    // Example:
    // 6 years 5 months  -> 6 years for calculation
    // 11 years 5 months -> 11 years
    // 11 years 6 months -> 12 years
    // 12 years 6 months -> 13 years
    //
    // Formula:
    // Monthly Basic × 15 × Gratuity Service Years / 26
    // =========================================================

    const gratuity = calculateGratuity(
      employee.joining_date,
      monthlyBasic,
      asOfDate
    );

    // =========================================================
    // RESPONSE
    // =========================================================

    return NextResponse.json({
      completedYears: gratuity.completedYears,

      completedMonths: gratuity.completedMonths,

      serviceYearsText: gratuity.serviceYearsText,

      gratuityServiceYears: gratuity.gratuityServiceYears,

      monthlyBasic,

      gratuityAmount: gratuity.gratuityAmount,

      // =======================================================
      // GRATUITY HISTORY
      // These fields are kept because they already exist
      // in employee_salary_components.
      // =======================================================

      gratuity5YearTaken: basicComponent.gratuity_5_year_taken,

      gratuity5YearTakenDate: basicComponent.gratuity_5_year_taken_date,

      gratuity5YearTakenAmount: basicComponent.gratuity_5_year_amount,

      gratuity10YearTaken: basicComponent.gratuity_10_year_taken,

      gratuity10YearTakenDate: basicComponent.gratuity_10_year_taken_date,

      gratuity10YearTakenAmount: basicComponent.gratuity_10_year_amount,

      // Useful information for UI/debugging
      isResigned,

      calculationDate: asOfDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error(
      "Get gratuity error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load gratuity",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// POST - TAKE CURRENT GRATUITY
//
// There is no longer a "5_year" or "10_year" type.
// The API always calculates the current gratuity automatically.
// =============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;

    const supabase = await createAdminClient();

    // =========================================================
    // GET EMPLOYEE
    // =========================================================

    const {
      data: employee,
      error: employeeError,
    } = await supabase
      .from("employees")
      .select(`
        id,
        joining_date,
        salary,
        status,
        exit_date
      `)
      .eq("id", employeeId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        {
          error: "Employee not found",
        },
        { status: 404 }
      );
    }

    // =========================================================
    // GET EMPLOYEE SALARY COMPONENTS
    // =========================================================

    const {
      data: salaryComponents,
      error: salaryComponentError,
    } = await supabase
      .from("employee_salary_components")
      .select(`
        id,
        salary_component_id,
        value,
        gratuity_5_year_taken,
        gratuity_5_year_taken_date,
        gratuity_5_year_amount,
        gratuity_10_year_taken,
        gratuity_10_year_taken_date,
        gratuity_10_year_amount
      `)
      .eq("employee_id", employeeId)
      .eq("is_active", true);

    if (salaryComponentError) {
      throw new Error(
        `Failed to load employee salary components: ${salaryComponentError.message}`
      );
    }

    if (!salaryComponents || salaryComponents.length === 0) {
      return NextResponse.json(
        {
          error:
            "Employee salary components not found",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // GET MASTER SALARY COMPONENTS
    // =========================================================

    const salaryComponentIds = salaryComponents.map(
      (component) => component.salary_component_id
    );

    const {
      data: masterComponents,
      error: masterError,
    } = await supabase
      .from("salary_components")
      .select("id, code")
      .in("id", salaryComponentIds);

    if (masterError) {
      throw new Error(
        `Failed to load salary components: ${masterError.message}`
      );
    }

    // =========================================================
    // FIND BASIC MASTER COMPONENT
    // =========================================================

    const basicMaster = masterComponents?.find(
      (component) => component.code === "BASIC"
    );

    if (!basicMaster) {
      return NextResponse.json(
        {
          error:
            "BASIC salary component is not configured",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // FIND EMPLOYEE BASIC COMPONENT
    // =========================================================

    const basicComponent = salaryComponents.find(
      (component) =>
        component.salary_component_id ===
        basicMaster.id
    );

    if (!basicComponent) {
      return NextResponse.json(
        {
          error:
            "Employee BASIC salary component not found",
        },
        { status: 400 }
      );
    }

    // =========================================================
    // CALCULATE MONTHLY GROSS
    // Employee salary is Annual CTC in lakhs
    // =========================================================

    const annualCtcLakh =
      Number(employee.salary || 0);

    const annualCtc =
      annualCtcLakh * 100000;

    const monthlyGross = Number(
      (annualCtc / 12).toFixed(2)
    );

    // =========================================================
    // CALCULATE MONTHLY BASIC
    // =========================================================

    const basicPercent = Number(
      basicComponent.value || 47
    );

    const monthlyBasic = Number(
      (
        (monthlyGross * basicPercent) /
        100
      ).toFixed(2)
    );

    // =========================================================
    // DETERMINE GRATUITY CALCULATION DATE
    // =========================================================

    const employeeStatus =
      employee.status?.toLowerCase();

    const isResigned =
      employeeStatus === "resigned";

    const asOfDate =
      isResigned && employee.exit_date
        ? new Date(employee.exit_date)
        : new Date();

    // =========================================================
    // CALCULATE CURRENT GRATUITY
    // =========================================================

    const gratuity = calculateGratuity(
      employee.joining_date,
      monthlyBasic,
      asOfDate
    );

    // =========================================================
    // CHECK MINIMUM ELIGIBILITY
    // =========================================================

    if (gratuity.gratuityServiceYears < 5) {
      return NextResponse.json(
        {
          error:
            "Employee is not eligible for gratuity yet",

          completedYears:
            gratuity.completedYears,

          completedMonths:
            gratuity.completedMonths,

          serviceYearsText:
            gratuity.serviceYearsText,
        },
        { status: 400 }
      );
    }

    // =========================================================
    // PREVENT DUPLICATE GRATUITY PAYMENT
    //
    // We use the existing 5-year field as the historical
    // "gratuity already paid" flag.
    // =========================================================

    if (basicComponent.gratuity_5_year_taken) {
      return NextResponse.json(
        {
          error:
            "Gratuity has already been taken",

          takenDate:
            basicComponent.gratuity_5_year_taken_date,

          takenAmount:
            basicComponent.gratuity_5_year_amount,
        },
        { status: 400 }
      );
    }

    // =========================================================
    // GRATUITY AMOUNT
    // =========================================================

    const amount =
      gratuity.gratuityAmount;

    // =========================================================
    // CURRENT DATE
    // =========================================================

    const today = new Date()
      .toISOString()
      .split("T")[0];

    // =========================================================
    // SAVE GRATUITY PAYMENT
    //
    // We keep the existing database column for compatibility.
    // The amount itself is now dynamically calculated.
    // =========================================================

    const updateData = {
      gratuity_5_year_taken: true,

      gratuity_5_year_taken_date:
        today,

      gratuity_5_year_amount:
        amount,
    };

    // =========================================================
    // UPDATE EMPLOYEE SALARY COMPONENT
    // =========================================================

    const {
      data: updated,
      error: updateError,
    } = await supabase
      .from("employee_salary_components")
      .update(updateData)
      .eq("id", basicComponent.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    // =========================================================
    // SUCCESS RESPONSE
    // =========================================================

    return NextResponse.json({
      success: true,

      completedYears:
        gratuity.completedYears,

      completedMonths:
        gratuity.completedMonths,

      serviceYearsText:
        gratuity.serviceYearsText,

      gratuityServiceYears:
        gratuity.gratuityServiceYears,

      monthlyBasic,

      amount,

      calculationDate:
        asOfDate.toISOString().split("T")[0],

      data: updated,
    });
  } catch (error) {
    console.error(
      "Gratuity API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process gratuity",
      },
      { status: 500 }
    );
  }
}