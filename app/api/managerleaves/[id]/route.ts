
import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function isValidUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

async function getLeaveId(
  request: Request,
  params: Promise<{
    id: string;
  }>
): Promise<string | undefined> {
  const routeParams = await params;

  let id = routeParams?.id;

  if (!id) {
    const segments = new URL(request.url).pathname.split("/");
    const managerIndex = segments.indexOf("managerleaves");

    if (managerIndex !== -1) {
      const rawId = segments[managerIndex + 1];

      if (rawId) {
        try {
          id = decodeURIComponent(rawId);
        } catch {
          id = rawId;
        }
      }
    }
  }

  return id;
}

export async function PATCH(
  request: Request,
  { params }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =========================================
    // 1. AUTHENTICATE USER
    // =========================================

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please log in again.",
        },
        { status: 401 }
      );
    }

    if (!isValidUUID(user.id)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid logged-in user ID.",
        },
        { status: 400 }
      );
    }

    // =========================================
    // 2. GET AND VALIDATE LEAVE REQUEST ID
    // =========================================

    const id = await getLeaveId(request, params);

    console.log("========== MANAGER API DEBUG ==========");
    console.log("Request URL:", request.url);
    console.log("Resolved Leave ID:", id);
    console.log("Logged-in User ID:", user.id);
    console.log("========================================");

    if (!isValidUUID(id)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid leave request ID: ${String(id)}. Check the managerleaves route parameter.`,
        },
        { status: 400 }
      );
    }

    // =========================================
    // 3. READ REQUEST BODY
    // =========================================

    let body: {
      status?: string;
      rejectionReason?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const status = String(body.status || "");

    const rejectionReason = String(
      body.rejectionReason || ""
    ).trim();

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Status must be approved or rejected.",
        },
        { status: 400 }
      );
    }

    if (status === "rejected" && !rejectionReason) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a rejection reason.",
        },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    // =========================================
    // 4. FIND LOGGED-IN REPORTING MANAGER
    // =========================================

    const { data: manager, error: managerError } =
      await admin
        .from("employees")
        .select("id, user_id, is_reporting_manager")
        .eq("user_id", user.id)
        .maybeSingle();

    if (managerError) {
      throw new Error(
        `Manager lookup failed: ${managerError.message}`
      );
    }

    if (!manager || manager.is_reporting_manager !== true) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized as a reporting manager.",
        },
        { status: 403 }
      );
    }

    if (!isValidUUID(manager.id)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid reporting manager employee ID.",
        },
        { status: 400 }
      );
    }

    // =========================================
    // 5. FIND LEAVE REQUEST
    // =========================================

    const { data: leaveRequest, error: leaveError } =
      await admin
        .from("leave_requests")
        .select(
          "id, employee_id, leave_type_id, start_date, end_date, status"
        )
        .eq("id", id)
        .maybeSingle();

    if (leaveError) {
      throw new Error(
        `Leave request lookup failed: ${leaveError.message}`
      );
    }

    if (!leaveRequest) {
      return NextResponse.json(
        {
          success: false,
          error: "Leave request not found.",
        },
        { status: 404 }
      );
    }

    // =========================================
    // 6. VALIDATE EMPLOYEE ID
    // =========================================

    console.log("DEBUG UUID VALUES:", {
      leaveRequestId: id,
      employeeId: leaveRequest.employee_id,
      managerId: manager.id,
    });

    if (!isValidUUID(leaveRequest.employee_id)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid employee ID in this leave request. Check leave_requests.employee_id.",
        },
        { status: 400 }
      );
    }

    // =========================================
    // 7. FIND EMPLOYEE
    // =========================================

    const { data: employee, error: employeeError } =
      await admin
        .from("employees")
        .select(
          "id, user_id, first_name, last_name, reporting_manager_id"
        )
        .eq("id", leaveRequest.employee_id)
        .maybeSingle();

    if (employeeError) {
      throw new Error(
        `Employee lookup failed: ${employeeError.message}`
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error: "Employee record not found.",
        },
        { status: 404 }
      );
    }

    // =========================================
    // 8. VERIFY REPORTING MANAGER
    // =========================================

    if (employee.reporting_manager_id !== manager.id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You cannot review this employee's leave request.",
        },
        { status: 403 }
      );
    }

    // =========================================
    // 9. CHECK CURRENT LEAVE STATUS
    // =========================================

    if (leaveRequest.status !== "pending_manager") {
      return NextResponse.json(
        {
          success: false,
          error:
            `This request is not waiting for manager review. ` +
            `Current status: ${leaveRequest.status}`,
        },
        { status: 409 }
      );
    }

    // =========================================
    // 10. UPDATE LEAVE REQUEST
    // =========================================

    // Manager approval moves the request to HR.
    // HR API expects status "pending".
    const nextStatus =
      status === "approved" ? "pending" : "rejected";

    const { data: updatedRequest, error: updateError } =
      await admin
        .from("leave_requests")
        .update({
          status: nextStatus,
          manager_reviewed_by: user.id,
          manager_reviewed_at: new Date().toISOString(),
          manager_rejection_reason:
            status === "rejected"
              ? rejectionReason
              : null,
        })
        .eq("id", id)
        .eq("status", "pending_manager")
        .select("id, status")
        .maybeSingle();

    if (updateError) {
      throw new Error(
        `Leave update failed: ${updateError.message}`
      );
    }

    if (!updatedRequest) {
      return NextResponse.json(
        {
          success: false,
          error: "This leave request was already reviewed.",
        },
        { status: 409 }
      );
    }

    // =========================================
    // 11. CREATE NOTIFICATIONS
    // =========================================

    try {
      const employeeName =
        `${employee.first_name || ""} ${employee.last_name || ""}`.trim();

      const dateRange =
        `${leaveRequest.start_date} to ${leaveRequest.end_date}`;

      const notificationRows: {
        recipient_user_id: string;
        title: string;
        message: string;
        type: string;
        is_read: boolean;
      }[] = [];

      // MANAGER APPROVED: NOTIFY HR ONLY

      if (status === "approved") {
        const { data: hrProfiles, error: hrError } =
          await admin
            .from("profiles")
            .select("id")
            .eq("role", "hr");

        if (hrError) {
          throw new Error(
            `Could not find HR users: ${hrError.message}`
          );
        }

        for (const profile of hrProfiles || []) {
          if (!isValidUUID(profile.id)) {
            console.error(
              "Skipping HR notification: invalid profile ID",
              profile.id
            );
            continue;
          }

          notificationRows.push({
            recipient_user_id: profile.id,
            title: "Leave Request - HR Approval",
            message:
              `${employeeName} has received reporting manager approval ` +
              `for leave from ${dateRange}. Please review the request.`,
            type: "leave",
            is_read: false,
          });
        }
      }

      // MANAGER REJECTED: NOTIFY EMPLOYEE

      if (status === "rejected") {
        if (isValidUUID(employee.user_id)) {
          notificationRows.push({
            recipient_user_id: employee.user_id,
            title: "Leave Request Rejected by Manager",
            message:
              `Your leave request (${dateRange}) was rejected by your ` +
              `reporting manager. Reason: ${rejectionReason}`,
            type: "leave",
            is_read: false,
          });
        }
      }

      // INSERT NOTIFICATIONS

      if (notificationRows.length > 0) {
        const { error: notificationError } = await admin
          .from("notifications")
          .insert(notificationRows);

        if (notificationError) {
          throw new Error(notificationError.message);
        }

        console.log(
          `Created ${notificationRows.length} leave notification(s).`
        );
      }
    } catch (notificationError) {
      console.error(
        "Manager leave notification error:",
        notificationError
      );
    }

    // =========================================
    // 12. SUCCESS RESPONSE
    // =========================================

    return NextResponse.json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved by manager and sent to HR for final approval."
          : "Leave request rejected successfully.",
      leaveRequest: updatedRequest,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    console.error(
      "Manager leave review API error:",
      message
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
