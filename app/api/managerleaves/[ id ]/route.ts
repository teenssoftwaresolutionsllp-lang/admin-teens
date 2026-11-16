
import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate manager
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

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

    // Find the logged-in manager's employee record.
    const { data: manager, error: managerError } = await admin
      .from("employees")
      .select("id, user_id, is_reporting_manager")
      .eq("user_id", user.id)
      .maybeSingle();

    if (managerError) {
      throw new Error(managerError.message);
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

    // Find the leave request.
    const { data: leaveRequest, error: leaveError } = await admin
      .from("leave_requests")
      .select("id, employee_id, start_date, end_date, status")
      .eq("id", id)
      .maybeSingle();

    if (leaveError) {
      throw new Error(leaveError.message);
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

    // Confirm that this employee reports to this manager.
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, first_name, last_name, reporting_manager_id")
      .eq("id", leaveRequest.employee_id)
      .maybeSingle();

    if (employeeError) {
      throw new Error(employeeError.message);
    }

    if (
      !employee ||
      employee.reporting_manager_id !== manager.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot review this employee's leave request.",
        },
        { status: 403 }
      );
    }

    if (leaveRequest.status !== "pending_manager") {
      return NextResponse.json(
        {
          success: false,
          error: `This request is not waiting for manager review. Current status: ${leaveRequest.status}`,
        },
        { status: 409 }
      );
    }

    // Manager approval sends the request to HR.
    // HR's existing API accepts status "pending".
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
            status === "rejected" ? rejectionReason : null,
        })
        .eq("id", id)
        .eq("status", "pending_manager")
        .select("id, status")
        .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
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

    // Send notifications. Notification failure must not undo review.
    try {
      const employeeName =
        `${employee.first_name || ""} ${employee.last_name || ""}`.trim();

      const dateRange =
        `${leaveRequest.start_date} to ${leaveRequest.end_date}`;

      if (status === "approved") {
        // Notify employee that manager approved the request.
        await admin.from("notifications").insert({
          recipient_user_id: (
            await admin
              .from("employees")
              .select("user_id")
              .eq("id", employee.id)
              .maybeSingle()
          ).data?.user_id,
          title: "Leave Approved by Manager",
          message: `Your leave request (${dateRange}) was approved by your reporting manager and sent to HR for final approval.`,
          type: "leave",
          is_read: false,
        });

        // Notify HR that the request is ready for final review.
        const { data: hrProfiles, error: hrError } = await admin
          .from("profiles")
          .select("id")
          .eq("role", "hr");

        if (hrError) {
          throw new Error(hrError.message);
        }

        const hrNotifications = (hrProfiles || []).map(
          (profile) => ({
            recipient_user_id: profile.id,
            title: "Leave Request - HR Approval",
            message: `${employeeName} has received manager approval for leave from ${dateRange}. Please review the request.`,
            type: "leave",
            is_read: false,
          })
        );

        if (hrNotifications.length > 0) {
          const { error } = await admin
            .from("notifications")
            .insert(hrNotifications);

          if (error) throw new Error(error.message);
        }
      } else {
        // Notify employee when manager rejects the request.
        const { data: employeeUser } = await admin
          .from("employees")
          .select("user_id")
          .eq("id", employee.id)
          .maybeSingle();

        if (employeeUser?.user_id) {
          const { error } = await admin
            .from("notifications")
            .insert({
              recipient_user_id: employeeUser.user_id,
              title: "Leave Request Rejected by Manager",
              message: `Your leave request (${dateRange}) was rejected by your reporting manager. Reason: ${rejectionReason}`,
              type: "leave",
              is_read: false,
            });

          if (error) throw new Error(error.message);
        }
      }
    } catch (notificationError) {
      console.error(
        "Manager leave notification error:",
        notificationError
      );
    }

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

    console.error("Manager leave review API error:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}