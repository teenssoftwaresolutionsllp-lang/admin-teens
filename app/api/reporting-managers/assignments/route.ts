import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the logged-in user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const admin = await createAdminClient();

    // 2. Read the authoritative application role.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Unable to verify permissions." },
        { status: 403 }
      );
    }

    const role = String(profile.role || "").toLowerCase();
    const isAdmin = ["hr", "ceo"].includes(role);

    if (!isAdmin && role !== "employee") {
      return NextResponse.json(
        { success: false, error: "You are not authorized." },
        { status: 403 }
      );
    }

    // 3. Read the assignment request.
    const body = await request.json();

    const employeeId =
      typeof body.employeeId === "string"
        ? body.employeeId.trim()
        : "";

    const requestedManagerId =
      typeof body.managerEmployeeId === "string"
        ? body.managerEmployeeId.trim()
        : "";

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "Employee ID is required." },
        { status: 400 }
      );
    }

    // 4. Identify the manager.
    let managerId = requestedManagerId;

    if (!isAdmin) {
      // Managers cannot choose another manager's identity.
      if (requestedManagerId) {
        return NextResponse.json(
          {
            success: false,
            error: "You cannot assign employees on behalf of another manager.",
          },
          { status: 403 }
        );
      }

      const { data: currentManager, error: managerError } = await admin
        .from("employees")
        .select("id, project_id, is_reporting_manager")
        .eq("user_id", user.id)
        .maybeSingle();

      if (managerError || !currentManager) {
        return NextResponse.json(
          { success: false, error: "Employee record not found." },
          { status: 404 }
        );
      }

      if (currentManager.is_reporting_manager !== true) {
        return NextResponse.json(
          {
            success: false,
            error: "You are not authorized as a Reporting Manager.",
          },
          { status: 403 }
        );
      }

      managerId = currentManager.id;
    }

    if (!managerId) {
      return NextResponse.json(
        { success: false, error: "Reporting Manager is required." },
        { status: 400 }
      );
    }

    // 5. Verify the selected manager.
    const { data: manager, error: selectedManagerError } = await admin
      .from("employees")
      .select("id, user_id, project_id, is_reporting_manager")
      .eq("id", managerId)
      .maybeSingle();

    if (selectedManagerError || !manager) {
      return NextResponse.json(
        { success: false, error: "Reporting Manager not found." },
        { status: 404 }
      );
    }

    if (
      manager.is_reporting_manager !== true ||
      !manager.user_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected employee is not an active Reporting Manager account.",
        },
        { status: 400 }
      );
    }

    // 6. Prevent assigning a manager to themselves.
    if (manager.id === employeeId) {
      return NextResponse.json(
        {
          success: false,
          error: "An employee cannot be their own Reporting Manager.",
        },
        { status: 400 }
      );
    }

    // 7. Fetch the employee being assigned.
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, employee_id, first_name, last_name, project_id, reporting_manager_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError || !employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found." },
        { status: 404 }
      );
    }

    // 8. HR/CEO can assign across projects.
    // Managers can only add unassigned employees.
    if (!isAdmin) {
      if (employee.reporting_manager_id) {
        return NextResponse.json(
          {
            success: false,
            error: "This employee is already assigned to a Reporting Manager. A transfer request must be approved by HR/CEO.",
          },
          { status: 409 }
        );
      }

      // Bench employees (project_id = null) can be added
      // by managers from any project.
      const isBenchEmployee = employee.project_id === null;

      const isSameProject =
        employee.project_id !== null &&
        employee.project_id === manager.project_id;

      if (!isBenchEmployee && !isSameProject) {
        return NextResponse.json(
          {
            success: false,
            error: "You can only add employees from your own project or unassigned bench employees.",
          },
          { status: 403 }
        );
      }
    }

    // Avoid unnecessary updates.
    if (employee.reporting_manager_id === manager.id) {
      return NextResponse.json({
        success: true,
        message: "Employee is already assigned to this Reporting Manager.",
        employeeId: employee.id,
        managerEmployeeId: manager.id,
      });
    }

    // 9. Save the assignment.
    let updateQuery = admin
      .from("employees")
      .update({ reporting_manager_id: manager.id })
      .eq("id", employee.id);

    // Conditional update prevents a manager from taking
    // an employee assigned concurrently to someone else.
    if (!isAdmin) {
      updateQuery = updateQuery.is("reporting_manager_id", null);
    }

    const { data: updatedEmployee, error: updateError } =
      await updateQuery
        .select("id, employee_id, first_name, last_name, reporting_manager_id")
        .maybeSingle();

    if (updateError) {
      console.error("Reporting Manager assignment error:", updateError);

      return NextResponse.json(
        { success: false, error: "Failed to assign Reporting Manager." },
        { status: 500 }
      );
    }

    if (!updatedEmployee) {
      return NextResponse.json(
        {
          success: false,
          error: "The employee assignment changed. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Reporting Manager assigned successfully.",
      employee: updatedEmployee,
      managerEmployeeId: manager.id,
    });
  } catch (error: unknown) {
    console.error("Reporting Manager assignment API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
