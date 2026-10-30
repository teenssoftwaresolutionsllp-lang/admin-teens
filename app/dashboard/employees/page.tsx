import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import { redirect } from "next/navigation";
import EmployeeTable from "@/components/EmployeeTable";
import JoiningEmployeesView from "@/components/admin/JoiningEmployeesView";

type EmployeesPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

const statusOptions: Record<string, string> = {
  joining: "Joining",
  terminated: "Terminated",
  laid_off: "Layoff",
  notice_period: "Notice Period",
  notice_completed: "Notice Completed",
  early_release: "Early Release",
};

export default async function EmployeesPage({
  searchParams,
}: EmployeesPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role =
    profile?.role || user.user_metadata?.role || "hr";

  const params = await searchParams;
  const selectedStatus = params.status?.toLowerCase();

  const employees = await DataStore.getEmployees();

  if (selectedStatus === "joining") {
    return (
      <div className="flex-1 space-y-6 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Joining
          </h1>
        </div>

        <JoiningEmployeesView />
      </div>
    );
  }

  const adminClient = await createAdminClient();

  const { data: dbDepartments, error: departmentsError } = await adminClient
    .from("departments")
    .select("id, name, description, created_at")
    .order("name", { ascending: true });

  if (departmentsError) {
    console.error("Failed to load departments:", departmentsError);
  }

  const departments = dbDepartments ?? [];

  // Apply a filter only when a recognized status is selected.
  // The employee status field must match the corresponding key.


  const filteredEmployees = selectedStatus? employees.filter((employee) => {
        const employeeStatus = String(employee.status ?? "")
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_");

        const emp = employee as typeof employee & {
          notice_status?: string | null;
          planned_last_working_date?: string | null;
        };

        const noticeStatus = String(emp.notice_status ?? "")
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_");

        if (
          !Object.prototype.hasOwnProperty.call(statusOptions, selectedStatus)
        ) {
          return false;
        }

        if (selectedStatus === "notice_period") {
          return (
            employeeStatus === "on_notice" &&
            noticeStatus !== "notice_completed" &&
            noticeStatus !== "early_release" &&
            (
              !emp.planned_last_working_date ||
              emp.planned_last_working_date >=
                new Date().toISOString().slice(0, 10)
            )
          );
        }
        if (selectedStatus === "notice_completed") {
          return noticeStatus === "notice_completed";
        }

        if (selectedStatus === "early_release") {
          return noticeStatus === "early_release";
        }

        if (selectedStatus === "laid_off") {
          return employeeStatus === "laid_off";
        }

        if (selectedStatus === "terminated") {
          return employeeStatus === "terminated";
        }

        if (selectedStatus === "resigned") {
          return (
            employeeStatus === "resigned" &&
            noticeStatus !== "notice_completed" &&
            noticeStatus !== "early_release"
          );
        }

        return employeeStatus === selectedStatus;
      })
    : employees;

  const pageTitle =
    selectedStatus && statusOptions[selectedStatus]
      ? statusOptions[selectedStatus]
      : "All Employees";

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {pageTitle}
          </h1>

          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-semibold text-indigo-700">
            {filteredEmployees.length}
          </span>
        </div>
      </div>

      <EmployeeTable
        employees={filteredEmployees}
        departments={departments}
        role={role}
      />
    </div>
  );
}
