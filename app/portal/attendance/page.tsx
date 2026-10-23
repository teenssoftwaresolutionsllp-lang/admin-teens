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

  // First, find the employee using the logged-in Supabase user ID.
  let employee = await DataStore.getEmployeeByUserId(user.id);

  // Fallback: match the employee email without case or whitespace differences.
  if (!employee && user.email) {
    const allEmployees = await DataStore.getEmployees();

    const loginEmail = user.email.trim().toLowerCase();

    employee =
      allEmployees.find(
        (item) =>
          item.email?.trim().toLowerCase() === loginEmail
      ) || null;
  }

  // Show an error only if both lookups fail.
  if (!employee) {
    return (
      <div className="p-8 text-center text-slate-500">
        Employee not found. Please contact HR to link your account.
      </div>
    );
  }

  const [projects, calendars] = await Promise.all([
    DataStore.getProjects(),
    DataStore.getHolidayCalendars(),
  ]);

  const baseProject =
    employee.project ||
    projects.find((project) => project.id === employee.project_id) ||
    projects[0];

  if (!baseProject) {
    return (
      <div className="p-8 text-center text-slate-500">
        No project or holiday calendar is configured.
      </div>
    );
  }

  const calendar = calendars.find(
    (item) => item.id === baseProject.calendar_id
  );

  const project = {
    ...baseProject,
    calendar: calendar || baseProject.calendar,
  };

  const [
    todayLog,
    historyLogs,
    allRegs,
    leaveRequests,
    leaveBalances,
    leaveTypes,
  ] = await Promise.all([
    DataStore.getTodayAttendance(employee.id),
    DataStore.getAttendanceLogs(employee.id),
    DataStore.getAttendanceRegularizations(),
    DataStore.getLeaveRequests(employee.id),
    DataStore.getLeaveBalances(employee.id),
    DataStore.getLeaveTypes(),
  ]);

  const regularizations = allRegs.filter(
    (request) => request.employee_id === employee.id
  );

  return (
    <EmployeeAttendanceView
      employee={employee}
      project={project}
      todayLog={todayLog}
      historyLogs={historyLogs}
      regularizations={regularizations}
      leaveRequests={leaveRequests}
      leaveBalances={leaveBalances}
      leaveTypes={leaveTypes}
    />
  );
}