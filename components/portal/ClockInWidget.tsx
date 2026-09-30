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

interface SelectedAttendance {
  date: string;
  status: "present" | "half_day" | "leave" | "empty";
  clockIn?: string;
  clockOut?: string;
  worked?: string;
}

interface ClockInWidgetProps {
  employeeId: string;
  initialLog: AttendanceLog | null;
  project?: Project;
  compact?: boolean;

  // Selected date from AttendanceCalendar
  selectedDate?: string;

  // Attendance details received from AttendanceCalendar
  selectedAttendance?: SelectedAttendance | null;
}

export default function ClockInWidget({
  employeeId,
  initialLog,
  project,
  compact = false,
  selectedDate,
  selectedAttendance,
}: ClockInWidgetProps) {
  const [log, setLog] = useState<AttendanceLog | null>(initialLog);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [workedMinutes, setWorkedMinutes] = useState(0);

  /*
   * Get today's date in YYYY-MM-DD format.
   *
   * Example:
   * 2026-09-25
   */
  const getTodayString = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const todayString = getTodayString();

  /*
   * If selectedDate is not provided,
   * use today.
   */
  const activeDate = selectedDate || todayString;

  /*
   * Check whether selected date is today.
   */
  const isToday = activeDate === todayString;

  /*
   * When selected date changes:
   *
   * - Today -> use initial/current log
   * - Previous date -> don't keep today's punch state
   */
  useEffect(() => {
    if (isToday) {
      setLog(initialLog);
    } else {
      setLog(null);
    }
  }, [initialLog, activeDate, isToday]);

  /*
   * Current clock + worked minutes.
   *
   * IMPORTANT:
   * This does NOT call Clock Out automatically.
   *
   * It only calculates the displayed worked time.
   */
  useEffect(() => {
    const update = () => {
      const now = new Date();

      // setCurrentTime(
      //   now.toLocaleTimeString("en-US", {
      //     hour: "2-digit",
      //     minute: "2-digit",
      //     second: "2-digit",
      //     hour12: true,
      //   })
      // );

      /*
       * Only calculate live worked time for today's active punch.
       */
      if (isToday && log?.check_in_time) {
        const start = new Date(log.check_in_time);

        const end = log.check_out_time
          ? new Date(log.check_out_time)
          : now;

        const minutes = Math.max(
          0,
          Math.floor(
            (end.getTime() - start.getTime()) / 60000
          )
        );

        setWorkedMinutes(minutes);
      } else {
        setWorkedMinutes(0);
      }
    };

    update();

    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, [log, isToday]);

  /*
   * Clock In / Clock Out API
   *
   * This function is allowed ONLY for today.
   */
  const handlePunch = async (action: "in" | "out") => {
    /*
     * Never allow punching for previous dates.
     */
    if (!isToday) {
      return;
    }

    /*
     * Prevent duplicate requests.
     */
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          action,
        }),
      });

      if (!res.ok) {
        console.error(
          "Attendance punch failed:",
          res.status
        );
        return;
      }

      const data = await res.json();

      /*
       * Update local state only with API response.
       *
       * Refreshing the page will NOT call this function,
       * so refresh cannot automatically Clock Out.
       */
      if (data?.log) {
        setLog(data.log);
      }
    } catch (err) {
      console.error("Punch error:", err);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Today's punch state.
   */
  const isCheckedIn = isToday && !!log?.check_in_time;
  const isCheckedOut = isToday && !!log?.check_out_time;

  /*
   * Project shift details.
   */
  const shiftStart =
    project?.shift_start_time || "09:00";

  const shiftEnd =
    project?.shift_end_time || "18:00";

  const graceMinutes =
    project?.grace_period_minutes || 30;

  /*
   * Previous-date attendance details.
   */
  const previousDateStatus =
    selectedAttendance?.status || "empty";

  const previousClockIn =
    selectedAttendance?.clockIn;

  const previousClockOut =
    selectedAttendance?.clockOut;

  const previousWorked =
    selectedAttendance?.worked;

  /*
   * Convert status into readable text.
   */
  const getAttendanceStatus = () => {
    if (previousDateStatus === "present") {
      return "Present";
    }

    if (previousDateStatus === "half_day") {
      return "Half Day";
    }

    if (previousDateStatus === "leave") {
      return "Leave";
    }

    return "No Attendance";
  };

  /*
   * Format selected date.
   *
   * Example:
   * 2026-09-24
   * ->
   * September 24, 2026
   */
  const formatSelectedDate = (date: string) => {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(
      `${date}T00:00:00`
    );

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      }
    );
  };

  /*
   * Get status badge for previous date.
   */
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
        compact
          ? "p-4 sm:p-5 space-y-4"
          : "p-6 sm:p-7 space-y-6"
      } bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between`}
    >
      <div>
        {/* =====================================================
            HEADER
        ====================================================== */}
        <div
          className={`${
            compact
              ? "pb-3 mb-3 gap-3"
              : "pb-5 mb-5 gap-4"
          } flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`${
                compact ? "p-2" : "p-3"
              } bg-indigo-50 text-indigo-600 rounded-xl shadow-xs border border-indigo-100/80`}
            >
              <Clock
                className={
                  compact
                    ? "w-4 h-4"
                    : "w-5 h-5"
                }
              />
            </div>

            <div>
              <h3
                className={`${
                  compact
                    ? "text-sm"
                    : "text-base"
                } font-bold text-slate-900`}
              >
                Attendance & Shift Punch
              </h3>

              <p className="text-[11px] text-slate-500 mt-0.5">
                Shift:{" "}
                <span className="font-semibold text-slate-700">
                  {shiftStart} - {shiftEnd}
                </span>{" "}
                (
                {project?.timezone ||
                  "Asia/Kolkata"}
                )
              </p>
            </div>
          </div>

          {/* Current Time */}
          {/* <div className="sm:text-right bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-xl border sm:border-0 border-slate-100">
            <span
              className={`${
                compact
                  ? "text-xl"
                  : "text-2xl"
              } font-mono font-bold text-indigo-700 block tracking-tight`}
            >
              {currentTime || "--:--:--"}
            </span>

            <span className="text-[11px] text-slate-400 font-medium">
              Grace Window: {graceMinutes} mins
            </span>
          </div> */}
        </div>

        {/* =====================================================
            PREVIOUS DATE VIEW
        ====================================================== */}
        {!isToday ? (
          <div className="space-y-4">
            {/* Selected Date */}
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

            {/* Attendance Status */}
            <div className="flex items-center justify-between text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
              <span className="text-slate-600 font-semibold">
                Attendance:
              </span>

              {renderPreviousStatus()}
            </div>

            {/* Login / Logout */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Login Time
                </span>

                <span className="font-bold text-slate-900 text-sm font-mono">
                  {previousClockIn
                    ? formatPunchTime(
                        previousClockIn
                      )
                    : "--"}
                </span>
              </div>

              <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-100">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Logout Time
                </span>

                <span className="font-bold text-slate-900 text-sm font-mono">
                  {previousClockOut
                    ? formatPunchTime(
                        previousClockOut
                      )
                    : "--"}
                </span>
              </div>
            </div>

            {/* Shift */}
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

            {/* Previous date message */}
            <div className="text-center py-3 text-xs text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-200/70">
              Previous date attendance is view-only.
            </div>
          </div>
        ) : (
          /* ===================================================
             TODAY VIEW
          ==================================================== */
          <div className="space-y-4">
            {/* Current Punch Status */}
            <div className="flex items-center justify-between text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
              <span className="text-slate-600 font-semibold">
                Today&apos;s Status:
              </span>

              {!isCheckedIn ? (
                <span className="font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/80 text-[11px]">
                  Not Checked In
                </span>
              ) : isCheckedOut ? (
                <span className="font-semibold text-slate-800 bg-slate-200 px-3 py-1 rounded-full text-[11px]">
                  Completed (
                  {log?.total_hours || 0} hrs)
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

            {/* Time Details */}
            {isCheckedIn && (
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                {/* Worked */}
                

                {/* Clock In */}
                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                    Login
                  </span>

                  <span className="font-bold text-slate-900 text-sm font-mono">
                    {log?.check_in_time
                      ? formatPunchTime(
                          log.check_in_time
                        )
                      : "--"}
                  </span>
                </div>

                {/* Clock Out */}
                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                    LogOut
                  </span>

                  <span className="font-bold text-slate-900 text-sm font-mono">
                    {log?.check_out_time
                      ? formatPunchTime(
                          log.check_out_time
                        )
                      : "Active Session"}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                    Time Worked
                  </span>

                  <span className="font-bold text-indigo-700 text-lg font-mono">
                    {Math.floor(
                      workedMinutes / 60
                    )}
                    h{" "}
                    {workedMinutes % 60}m
                  </span>
                </div>

                {/* Shift */}
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

      {/* =====================================================
          BUTTONS
          IMPORTANT:
          Buttons are ONLY shown for TODAY.
      ====================================================== */}
      {isToday && (
        <div className="space-y-2 pt-1">
          {!isCheckedIn ? (
            <button
              type="button"
              onClick={() =>
                handlePunch("in")
              }
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}

              <span>LogIn Now</span>
            </button>
          ) : !isCheckedOut ? (
            <button
              type="button"
              onClick={() =>
                handlePunch("out")
              }
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}

              <span>LogOut Now</span>
            </button>
          ) : (
            <div className="text-center py-2.5 text-xs text-slate-600 font-medium bg-slate-50 rounded-xl border border-slate-200/70">
              Attendance recorded successfully for today.
            </div>
          )}

          {/* Regularization */}
          <div className="text-center pt-0.5">
            <Link
              href="/portal/attendance"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <span>
                Missed punch? Request
                Regularization
              </span>

              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Previous date has no buttons */}
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

/* ============================================================
   HELPER
============================================================ */

function formatPunchTime(value: string) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  /*
   * If value is already a display time such as:
   * "09:20 AM"
   * don't try to parse it as a date.
   */
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  );
}