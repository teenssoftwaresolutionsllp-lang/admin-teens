
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

type RevertAction = "withdraw" | "request" | "approve" | "reject";

type RevertBody = {
  action?: unknown;
  reason?: unknown;
  revertRequestId?: unknown;
  rejectionReason?: unknown;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getIndiaDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate the signed-in user.
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

    // 2. Validate the URL ID.
    const { id } = await params;

    if (!uuidPattern.test(id)) {
      return NextResponse.json(
        { error: "Invalid request ID." },
        { status: 400 }
      );
    }

    // 3. Parse and validate the request body.
    let body: RevertBody;

    try {
      const parsed: unknown = await request.json();

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return NextResponse.json(
          { error: "Invalid request body." },
          { status: 400 }
        );
      }

      body = parsed as RevertBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      typeof body.action !== "string" ||
      !["withdraw", "request", "approve", "reject"].includes(body.action)
    ) {
      return NextResponse.json(
        {
          error:
            "Action must be withdraw, request, approve, or reject.",
        },
        { status: 400 }
      );
    }

    const action = body.action as RevertAction;

    // 4. Handle HR/CEO review before employee ownership checks.
    if (action === "approve" || action === "reject") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile ||
        !["hr", "ceo"].includes(profile.role)
      ) {
        return NextResponse.json(
          { error: "Only HR or CEO can review reversal requests." },
          { status: 403 }
        );
      }

      // The URL ID is the original resignation ID.
      // The database review function needs the reversal request ID.
      if (
        typeof body.revertRequestId !== "string" ||
        !uuidPattern.test(body.revertRequestId)
      ) {
        return NextResponse.json(
          { error: "A valid reversal request ID is required." },
          { status: 400 }
        );
      }

        let rejectionReason: string | null = null;

        if (action === "reject") {
        if (typeof body.rejectionReason !== "string") {
            return NextResponse.json(
            { error: "Invalid rejection reason." },
            { status: 400 }
            );
        }

        rejectionReason = body.rejectionReason.trim();

        if (!rejectionReason) {
            return NextResponse.json(
            { error: "A rejection reason is required." },
            { status: 400 }
            );
        }
        }

      if (action === "reject" && !rejectionReason) {
        return NextResponse.json(
          { error: "A rejection reason is required." },
          { status: 400 }
        );
      }

      if (rejectionReason && rejectionReason.length > 2000) {
        return NextResponse.json(
          { error: "Rejection reason cannot exceed 2000 characters." },
          { status: 400 }
        );
      }

      const admin = await createAdminClient();

      // Verify that the reversal belongs to the resignation in the URL.
      const { data: revertRequest, error: lookupError } = await admin
        .from("resignation_revert_requests")
        .select("id, resignation_request_id, status")
        .eq("id", body.revertRequestId)
        .eq("resignation_request_id", id)
        .maybeSingle();

      if (lookupError) {
        console.error("Reversal request lookup failed:", lookupError);

        return NextResponse.json(
          { error: "Unable to load the reversal request." },
          { status: 500 }
        );
      }

      if (!revertRequest) {
        return NextResponse.json(
          { error: "Reversal request not found for this resignation." },
          { status: 404 }
        );
      }

      if (revertRequest.status !== "pending") {
        return NextResponse.json(
          { error: "This reversal request has already been reviewed." },
          { status: 409 }
        );
      }

      const { error: reviewError } = await admin.rpc(
        "review_resignation_revert_request",
        {
          p_revert_request_id: body.revertRequestId,
          p_reviewer_id: user.id,
          p_decision: action === "approve" ? "approved" : "rejected",
          p_rejection_reason:
            action === "reject" ? rejectionReason : null,
        }
      );

      if (reviewError) {
        console.error("Resignation reversal review failed:", reviewError);

        const message = reviewError.message || "";

        if (/snapshot|previous employee state/i.test(message)) {
          return NextResponse.json(
            {
              error:
                "The original employee state is unavailable. Please contact the system administrator.",
            },
            { status: 409 }
          );
        }

        if (
          /deadline|planned last working date|past the last working date/i.test(
            message
          )
        ) {
          return NextResponse.json(
            {
              error:
                "The planned last working date has passed. This reversal cannot be approved.",
            },
            { status: 409 }
          );
        }

        if (/already reviewed|not pending|not approved/i.test(message)) {
          return NextResponse.json(
            {
              error:
                "This request is no longer pending or its resignation is no longer approved.",
            },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { error: "Unable to review the reversal request." },
          { status: 500 }
        );
      }



      // Notify the affected employee after the reversal decision succeeds.
      const { data: resignation, error: resignationError } = await admin
        .from("resignation_requests")
        .select("employee_id")
        .eq("id", revertRequest.resignation_request_id)
        .maybeSingle();

      if (resignationError || !resignation) {
        console.error(
          "Unable to find employee for reversal notification:",
          resignationError
        );
      } else {
        const { data: employee, error: employeeError } = await admin
          .from("employees")
          .select("id, user_id, first_name, last_name")
          .eq("id", resignation.employee_id)
          .maybeSingle();

        if (employeeError || !employee) {
          console.error(
            "Unable to load employee for reversal notification:",
            employeeError
          );
        } else if (employee.user_id) {
          const approved = action === "approve";
          const employeeName = [
            employee.first_name,
            employee.last_name,
          ]
            .filter(Boolean)
            .join(" ");

          const { error: notificationError } = await admin
            .from("notifications")
            .insert({
              employee_id: employee.id,
              recipient_user_id: employee.user_id,
              title: approved
                ? "Resignation Reversal Approved"
                : "Resignation Reversal Rejected",
              message: approved
                ? "Your resignation reversal request has been approved."
                : `Your resignation reversal request has been rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
              type: "resignation",
              is_read: false,
            });

          if (notificationError) {
            console.error(
              `Failed to notify ${employeeName || "employee"} about reversal decision:`,
              notificationError
            );
          }
        }
      }


      return NextResponse.json({
        success: true,
        action,
        message:
          action === "approve"
            ? "Resignation reversal approved successfully."
            : "Resignation reversal rejected successfully.",
      });
    }

    // 5. Validate the optional employee reversal reason.
    let reason: string | null = null;

    if (body.reason !== undefined && body.reason !== null) {
      if (typeof body.reason !== "string") {
        return NextResponse.json(
          { error: "Invalid reversal reason." },
          { status: 400 }
        );
      }

      reason = body.reason.trim();

      if (reason.length > 2000) {
        return NextResponse.json(
          { error: "Reason cannot exceed 2000 characters." },
          { status: 400 }
        );
      }
    }

    // 6. Use the admin client for employee-owned database operations.
    const admin = await createAdminClient();

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, user_id, first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup failed:", employeeError);

      return NextResponse.json(
        { error: "Unable to verify employee record." },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "No employee record is linked to this account." },
        { status: 404 }
      );
    }

    // 7. Ensure the resignation belongs to the signed-in employee.
    const { data: resignation, error: resignationError } = await admin
      .from("resignation_requests")
      .select(
        "id, employee_id, status, planned_last_working_date, previous_employee_state"
      )
      .eq("id", id)
      .eq("employee_id", employee.id)
      .maybeSingle();

    if (resignationError) {
      console.error("Resignation lookup failed:", resignationError);

      return NextResponse.json(
        { error: "Unable to load resignation request." },
        { status: 500 }
      );
    }

    if (!resignation) {
      return NextResponse.json(
        { error: "Resignation request not found for this employee." },
        { status: 404 }
      );
    }

    // 8. Withdraw a pending resignation immediately.
    if (action === "withdraw") {
      if (resignation.status !== "pending") {
        return NextResponse.json(
          {
            error:
              "Only pending resignation requests can be withdrawn. Approved resignations require a reversal request.",
          },
          { status: 409 }
        );
      }

      const { data: withdrawn, error: withdrawError } = await admin
        .from("resignation_requests")
        .update({
          status: "withdrawn",
          updated_at: new Date().toISOString(),
        })
        .eq("id", resignation.id)
        .eq("employee_id", employee.id)
        .eq("status", "pending")
        .select("id, status, updated_at")
        .maybeSingle();

      if (withdrawError) {
        console.error("Resignation withdrawal failed:", withdrawError);

        return NextResponse.json(
          { error: "Unable to withdraw the resignation request." },
          { status: 500 }
        );
      }

      if (!withdrawn) {
        return NextResponse.json(
          {
            error:
              "This resignation request has already been processed. Refresh and try again.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "withdraw",
        resignation: withdrawn,
      });
    }

    // 9. Approved resignations require an HR-reviewed reversal request.
    if (resignation.status !== "approved") {
      return NextResponse.json(
        {
          error:
            "Only approved resignation requests can be submitted for reversal.",
        },
        { status: 409 }
      );
    }

    const today = getIndiaDate();

    let deadline = resignation.planned_last_working_date;

    if (!deadline) {
    const { data: employeeDates, error: employeeDatesError } = await admin
        .from("employees")
        .select("planned_last_working_date")
        .eq("id", employee.id)
        .maybeSingle();

    if (employeeDatesError) {
        console.error("Employee deadline lookup failed:", employeeDatesError);

        return NextResponse.json(
        { error: "Unable to verify the planned last working date." },
        { status: 500 }
        );
    }

    deadline = employeeDates?.planned_last_working_date ?? null;
    }

    if (!deadline || today > deadline) {
    return NextResponse.json(
        {
        error:
            "The reversal deadline has passed or the planned last working date is unavailable.",
        },
        { status: 400 }
    );
    }

    if (!resignation.previous_employee_state) {
      return NextResponse.json(
        {
          error:
            "This older resignation has no saved previous employee state. Please contact HR to review it before requesting reversal.",
        },
        { status: 409 }
      );
    }

    // 10. Create a pending reversal request.
    const { data: revertRequest, error: revertError } = await admin
      .from("resignation_revert_requests")
      .insert({
        resignation_request_id: resignation.id,
        employee_id: employee.id,
        requested_by: user.id,
        reason,
        status: "pending",
      })
      .select(
        "id, resignation_request_id, employee_id, reason, status, created_at"
      )
      .single();

    if (revertError) {
      console.error("Reversal request creation failed:", revertError);

      if (revertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "A reversal request is already pending for this resignation.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Unable to create the reversal request." },
        { status: 500 }
      );
    }

    // 11. Notify HR.
    const { data: hrUsers, error: hrError } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "hr");

    if (hrError) {
      console.error(
        "Unable to load HR notification recipients:",
        hrError.message
      );
    } else if (hrUsers && hrUsers.length > 0) {
      const employeeName = [
        employee.first_name,
        employee.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const notificationRows = hrUsers.map((hr) => ({
        employee_id: employee.id,
        recipient_user_id: hr.id,
        title: "Resignation Reversal Request",
        message: `${employeeName || "An employee"} has requested reversal of an approved resignation. Please review it.`,
        type: "resignation",
        is_read: false,
      }));

      const { error: notificationError } = await admin
        .from("notifications")
        .insert(notificationRows);

      if (notificationError) {
        console.error(
          "Unable to create HR notifications:",
          notificationError.message
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        action: "request",
        revertRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Resignation withdrawal/reversal API error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
