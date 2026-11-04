import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';


export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {data: { user }} = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || undefined;

    // Fetch leave requests and leave types.
    const requests = await DataStore.getLeaveRequests(employeeId);
    const leaveTypes = await DataStore.getLeaveTypes();

    // Fetch employee leave balances.
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
  } catch (error: any) {
    console.error("GET /api/leaves error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to load leave information",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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
      leaveDuration,
      reason,
    } = body;

    if (!employeeId || !leaveTypeId || !startDate || !endDate || totalDays === undefined || totalDays === null) {
      return NextResponse.json(
        { error: 'Missing required leave fields' },
        { status: 400 }
      );
    }

    // Validate half-day leave selection.
    if (isHalfDay) {
      if (startDate !== endDate) {
        return NextResponse.json(
          { error: 'Half-day leave must be for a single date.' },
          { status: 400 }
        );
      }

      if (Number(totalDays) !== 0.5) {
        return NextResponse.json(
          { error: 'Half-day leave must have a total of 0.5 days.' },
          { status: 400 }
        );
      }

      if (!['first_half', 'second_half'].includes(leaveDuration)) {
        return NextResponse.json(
          { error: 'Please select First Half or Second Half.' },
          { status: 400 }
        );
      }
    }

    const leaveReq = await DataStore.createLeaveRequest({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      totalDays: Number(totalDays),
      isHalfDay: Boolean(isHalfDay),
      leaveDuration: isHalfDay ? leaveDuration : null,
      reason: reason || 'Personal Leave',
    });

    return NextResponse.json(
      { success: true, leaveRequest: leaveReq },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/leaves error:', error);

    return NextResponse.json(
      { error: error?.message || 'Failed to submit leave request' },
      { status: 500 }
    );
  }
}
