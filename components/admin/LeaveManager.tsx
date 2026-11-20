"use client";

import { useMemo, useState } from "react";
import {
  LeaveType,
  LeaveRequest,
  Employee,
  EmployeeLeaveBalance,
} from "@/lib/types";
import {
  CalendarDays,
  CheckCircle2,
  SlidersHorizontal,
  Users,
  Search,
  Clock3,
  CalendarCheck,
  User,
  X,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface LeaveManagerProps {
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  employees: Employee[];
  leaveBalances: EmployeeLeaveBalance[];
}

type EmployeeWithDetails = Employee & {
  email?: string;
  department_id?: string | null;
  department_name?: string | null;
  department?:
    | {
        id?: string;
        name?: string;
      }
    | string
    | null;
};

type DepartmentOption = {
  id: string;
  name: string;
};

const today = new Date();
const currentYear = today.getFullYear();

const getCurrentMonth = () =>
  `${currentYear}-${String(today.getMonth() + 1).padStart(2, "0")}`;

const dateOnly = (date: string) => date.slice(0, 10);

const formatDate = (date: string) =>
  new Date(`${dateOnly(date)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const getMonthBounds = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    start: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    end: `${year}-${String(monthNumber).padStart(2, "0")}-${String(
      new Date(year, monthNumber, 0).getDate()
    ).padStart(2, "0")}`,
  };
};

const overlaps = (
  request: LeaveRequest,
  start: string,
  end: string
) =>
  dateOnly(request.start_date) <= end &&
  dateOnly(request.end_date) >= start;

const getYearLeaveDays = (
  request: LeaveRequest,
  start: string,
  end: string
) => {
  const requestStart = dateOnly(request.start_date);
  const requestEnd = dateOnly(request.end_date);

  if (requestStart >= start && requestEnd <= end) {
    return Number(request.total_days) || 0;
  }

  if (
    request.is_half_day &&
    requestStart === requestEnd &&
    requestStart >= start &&
    requestStart <= end
  ) {
    return 0.5;
  }

  const overlapStart = requestStart > start ? requestStart : start;
  const overlapEnd = requestEnd < end ? requestEnd : end;

  const toUTC = (value: string) =>
    new Date(`${value}T00:00:00Z`).getTime();

  const totalCalendarDays =
    Math.round((toUTC(requestEnd) - toUTC(requestStart)) / 86400000) + 1;

  const overlappingCalendarDays =
    Math.round((toUTC(overlapEnd) - toUTC(overlapStart)) / 86400000) + 1;

  if (totalCalendarDays <= 0 || overlappingCalendarDays <= 0) {
    return 0;
  }

  return Number(
    (
      ((Number(request.total_days) || 0) *
        overlappingCalendarDays) /
      totalCalendarDays
    ).toFixed(2)
  );
};

const statusClass = (status: string) => {
  switch (status?.toLowerCase()) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "rejected":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

const getEmployeeDepartment = (employee: Employee): DepartmentOption | null => {
  const emp = employee as EmployeeWithDetails;

  const department =
    typeof emp.department === "object" && emp.department
      ? emp.department
      : null;

  const departmentName =
    department?.name ??
    (typeof emp.department === "string" ? emp.department : null) ??
    emp.department_name ??
    null;

  const departmentId =
    emp.department_id ??
    department?.id ??
    departmentName ??
    null;

  if (!departmentId || !departmentName) return null;

  return {
    id: String(departmentId),
    name: departmentName,
  };
};

export default function LeaveManager({
  leaveTypes: initialLeaveTypes,
  leaveRequests,
  employees,
  leaveBalances,
}: LeaveManagerProps) {
  const [types, setTypes] = useState<LeaveType[]>(initialLeaveTypes);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedLeaveType, setSelectedLeaveType] = useState("all");

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] =
    useState<Employee | null>(null);

  const [historyYear, setHistoryYear] = useState(currentYear);

  // ------------------------------------------
  // DEPARTMENT OPTIONS
  // ------------------------------------------

  const departmentOptions = useMemo(() => {
    const departments = new Map<string, string>();

    employees.forEach((employee) => {
      const department = getEmployeeDepartment(employee);

      if (department) {
        departments.set(department.id, department.name);
      }
    });

    return Array.from(departments, ([id, name]) => ({
      id,
      name,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // ------------------------------------------
  // LEAVE POLICY ACTIONS
  // ------------------------------------------

  const handleTogglePaid = (id: string) => {
    setTypes((prev) =>
      prev.map((type) =>
        type.id === id
          ? { ...type, is_paid: !type.is_paid }
          : type
      )
    );

    setSuccessMsg("Leave policy updated.");
  };

  const handleUpdateQuota = async (id: string, quota: number) => {
    if (!Number.isFinite(quota) || quota < 0) return;

    try {
      const response = await fetch(`/api/leave-types/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          annual_quota: quota,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update leave quota.");
      }

      const updated: LeaveType = await response.json();

      setTypes((prev) =>
        prev.map((type) =>
          type.id === id
            ? { ...type, annual_quota: updated.annual_quota }
            : type
        )
      );

      setSuccessMsg("Annual quota updated.");
    } catch (error) {
      console.error("Quota update error:", error);
      setSuccessMsg("Unable to update leave quota.");
    }
  };

  // ------------------------------------------
  // EMPLOYEE BALANCES
  // ------------------------------------------

  const getBalance = (employeeId: string, code: string) => {
    const leaveType = types.find(
      (type) => type.code?.toUpperCase() === code
    );

    if (!leaveType) {
      return { allocated: 0, used: 0, remaining: 0 };
    }

    const balance = (leaveBalances ?? []).find(
      (item) =>
        item.employee_id === employeeId &&
        item.leave_type_id === leaveType.id
    );

    if (!balance) {
      return {
        allocated: leaveType.annual_quota,
        used: 0,
        remaining: leaveType.annual_quota,
      };
    }

    return {
      allocated: balance.allocated_days,
      used: balance.used_days,
      remaining: balance.balance_days,
    };
  };

  const pendingLeaves = leaveRequests.filter(
    (request) => request.status === "pending"
  );

  // ------------------------------------------
  // MONTHLY REPORT
  // ------------------------------------------

  const monthlyReport = useMemo(() => {
    const { start, end } = getMonthBounds(selectedMonth);

    const employeeMap = new Map(
      employees.map((employee) => [employee.id, employee])
    );

    const monthlyRequests = leaveRequests.filter((request) => {
      if (!overlaps(request, start, end)) return false;

      // Department filter
      if (selectedDepartment !== "all") {
        const employee = employeeMap.get(request.employee_id);

        if (!employee) return false;

        const department = getEmployeeDepartment(employee);

        if (department?.id !== selectedDepartment) return false;
      }

      // Leave type filter
      if (selectedLeaveType !== "all") {
        const leaveType = types.find(
          (type) => type.id === request.leave_type_id
        );

        if (
          leaveType?.code?.toUpperCase() !== selectedLeaveType
        ) {
          return false;
        }
      }

      return true;
    });

    const approved = monthlyRequests.filter(
      (request) => request.status === "approved"
    );

    const pending = monthlyRequests.filter(
      (request) => request.status === "pending"
    );

    const uniqueEmployees = new Set(
      approved.map((request) => request.employee_id)
    );

    const records = monthlyRequests
      .map((request) => {
        const employee = employeeMap.get(request.employee_id);

        const leaveType = types.find(
          (type) => type.id === request.leave_type_id
        );

        return {
          request,
          employee,
          leaveType,
          department: employee
            ? getEmployeeDepartment(employee)?.name ?? "-"
            : "-",
        };
      })
      .sort((a, b) =>
        dateOnly(a.request.start_date).localeCompare(
          dateOnly(b.request.start_date)
        )
      );

    return {
      records,
      totalEmployees: uniqueEmployees.size,
      totalApproved: approved.length,
      totalPending: pending.length,
    };
  }, [
    selectedMonth,
    selectedDepartment,
    selectedLeaveType,
    leaveRequests,
    employees,
    types,
  ]);

  // ------------------------------------------
  // ACTIVE EMPLOYEES + EMPLOYEE SEARCH
  // ------------------------------------------

  // Leave balances and individual history are intended for active employees only.
  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          (employee as Employee & { status?: string }).status?.toLowerCase() ===
          "active"
      ),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();

    if (!search || selectedEmployee) return [];

    return activeEmployees.filter((employee) => {
      const emp = employee as EmployeeWithDetails;
      const name =
        `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.toLowerCase();

      return (
        name.includes(search) ||
        (emp.employee_id ?? "").toLowerCase().includes(search) ||
        (emp.email ?? "").toLowerCase().includes(search)
      );
    });
  }, [employeeSearch, activeEmployees, selectedEmployee]);

  // Employee list shown inside the Employee Leave Balances card.
  const balanceEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();

    if (!search) return activeEmployees;

    return activeEmployees.filter((employee) => {
      const emp = employee as EmployeeWithDetails;
      const name = `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.toLowerCase();

      return (
        name.includes(search) ||
        (emp.employee_id ?? "").toLowerCase().includes(search) ||
        (emp.email ?? "").toLowerCase().includes(search)
      );
    });
  }, [employeeSearch, activeEmployees]);

  // ------------------------------------------
  // INDIVIDUAL YEARLY HISTORY
  // ------------------------------------------

  const employeeHistory = useMemo(() => {
    if (!selectedEmployee) return [];

    const start = `${historyYear}-01-01`;
    const end = `${historyYear}-12-31`;

    return leaveRequests
      .filter(
        (request) =>
          request.employee_id === selectedEmployee.id &&
          overlaps(request, start, end)
      )
      .map((request) => {
        const leaveType = types.find(
          (type) => type.id === request.leave_type_id
        );

        return {
          ...request,
          leaveName: leaveType?.name ?? "Unknown",
          leaveCode: leaveType?.code ?? "-",
          isPaid: leaveType?.is_paid ?? false,
          yearDays: getYearLeaveDays(request, start, end),
        };
      })
      .sort((a, b) =>
        dateOnly(b.start_date).localeCompare(dateOnly(a.start_date))
      );
  }, [selectedEmployee, historyYear, leaveRequests, types]);

  const historySummary = useMemo(() => {
    const approved = employeeHistory.filter(
      (request) => request.status === "approved"
    );

    return {
      requests: employeeHistory.length,
      approved: approved.length,
      pending: employeeHistory.filter(
        (request) => request.status === "pending"
      ).length,
      days: approved.reduce(
        (total, request) => total + request.yearDays,
        0
      ),
    };
  }, [employeeHistory]);

  const selectedEmail = selectedEmployee
    ? (selectedEmployee as EmployeeWithDetails).email
    : "";

  const approvedThisMonth = monthlyReport.totalEmployees;

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 pb-6">

      {/* HEADER */}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
            <CalendarDays className="w-5 h-5" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Leave Management
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Workforce leave analytics and employee records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pendingLeaves.length > 0 && (
            <Link
              href="/dashboard/approvals"
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors"
            >
              <Clock3 className="w-4 h-4" />
              {pendingLeaves.length} Pending Approvals
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}

          <span className="text-xs text-slate-400 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
            HR Workspace
          </span>
        </div>
      </div>

      {/* SUCCESS MESSAGE */}

      {successMsg && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </span>

          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI CARDS */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Employees on Leave
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <p className="text-3xl font-bold text-slate-900">
              {approvedThisMonth}
            </p>
            <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-lg">
              {formatMonth(selectedMonth)}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-1">
            Approved employees matching selected filters
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Approved Requests
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
            </div>
          </div>

          <p className="text-3xl font-bold text-slate-900 mt-3">
            {monthlyReport.totalApproved}
          </p>

          <p className="text-[11px] text-slate-400 mt-1">
            Requests matching selected filters
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Pending Requests
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock3 className="w-4 h-4 text-amber-600" />
            </div>
          </div>

          <p className="text-3xl font-bold text-slate-900 mt-3">
            {monthlyReport.totalPending}
          </p>

          <p className="text-[11px] text-slate-400 mt-1">
            Pending requests matching selected filters
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Employees
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
              <User className="w-4 h-4 text-sky-600" />
            </div>
          </div>

          <p className="text-3xl font-bold text-slate-900 mt-3">
            {employees.length}
          </p>

          <p className="text-[11px] text-slate-400 mt-1">
            Employees in the system
          </p>
        </div>
      </div>

      {/* TOP ROW: MONTHLY REPORT + EMPLOYEE BALANCES */}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">

        {/* MONTHLY LEAVE REPORT */}

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">

          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Monthly Leave Report
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Company-wide and department-wise leave activity
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedLeaveType}
                onChange={(e) => setSelectedLeaveType(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Leave Types</option>
                <option value="SL">SL</option>
                <option value="CL">CL</option>
                <option value="ML">ML</option>
                <option value="PL">PL</option>
              </select>

              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 max-w-[170px]"
              >
                <option value="all">All Departments</option>

                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>

              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="p-4">

            <div className="flex items-center justify-between mb-3 gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {formatMonth(selectedMonth)} Overview
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {selectedDepartment === "all"
                    ? "All departments"
                    : departmentOptions.find(
                        (department) => department.id === selectedDepartment
                      )?.name ?? "Selected department"}
                  {" · "}
                  {selectedLeaveType === "all"
                    ? "All leave types"
                    : `${selectedLeaveType} only`}
                </p>
              </div>

              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                {monthlyReport.records.length} Records
              </span>
            </div>

            <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3 font-bold">Employee</th>
                    <th className="px-3 py-3 font-bold">Department</th>
                    <th className="px-3 py-3 font-bold">Leave</th>
                    <th className="px-3 py-3 font-bold">Dates</th>
                    <th className="px-3 py-3 font-bold">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {monthlyReport.records.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <CalendarDays className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-slate-500">
                          No leave records for this month.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    monthlyReport.records.map(
                      ({ request, employee, leaveType, department }) => (
                        <tr
                          key={request.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-3 py-3">
                            <p className="font-bold text-slate-800 whitespace-nowrap">
                              {employee
                                ? `${employee.first_name} ${employee.last_name}`
                                : "Unknown"}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {employee?.employee_id ?? "-"}
                            </p>
                          </td>

                          <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                            {department}
                          </td>

                          <td className="px-3 py-3">
                            <p className="font-semibold text-indigo-700">
                              {leaveType?.code ?? "-"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {leaveType?.name ?? "Unknown"}
                            </p>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <p className="text-slate-700">
                              {formatDate(request.start_date)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              To {formatDate(request.end_date)}
                            </p>
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full border text-[9px] font-bold capitalize ${statusClass(
                                request.status
                              )}`}
                            >
                              {request.status}
                            </span>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Approved
              </span>

              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Pending
              </span>

              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Rejected
              </span>
            </div>
          </div>
        </section>

        {/* EMPLOYEE LEAVE BALANCES + INDIVIDUAL HISTORY */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0 h-full flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                {selectedEmployee ? (
                  <User className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Users className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Employee Leave Balances
                </h3>
                <p className="text-[10px] text-slate-400">
                  {selectedEmployee
                    ? "Individual leave balance and yearly history"
                    : "Search employees or select one to view individual leave history"}
                </p>
              </div>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-lg">
              {activeEmployees.length} Active · {currentYear}
            </span>
          </div>

          <div className="p-4 flex-1 min-h-0 space-y-3">
            {/* SEARCH BAR */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setSelectedEmployee(null);
                }}
                placeholder="Search name, employee ID or email..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              {employeeSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeSearch("");
                    setSelectedEmployee(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {!selectedEmployee && employeeSearch.trim() && filteredEmployees.length > 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto">
                  {filteredEmployees.slice(0, 8).map((employee) => {
                    const emp = employee as EmployeeWithDetails;
                    return (
                      <button
                        type="button"
                        key={employee.id}
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setEmployeeSearch(`${employee.first_name} ${employee.last_name}`);
                        }}
                        className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-indigo-50 border-b border-slate-100 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                          {employee.profile_photo_url ? (
                            <Image
                            src={employee.profile_photo_url}
                            alt=""
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                          ) : (
                            <>{employee.first_name?.[0]}{employee.last_name?.[0]}</>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800">{employee.first_name} {employee.last_name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{employee.employee_id} · {emp.email ?? ""}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {!selectedEmployee && employeeSearch.trim() && filteredEmployees.length === 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg p-4 text-center text-xs text-slate-500">
                  No matching employees found.
                </div>
              )}
            </div>

            {selectedEmployee ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 border border-indigo-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                      {selectedEmployee.profile_photo_url ? (
                        <Image
                          src={selectedEmployee.profile_photo_url}
                          alt=""
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>{selectedEmployee.first_name?.[0]}{selectedEmployee.last_name?.[0]}</>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {selectedEmployee.employee_id}{selectedEmail ? ` · ${selectedEmail}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedEmployee(null); setEmployeeSearch(""); }}
                    className="text-[10px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" /> Back to balances
                  </button>
                </div>

                {/* INDIVIDUAL BALANCE SUMMARY */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["CL", "SL", ...(selectedEmployee.gender === "female" ? ["ML"] : []), ...(selectedEmployee.gender === "male" ? ["PL"] : [])] as string[]).map((code) => {
                    const balance = getBalance(selectedEmployee.id, code);
                    return (
                      <div key={code} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500">{code} Remaining</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">{balance.remaining}</p>
                        <p className="text-[9px] text-slate-400">of {balance.allocated} allocated · {balance.used} used</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Individual Leave History</p>
                    <p className="text-[10px] text-slate-400">Calendar year records</p>
                  </div>
                  <select
                    value={historyYear}
                    onChange={(e) => setHistoryYear(Number(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: 5 }, (_, index) => currentYear - index).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                    <p className="text-[9px] text-slate-500 font-semibold">Requests</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{historySummary.requests}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
                    <p className="text-[9px] text-emerald-700 font-semibold">Approved</p>
                    <p className="text-xl font-bold text-emerald-800 mt-1">{historySummary.approved}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                    <p className="text-[9px] text-amber-700 font-semibold">Pending</p>
                    <p className="text-xl font-bold text-amber-800 mt-1">{historySummary.pending}</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-2.5">
                    <p className="text-[9px] text-indigo-700 font-semibold">Days Used</p>
                    <p className="text-xl font-bold text-indigo-800 mt-1">{Number(historySummary.days.toFixed(2))}</p>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-x-auto">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-50">
                        <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                          <th className="px-3 py-2.5">Leave</th>
                          <th className="px-3 py-2.5">Dates</th>
                          <th className="px-3 py-2.5">Days</th>
                          <th className="px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employeeHistory.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">No leave records found for {historyYear}.</td></tr>
                        ) : employeeHistory.map((request) => (
                          <tr key={request.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5">
                              <p className="font-bold text-slate-800">{request.leaveCode}</p>
                              <p className="text-[9px] text-slate-400">{request.leaveName}</p>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                              {formatDate(request.start_date)}
                              <span className="block text-[9px] text-slate-400 mt-0.5">To {formatDate(request.end_date)}</span>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-800">{request.yearDays}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex px-2 py-1 rounded-full border text-[9px] font-bold capitalize ${statusClass(request.status)}`}>{request.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-3 py-3">CL</th>
                      <th className="px-3 py-3">SL</th>
                      {employees.some((employee) => employee.gender === "female") && <th className="px-3 py-3">ML</th>}
                      {employees.some((employee) => employee.gender === "male") && <th className="px-3 py-3">PL</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {balanceEmployees.map((employee) => {
                      const cl = getBalance(employee.id, "CL");
                      const sl = getBalance(employee.id, "SL");
                      const ml = getBalance(employee.id, "ML");
                      const pl = getBalance(employee.id, "PL");
                      return (
                        <tr
                          key={employee.id}
                          onClick={() => { setSelectedEmployee(employee); setEmployeeSearch(`${employee.first_name} ${employee.last_name}`); }}
                          className="hover:bg-indigo-50 cursor-pointer transition-colors"
                          title="Click to view individual leave history"
                        >
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800 whitespace-nowrap">{employee.first_name} {employee.last_name}</p>
                            <p className="text-[9px] text-slate-400 font-mono">{employee.employee_id}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-bold text-slate-800">{cl.remaining}</p>
                            <p className="text-[9px] text-slate-400">/ {cl.allocated}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-bold text-slate-800">{sl.remaining}</p>
                            <p className="text-[9px] text-slate-400">/ {sl.allocated}</p>
                          </td>
                          {employees.some((item) => item.gender === "female") && (
                            <td className="px-3 py-3">
                              {employee.gender === "female" ? <><p className="font-bold text-slate-800">{ml.remaining}</p><p className="text-[9px] text-slate-400">/ {ml.allocated}</p></> : <span className="font-extrabold text-black text-base">—</span>}
                            </td>
                          )}
                          {employees.some((item) => item.gender === "male") && (
                            <td className="px-3 py-3">
                              {employee.gender === "male" ? <><p className="font-bold text-slate-800">{pl.remaining}</p><p className="text-[9px] text-slate-400">/ {pl.allocated}</p></> : <span className="font-extrabold text-black text-base">—</span>}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {balanceEmployees.length === 0 && (
                      <tr><td colSpan={4 + (employees.some((employee) => employee.gender === "female") ? 1 : 0) + (employees.some((employee) => employee.gender === "male") ? 1 : 0)} className="py-8 text-center text-xs text-slate-400">No matching employees found.</td></tr>
                    )}
                    {employees.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">No employees available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* LEAVE POLICIES */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-sky-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Leave Policies</h3>
              <p className="text-[10px] text-slate-400">Categories and annual quotas</p>
            </div>
          </div>
          <span className="text-[9px] text-slate-400 font-semibold bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-lg">HR Controls</span>
        </div>
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Leave Type</th>
                <th className="px-3 py-3">Quota</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.filter((type) => !["EL", "LOP"].includes(type.code?.toUpperCase())).map((type) => (
                <tr key={type.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{type.name}</p>
                    <p className="text-[9px] text-slate-400">{type.code}</p>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      defaultValue={type.annual_quota}
                      key={`${type.id}-${type.annual_quota}`}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== type.annual_quota) void handleUpdateQuota(type.id, value);
                      }}
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-center font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={type.code === "LOP"}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${type.is_paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {type.is_paid ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {type.code !== "LOP" && (
                      <button type="button" onClick={() => handleTogglePaid(type.id)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap">Toggle</button>
                    )}
                  </td>
                </tr>
              ))}
              {types.filter((type) => !["EL", "LOP"].includes(type.code?.toUpperCase())).length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">No leave categories available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* FOOTER */}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
        <p className="text-[10px] text-slate-400">
          Leave Management · HRMS
        </p>

        <p className="text-[10px] text-slate-400">
          Monthly reports and employee history are based on loaded leave records.
        </p>
      </div>
    </div>
  );
}