
import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function getIndiaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify the logged-in HR user
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

    const { status, rejectionReason } = body;

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json(
        {
          success: false,
          error: "Status must be approved or rejected.",
        },
        { status: 400 }
      );
    }

    // Read the leave request before reviewing it
    const adminSupabase = await createAdminClient();

    const { data: leaveRequest, error: leaveError } =
      await adminSupabase
        .from("leave_requests")
        .select("id, employee_id, start_date, end_date, status")
        .eq("id", id)
        .single();

    if (leaveError || !leaveRequest) {
      return NextResponse.json(
        {
          success: false,
          error: leaveError?.message || "Leave request not found.",
        },
        { status: 404 }
      );
    }

    // Only pending leave requests can be reviewed.
    if (leaveRequest.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `This leave request cannot be reviewed because its current status is "${leaveRequest.status}".`,
        },
        { status: 409 }
      );
    }

    // Expire overdue pending requests using the India date.
    const today = getIndiaDate();

    if (leaveRequest.end_date < today) {
      const { data: expiredRequest, error: expiryError } =
        await adminSupabase
          .from("leave_requests")
          .update({ status: "expired" })
          .eq("id", id)
          .eq("status", "pending")
          .lt("end_date", today)
          .select("id")
          .maybeSingle();

      if (expiryError) {
        throw new Error(
          `Could not expire overdue leave request: ${expiryError.message}`
        );
      }

      return NextResponse.json(
        {
          success: false,
          expired: Boolean(expiredRequest),
          error: expiredRequest
            ? "This leave request has expired because its leave period has already ended."
            : "This leave request is no longer pending or has already been updated.",
        },
        { status: 409 }
      );
    }

    // Keep the existing leave-review and balance logic
    const success = await DataStore.reviewLeaveRequest({
      requestId: id,
      status,
      reviewerId: user.id,
      rejectionReason,
    });

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to review this leave request.",
        },
        { status: 400 }
      );
    }

    // Create a notification for the employee
    const title =
      status === "approved"
        ? "Leave Request Approved"
        : "Leave Request Rejected";

    const dateRange = `${leaveRequest.start_date} to ${leaveRequest.end_date}`;

    const message =
      status === "approved"
        ? `Your leave request (${dateRange}) has been approved by HR.`
        : `Your leave request (${dateRange}) has been rejected by HR.${
            rejectionReason
              ? ` Reason: ${rejectionReason}`
              : ""
          }`;

    const { error: notificationError } = await adminSupabase
      .from("notifications")
      .insert({
        employee_id: leaveRequest.employee_id,
        title,
        message,
        type: "leave",
        is_read: false,
      });

    if (notificationError) {
      // Leave review has succeeded, so don't report the review itself as failed.
      console.error(
        "Failed to create employee leave notification:",
        notificationError.message
      );

      return NextResponse.json({
        success: true,
        notificationCreated: false,
        notificationMessage:
          "Leave was reviewed, but the employee notification could not be saved. Check the notifications table in Supabase.",
      });
    }

    return NextResponse.json({
      success: true,
      notificationCreated: true,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    console.error("Leave review API error:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
