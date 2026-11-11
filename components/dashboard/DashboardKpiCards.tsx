"use client";

import { useEmployeeDashboardFilter } from "@/components/dashboard/EmployeeFilterProvider";
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
  ArrowUpRight,
  Clock3,
  ChevronDown,
} from "lucide-react";

type JoiningCount = {
  year: number;
  month: number;
  count: number;
};

type PendingLeaveBreakdown = {
  CL: number;
  SL: number;
  ML: number;
  PL: number;
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
  pendingLeaveBreakdown?: PendingLeaveBreakdown;
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const numberFormat = (value: number) =>
  value.toLocaleString("en-IN");

// Shared filter styling
const selectClass =
  "h-9 w-full min-w-0 appearance-none rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const selectLabel =
  "mb-1.5 block text-[10px] font-semibold text-slate-500";

export default function DashboardKpiCards({
  activeEmployees,
  pendingLeaveCount,
  pendingLeaveBreakdown = {
    CL: 0,
    SL: 0,
    ML: 0,
    PL: 0,
  },
  joiningCounts,
  departmentAttendanceData,
  currentMonth,
  currentYear,
  selectedAttendanceDate,
  todayDate,
}: Props) {
  const router = useRouter();
  const { applyDashboardFilter } = useEmployeeDashboardFilter();
  const handleActiveEmployeesClick = () => {
    applyDashboardFilter({
      status: "active",
      departmentId: "all",
      departmentName: "All Departments",
    });

    router.push("/dashboard/employees");
  };

  const handleLeaveNavigation = (leaveType: "ALL" | "CL" | "SL" | "ML" | "PL" = "ALL") => {
  const params = new URLSearchParams({
      status: "pending",
      tab: "leaves",
    });

    if (leaveType !== "ALL") {
      params.set("leaveType", leaveType);
    }
    router.push(`/dashboard/approvals?${params.toString()}`);
  };

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const handleNewJoiningsClick = () => {
    const month = String(selectedMonth).padStart(2, "0");

    const firstDay = `${selectedYear}-${month}-01`;

    const lastDayNumber = new Date(
      selectedYear,
      selectedMonth,
      0
    ).getDate();

    const lastDay = `${selectedYear}-${month}-${String(lastDayNumber).padStart(2, "0")}`;

    applyDashboardFilter({
      status: "all",
      departmentId: "all",
      departmentName: "All Departments",
      joiningDateFrom: firstDay,
      joiningDateTo: lastDay,
    });

    router.push("/dashboard/employees");
  };

  const years = useMemo(() => {
    const availableYears = new Set(
      joiningCounts.map((item) => item.year)
    );

    availableYears.add(currentYear);

    return Array.from(availableYears).sort((a, b) => b - a);
  }, [joiningCounts, currentYear]);

  const selectedJoiningCount = useMemo(() => {
    return (
      joiningCounts.find(
        (item) =>
          item.year === selectedYear &&
          item.month === selectedMonth
      )?.count ?? 0
    );
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

  const handleAttendanceDateChange = (date: string) => {
    if (!date || date > todayDate) return;

    const selectedDay = new Date(`${date}T00:00:00`).getDay();

    // Preserve the existing weekday-only attendance selection.
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

  const cardBase =
    "group relative flex min-h-[205px] min-w-0 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md";

  const iconBase =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl";

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

      {/* ACTIVE EMPLOYEES */}
      <section
          role="link"
          tabIndex={0}
          aria-label="View all active employees"
          onClick={handleActiveEmployeesClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleActiveEmployeesClick();
            }
          }}
        className={`${cardBase} cursor-pointer border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 focus:outline-none focus:ring-2 focus:ring-indigo-400`}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-200/30 blur-2xl transition-transform duration-500 group-hover:scale-125" />

        <div className="relative flex items-center justify-between">
          <div className={`${iconBase} bg-indigo-100 text-indigo-700`}>
            <Users className="h-4 w-4" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Active
          </span>
        </div>

        <div className="relative mt-4">
          <p className="text-xs font-semibold text-slate-600">
            Active Employees
          </p>

          <div className="mt-1 flex items-end gap-2">
            <h2 className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900">
              {numberFormat(activeEmployees)}
            </h2>

            <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Currently active in the organization
          </p>
        </div>

        <div className="relative mt-auto border-t border-indigo-100 pt-3">
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
              <TrendingUp className="h-3.5 w-3.5" />
              Active workforce
            </span>

            <span className="text-[9px] font-medium text-slate-400">
              Employee overview
            </span>
          </div>
        </div>
      </section>

      {/* NEW JOININGS */}
      <section
        role="link"
        tabIndex={0}
        aria-label="View employees joined in selected month"
        onClick={handleNewJoiningsClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleNewJoiningsClick();
          }
        }}
        className={`${cardBase} cursor-pointer border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-teal-200/30 blur-2xl transition-transform duration-500 group-hover:scale-125" />

        <div className="relative flex items-center justify-between">
          <div className={`${iconBase} bg-teal-100 text-teal-700`}>
            <UserPlus className="h-4 w-4" />
          </div>

          <span className="rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-teal-700">
            Recruitment
          </span>
        </div>

        <div className="relative mt-4">
          <p className="text-xs font-semibold text-slate-600">
            New Joinings
          </p>

          <h2 className="mt-1 text-[32px] font-extrabold leading-none tracking-tight text-slate-900">
            {numberFormat(selectedJoiningCount)}
          </h2>

          <p className="mt-2 text-[11px] text-slate-500">
            Employees joined in selected period
          </p>
        </div>

        <div className="relative mt-auto grid grid-cols-2 gap-2 border-t border-teal-100 pt-3">
          <div className="min-w-0">
            <label className={selectLabel}>Joining Month</label>

            <div className="relative">
              <select
                aria-label="Joining month"
                value={selectedMonth}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setSelectedMonth(Number(event.target.value))
                }
                className={`${selectClass} pr-9`}
              >
                {months.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="min-w-0">
            <label className={selectLabel}>Joining Year</label>

            <div className="relative">
              <select
                aria-label="Joining year"
                value={selectedYear}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setSelectedYear(Number(event.target.value))
                }
                className={`${selectClass} pr-9`}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </section>

      {/* LEAVE REQUESTS */}
      <section
        role="link"
        tabIndex={0}
        aria-label="View all pending leave requests"
        onClick={() => handleLeaveNavigation("ALL")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleLeaveNavigation("ALL");
          }
        }}
        className={`${cardBase} cursor-pointer border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50`}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-200/30 blur-2xl transition-transform duration-500 group-hover:scale-125" />

        <div className="relative flex items-center justify-between">
          <div className={`${iconBase} bg-amber-100 text-amber-700`}>
            <CalendarDays className="h-4 w-4" />
          </div>

          <span className="rounded-full border border-amber-200 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-700">
            Pending
          </span>
        </div>

        <div className="relative mt-4">
          <p className="text-xs font-semibold text-slate-600">
            Leave Requests
          </p>

          <h2 className="mt-1 text-[32px] font-extrabold leading-none tracking-tight text-slate-900">
            {numberFormat(pendingLeaveCount)}
          </h2>

          <p className="mt-2 text-[11px] text-slate-500">
            Awaiting HR review
          </p>

          {/* Leave type breakdown */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(
              [
                ["CL", pendingLeaveBreakdown.CL],
                ["SL", pendingLeaveBreakdown.SL],
                ["ML", pendingLeaveBreakdown.ML],
                ["PL", pendingLeaveBreakdown.PL],
              ] as const
            ).map(([type, count]) => (
             <button
              key={type}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleLeaveNavigation(type);
              }}
              aria-label={`View pending ${type} leave requests`}
              className="rounded-lg cursor-pointer border border-amber-100 bg-white/80 px-1 py-2 text-center transition-all duration-200 hover:border-amber-400 hover:bg-amber-100/70 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <p className="text-[10px] font-bold text-slate-500">
                {type}
              </p>
              <p className="mt-1 text-sm font-bold text-amber-800">
                {numberFormat(count)}
              </p>
            </button>
            ))}
          </div>
        </div>

        <div className="relative mt-auto flex items-center justify-between border-t border-amber-100 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <Clock3 className="h-3.5 w-3.5 text-amber-600" />
            Pending approvals
          </span>

          <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-amber-100 px-2 text-xs font-bold text-amber-800">
            {numberFormat(pendingLeaveCount)}
          </span>
        </div>
      </section>

      {/* TODAY PRESENT */}
      <section
        role="link"
        tabIndex={0}
        aria-label="View attendance details"
        onClick={() =>
          router.push(
            `/dashboard/attendance${selectedAttendanceDate !== todayDate ? `?date=${selectedAttendanceDate}` : ""}`
          )
        }
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push(
              `/dashboard/attendance${selectedAttendanceDate !== todayDate ? `?date=${selectedAttendanceDate}` : ""}`
            );
          }
        }}
        className={`${cardBase} cursor-pointer border-violet-100 bg-gradient-to-br from-violet-50 via-white to-purple-50`}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl transition-transform duration-500 group-hover:scale-125" />

        {/* Header */}
        <div className="relative flex items-center justify-between">
          <div className={`${iconBase} bg-violet-100 text-violet-700`}>
            <UserCheck className="h-4 w-4" />
          </div>

          <span className="rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-violet-700">
            {selectedAttendanceDate === todayDate ? "Today" : "Past Date"}
          </span>
        </div>

        {/* Attendance summary */}
        <div className="relative mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">
              Today Present
            </p>

            <Building2 className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          </div>

          <div className="mt-2 flex items-end gap-2">
            <h2 className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900">
              {numberFormat(selectedAttendance.present)}
            </h2>

            <span className="mb-1 text-[11px] font-medium text-slate-500">
              Present
            </span>
          </div>

          {/* WFO / WFH */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white bg-white/75 p-2">
              <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0 text-blue-600" />

              <div className="min-w-0">
                <p className="text-[9px] font-semibold text-slate-500">
                  WFO
                </p>
                <p className="text-xs font-bold text-slate-900">
                  {numberFormat(selectedAttendance.wfo)}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white bg-white/75 p-2">
              <Home className="h-3.5 w-3.5 shrink-0 text-violet-600" />

              <div className="min-w-0">
                <p className="text-[9px] font-semibold text-slate-500">
                  WFH
                </p>
                <p className="text-xs font-bold text-slate-900">
                  {numberFormat(selectedAttendance.wfh)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters at bottom */}
        <div className="relative mt-auto grid grid-cols-2 gap-2 border-t border-violet-100 pt-3">
          <div className="min-w-0">
            <label className={selectLabel}>Attendance Date</label>

            <input
              type="date"
              aria-label="Select attendance date"
              value={selectedAttendanceDate}
              max={todayDate}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                handleAttendanceDateChange(event.target.value)
              }
              className={selectClass}
            />
          </div>

          <div className="min-w-0">
            <label className={selectLabel}>Department</label>

            <div className="relative">
              <select
                aria-label="Attendance department"
                onClick={(event) => event.stopPropagation()}
                value={selectedDepartment}
                onChange={(event) =>
                  setSelectedDepartment(event.target.value)
                }
                className={`${selectClass} pr-9`}
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

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
