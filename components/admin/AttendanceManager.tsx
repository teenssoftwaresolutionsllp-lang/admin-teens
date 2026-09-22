"use client";

import { useState } from "react";
import { AttendanceLog, Employee, Project } from "@/lib/types";
import { Clock, CheckCircle2, AlertTriangle, XCircle, Search, Filter } from "lucide-react";

interface AttendanceManagerProps {
  logs: AttendanceLog[];
  employees: Employee[];
  projects: Project[];
}

export default function AttendanceManager({
  logs: initialLogs,
  employees,
  projects,
}: AttendanceManagerProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getLogForEmployee = (empId: string) => {
    return initialLogs.find(
      (l) => l.employee_id === empId && l.attendance_date === selectedDate
    );
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Company Attendance & Shifts</h2>
          <p className="text-xs text-slate-500 mt-1">
            Monitor real-time employee check-ins, punctuality, shift hours, and late marks across teams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border rounded-lg focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Present Today</span>
          <span className="text-2xl font-black text-emerald-600 block mt-1">{presentCount}</span>
          <span className="text-[10px] text-slate-400">On time or regularized</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Late Check-Ins</span>
          <span className="text-2xl font-black text-orange-600 block mt-1">{lateCount}</span>
          <span className="text-[10px] text-slate-400">Punched after grace period</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Half Days</span>
          <span className="text-2xl font-black text-amber-600 block mt-1">{halfDayCount}</span>
          <span className="text-[10px] text-slate-400">&lt; 4.5 hrs or late cutoff</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Absent / Unpunched</span>
          <span className="text-2xl font-black text-rose-600 block mt-1">{absentCount}</span>
          <span className="text-[10px] text-slate-400">Evaluated as LOP</span>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-lg font-medium text-slate-700"
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
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Assigned Shift</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4">Total Worked</th>
                <th className="py-3 px-4">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const log = getLogForEmployee(emp.id);
                const project = emp.project || projects[0];

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">
                        {emp.first_name} {emp.last_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{emp.employee_id}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {emp.department?.name || "Engineering"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {project.shift_start_time} - {project.shift_end_time} ({project.client_country})
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">
                      {log?.check_in_time
                        ? new Date(log.check_in_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">
                      {log?.check_out_time
                        ? new Date(log.check_out_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : log?.check_in_time
                        ? "Active"
                        : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">
                      {log?.total_hours ? `${log.total_hours} hrs` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      {log?.is_regularized ? (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          Regularized Present
                        </span>
                      ) : log?.status === "present" ? (
                        log.is_late ? (
                          <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                            Present (Late)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            Present
                          </span>
                        )
                      ) : log?.status === "half_day" ? (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          Half Day
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          Absent (Unpunched)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
