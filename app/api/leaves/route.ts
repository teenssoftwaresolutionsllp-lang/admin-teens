import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId') || undefined;

    const requests = await DataStore.getLeaveRequests(employeeId);
    const leaveTypes = await DataStore.getLeaveTypes();

    return NextResponse.json({ requests, leaveTypes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { employeeId, leaveTypeId, startDate, endDate, totalDays, isHalfDay, reason } = body;

    if (!employeeId || !leaveTypeId || !startDate || !endDate || !totalDays) {
      return NextResponse.json({ error: 'Missing required leave fields' }, { status: 400 });
    }

    const leaveReq = await DataStore.createLeaveRequest({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      totalDays: Number(totalDays),
      isHalfDay: Boolean(isHalfDay),
      reason: reason || 'Personal Leave',
    });

    return NextResponse.json({ success: true, leaveRequest: leaveReq }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
