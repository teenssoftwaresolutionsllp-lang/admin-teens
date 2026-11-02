
import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import ClockInWidget from "@/components/portal/ClockInWidget";
import Link from "next/link";
import {
  CalendarDays,
  CalendarCheck,
  CalendarPlus,
  Clock,
  FileText,
  UserRoundPen,
  Bell,
  PartyPopper,
  Calendar,
  ArrowRight,
  Sun,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeePortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let employee = null;

  if (user) {
    employee = await DataStore.getEmployeeByUserId(user.id);
  }

  if (!employee) {
    const all = await DataStore.getEmployees();
    employee = all.find((e) => e.email === user?.email) || all[0] || null;
  }

  const employeeId = employee?.id;

  const todayAttendance = employeeId
    ? await DataStore.getTodayAttendance(employeeId)
    : null;

  const attendanceLogs = employeeId
    ? await DataStore.getAttendanceLogs(employeeId)
    : [];

  const leaveRequests = employeeId
    ? await DataStore.getLeaveRequests(employeeId)
    : [];

  const leaveBalances = employeeId
    ? await DataStore.getLeaveBalances(employeeId)
    : [];

  const projects = await DataStore.getProjects();

  const project =
    employee?.project ||
    projects.find((p) => p.id === employee?.project_id) ||
    projects[0] ||
    null;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const presentThisMonth = attendanceLogs.filter((item: any) => {
    const rawDate =
      item.attendance_date || item.date || item.created_at;

    if (!rawDate) return false;

    const date = new Date(rawDate);

    return (
      !Number.isNaN(date.getTime()) &&
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear &&
      ["present", "half_day"].includes(
        String(item.status || "").toLowerCase()
      )
    );
  }).length;

  const remainingLeaves = leaveBalances
    .filter((item) =>
      ["CL", "SL"].includes(
        String(item.leave_type?.code ?? "").trim().toUpperCase()
      )
    )
    .reduce((total, item) => {
      const availableDays = Number(item.balance_days) || 0;
      const annualAllocation = Number(item.allocated_days) || 0;

      return total + Math.min(availableDays, annualAllocation);
    }, 0);

  const pendingRequests = leaveRequests.filter((item: any) =>
    ["pending", "submitted", "under_review"].includes(
      String(item.status || "").toLowerCase()
    )
  ).length;

  const holidays = [
    {
      name: "Diwali",
      date: "08 November 2026",
      day: "Sunday",
    },
  ];

  const shiftStart = project?.shift_start_time || "09:00";
  const shiftEnd = project?.shift_end_time || "18:00";

  const formatShiftTime = (time: string) => {
    if (!time) return "--";

    const [hours, minutes] = time.split(":");
    const hour = Number(hours);

    if (Number.isNaN(hour)) return time;

    const period = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;

    return `${String(formattedHour).padStart(2, "0")}:${minutes || "00"} ${period}`;
  };

  const gracePeriod =
    (project as any)?.grace_period_minutes ??
    (project as any)?.grace_period ??
    30;

  const cardClass =
    "rounded-2xl border border-slate-100 bg-white shadow-[0_3px_14px_rgba(15,23,42,0.04)]";

  const actionClass =
    "group flex min-h-[105px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:shadow-md";

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-6">

      {/* Compact Welcome */}
      <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-[#f5f5ff] px-5 py-3.5">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Good Morning, {employee?.first_name || "Employee"}!
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            Welcome back! Here's your overview for today.
          </p>

          <p className="mt-1 text-[11px] text-indigo-500">
            {employee?.designation || "Employee"}
            {employee?.employee_id
              ? ` • ID: ${employee.employee_id}`
              : ""}
          </p>
        </div>

        <div className="rounded-xl bg-white p-3 text-indigo-500 shadow-sm">
          <Sun className="h-6 w-6" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Present */}
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Present This Month
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                {presentThisMonth}
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">
                Attendance days
              </p>
            </div>

            <div className="rounded-2xl bg-[#e8f8ef] p-3 text-emerald-600">
              <CalendarCheck className="h-6 w-6" />
            </div>
          </div>
          <div className="h-1 bg-emerald-100" />
        </div>

        {/* Holidays */}
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Upcoming Holidays
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                {holidays.length}
              </p>
              <p className="mt-1 text-[11px] text-violet-600">
                Upcoming dates
              </p>
            </div>

            <div className="rounded-2xl bg-[#f2edff] p-3 text-violet-600">
              <CalendarDays className="h-6 w-6" />
            </div>
          </div>
          <div className="h-1 bg-violet-100" />
        </div>

        {/* Leaves */}
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Remaining Leaves
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                {remainingLeaves}
              </p>
              <p className="mt-1 text-[11px] text-sky-600">
                Available balance
              </p>
            </div>

            <div className="rounded-2xl bg-[#eaf5ff] p-3 text-sky-600">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
          <div className="h-1 bg-sky-100" />
        </div>

        {/* Requests */}
        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Pending Requests
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                {pendingRequests}
              </p>
              <p className="mt-1 text-[11px] text-orange-600">
                Awaiting approval
              </p>
            </div>

            <div className="rounded-2xl bg-[#fff3e6] p-3 text-orange-500">
              <Bell className="h-6 w-6" />
            </div>
          </div>
          <div className="h-1 bg-orange-100" />
        </div>
      </div>

      {/* Attendance, Schedule and Quick Actions */}
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">

        {/* Today's Attendance */}
        <section className={cardClass}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Today's Attendance
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Daily login and logout
              </p>
            </div>

            <div className="rounded-xl bg-[#e8f8ef] p-2.5 text-emerald-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="p-4">
            {employeeId ? (
              <ClockInWidget
                employeeId={employeeId}
                initialLog={todayAttendance}
                project={project}
                compact
              />
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                Employee account is not linked. Please contact HR.
              </p>
            )}
          </div>
        </section>

        {/* Work Schedule */}
        <section className={cardClass}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Work Schedule
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Your assigned working hours
              </p>
            </div>

            <div className="rounded-xl bg-[#eaf5ff] p-2.5 text-sky-600">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Working Days
              </span>
              <span className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-600">
                Monday – Friday
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Login Time
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {formatShiftTime(shiftStart)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Logout Time
              </span>
              <span className="text-xs font-semibold text-rose-500">
                {formatShiftTime(shiftEnd)}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                Grace Period
              </span>
              <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-600">
                {gracePeriod} Minutes
              </span>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className={cardClass}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Quick Actions
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Quickly access your services
              </p>
            </div>

            <div className="rounded-xl bg-[#f2edff] p-2.5 text-violet-600">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4">
            <Link href="/portal/leaves" className={actionClass}>
              <span className="rounded-xl bg-[#e8f8ef] p-3 text-emerald-600 group-hover:bg-emerald-100">
                <CalendarPlus className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-slate-600">
                Apply Leave
              </span>
            </Link>

            <Link href="/portal/payslips" className={actionClass}>
              <span className="rounded-xl bg-[#fff0f0] p-3 text-rose-500 group-hover:bg-rose-100">
                <FileText className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-slate-600">
                View Payslip
              </span>
            </Link>

            <Link href="/portal/profile" className={actionClass}>
              <span className="rounded-xl bg-[#eaf5ff] p-3 text-sky-600 group-hover:bg-sky-100">
                <UserRoundPen className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-slate-600">
                Update Profile
              </span>
            </Link>

            <Link href="/portal/attendance" className={actionClass}>
              <span className="rounded-xl bg-[#e8f8f5] p-3 text-teal-600 group-hover:bg-teal-100">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-slate-600">
                Attendance
              </span>
            </Link>
          </div>
        </section>
      </div>

      {/* Upcoming Holiday */}
      <section className="rounded-2xl border border-[#eee8ff] bg-[#faf8ff] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white p-3 text-violet-500 shadow-sm">
              <PartyPopper className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Upcoming Holiday
              </h2>
              <p className="text-[11px] text-slate-400">
                {project?.client_country
                  ? `Holiday calendar • ${project.client_country}`
                  : "Holiday calendar"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#eee8ff] bg-white px-4 py-3">
            <p className="text-xs font-bold text-violet-600">
              {holidays[0].name}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {holidays[0].date} • {holidays[0].day}
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
