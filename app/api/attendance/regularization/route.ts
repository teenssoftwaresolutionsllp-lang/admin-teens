import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
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

    const requests =
      await DataStore.getAttendanceRegularizations();

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error(
      "GET /api/attendance/regularization error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to fetch regularization requests.",
      },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();

    const {
      employeeId,
      attendanceDate,
      proposedCheckIn,
      proposedCheckOut,
      reason,
    } = body;

    console.log("Regularization API payload:", {
      employeeId,
      attendanceDate,
      proposedCheckIn,
      proposedCheckOut,
      reason,
    });

    /*
     * Validate every field explicitly.
     */
    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required." },
        { status: 400 }
      );
    }

    if (!attendanceDate) {
      return NextResponse.json(
        { error: "Attendance date is required." },
        { status: 400 }
      );
    }

    if (!proposedCheckIn) {
      return NextResponse.json(
        { error: "Punch in time is required." },
        { status: 400 }
      );
    }

    if (!proposedCheckOut) {
      return NextResponse.json(
        { error: "Punch out time is required." },
        { status: 400 }
      );
    }

    if (!reason || !String(reason).trim()) {
      return NextResponse.json(
        { error: "Reason is required." },
        { status: 400 }
      );
    }

    /*
     * Create regularization request through DataStore.
     *
     * IMPORTANT:
     * These names must match DataStore:
     * proposedCheckIn
     * proposedCheckOut
     */
    const reg =
      await DataStore.createAttendanceRegularization({
        employeeId,
        attendanceDate,
        proposedCheckIn,
        proposedCheckOut,
        reason: String(reason).trim(),
      });

    return NextResponse.json(
      {
        success: true,
        regularization: reg,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(
      "POST /api/attendance/regularization error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to create regularization request.",
      },
      { status: 500 }
    );
  }
}