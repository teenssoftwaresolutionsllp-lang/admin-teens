"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  UserPlus,
  CalendarDays,
  UserCheck,
  Building2,
  BriefcaseBusiness,
  Home,
  TrendingUp,
} from "lucide-react";

type JoiningCount = {
  year: number;
  month: number;
  count: number;
};

type DepartmentAttendance = {
  departmentId: string;
  departmentName: string;
  present: number;
  wfh: number;
  wfo: number;
};

type Props = {
  activeEmployees: number;
  pendingLeaveCount: number;
  joiningCounts: JoiningCount[];
  departmentAttendanceData: DepartmentAttendance[];
  currentMonth: number;
  currentYear: number;
  selectedAttendanceDate: string;
  todayDate: string;
};

const months = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const selectClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition hover:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const numberFormat = (value: number) =>
  value.toLocaleString("en-IN");

function formatAttendanceDate(date: string) {
  if (!date) return "";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardKpiCards({
  activeEmployees,
  pendingLeaveCount,
  joiningCounts,
  departmentAttendanceData,
  currentMonth,
  currentYear,
  selectedAttendanceDate,
  todayDate,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const years = useMemo(() => {
    const availableYears = new Set(
      joiningCounts.map((item) => item.year)
    );

    availableYears.add(currentYear);

    return Array.from(availableYears).sort((a, b) => b - a);
  }, [joiningCounts, currentYear]);

  const selectedJoiningCount = useMemo(() => {
    return joiningCounts.find(
      (item) =>
        item.year === selectedYear &&
        item.month === selectedMonth
    )?.count ?? 0;
  }, [joiningCounts, selectedMonth, selectedYear]);

  const selectedAttendance = useMemo(() => {
    if (selectedDepartment === "all") {
      return departmentAttendanceData.reduce(
        (total, department) => ({
          present: total.present + department.present,
          wfh: total.wfh + department.wfh,
          wfo: total.wfo + department.wfo,
        }),
        { present: 0, wfh: 0, wfo: 0 }
      );
    }

    const department = departmentAttendanceData.find(
      (item) => item.departmentId === selectedDepartment
    );

    return {
      present: department?.present ?? 0,
      wfh: department?.wfh ?? 0,
      wfo: department?.wfo ?? 0,
    };
  }, [departmentAttendanceData, selectedDepartment]);

  // Change the attendance date and reload server-side attendance data.
  const handleAttendanceDateChange = (date: string) => {
    if (!date || date > todayDate) return;

    const selectedDay = new Date(`${date}T00:00:00`).getDay();

    // Disable Saturday (6) and Sunday (0)
    if (selectedDay === 0 || selectedDay === 6) return;

    const params = new URLSearchParams(searchParams.toString());

    if (date === todayDate) {
        params.delete("attendanceDate");
    } else {
        params.set("attendanceDate", date);
    }

    const queryString = params.toString();

    router.replace(
        queryString ? `${pathname}?${queryString}` : pathname,
        { scroll: false }
    );
  };

  const cardClass =
    "relative flex min-h-[220px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md";

  const iconClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl";

  const labelClass =
    "text-sm font-semibold text-slate-600";

  const numberClass =
    "mt-2 text-3xl font-bold tracking-tight text-slate-900";

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

      {/* Active Employees */}
      <section className={cardClass}>
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-50 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <div className={`${iconClass} bg-blue-50 text-blue-600`}>
            <Users className="h-5 w-5" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>

        <div className="relative mt-6">
          <p className={labelClass}>Active Employees</p>
          <h2 className={numberClass}>
            {numberFormat(activeEmployees)}
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            Currently active in the organization
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[11px] font-medium text-slate-500">
            Active workforce
          </span>
        </div>
      </section>

      {/* New Joinings */}
      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <div className={`${iconClass} bg-indigo-50 text-indigo-600`}>
            <UserPlus className="h-5 w-5" />
          </div>

          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
            Recruitment
          </span>
        </div>

        <div className="mt-5">
          <p className={labelClass}>New Joinings</p>
          <h2 className={numberClass}>
            {numberFormat(selectedJoiningCount)}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Employees joined in selected period
          </p>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Month
            </label>
            <select
              aria-label="Joining month"
              value={selectedMonth}
              onChange={(event) =>
                setSelectedMonth(Number(event.target.value))
              }
              className={`${selectClass} w-full min-w-0`}
            >
              {months.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Year
            </label>
            <select
              aria-label="Joining year"
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(Number(event.target.value))
              }
              className={`${selectClass} w-full min-w-0`}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Leave Requests */}
      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <div className={`${iconClass} bg-amber-50 text-amber-600`}>
            <CalendarDays className="h-5 w-5" />
          </div>

          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Pending
          </span>
        </div>

        <div className="mt-6">
          <p className={labelClass}>Leave Requests</p>
          <h2 className={numberClass}>
            {numberFormat(pendingLeaveCount)}
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            Awaiting HR review
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[11px] font-medium text-slate-500">
            Pending approvals
          </span>
          <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-amber-50 px-2 text-xs font-bold text-amber-700">
            {numberFormat(pendingLeaveCount)}
          </span>
        </div>
      </section>

      {/* Attendance */}
      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <div className={`${iconClass} bg-violet-50 text-violet-600`}>
            <UserCheck className="h-5 w-5" />
          </div>

          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
            {selectedAttendanceDate === todayDate ? "Today" : "Past Date"}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <p className={labelClass}>Today Present</p>
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
          </div>

          <input
            type="date"
            aria-label="Select attendance date"
            value={selectedAttendanceDate}
            max={todayDate}
            onChange={(event) =>handleAttendanceDateChange(event.target.value)}
            className={`${selectClass} mt-2 w-full cursor-pointer`}
          />

          <p className="mt-1 text-[10px] text-slate-400">
            Attendance for {formatAttendanceDate(selectedAttendanceDate)}
          </p>

          <select
            aria-label="Attendance department"
            value={selectedDepartment}
            onChange={(event) =>
              setSelectedDepartment(event.target.value)
            }
            className={`${selectClass} mt-2 w-full`}
          >
            <option value="all">All Departments</option>
            {departmentAttendanceData.map((department) => (
              <option
                key={department.departmentId}
                value={department.departmentId}
              >
                {department.departmentName}
              </option>
            ))}
          </select>

          <h2 className={numberClass}>
            {numberFormat(selectedAttendance.present)}
          </h2>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 p-2">
            <BriefcaseBusiness className="h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium text-slate-500">
                WFO
              </p>
              <p className="text-sm font-bold text-slate-900">
                {numberFormat(selectedAttendance.wfo)}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 p-2">
            <Home className="h-4 w-4 shrink-0 text-violet-600" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium text-slate-500">
                WFH
              </p>
              <p className="text-sm font-bold text-slate-900">
                {numberFormat(selectedAttendance.wfh)}
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
