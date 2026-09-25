import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeProfileView from "@/components/portal/EmployeeProfileView";
import { redirect } from "next/navigation";

export default async function EmployeeProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let employee = await DataStore.getEmployeeByUserId(user.id);
  if (!employee) {
    const all = await DataStore.getEmployees();
    employee = all.find(e => e.email === user.email) || all[0];
  }

  if (!employee) {
    return <div className="p-8 text-center text-slate-500">Employee record not found.</div>;
  }

  const changeRequests = await DataStore.getProfileChangeRequests();
  const pendingRequest = changeRequests.find(
    r => r.employee_id === employee?.id && r.status === "pending"
  ) || null;
  const { data: departmentRows } = await supabase.from("departments").select("*").order("name");
  const departments = departmentRows || [];

  return <EmployeeProfileView employee={employee} pendingRequest={pendingRequest} departments={departments} />;
}
