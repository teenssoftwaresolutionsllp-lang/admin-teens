
import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the logged-in user
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    // 2. Validate the request body
    let body: { employeeId?: string; action?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const { employeeId, action } = body;

    if (
      typeof employeeId !== "string" ||
      !employeeId.trim() ||
      (action !== "in" && action !== "out")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid employeeId or action. Use 'in' or 'out'.",
        },
        { status: 400 }
      );
    }

    // 3. Verify that this employee belongs to the logged-in user
    const employee = await DataStore.getEmployeeById(employeeId);

    if (!employee || employee.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Employee access denied.",
        },
        { status: 403 }
      );
    }

    // 4. Get the admin Supabase client
    const admin = await createAdminClient();

    // 5. Get today's date in India Standard Time
    const dateParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = dateParts.find((part) => part.type === "year")?.value;
    const month = dateParts.find((part) => part.type === "month")?.value;
    const day = dateParts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
      throw new Error("Unable to determine today's attendance date.");
    }

    const today = `${year}-${month}-${day}`;

    // 6. Fetch today's attendance record
    const {
      data: attendance,
      error: attendanceError,
    } = await admin
      .from("attendance_logs")
      .select("id, check_in_time, check_out_time")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (attendanceError) {
      console.error("Attendance lookup failed:", attendanceError);

      throw new Error(
        `Unable to retrieve attendance: ${attendanceError.message}`
      );
    }

    // 7. CLOCK IN
    if (action === "in") {
      // Prevent duplicate clock-in while already logged in
      if (attendance?.check_in_time && !attendance?.check_out_time) {
        return NextResponse.json(
          {
            success: false,
            error: "You are already logged in.",
          },
          { status: 400 }
        );
      }

      // If already clocked out today, require approved regularization
      if (attendance?.check_out_time) {
        const {
          data: approved,
          error: approvalError,
        } = await admin
          .from("attendance_regularizations")
          .select("id")
          .eq("employee_id", employee.id)
          .eq("attendance_date", today)
          .eq("status", "approved")
          .order("reviewed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (approvalError) {
          console.error(
            "Regularization approval lookup failed:",
            approvalError
          );

          throw new Error(
            `Unable to verify regularization approval: ${approvalError.message}`
          );
        }

        if (!approved) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Submit Attendance Regularization and wait for HR approval before logging in again.",
            },
            { status: 403 }
          );
        }
      }

      // Record clock-in through the existing DataStore method
      const log = await DataStore.clockIn(employee.id);

      return NextResponse.json({
        success: true,
        message: "Clock-in successful.",
        log,
      });
    }

    // 8. CLOCK OUT
    if (!attendance?.check_in_time || attendance?.check_out_time) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be logged in before logging out.",
        },
        { status: 400 }
      );
    }

    // Record clock-out through the existing DataStore method
    const log = await DataStore.clockOut(employee.id);

    return NextResponse.json({
      success: true,
      message: "Clock-out successful.",
      log,
    });
  } catch (error: unknown) {
    // 9. Log the real server-side error for debugging
    console.error("Punch API error:", error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Internal server error";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
