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
  // Resolve the employee's actual project context.
  // Assigned project takes priority over retained bench settings.
  const assignedProject =
    projects.find(
      (item) => item.id === employee.project_id
    ) || employee.project || null;

  const retainedProject = employee.retained_project_id
    ? projects.find(
        (item) => item.id === employee.retained_project_id
      ) || null
    : null;

  // Compatibility fallback for existing bench employees
  // whose retained_project_id has not yet been populated.
  const retainedCalendarProject =
    !assignedProject && !retainedProject && employee.retained_calendar_id
      ? projects.find(
          (item) =>
            item.calendar_id === employee.retained_calendar_id
        ) || null
      : null;

  const baseProject =
    assignedProject ||
    retainedProject ||
    retainedCalendarProject;

  if (!baseProject) {
    return (
      <div className="p-8 text-center text-slate-500">
        No assigned or retained project/holiday calendar is configured.
        Please contact HR.
      </div>
    );
  }

  const isUsingRetainedSettings = !assignedProject;

  const calendarId = isUsingRetainedSettings
    ? employee.retained_calendar_id || baseProject.calendar_id
    : baseProject.calendar_id;

  const calendar = calendars.find(
    (item) => item.id === calendarId
  );

  const project = {
    ...baseProject,

    // Preserve retained bench shift settings.
    ...(isUsingRetainedSettings
      ? {
          shift_start_time:
            employee.retained_shift_start_time ||
            baseProject.shift_start_time,

          shift_end_time:
            employee.retained_shift_end_time ||
            baseProject.shift_end_time,

          grace_period_minutes:
            employee.retained_grace_period_minutes ??
            baseProject.grace_period_minutes,

          half_day_cutoff_minutes:
            employee.retained_half_day_cutoff_minutes ??
            baseProject.half_day_cutoff_minutes,
        }
      : {}),

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