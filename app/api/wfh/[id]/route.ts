import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // Verify HR/CEO permission.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("WFH reviewer role lookup failed:", profileError);
      return NextResponse.json(
        { error: "Unable to verify permissions." },
        { status: 500 }
      );
    }

    const role = String(profile?.role ?? "").toLowerCase();

    if (role !== "hr" && role !== "ceo") {
      return NextResponse.json(
        { error: "Only HR or CEO can review WFH requests." },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return NextResponse.json(
        { error: "Invalid WFH request ID." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const status =
      typeof body.status === "string"
        ? body.status.trim().toLowerCase()
        : "";

    const rejectionReason =
      typeof body.rejection_reason === "string"
        ? body.rejection_reason.trim()
        : "";

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Select approve or reject." },
        { status: 400 }
      );
    }

    if (status === "rejected" && !rejectionReason) {
      return NextResponse.json(
        { error: "A rejection reason is required." },
        { status: 400 }
      );
    }

    if (rejectionReason.length > 1000) {
      return NextResponse.json(
        { error: "Rejection reason cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    // Load the request and confirm it is still pending.
    const { data: wfhRequest, error: requestError } = await admin
      .from("wfh_requests")
      .select("id, employee_id, status, request_date")
      .eq("id", id)
      .maybeSingle();

    if (requestError) {
      console.error("WFH request lookup failed:", requestError);
      return NextResponse.json(
        { error: "Unable to load WFH request." },
        { status: 500 }
      );
    }

    if (!wfhRequest) {
      return NextResponse.json(
        { error: "WFH request not found." },
        { status: 404 }
      );
    }

    if (wfhRequest.status !== "pending") {
      return NextResponse.json(
        { error: "This WFH request has already been reviewed." },
        { status: 409 }
      );
    }

    const reviewedAt = new Date().toISOString();

    // Conditional update prevents two reviewers from reviewing the same request.
    const { data: updatedRequest, error: updateError } = await admin
      .from("wfh_requests")
      .update({
        status,
        rejection_reason:
          status === "rejected" ? rejectionReason : null,
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("WFH review update failed:", updateError);
      return NextResponse.json(
        { error: "Unable to review WFH request." },
        { status: 500 }
      );
    }

    if (!updatedRequest) {
      return NextResponse.json(
        { error: "This WFH request was already reviewed by another reviewer." },
        { status: 409 }
      );
    }

    // Notify the employee. Notification failure must not undo the review.
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, user_id, first_name")
      .eq("id", wfhRequest.employee_id)
      .maybeSingle();

    if (employeeError) {
      console.error("WFH notification employee lookup failed:", employeeError);
    } else if (employee?.user_id) {
      const approved = status === "approved";

      const { error: notificationError } = await admin
        .from("notifications")
        .insert({
          employee_id: employee.id,
          recipient_user_id: employee.user_id,
          title: approved ? "WFH Request Approved" : "WFH Request Rejected",
          message: approved
            ? `Your WFH request for ${wfhRequest.request_date} has been approved.`
            : `Your WFH request for ${wfhRequest.request_date} was rejected. Reason: ${rejectionReason}`,
          type: "wfh_request",
          is_read: false,
        });

      if (notificationError) {
        console.error(
          "WFH review notification failed:",
          notificationError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `WFH request ${status} successfully.`,
      request: updatedRequest,
    });
  } catch (error) {
    console.error("WFH review API error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}