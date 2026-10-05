import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { createClient } from "@/lib/supabase-server";
import { Payslip } from "@/lib/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Payslip ID is required" },
        { status: 400 }
      );
    }

    const payslip = await DataStore.getPayslipById(id);

    if (!payslip) {
      return NextResponse.json(
        { error: "Payslip not found" },
        { status: 404 }
      );
    }

    let employee = payslip.employee;

    if (!employee && payslip.employee_id) {
      employee =
        (await DataStore.getEmployeeById(payslip.employee_id)) ??
        undefined;
    }

    // Explicitly type the array
    let ytdPayslips: Payslip[] = [];

    if (payslip.employee_id) {
      ytdPayslips = await DataStore.getPayslips(
        payslip.employee_id,
        undefined,
        payslip.payroll_year
      );
    }

    const ytd = {
      earnings: {} as Record<string, number>,
      deductions: {} as Record<string, number>,
      grossSalary: 0,
      totalEarnings: 0,
      totalDeductions: 0,
      netSalary: 0,
      lopDeduction: 0,
    };

    for (const slip of ytdPayslips) {
      if (slip.payroll_month > payslip.payroll_month) {
        continue;
      }

      ytd.grossSalary += Number(slip.gross_salary || 0);

      ytd.totalEarnings += Number(
        slip.total_earnings || 0
      );

      ytd.totalDeductions += Number(
        slip.total_deductions || 0
      );

      ytd.netSalary += Number(
        slip.net_salary || 0
      );

      ytd.lopDeduction += Number(
        slip.lop_deduction || 0
      );

      const earnings =
        slip.earnings_breakup || {};

      for (const [key, value] of Object.entries(
        earnings
      )) {
        ytd.earnings[key] =
          (ytd.earnings[key] || 0) +
          Number(value || 0);
      }

      const deductions =
        slip.deductions_breakup || {};

      for (const [key, value] of Object.entries(
        deductions
      )) {
        ytd.deductions[key] =
          (ytd.deductions[key] || 0) +
          Number(value || 0);
      }
    }

    return NextResponse.json({
      success: true,
      payslip,
      employee,
      ytd,
    });
  } catch (error: unknown) {
    console.error("Payslip API error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load payslip";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

