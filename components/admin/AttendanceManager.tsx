"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AttendanceLog,
  Employee,
  Project,
  HolidayCalendar,
} from "@/lib/types";
import Image from "next/image";
import {
  Clock,
  Search,
  Filter,
  Settings2,
  CalendarDays,
  Users,
  CheckCircle2,
  AlertCircle,
  Timer,
  X,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

type ApprovedLeaveForAttendance = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  leave_duration: "first_half" | "second_half" | null;
  leave_type: { id: string; name: string; code: string }[] | null;
};

type AttendanceSetting = {
  setting_key: string;
  employee_id: string | null;
  count_approved_leaves_toward_weekly_minimum: boolean;
  updated_by: string | null;
  updated_at: string;
};

interface AttendanceManagerProps {
  logs: AttendanceLog[];
  employees: Employee[];
  projects: Project[];
  approvedLeaves: ApprovedLeaveForAttendance[];
  attendanceSettings: AttendanceSetting[];
  holidayCalendars: HolidayCalendar[];
  canManageAttendanceSettings: boolean;
  globalAttendanceSetting: AttendanceSetting | null;
}

type HRDecision = "present" | "absent" | "half_day";

type AttendanceLogWithDecision = AttendanceLog & {
  hr_decision_by?: string | null;
  hr_decision_at?: string | null;
  hr_decision_reason?: string | null;
};

function getTimeInMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function getISTDateAtMinutes(date: string, minutes: number): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 0, minutes - 330);
}

function getHRRemarkAvailability({
  employee,
  attendanceDate,
  projects,
  approvedLeaves,
  now,
}: {
  employee: Employee;
  attendanceDate: string;
  projects: Project[];
  approvedLeaves: ApprovedLeaveForAttendance[];
  now: number;
}): { available: boolean; message: string } {
  const employeeLeaves = approvedLeaves.filter(
    (leave) =>
      leave.employee_id === employee.id &&
      leave.start_date <= attendanceDate &&
      leave.end_date >= attendanceDate
  );

  if (employeeLeaves.length > 1) {
    return {
      available: false,
      message: "Overlapping approved leave requires HR review.",
    };
  }

  const leave = employeeLeaves[0];

  if (leave) {
    const validHalfDay =
      leave.is_half_day === true &&
      leave.start_date === attendanceDate &&
      leave.end_date === attendanceDate &&
      Number(leave.total_days) === 0.5 &&
      ["first_half", "second_half"].includes(
        leave.leave_duration ?? ""
      );

    if (!validHalfDay) {
      return {
        available: false,
        message: "Approved leave requires review.",
      };
    }
  }

  const project =
    projects.find((item) => item.id === employee.project_id) ??
    employee.project;


  const shiftStart = project?.shift_start_time || "09:00";
  const shiftEnd = project?.shift_end_time || "18:00";

  const startMinutes = getTimeInMinutes(shiftStart);
  let endMinutes = getTimeInMinutes(shiftEnd);

  if (endMinutes <= startMinutes) {
    endMinutes += 1440;
  }

  let thresholdMinutes = startMinutes + 180;

  if (leave?.leave_duration === "first_half") {
    const shiftDuration = endMinutes - startMinutes;
    thresholdMinutes =
      startMinutes + Math.floor(shiftDuration / 2) + 180;
  }

  const thresholdTime = getISTDateAtMinutes(
    attendanceDate,
    thresholdMinutes
  );

  return {
    available: now >= thresholdTime,
    message: "HR remark becomes available after the 3-hour threshold.",
  };
}

