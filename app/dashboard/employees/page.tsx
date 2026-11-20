import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import { redirect } from "next/navigation";
import Link from "next/link";
import EmployeeTable from "@/components/EmployeeTable";
import JoiningEmployeesView from "@/components/admin/JoiningEmployeesView";
import { Users, UserCheck, Clock, Building2, UserPlus } from "lucide-react";

type EmployeesPageProps = {
  searchParams: Promise<{
    status?: string;
    notice?: string;
    department?: string;
  }>;
};

const statusOptions: Record<string, string> = {
  active: "Active Employees",
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
  const selectedDepartment = String(
    params.department ?? ""
  ).trim();

  const employees = await DataStore.getEmployees();

  // Keep existing Joining page behavior.
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

  // Load departments for EmployeeTable and department filtering.
  const adminClient = await createAdminClient();

  const {
    data: dbDepartments,
    error: departmentsError,
  } = await adminClient
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

  // ------------------------------------------
  // 1. Apply existing status and notice filters
  // ------------------------------------------

  const statusFilteredEmployees = selectedStatus
    ? employees.filter((employee) => {
        const employeeStatus = normalizeStatus(
          employee.status
        );

        const emp = employee as typeof employee & {
          notice_status?: string | null;
          planned_last_working_date?: string | null;
        };

        const noticeStatus = normalizeStatus(
          emp.notice_status
        );

        if (
          !Object.prototype.hasOwnProperty.call(
            statusOptions,
            selectedStatus
          )
        ) {
          return false;
        }

        // Active employees.
        if (selectedStatus === "active") {
          return employeeStatus === "active";
        }

        const isOnNotice =
          (
            employeeStatus === "on_notice" ||
            (
              employeeStatus === "resigned" &&
              noticeStatus === "notice_period"
            )
          ) &&
          (
            !emp.planned_last_working_date ||
            emp.planned_last_working_date >= today
          );

        const isNoticeCompleted =
          employeeStatus === "resigned" &&
          noticeStatus === "notice_completed";

        const isEarlyReleased =
          employeeStatus === "resigned" &&
          noticeStatus === "early_release";

        // Resigned parent and subcategories.
        if (selectedStatus === "resigned") {
          if (!selectedNotice) {
            return (
              isOnNotice ||
              isNoticeCompleted ||
              isEarlyReleased
            );
          }

          if (selectedNotice === "notice_period") {
            return isOnNotice;
          }

          if (selectedNotice === "notice_completed") {
            return isNoticeCompleted;
          }

          if (selectedNotice === "early_release") {
            return isEarlyReleased;
          }

          return false;
        }

        // Individual status filters.
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

  // ------------------------------------------
  // 2. Apply department filter
  // Supports department ID and department name
  // ------------------------------------------

  const filteredEmployees = selectedDepartment
    ? statusFilteredEmployees.filter((employee) => {
        const emp = employee as typeof employee & {
          department?:
            | string
            | {
                id?: string | null;
                name?: string | null;
              }
            | null;
          department_id?: string | null;
        };

        const employeeDepartmentId =
          emp.department_id ||
          (typeof emp.department === "object"
            ? emp.department?.id
            : null);

        const employeeDepartmentName =
          typeof emp.department === "string"
            ? emp.department
            : emp.department?.name ||
              departments.find(
                (department) =>
                  department.id === employeeDepartmentId
              )?.name ||
              "";

        return (
          employeeDepartmentId === selectedDepartment ||
          employeeDepartmentName.trim().toLowerCase() ===
            selectedDepartment.toLowerCase()
        );
      })
    : statusFilteredEmployees;

  // ------------------------------------------
  // 3. Page heading
  // ------------------------------------------

  const selectedDepartmentName =
    departments.find(
      (department) => department.id === selectedDepartment
    )?.name || selectedDepartment;

  const pageTitle = selectedStatus === "active"
    ? "All Employees"
    : selectedStatus
      ? selectedStatus === "resigned"
        ? selectedNotice
          ? noticeTitles[selectedNotice] || "Resigned"
          : "Resigned"
        : statusOptions[selectedStatus] || "All Employees"
      : selectedDepartment
        ? `${selectedDepartmentName} Employees`
        : "All Employees";

  // Summary counts for KPI overview
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter(
    (emp) => normalizeStatus(emp.status) === "active"
  ).length;
  const onNoticeOrResignedCount = employees.filter((emp) => {
    const s = normalizeStatus(emp.status);
    const ns = normalizeStatus(
      (emp as { notice_status?: string | null }).notice_status
    );
    return s === "on_notice" || s === "resigned" || ns === "notice_period";
  }).length;
  const totalDepartmentsCount = departments.length;

  const isAllView = !selectedStatus || selectedStatus === "active";

  // ------------------------------------------
  // 4. Render Employees
  // ------------------------------------------

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {pageTitle}
            </h1>

            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              {filteredEmployees.length} {filteredEmployees.length === 1 ? "Employee" : "Employees"}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            {isAllView
              ? "Comprehensive directory of all staff members, employment statuses, and team allocations."
              : `Viewing employees filtered by ${pageTitle.toLowerCase()}.`}
          </p>
        </div>

        {role === "hr" && (
          <Link
            href="/dashboard/employees/add"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 self-start sm:self-auto"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Employee</span>
          </Link>
        )}
      </div>

      {/* KPI Overview Cards - Shown on All Employees view */}
      {isAllView && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Workforce</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              {totalEmployeesCount}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Total registered profiles</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Staff</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-700">
              {activeEmployeesCount}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Currently active & working</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Notice & Resigned</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-amber-700">
              {onNoticeOrResignedCount}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Notice period or exits</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Departments</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              {totalDepartmentsCount}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Across the organization</p>
          </div>
        </div>
      )}

      <EmployeeTable
        employees={filteredEmployees}
        departments={departments}
        role={role}
      />
    </div>
  );
}
