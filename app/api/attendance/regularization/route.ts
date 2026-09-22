import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requests = await DataStore.getAttendanceRegularizations();
    return NextResponse.json(requests);
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
    const { employeeId, attendanceDate, proposedCheckIn, proposedCheckOut, reason } = body;

    if (!employeeId || !attendanceDate || !proposedCheckIn || !proposedCheckOut || !reason) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const reg = await DataStore.createAttendanceRegularization({
      employeeId,
      attendanceDate,
      proposedCheckIn,
      proposedCheckOut,
      reason,
    });

    return NextResponse.json({ success: true, regularization: reg }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
