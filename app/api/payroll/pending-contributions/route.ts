import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(request: Request) {
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

    // Only HR and CEO can view statutory pending amounts.
    const adminSupabase = await createAdminClient();

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !["hr", "ceo"].includes(profile?.role || "")) {
      return NextResponse.json(
        { error: "You are not authorized to view pending contributions." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get("employeeId");
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    if (
      !employeeId ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(year)
    ) {
      return NextResponse.json(
        { error: "Invalid employee or payroll period." },
        { status: 400 }
      );
    }

    // Calculate the immediately previous payroll month.
    const previousDate = new Date(year, month - 2, 1);
    const previousMonth = previousDate.getMonth() + 1;
    const previousYear = previousDate.getFullYear();

    const { data: payslip, error } = await adminSupabase
      .from("payslips")
      .select(`
        employee_id,
        payroll_month,
        payroll_year,
        pf_eligible_amount,
        pf_deducted_amount,
        pf_pending_amount,
        esi_eligible_amount,
        esi_deducted_amount,
        esi_pending_amount
      `)
      .eq("employee_id", employeeId)
      .eq("payroll_month", previousMonth)
      .eq("payroll_year", previousYear)
      .maybeSingle();

    if (error) {
      console.error("Pending contribution lookup failed:", error);

      return NextResponse.json(
        { error: "Failed to fetch pending contributions." },
        { status: 500 }
      );
    }

    const pfPending = Number(payslip?.pf_pending_amount || 0);
    const esiPending = Number(payslip?.esi_pending_amount || 0);

    return NextResponse.json({
      hasPending: pfPending > 0 || esiPending > 0,
      employeeId,
      previousMonth,
      previousYear,
      previousMonthName: monthNames[previousMonth - 1],
      pf: {
        eligible: Number(payslip?.pf_eligible_amount || 0),
        deducted: Number(payslip?.pf_deducted_amount || 0),
        pending: pfPending,
      },
      esi: {
        eligible: Number(payslip?.esi_eligible_amount || 0),
        deducted: Number(payslip?.esi_deducted_amount || 0),
        pending: esiPending,
      },
      totalPending: Number((pfPending + esiPending).toFixed(2)),
    });
  } catch (error) {
    console.error("Pending contributions API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}