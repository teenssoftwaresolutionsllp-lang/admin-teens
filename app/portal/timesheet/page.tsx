import { redirect } from "next/navigation";
import TimesheetView from "@/components/portal/TimesheetView";
import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function EmployeeTimesheetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let employee = await DataStore.getEmployeeByUserId(user.id);

  if (!employee && user.email) {
    const allEmployees = await DataStore.getEmployees();
    const loginEmail = user.email.trim().toLowerCase();

    employee =
      allEmployees.find(
        (item) => item.email?.trim().toLowerCase() === loginEmail
      ) || null;
  }

  if (!employee) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Employee not found. Please contact HR to link your account.
      </div>
    );
  }

  const projects = await DataStore.getProjects();
  const employeeProjects = projects.filter(
    (project) =>
      project.id === employee.project_id ||
      project.id === employee.retained_project_id
  );

  return (
    <TimesheetView employeeId={employee.id} projects={employeeProjects} />
  );
}
