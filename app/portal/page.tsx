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
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmployeePortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const employee = await DataStore.getEmployeeByUserId(user.id);

  if (!employee) {
    return (
      <div className="max-w-3xl mx-auto mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-amber-900">
          Employee Profile Not Linked
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Your login is not linked to an employee profile. Please contact HR
          to complete the account linking.
        </p>
      </div>
    );
  }

  const employeeId = employee.id;

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

  const payslips = employeeId
    ? await DataStore.getPayslips(employeeId)
    : [];

  const latestPayslip = payslips[0] ?? null;

  const projects = await DataStore.getProjects();

  const project =
    employee?.project ||
    projects.find((p) => p.id === employee?.project_id) ||
    projects[0] ||
    null;

  // --------------------------------------------------
  // SHIFT-WISE UPCOMING HOLIDAYS
  // --------------------------------------------------

  type HolidayItem = {
    id: string;
    title: string;
    holiday_date: string;
    calendar_id?: string;
  };

  type HolidayCalendar = {
    id: string;
    country_name?: string;
    timezone?: string;
    shift_type?: string;
    calendar_year?: number;
    holidays?: HolidayItem[];
  };

  let holidays: HolidayItem[] = [];

  const holidayCalendars =
    (await DataStore.getHolidayCalendars()) as HolidayCalendar[];

  // Normalize shift names before comparing.
  const normalizeShift = (value: unknown): string => {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ");
  };

  // Get employee's assigned shift.
  const employeeData = employee as unknown as Record<string, unknown>;
  const projectData = project as unknown as Record<string, unknown> | null;

  const employeeShift =
    employeeData?.shift_type ??
    employeeData?.assigned_shift ??
    (employeeData?.shift as Record<string, unknown> | undefined)?.shift_type ??
    (employeeData?.shift as Record<string, unknown> | undefined)?.name ??
    employeeData?.shift ??
    projectData?.shift_type ??
    projectData?.shift_name ??
    "";

  const employeeShiftName = normalizeShift(String(employeeShift ?? ""));

  // Find the holiday calendar assigned to this shift.
  const holidayCalendar = employeeShiftName
    ? holidayCalendars.find((calendar) => {
        return (
          normalizeShift(calendar.shift_type) === employeeShiftName
        );
      })
    : null;

  // Get today's date using the matched calendar timezone.
  const holidayTimezone =
    holidayCalendar?.timezone || "Asia/Kolkata";

  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: holidayTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const todayDate = todayParts;

  // Get all upcoming holidays for the employee's shift.
  if (holidayCalendar) {
    holidays = (holidayCalendar.holidays || [])
      .filter((holiday) => {
        if (!holiday.holiday_date) return false;

        const holidayDate = String(holiday.holiday_date).split("T")[0];

        return holidayDate >= todayDate;
      })
      .sort((a, b) =>
        String(a.holiday_date).localeCompare(String(b.holiday_date))
      );
  }

  // --------------------------------------------------
  // DATE FORMATTING
  // --------------------------------------------------

  const formatHolidayDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00Z`);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const formatHolidayDay = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00Z`);

    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      timeZone: "UTC",
    });
  };

  // --------------------------------------------------
  // ATTENDANCE AND LEAVE STATISTICS
  // --------------------------------------------------

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const presentThisMonth = attendanceLogs.filter((item: { attendance_date?: string; date?: string; created_at?: string; status?: string }) => {
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

  const pendingRequests = leaveRequests.filter((item: { status?: string }) =>
    ["pending", "submitted", "under_review"].includes(
      String(item.status || "").toLowerCase()
    )
  ).length;

  // --------------------------------------------------
  // PROJECT SHIFT DETAILS
  // --------------------------------------------------

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

  const gracePeriod = Number(
    projectData?.grace_period_minutes ??
    projectData?.grace_period ??
    30
  );

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
            Welcome back! Here&apos;s your overview for today.
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
                Today&apos;s Attendance
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
                {holidayCalendar?.country_name ||
                  project?.client_country ||
                  "Holiday calendar"}
                {" • "}
                {holidayCalendar?.shift_type || "Assigned shift"}
              </p>
            </div>
          </div>

          {holidays.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">

              {/* Nearest Holiday */}
              <div className="rounded-xl border border-[#eee8ff] bg-white px-4 py-3">
                <p className="text-xs font-bold text-violet-600">
                  {holidays[0].title}
                </p>

                <p className="mt-1 text-[11px] text-slate-500">
                  {formatHolidayDate(holidays[0].holiday_date)}
                  {" • "}
                  {formatHolidayDay(holidays[0].holiday_date)}
                </p>
              </div>

              {/* Remaining Holidays */}
              {holidays.length > 1 && (
                <div className="rounded-xl border border-[#eee8ff] bg-white px-4 py-3">
                  <p className="text-xs font-bold text-slate-700">
                    +{holidays.length - 1} More
                  </p>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Upcoming holidays
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[#eee8ff] bg-white px-5 py-3">
              <p className="text-xs font-semibold text-slate-500">
                No Upcoming Holidays
              </p>

              <p className="mt-1 text-[11px] text-slate-400">
                {!employeeShiftName
                  ? "Employee shift is not assigned"
                  : !holidayCalendar
                    ? "No holiday calendar found for your shift"
                    : "No holidays scheduled currently"}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Payslip Snapshot */}
      <section className="flex flex-col justify-between gap-6 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white shadow-md md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-xl bg-white/10 p-3">
            <FileText className="h-7 w-7 text-indigo-300" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white">
                Latest Payslip: {latestPayslip?.month_name || "No payslip"}{" "}
                {latestPayslip?.payroll_year || ""}
              </h2>

              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                {latestPayslip?.payment_status || "No Payslip"}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-300">
              Monthly CTC:{" "}
              {latestPayslip
                ? `₹${Number(latestPayslip.gross_salary ?? 0).toLocaleString("en-IN")}`
                : "Not available"}

              {latestPayslip && latestPayslip.lop_days > 0 && (
                <span className="ml-1 font-semibold text-amber-300">
                  &bull; {latestPayslip.lop_days} day(s) LOP deduction (-₹
                  {Number(latestPayslip.lop_deduction ?? 0).toLocaleString("en-IN")})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 md:justify-end">
          <div className="text-right">
            <span className="block text-xs text-slate-400">
              Take-Home Net Salary
            </span>

            <span className="font-mono text-2xl font-bold text-emerald-400">
              {latestPayslip
                ? `₹${Number(latestPayslip.net_salary ?? 0).toLocaleString("en-IN")}`
                : "Not available"}
            </span>
          </div>

          <Link
            href="/portal/payslips"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
          >
            <span>View &amp; Download</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
