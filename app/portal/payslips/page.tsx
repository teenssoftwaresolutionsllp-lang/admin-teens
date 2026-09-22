import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeePayslipsView from "@/components/portal/EmployeePayslipsView";
import { redirect } from "next/navigation";

export default async function EmployeePayslipsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let employee = await DataStore.getEmployeeByUserId(user.id);
  if (!employee) {
    const all = await DataStore.getEmployees();
    employee = all.find(e => e.email === user.email) || all[0];
  }

  if (!employee) return <div className="p-8 text-center text-slate-500">Employee not found.</div>;

  const payslips = await DataStore.getPayslips(employee.id);

  return <EmployeePayslipsView employee={employee} payslips={payslips} />;
}