function formatTime(value?: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AttendanceManager({
  logs: initialLogs,
  employees,
  projects,
  approvedLeaves,
  attendanceSettings,
  canManageAttendanceSettings,
  globalAttendanceSetting,
}: AttendanceManagerProps) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [showAttendanceSettings, setShowAttendanceSettings] =
    useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");

  const [employeeSettings, setEmployeeSettings] =
    useState<AttendanceSetting[]>(attendanceSettings);

  const [globalSetting, setGlobalSetting] =
    useState<AttendanceSetting | null>(globalAttendanceSetting);

  const [settingsSearch, setSettingsSearch] = useState("");
  const [settingsDepartment, setSettingsDepartment] = useState("all");

  const [savingSettingEmployee, setSavingSettingEmployee] =
    useState<string | null>(null);

  const [savingGlobalSetting, setSavingGlobalSetting] = useState(false);
  const [globalSettingMessage, setGlobalSettingMessage] = useState("");
  const [globalSettingError, setGlobalSettingError] = useState("");

  const [settingsError, setSettingsError] = useState<
    Record<string, string>
  >({});

  const [settingsSuccess, setSettingsSuccess] = useState<
    Record<string, string>
  >({});

  const [decisionReasons, setDecisionReasons] = useState<
    Record<string, string>
  >({});

  const [savingEmployee, setSavingEmployee] = useState<string | null>(null);

  const [decisionErrors, setDecisionErrors] = useState<
    Record<string, string>
  >({});

  const [decisionSuccess, setDecisionSuccess] = useState<
    Record<string, string>
  >({});

  const globalEnabled =
    globalSetting?.count_approved_leaves_toward_weekly_minimum ?? false;

  // Department names for the individual settings filter.
  const departmentOptions = useMemo(() => {
    const departments = new Map<string, string>();

    employees.forEach((employee) => {
      if (employee.department_id) {
        departments.set(
          employee.department_id,
          employee.department?.name || "Unknown Department"
        );
      }
    });

    return Array.from(departments.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const showIndividualSettings =
    settingsSearch.trim().length > 0 ||
    settingsDepartment !== "all";

  const saveGlobalAttendanceSetting = async (enabled: boolean) => {
    setSavingGlobalSetting(true);
    setGlobalSettingMessage("");
    setGlobalSettingError("");

    try {
      const response = await fetch("/api/attendance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "global",
          countApprovedLeavesTowardWeeklyMinimum: enabled,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save global setting.");
      }

      setGlobalSetting({
        setting_key: "global",
        employee_id: null,
        count_approved_leaves_toward_weekly_minimum: enabled,
        updated_by: null,
        updated_at: new Date().toISOString(),
      });

      setGlobalSettingMessage("Global setting saved successfully.");
    } catch (error) {
      setGlobalSettingError(
        error instanceof Error
          ? error.message
          : "Unable to save global setting."
      );
    } finally {
      setSavingGlobalSetting(false);
    }
  };

  const saveAttendanceSetting = async (
    employeeId: string,
    enabled: boolean
  ) => {
    setSavingSettingEmployee(employeeId);

    setSettingsError((prev) => ({ ...prev, [employeeId]: "" }));
    setSettingsSuccess((prev) => ({ ...prev, [employeeId]: "" }));

    try {
      const response = await fetch("/api/attendance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "employee",
          employeeId,
          countApprovedLeavesTowardWeeklyMinimum: enabled,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save attendance setting."
        );
      }

      setEmployeeSettings((prev) => {
        const existing = prev.some(
          (setting) => setting.employee_id === employeeId
        );

        if (existing) {
          return prev.map((setting) =>
            setting.employee_id === employeeId
              ? {
                  ...setting,
                  count_approved_leaves_toward_weekly_minimum: enabled,
                  updated_at: new Date().toISOString(),
                }
              : setting
          );
        }

        return [
          ...prev,
          {
            setting_key: `employee:${employeeId}`,
            employee_id: employeeId,
            count_approved_leaves_toward_weekly_minimum: enabled,
            updated_by: null,
            updated_at: new Date().toISOString(),
          },
        ];
      });

      setSettingsSuccess((prev) => ({
        ...prev,
        [employeeId]: "Individual setting saved.",
      }));
    } catch (error) {
      setSettingsError((prev) => ({
        ...prev,
        [employeeId]:
          error instanceof Error
            ? error.message
            : "Unable to save attendance setting.",
      }));
    } finally {
      setSavingSettingEmployee(null);
    }
  };

  const resetEmployeeAttendanceSetting = async (employeeId: string) => {
    setSavingSettingEmployee(employeeId);

    setSettingsError((prev) => ({ ...prev, [employeeId]: "" }));
    setSettingsSuccess((prev) => ({ ...prev, [employeeId]: "" }));

    try {
      const response = await fetch("/api/attendance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "employee",
          employeeId,
          reset: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to reset employee setting."
        );
      }

      setEmployeeSettings((prev) =>
        prev.filter((setting) => setting.employee_id !== employeeId)
      );

      setSettingsSuccess((prev) => ({
        ...prev,
        [employeeId]: "Now using global setting.",
      }));
    } catch (error) {
      setSettingsError((prev) => ({
        ...prev,
        [employeeId]:
          error instanceof Error
            ? error.message
            : "Unable to reset setting.",
      }));
    } finally {
      setSavingSettingEmployee(null);
    }
  };

  const getLogForEmployee = (empId: string) => {
    return initialLogs.find(
      (log) =>
        log.employee_id === empId &&
        log.attendance_date === selectedDate
    ) as AttendanceLogWithDecision | undefined;
  };

  const saveHRDecision = async (
    employeeId: string,
    status: HRDecision
  ) => {
    const reason = decisionReasons[employeeId]?.trim() || "";

    if (!reason) {
      setDecisionErrors((prev) => ({
        ...prev,
        [employeeId]: "Please enter a reason before saving.",
      }));
      return;
    }

    if (reason.length > 1000) {
      setDecisionErrors((prev) => ({
        ...prev,
        [employeeId]: "Reason cannot exceed 1000 characters.",
      }));
      return;
    }

    setSavingEmployee(employeeId);
    setDecisionErrors((prev) => ({ ...prev, [employeeId]: "" }));
    setDecisionSuccess((prev) => ({ ...prev, [employeeId]: "" }));

    try {
      const response = await fetch("/api/attendance/hr-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          attendanceDate: selectedDate,
          status,
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save attendance decision."
        );
      }

      setDecisionSuccess((prev) => ({
        ...prev,
        [employeeId]: "Decision saved successfully.",
      }));

      setDecisionReasons((prev) => ({
        ...prev,
        [employeeId]: "",
      }));

      router.refresh();
    } catch (error) {
      setDecisionErrors((prev) => ({
        ...prev,
        [employeeId]:
          error instanceof Error
            ? error.message
            : "Unable to save the decision.",
      }));
    } finally {
      setSavingEmployee(null);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const query = searchTerm.trim().toLowerCase();

    const matchesSearch =
      `${emp.first_name} ${emp.last_name}`
        .toLowerCase()
        .includes(query) ||
      emp.employee_id.toLowerCase().includes(query);

    const log = getLogForEmployee(emp.id);

    let matchesStatus = true;

    if (statusFilter === "present") {
      matchesStatus =
        !!log && (log.status === "present" || log.is_regularized);
    } else if (statusFilter === "late") {
      matchesStatus = !!log && log.is_late && !log.is_regularized;
    } else if (statusFilter === "half_day") {
      matchesStatus =
        !!log && log.status === "half_day" && !log.is_regularized;
    } else if (statusFilter === "absent") {
      matchesStatus =
        !log ||
        (!log.is_regularized &&
          log.status !== "present" &&
          log.status !== "half_day");
    }

    const matchesClient =
      clientFilter === "all" ||
      emp.company_name?.trim().toLowerCase() ===
        clientFilter.trim().toLowerCase();

    return matchesSearch && matchesStatus && matchesClient;
  });

  const presentCount = employees.filter((employee) => {
    const log = getLogForEmployee(employee.id);
    return log && (log.status === "present" || log.is_regularized);
  }).length;

  const lateCount = employees.filter((employee) => {
    const log = getLogForEmployee(employee.id);
    return log && log.is_late && !log.is_regularized;
  }).length;

  const halfDayCount = employees.filter((employee) => {
    const log = getLogForEmployee(employee.id);
    return log && log.status === "half_day" && !log.is_regularized;
  }).length;

  const absentCount = employees.length - presentCount - halfDayCount;

  const employeesForSettings = employees.filter((emp) => {
    const query = settingsSearch.trim().toLowerCase();

    const matchesSearch =
      !query ||
      `${emp.first_name} ${emp.last_name}`
        .toLowerCase()
        .includes(query) ||
      emp.employee_id.toLowerCase().includes(query);

    const matchesDepartment =
      settingsDepartment === "all" ||
      emp.department_id === settingsDepartment;

    return matchesSearch && matchesDepartment;
  });

  const clearSettingsFilters = () => {
    setSettingsSearch("");
    setSettingsDepartment("all");
  };

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-indigo-600" />

        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Clock className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                Organization Attendance & Shifts
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Monitor employee attendance, punctuality and shift activity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:self-auto">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="min-w-0 bg-transparent text-xs font-semibold text-slate-700 outline-none"
            />
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Present",
            count: presentCount,
            description: "Present or regularized",
            icon: CheckCircle2,
            color: "emerald",
          },
          {
            label: "Late Check-ins",
            count: lateCount,
            description: "After grace period",
            icon: Timer,
            color: "orange",
          },
          {
            label: "Half Days",
            count: halfDayCount,
            description: "Half-day attendance",
            icon: Clock,
            color: "amber",
          },
          {
            label: "Absent / Unpunched",
            count: absentCount,
            description: "Not present or half day",
            icon: AlertCircle,
            color: "rose",
          },
        ].map((item) => {
          const Icon = item.icon;

          const colorClasses: Record<string, string> = {
            emerald: "bg-emerald-50 text-emerald-600",
            orange: "bg-orange-50 text-orange-600",
            amber: "bg-amber-50 text-amber-600",
            rose: "bg-rose-50 text-rose-600",
          };

          const numberClasses: Record<string, string> = {
            emerald: "text-emerald-700",
            orange: "text-orange-700",
            amber: "text-amber-700",
            rose: "text-rose-700",
          };

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
                  {item.label}
                </p>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClasses[item.color]}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <p
                className={`mt-3 font-mono text-3xl font-black ${numberClasses[item.color]}`}
              >
                {item.count}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                {item.description}
              </p>
            </div>
          );
        })}
      </section>

      {/* Weekly Minimum Settings */}
      {canManageAttendanceSettings && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Collapsible heading */}
          <button
            type="button"
            onClick={() =>
              setShowAttendanceSettings((previous) => !previous)
            }
            aria-expanded={showAttendanceSettings}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Settings2 className="h-4 w-4" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Attendance Weekly Minimum Settings
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Configure whether approved leaves count toward the weekly minimum of 3 days.
                </p>
              </div>
            </div>

            <ChevronDown
              className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${
                showAttendanceSettings ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Expandable settings content */}
          {showAttendanceSettings && (
            <div className="border-t border-slate-100">
              {/* Global setting */}
              <div className="flex flex-col gap-3 bg-indigo-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Global Default
                    </span>

                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold uppercase text-indigo-700">
                      Organization-wide
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Applied to employees without an individual override.
                  </p>

                  {globalSettingError && (
                    <p className="mt-2 text-[10px] text-rose-600">
                      {globalSettingError}
                    </p>
                  )}

                  {globalSettingMessage && (
                    <p className="mt-2 text-[10px] text-emerald-600">
                      {globalSettingMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-slate-600">
                    {globalEnabled
                      ? "Approved leave counts"
                      : "Worked days only"}
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={globalEnabled}
                    aria-label="Global approved leave weekly minimum setting"
                    disabled={savingGlobalSetting}
                    onClick={() =>
                      saveGlobalAttendanceSetting(!globalEnabled)
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      globalEnabled ? "bg-indigo-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        globalEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>

                  {savingGlobalSetting && (
                    <span className="text-[10px] text-indigo-600">
                      Saving...
                    </span>
                  )}
                </div>
              </div>

              {/* Individual settings filters */}
              <div className="space-y-3 border-t border-slate-100 px-5 py-4">
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-bold text-slate-900">
                    Individual Employee Settings
                  </h4>

                  <p className="text-[11px] text-slate-500">
                    Search an employee or select a department to manage individual overrides.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_260px_auto]">
                  {/* Employee search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={settingsSearch}
                      onChange={(e) =>
                        setSettingsSearch(e.target.value)
                      }
                      placeholder="Search employee name or ID..."
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  {/* Department filter */}
                  <div className="relative">
                    <select
                      value={settingsDepartment}
                      onChange={(e) =>
                        setSettingsDepartment(e.target.value)
                      }
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="all">All Departments</option>

                      {departmentOptions.map((department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      ))}
                    </select>

                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>

                  {/* Clear filters */}
                  {showIndividualSettings && (
                    <button
                      type="button"
                      onClick={clearSettingsFilters}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Employee list */}
                {!showIndividualSettings ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
                    <Users className="mx-auto h-6 w-6 text-slate-300" />

                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      Individual settings are hidden
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      Search for an employee or select a department to view settings.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5">
                      <p className="text-[11px] font-bold text-slate-700">
                        Employee Overrides
                      </p>

                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
                        {employeesForSettings.length} employees
                      </span>
                    </div>

                    <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
                      {employeesForSettings.map((emp) => {
                        const setting = employeeSettings.find(
                          (item) => item.employee_id === emp.id
                        );

                        const hasOverride = !!setting;

                        const enabled = hasOverride
                          ? setting.count_approved_leaves_toward_weekly_minimum
                          : globalEnabled;

                        const saving =
                          savingSettingEmployee === emp.id;

                        return (
                          <div
                            key={emp.id}
                            className="flex flex-col gap-3 px-4 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-900">
                                {emp.first_name} {emp.last_name}
                              </p>

                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {emp.employee_id}
                                {emp.department?.name
                                  ? ` • ${emp.department.name}`
                                  : ""}
                                {emp.company_name
                                  ? ` • ${emp.company_name}`
                                  : ""}
                              </p>

                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                    hasOverride
                                      ? "bg-violet-50 text-violet-700"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {hasOverride
                                    ? "Individual Override"
                                    : "Using Global"}
                                </span>

                                <span className="text-[10px] text-slate-500">
                                  {enabled
                                    ? "Approved leave counts"
                                    : "Worked days only"}
                                </span>
                              </div>

                              {settingsError[emp.id] && (
                                <p className="mt-1 text-[10px] text-rose-600">
                                  {settingsError[emp.id]}
                                </p>
                              )}

                              {settingsSuccess[emp.id] && (
                                <p className="mt-1 text-[10px] text-emerald-600">
                                  {settingsSuccess[emp.id]}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={`Count approved leave toward weekly minimum for ${emp.first_name} ${emp.last_name}`}
                                disabled={saving}
                                onClick={() =>
                                  saveAttendanceSetting(
                                    emp.id,
                                    !enabled
                                  )
                                }
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                  enabled
                                    ? "bg-indigo-600"
                                    : "bg-slate-300"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    enabled
                                      ? "translate-x-6"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>

                              {hasOverride && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() =>
                                    resetEmployeeAttendanceSetting(
                                      emp.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Use Global
                                </button>
                              )}

                              {saving && (
                                <span className="text-[10px] text-indigo-600">
                                  Saving...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {employeesForSettings.length === 0 && (
                        <div className="px-4 py-8 text-center">
                          <p className="text-xs font-semibold text-slate-600">
                            No employees found
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            Try another search or department.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}


      {/* Employee Attendance Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Employee Attendance
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                Attendance records and HR decisions for the selected date.
              </p>
            </div>

            <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-700">
              {filteredEmployees.length} employees
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Clients / Vendors</option>
                {Array.from(
                  new Set(
                    employees
                      .map((emp) => emp.company_name)
                      .filter(
                        (company): company is string => Boolean(company)
                      )
                  )
                )
                  .sort((a, b) => a.localeCompare(b))
                  .map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Department</th>
                <th className="px-4 py-3.5">Client / Vendor</th>
                <th className="px-4 py-3.5">Assigned Shift</th>
                <th className="px-4 py-3.5">Check-In</th>
                <th className="px-4 py-3.5">Check-Out</th>
                <th className="px-4 py-3.5">Total Worked</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="min-w-[280px] px-4 py-3.5">HR Decision</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const log = getLogForEmployee(emp.id);

                const project =
                  projects.find((item) => item.id === emp.project_id) ??
                  emp.project;

                const hrRemarkAvailability = getHRRemarkAvailability({
                  employee: emp,
                  attendanceDate: selectedDate,
                  projects,
                  approvedLeaves,
                  now: currentTime,
                });

                return (
                  <tr
                    key={emp.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-indigo-100">
                          {emp.profile_photo_url ? (
                            <Image
                              src={emp.profile_photo_url}
                              alt={`${emp.first_name ?? ""} ${emp.last_name ?? ""}`}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-indigo-600 text-[10px] font-bold text-white">
                              {emp.first_name?.[0]}
                              {emp.last_name?.[0]}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="block truncate font-bold text-slate-900">
                            {emp.first_name} {emp.last_name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {emp.employee_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {emp.department?.name || "—"}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="block font-semibold text-slate-800">
                        {emp.company_name || "Not Assigned"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {project?.client_country || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px] font-medium">
                      {project?.shift_start_time && project?.shift_end_time
                        ? `${project.shift_start_time} - ${project.shift_end_time}`
                        : "—"}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-medium text-slate-700">
                      {formatTime(log?.check_in_time)}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-medium text-slate-700">
                      {log?.check_out_time
                        ? formatTime(log.check_out_time)
                        : log?.check_in_time
                          ? "Active"
                          : "—"}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-medium">
                      {log?.total_hours ? `${log.total_hours} hrs` : "—"}
                    </td>

                    <td className="px-4 py-3.5">
                      {log?.is_regularized ? (
                        <span className="inline-flex whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[9px] font-bold uppercase text-blue-700">
                          Regularized Present
                        </span>
                      ) : log?.status === "present" ? (
                        log.is_late ? (
                          <span className="inline-flex whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[9px] font-bold uppercase text-orange-700">
                            Present · Late
                          </span>
                        ) : (
                          <span className="inline-flex whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold uppercase text-emerald-700">
                            Present
                          </span>
                        )
                      ) : log?.status === "half_day" ? (
                        <span className="inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase text-amber-700">
                          Half Day
                        </span>
                      ) : (
                        <span className="inline-flex whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[9px] font-bold uppercase text-rose-700">
                          Absent / Unpunched
                        </span>
                      )}
                    </td>

                    <td className="min-w-[280px] px-4 py-3.5">
                      {!hrRemarkAvailability.available ? (
                        <span className="text-[10px] leading-relaxed text-slate-400">
                          {hrRemarkAvailability.message}
                        </span>
                      ) : log?.hr_decision_by ? (
                        <div className="space-y-1.5">
                          <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[9px] font-bold uppercase text-indigo-700">
                            HR Decision Saved
                          </span>

                          <p className="text-[10px] leading-relaxed text-slate-600">
                            {log.hr_decision_reason}
                          </p>

                          {log.hr_decision_at && (
                            <p className="text-[10px] text-slate-400">
                              {new Date(
                                log.hr_decision_at
                              ).toLocaleString("en-IN")}
                            </p>
                          )}
                        </div>
                      ) : log?.check_in_time || log?.is_regularized ? (
                        <span className="text-[10px] text-slate-400">
                          Punch / regularization recorded
                        </span>
                      ) : (
                        <div className="min-w-[250px] space-y-2">
                          <textarea
                            value={decisionReasons[emp.id] || ""}
                            onChange={(e) =>
                              setDecisionReasons((prev) => ({
                                ...prev,
                                [emp.id]: e.target.value,
                              }))
                            }
                            placeholder="Enter mandatory HR reason..."
                            maxLength={1000}
                            rows={2}
                            disabled={savingEmployee === emp.id}
                            className="w-full resize-y rounded-lg border border-slate-200 p-2.5 text-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                          />

                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={savingEmployee === emp.id}
                              onClick={() =>
                                saveHRDecision(emp.id, "present")
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Present
                            </button>

                            <button
                              type="button"
                              disabled={savingEmployee === emp.id}
                              onClick={() =>
                                saveHRDecision(emp.id, "absent")
                              }
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                            >
                              Absent
                            </button>

                            <button
                              type="button"
                              disabled={savingEmployee === emp.id}
                              onClick={() =>
                                saveHRDecision(emp.id, "half_day")
                              }
                              className="rounded-lg bg-amber-500 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
                            >
                              Half Day
                            </button>
                          </div>

                          {savingEmployee === emp.id && (
                            <p className="text-[10px] font-semibold text-indigo-600">
                              Saving decision...
                            </p>
                          )}

                          {decisionErrors[emp.id] && (
                            <p className="text-[10px] text-rose-600">
                              {decisionErrors[emp.id]}
                            </p>
                          )}

                          {decisionSuccess[emp.id] && (
                            <p className="text-[10px] text-emerald-600">
                              {decisionSuccess[emp.id]}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center"
                  >
                    <Users className="mx-auto h-7 w-7 text-slate-300" />
                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      No employees found
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-1 border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-slate-500">
            Showing {filteredEmployees.length} of {employees.length} employees
          </p>
          <p className="text-[10px] text-slate-400">
            Attendance date: {selectedDate}
          </p>
        </div>
      </section>
    </div>
  );
}