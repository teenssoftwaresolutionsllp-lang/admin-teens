
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import {
  getAuthFailureStatus,
  getAuthFailureMessage,
} from "@/lib/supabase-auth-error";

export const dynamic = "force-dynamic";

function getIndiaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;

  return `${year}-${month}-${day}`;
}

async function getAuthenticatedEmployee() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const status = getAuthFailureStatus(authError);

    return {
      error: getAuthFailureMessage(status),
      status,
    };
  }

  const admin = await createAdminClient();

  // First, find employee using authenticated user ID.
  const { data: userIdMatches, error: userIdError } = await admin
    .from("employees")
    .select(
      "id, employee_id, user_id, first_name, last_name, email, status"
    )
    .eq("user_id", user.id)
    .limit(2);

  if (userIdError) {
    console.error("WFH employee lookup by user ID failed:", userIdError);

    return {
      error: "Unable to verify employee account.",
      status: 500 as const,
    };
  }

  let employee = null;

  if (userIdMatches && userIdMatches.length > 1) {
    console.error("Multiple employees found for user:", user.id);

    return {
      error: "Multiple employee accounts found. Please contact HR.",
      status: 409 as const,
    };
  }

  if (userIdMatches && userIdMatches.length === 1) {
    employee = userIdMatches[0];
  }

  // If user ID lookup fails, try authenticated user's email.
  if (!employee && user.email) {
    const { data: emailMatches, error: emailError } = await admin
      .from("employees")
      .select(
        "id, employee_id, user_id, first_name, last_name, email, status"
      )
      .ilike("email", user.email.trim())
      .limit(2);

    if (emailError) {
      console.error("WFH employee lookup by email failed:", emailError);

      return {
        error: "Unable to verify employee account.",
        status: 500 as const,
      };
    }

    if (emailMatches && emailMatches.length > 1) {
      console.error("Multiple employees found for email:", user.email);

      return {
        error: "Multiple employee accounts found. Please contact HR.",
        status: 409 as const,
      };
    }

    if (emailMatches && emailMatches.length === 1) {
      employee = emailMatches[0];
    }
  }

  if (!employee) {
    return {
      error: "Employee account not found. Please contact HR.",
      status: 403 as const,
    };
  }

  // Allow active and on_notice employees.
  const employeeStatus = String(employee.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const allowedStatuses = ["active", "on_notice"];

  if (!allowedStatuses.includes(employeeStatus)) {
    return {
      error: `Your employee account is '${employeeStatus || "not active"}'. Please contact HR.`,
      status: 403 as const,
    };
  }

  return {
    user,
    employee,
    admin,
  };
}

// GET: Fetch authenticated employee's WFH requests.
export async function GET() {
  try {
    const result = await getAuthenticatedEmployee();

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { employee, admin } = result;

    const { data, error } = await admin
      .from("wfh_requests")
      .select("*")
      .eq("employee_id", employee.id)
      .order("request_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("WFH request history fetch failed:", error);

      return NextResponse.json(
        { error: "Unable to load WFH request history." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { requests: data ?? [] },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("WFH GET API error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// POST: Create WFH request and notify HR.
export async function POST(request: Request) {
  try {
    const result = await getAuthenticatedEmployee();

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { employee, admin } = result;

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const requestDate =
      typeof body.request_date === "string"
        ? body.request_date.trim()
        : "";

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    // Validate date format.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestDate)) {
      return NextResponse.json(
        { error: "Please provide a valid WFH date." },
        { status: 400 }
      );
    }

    // Validate actual calendar date.
    const [year, month, day] = requestDate.split("-").map(Number);

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    const isValidCalendarDate =
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day;

    if (!isValidCalendarDate) {
      return NextResponse.json(
        { error: "Please provide a valid calendar date." },
        { status: 400 }
      );
    }

    // Do not allow past dates.
    if (requestDate < getIndiaToday()) {
      return NextResponse.json(
        { error: "WFH requests cannot be submitted for past dates." },
        { status: 400 }
      );
    }

    // Validate reason.
    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: "Please provide a reason of at least 5 characters." },
        { status: 400 }
      );
    }

    if (reason.length > 1000) {
      return NextResponse.json(
        { error: "Reason cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    // Create WFH request.
    const { data, error } = await admin
      .from("wfh_requests")
      .insert({
        employee_id: employee.id,
        request_date: requestDate,
        reason,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You already have a WFH request for this date." },
          { status: 409 }
        );
      }

      console.error("WFH request creation failed:", error);

      return NextResponse.json(
        { error: "Unable to submit WFH request." },
        { status: 500 }
      );
    }

    // Find all HR users.
    const { data: hrProfiles, error: hrProfilesError } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "hr");

    if (hrProfilesError) {
      console.error("WFH HR profiles lookup failed:", hrProfilesError);
    } else if (hrProfiles && hrProfiles.length > 0) {
      const employeeName =
        `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
        employee.employee_id ||
        "An employee";

      const notificationRows = hrProfiles.map((hrProfile) => ({
        recipient_user_id: hrProfile.id,
        employee_id: employee.id,
        title: "New WFH Request",
        message: `${employeeName} has submitted a Work From Home request for ${requestDate}.`,
        type: "wfh",
        is_read: false,
      }));

      const { error: notificationError } = await admin
        .from("notifications")
        .insert(notificationRows);

      if (notificationError) {
        console.error(
          "WFH notification insertion failed:",
          notificationError
        );
      } else {
        console.log("WFH notifications sent to HR successfully.");
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "WFH request submitted successfully.",
        request: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("WFH POST API error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
