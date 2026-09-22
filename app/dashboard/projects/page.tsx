import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import ProjectsManager from "@/components/admin/ProjectsManager";
import { redirect } from "next/navigation";

export default async function AdminProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const projects = await DataStore.getProjects();
  const calendars = await DataStore.getHolidayCalendars();
  const employees = await DataStore.getEmployees();

  return (
    <ProjectsManager
      initialProjects={projects}
      calendars={calendars}
      employees={employees}
    />
  );
}
