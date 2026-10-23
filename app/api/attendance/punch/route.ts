import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";



export async function POST(request: Request) {
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

    const { employeeId, action } = await request.json();

    if (!employeeId || !["in", "out"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid employeeId or action" },
        { status: 400 }
      );
    }

    const employee = await DataStore.getEmployeeById(employeeId);

    if (!employee || employee.user_id !== user.id) {
      return NextResponse.json(
        { error: "Employee access denied." },
        { status: 403 }
      );
    }

    const admin = await createAdminClient();

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === "year")!.value;
    const month = parts.find((part) => part.type === "month")!.value;
    const day = parts.find((part) => part.type === "day")!.value;

    const today = `${year}-${month}-${day}`;

    const { data: attendance, error: attendanceError } = await admin
      .from("attendance_logs")
      .select("id, check_in_time, check_out_time")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (attendanceError) {
      throw new Error(attendanceError.message);
    }

    if (action === "in") {
      if (attendance?.check_in_time && !attendance?.check_out_time) {
        return NextResponse.json(
          { error: "You are already logged in." },
          { status: 400 }
        );
      }

      if (attendance?.check_out_time) {
        const { data: approved, error: approvalError } = await admin
          .from("attendance_regularizations")
          .select("id")
          .eq("employee_id", employee.id)
          .eq("attendance_date", today)
          .eq("status", "approved")
          .order("reviewed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (approvalError) {
          throw new Error(approvalError.message);
        }

        if (!approved) {
          return NextResponse.json(
            {
              error:
                "Submit Attendance Regularization and wait for HR approval before logging in again.",
            },
            { status: 403 }
          );
        }
      }

      const log = await DataStore.clockIn(employee.id);

      return NextResponse.json({ success: true, log });
    }

    if (!attendance?.check_in_time || attendance?.check_out_time) {
      return NextResponse.json(
        { error: "You must be logged in before logging out." },
        { status: 400 }
      );
    }

    const log = await DataStore.clockOut(employee.id);

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    console.error("Punch API error:", error);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}