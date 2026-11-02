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
  status:
    | "present"
    | "half_day"
    | "late"
    | "work_from_home"
    | "holiday"
    | "leave"
    | "empty"
    | "absent";
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

  // Load regularization requests.
  useEffect(() => {
    let active = true;

    const loadRegularizations = async () => {
      try {
        const response = await fetch(
          "/api/attendance/regularization",
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          }
        );

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
        console.error(
          "Unable to load attendance regularizations:",
          error
        );
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
      window.removeEventListener(
        "focus",
        loadRegularizations
      );
    };
  }, [employeeId, todayString]);

  // Update attendance when the selected date changes.
  useEffect(() => {
    if (isToday) {
      setLog(initialLog);
    } else {
      setLog(null);
    }
  }, [initialLog, activeDate, isToday]);

  // Calculate worked time.
  useEffect(() => {
    const update = () => {
      const now = new Date();

      if (isToday && log) {
        const previousMinutes = Math.round(
          Number(log.total_hours ?? 0) * 60
        );

        if (log.check_in_time) {
          const start = new Date(log.check_in_time);

          const end = log.check_out_time
            ? new Date(log.check_out_time)
            : now;

          const sessionMinutes = Math.max(
            0,
            Math.floor(
              (end.getTime() - start.getTime()) / 60000
            )
          );

          const totalMinutes = log.check_out_time
            ? previousMinutes
            : previousMinutes + sessionMinutes;

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

  // Attendance punch API.
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

        alert(
          data?.error ||
            data?.message ||
            `Attendance punch failed (${response.status}). Please try again.`
        );

        return;
      }

      if (data?.log) {
        setLog(data.log);
        onAttendanceUpdate?.(data.log);
      }
    } catch (error) {
      console.error("Punch error:", error);
      alert("Unable to record attendance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn =
    isToday &&
    !!log?.check_in_time &&
    !log?.check_out_time;

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

  const requestCreatedTimestamp =
    latestRegularization?.created_at
      ? new Date(latestRegularization.created_at).getTime()
      : 0;

  const requestReviewedTimestamp =
    latestRegularization?.reviewed_at
      ? new Date(latestRegularization.reviewed_at).getTime()
      : 0;

  // Allow another login only after a valid HR approval.
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

  const previousDateStatus =
    selectedAttendance?.status || "empty";

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
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-900">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Present
        </span>
      );
    }

    if (previousDateStatus === "late") {
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          Late
        </span>
      );
    }

    if (previousDateStatus === "work_from_home") {
      return (
        <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold text-blue-900">
          Work From Home
        </span>
      );
    }

    if (previousDateStatus === "half_day") {
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          Half Day
        </span>
      );
    }

    if (previousDateStatus === "leave") {
      return (
        <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-900">
          Leave
        </span>
      );
    }

    if (previousDateStatus === "holiday") {
      return (
        <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-800">
          Holiday
        </span>
      );
    }

    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
        No Attendance
      </span>
    );
  };

  const loginTime = log?.check_in_time
    ? formatPunchTime(log.check_in_time)
    : "--:--";

  const logoutTime = log?.check_out_time
    ? formatPunchTime(log.check_out_time)
    : "--:--";

  return (
    <div
      className={
        compact
          ? "space-y-3"
          : "flex flex-col justify-between space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7"
      }
    >
      {!compact && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-600">
              <Clock className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Attendance & Shift Punch
              </h3>

              <p className="mt-0.5 text-[11px] text-slate-500">
                Shift:{" "}
                <span className="font-semibold text-slate-700">
                  {shiftStart} - {shiftEnd}
                </span>{" "}
                ({project?.timezone || "Asia/Kolkata"})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Previous Date Attendance */}
      {!isToday ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
            <div className="rounded-lg border border-indigo-100 bg-white p-2">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                Selected Date
              </p>

              <p className="text-sm font-bold text-slate-900">
                {formatSelectedDate(activeDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs">
            <span className="font-semibold text-slate-600">
              Attendance:
            </span>

            {renderPreviousStatus()}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Login Time
              </span>

              <span className="font-mono text-sm font-bold text-slate-900">
                {previousClockIn
                  ? formatPunchTime(previousClockIn)
                  : "--"}
              </span>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Logout Time
              </span>

              <span className="font-mono text-sm font-bold text-slate-900">
                {previousClockOut
                  ? formatPunchTime(previousClockOut)
                  : "--"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Shift
              </span>

              <span className="text-sm font-bold text-slate-900">
                {shiftStart} - {shiftEnd}
              </span>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Worked
              </span>

              <span className="font-mono text-sm font-bold text-indigo-700">
                {previousWorked || "--"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-slate-50 py-3 text-center text-xs font-medium text-slate-500">
            Previous date attendance is view-only.
          </div>
        </div>
      ) : (
        <>
          {/* Today's Attendance Status */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Today's Status
            </span>

            {!isCheckedIn && !isCheckedOut ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
                Not Checked In
              </span>
            ) : isCheckedOut ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                Completed
              </span>
            ) : log?.status === "half_day" ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-900">
                Half Day
              </span>
            ) : log?.is_late ? (
              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold text-orange-900">
                Present (Late)
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-900">
                Present
              </span>
            )}
          </div>

          {/* Compact Login and Logout Times */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
              <span className="block text-[10px] font-semibold uppercase text-slate-500">
                Login Time
              </span>

              <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                {loginTime}
              </span>
            </div>

            <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5">
              <span className="block text-[10px] font-semibold uppercase text-slate-500">
                Logout Time
              </span>

              <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                {logoutTime}
              </span>
            </div>
          </div>

          {/* Worked Time - Only in Full Mode */}
          {!compact && isCheckedIn && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Time Worked
              </span>

              <span className="font-mono text-lg font-bold text-indigo-700">
                {Math.floor(workedMinutes / 60)}h{" "}
                {workedMinutes % 60}m
              </span>
            </div>
          )}

          {/* Login and Logout Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handlePunch("in")}
              disabled={loading || !canLogin}
              className={`
                flex w-full items-center justify-center gap-2 rounded-lg
                border px-2 py-2.5 text-xs font-bold transition-all
                ${
                  canLogin
                    ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                    : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                }
              `}
            >
              {loading && !isCheckedIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}

              Login
            </button>

            <button
              type="button"
              onClick={() => handlePunch("out")}
              disabled={loading || !canLogout}
              className={`
                flex w-full items-center justify-center gap-2 rounded-lg
                border px-2 py-2.5 text-xs font-bold transition-all
                ${
                  canLogout
                    ? "border-rose-600 bg-rose-600 text-white hover:bg-rose-700"
                    : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                }
              `}
            >
              {loading && isCheckedIn && !isCheckedOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}

              Logout
            </button>
          </div>

          {/* Approved Leave Message */}
          {isApprovedLeave &&
            !isCheckedIn &&
            !isCheckedOut && (
              <p className="text-center text-[10px] font-medium text-rose-600">
                Approved leave today. Login is disabled.
              </p>
            )}

          {/* Regularization Status */}
          {regularizationPending && (
            <p className="text-center text-[10px] font-medium text-amber-600">
              Your regularization request is awaiting HR approval.
            </p>
          )}

          {isCheckedOut && (
            <p className="text-center text-[10px] font-medium text-emerald-600">
              Attendance recorded successfully.
            </p>
          )}

          {/* Regularization Link - Full Mode Only */}
          {!compact && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onRequestRegularization}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
              >
                Missed punch? Request Regularization
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Attendance History Link */}
      {!isToday && (
        <div className="pt-1 text-center">
          <Link
            href="/portal/attendance"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            View Attendance History
            <ArrowUpRight className="h-3.5 w-3.5" />
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