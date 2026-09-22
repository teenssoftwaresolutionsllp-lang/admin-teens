import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employeeId, action } = await request.json();

    if (!employeeId || !action) {
      return NextResponse.json({ error: 'Missing employeeId or action' }, { status: 400 });
    }

    let log;
    if (action === 'in') {
      log = await DataStore.clockIn(employeeId);
    } else if (action === 'out') {
      log = await DataStore.clockOut(employeeId);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    console.error('Punch API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
