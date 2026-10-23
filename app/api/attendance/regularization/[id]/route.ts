import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient, createAdminClient } from '@/lib/supabase-server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, rejectionReason } = body;

    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json(
        { error: "Status must be approved or rejected" },
        { status: 400 }
      );
    }

    if (status === "rejected" && !rejectionReason?.trim()) {
      return NextResponse.json(
        { error: "A rejection reason is required" },
        { status: 400 }
      );
    }

    // TODO: Verify the authenticated user has an authorized HR/reviewer role
    // using the project's existing role/permission logic.

    const success = await DataStore.reviewAttendanceRegularization({
      id,
      status,
      reviewerId: user.id,
      rejectionReason: rejectionReason?.trim(),
    });

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Regularization request not found" },
        { status: 404 }
      );
    }

    const admin = await createAdminClient();

    const { data: regularization, error: lookupError } = await admin
      .from("attendance_regularizations")
      .select("employee_id")
      .eq("id", id)
      .single();

    if (lookupError) {
      console.error(
        "Failed to find regularization employee:",
        lookupError
      );
    } else if (regularization?.employee_id) {
      const approved = status === "approved";

      const { error: notificationError } = await admin
        .from("notifications")
        .insert({
          employee_id: regularization.employee_id,
          title: approved
            ? "Attendance Regularization Approved"
            : "Attendance Regularization Rejected",
          message: approved
            ? "Your attendance regularization request has been approved."
            : `Your attendance regularization request was rejected.${
                rejectionReason?.trim()
                  ? ` Reason: ${rejectionReason.trim()}`
                  : ""
              }`,
          type: "attendance_regularization",
          is_read: false,
        });

      if (notificationError) {
        console.error(
          "Failed to create regularization notification:",
          notificationError
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}