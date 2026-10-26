
"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  Loader2,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { AttendanceLog, Project } from "@/lib/types";

export interface SelectedAttendance {
  date: string;
  status: "present" | "half_day" | "leave" | "empty" | "absent";
  clockIn?: string;
  clockOut?: string;
  worked?: string;
}

interface AttendanceRegularizationRequest {
  id: string;
  employee_id: string;
  attendance_date: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
}

interface ClockInWidgetProps {
  employeeId: string;
  isApprovedLeave?: boolean;
  initialLog: AttendanceLog | null;
  project?: Project;
  compact?: boolean;
  selectedDate?: string;
  selectedAttendance?: SelectedAttendance | null;
  onRequestRegularization?: () => void;
  onAttendanceUpdate?: (updatedLog: AttendanceLog) => void;
}

export default function ClockInWidget({
  employeeId,
  initialLog,
  project,
  compact = false,
  selectedDate,
  isApprovedLeave = false,
  selectedAttendance,
  onRequestRegularization,
  onAttendanceUpdate,
}: ClockInWidgetProps) {
  const [log, setLog] = useState<AttendanceLog | null>(initialLog);
  const [regularizationRequests, setRegularizationRequests] =
    useState<AttendanceRegularizationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [workedMinutes, setWorkedMinutes] = useState(0);

  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayString = getTodayString();
  const activeDate = selectedDate || todayString;
  const isToday = activeDate === todayString;

  // Load regularization requests and refresh after HR approval.
  useEffect(() => {
    let active = true;

    const loadRegularizations = async () => {
      try {
        const response = await fetch("/api/attendance/regularization", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return;

        const data = await response.json();
        const requests = Array.isArray(data)
          ? data
          : Array.isArray(data?.requests)
            ? data.requests
            : Array.isArray(data?.regularizations)
              ? data.regularizations
              : [];

        if (active) {
          setRegularizationRequests(requests);
        }
      } catch (error) {
        console.error("Unable to load attendance regularizations:", error);
      }
    };

    void loadRegularizations();

    const interval = window.setInterval(() => {
      void loadRegularizations();
    }, 15000);

    window.addEventListener("focus", loadRegularizations);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadRegularizations);
    };
  }, [employeeId, todayString]);

  // Show today's attendance only when today is selected.
  useEffect(() => {
    if (isToday) {
      setLog(initialLog);
    } else {
      setLog(null);
    }
  }, [initialLog, activeDate, isToday]);

  // Update the worked-time display every second.
  useEffect(() => {
    const update = () => {
      const now = new Date();

      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );

      if (isToday && log) {
        const previousMinutes = Math.round(
          Number(log.total_hours ?? 0) * 60
        );

        const sessionCheckInTime =
          log.session_check_in_time ?? log.check_in_time;

        if (sessionCheckInTime) {
          const start = new Date(sessionCheckInTime);
          const end = log.check_out_time ? new Date(log.check_out_time) : now;

          const sessionMinutes = Math.max(0,Math.floor((end.getTime() - start.getTime()) / 60000));

          // total_hours already represents the saved session when
          // checked out, so don't add that same session twice.
          const totalMinutes = log.check_out_time ? previousMinutes : previousMinutes + sessionMinutes;

          setWorkedMinutes(totalMinutes);
        } else {
          setWorkedMinutes(previousMinutes);
        }
      } else {
        setWorkedMinutes(0);
      }
    };

    update();
    const timer = window.setInterval(update, 1000);

    return () => window.clearInterval(timer);
  }, [log, isToday]);

  // Only a button click sends an attendance punch.
  const handlePunch = async (action: "in" | "out") => {
    if (!isToday || loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          action,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("Attendance punch failed:", {
          status: response.status,
          statusText: response.statusText,
          response: data,
        });

        const message =
          data?.error ||
          data?.message ||
          `Attendance punch failed (${response.status})`;

        // Show the actual API error if your component supports it.
        alert(message);
        return;
      }

      if (data?.log) {
        setLog(data.log);
        onAttendanceUpdate?.(data.log);
      }
    } catch (error) {
      console.error("Punch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn =
    isToday && !!log?.check_in_time && !log?.check_out_time;

  const isCheckedOut =
    isToday && !!log?.check_out_time;

  const checkoutTimestamp = log?.check_out_time
    ? new Date(log.check_out_time).getTime()
    : 0;

  const latestRegularization = regularizationRequests
    .filter(
      (request) =>
        request.employee_id === employeeId &&
        request.attendance_date === todayString
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )[0];

  const requestCreatedTimestamp = latestRegularization?.created_at
    ? new Date(latestRegularization.created_at).getTime()
    : 0;

  const requestReviewedTimestamp = latestRegularization?.reviewed_at
    ? new Date(latestRegularization.reviewed_at).getTime()
    : 0;

  // Only an approval for a request created after the checkout
  // can allow another login.
  const regularizationApproved =
    latestRegularization?.status === "approved" &&
    requestCreatedTimestamp > checkoutTimestamp &&
    requestReviewedTimestamp >= requestCreatedTimestamp;

  const regularizationPending =
    latestRegularization?.status === "pending" &&
    requestCreatedTimestamp > checkoutTimestamp;

  const canLogin =
    isToday &&
    !isCheckedIn &&
    !isApprovedLeave &&
    !regularizationPending &&
    (!isCheckedOut || regularizationApproved);

  const canLogout =
    isToday &&
    isCheckedIn &&
    !isApprovedLeave;

  const shiftStart = project?.shift_start_time || "09:00";
  const shiftEnd = project?.shift_end_time || "18:00";

  const previousDateStatus = selectedAttendance?.status || "empty";
  const previousClockIn = selectedAttendance?.clockIn;
  const previousClockOut = selectedAttendance?.clockOut;
  const previousWorked = selectedAttendance?.worked;

  const formatSelectedDate = (date: string) => {
    if (!date) return "";

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) return date;

    return parsedDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderPreviousStatus = () => {
    if (previousDateStatus === "present") {
      return (
        <span className="font-semibold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Present
        </span>
      );
    }

    if (previousDateStatus === "half_day") {
      return (
        <span className="font-semibold text-amber-900 bg-amber-100 px-3 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Half Day
        </span>
      );
    }

    if (previousDateStatus === "leave") {
      return (
        <span className="font-semibold text-rose-900 bg-rose-100 px-3 py-1 rounded-full text-[11px]">
          Leave
        </span>
      );
    }

    return (
      <span className="font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full text-[11px]">
        No Attendance
      </span>
    );
  };

  return (
    <div
      className={`${
        compact ? "p-4 sm:p-5 space-y-4" : "p-6 sm:p-7 space-y-6"
      } bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between`}
    >
      <div>
        <div
          className={`${
            compact ? "pb-3 mb-3 gap-3" : "pb-5 mb-5 gap-4"
          } flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`${
                compact ? "p-2" : "p-3"
              } bg-indigo-50 text-indigo-600 rounded-xl shadow-xs border border-indigo-100/80`}
            >
              <Clock className={compact ? "w-4 h-4" : "w-5 h-5"} />
            </div>

            <div>
              <h3
                className={`${
                  compact ? "text-sm" : "text-base"
                } font-bold text-slate-900`}
              >
                Attendance & Shift Punch
              </h3>

              <p className="text-[11px] text-slate-500 mt-0.5">
                Shift:{" "}
                <span className="font-semibold text-slate-700">
                  {shiftStart} - {shiftEnd}
                </span>{" "}
                ({project?.timezone || "Asia/Kolkata"})
              </p>
            </div>
          </div>
        </div>

        {!isToday ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
              <div className="p-2 bg-white rounded-lg border border-indigo-100">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-500">
                  Selected Date
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {formatSelectedDate(activeDate)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
              <span className="text-slate-600 font-semibold">
                Attendance:
              </span>
              {renderPreviousStatus()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Login Time
                </span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {previousClockIn
                    ? formatPunchTime(previousClockIn)
                    : "--"}
                </span>
              </div>

              <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-100">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Logout Time
                </span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {previousClockOut
                    ? formatPunchTime(previousClockOut)
                    : "--"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Shift
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {shiftStart} - {shiftEnd}
                </span>
              </div>

              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Total Worked
                </span>
                <span className="font-bold text-indigo-700 text-sm font-mono">
                  {previousWorked || "--"}
                </span>
              </div>
            </div>

            <div className="text-center py-3 text-xs text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-200/70">
              Previous date attendance is view-only.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
              <span className="text-slate-600 font-semibold">
                Today&apos;s Status:
              </span>

              {!isCheckedIn && !isCheckedOut ? (
                <span className="font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/80 text-[11px]">
                  Not Checked In
                </span>
              ) : isCheckedOut ? (
                <span className="font-semibold text-slate-800 bg-slate-200 px-3 py-1 rounded-full text-[11px]">
                  Completed ({log?.total_hours || 0} hrs)
                </span>
              ) : log?.status === "half_day" ? (
                <span className="font-semibold text-amber-900 bg-amber-100 px-3 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Half Day
                </span>
              ) : log?.is_late ? (
                <span className="font-semibold text-orange-900 bg-orange-100 px-3 py-1 rounded-full text-[11px]">
                  Present (Late Punch)
                </span>
              ) : (
                <span className="font-semibold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Present (On Time)
                </span>
              )}
            </div>

            {isCheckedIn && (
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                    Login
                  </span>
                  <span className="font-bold text-slate-900 text-sm font-mono">
                    {log?.check_in_time
                      ? formatPunchTime(log.check_in_time)
                      : "--"}
                  </span>
                </div>

                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                    LogOut
                  </span>
                  <span className="font-bold text-slate-900 text-sm font-mono">
                    {log?.check_out_time
                      ? formatPunchTime(log.check_out_time)
                      : "Active Session"}
                  </span>
                </div>

                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                    Time Worked
                  </span>
                  <span className="font-bold text-indigo-700 text-lg font-mono">
                    {Math.floor(workedMinutes / 60)}h {workedMinutes % 60}m
                  </span>
                </div>

                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                    Shift
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {shiftStart} - {shiftEnd}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isToday && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handlePunch("in")}
              disabled={loading || !canLogin}
              className={`
                w-full flex items-center justify-center gap-2 py-3 px-4
                rounded-xl text-sm font-bold transition-all border
                ${
                  canLogin
                    ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-sm"
                    : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                }
              `}
            >
              {loading && !isCheckedIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>Login</span>
            </button>

            <button
              type="button"
              onClick={() => handlePunch("out")}
              disabled={loading || !canLogout}
              className={`
                w-full flex items-center justify-center gap-2 py-3 px-4
                rounded-xl text-sm font-bold transition-all border
                ${
                  canLogout
                    ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700 shadow-sm"
                    : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                }
              `}
            >
              {loading && isCheckedIn && !isCheckedOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Logout</span>
            </button>
          </div>

          {isApprovedLeave && !isCheckedIn && !isCheckedOut ? (
            <p className="text-center text-[11px] font-medium text-rose-600">
              You have approved leave for today. Login is disabled.
            </p>
          ) : !isCheckedIn && !isCheckedOut ? (
            <p className="text-center text-[11px] font-medium text-slate-500">
              Click Login to start your attendance.
            </p>
          ) : null}

          {isCheckedIn && !isCheckedOut && (
            <p className="text-center text-[11px] font-medium text-emerald-600">
              You are currently logged in. Click Logout when you finish.
            </p>
          )}

          {isCheckedOut && (
            <div className="text-center py-2.5 text-xs text-slate-600 font-medium bg-slate-50 rounded-xl border border-slate-200/70">
              Attendance recorded successfully for today.
            </div>
          )}

          <div className="text-center pt-0.5">
            <button
              type="button"
              onClick={onRequestRegularization}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <span>
                Missed punch? Request Regularization
              </span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {!isToday && (
        <div className="text-center pt-1">
          <Link
            href="/portal/attendance"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 transition-colors"
          >
            <span>View Attendance History</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function formatPunchTime(value: string) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}