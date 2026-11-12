import { createClient, createAdminClient } from "@/lib/supabase-server";
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

  const admin = await createAdminClient();
  const holidayCalendars = await DataStore.getHolidayCalendars();

  const { data: attendanceLogs, error: attendanceError } = await admin
    .from("attendance_logs")
    .select("*")
    .order("attendance_date", { ascending: false });

  if (attendanceError) {
    console.error("Attendance records loading failed:", attendanceError);
    throw new Error("Unable to load attendance records.");
  }

  const logs = (attendanceLogs ?? []) as AttendanceLog[];

  // Fetch approved leaves with their leave type codes.
  const { data: approvedLeaves, error: leaveError } = await admin
    .from("leave_requests")
    .select(`
      id,
      employee_id,
      start_date,
      end_date,
      total_days,
      is_half_day,
      leave_duration,
      leave_type:leave_types (
        id,
        name,
        code
      )
    `)
    .eq("status", "approved");

  if (leaveError) {
    console.error("Approved leave loading failed:", leaveError);
    throw new Error("Unable to load approved leave records.");
  }

  // Fetch individual employee attendance settings.
  const { data: attendanceSettings, error: settingsError } = await admin
    .from("attendance_settings")
    .select(`
      setting_key,
      employee_id,
      count_approved_leaves_toward_weekly_minimum,
      updated_by,
      updated_at
    `);

  if (settingsError) {
    console.error("Attendance settings loading failed:", settingsError);
    throw new Error("Unable to load attendance settings.");
  }

  const globalAttendanceSetting =
  (attendanceSettings ?? []).find(
    (setting) => setting.setting_key === "global"
  ) ?? null;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile role loading failed:", profileError);
    throw new Error("Unable to load user permissions.");
  }

  const canManageAttendanceSettings =
    profile?.role === "hr" || profile?.role === "ceo";

  const employees = await DataStore.getEmployees();
  const projects = await DataStore.getProjects();

  return (
    <>
      <AttendanceManager
        logs={logs}
        employees={employees}
        projects={projects}
        approvedLeaves={approvedLeaves ?? []}
        attendanceSettings={attendanceSettings ?? []}
        globalAttendanceSetting={globalAttendanceSetting}
        holidayCalendars={holidayCalendars}
        canManageAttendanceSettings={canManageAttendanceSettings}
      />

    </>
  );
}
