"use client";

import { useEmployeeDashboardFilter } from "@/components/dashboard/EmployeeFilterProvider";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Employee } from "@/lib/types";
import Link from "next/link";
import { PieChart, ArrowRight, Building2 } from "lucide-react";

interface DepartmentEmployeesWidgetProps {
  employees: Employee[];
}

type DepartmentChartItem = {
  departmentId: string | null;
  name: string;
  count: number;
  percentage: number;
  color: string;
};

// Vibrant colors matching the dashboard screenshot (Blue, Purple, Orange, Green)
const DEPARTMENT_COLORS = [
  "#3B82F6", // Engineering / Blue
  "#8B5CF6", // Design / Purple
  "#F97316", // Sales / Orange
  "#10B981", // HR / Green
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#EAB308", // Yellow
  "#64748B", // Slate
];

function getDonutSegmentPath(
  startAngle: number,
  endAngle: number,
  outerRadius: number,
  innerRadius: number
) {
  const center = 100;

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

export default function DepartmentEmployeesWidget({
  employees,
}: DepartmentEmployeesWidgetProps) {
  const router = useRouter();
  const { applyDashboardFilter } = useEmployeeDashboardFilter();
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          String(employee.status ?? "").toLowerCase() === "active"
      ),
    [employees]
  );

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
        percentage: total > 0 ? (department.count / total) * 100 : 0,
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
    <section className="relative flex h-full min-w-0 w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <PieChart className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Department-wise Employees
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Overall employee distribution
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/employees"
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            View Details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Content: Donut + Legend */}
        {activeEmployees.length > 0 && departmentData.length > 0 ? (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 py-1">
            {/* Donut Chart */}
            <div className="relative h-44 w-44 shrink-0 sm:h-48 sm:w-48">
              <svg
                viewBox="0 0 200 200"
                className="h-full w-full -rotate-90"
                role="img"
                aria-label="Department employee distribution chart"
              >
                {(() => {
                  let currentAngle = 0;
                  return departmentData.map((department) => {
                    const percentage =
                      totalDepartmentEmployees > 0
                        ? department.count / totalDepartmentEmployees
                        : 0;

                    const startAngle = currentAngle - 90;
                    const endAngle = currentAngle + percentage * 360 - 90;
                    currentAngle += percentage * 360;

                    const isSelected = selectedDepartment === department.name;

                    return (
                      <path
                        key={department.name}
                        d={getDonutSegmentPath(startAngle, endAngle, 85, 68)}
                        fill={department.color}
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        className="cursor-pointer transition-opacity duration-200 hover:opacity-90"
                        style={{
                          opacity:
                            selectedDepartment && !isSelected ? 0.35 : 1,
                        }}
                        onClick={() => handleDepartmentClick(department.name)}
                        onDoubleClick={() =>
                          handleDepartmentDoubleClick(department.name)
                        }
                      />
                    );
                  });
                })()}
              </svg>

              {/* Centre value */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {selectedDepartmentData
                    ? selectedDepartmentData.count
                    : totalDepartmentEmployees}
                </span>
                <span className="max-w-[100px] truncate text-[11px] font-semibold text-slate-400 mt-0.5">
                  {selectedDepartmentData
                    ? selectedDepartmentData.name
                    : "Total Employees"}
                </span>
              </div>
            </div>

            {/* Department Legend */}
            <div className="w-full min-w-0 flex-1 space-y-2.5 max-h-[175px] overflow-y-auto pr-1">
              {departmentData.map((department) => {
                const isSelected = selectedDepartment === department.name;
                return (
                  <button
                    key={department.name}
                    type="button"
                    onClick={() => handleDepartmentClick(department.name)}
                    onDoubleClick={() =>
                      handleDepartmentDoubleClick(department.name)
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 text-left transition ${
                      isSelected
                        ? "bg-indigo-50/80 ring-1 ring-indigo-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: department.color }}
                      />
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {department.name}
                      </span>
                    </div>

                    <span className="shrink-0 text-xs font-bold text-slate-800">
                      {Math.round(department.percentage)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 mt-4">
            <Building2 className="mb-2 h-7 w-7 text-slate-300" />
            <p className="text-xs font-medium text-slate-500">
              No department data available
            </p>
          </div>
        )}
      </div>

      {/* Decorative subtle blue wave gradient at bottom matching screenshot */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-blue-50/50 to-transparent"
        aria-hidden="true"
      />
    </section>
  );
}
