import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// =============================================================
// HELPER - VERIFY HR ACCESS
// =============================================================

async function verifyHRAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "hr") {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Only HR can access employee salary components." },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

// =============================================================
// GET - EMPLOYEE-SPECIFIC SALARY COMPONENTS
// =============================================================

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { response } = await verifyHRAccess(supabase);

    if (response) {
      return response;
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required." },
        { status: 400 }
      );
    }

    // GET EMPLOYEE COMPONENTS

    const {
      data: employeeComponents,
      error: employeeComponentsError,
    } = await supabase
      .from("employee_salary_components")
      .select(`
        id,
        employee_id,
        salary_component_id,
        calculation_type,
        value,
        is_active,
        affects_lop,
        created_at
      `)
      .eq("employee_id", employeeId)
      .order("created_at", {
        ascending: true,
      });

    if (employeeComponentsError) {
      throw new Error(employeeComponentsError.message);
    }

    if (!employeeComponents?.length) {
      return NextResponse.json({
        components: [],
      });
    }

    // GET MASTER COMPONENT DETAILS

    const componentIds = employeeComponents.map(
      (component) => component.salary_component_id
    );

    const {
      data: masterComponents,
      error: masterComponentsError,
    } = await supabase
      .from("salary_components")
      .select(`
        id,
        name,
        code,
        type,
        calculation_type,
        value,
        affects_lop,
        is_statutory,
        description
      `)
      .in("id", componentIds);

    if (masterComponentsError) {
      throw new Error(masterComponentsError.message);
    }

    // MERGE EMPLOYEE + MASTER DATA

    const components = employeeComponents
      .map((employeeComponent) => {
        const masterComponent = masterComponents?.find(
          (component) =>
            component.id === employeeComponent.salary_component_id
        );

        if (!masterComponent) {
          return null;
        }

        // HIDE EMPLOYER PF AND GRATUITY

        if (
          masterComponent.code === "GRATUITY" ||
          masterComponent.code === "EMPLOYER_PF"
        ) {
          return null;
        }

        return {
          // Master component ID
          id: masterComponent.id,

          // Employee-specific component ID
          employee_component_id: employeeComponent.id,

          employee_id: employeeComponent.employee_id,

          name: masterComponent.name,
          code: masterComponent.code,
          type: masterComponent.type,

          // Employee-specific values
          calculation_type: employeeComponent.calculation_type,
          value: Number(employeeComponent.value ?? 0),
          is_active: employeeComponent.is_active,

          // Employee-specific LOP setting
          affects_lop: employeeComponent.affects_lop,

          // Master metadata
          is_statutory: Boolean(masterComponent.is_statutory),
          description: masterComponent.description || "",
        };
      })
      .filter(
        (
          component
        ): component is NonNullable<typeof component> =>
          component !== null
      );

    return NextResponse.json({
      components,
    });
  } catch (error: unknown) {
    console.error(
      "GET /api/payroll/employee-components:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load employee salary components.",
      },
      { status: 500 }
    );
  }
}

// =============================================================
// PATCH - UPDATE EMPLOYEE-SPECIFIC SALARY COMPONENT
// =============================================================

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const { response } = await verifyHRAccess(supabase);

    if (response) {
      return response;
    }

    const body = await request.json();

    const {
      id,
      calculation_type,
      value,
      is_active,
      affects_lop,
    } = body;

    // VALIDATE EMPLOYEE COMPONENT ID

    if (
      typeof id !== "string" ||
      !id.trim()
    ) {
      return NextResponse.json(
        {
          error: "Employee salary component ID is required.",
        },
        { status: 400 }
      );
    }

    // BUILD UPDATE OBJECT

    const updates: Record<string, unknown> = {};

    // CALCULATION TYPE

    if (calculation_type !== undefined) {
      const validCalculationTypes = [
        "fixed",
        "percentage_of_basic",
        "percentage_of_gross",
      ];

      if (
        typeof calculation_type !== "string" ||
        !validCalculationTypes.includes(calculation_type)
      ) {
        return NextResponse.json(
          { error: "Invalid calculation type." },
          { status: 400 }
        );
      }

      updates.calculation_type = calculation_type;
    }

    // LOP APPLICABLE

    if (affects_lop !== undefined) {
      if (typeof affects_lop !== "boolean") {
        return NextResponse.json(
          { error: "affects_lop must be a boolean." },
          { status: 400 }
        );
      }

      updates.affects_lop = affects_lop;
    }

    // VALUE

    if (value !== undefined) {
      const numericValue = Number(value);

      if (
        value === null ||
        value === "" ||
        !Number.isFinite(numericValue) ||
        numericValue < 0
      ) {
        return NextResponse.json(
          {
            error: "Value must be a valid non-negative number.",
          },
          { status: 400 }
        );
      }

      updates.value = numericValue;
    }

    // ACTIVE / DISABLED

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return NextResponse.json(
          { error: "is_active must be a boolean." },
          { status: 400 }
        );
      }

      updates.is_active = is_active;
    }

    // NOTHING TO UPDATE

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error: "No valid fields provided for update.",
        },
        { status: 400 }
      );
    }

    // UPDATE EMPLOYEE SALARY COMPONENT
    // The supplied ID must be employee_salary_components.id.

    const {
      data: updated,
      error,
    } = await supabase
      .from("employee_salary_components")
      .update(updates)
      .eq("id", id)
      .select(`
        id,
        employee_id,
        salary_component_id,
        calculation_type,
        value,
        is_active,
        affects_lop
      `)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!updated) {
      return NextResponse.json(
        {
          error: "Employee salary component not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      component: updated,
    });
  } catch (error: unknown) {
    console.error(
      "PATCH /api/payroll/employee-components:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update employee salary component.",
      },
      { status: 500 }
    );
  }
}
