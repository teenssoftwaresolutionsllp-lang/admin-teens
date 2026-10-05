"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  Settings,
  Play,
  CheckCircle2,
  Loader2,
  FileText,
  Eye,
  Sliders,
  XCircle,
  Printer,
  Users,
  CalendarDays,
  IndianRupee,
  TrendingDown,
  ShieldCheck,
  ChevronRight,
  Briefcase,
  CircleDollarSign,
  UserRound,
  User,
  Clock3,
  Info,
  Search,
  CreditCard,
} from "lucide-react";
import Image from "next/image";

import {
  SalaryComponent,
  Payslip,
  Employee,
} from "@/lib/types";

import { numberToWordsIndian } from "@/lib/calculations";

interface PayrollManagerProps {
  initialComponents: SalaryComponent[];
  initialPayslips: Payslip[];
  employees: Employee[];
}

type ActiveTab = "runner" | "components" | "slips";

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

const monthNames = [
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

const formatCurrency = (value: number | null | undefined) => {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

const formatNumber = (value: number | null | undefined) => {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
};

export default function PayrollManager({
  initialComponents,
  initialPayslips,
  employees: initialEmployees,
}: PayrollManagerProps) {
  const now = new Date();

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [employees] = useState<Employee[]>(initialEmployees);
  const [components, setComponents] =
    useState<SalaryComponent[]>(initialComponents);

  const [payslips, setPayslips] =
    useState<Payslip[]>(initialPayslips);

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("runner");

  const [selectedMonth, setSelectedMonth] =
    useState<number>(currentMonth);

  const [selectedYear, setSelectedYear] =
    useState<number>(currentYear);

  const [selectedEmployee, setSelectedEmployee] =
    useState<string>("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [running, setRunning] =
    useState(false);

  const [componentLoading, setComponentLoading] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<MessageState>(null);

  const [previewSlip, setPreviewSlip] =
    useState<Payslip | null>(null);

  const [showFilters, setShowFilters] =
    useState(false);

  /* =========================================================
     EMPLOYEES
  ========================================================= */

  const activeEmployees = useMemo(() => {
    return employees.filter(
      (employee) => employee.status === "active"
    );
  }, [employees]);

  const selectedEmployeeData = useMemo(() => {
    return employees.find(
      (employee) => employee.id === selectedEmployee
    );
  }, [employees, selectedEmployee]);

  /* =========================================================
     PAYSLIPS
  ========================================================= */

  const filteredPayslips = useMemo(() => {
    return payslips.filter((slip) => {
      const employee = slip.employee;

      const matchesMonth =
        slip.payroll_month === selectedMonth &&
        slip.payroll_year === selectedYear;

      if (!matchesMonth) return false;

      if (!searchTerm.trim()) return true;

      const search = searchTerm.toLowerCase();

      return (
        employee?.first_name?.toLowerCase().includes(search) ||
        employee?.last_name?.toLowerCase().includes(search) ||
        employee?.employee_id?.toLowerCase().includes(search) ||
        employee?.email?.toLowerCase().includes(search)
      );
    });
  }, [
    payslips,
    selectedMonth,
    selectedYear,
    searchTerm,
  ]);

  /* =========================================================
     PAYROLL METRICS
  ========================================================= */

  const payrollMetrics = useMemo(() => {
    const periodSlips = payslips.filter(
      (slip) =>
        slip.payroll_month === selectedMonth &&
        slip.payroll_year === selectedYear
    );

    const netPayout = periodSlips.reduce(
      (sum, slip) => sum + Number(slip.net_salary || 0),
      0
    );

    const lopDeduction = periodSlips.reduce(
      (sum, slip) => sum + Number(slip.lop_deduction || 0),
      0
    );

    const grossSalary = periodSlips.reduce(
      (sum, slip) => sum + Number(slip.gross_salary || 0),
      0
    );

    return {
      employeeCount: periodSlips.length,
      netPayout,
      lopDeduction,
      grossSalary,
      activeComponents: components.filter(
        (component) => component.is_active
      ).length,
    };
  }, [
    payslips,
    selectedMonth,
    selectedYear,
    components,
  ]);

  /* =========================================================
     PERIOD VALIDATION
  ========================================================= */

  const isFuturePeriod =
    selectedYear > currentYear ||
    (selectedYear === currentYear &&
      selectedMonth > currentMonth);

  const availableYears = Array.from(
    { length: 5 },
    (_, index) => currentYear - index
  );

  /* =========================================================
     RUN PAYROLL
  ========================================================= */

  const handleRunPayroll = async () => {
    setMessage(null);

    if (!selectedEmployee) {
      setMessage({
        type: "error",
        text: "Please select an employee before generating payroll.",
      });
      return;
    }

    if (isFuturePeriod) {
      setMessage({
        type: "error",
        text: "Payroll cannot be generated for a future month.",
      });
      return;
    }

    try {
      setRunning(true);

      const response = await fetch("/api/payroll/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          month: selectedMonth,
          year: selectedYear,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to generate payroll."
        );
      }

      if (data.payslips?.length) {
        setPayslips((previous) => {
          const generated = data.payslips as Payslip[];

          const withoutGenerated = previous.filter(
            (existing) =>
              !generated.some(
                (newSlip) =>
                  newSlip.employee_id === existing.employee_id &&
                  newSlip.payroll_month === existing.payroll_month &&
                  newSlip.payroll_year === existing.payroll_year
              )
          );

          return [...generated, ...withoutGenerated];
        });
      }

      setMessage({
        type: "success",
        text: `Payroll generated successfully for ${selectedEmployeeData?.first_name || "employee"}.`,
      });

      setActiveTab("slips");
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Something went wrong while generating payroll.",
      });
    } finally {
      setRunning(false);
    }
  };

  /* =========================================================
     TOGGLE SALARY COMPONENT
  ========================================================= */

  const handleToggleComponent = async (
    component: SalaryComponent
  ) => {
    setMessage(null);
    setComponentLoading(component.id);

    try {
      const response = await fetch(
        "/api/payroll/components",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: component.id,
            is_active: !component.is_active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to update salary component."
        );
      }

      setComponents((previous) =>
        previous.map((item) =>
          item.id === component.id
            ? {
                ...item,
                is_active: !item.is_active,
              }
            : item
        )
      );

      setMessage({
        type: "success",
        text: `${component.name} has been ${
          component.is_active ? "disabled" : "enabled"
        }.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Failed to update salary component.",
      });
    } finally {
      setComponentLoading(null);
    }
  };

  /* =========================================================
     PRINT PAYSLIP
  ========================================================= */

  const handlePrintPayslip = () => {
    window.print();
  };

  /* =========================================================
     TAB CONFIG
  ========================================================= */

  const tabs = [
    {
      id: "runner" as ActiveTab,
      label: "Payroll Runner",
      description: "Generate monthly payroll",
      icon: Play,
    },
    {
      id: "components" as ActiveTab,
      label: "Salary Components",
      description: "Configure salary heads",
      icon: Sliders,
    },
    {
      id: "slips" as ActiveTab,
      label: "Payslips",
      description: "View generated payroll",
      icon: FileText,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-600">
                <Banknote className="h-4 w-4" />
                Payroll Management
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Payroll
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage salary components, generate payroll and
                review employee payslips.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <CalendarDays className="h-4 w-4 text-slate-500" />

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Current Period
                  </p>

                  <p className="text-sm font-semibold text-slate-700">
                    {monthNames[currentMonth - 1]}{" "}
                    {currentYear}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        {/* ===================================================
            MESSAGE
        =================================================== */}

        {message && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            )}

            <div className="flex-1">
              <p className="text-sm font-semibold">
                {message.type === "success"
                  ? "Success"
                  : "Unable to continue"}
              </p>

              <p className="mt-0.5 text-sm">
                {message.text}
              </p>
            </div>

            <button
              onClick={() => setMessage(null)}
              className="rounded-lg p-1 hover:bg-black/5"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ===================================================
            KPI CARDS
        =================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={CircleDollarSign}
            label="Net Monthly Payout"
            value={formatCurrency(payrollMetrics.netPayout)}
            helper={`${payrollMetrics.employeeCount} payslip${
              payrollMetrics.employeeCount === 1 ? "" : "s"
            } generated`}
          />

          <MetricCard
            icon={TrendingDown}
            label="LOP Deductions"
            value={formatCurrency(
              payrollMetrics.lopDeduction
            )}
            helper="Loss of pay deduction"
          />

          <MetricCard
            icon={Users}
            label="Employees Processed"
            value={String(
              payrollMetrics.employeeCount
            )}
            helper={`of ${activeEmployees.length} active employees`}
          />

          <MetricCard
            icon={Settings}
            label="Active Salary Heads"
            value={String(
              payrollMetrics.activeComponents
            )}
            helper={`of ${components.length} configured`}
          />
        </div>

        {/* ===================================================
            NAVIGATION
        =================================================== */}

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      active
                        ? "bg-white/15"
                        : "bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {tab.label}
                    </p>

                    <p
                      className={`mt-0.5 text-xs ${
                        active
                          ? "text-indigo-100"
                          : "text-slate-400"
                      }`}
                    >
                      {tab.description}
                    </p>
                  </div>

                  {active && (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===================================================
            PAYROLL RUNNER
        =================================================== */}

        {activeTab === "runner" && (
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                        <Play className="h-5 w-5 text-indigo-600" />
                      </div>

                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Run Payroll
                        </h2>

                        <p className="text-sm text-slate-500">
                          Generate a payslip for an employee.
                        </p>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Payroll Ready
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  {/* Employee */}

                  <div className="md:col-span-3">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Employee
                    </label>

                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <select
                        value={selectedEmployee}
                        onChange={(event) =>
                          setSelectedEmployee(
                            event.target.value
                          )
                        }
                        className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                      >
                        <option value="">
                          Select an employee
                        </option>

                        {activeEmployees.map(
                          (employee) => (
                            <option
                              key={employee.id}
                              value={employee.id}
                            >
                              {employee.first_name}{" "}
                              {employee.last_name} —{" "}
                              {employee.employee_id}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Month */}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Payroll Month
                    </label>

                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <select
                        value={selectedMonth}
                        onChange={(event) =>
                          setSelectedMonth(
                            Number(event.target.value)
                          )
                        }
                        className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                      >
                        {monthNames.map(
                          (month, index) => {
                            const monthNumber =
                              index + 1;

                            const future =
                              selectedYear >
                                currentYear ||
                              (selectedYear ===
                                currentYear &&
                                monthNumber >
                                  currentMonth);

                            return (
                              <option
                                key={month}
                                value={monthNumber}
                                disabled={future}
                              >
                                {month}
                                {future
                                  ? " — Future"
                                  : ""}
                              </option>
                            );
                          }
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Year */}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Payroll Year
                    </label>

                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <select
                        value={selectedYear}
                        onChange={(event) => {
                          const year = Number(
                            event.target.value
                          );

                          setSelectedYear(year);

                          if (
                            year === currentYear &&
                            selectedMonth >
                              currentMonth
                          ) {
                            setSelectedMonth(
                              currentMonth
                            );
                          }
                        }}
                        className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                      >
                        {availableYears.map(
                          (year) => (
                            <option
                              key={year}
                              value={year}
                            >
                              {year}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Period */}

                  <div className="flex items-end">
                    <div className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4">
                      <CalendarDays className="h-4 w-4 text-slate-500" />

                      <span className="text-sm font-semibold text-slate-700">
                        {monthNames[
                          selectedMonth - 1
                        ]}{" "}
                        {selectedYear}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Future warning */}

                {isFuturePeriod && (
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Future payroll is disabled
                      </p>

                      <p className="mt-1 text-xs leading-5 text-amber-700">
                        Payroll can only be generated for
                        the current month or an earlier
                        month.
                      </p>
                    </div>
                  </div>
                )}

                {/* Employee preview */}

                {selectedEmployeeData && (
                  <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                          {selectedEmployeeData.first_name?.charAt(
                            0
                          )}
                          {selectedEmployeeData.last_name?.charAt(
                            0
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-slate-900">
                            {
                              selectedEmployeeData.first_name
                            }{" "}
                            {
                              selectedEmployeeData.last_name
                            }
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>
                              {
                                selectedEmployeeData.employee_id
                              }
                            </span>

                            <span>•</span>

                            <span>
                              {
                                selectedEmployeeData.email
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm">
                        <IndianRupee className="h-4 w-4 text-indigo-600" />

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Annual CTC
                          </p>

                          <p className="text-sm font-bold text-slate-800">
                            {formatNumber(
                              Number(
                                selectedEmployeeData.salary ||
                                  0
                              )
                            )}{" "}
                            Lakh
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generate */}

                <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Ready to process?
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      The generated payslip will be saved
                      against the selected employee and
                      payroll period.
                    </p>
                  </div>

                  <button
                    onClick={handleRunPayroll}
                    disabled={
                      running ||
                      !selectedEmployee ||
                      isFuturePeriod
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {running ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Generate Payroll
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Automation info */}

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Payroll Controls
                    </h3>

                    <p className="text-xs text-slate-500">
                      Automated checks
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <ControlItem
                    label="Active employee"
                    enabled={Boolean(
                      selectedEmployeeData
                    )}
                  />

                  <ControlItem
                    label="Valid payroll period"
                    enabled={!isFuturePeriod}
                  />

                  <ControlItem
                    label="Salary components"
                    enabled={
                      payrollMetrics.activeComponents >
                      0
                    }
                  />

                  <ControlItem
                    label="Payroll calculation"
                    enabled={true}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <Info className="h-5 w-5" />
                  </div>

                  <h3 className="text-sm font-bold">
                    Payroll Processing
                  </h3>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-300">
                  Payroll uses the employee's annual CTC,
                  active salary components, attendance and
                  applicable LOP deductions to calculate the
                  monthly payslip.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            SALARY COMPONENTS
        =================================================== */}

        {activeTab === "components" && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                    <Sliders className="h-5 w-5 text-indigo-600" />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Salary Components
                    </h2>

                    <p className="text-sm text-slate-500">
                      Configure the salary heads used during
                      payroll calculation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
                <Settings className="h-4 w-4 text-slate-500" />

                <span className="text-sm font-semibold text-slate-700">
                  {components.filter(
                    (item) => item.is_active
                  ).length}{" "}
                  active
                </span>
              </div>
            </div>

            {components.length === 0 ? (
              <EmptyState
                icon={Sliders}
                title="No salary components"
                description="Salary components will appear here once configured."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Salary Head
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Code
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Type
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Calculation
                      </th>

                      <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                        LOP Impact
                      </th>

                      <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {components.map((component) => (
                      <tr
                        key={component.id}
                        className="transition hover:bg-slate-50/60"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                              <Banknote className="h-4 w-4 text-slate-600" />
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {component.name}
                              </p>

                              {component.description && (
                                <p className="mt-0.5 max-w-[260px] truncate text-xs text-slate-400">
                                  {component.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-600">
                            {component.code}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm capitalize text-slate-600">
                            {component.calculation_type ||
                              "Fixed"}
                          </span>
                        </td>

                        {/* <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">
                            {component.calculation_formula ||
                              "Configured automatically"}
                          </span>
                        </td> */}

                        <td className="px-6 py-4 text-center">
                          {component.affects_lop ? (
                            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                              No
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          {component.is_active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Disabled
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() =>
                              handleToggleComponent(
                                component
                              )
                            }
                            disabled={
                              componentLoading ===
                              component.id
                            }
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              component.is_active
                                ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {componentLoading ===
                            component.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : component.is_active ? (
                              "Disable"
                            ) : (
                              "Enable"
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===================================================
            PAYSLIPS
        =================================================== */}

        {activeTab === "slips" && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Generated Payslips
                    </h2>

                    <p className="text-sm text-slate-500">
                      {monthNames[selectedMonth - 1]}{" "}
                      {selectedYear}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(
                        event.target.value
                      )
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 sm:w-64"
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                    showFilters
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CalendarDays className="h-4 w-4" />
                  Period
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-md">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Month
                    </label>

                    <select
                      value={selectedMonth}
                      onChange={(event) =>
                        setSelectedMonth(
                          Number(event.target.value)
                        )
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
                    >
                      {monthNames.map(
                        (month, index) => (
                          <option
                            key={month}
                            value={index + 1}
                          >
                            {month}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Year
                    </label>

                    <select
                      value={selectedYear}
                      onChange={(event) =>
                        setSelectedYear(
                          Number(event.target.value)
                        )
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
                    >
                      {availableYears.map(
                        (year) => (
                          <option
                            key={year}
                            value={year}
                          >
                            {year}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {filteredPayslips.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No payslips found"
                description={`There are no generated payslips for ${monthNames[selectedMonth - 1]} ${selectedYear}.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Employee
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        Pay Period
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Gross Salary
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        LOP
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        LOP Deduction
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Deductions
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Net Salary
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredPayslips.map(
                      (slip) => {
                        const employee =
                          slip.employee;

                        return (
                          <tr
                            key={slip.id}
                            className="transition hover:bg-slate-50/60"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                                  {employee?.first_name?.charAt(
                                    0
                                  )}
                                  {employee?.last_name?.charAt(
                                    0
                                  )}
                                </div>

                                <div>
                                  <p className="text-sm font-semibold text-slate-800">
                                    {
                                      employee?.first_name
                                    }{" "}
                                    {
                                      employee?.last_name
                                    }
                                  </p>

                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {
                                      employee?.employee_id
                                    }
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-slate-400" />

                                <span className="text-sm font-medium text-slate-700">
                                  {slip.month_name}{" "}
                                  {
                                    slip.payroll_year
                                  }
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-semibold text-slate-700">
                                {formatCurrency(
                                  slip.gross_salary
                                )}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  Number(
                                    slip.lop_days || 0
                                  ) > 0
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {formatNumber(
                                  slip.lop_days
                                )}{" "}
                                days
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-red-600">
                                -
                                {formatCurrency(
                                  slip.lop_deduction
                                )}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-slate-600">
                                {formatCurrency(
                                  slip.total_deductions
                                )}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-bold text-slate-900">
                                {formatCurrency(
                                  slip.net_salary
                                )}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() =>
                                  setPreviewSlip(
                                    slip
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =====================================================
          PAYSLIP MODAL
      ===================================================== */}
      {previewSlip && (
        <div className="fixed inset-0 z-[100]">

          {/* ========================================================= */}
          {/* BACKDROP */}
          {/* ========================================================= */}

          <div
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-md"
            onClick={() => setPreviewSlip(null)}
          />

          {/* ========================================================= */}
          {/* MODAL */}
          {/* ========================================================= */}

          <div className="relative z-10 flex h-full w-full items-center justify-center p-3 sm:p-5">

            <div className="flex h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

              {/* ===================================================== */}
              {/* MODAL TOP BAR */}
              {/* ===================================================== */}

              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Payslip
                    </h2>

                    <p className="text-xs text-slate-500">
                      {previewSlip.month_name} {previewSlip.payroll_year}
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-2">

                  <button
                    onClick={handlePrintPayslip}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>

                  <button
                    onClick={() => setPreviewSlip(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>

                </div>
              </div>

              {/* ===================================================== */}
              {/* SCROLL AREA */}
              {/* ===================================================== */}

              <div
                id="payslip-print"
                className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 lg:p-8"
              >

                {/* =================================================== */}
                {/* PAYSLIP DOCUMENT */}
                {/* =================================================== */}

                <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-sm">

                  {/* ================================================= */}
                  {/* COMPANY HEADER */}
                  {/* ================================================= */}

                  <div className="border-b border-slate-200 px-5 py-6 sm:px-8">

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                      {/* Logo */}

                      <div>
                        <Image
                          src="/logo.png"
                          alt="Teens Software Solutions"
                          width={180}
                          height={60}
                          className="h-auto w-auto max-w-[180px] object-contain"
                        />
                      </div>

                      {/* Payslip title */}

                      <div className="sm:text-right">

                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
                          Salary Statement
                        </p>

                        <h1 className="mt-1 text-2xl font-bold uppercase tracking-tight text-slate-900">
                          Payslip
                        </h1>

                        <p className="mt-1 text-xs text-slate-500">
                          {previewSlip.month_name}{" "}
                          {previewSlip.payroll_year}
                        </p>

                      </div>

                    </div>

                    <div className="mt-6 h-1 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500" />

                  </div>

                  {/* ================================================= */}
                  {/* EMPLOYEE INFORMATION */}
                  {/* ================================================= */}

                  <div className="px-5 py-5 sm:px-8">

                    <div className="overflow-hidden rounded-xl border border-slate-200">

                      {/* Section Header */}

                      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">

                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                          <User className="h-4 w-4 text-indigo-600" />
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Employee Information
                          </h3>

                          <p className="text-[10px] text-slate-500">
                            Employee and payroll details
                          </p>
                        </div>

                      </div>

                      {/* Employee Fields */}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">

                        {/* Employee Code */}
                        <div className="border-b border-slate-200 p-4 sm:border-r">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            Employee Code
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {previewSlip.employee?.employee_id || "-"}
                          </p>
                        </div>

                        {/* Department */}
                        <div className="border-b border-slate-200 p-4 lg:border-r">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            Department
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {previewSlip.employee?.department?.name || "-"}
                          </p>
                        </div>

                        {/* Location */}
                        <div className="border-b border-slate-200 p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            Location
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {previewSlip.employee?.work_location || "-"}
                          </p>
                        </div>

                        {/* Employee Name */}
                        <div className="border-b border-slate-200 p-4 sm:border-r">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            Employee Name
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {`${previewSlip.employee?.first_name || ""} ${
                              previewSlip.employee?.last_name || ""
                            }`.trim() || "-"}
                          </p>
                        </div>

                        {/* Designation */}
                        <div className="border-b border-slate-200 p-4 lg:border-r">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            Designation
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {previewSlip.employee?.designation || "-"}
                          </p>
                        </div>

                        {/* Date of Hire */}
                        <div className="border-b border-slate-200 p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            Date of Hire
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {previewSlip.employee?.joining_date
                              ? new Date(
                                  previewSlip.employee.joining_date
                                ).toLocaleDateString("en-IN")
                              : "-"}
                          </p>
                        </div>

                        {/* PF */}
                        <div className="border-b border-slate-200 p-4 sm:border-r">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            PF Number
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {previewSlip.employee?.uan_number || "-"}
                          </p>
                        </div>

                        {/* UAN */}
                        <div className="border-b border-slate-200 p-4 lg:border-r">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            UAN
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {previewSlip.employee?.uan_number || "-"}
                          </p>
                        </div>

                        {/* ESI */}
                        <div className="border-b border-slate-200 p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            ESI Number
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {previewSlip.employee?.esi_number || "-"}
                          </p>
                        </div>

                      </div>

                      {/* Attendance Summary */}

                      <div className="grid grid-cols-2 border-t border-slate-200 bg-slate-50 sm:grid-cols-4">

                        <div className="border-r border-slate-200 px-4 py-4">
                          <p className="text-[9px] font-semibold uppercase text-slate-400">
                            Standard Days
                          </p>

                          <p className="mt-1 text-base font-bold text-slate-900">
                            {formatNumber(previewSlip.working_days)}
                          </p>
                        </div>

                        <div className="border-b border-slate-200 px-4 py-4 sm:border-b-0 sm:border-r">
                          <p className="text-[9px] font-semibold uppercase text-slate-400">
                            Days Worked
                          </p>

                          <p className="mt-1 text-base font-bold text-slate-900">
                            {formatNumber(previewSlip.present_days)}
                          </p>
                        </div>

                        <div className="border-r border-slate-200 px-4 py-4">
                          <p className="text-[9px] font-semibold uppercase text-slate-400">
                            Paid Leave
                          </p>

                          <p className="mt-1 text-base font-bold text-emerald-600">
                            {formatNumber(previewSlip.paid_leaves)}
                          </p>
                        </div>

                        <div className="px-4 py-4">
                          <p className="text-[9px] font-semibold uppercase text-slate-400">
                            LWOP / LOP Days
                          </p>

                          <p className="mt-1 text-base font-bold text-rose-600">
                            {formatNumber(previewSlip.lop_days)}
                          </p>
                        </div>

                      </div>

                    </div>
                  </div>

                  {/* ================================================= */}
                  {/* EARNINGS + DEDUCTIONS */}
                  {/* ================================================= */}

                  <div className="grid grid-cols-1 gap-5 px-5 pb-5 sm:px-8 lg:grid-cols-2">

                    {/* ================================================= */}
                    {/* EARNINGS */}
                    {/* ================================================= */}

                    <div className="overflow-hidden rounded-xl border border-indigo-100">

                      {/* Header */}

                      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-white">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                            <Briefcase className="h-4 w-4" />
                          </div>

                          <div>
                            <h3 className="text-sm font-bold">
                              Earnings
                            </h3>

                            <p className="text-[9px] text-indigo-100">
                              Monthly earnings
                            </p>
                          </div>

                        </div>

                        <span className="text-[9px] font-semibold uppercase tracking-wide text-indigo-100">
                          Amount
                        </span>

                      </div>

                      {/* Table Header */}

                      <div className="grid grid-cols-[1fr_115px] border-b border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">

                        <span>
                          Component
                        </span>

                        <span className="text-right">
                          Current Month
                        </span>

                      </div>

                      {/* Earnings */}

                      <div>

                        {Array.isArray(previewSlip.earnings_breakup) &&
                        previewSlip.earnings_breakup.length > 0 ? (

                          previewSlip.earnings_breakup.map(
                            (item: any, index: number) => (

                              <div
                                key={`earning-${index}`}
                                className="grid grid-cols-[1fr_115px] border-b border-slate-100 px-4 py-3"
                              >

                                <span className="text-xs text-slate-700">
                                  {item.name || "-"}
                                </span>

                                <span className="text-right text-xs font-semibold text-slate-900">
                                  {formatCurrency(item.amount ?? 0)}
                                </span>

                              </div>

                            )
                          )

                        ) : typeof previewSlip.earnings_breakup === "object" &&
                          previewSlip.earnings_breakup !== null &&
                          Object.keys(previewSlip.earnings_breakup).length > 0 ? (

                          Object.entries(
                            previewSlip.earnings_breakup as Record<string, any>
                          ).map(([key, value]) => {

                            const amount =
                              typeof value === "object" && value !== null
                                ? Number(value.amount || 0)
                                : Number(value || 0);

                            return (
                              <div
                                key={key}
                                className="grid grid-cols-[1fr_115px] border-b border-slate-100 px-4 py-3"
                              >

                                <span className="text-xs text-slate-700">
                                  {key
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (char) =>
                                      char.toUpperCase()
                                    )}
                                </span>

                                <span className="text-right text-xs font-semibold text-slate-900">
                                  {formatCurrency(amount)}
                                </span>

                              </div>
                            );
                          })

                        ) : (

                          <div className="px-4 py-8 text-center text-xs text-slate-400">
                            No earnings available
                          </div>

                        )}

                      </div>

                      {/* Total */}

                      <div className="flex items-center justify-between border-t border-indigo-100 bg-indigo-50 px-4 py-4">

                        <span className="text-xs font-bold text-indigo-900">
                          Gross Earnings
                        </span>

                        <span className="text-sm font-bold text-indigo-700">
                          {formatCurrency(previewSlip.total_earnings)}
                        </span>

                      </div>

                    </div>

                    {/* ================================================= */}
                    {/* DEDUCTIONS */}
                    {/* ================================================= */}

                    <div className="overflow-hidden rounded-xl border border-rose-100">

                      {/* Header */}

                      <div className="flex items-center justify-between bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-3 text-white">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                            <CreditCard className="h-4 w-4" />
                          </div>

                          <div>
                            <h3 className="text-sm font-bold">
                              Deductions
                            </h3>

                            <p className="text-[9px] text-rose-100">
                              Monthly deductions
                            </p>
                          </div>

                        </div>

                        <span className="text-[9px] font-semibold uppercase tracking-wide text-rose-100">
                          Amount
                        </span>

                      </div>

                      {/* Table Header */}

                      <div className="grid grid-cols-[1fr_115px] border-b border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">

                        <span>
                          Component
                        </span>

                        <span className="text-right">
                          Current Month
                        </span>

                      </div>

                      {/* Deductions */}

                      <div>

                        {Array.isArray(previewSlip.deductions_breakup) &&
                        previewSlip.deductions_breakup.length > 0 ? (

                          previewSlip.deductions_breakup.map(
                            (item: any, index: number) => (

                              <div
                                key={`deduction-${index}`}
                                className="grid grid-cols-[1fr_115px] border-b border-slate-100 px-4 py-3"
                              >

                                <span className="text-xs text-slate-700">
                                  {item.name || "-"}
                                </span>

                                <span className="text-right text-xs font-semibold text-rose-600">
                                  {formatCurrency(item.amount ?? 0)}
                                </span>

                              </div>

                            )
                          )

                        ) : typeof previewSlip.deductions_breakup === "object" &&
                          previewSlip.deductions_breakup !== null &&
                          Object.keys(previewSlip.deductions_breakup).length > 0 ? (

                          Object.entries(
                            previewSlip.deductions_breakup as Record<string, any>
                          ).map(([key, value]) => {

                            const amount =
                              typeof value === "object" && value !== null
                                ? Number(value.amount || 0)
                                : Number(value || 0);

                            return (
                              <div
                                key={key}
                                className="grid grid-cols-[1fr_115px] border-b border-slate-100 px-4 py-3"
                              >

                                <span className="text-xs text-slate-700">
                                  {key
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (char) =>
                                      char.toUpperCase()
                                    )}
                                </span>

                                <span className="text-right text-xs font-semibold text-rose-600">
                                  {formatCurrency(amount)}
                                </span>

                              </div>
                            );
                          })

                        ) : (

                          <div className="px-4 py-8 text-center text-xs text-slate-400">
                            No deductions available
                          </div>

                        )}

                      </div>

                      {/* Total */}

                      <div className="flex items-center justify-between border-t border-rose-100 bg-rose-50 px-4 py-4">

                        <span className="text-xs font-bold text-rose-900">
                          Gross Deductions
                        </span>

                        <span className="text-sm font-bold text-rose-600">
                          {formatCurrency(previewSlip.total_deductions)}
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* ================================================= */}
                  {/* NET PAY */}
                  {/* ================================================= */}

                  <div className="px-5 pb-5 sm:px-8">

                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-5 py-6 text-white">

                      {/* Decorative shape */}

                      <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-500/10" />

                      <div className="absolute -bottom-24 right-20 h-48 w-48 rounded-full bg-violet-500/10" />

                      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                        {/* Net amount */}

                        <div className="flex items-center gap-4">

                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                            <CreditCard className="h-6 w-6 text-white" />
                          </div>

                          <div>

                            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                              Net Pay
                            </p>

                            <p className="mt-1 text-2xl font-bold tracking-tight">
                              {formatCurrency(previewSlip.net_salary)}
                            </p>

                          </div>

                        </div>

                        {/* Amount in words */}

                        <div className="border-t border-white/10 pt-4 sm:max-w-sm sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">

                          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                            Amount in Words
                          </p>

                          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-200">
                            {numberToWordsIndian(
                              Number(previewSlip.net_salary || 0)
                            )}
                          </p>

                        </div>

                      </div>

                    </div>

                  </div>

                  {/* ================================================= */}
                  {/* REMARKS */}
                  {/* ================================================= */}

                  <div className="px-5 pb-5 sm:px-8">

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">

                      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                        Remarks
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        Salary processed for{" "}
                        <span className="font-semibold text-slate-800">
                          {previewSlip.month_name}{" "}
                          {previewSlip.payroll_year}
                        </span>
                        .
                      </p>

                    </div>

                  </div>

                  {/* ================================================= */}
                  {/* FOOTER */}
                  {/* ================================================= */}

                  <div className="border-t border-slate-200 px-5 py-5 text-center sm:px-8">

                    <div className="flex items-center justify-center gap-2 text-[9px] text-slate-400">

                      <ShieldCheck className="h-3.5 w-3.5" />

                      <span>
                        This is a system-generated payslip and does not
                        require a physical signature.
                      </span>

                    </div>

                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PRINT STYLES
      ===================================================== */}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #payslip-print,
          #payslip-print * {
            visibility: visible !important;
          }

          #payslip-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            background: white !important;
          }

          #payslip-print > div {
            box-shadow: none !important;
            max-width: none !important;
          }

          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}

      /* ===========================================================
        METRIC CARD
      =========================================================== */

      function MetricCard({
        icon: Icon,
        label,
        value,
        helper,
      }: {
        icon: any;
        label: string;
        value: string;
        helper: string;
      }) {
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Icon className="h-5 w-5 text-indigo-600" />
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Payroll
              </span>
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {label}
            </p>

            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {value}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {helper}
            </p>
          </div>
        );
      }

      /* ===========================================================
        CONTROL ITEM
      =========================================================== */

      function ControlItem({
        label,
        enabled,
      }: {
        label: string;
        enabled: boolean;
      }) {
        return (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="text-xs font-medium text-slate-600">
              {label}
            </span>

            {enabled ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-slate-300" />
            )}
          </div>
        );
      }

      /* ===========================================================
        EMPTY STATE
      =========================================================== */

      function EmptyState({
        icon: Icon,
        title,
        description,
      }: {
        icon: any;
        title: string;
        description: string;
      }) {
        return (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Icon className="h-6 w-6 text-slate-400" />
            </div>

            <h3 className="mt-4 text-sm font-bold text-slate-800">
              {title}
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {description}
            </p>
          </div>
        );
      }

      /* ===========================================================
        PAYSLIP INFO BLOCK
      =========================================================== */

      function InfoBlock({
        label,
        value,
      }: {
        label: string;
        value: string;
      }) {
        return (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {label}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              {value}
            </p>
          </div>
        );
      }

      /* ===========================================================
        SUMMARY BOX
      =========================================================== */

      function SummaryBox({
        label,
        value,
      }: {
        label: string;
        value: string;
      }) {
        return (
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {label}
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900">
              {value}
            </p>
          </div>
        );
      }