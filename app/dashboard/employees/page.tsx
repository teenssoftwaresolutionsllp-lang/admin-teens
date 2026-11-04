import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import { redirect } from "next/navigation";
import EmployeeTable from "@/components/EmployeeTable";
import JoiningEmployeesView from "@/components/admin/JoiningEmployeesView";

type EmployeesPageProps = {
  searchParams: Promise<{
    status?: string;
    notice?: string;
  }>;
};

const statusOptions: Record<string, string> = {
  joining: "Joining",
  terminated: "Terminated",
  laid_off: "Layoff",
  notice_period: "Notice Period",
  notice_completed: "Notice Completed",
  early_release: "Early Release",
  resigned: "Resigned",
};

const noticeTitles: Record<string, string> = {
  notice_period: "On Notice",
  notice_completed: "Notice Completed",
  early_release: "Early Released",
};

function normalizeStatus(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

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

  const selectedStatus = normalizeStatus(params.status);
  const selectedNotice = normalizeStatus(params.notice);

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

  const { data: dbDepartments, error: departmentsError } =
    await adminClient
      .from("departments")
      .select("id, name, description, created_at")
      .order("name", { ascending: true });

  if (departmentsError) {
    console.error(
      "Failed to load departments:",
      departmentsError
    );
  }

  const departments = dbDepartments ?? [];

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const filteredEmployees = selectedStatus
    ? employees.filter((employee) => {
        const employeeStatus = normalizeStatus(employee.status);

        const emp = employee as typeof employee & {
          notice_status?: string | null;
          planned_last_working_date?: string | null;
        };

        const noticeStatus = normalizeStatus(emp.notice_status);

        if (
          !Object.prototype.hasOwnProperty.call(
            statusOptions,
            selectedStatus
          )
        ) {
          return false;
        }

        const isOnNotice = (employeeStatus === "on_notice" || (employeeStatus === "resigned" && noticeStatus === "notice_period")) &&
          (!emp.planned_last_working_date || emp.planned_last_working_date >= today);

        const isNoticeCompleted =
          employeeStatus === "resigned" &&
          noticeStatus === "notice_completed";

        const isEarlyReleased =
          employeeStatus === "resigned" &&
          noticeStatus === "early_release";

        // RESIGNED PARENT AND SUBCATEGORIES
        if (selectedStatus === "resigned") {
          // Parent: show all three categories
          if (!selectedNotice) {
            return (
              isOnNotice ||
              isNoticeCompleted ||
              isEarlyReleased
            );
          }

          // On Notice
          if (selectedNotice === "notice_period") {
            return isOnNotice;
          }

          // Notice Completed
          if (selectedNotice === "notice_completed") {
            return isNoticeCompleted;
          }

          // Early Released
          if (selectedNotice === "early_release") {
            return isEarlyReleased;
          }

          return false;
        }

        // INDIVIDUAL STATUS FILTERS
        if (selectedStatus === "notice_period") {
          return isOnNotice;
        }

        if (selectedStatus === "notice_completed") {
          return isNoticeCompleted;
        }

        if (selectedStatus === "early_release") {
          return isEarlyReleased;
        }

        if (selectedStatus === "laid_off") {
          return employeeStatus === "laid_off";
        }

        if (selectedStatus === "terminated") {
          return employeeStatus === "terminated";
        }

        return employeeStatus === selectedStatus;
      })
    : employees;

  const pageTitle =
    selectedStatus === "resigned"
      ? selectedNotice
        ? noticeTitles[selectedNotice] || "Resigned"
        : "Resigned"
      : selectedStatus && statusOptions[selectedStatus]
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