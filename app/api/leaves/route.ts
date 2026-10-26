
import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const employeeId =
      searchParams.get("employeeId") || undefined;

    const requests = await DataStore.getLeaveRequests(employeeId);
    const leaveTypes = await DataStore.getLeaveTypes();

    const leaveBalances = employeeId
      ? await DataStore.getLeaveBalances(employeeId)
      : [];

    return NextResponse.json(
      {
        success: true,
        requests,
        leaveRequests: requests,
        leaveTypes,
        leaveBalances,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    console.error("GET /api/leaves error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load leave information.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Verify the logged-in user.
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

    const body = await request.json();

    const {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      totalDays,
      isHalfDay,
      reason,
    } = body;

    // Validate required fields.
    if (
      !employeeId ||
      !leaveTypeId ||
      !startDate ||
      !endDate ||
      totalDays === undefined ||
      totalDays === null
    ) {
      return NextResponse.json(
        { error: "Missing required leave fields." },
        { status: 400 }
      );
    }

    // Validate date format.
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (
      typeof startDate !== "string" ||
      typeof endDate !== "string" ||
      !datePattern.test(startDate) ||
      !datePattern.test(endDate)
    ) {
      return NextResponse.json(
        { error: "Please provide valid leave dates." },
        { status: 400 }
      );
    }

    // Validate date order.
    if (endDate < startDate) {
      return NextResponse.json(
        { error: "To Date cannot be before From Date." },
        { status: 400 }
      );
    }

    // Get the employee record and their actual joining date.
    const employee = await DataStore.getEmployeeById(employeeId);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found. Please contact HR." },
        { status: 404 }
      );
    }

    const joiningDate = employee.joining_date
      ? String(employee.joining_date).split("T")[0]
      : "";

    // Do not allow leave requests without a valid joining date.
    if (!datePattern.test(joiningDate)) {
      return NextResponse.json(
        {
          error:
            "Your joining date is not available. Please contact HR.",
        },
        { status: 400 }
      );
    }

    // Block leave requests that start before the joining date.
    if (startDate < joiningDate) {
      return NextResponse.json(
        {
          error: `You cannot apply for leave before your joining date (${joiningDate}).`,
        },
        { status: 400 }
      );
    }

    // Validate leave duration.
    const days = Number(totalDays);

    if (!Number.isFinite(days) || days <= 0) {
      return NextResponse.json(
        { error: "Please select a valid leave duration." },
        { status: 400 }
      );
    }

    // Save the request only after all validations pass.
    const leaveReq = await DataStore.createLeaveRequest({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      totalDays: days,
      isHalfDay: Boolean(isHalfDay),
      reason:
        typeof reason === "string" && reason.trim()
          ? reason.trim()
          : "Personal Leave",
    });

    return NextResponse.json(
      {
        success: true,
        leaveRequest: leaveReq,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/leaves error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit leave application.",
      },
      { status: 500 }
    );
  }
}
