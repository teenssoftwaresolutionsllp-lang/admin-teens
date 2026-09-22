"use client";

import { useState } from "react";
import { AttendanceLog, AttendanceRegularization, Employee, Project } from "@/lib/types";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  Loader2,
  Calendar,
} from "lucide-react";
import ClockInWidget from "./ClockInWidget";

interface EmployeeAttendanceViewProps {
  employee: Employee;
  project: Project;
  todayLog: AttendanceLog | null;
  historyLogs: AttendanceLog[];
  regularizations: AttendanceRegularization[];
}

export default function EmployeeAttendanceView({
  employee,
  project,
  todayLog,
  historyLogs,
  regularizations: initialRegs,
}: EmployeeAttendanceViewProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>(historyLogs);
  const [regs, setRegs] = useState<AttendanceRegularization[]>(initialRegs);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    attendanceDate: new Date().toISOString().split("T")[0],
    proposedCheckIn: "09:00",
    proposedCheckOut: "18:00",
    reason: "",
  });

  const handleRegularizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/attendance/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          ...formData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRegs([data.regularization, ...regs]);
        setIsModalOpen(false);
        setSuccessMsg("Regularization request submitted to HR for approval.");
        setFormData({
          attendanceDate: new Date().toISOString().split("T")[0],
          proposedCheckIn: "09:00",
          proposedCheckOut: "18:00",
          reason: "",
        });
      }
    } catch (err) {
      console.error("Regularization error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (log: AttendanceLog) => {
    if (log.is_regularized) {
      return (
        <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <FileCheck className="w-3 h-3" /> Regularized
        </span>
      );
    }
    if (log.status === "present") {
      if (log.is_late) {
        return (
          <span className="text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
            Present (Late)
          </span>
        );
      }
      return (
        <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Present
        </span>
      );
    }
    if (log.status === "half_day") {
      return (
        <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Half Day
        </span>
      );
    }
    if (log.status === "on_leave") {
      return (
        <span className="text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
          On Leave
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
        Absent (LOP)
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Attendance & Shift Timing</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Assigned Shift: <span className="font-semibold text-slate-700">{project.shift_start_time} - {project.shift_end_time}</span> &bull; Grace Period:{" "}
            <span className="font-semibold text-slate-700">{project.grace_period_minutes} mins</span> &bull; Late check-in beyond 2.5 hrs is evaluated as Half Day.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
        >
          Request Regularization
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Clock In Widget */}
      <ClockInWidget employeeId={employee.id} initialLog={todayLog} project={project} />

      {/* Attendance History & Regularization Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Log Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Attendance History</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">Past Punches</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5">Check-In</th>
                  <th className="py-3.5 px-5">Check-Out</th>
                  <th className="py-3.5 px-5">Total Hours</th>
                  <th className="py-3.5 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No attendance records found yet. Check in above!
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-900">{item.attendance_date}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-700">
                        {item.check_in_time
                          ? new Date(item.check_in_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--:--"}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-700">
                        {item.check_out_time
                          ? new Date(item.check_out_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--:--"}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">
                        {item.total_hours ? `${item.total_hours} hrs` : "--"}
                      </td>
                      <td className="py-3.5 px-5">{getStatusBadge(item)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regularization Requests Tracker */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Regularizations</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-400">{regs.length} Submitted</span>
          </div>

          <div className="space-y-3">
            {regs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                No regularization requests submitted.
              </p>
            ) : (
              regs.map((r) => (
                <div key={r.id} className="p-3.5 bg-slate-50/80 border border-slate-200/70 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{r.attendance_date}</span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        r.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">
                    Punch: <span className="font-semibold text-indigo-700">{r.proposed_check_in} - {r.proposed_check_out}</span>
                  </p>
                  <p className="text-slate-500 text-[11px] italic bg-white p-2 rounded-lg border border-slate-100">&quot;{r.reason}&quot;</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Regularization Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Request Regularization</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegularizeSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={formData.attendanceDate}
                  onChange={(e) => setFormData({ ...formData, attendanceDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Punch In Time</label>
                  <input
                    type="time"
                    required
                    value={formData.proposedCheckIn}
                    onChange={(e) => setFormData({ ...formData, proposedCheckIn: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Punch Out Time</label>
                  <input
                    type="time"
                    required
                    value={formData.proposedCheckOut}
                    onChange={(e) => setFormData({ ...formData, proposedCheckOut: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason for Regularization</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Forgot biometric punch / client on-site visit / power outage"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit to HR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
