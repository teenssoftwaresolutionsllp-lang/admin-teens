import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import AttendanceManager from "@/components/admin/AttendanceManager";
import { redirect } from "next/navigation";

export default async function AdminAttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const logs = await DataStore.getAttendanceLogs();
  const employees = await DataStore.getEmployees();
  const projects = await DataStore.getProjects();

  return <AttendanceManager logs={logs} employees={employees} projects={projects} />;
}
