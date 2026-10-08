import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeAttendanceView from "@/components/portal/EmployeeAttendanceView";
import { redirect } from "next/navigation";

export default async function EmployeeAttendancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ------------------------------------------------------------
  // FIND EMPLOYEE
  // ------------------------------------------------------------

  let employee = await DataStore.getEmployeeByUserId(user.id);

  if (!employee) {
    const allEmployees = await DataStore.getEmployees();

    employee =
      allEmployees.find(
        (e) =>
          e.email?.toLowerCase() === user.email?.toLowerCase()
      ) || allEmployees[0] || null;
  }

  if (!employee) {
    return (
      <div className="p-8 text-center text-slate-500">
        Employee not found.
      </div>
    );
  }

  // ------------------------------------------------------------
  // LOAD DATA IN PARALLEL
  // ------------------------------------------------------------
  //
  // These requests do not depend on each other, so there is
  // no reason to wait for one before starting the next.
  //
  const [
    todayLog,
    historyLogs,
    allRegs,
    projects,
  ] = await Promise.all([
    DataStore.getTodayAttendance(employee.id),
    DataStore.getAttendanceLogs(employee.id),
    DataStore.getAttendanceRegularizations(),
    employee.project
      ? Promise.resolve([])
      : DataStore.getProjects(),
  ]);

  // ------------------------------------------------------------
  // PROJECT
  // ------------------------------------------------------------

  const project =
    employee.project ||
    projects[0] ||
    null;

  // ------------------------------------------------------------
  // REGULARIZATIONS FOR THIS EMPLOYEE ONLY
  // ------------------------------------------------------------

  const regularizations = allRegs.filter(
    (r) => r.employee_id === employee.id
  );

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------

  return (
    <EmployeeAttendanceView
      employee={employee}
      project={project}
      todayLog={todayLog}
      historyLogs={historyLogs}
      regularizations={regularizations}
    />
  );
}