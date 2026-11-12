import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the requester.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    // 2. Verify the actual database role.
    const adminClient = await createAdminClient();

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 403 }
      );
    }

    const role = String(profile.role || "").toLowerCase();

    if (!["hr", "ceo"].includes(role)) {
      return NextResponse.json(
        { error: "Only HR or CEO can provision reporting managers." },
        { status: 403 }
      );
    }

    // 3. Validate request.
    const body = await request.json();
    const { employeeId, isReportingManager } = body;

    if (
      typeof employeeId !== "string" ||
      !employeeId.trim() ||
      typeof isReportingManager !== "boolean"
    ) {
      return NextResponse.json(
        { error: "A valid employee ID and manager permission are required." },
        { status: 400 }
      );
    }

    // 4. Verify the employee exists.
    const { data: employee, error: employeeError } = await adminClient
      .from("employees")
      .select("id, is_reporting_manager")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    // 5. Do not revoke access while direct reports are assigned.
    if (!isReportingManager && employee.is_reporting_manager === true) {
      const { count, error: reportsError } = await adminClient
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("reporting_manager_id", employee.id);

      if (reportsError) {
        return NextResponse.json(
          { error: "Unable to verify the employee's direct reports." },
          { status: 500 }
        );
      }

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              "This employee still has direct reports. Reassign or remove those reporting relationships before revoking manager access.",
          },
          { status: 409 }
        );
      }
    }

    // 6. Update only the manager permission.
    const { error: updateError } = await adminClient
      .from("employees")
      .update({ is_reporting_manager: isReportingManager })
      .eq("id", employee.id);

    if (updateError) {
      console.error("Reporting manager permission update failed:", updateError);

      return NextResponse.json(
        { error: "Failed to update reporting manager permission." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      employeeId: employee.id,
      isReportingManager,
      message: isReportingManager
        ? "Employee provisioned as a Reporting Manager."
        : "Reporting Manager access revoked.",
    });
  } catch (error) {
    console.error("Reporting manager permission API error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
