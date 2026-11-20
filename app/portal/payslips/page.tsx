import { createClient, createAdminClient } from "@/lib/supabase-server";
import { Employee } from "@/lib/types";
import { DataStore } from "@/lib/data-store";
import EmployeePayslipsView from "@/components/portal/EmployeePayslipsView";
import { redirect } from "next/navigation";

export default async function EmployeePayslipsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Use an exact user_id match. Never fall back to email or another employee.
  const adminClient = await createAdminClient();

  const { data: employee, error: employeeError } = await adminClient
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
    console.error("Failed to load employee payslip profile:", employeeError);
    return <div>Unable to load your payslips. Please try again later.</div>;
  }

  if (!employee) {
    return <div>Employee record not found for this account.</div>;
  }

  // Fetch payslips only after confirming exact employee ownership.
  const rawPayslips = await DataStore.getPayslips(employee.id);

  // Never send employer-paid contributions or full employee records
  // to the employee's browser.
  const excludedPayslipFields = new Set([
    "employer_pf",
    "employer_esi",
    "pf_admin",
    "gratuity_provision",
    "employee",
  ]);

  const payslips = rawPayslips.map((slip) =>
    Object.fromEntries(
      Object.entries(slip).filter(
        ([key]) => !excludedPayslipFields.has(key)
      )
    ) as Omit<
      typeof slip,
      | "employer_pf"
      | "employer_esi"
      | "pf_admin"
      | "gratuity_provision"
      | "employee"
    >
  );

  return (
    <EmployeePayslipsView
      employee={employee as unknown as Employee}
      payslips={payslips}
    />
  );
}
