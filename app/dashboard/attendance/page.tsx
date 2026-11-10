
import {createClient,createAdminClient} from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import AttendanceManager from "@/components/admin/AttendanceManager";
import { redirect } from "next/navigation";
import type { AttendanceLog } from "@/lib/types";

export default async function AdminAttendancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch attendance records directly from Supabase.
  // This includes the new HR decision audit columns.
  const admin = await createAdminClient();

  const { data: attendanceLogs, error: attendanceError } = await admin
    .from("attendance_logs")
    .select("*")
    .order("attendance_date", { ascending: false });

  if (attendanceError) {
    console.error("Attendance records loading failed:", attendanceError);
    throw new Error("Unable to load attendance records.");
  }

  const logs = (attendanceLogs ?? []) as AttendanceLog[];

  // Keep existing employee and project loading unchanged.
  const employees = await DataStore.getEmployees();
  const projects = await DataStore.getProjects();

  return (
    <AttendanceManager
      logs={logs}
      employees={employees}
      projects={projects}
    />
  );
}
