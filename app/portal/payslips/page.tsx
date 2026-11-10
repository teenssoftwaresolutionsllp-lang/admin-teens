import { createClient, createAdminClient } from "@/lib/supabase-server";
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
  const payslips = rawPayslips.map((slip) => {
    const {
      employer_pf,
      employer_esi,
      pf_admin,
      gratuity_provision,
      employee: _fullEmployee,
      ...safeSlip
    } = slip;

    return {
      ...safeSlip,
      employee: undefined,
    };
  });

  // Pass only the fields required by the employee payslip view.
  const safeEmployee = {
    id: employee.id,
    employee_id: employee.employee_id,
    first_name: employee.first_name,
    last_name: employee.last_name,
    designation: employee.designation,
    bank_name: employee.bank_name,
    bank_account_number: employee.bank_account_number,
    ifsc_code: employee.ifsc_code,
    uan_number: employee.uan_number,
    esi_number: employee.esi_number,
    pan_number: employee.pan_number,
  };

  return (
    <EmployeePayslipsView
      employee={safeEmployee as any}
      payslips={payslips}
    />
  );
}
