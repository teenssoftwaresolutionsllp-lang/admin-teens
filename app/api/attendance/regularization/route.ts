import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { createClient } from "@/lib/supabase-server";
import {
  getAuthFailureStatus,
  getAuthFailureMessage,
} from "@/lib/supabase-auth-error";

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const status = getAuthFailureStatus(error);

    return {
      user: null,
      response: NextResponse.json(
        { error: getAuthFailureMessage(status) },
        { status }
      ),
    };
  }

  return { user, response: null };
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();

    if (auth.response) return auth.response;

    const requests = await DataStore.getAttendanceRegularizations();

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Attendance regularization GET error:", error);

    return NextResponse.json(
      { error: "Unable to fetch attendance regularization requests." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUser();

    if (auth.response) return auth.response;

    const body = await request.json();

    const {
      employeeId,
      attendanceDate,
      proposedCheckIn,
      proposedCheckOut,
      reason,
    } = body;

    if (
      !employeeId ||
      !attendanceDate ||
      !proposedCheckIn ||
      !proposedCheckOut ||
      !reason
    ) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const reg = await DataStore.createAttendanceRegularization({
      employeeId,
      attendanceDate,
      proposedCheckIn,
      proposedCheckOut,
      reason,
    });

    return NextResponse.json(
      { success: true, regularization: reg },
      { status: 201 }
    );
  } catch (error) {
    console.error("Attendance regularization POST error:", error);

    return NextResponse.json(
      { error: "Unable to create attendance regularization request." },
      { status: 500 }
    );
  }
}