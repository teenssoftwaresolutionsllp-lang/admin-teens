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
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Attendance & Shift Punch</h3>
              <p className="text-xs text-slate-500">
                Shift: {shiftStart} - {shiftEnd} ({project?.timezone || "Asia/Kolkata"})
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-lg font-mono font-bold text-indigo-700 block">
              {currentTime || "--:--:--"}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Grace Period: {graceMinutes}m
            </span>
          </div>
        </div>

        {/* Current Punch Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-600 font-medium">Status for Today:</span>
            {!isCheckedIn ? (
              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Not Checked In
              </span>
            ) : isCheckedOut ? (
              <span className="font-semibold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                Completed ({log?.total_hours || 0} hrs)
              </span>
            ) : log?.status === "half_day" ? (
              <span className="font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Half Day
              </span>
            ) : log?.is_late ? (
              <span className="font-semibold text-orange-800 bg-orange-100 px-2 py-0.5 rounded">
                Present (Late)
              </span>
            ) : (
              <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Present (On Time)
              </span>
            )}
          </div>

          {isCheckedIn && (
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Check-In</span>
                <span className="font-bold text-slate-800">
                  {new Date(log!.check_in_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Check-Out</span>
                <span className="font-bold text-slate-800">
                  {isCheckedOut
                    ? new Date(log!.check_out_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : "Active"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {!isCheckedIn ? (
          <button
            onClick={() => handlePunch("in")}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>Clock In Now</span>
          </button>
        ) : !isCheckedOut ? (
          <button
            onClick={() => handlePunch("out")}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            <span>Clock Out Now</span>
          </button>
        ) : (
          <div className="text-center py-2 text-xs text-slate-500 font-medium bg-slate-50 rounded-lg">
            Attendance recorded for today.
          </div>
        )}

        <div className="text-center pt-1">
          <Link
            href="/portal/attendance"
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-0.5"
          >
            <span>Missed punch? Request Regularization</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
