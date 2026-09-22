"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle2, AlertTriangle, LogIn, LogOut, Loader2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AttendanceLog, Project } from "@/lib/types";

interface ClockInWidgetProps {
  employeeId: string;
  initialLog: AttendanceLog | null;
  project?: Project;
}

export default function ClockInWidget({ employeeId, initialLog, project }: ClockInWidgetProps) {
  const [log, setLog] = useState<AttendanceLog | null>(initialLog);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePunch = async (action: "in" | "out") => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, action }),
      });

      if (res.ok) {
        const data = await res.json();
        setLog(data.log);
      }
    } catch (err) {
      console.error("Punch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn = !!log?.check_in_time;
  const isCheckedOut = !!log?.check_out_time;

  const shiftStart = project?.shift_start_time || "09:00";
  const shiftEnd = project?.shift_end_time || "18:00";
  const graceMinutes = project?.grace_period_minutes || 30;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 mb-5 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-xs border border-indigo-100/80">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Attendance & Shift Punch</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Shift: <span className="font-semibold text-slate-700">{shiftStart} - {shiftEnd}</span> ({project?.timezone || "Asia/Kolkata"})
              </p>
            </div>
          </div>

          <div className="sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-100">
            <span className="text-2xl font-mono font-bold text-indigo-700 block tracking-tight">
              {currentTime || "--:--:--"}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Grace Window: {graceMinutes} mins
            </span>
          </div>
        </div>

        {/* Current Punch Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
            <span className="text-slate-600 font-semibold">Today&apos;s Status:</span>
            {!isCheckedIn ? (
              <span className="font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/80 text-[11px]">
                Not Checked In
              </span>
            ) : isCheckedOut ? (
              <span className="font-semibold text-slate-800 bg-slate-200 px-3 py-1 rounded-full text-[11px]">
                Completed ({log?.total_hours || 0} hrs)
              </span>
            ) : log?.status === "half_day" ? (
              <span className="font-semibold text-amber-900 bg-amber-100 px-3 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Half Day
              </span>
            ) : log?.is_late ? (
              <span className="font-semibold text-orange-900 bg-orange-100 px-3 py-1 rounded-full text-[11px]">
                Present (Late Punch)
              </span>
            ) : (
              <span className="font-semibold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Present (On Time)
              </span>
            )}
          </div>

          {isCheckedIn && (
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Check-In Time</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {new Date(log!.check_in_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70">
                <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Check-Out Time</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {isCheckedOut
                    ? new Date(log!.check_out_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : "Active Session"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {!isCheckedIn ? (
          <button
            onClick={() => handlePunch("in")}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>Clock In Now</span>
          </button>
        ) : !isCheckedOut ? (
          <button
            onClick={() => handlePunch("out")}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            <span>Clock Out Now</span>
          </button>
        ) : (
          <div className="text-center py-2.5 text-xs text-slate-600 font-medium bg-slate-50 rounded-xl border border-slate-200/70">
            Attendance recorded successfully for today.
          </div>
        )}

        <div className="text-center pt-0.5">
          <Link
            href="/portal/attendance"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 transition-colors"
          >
            <span>Missed punch? Request Regularization</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
