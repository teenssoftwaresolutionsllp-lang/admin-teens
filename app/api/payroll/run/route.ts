import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { month, year } = body;

    const result = await DataStore.generateMonthlyPayroll({
      month: Number(month) || new Date().getMonth() + 1,
      year: Number(year) || new Date().getFullYear(),
    });

    return NextResponse.json({
      success: true,
      generatedCount: result.generatedCount,
      payslips: result.payslips,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
