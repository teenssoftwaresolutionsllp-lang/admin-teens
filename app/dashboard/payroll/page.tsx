import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import PayrollManager from "@/components/admin/PayrollManager";
import { redirect } from "next/navigation";

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const components = await DataStore.getSalaryComponents();
  const payslips = await DataStore.getPayslips();
  const employees = await DataStore.getEmployees();

  return (
    <PayrollManager
      initialComponents={components}
      initialPayslips={payslips}
      employees={employees}
    />
  );
}
