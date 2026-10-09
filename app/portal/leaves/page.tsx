import { createClient } from "@/lib/supabase-server";
import { connection } from "next/server";
import { DataStore } from "@/lib/data-store";
import EmployeeLeavesView from "@/components/portal/EmployeeLeavesView";
import { redirect } from "next/navigation";
  
export default async function EmployeeLeavesPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let employee = await DataStore.getEmployeeByUserId(user.id);

  if (!employee && user.email) {
    const all = await DataStore.getEmployees();
    employee = all.find((e) => e.email?.trim().toLowerCase() === user.email!.trim().toLowerCase()) ?? null;
  }


  if (!employee) {
    return (
      <div className="p-8 text-center text-slate-500">
        Employee record not found. Please contact HR.
      </div>
    );
  }

  const project = employee.project || (await DataStore.getProjects())[0];
  const leaveBalances = await DataStore.getLeaveBalances(employee.id);
  console.log("PORTAL LEAVE DEBUG:", {
    loggedInUser: user.email,
    employeeId: employee.id,
    employeeCode: employee.employee_id,
    balances: leaveBalances.map((b) => ({
      year: b.year,
      leaveType: b.leave_type?.code,
      allocated: b.allocated_days,
      used: b.used_days,
      remaining: b.balance_days,
    })),
  });
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
