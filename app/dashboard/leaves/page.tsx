import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import LeaveManager from "@/components/admin/LeaveManager";
import { redirect } from "next/navigation";

export default async function AdminLeavesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const leaveTypes = await DataStore.getLeaveTypes();
  const leaveRequests = await DataStore.getLeaveRequests();
  const employees = await DataStore.getEmployees();
  const leaveBalances = ( await Promise.all(
    employees.map((employee) => DataStore.getLeaveBalances(employee.id)))
  ).flat();
  return (
    <LeaveManager
      leaveTypes={leaveTypes}
      leaveRequests={leaveRequests}
      employees={employees}
      leaveBalances={leaveBalances}
    />
  );
}
