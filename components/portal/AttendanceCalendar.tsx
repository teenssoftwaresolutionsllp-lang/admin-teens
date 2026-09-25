"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { AttendanceLog, LeaveRequest } from "@/lib/types";

interface AttendanceCalendarProps {
  logs: AttendanceLog[];
  leaveRequests: LeaveRequest[];
  year?: number;
  month?: number;
}

type DayState = "present" | "late" | "leave" | "empty";

export default function AttendanceCalendar({ logs, leaveRequests, year: initialYear, month: initialMonth }: AttendanceCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(initialYear ?? today.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? today.getMonth());

  const { days, firstDay } = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    return {
      days: Array.from({ length: totalDays }, (_, index) => index + 1),
      firstDay: new Date(year, month, 1).getDay(),
    };
  }, [month, year]);

  const logByDate = new Map(logs.map((log) => [log.attendance_date.slice(0, 10), log]));
  const leaveDates = new Set<string>();

  leaveRequests
    .filter((request) => request.status === "approved")
    .forEach((request) => {
      const start = new Date(`${request.start_date}T00:00:00`);
      const end = new Date(`${request.end_date}T00:00:00`);
      for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        leaveDates.add(formatDate(date));
      }
    });

  const getDayState = (day: number): DayState => {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (leaveDates.has(date)) return "leave";
    const log = logByDate.get(date);
    if (!log) return "empty";
    if (log.status === "on_leave") return "leave";
    if (log.status === "present" && log.is_late) return "late";
    if (log.status === "half_day") return "late";
    if (log.status === "present") return "present";
    return "empty";
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const years = Array.from({ length: 21 }, (_, index) => today.getFullYear() - 10 + index);

  return (
    <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900">Attendance Calendar</h2>
            <p className="text-xs text-slate-500">{monthLabel} attendance overview</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
            aria-label="Select attendance month"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index} value={index}>
                {new Date(2000, index, 1).toLocaleDateString("en-US", { month: "long" })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
            aria-label="Select attendance year"
          >
            {years.map((optionYear) => (
              <option key={optionYear} value={optionYear}>{optionYear}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[10px] font-semibold text-slate-500 mb-4 px-1">
        <Legend color="bg-emerald-500" label="Present" />
        <Legend color="bg-amber-400" label="Late / Half Day" />
        <Legend color="bg-rose-500" label="Leave" />
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 py-1">
            {day}
          </div>
        ))}
        {Array.from({ length: firstDay }, (_, index) => <div key={`blank-${index}`} className="aspect-square" />)}
        {days.map((day) => {
          const state = getDayState(day);
          const today = new Date();
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          return (
            <div
              key={day}
              className={`aspect-square min-h-10 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-colors ${dayClass(state)} ${isToday ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}
              title={`${monthLabel} ${day}: ${state === "empty" ? "No punch recorded" : state}`}
            >
              <span className="text-xs font-bold">{day}</span>
              {state !== "empty" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${color}`} />{label}</span>;
}

function dayClass(state: DayState) {
  switch (state) {
    case "present":
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case "late":
      return "bg-amber-50 border-amber-200 text-amber-700";
    case "leave":
      return "bg-rose-50 border-rose-200 text-rose-700";
    default:
      return "bg-slate-50 border-slate-100 text-slate-500";
  }
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
