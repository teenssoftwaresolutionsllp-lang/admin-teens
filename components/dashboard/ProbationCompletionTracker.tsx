"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Employee } from "@/lib/types";
import {
  Star,
  ArrowRight,
  ChevronDown,
  CalendarDays,
} from "lucide-react";

interface ProbationCompletionTrackerProps {
  employees: Employee[];
}

type DashboardEmployee = Employee & {
  probation_end_date?: string | null;
};

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

function getDateOnly(value?: string | null) {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function getTodayDateOnly() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const dateOnly = getDateOnly(value);
  if (!dateOnly) return "—";

  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function ProbationCompletionTracker({
  employees,
}: ProbationCompletionTrackerProps) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const todayDate = getTodayDateOnly();

  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");
  const [selectedYear, setSelectedYear] = useState<number | "all">(currentYear);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  const typedEmployees = employees as DashboardEmployee[];

  // Collect distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    typedEmployees.forEach((emp) => {
      const dept = emp.department?.name;
      if (dept) set.add(dept);
    });
    return Array.from(set).sort();
  }, [typedEmployees]);

  // Collect available years
  const years = useMemo(() => {
    const availableYears = new Set<number>();
    for (let year = currentYear - 3; year <= currentYear + 3; year++) {
      availableYears.add(year);
    }
    typedEmployees.forEach((employee) => {
      const date = getDateOnly(employee.probation_end_date);
      if (date) {
        availableYears.add(Number(date.slice(0, 4)));
      }
    });
    return Array.from(availableYears).sort((a, b) => b - a);
  }, [typedEmployees, currentYear]);

  // Filter employees according to criteria
  const { pendingList, completedList, allPendingCount, allCompletedCount } = useMemo(() => {
    let pendingCount = 0;
    let completedCount = 0;

    const pending: DashboardEmployee[] = [];
    const completed: DashboardEmployee[] = [];

    typedEmployees.forEach((emp) => {
      if (String(emp.status ?? "").toLowerCase() !== "active") return;
      const probDate = getDateOnly(emp.probation_end_date);
      if (!probDate) return;

      const isCompleted = probDate <= todayDate;
      if (isCompleted) {
        completedCount++;
      } else {
        pendingCount++;
      }

      // Department filter
      if (selectedDepartment !== "all" && emp.department?.name !== selectedDepartment) {
        return;
      }

      // Year filter
      const [year, month] = probDate.split("-").map(Number);
      if (selectedYear !== "all" && year !== selectedYear) {
        return;
      }

      // Month filter
      if (selectedMonth !== "all" && month !== selectedMonth) {
        return;
      }

      if (isCompleted) {
        completed.push(emp);
      } else {
        pending.push(emp);
      }
    });

    return {
      pendingList: pending,
      completedList: completed,
      allPendingCount: pendingCount,
      allCompletedCount: completedCount,
    };
  }, [typedEmployees, todayDate, selectedDepartment, selectedYear, selectedMonth]);

  const displayedList = activeTab === "pending" ? pendingList : completedList;

  return (
    <section className="flex h-full min-w-0 w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all">
      <div>
        {/* Header and filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Star className="h-4 w-4 fill-blue-600 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Probation Completion Tracker
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Track probation status across organization
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Department Filter */}
            <div className="relative">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-2.5 pr-7 py-1.5 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500 cursor-pointer"
                aria-label="Filter department"
              >
                <option value="all">Department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Month Filter */}
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-2.5 pr-7 py-1.5 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500 cursor-pointer"
                aria-label="Filter month"
              >
                <option value="all">Month</option>
                {MONTHS.map((month, idx) => (
                  <option key={month} value={idx + 1}>
                    {month.slice(0, 3)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Year Filter */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-2.5 pr-7 py-1.5 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500 cursor-pointer"
                aria-label="Filter year"
              >
                <option value="all">Year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* View All link */}
            <Link
              href="/dashboard/employees"
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 ml-1"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Tabs matching screenshot */}
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition shadow-xs ${
              activeTab === "pending"
                ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            Pending ({pendingList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition shadow-xs ${
              activeTab === "completed"
                ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            Completion ({completedList.length})
          </button>
        </div>

        {/* Table */}
        {displayedList.length > 0 ? (
          <div className="mt-3 overflow-x-auto max-h-[175px] overflow-y-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-2.5 pr-2 font-semibold">EMPLOYEE</th>
                  <th className="pb-2.5 px-2 font-semibold">DEPARTMENT</th>
                  <th className="pb-2.5 px-2 font-semibold whitespace-nowrap">JOINING DATE</th>
                  <th className="pb-2.5 px-2 font-semibold whitespace-nowrap">PROBATION END</th>
                  <th className="pb-2.5 pl-2 font-semibold">STATUS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {displayedList.slice(0, 5).map((employee) => {
                  const probDate = getDateOnly(employee.probation_end_date);
                  const isCompleted = Boolean(probDate && probDate <= todayDate);

                  return (
                    <tr
                      key={employee.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`View ${employee.first_name} ${employee.last_name}`}
                      onClick={() =>
                        router.push(`/dashboard/employees/${employee.id}`)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/dashboard/employees/${employee.id}`);
                        }
                      }}
                      className="cursor-pointer transition hover:bg-slate-50/70"
                    >
                      {/* Employee */}
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {employee.profile_photo_url ? (
                            <Image
                              src={employee.profile_photo_url}
                              alt={`${employee.first_name} ${employee.last_name}`}
                              width={32}
                              height={32}
                              unoptimized
                              className="h-7 w-7 shrink-0 rounded-full object-cover border border-slate-100"
                            />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 border border-indigo-100/60">
                              {getInitials(
                                `${employee.first_name} ${employee.last_name}`
                              )}
                            </div>
                          )}
                          <span className="truncate text-xs font-bold text-slate-900">
                            {employee.first_name} {employee.last_name}
                          </span>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-2.5 px-2 text-xs font-medium text-slate-600 truncate">
                        {employee.department?.name || "Unassigned"}
                      </td>

                      {/* Joining Date */}
                      <td className="py-2.5 px-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {formatDate(employee.joining_date)}
                      </td>

                      {/* Probation End */}
                      <td className="py-2.5 px-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {formatDate(employee.probation_end_date)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 pl-2 whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-flex items-center rounded-full bg-[#fef9c3] px-3 py-0.5 text-[11px] font-semibold text-[#854d0e]">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-3 py-0.5 text-[11px] font-semibold text-[#b45309]">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[140px] flex-col items-center justify-center text-center mt-3">
            <CalendarDays className="mb-2 text-slate-300" size={26} />
            <p className="text-xs font-medium text-slate-600">
              No probation employees in this view
            </p>
          </div>
        )}
      </div>

      {/* Footer matching screenshot */}
      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold">
        <span className="text-slate-800">
          Total Pending: {allPendingCount}
        </span>
        <span className="text-emerald-600">
          Total Completed: {allCompletedCount}
        </span>
      </div>
    </section>
  );
}
