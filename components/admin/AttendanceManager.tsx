"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AttendanceLog, Employee, Project } from "@/lib/types";
import { Clock, Search, Filter } from "lucide-react";

type ApprovedLeaveForAttendance = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  leave_duration: "first_half" | "second_half" | null;
};

interface AttendanceManagerProps {
  logs: AttendanceLog[];
  employees: Employee[];
  projects: Project[];
  approvedLeaves: ApprovedLeaveForAttendance[];
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

export default function AttendanceManager({
  logs: initialLogs,
  employees,
  projects,
  approvedLeaves,
}: AttendanceManagerProps) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(() => Date.now());

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

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

  const getLogForEmployee = (empId: string) => {
    return initialLogs.find(
      (l) =>
        l.employee_id === empId &&
        l.attendance_date === selectedDate
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

    setDecisionErrors((prev) => ({
      ...prev,
      [employeeId]: "",
    }));

    setDecisionSuccess((prev) => ({
      ...prev,
      [employeeId]: "",
    }));

    try {
      const response = await fetch("/api/attendance/hr-decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    const matchesSearch =
      `${emp.first_name} ${emp.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase());

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

  const presentCount = employees.filter((e) => {
    const l = getLogForEmployee(e.id);
    return l && (l.status === "present" || l.is_regularized);
  }).length;

  const lateCount = employees.filter((e) => {
    const l = getLogForEmployee(e.id);
    return l && l.is_late && !l.is_regularized;
  }).length;

  const halfDayCount = employees.filter((e) => {
    const l = getLogForEmployee(e.id);
    return l && l.status === "half_day" && !l.is_regularized;
  }).length;

  const absentCount = employees.length - presentCount - halfDayCount;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Organization Attendance & Shifts
            </h2>
          </div>

          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-11">
            Monitor real-time employee check-ins, punctuality, shift hours,
            and late marks across teams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            onClick={(e) => {
              e.currentTarget.showPicker?.();
            }}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-slate-50 text-slate-800 shadow-xs cursor-pointer"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Present Today
          </span>
          <span className="text-3xl font-black text-emerald-600 font-mono block mt-1.5">
            {presentCount}
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-1 block">
            On time or regularized
          </span>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Late Check-Ins
          </span>
          <span className="text-3xl font-black text-orange-600 font-mono block mt-1.5">
            {lateCount}
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-1 block">
            Punched after grace period
          </span>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Half Days
          </span>
          <span className="text-3xl font-black text-amber-600 font-mono block mt-1.5">
            {halfDayCount}
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-1 block">
            &lt; 4.5 hrs or late cutoff
          </span>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Absent / Unpunched
          </span>
          <span className="text-3xl font-black text-rose-600 font-mono block mt-1.5">
            {absentCount}
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-1 block">
            Evaluated as LOP
          </span>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4.5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />

            <input
              type="text"
              placeholder="Search by employee name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />

            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium text-slate-700 bg-white shadow-xs focus:ring-2 focus:ring-indigo-500"
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
              ).map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium text-slate-700 bg-white shadow-xs focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Clients / Vendors</th>
                <th className="py-3.5 px-4">Assigned Shift</th>
                <th className="py-3.5 px-4">Check-In</th>
                <th className="py-3.5 px-4">Check-Out</th>
                <th className="py-3.5 px-4">Total Worked</th>
                <th className="py-3.5 px-4">Attendance Status</th>
                <th className="py-3.5 px-4 min-w-[280px]">
                  HR Decision
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const log = getLogForEmployee(emp.id);

                const project = projects.find((item) => item.id === emp.project_id) ?? emp.project;

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
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-indigo-100 shadow-sm">
                          {emp.profile_photo_url ? (
                            <img
                              src={emp.profile_photo_url}
                              alt={`${emp.first_name ?? ""} ${emp.last_name ?? ""}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-indigo-500 to-indigo-600 text-xs font-bold text-white">
                              {emp.first_name?.[0]}
                              {emp.last_name?.[0]}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">
                            {emp.first_name} {emp.last_name}
                          </span>

                          <span className="text-[10px] text-slate-400 font-mono font-medium">
                            {emp.employee_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {emp.department?.name || "Engineering"}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {emp.company_name || "Not Assigned"}
                      </span>

                      <span className="text-[10px] text-slate-400">
                        {project?.client_country || "—"}
                      </span>
                    </td>

                    {/* Assigned Shift */}
                    <td className="py-3.5 px-4 font-mono font-medium">
                      {project?.shift_start_time &&
                      project?.shift_end_time
                        ? `${project.shift_start_time} - ${project.shift_end_time}`
                        : "—"}
                    </td>

                    {/* Check-In */}
                    <td className="py-3.5 px-4 font-mono font-medium">
                      {log?.check_in_time
                        ? new Date(log.check_in_time).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "—"}
                    </td>

                    {/* Check-Out */}
                    <td className="py-3.5 px-4 font-mono font-medium">
                      {log?.check_out_time
                        ? new Date(log.check_out_time).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : log?.check_in_time
                          ? "Active"
                          : "—"}
                    </td>

                    {/* Total Worked */}
                    <td className="py-3.5 px-4 font-mono font-medium">
                      {log?.total_hours ? `${log.total_hours} hrs` : "—"}
                    </td>

                    {/* Attendance Status */}
                    <td className="py-3.5 px-4">
                      {log?.is_regularized ? (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Regularized Present
                        </span>
                      ) : log?.status === "present" ? (
                        log.is_late ? (
                          <span className="text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Present (Late)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Present
                          </span>
                        )
                      ) : log?.status === "half_day" ? (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Half Day
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Absent (Unpunched)
                        </span>
                      )}
                    </td>

                    {/* HR Decision */}
                    <td className="py-3.5 px-4 min-w-[280px]">
                      {!hrRemarkAvailability.available ? (
                        <span className="text-[10px] text-slate-400">
                          {hrRemarkAvailability.message}
                        </span>
                      ) : log?.hr_decision_by ? (
                        <div className="space-y-1">
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase">
                            HR Decision Saved
                          </span>

                          <p className="text-[10px] text-slate-500">
                            {log.hr_decision_reason}
                          </p>

                          {log.hr_decision_at && (
                            <p className="text-[10px] text-slate-400">
                              {new Date(log.hr_decision_at).toLocaleString("en-IN")}
                            </p>
                          )}
                        </div>
                      ) : log?.check_in_time || log?.is_regularized ? (
                        <span className="text-[10px] text-slate-400">
                          Punch / regularization recorded
                        </span>
                      ) : (
                        <div className="space-y-2 min-w-[250px]">
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
                            className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100"
                          />

                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={savingEmployee === emp.id}
                              onClick={() => saveHRDecision(emp.id, "present")}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Present
                            </button>

                            <button
                              type="button"
                              disabled={savingEmployee === emp.id}
                              onClick={() => saveHRDecision(emp.id, "absent")}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 disabled:opacity-50"
                            >
                              Absent
                            </button>

                            <button
                              type="button"
                              disabled={savingEmployee === emp.id}
                              onClick={() => saveHRDecision(emp.id, "half_day")}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 disabled:opacity-50"
                            >
                              Half Day
                            </button>
                          </div>

                          {savingEmployee === emp.id && (
                            <p className="text-[10px] text-indigo-600 font-semibold">
                              Saving decision...
                            </p>
                          )}

                          {decisionErrors[emp.id] && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              {decisionErrors[emp.id]}
                            </p>
                          )}

                          {decisionSuccess[emp.id] && (
                            <p className="text-[10px] text-emerald-600 font-medium">
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
                    className="py-10 text-center text-sm text-slate-400"
                  >
                    No employees found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
