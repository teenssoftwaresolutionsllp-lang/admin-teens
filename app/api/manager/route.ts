
import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

// --------------------------------------------------
// VERIFY REPORTING MANAGER
// --------------------------------------------------

async function getManager() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized. Please login again." },
        { status: 401 }
      ),
      manager: null,
      admin: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (String(profile?.role || "").toLowerCase() !== "employee") {
    return {
      error: NextResponse.json(
        { success: false, error: "You are not allowed to perform this action." },
        { status: 403 }
      ),
      manager: null,
      admin: null,
    };
  }

  const admin = await createAdminClient();

  const { data: manager, error: managerError } = await admin
    .from("employees")
    .select("id, first_name, last_name, is_reporting_manager")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    managerError ||
    !manager ||
    manager.is_reporting_manager !== true
  ) {
    return {
      error: NextResponse.json(
        { success: false, error: "Reporting manager access required." },
        { status: 403 }
      ),
      manager: null,
      admin: null,
    };
  }

  return {
    error: null,
    manager,
    admin,
  };
}

// --------------------------------------------------
// GET EMPLOYEES AND PROJECTS
// --------------------------------------------------

export async function GET() {
  try {
    const { error, manager, admin } = await getManager();

    if (error || !manager || !admin) {
      return error;
    }

    const { data: employees, error: employeeError } = await admin
      .from("employees")
      .select("id, employee_id, first_name, last_name, email")
      .is("reporting_manager_id", null)
      .neq("id", manager.id)
      .order("first_name", { ascending: true });

    if (employeeError) {
      throw employeeError;
    }

    const { data: projects, error: projectError } = await admin
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true });

    if (projectError) {
      throw projectError;
    }

    return NextResponse.json({
      success: true,
      employees: employees || [],
      projects: projects || [],
    });
  } catch (error) {
    console.error("Manager assignment GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load employees and projects.",
      },
      { status: 500 }
    );
  }
}

// --------------------------------------------------
// ASSIGN EMPLOYEE TO MANAGER AND PROJECT
// --------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { error, manager, admin } = await getManager();

    if (error || !manager || !admin) {
      return error;
    }

    const body = await request.json();

    const employeeId = body.employeeId;
    const projectId = body.projectId;

    if (
      typeof employeeId !== "string" ||
      !employeeId ||
      typeof projectId !== "string" ||
      !projectId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please select an employee and a project.",
        },
        { status: 400 }
      );
    }

    // Prevent assigning the manager to themselves.
    if (employeeId === manager.id) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot assign yourself as a team member.",
        },
        { status: 400 }
      );
    }

    // Check employee exists and is not already assigned.
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, reporting_manager_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError || !employee) {
      return NextResponse.json(
        {
          success: false,
          error: "Employee not found.",
        },
        { status: 404 }
      );
    }

    if (employee.reporting_manager_id) {
      return NextResponse.json(
        {
          success: false,
          error: "This employee is already assigned to a reporting manager.",
        },
        { status: 409 }
      );
    }

    // Check selected project exists.
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected project was not found.",
        },
        { status: 404 }
      );
    }

    // Assign manager and project.
    const { data: updatedEmployee, error: updateError } = await admin
      .from("employees")
      .update({
        reporting_manager_id: manager.id,
        project_id: projectId,
      })
      .eq("id", employeeId)
      .is("reporting_manager_id", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updatedEmployee) {
      return NextResponse.json(
        {
          success: false,
          error: "Employee assignment changed. Please refresh and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Employee assigned successfully.",
    });
  } catch (error) {
    console.error("Manager employee assignment POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to assign employee. Please try again.",
      },
      { status: 500 }
    );
  }
}
