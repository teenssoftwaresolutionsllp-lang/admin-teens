import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeAttendanceView from "@/components/portal/EmployeeAttendanceView";
import { redirect } from "next/navigation";

export default async function EmployeeAttendancePage() {
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
  const todayLog = await DataStore.getTodayAttendance(employee.id);
  const historyLogs = await DataStore.getAttendanceLogs(employee.id);
  const allRegs = await DataStore.getAttendanceRegularizations();
  const regularizations = allRegs.filter(r => r.employee_id === employee.id);

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
