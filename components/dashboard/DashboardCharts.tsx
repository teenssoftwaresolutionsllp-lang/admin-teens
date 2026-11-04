"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface EmployeeChartItem {
  label: string;
  employees: number;
}

interface DepartmentChartItem {
  name: string;
  employees: number;
}

interface DashboardChartsProps {
  monthlyData: EmployeeChartItem[];
  yearlyData: EmployeeChartItem[];
  departmentData: DepartmentChartItem[];
}

const DEPARTMENT_COLORS = [
  "#6366F1",
  "#22C55E",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#8B5CF6",
  "#F97316",
  "#64748B",
];

export default function DashboardCharts({
  monthlyData,
  yearlyData,
  departmentData,
}: DashboardChartsProps) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  const chartData = period === "monthly" ? monthlyData : yearlyData;

  const totalDepartmentEmployees = useMemo(
    () =>
      departmentData.reduce(
        (total, department) => total + department.employees,
        0
      ),
    [departmentData]
  );

  return (
    <div className="grid h-full min-w-0 grid-cols-1 items-stretch gap-5 lg:grid-cols-5">
      {/* Employee Count Overview */}
      <section className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
        <div className="mb-5 flex min-h-[48px] flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Employee Count Overview
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Employee joining trends
            </p>
          </div>

          <div className="flex shrink-0 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              aria-pressed={period === "monthly"}
              className={`rounded-md px-4 py-2 text-xs font-medium transition ${
                period === "monthly"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setPeriod("yearly")}
              aria-pressed={period === "yearly"}
              className={`rounded-md px-4 py-2 text-xs font-medium transition ${
                period === "yearly"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="h-[300px] min-h-[300px] w-full min-w-0 flex-1">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  dy={10}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                />

                <Tooltip
                  cursor={{ fill: "#EEF2FF" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    fontSize: 12,
                  }}
                />

                <Bar
                  dataKey="employees"
                  name="Employees Joined"
                  fill="#6366F1"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No employee joining data available
            </div>
          )}
        </div>
      </section>

      {/* Department Wise Employees */}
      <section className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <div className="mb-4 min-h-[48px]">
          <h2 className="text-base font-semibold text-slate-800">
            Department Wise Employees
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Employee distribution by department
          </p>
        </div>

        {departmentData.length > 0 && totalDepartmentEmployees > 0 ? (
          <>
            <div className="relative mx-auto h-[190px] w-full max-w-[260px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    dataKey="employees"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {departmentData.map((department, index) => (
                      <Cell
                        key={department.name}
                        fill={
                          DEPARTMENT_COLORS[
                            index % DEPARTMENT_COLORS.length
                          ]
                        }
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value) => [
                      `${value} employees`,
                      "Employees",
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #E2E8F0",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-800">
                  {totalDepartmentEmployees}
                </span>
                <span className="text-xs text-slate-500">Employees</span>
              </div>
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {departmentData.map((department, index) => {
                const percentage =
                  (department.employees / totalDepartmentEmployees) * 100;

                return (
                  <div
                    key={department.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            DEPARTMENT_COLORS[
                              index % DEPARTMENT_COLORS.length
                            ],
                        }}
                      />

                      <span className="truncate text-xs text-slate-600">
                        {department.name}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs font-semibold text-slate-800">
                        {department.employees}
                      </span>
                      <span className="w-10 text-right text-xs text-slate-500">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex min-h-[300px] flex-1 items-center justify-center text-sm text-slate-400">
            No department data available
          </div>
        )}
      </section>
    </div>
  );
}
