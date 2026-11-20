import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";
import { Payslip, Employee } from "@/lib/types";

// Employer-paid amounts must never appear in employee payslip data.
function isEmployerContribution(
  key: string,
  value: unknown
): boolean {
  const v = value as Record<string, unknown> | null | undefined;
  const text = [
    key,
    v?.name,
    v?.component_name,
    v?.code,
    v?.component_code,
    v?.type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

  return (
    text.includes("employer_contribution") ||
    text.includes("employer_pf") ||
    text.includes("employer_esi") ||
    text.includes("pf_admin") ||
    text.includes("gratuity_provision") ||
    text.includes("employer_gratuity")
  );
}

// Supports both array-based and object-based breakup formats.
function filterEmployeeBreakup(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter(
      (item) => !isEmployerContribution("", item)
    );
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key, amount]) =>
          !isEmployerContribution(key, amount)
      )
    );
  }

  return value;
}

function sanitizeEmployeePayslip(payslip: Payslip) {
  const {
    employer_pf,
    employer_esi,
    pf_admin,
    gratuity_provision,
    earnings_breakup,
    deductions_breakup,
    ...safePayslip
  } = payslip;

  return {
    ...safePayslip,
    earnings_breakup: filterEmployeeBreakup(earnings_breakup),
    deductions_breakup: filterEmployeeBreakup(deductions_breakup),
  };
}

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

    const adminClient = await createAdminClient();

    // Read the authenticated user's actual database role.
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Payslip role lookup failed:", profileError);
      return NextResponse.json(
        { error: "Unable to verify access" },
        { status: 500 }
      );
    }

    const role = String(profile?.role || "").toLowerCase();
    const isAdmin = role === "hr" || role === "ceo";

    const payslip = await DataStore.getPayslipById(id);

    if (!payslip) {
      return NextResponse.json(
        { error: "Payslip not found" },
        { status: 404 }
      );
    }

    let employee: Partial<Employee> | null = null;

    if (isAdmin) {
      // Preserve the existing HR/CEO employee details.
      employee = payslip.employee || null;

      if (!employee && payslip.employee_id) {
        employee =
          (await DataStore.getEmployeeById(payslip.employee_id)) ??
          null;
      }
    } else {
      // Employees must have an exact user_id ownership match.
      const { data: ownEmployee, error: employeeError } =
        await adminClient
          .from("employees")
          .select(`
            id,
            user_id,
            employee_id,
            first_name,
            last_name,
            designation,
            bank_name,
            bank_account_number,
            ifsc_code,
            uan_number,
            esi_number,
            pan_number
          `)
          .eq("user_id", user.id)
          .maybeSingle();

      if (employeeError) {
        console.error("Payslip employee lookup failed:", employeeError);
        return NextResponse.json(
          { error: "Unable to verify payslip ownership" },
          { status: 500 }
        );
      }

      // Return 404 rather than revealing another employee's payslip.
      if (!ownEmployee || ownEmployee.id !== payslip.employee_id) {
        return NextResponse.json(
          { error: "Payslip not found" },
          { status: 404 }
        );
      }

      employee = {
        employee_id: ownEmployee.employee_id,
        first_name: ownEmployee.first_name,
        last_name: ownEmployee.last_name,
        designation: ownEmployee.designation,
        bank_name: ownEmployee.bank_name,
        bank_account_number: ownEmployee.bank_account_number,
        ifsc_code: ownEmployee.ifsc_code,
        uan_number: ownEmployee.uan_number,
        esi_number: ownEmployee.esi_number,
        pan_number: ownEmployee.pan_number,
      };
    }

    // Only load YTD records after access to this payslip is authorized.
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
      ytd.totalEarnings += Number(slip.total_earnings || 0);
      ytd.totalDeductions += Number(slip.total_deductions || 0);
      ytd.netSalary += Number(slip.net_salary || 0);
      ytd.lopDeduction += Number(slip.lop_deduction || 0);

      const earnings = (isAdmin
        ? slip.earnings_breakup || {}
        : filterEmployeeBreakup(slip.earnings_breakup || {})) as Record<string, unknown>;

      for (const [key, value] of Object.entries(earnings)) {
        ytd.earnings[key] =
          (ytd.earnings[key] || 0) + Number(value || 0);
      }

      const deductions = (isAdmin
        ? slip.deductions_breakup || {}
        : filterEmployeeBreakup(slip.deductions_breakup || {})) as Record<string, unknown>;

      for (const [key, value] of Object.entries(deductions)) {
        ytd.deductions[key] =
          (ytd.deductions[key] || 0) + Number(value || 0);
      }
    }

    const responsePayslip = isAdmin
      ? payslip
      : sanitizeEmployeePayslip(payslip);

    return NextResponse.json({
      success: true,
      payslip: responsePayslip,
      payroll: responsePayslip,
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
