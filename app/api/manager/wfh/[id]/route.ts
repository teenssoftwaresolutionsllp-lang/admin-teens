
import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";
import {
  getAuthFailureStatus,
  getAuthFailureMessage,
} from "@/lib/supabase-auth-error";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    // =========================================
    // 1. AUTHENTICATE MANAGER
    // =========================================

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const status = getAuthFailureStatus(authError);

      return NextResponse.json(
        { error: getAuthFailureMessage(status) },
        { status }
      );
    }

    const admin = await createAdminClient();

    // =========================================
    // 2. GET AND VALIDATE WFH REQUEST ID
    // =========================================

    const { id } = await params;

    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return NextResponse.json(
        { error: "Invalid WFH request ID." },
        { status: 400 }
      );
    }

    // =========================================
    // 3. READ MANAGER ACTION
    // =========================================

    let body: {
      status?: string;
      rejectionReason?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const newStatus = body.status?.trim().toLowerCase();

    if (!["approved", "rejected"].includes(newStatus ?? "")) {
      return NextResponse.json(
        { error: "Invalid WFH review status." },
        { status: 400 }
      );
    }

    const rejectionReason =
      typeof body.rejectionReason === "string"
        ? body.rejectionReason.trim()
        : "";

    if (newStatus === "rejected" && !rejectionReason) {
      return NextResponse.json(
        { error: "Please provide a rejection reason." },
        { status: 400 }
      );
    }

    if (rejectionReason.length > 1000) {
      return NextResponse.json(
        { error: "Rejection reason cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    // =========================================
    // 4. FIND MANAGER EMPLOYEE RECORD
    // =========================================

    const { data: manager, error: managerError } = await admin
      .from("employees")
      .select(
        "id, user_id, first_name, last_name, is_reporting_manager"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (managerError) {
      console.error("WFH manager lookup error:", managerError);

      return NextResponse.json(
        { error: "Unable to verify manager account." },
        { status: 500 }
      );
    }

    if (!manager) {
      return NextResponse.json(
        { error: "Manager employee record not found." },
        { status: 403 }
      );
    }

    if (manager.is_reporting_manager !== true) {
      return NextResponse.json(
        { error: "You are not authorized to review WFH requests." },
        { status: 403 }
      );
    }

    // =========================================
    // 5. FIND WFH REQUEST
    // =========================================

    const { data: wfhRequest, error: requestError } = await admin
      .from("wfh_requests")
      .select("id, employee_id, request_date, reason, status")
      .eq("id", id)
      .maybeSingle();

    if (requestError) {
      console.error("WFH request lookup error:", requestError);

      return NextResponse.json(
        { error: "Unable to find WFH request." },
        { status: 500 }
      );
    }

    if (!wfhRequest) {
      return NextResponse.json(
        { error: "WFH request not found." },
        { status: 404 }
      );
    }

    // =========================================
    // 6. VERIFY ASSIGNED REPORTING MANAGER
    // =========================================

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select(
        "id, user_id, first_name, last_name, reporting_manager_id"
      )
      .eq("id", wfhRequest.employee_id)
      .maybeSingle();

    if (employeeError) {
      console.error("WFH employee lookup error:", employeeError);

      return NextResponse.json(
        { error: "Unable to verify employee." },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found." },
        { status: 404 }
      );
    }

    if (employee.reporting_manager_id !== manager.id) {
      return NextResponse.json(
        {
          error:
            "You are not the assigned reporting manager for this employee.",
        },
        { status: 403 }
      );
    }

    // =========================================
    // 7. CHECK CURRENT REQUEST STATUS
    // =========================================

    if (wfhRequest.status !== "pending_manager") {
      return NextResponse.json(
        {
          error:
            "This WFH request has already been reviewed or is no longer pending manager approval.",
        },
        { status: 409 }
      );
    }

    // =========================================
    // 8. UPDATE WFH REQUEST
    //
    // Manager approves -> pending (HR review)
    // Manager rejects  -> rejected
    // =========================================

    const nextStatus =
      newStatus === "approved" ? "pending" : "rejected";

    const { data: updatedRequest, error: updateError } = await admin
      .from("wfh_requests")
      .update({
        status: nextStatus,
      })
      .eq("id", id)
      .eq("status", "pending_manager")
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("WFH update error:", updateError);

      return NextResponse.json(
        { error: "Unable to update WFH request." },
        { status: 500 }
      );
    }

    if (!updatedRequest) {
      return NextResponse.json(
        {
          error:
            "This WFH request was already processed. Please refresh the page.",
        },
        { status: 409 }
      );
    }

    // =========================================
    // 9. PREPARE EMPLOYEE DETAILS
    // =========================================

    const employeeName =
      `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
      "Employee";

    const requestDate = wfhRequest.request_date;

    // =========================================
    // 10. MANAGER REJECTS
    // Notify employee only.
    // =========================================

    if (newStatus === "rejected") {
      if (!employee.user_id) {
        console.error(
          "Employee has no linked user account:",
          employee.id
        );

        return NextResponse.json({
          success: true,
          message:
            "WFH request rejected, but employee notification could not be sent because the employee account is not linked.",
          request: updatedRequest,
        });
      }

      const { error: notificationError } = await admin
        .from("notifications")
        .insert({
          recipient_user_id: employee.user_id,
          employee_id: employee.id,
          title: "WFH Request Rejected",
          message: `Your WFH request for ${requestDate} was rejected by your reporting manager. Reason: ${rejectionReason}`,
          type: "wfh",
          is_read: false,
        });

      if (notificationError) {
        console.error(
          "WFH employee notification error:",
          notificationError
        );
      }

      return NextResponse.json({
        success: true,
        message: notificationError
          ? "WFH request rejected, but the employee notification could not be sent."
          : "WFH request rejected successfully. Employee has been notified.",
        request: updatedRequest,
      });
    }

    // =========================================
    // 11. MANAGER APPROVES
    // Move request to HR approval.
    // =========================================

    const { data: hrUsers, error: hrError } = await admin
      .from("profiles")
      .select("id")
      .in("role", ["hr", "ceo"]);

    if (hrError) {
      console.error("HR users lookup error:", hrError);

      return NextResponse.json({
        success: true,
        message:
          "WFH request moved to HR approval, but HR notifications could not be prepared.",
        request: updatedRequest,
      });
    }

    if (!hrUsers || hrUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message:
          "WFH request moved to HR approval, but no HR users were found for notification.",
        request: updatedRequest,
      });
    }

    const hrNotifications = hrUsers.map((hrUser) => ({
      recipient_user_id: hrUser.id,
      employee_id: employee.id,
      title: "New WFH Request - HR Approval",
      message: `${employeeName}'s WFH request for ${requestDate} has been approved by the reporting manager and is waiting for your final approval.`,
      type: "wfh",
      is_read: false,
    }));

    const { error: hrNotificationError } = await admin
      .from("notifications")
      .insert(hrNotifications);

    if (hrNotificationError) {
      console.error(
        "HR WFH notification error:",
        hrNotificationError
      );
    }

    return NextResponse.json({
      success: true,
      message: hrNotificationError
        ? "WFH request moved to HR approval, but HR notification could not be sent."
        : "WFH request approved by manager and sent to HR for final approval.",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Manager WFH PATCH error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
