import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

type ReviewDecision = "approved" | "rejected";
type NoticePeriodUnit = "days" | "months";

type ReviewRequestBody = {
  status?: unknown;
  noticePeriodValue?: unknown;
  noticePeriodUnit?: unknown;
  rejectionReason?: unknown;
  temporaryLoginDays?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
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

    const role = String(profile.role ?? "").trim().toLowerCase();

    if (!["hr", "ceo"].includes(role)) {
      return NextResponse.json(
        { error: "Only HR and CEO can review resignation requests." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return NextResponse.json(
        { error: "Invalid resignation request ID." },
        { status: 400 }
      );
    }

    let body: ReviewRequestBody;

    try {
      const parsedBody: unknown = await request.json();

      if (
        typeof parsedBody !== "object" ||
        parsedBody === null ||
        Array.isArray(parsedBody)
      ) {
        return NextResponse.json(
          { error: "Invalid JSON request body." },
          { status: 400 }
        );
      }

      body = parsedBody as ReviewRequestBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const {
      status,
      noticePeriodValue,
      noticePeriodUnit,
      rejectionReason,
      temporaryLoginDays: rawTemporaryLoginDays,
    } = body;

    if (
      typeof status !== "string" ||
      !["approved", "rejected"].includes(status)
    ) {
      return NextResponse.json(
        { error: "Invalid resignation decision." },
        { status: 400 }
      );
    }

    const decision = status as ReviewDecision;

    if (decision === "rejected") {
      if (
        typeof rejectionReason !== "string" ||
        !rejectionReason.trim()
      ) {
        return NextResponse.json(
          { error: "A rejection reason is required." },
          { status: 400 }
        );
      }

      if (rejectionReason.trim().length > 2000) {
        return NextResponse.json(
          { error: "Rejection reason cannot exceed 2000 characters." },
          { status: 400 }
        );
      }
    }

    let approvedNoticeValue: number | null = null;
    let approvedNoticeUnit: NoticePeriodUnit = "days";
    let temporaryLoginDays: number | null = null;

    if (decision === "approved") {
      if (
        typeof noticePeriodValue !== "number" ||
        !Number.isInteger(noticePeriodValue) ||
        noticePeriodValue < 1
      ) {
        return NextResponse.json(
          { error: "Enter a valid approved notice period." },
          { status: 400 }
        );
      }

      if (
        typeof noticePeriodUnit !== "string" ||
        !["days", "months"].includes(noticePeriodUnit)
      ) {
        return NextResponse.json(
          { error: "Notice period unit must be days or months." },
          { status: 400 }
        );
      }

      if (noticePeriodUnit === "days" && noticePeriodValue > 365) {
        return NextResponse.json(
          { error: "Notice period cannot exceed 365 days." },
          { status: 400 }
        );
      }

      if (noticePeriodUnit === "months" && noticePeriodValue > 12) {
        return NextResponse.json(
          { error: "Notice period cannot exceed 12 months." },
          { status: 400 }
        );
      }

      if (
        typeof rawTemporaryLoginDays !== "number" ||
        !Number.isInteger(rawTemporaryLoginDays) ||
        rawTemporaryLoginDays < 0 ||
        rawTemporaryLoginDays > 45
      ) {
        return NextResponse.json(
          {
            error:
              "Temporary login access must be a whole number between 0 and 45 days.",
          },
          { status: 400 }
        );
      }

      approvedNoticeValue = noticePeriodValue;
      approvedNoticeUnit = noticePeriodUnit as NoticePeriodUnit;
      temporaryLoginDays = rawTemporaryLoginDays;
    }

    const admin = await createAdminClient();

    const { data, error } = await admin.rpc(
      "review_resignation_request",
      {
        p_request_id: id,
        p_reviewer_id: user.id,
        p_decision: decision,
        p_notice_period_value: approvedNoticeValue,
        p_notice_period_unit: approvedNoticeUnit,
        p_rejection_reason:
          decision === "rejected"
            ? (rejectionReason as string).trim()
            : null,
        p_temporary_login_days: temporaryLoginDays,
      }
    );

    if (error) {
      console.error("Resignation review failed:", error);

      const message = error.message ?? "";

      if (
        message.includes("already been reviewed") ||
        message.includes("not found")
      ) {
        return NextResponse.json({ error: message }, { status: 409 });
      }

      if (
        message.includes("valid approved notice period") ||
        message.includes("cannot exceed") ||
        message.includes("must be days or months") ||
        message.includes("Temporary login access") ||
        message.includes("rejection reason is required") ||
        message.includes("Invalid resignation decision")
      ) {
        return NextResponse.json({ error: message }, { status: 400 });
      }

      return NextResponse.json(
        { error: "Unable to review the resignation request." },
        { status: 500 }
      );
    }

    const { data: resignation, error: resignationError } = await admin
      .from("resignation_requests")
      .select("employee_id")
      .eq("id", id)
      .maybeSingle();

    if (resignationError || !resignation) {
      console.error(
        "Unable to find employee for resignation notification:",
        resignationError
      );
    } else {
      const { data: employee, error: employeeError } = await admin
        .from("employees")
        .select("id, user_id")
        .eq("id", resignation.employee_id)
        .maybeSingle();

      if (employeeError || !employee) {
        console.error(
          "Unable to load employee for resignation notification:",
          employeeError
        );
      } else if (employee.user_id) {
        const approved = decision === "approved";

        const message = approved
          ? `Your resignation has been approved. Your notice period is ${approvedNoticeValue} ${approvedNoticeUnit}. Your temporary login access is ${temporaryLoginDays} days after your planned last working day.`
          : `Your resignation has been rejected. Reason: ${(rejectionReason as string).trim()}`;

        const { error: notificationError } = await admin
          .from("notifications")
          .insert({
            employee_id: employee.id,
            recipient_user_id: employee.user_id,
            title: approved ? "Resignation Approved" : "Resignation Rejected",
            message,
            type: "resignation",
            is_read: false,
          });

        if (notificationError) {
          console.error(
            "Failed to create resignation review notification:",
            notificationError
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...(data && typeof data === "object" ? data : {}),
    });
  } catch (error) {
    console.error("Resignation review API error:", error);

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while reviewing the resignation.",
      },
      { status: 500 }
    );
  }
}
