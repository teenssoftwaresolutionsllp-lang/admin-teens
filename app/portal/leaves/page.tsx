import { redirect } from "next/navigation";

import EmployeeLeavesView from "@/components/portal/EmployeeLeavesView";
import { DataStore } from "@/lib/data-store";
import { createClient } from "@/lib/supabase-server";

interface EmployeeLeavesPageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

export default async function EmployeeLeavesPage({
  searchParams,
}: EmployeeLeavesPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let employee = await DataStore.getEmployeeByUserId(user.id);

  if (!employee && user.email) {
    const employees = await DataStore.getEmployees();
    const loginEmail = user.email.trim().toLowerCase();

    employee =
      employees.find(
        (item) => item.email?.trim().toLowerCase() === loginEmail
      ) || null;
  }

  if (!employee) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Employee not found. Please contact HR to link your account.
      </div>
    );
  }

  const [projects, leaveBalances, leaveRequests, leaveTypes] =
    await Promise.all([
      DataStore.getProjects(),
      DataStore.getLeaveBalances(employee.id),
      DataStore.getLeaveRequests(employee.id),
      DataStore.getLeaveTypes(),
    ]);

  const project =
    employee.project ||
    projects.find((item) => item.id === employee.project_id) ||
    projects[0];

  if (!project) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        No project is configured for your account.
      </div>
    );
  }

  const { view } = await searchParams;

  return (
    <EmployeeLeavesView
      employee={employee}
      project={project}
      leaveBalances={leaveBalances}
      leaveRequests={leaveRequests}
      leaveTypes={leaveTypes}
      mode={view === "apply" ? "apply" : "my-leaves"}
    />
  );
}
