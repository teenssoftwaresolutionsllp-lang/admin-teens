import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeLeavesView from "@/components/portal/EmployeeLeavesView";
import { redirect } from "next/navigation";

export default async function EmployeeLeavesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let employee = await DataStore.getEmployeeByUserId(user.id);
  if (!employee) {
    const all = await DataStore.getEmployees();
    employee = all.find(e => e.email === user.email) || all[0];
  }

  if (!employee) return <div className="p-8 text-center text-slate-500">Employee not found.</div>;

  const project = employee.project || (await DataStore.getProjects())[0];
  const leaveBalances = await DataStore.getLeaveBalances(employee.id);
  const leaveRequests = await DataStore.getLeaveRequests(employee.id);
  const leaveTypes = await DataStore.getLeaveTypes();

  return (
    <EmployeeLeavesView
      employee={employee}
      project={project}
      leaveBalances={leaveBalances}
      leaveRequests={leaveRequests}
      leaveTypes={leaveTypes}
    />
  );
}
