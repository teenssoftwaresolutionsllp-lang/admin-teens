"use client";

import { useMemo, useState } from "react";

import {
  AttendanceLog,
  AttendanceRegularization,
  Employee,
  Project,
} from "@/lib/types";

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
import AttendanceCalendar, {
  SelectedAttendance,
} from "./AttendanceCalendar";

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
  // =========================================================
  // ATTENDANCE LOGS
  // =========================================================

  const [logs, setLogs] =
    useState<AttendanceLog[]>(historyLogs);

  // =========================================================
  // REGULARIZATIONS
  // =========================================================

  const [regs, setRegs] =
    useState<AttendanceRegularization[]>(initialRegs);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [successMsg, setSuccessMsg] =
    useState<string | null>(null);

  // =========================================================
  // CALENDAR VISIBILITY
  // =========================================================

  const [showAttendanceCalendar, setShowAttendanceCalendar] =
    useState(false);

  // =========================================================
  // SELECTED CALENDAR ATTENDANCE
  // =========================================================

  const [selectedAttendance, setSelectedAttendance] =
    useState<SelectedAttendance | null>(null);

  // =========================================================
  // REGULARIZATION FORM
  // =========================================================

  const [formData, setFormData] = useState({
    attendanceDate:
      new Date().toISOString().split("T")[0],

    proposedCheckIn: "09:00",

    proposedCheckOut: "18:00",

    reason: "",
  });

  // =========================================================
  // TODAY DATE
  // =========================================================

  const todayDate = useMemo(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }, []);

  // =========================================================
  // REGULARIZATION SUBMIT
  // =========================================================

  const handleRegularizeSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        "/api/attendance/regularization",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            employeeId: employee.id,
            ...formData,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();

        setRegs([
          data.regularization,
          ...regs,
        ]);

        setIsModalOpen(false);

        setSuccessMsg(
          "Regularization request submitted to HR for approval."
        );

        setFormData({
          attendanceDate:
            new Date().toISOString().split("T")[0],

          proposedCheckIn: "09:00",

          proposedCheckOut: "18:00",

          reason: "",
        });
      }
    } catch (err) {
      console.error(
        "Regularization error:",
        err
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================
  // STATUS BADGE
  // =========================================================

  const getStatusBadge = (
    log: AttendanceLog
  ) => {
    if (log.is_regularized) {
      return (
        <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <FileCheck className="w-3 h-3" />

          Regularized
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
          <CheckCircle2 className="w-3 h-3" />

          Present
        </span>
      );
    }

    if (log.status === "half_day") {
      return (
        <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />

          Half Day
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

  // =========================================================
  // CALENDAR TOGGLE
  // =========================================================

  const handleCalendarToggle = () => {
    setShowAttendanceCalendar(
      (previous) => !previous
    );

    /*
     * When calendar is closed, clear selected date.
     * This prevents old selected attendance from
     * appearing when calendar is opened again.
     */
    if (showAttendanceCalendar) {
      setSelectedAttendance(null);
    }
  };

  // =========================================================
  // CALENDAR DATE SELECT
  // =========================================================

  const handleCalendarDateSelect = (
    attendance: SelectedAttendance
  ) => {
    setSelectedAttendance(attendance);
  };

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (
    value?: string | null
  ) => {
    if (!value) {
      return "--:--";
    }

    /*
     * Already formatted time:
     * 09:05 AM
     */
    if (
      value.includes("AM") ||
      value.includes("PM")
    ) {
      return value;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatSelectedDate = (
    date?: string
  ) => {
    if (!date) {
      return "--";
    }

    const parsedDate = new Date(
      `${date}T00:00:00`
    );

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString(
      "en-CA"
    );
  };

  // =========================================================
  // FORMAT TOTAL HOURS
  // =========================================================

  const formatWorkedHours = (
    worked?: string
  ) => {
    if (!worked) {
      return "--";
    }

    return worked;
  };

  // =========================================================
  // CHECK WHETHER SELECTED DATE IS TODAY
  // =========================================================

  const isSelectedToday =
    selectedAttendance?.date === todayDate;

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* =====================================================
          TOP BANNER
      ====================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">

        <div className="space-y-1">

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Attendance & Shift Timing
          </h2>

          <p className="text-xs sm:text-sm text-slate-500">

            Assigned Shift:{" "}

            <span className="font-semibold text-slate-700">
              {project.shift_start_time} -{" "}
              {project.shift_end_time}
            </span>

            {" "}&bull; Grace Period:{" "}

            <span className="font-semibold text-slate-700">
              {project.grace_period_minutes} mins
            </span>

            {" "}&bull; Late check-in beyond 2.5 hrs is evaluated
            as Half Day.

          </p>

        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
        >
          Request Regularization
        </button>

      </div>

      {/* =====================================================
          SUCCESS MESSAGE
      ====================================================== */}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">

          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />

          <span>
            {successMsg}
          </span>

        </div>
      )}

      {/* =====================================================
          CLOCK IN / CLOCK OUT WIDGET
      ====================================================== */}

      <ClockInWidget
        employeeId={employee.id}
        initialLog={todayLog}
        project={project}
      />

      {/* =====================================================
          ATTENDANCE HISTORY + REGULARIZATIONS
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ===================================================
            ATTENDANCE HISTORY
        ==================================================== */}

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">

          {/* =================================================
              ATTENDANCE HISTORY HEADER
          ================================================== */}

          <div className="p-5 border-b border-slate-100 flex items-center justify-between">

            <div className="flex items-center gap-2">

              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">

                <span>
                  Attendance History
                </span>

              </h3>

              {/* =================================================
                  CALENDAR BUTTON
              ================================================== */}

              <button
                type="button"
                onClick={handleCalendarToggle}
                title={
                  showAttendanceCalendar
                    ? "Hide Calendar"
                    : "Show Calendar"
                }
                aria-label={
                  showAttendanceCalendar
                    ? "Hide Calendar"
                    : "Show Calendar"
                }
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                  showAttendanceCalendar
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200"
                }`}
              >
                <Calendar className="w-4 h-4" />
              </button>

            </div>

            <span className="text-xs font-semibold text-slate-400">
              Past Punches
            </span>

          </div>

          {/* =================================================
              EXISTING ATTENDANCE CALENDAR
          ================================================== */}

          {showAttendanceCalendar && (
            <div className="border-b border-slate-100 bg-slate-50/30 p-4 sm:p-5">

              <AttendanceCalendar
                logs={logs}
                leaveRequests={[]}
                onDateSelect={
                  handleCalendarDateSelect
                }
              />

              {/* =================================================
                  SELECTED DATE ATTENDANCE
                  THIS APPEARS BELOW THE CALENDAR
              ================================================== */}

              {selectedAttendance && (
                <div className="mt-5 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

                  {/* =================================================
                      SELECTED DATE HEADER
                  ================================================== */}

                  <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200">

                    <div className="flex items-center justify-between">

                      <div>

                        <h4 className="text-sm font-bold text-slate-900">
                          Attendance Details
                        </h4>

                        <p className="text-xs text-slate-500 mt-1">
                          {formatSelectedDate(
                            selectedAttendance.date
                          )}
                        </p>

                      </div>

                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                          selectedAttendance.status ===
                          "present"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : selectedAttendance.status ===
                              "half_day"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : selectedAttendance.status ===
                              "leave"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {selectedAttendance.status ===
                        "present"
                          ? "Present"
                          : selectedAttendance.status ===
                            "half_day"
                          ? "Half Day"
                          : selectedAttendance.status ===
                            "leave"
                          ? "Leave"
                          : "No Attendance"}
                      </span>

                    </div>

                  </div>

                  {/* =================================================
                      ATTENDANCE TABLE
                  ================================================== */}

                  <div className="overflow-x-auto">

                    <table className="w-full text-left text-xs text-slate-600">

                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">

                        <tr>

                          <th className="py-3.5 px-5">
                            Date
                          </th>

                          <th className="py-3.5 px-5">
                            Check-In
                          </th>

                          <th className="py-3.5 px-5">
                            Check-Out
                          </th>

                          <th className="py-3.5 px-5">
                            Total Hours
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        <tr className="hover:bg-slate-50/80 transition-colors">

                          {/* DATE */}

                          <td className="py-4 px-5 font-bold text-slate-900">
                            {formatSelectedDate(
                              selectedAttendance.date
                            )}
                          </td>

                          {/* CHECK IN */}

                          <td className="py-4 px-5 font-mono font-semibold text-emerald-700">

                            {formatTime(
                              selectedAttendance.clockIn
                            )}

                          </td>

                          {/* CHECK OUT */}

                          <td className="py-4 px-5 font-mono font-semibold text-rose-700">

                            {formatTime(
                              selectedAttendance.clockOut
                            )}

                          </td>

                          {/* TOTAL HOURS */}

                          <td className="py-4 px-5 font-mono font-bold text-slate-800">

                            {formatWorkedHours(
                              selectedAttendance.worked
                            )}

                          </td>

                        </tr>

                      </tbody>

                    </table>

                  </div>

                  {/* =================================================
                      TODAY INFORMATION
                  ================================================== */}

                  {isSelectedToday && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-sky-50/60">

                      <p className="text-[11px] text-sky-700 font-medium">

                        Clock In time appears after you
                        click Clock In. Clock Out and Total
                        Hours will appear after you click
                        Clock Out.

                      </p>

                    </div>
                  )}

                  {/* =================================================
                      PREVIOUS DATE INFORMATION
                  ================================================== */}

                  {!isSelectedToday && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">

                      <p className="text-[11px] text-slate-500 font-medium">

                        Showing attendance timings for the
                        selected previous date.

                      </p>

                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* =================================================
              MAIN ATTENDANCE TABLE
          ================================================== */}

          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs text-slate-600">

              <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">

                <tr>

                  <th className="py-3.5 px-5">
                    Date
                  </th>

                  <th className="py-3.5 px-5">
                    Check-In
                  </th>

                  <th className="py-3.5 px-5">
                    Check-Out
                  </th>

                  <th className="py-3.5 px-5">
                    Total Hours
                  </th>

                  <th className="py-3.5 px-5">
                    Status
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {logs.length === 0 ? (

                  <tr>

                    <td
                      colSpan={5}
                      className="text-center py-8 text-slate-400"
                    >
                      No attendance records found yet.
                      Check in above!
                    </td>

                  </tr>

                ) : (

                  logs.map((item) => (

                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >

                      {/* DATE */}

                      <td className="py-3.5 px-5 font-bold text-slate-900">

                        {item.attendance_date}

                      </td>

                      {/* CHECK IN */}

                      <td className="py-3.5 px-5 font-mono text-slate-700">

                        {item.check_in_time
                          ? new Date(
                              item.check_in_time
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "--:--"}

                      </td>

                      {/* CHECK OUT */}

                      <td className="py-3.5 px-5 font-mono text-slate-700">

                        {item.check_out_time
                          ? new Date(
                              item.check_out_time
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "--:--"}

                      </td>

                      {/* TOTAL HOURS */}

                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">

                        {item.total_hours
                          ? `${item.total_hours} hrs`
                          : "--"}

                      </td>

                      {/* STATUS */}

                      <td className="py-3.5 px-5">

                        {getStatusBadge(item)}

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* ===================================================
            REGULARIZATION REQUESTS
        ==================================================== */}

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">

          <div className="flex items-center justify-between border-b border-slate-100 pb-3">

            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">

              <Clock className="w-4 h-4 text-indigo-600" />

              <span>
                Regularizations
              </span>

            </h3>

            <span className="text-[11px] font-bold text-slate-400">

              {regs.length} Submitted

            </span>

          </div>

          <div className="space-y-3">

            {regs.length === 0 ? (

              <p className="text-xs text-slate-400 text-center py-8">
                No regularization requests submitted.
              </p>

            ) : (

              regs.map((r) => (

                <div
                  key={r.id}
                  className="p-3.5 bg-slate-50/80 border border-slate-200/70 rounded-xl text-xs space-y-1.5"
                >

                  <div className="flex items-center justify-between">

                    <span className="font-bold text-slate-900">
                      {r.attendance_date}
                    </span>

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

                    Punch:{" "}

                    <span className="font-semibold text-indigo-700">

                      {r.proposed_check_in} -{" "}
                      {r.proposed_check_out}

                    </span>

                  </p>

                  <p className="text-slate-500 text-[11px] italic bg-white p-2 rounded-lg border border-slate-100">

                    &quot;
                    {r.reason}
                    &quot;

                  </p>

                </div>

              ))

            )}

          </div>

        </div>

      </div>

      {/* =====================================================
          REGULARIZATION MODAL
      ====================================================== */}

      {isModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">

          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between pb-3 border-b border-slate-200">

              <h3 className="text-base font-bold text-slate-900">
                Request Regularization
              </h3>

              <button
                type="button"
                onClick={() =>
                  setIsModalOpen(false)
                }
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >

                <XCircle className="w-5 h-5" />

              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleRegularizeSubmit}
              className="mt-4 space-y-3 text-xs"
            >

              {/* DATE */}

              <div>

                <label className="font-semibold text-slate-700 block mb-1">
                  Date
                </label>

                <input
                  type="date"
                  required
                  value={
                    formData.attendanceDate
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendanceDate:
                        e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                />

              </div>

              {/* TIME */}

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="font-semibold text-slate-700 block mb-1">
                    Punch In Time
                  </label>

                  <input
                    type="time"
                    required
                    value={
                      formData.proposedCheckIn
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        proposedCheckIn:
                          e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />

                </div>

                <div>

                  <label className="font-semibold text-slate-700 block mb-1">
                    Punch Out Time
                  </label>

                  <input
                    type="time"
                    required
                    value={
                      formData.proposedCheckOut
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        proposedCheckOut:
                          e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />

                </div>

              </div>

              {/* REASON */}

              <div>

                <label className="font-semibold text-slate-700 block mb-1">
                  Reason for Regularization
                </label>

                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reason: e.target.value,
                    })
                  }
                  placeholder="e.g. Forgot biometric punch / client on-site visit / power outage"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                />

              </div>

              {/* BUTTONS */}

              <div className="flex items-center justify-end gap-2 pt-3 border-t">

                <button
                  type="button"
                  onClick={() =>
                    setIsModalOpen(false)
                  }
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >

                  {submitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}

                  <span>
                    Submit to HR
                  </span>

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}