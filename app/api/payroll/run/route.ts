import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { employeeId, month, year } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: "Please select an employee" },
        { status: 400 }
      );
    }

    const payrollMonth = Number(month);
    const payrollYear = Number(year);

    if (!Number.isInteger(payrollMonth) ||payrollMonth < 1 ||payrollMonth > 12) {
      return NextResponse.json(
        { error: "Invalid payroll month" },
        { status: 400 }
      );
    }
    if (!Number.isInteger(payrollYear)) {
      return NextResponse.json(
        { error: "Invalid payroll year" },
        { status: 400 }
      );
    }

    const now = new Date();

    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const requestedPeriod = payrollYear * 12 + payrollMonth;
    const currentPeriod = currentYear * 12 + currentMonth;

    if (requestedPeriod > currentPeriod) {
      return NextResponse.json(
        {
          error: "Payroll cannot be generated for a future month.",
        },
        { status: 400 }
      );
    }
    
    const result = await DataStore.generateMonthlyPayroll({
      employeeId,
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
