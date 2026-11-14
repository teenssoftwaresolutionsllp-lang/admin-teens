"use client";

import { useEmployeeDashboardFilter } from "@/components/dashboard/EmployeeFilterProvider";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Employee } from "@/lib/types";
import QuickActions from "./QuickActions";
import {
  CalendarDays,
  Users,
  Building2,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface DashboardChartsProps {
  employees: Employee[];
}

type DashboardEmployee = Employee & {
  probation_end_date?: string | null;
};

type DepartmentChartItem = {
  departmentId: string | null;
  name: string;
  count: number;
  percentage: number;
  color: string;
};

const DEPARTMENT_COLORS = [
  "#6366F1",
  "#22C55E",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#8B5CF6",
  "#F97316",
  "#64748B",
  "#14B8A6",
  "#D946EF",
];

const MONTHS = [
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

function getDateOnly(value?: string | null) {
  if (!value) return null;

  const date = value.slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : null;
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

function getDonutSegmentPath(
  startAngle: number,
  endAngle: number,
  outerRadius: number,
  innerRadius: number
) {
  const center = 110;

  const point = (radius: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;

    return {
      x: Number((center + radius * Math.cos(radians)).toFixed(6)),
      y: Number((center + radius * Math.sin(radians)).toFixed(6)),
    };
  };

  if (endAngle - startAngle >= 359.99) {
    return [
      `M ${center} ${center - outerRadius}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${center} ${center + outerRadius}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${center} ${center - outerRadius}`,
      `M ${center} ${center - innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center + innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center - innerRadius}`,
      "Z",
    ].join(" ");
  }

  const outerStart = point(outerRadius, startAngle);
  const outerEnd = point(outerRadius, endAngle);
  const innerEnd = point(innerRadius, endAngle);
  const innerStart = point(innerRadius, startAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export default function DashboardCharts({
  employees,
}: DashboardChartsProps) {
  const currentYear = new Date().getFullYear();
  const router = useRouter();
  const { applyDashboardFilter } = useEmployeeDashboardFilter();

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [selectedDepartment, setSelectedDepartment] =
    useState<string | null>(null);

  const typedEmployees = employees as DashboardEmployee[];

  const activeEmployees = useMemo(
    () =>
      typedEmployees.filter(
        (employee) =>
          String(employee.status ?? "").toLowerCase() === "active"
      ),
    [typedEmployees]
  );

  const todayDate = getTodayDateOnly();

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

  // All active employees scheduled for probation in selected month/year.
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

  // Probation end date is today or earlier.
  // These employees still need HR confirmation.
  const completedProbationEmployees = probationEmployees.filter(
    (employee) => {
      const probationDate = getDateOnly(
        employee.probation_end_date
      );

      return probationDate && probationDate <= todayDate;
    }
  );

  // Future probation end dates.
  const pendingProbationEmployees = probationEmployees.filter(
    (employee) => {
      const probationDate = getDateOnly(
        employee.probation_end_date
      );

      return probationDate && probationDate > todayDate;
    }
  );

  const pendingProbationCount = pendingProbationEmployees.length;

  // Department-wise workforce distribution.
  const departmentData = useMemo<DepartmentChartItem[]>(() => {
    const departmentMap = new Map<
      string,
      {
        departmentId: string | null;
        name: string;
        count: number;
      }
    >();

    activeEmployees.forEach((employee) => {
      const departmentId = employee.department_id || null;
      const departmentName = employee.department?.name || "Unassigned";
      const key = departmentId || `unassigned-${departmentName}`;

      const existing = departmentMap.get(key);

      if (existing) {
        existing.count++;
      } else {
        departmentMap.set(key, {
          departmentId,
          name: departmentName,
          count: 1,
        });
      }
    });

    const total = Array.from(departmentMap.values()).reduce(
      (sum, department) => sum + department.count,
      0
    );

    return Array.from(departmentMap.values())
      .map((department, index) => ({
        ...department,
        percentage:
          total > 0 ? (department.count / total) * 100 : 0,
        color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [activeEmployees]);

  const totalDepartmentEmployees = departmentData.reduce(
    (total, department) => total + department.count,
    0
  );

  const selectedDepartmentData = departmentData.find(
    (department) => department.name === selectedDepartment
  );

  const handleDepartmentClick = (departmentName: string) => {
    setSelectedDepartment((current) =>
      current === departmentName ? null : departmentName
    );
  };

  const handleDepartmentDoubleClick = (departmentName: string) => {
    const department = departmentData.find(
      (item) => item.name === departmentName
    );

    if (!department) return;

    applyDashboardFilter({
      status: "active",
      departmentId: department.departmentId,
      departmentName: department.name,
    });

    router.push("/dashboard/employees");
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-5">
      {/* Quick Actions */}
      <div className="min-w-0 xl:col-span-3">
        <QuickActions />
      </div>

      {/* Department-wise Employees */}
      <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-800">
            Department-wise Employees
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Overall employee distribution
          </p>
        </div>

        {activeEmployees.length > 0 && departmentData.length > 0 ? (
          <>
            {/* Interactive doughnut chart */}
            <div className="flex justify-center py-3">
              <div className="relative h-56 w-56 shrink-0">
                <svg
                  viewBox="0 0 220 220"
                  className="h-full w-full -rotate-90"
                  role="img"
                  aria-label="Interactive department employee distribution chart"
                >
                  {(() => {
                    let currentAngle = 0;

                    return departmentData.map((department) => {
                      const percentage =
                        totalDepartmentEmployees > 0
                          ? department.count / totalDepartmentEmployees
                          : 0;

                      const startAngle = currentAngle - 90;
                      const endAngle =
                        currentAngle + percentage * 360 - 90;

                      currentAngle += percentage * 360;

                      const isSelected =
                        selectedDepartment === department.name;

                      return (
                        <path
                          key={department.name}
                          d={getDonutSegmentPath(
                            startAngle,
                            endAngle,
                            94,
                            82
                          )}
                          fill={department.color}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="cursor-pointer transition-opacity duration-200"
                          style={{
                            opacity:
                              selectedDepartment && !isSelected
                                ? 0.3
                                : 1,
                          }}
                          onClick={() =>
                            handleDepartmentClick(department.name)
                          }
                          onDoubleClick={() =>
                            handleDepartmentDoubleClick(department.name)
                          }
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Centre value */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-slate-800">
                    {selectedDepartmentData
                      ? selectedDepartmentData.count
                      : activeEmployees.length}
                  </span>

                  <span className="mt-1 max-w-[125px] truncate text-xs font-medium text-slate-500">
                    {selectedDepartmentData
                      ? selectedDepartmentData.name
                      : "Total Employees"}
                  </span>

                  {selectedDepartmentData && (
                    <span className="mt-1 text-[10px] text-indigo-600">
                      {(
                        (selectedDepartmentData.count /
                          totalDepartmentEmployees) *
                        100
                      ).toFixed(1)}
                      % of workforce
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Department legend */}
            <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {departmentData.map((department) => {
                const isSelected =
                  selectedDepartment === department.name;

                return (
                  <button
                    key={department.name}
                    type="button"
                    onClick={() => handleDepartmentClick(department.name)}
                    onDoubleClick={() =>
                      handleDepartmentDoubleClick(department.name)
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left transition ${
                      isSelected
                        ? "bg-indigo-50 ring-1 ring-indigo-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{
                          backgroundColor: department.color,
                        }}
                      />

                      <span className="truncate text-xs font-medium text-slate-700">
                        {department.name}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs font-semibold text-slate-800">
                        {department.count}
                      </span>

                      <span className="w-10 text-right text-[11px] text-slate-500">
                        {department.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Total Departments
                </span>

                <span className="text-sm font-bold text-slate-800">
                  {departmentData.length}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
            <Building2 className="mb-3 h-8 w-8 text-slate-300" />

            <p className="text-sm font-medium text-slate-600">
              No department data available
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
