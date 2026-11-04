import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import {getAuthFailureStatus,getAuthFailureMessage} from "@/lib/supabase-auth-error";

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

  const { data: employee, error } = await admin
    .from("employees")
    .select("id, employee_id, first_name, last_name, email, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("WFH employee lookup failed:", error);

    return {
      error: "Unable to verify employee account.",
      status: 500 as const,
    };
  }

  if (!employee) {
    return {
      error: "Only active employees can submit WFH requests.",
      status: 403 as const,
    };
  }

  return { user, employee, admin };
}

// GET: Fetch only the authenticated employee's WFH requests.
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

    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    console.error("WFH GET API error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// POST: Create a WFH request for the authenticated employee.
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

    const body = await request.json();

    const requestDate =
      typeof body.request_date === "string"
        ? body.request_date.trim()
        : "";

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestDate)) {
      return NextResponse.json(
        { error: "Please provide a valid WFH date." },
        { status: 400 }
      );
    }

    const [year, month, day] = requestDate.split("-").map(Number);

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    const isValidCalendarDate = parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() === month - 1 && parsedDate.getUTCDate() === day;

    if (!isValidCalendarDate) {
        return NextResponse.json(
            { error: "Please provide a valid calendar date." },
            { status: 400 }
        );
    }

    if (requestDate < getIndiaToday()) {
      return NextResponse.json(
        { error: "WFH requests cannot be submitted for past dates." },
        { status: 400 }
      );
    }

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
