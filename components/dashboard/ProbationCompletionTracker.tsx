
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Employee } from "@/lib/types";
import {
  CalendarDays,
  Users,
  CheckCircle2,
  Clock,
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

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

export default function ProbationCompletionTracker({
  employees,
}: ProbationCompletionTrackerProps) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const todayDate = getTodayDateOnly();

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const typedEmployees = employees as DashboardEmployee[];

  const years = useMemo(() => {
    const availableYears = new Set<number>();

    for (
      let year = currentYear - 5;
      year <= currentYear + 5;
      year++
    ) {
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

  const probationEmployees = useMemo(() => {
    return typedEmployees
      .filter((employee) => {
        const probationDate = getDateOnly(
          employee.probation_end_date
        );

        if (!probationDate) return false;

        const [year, month] = probationDate.split("-").map(Number);

        return (
          String(employee.status ?? "").toLowerCase() === "active" &&
          year === selectedYear &&
          month === selectedMonth
        );
      })
      .sort((a, b) => {
        return (
          getDateOnly(a.probation_end_date) || ""
        ).localeCompare(
          getDateOnly(b.probation_end_date) || ""
        );
      });
  }, [typedEmployees, selectedMonth, selectedYear]);

  const completedProbationEmployees = probationEmployees.filter(
    (employee) => {
      const probationDate = getDateOnly(
        employee.probation_end_date
      );

      return probationDate && probationDate <= todayDate;
    }
  );

  const pendingProbationEmployees = probationEmployees.filter(
    (employee) => {
      const probationDate = getDateOnly(
        employee.probation_end_date
      );

      return probationDate && probationDate > todayDate;
    }
  );

  const pendingProbationCount = pendingProbationEmployees.length;

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header and filters */}
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Probation Completion Tracker
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Active employee probation status
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500"
            aria-label="Select month"
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500"
            aria-label="Select year"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-indigo-700">
              Completing Probation
            </p>
            <Users className="h-5 w-5 text-indigo-500" />
          </div>

          <p className="mt-3 text-2xl font-bold text-indigo-700">
            {completedProbationEmployees.length}
          </p>

          <p className="mt-1 text-xs text-indigo-600">
            Employees in {MONTHS[selectedMonth - 1]} {selectedYear}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-700">
              Pending Probation
            </p>
            <Clock className="h-5 w-5 text-emerald-500" />
          </div>

          <p className="mt-3 text-2xl font-bold text-emerald-700">
            {pendingProbationCount}
          </p>

          <p className="mt-1 text-xs text-emerald-600">
            Upcoming probation end dates
          </p>
        </div>
      </div>

      {/* Employee list */}
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Probation Employees
          </h3>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {probationEmployees.length} Employees
          </span>
        </div>

        {probationEmployees.length > 0 ? (
          <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[650px] text-left">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">
                    Employee ID
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">
                    Department
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">
                    Probation End Date
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">
                    Probation Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {probationEmployees.map((employee) => {
                  const probationDate = getDateOnly(
                    employee.probation_end_date
                  );

                  const isPastOrToday =
                    probationDate !== null &&
                    probationDate <= todayDate;

                  return (
                    <tr
                      key={employee.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`View ${employee.first_name} ${employee.last_name}`}
                      onClick={() =>
                        router.push(
                          `/dashboard/employees/${employee.id}`
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          router.push(
                            `/dashboard/employees/${employee.id}`
                          );
                        }
                      }}
                      className="cursor-pointer transition hover:bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                    >
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {employee.designation || "Employee"}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600">
                        {employee.employee_id || "-"}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600">
                        {employee.department?.name || "Unassigned"}
                      </td>

                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {probationDate
                          ? formatDate(probationDate)
                          : "-"}
                      </td>

                      <td className="px-4 py-3">
                        {isPastOrToday ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                            <Clock className="h-3 w-3" />
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
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
            <CalendarDays className="mb-3 h-8 w-8 text-slate-300" />

            <p className="text-sm font-medium text-slate-600">
              No probation employees found
            </p>

            <p className="mt-1 text-xs text-slate-400">
              No active employees have probation dates in{" "}
              {MONTHS[selectedMonth - 1]} {selectedYear}.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
