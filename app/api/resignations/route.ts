
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

type ResignationBody = {
  employee_id?: unknown;
  resignation_date?: unknown;
  reason?: unknown;
  document_url?: unknown;
  document_name?: unknown;
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await createAdminClient();

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup failed:", employeeError);
      return NextResponse.json(
        { error: "Unable to load employee record." },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "No employee record is linked to this account." },
        { status: 404 }
      );
    }

    const { data: requests, error: requestsError } = await admin
      .from("resignation_requests")
      .select("id, employee_id, resignation_date, notice_period_days, planned_last_working_date, reason, document_url, document_name, status, rejection_reason, reviewed_at, created_at")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    if (requestsError) {
      console.error("Resignation requests lookup failed:", requestsError);
      return NextResponse.json(
        { error: "Unable to load resignation requests." },
        { status: 500 }
      );
    }

        const resignationRequests = requests ?? [];
    const resignationIds = resignationRequests.map((item) => item.id);

    let revertRequests: {
      id: string;
      resignation_request_id: string;
      reason: string | null;
      status: "pending" | "approved" | "rejected";
      rejection_reason: string | null;
      created_at: string;
    }[] = [];

    if (resignationIds.length > 0) {
      const { data: revertData, error: revertError } = await admin
        .from("resignation_revert_requests")
        .select(
          "id, resignation_request_id, reason, status, rejection_reason, created_at"
        )
        .eq("employee_id", employee.id)
        .in("resignation_request_id", resignationIds)
        .order("created_at", { ascending: false });

      if (revertError) {
        console.error("Reversal requests lookup failed:", revertError);
        return NextResponse.json(
          { error: "Unable to load reversal request history." },
          { status: 500 }
        );
      }

      revertRequests = (revertData ?? []) as typeof revertRequests;
    }

    const requestsWithReverts = resignationRequests.map((item) => ({
      ...item,
      revert_requests: revertRequests.filter(
        (revert) => revert.resignation_request_id === item.id
      ),
    }));

    return NextResponse.json({ requests: requestsWithReverts });
  } catch (error) {
    console.error("Resignation GET failed:", error);
    return NextResponse.json(
      { error: "Unexpected error loading resignation requests." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the signed-in user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse the request body.
    let body: ResignationBody;

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

      body = parsed as ResignationBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const {
      employee_id,
      resignation_date,
      reason,
      document_url,
      document_name,
    } = body;

    // 3. Validate employee-submitted fields.
    // Notice period and last working date are determined during HR review.
    if (
      typeof employee_id !== "string" ||
      !employee_id.trim() ||
      typeof resignation_date !== "string" ||
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 5000 ||
      typeof document_url !== "string" ||
      !document_url.trim() ||
      typeof document_name !== "string" ||
      !document_name.trim() ||
      document_name.length > 255
    ) {
      return NextResponse.json(
        { error: "Please provide all required resignation details." },
        { status: 400 }
      );
    }

    const isValidDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (!isValidDate(resignation_date)) {
      return NextResponse.json(
        { error: "Please provide a valid resignation date." },
        { status: 400 }
      );
    }

    // 4. Verify employee ownership and status.
    const admin = await createAdminClient();

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, user_id, status, first_name, last_name")
      .eq("id", employee_id)
      .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup failed:", employeeError);
      return NextResponse.json(
        { error: "Unable to verify employee record." },
        { status: 500 }
      );
    }

    if (!employee || employee.user_id !== user.id) {
      return NextResponse.json(
        { error: "You are not authorized to submit for this employee." },
        { status: 403 }
      );
    }

    if (employee.status !== "active") {
      return NextResponse.json(
        { error: "Only active employees can submit a resignation request." },
        { status: 400 }
      );
    }

    // 5. Ensure the document path belongs to this employee.
    const expectedPrefix = `${employee.id}/`;

    if (
      !document_url.startsWith(expectedPrefix) ||
      document_url.includes("..") ||
      document_url.startsWith("/") ||
      document_url.includes("\\") ||
      document_url.includes("?") ||
      document_url.includes("#")
    ) {
      return NextResponse.json(
        { error: "Invalid supporting document path." },
        { status: 400 }
      );
    }

    // 6. Verify that the uploaded document exists in the expected bucket.
    const { data: file, error: fileError } = await admin.storage
      .from("employee-exit-documents")
      .download(document_url);

    if (fileError || !file) {
      console.error("Resignation document verification failed:", fileError);
      return NextResponse.json(
        { error: "Supporting document was not found. Please upload it again." },
        { status: 400 }
      );
    }

    // 7. Prevent duplicate pending requests.
    const { data: existingRequest, error: existingError } = await admin
      .from("resignation_requests")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingError) {
      console.error("Pending resignation lookup failed:", existingError);
      return NextResponse.json(
        { error: "Unable to check existing resignation requests." },
        { status: 500 }
      );
    }

    if (existingRequest) {
      return NextResponse.json(
        { error: "You already have a pending resignation request." },
        { status: 409 }
      );
    }

    // 8. Insert a pending request without changing the employee record.
    // The database column defaults for notice fields must allow this insert.
    const { data: resignation, error: insertError } = await admin
      .from("resignation_requests")
      .insert({
        employee_id: employee.id,
        resignation_date,
        reason: reason.trim(),
        document_url,
        document_name: document_name.trim(),
        status: "pending",
        submitted_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Resignation request insert failed:", insertError);

      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "You already have a pending resignation request." },
          { status: 409 }
        );
      }

      if (insertError.code === "23502" || insertError.code === "23514") {
        return NextResponse.json(
          {
            error:
              "The resignation table still requires notice-period details. Its database constraints must be updated before submission can work.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to submit resignation request." },
        { status: 500 }
      );
    }


    // 9. Notify every HR user after successful submission.
    // Notification failures must not undo the resignation request.
    const { data: hrUsers, error: hrUsersError } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "hr");

    if (hrUsersError) {
      console.error(
        "Failed to fetch HR recipients for resignation notification:",
        hrUsersError.message
      );
    } else if (hrUsers && hrUsers.length > 0) {
      const employeeName = [
        employee.first_name,
        employee.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const notificationRows = hrUsers.map((hr) => ({
        // Required by your existing notifications table.
        employee_id: employee.id,

        // Direct recipient: each HR account receives its own row.
        recipient_user_id: hr.id,

        title: "New Resignation Request",
        message: `${employeeName || "An employee"} has submitted a resignation request. Please review it.`,
        type: "resignation",
        is_read: false,
      }));

      const { error: notificationError } = await admin
        .from("notifications")
        .insert(notificationRows);

      if (notificationError) {
        console.error(
          "Failed to create resignation notifications:",
          notificationError.message
        );
      }
    }

    return NextResponse.json(
      { success: true, resignation },
      { status: 201 }
    );

  } catch (error) {
    console.error("Resignation submission error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while submitting resignation." },
      { status: 500 }
    );
  }
}
