
import { redirect } from "next/navigation";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import ProjectsManager from "@/components/admin/ProjectsManager";
import type { EmergencyHoliday } from "@/lib/types";

export default async function AdminProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = await createAdminClient();

  const [
    projects,
    calendars,
    employees,
    profileResult,
    holidaysResult,
    departmentsResult,
  ] = await Promise.all([
    DataStore.getProjects(),
    DataStore.getHolidayCalendars(),
    DataStore.getEmployees(),
    admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("holidays")
      .select(
        "id, holiday_date, title, reason, scope, project_id, holiday_type, status, created_at"
      )
      .eq("holiday_type", "emergency")
      .order("holiday_date", { ascending: false }),
      admin
        .from("departments")
        .select("id, name")
        .order("name"),
  ]);

  if (holidaysResult.error) {
    console.error(
      "Unable to load emergency holidays:",
      holidaysResult.error.message
    );
  }

  const role = String(
    profileResult.data?.role || user.user_metadata?.role || "hr"
  ).toLowerCase();

  return (
    <ProjectsManager
      initialProjects={projects}
      calendars={calendars}
      departments={departmentsResult.data ?? []}
      employees={employees}
      emergencyHolidays={
        (holidaysResult.data || []) as unknown as EmergencyHoliday[]
      }
      canManageEmergencyHolidays={
        !profileResult.error && ["hr", "ceo"].includes(role)
      }
      role={role}
    />
  );
}
