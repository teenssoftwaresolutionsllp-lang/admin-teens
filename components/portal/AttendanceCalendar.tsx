
"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  AttendanceLog,
  LeaveRequest,
} from "@/lib/types";

export type DayState =
  | "present"
  | "half_day"
  | "leave"
  | "absent"
  | "empty";

export interface SelectedAttendance {
  date: string;
  status: DayState;
  clockIn?: string;
  clockOut?: string;
  worked?: string;
}

interface AttendanceCalendarProps {
  logs: AttendanceLog[];
  leaveRequests: LeaveRequest[];
  year?: number;
  month?: number;
  employeeJoiningDate?: string | null;
  onMonthChange?: (year: number, month: number) => void;
  onDateSelect?: (attendance: SelectedAttendance) => void;
  onSelectedDateChange?: (date: string) => void;
}

/* =========================================================
   EXISTING DUMMY DATA
   ========================================================= */

// const dummyAttendance: Record<string, SelectedAttendance> = {
//   "2026-09-10": {
//     date: "2026-09-10",
//     status: "leave",
//   },
//   "2026-09-11": {
//     date: "2026-09-11",
//     status: "leave",
//   },
//   "2026-09-22": {
//     date: "2026-09-22",
//     status: "half_day",
//     clockIn: "09:20 AM",
//     clockOut: "01:15 PM",
//     worked: "3h 55m",
//   },
//   "2026-09-23": {
//     date: "2026-09-23",
//     status: "present",
//     clockIn: "09:18 AM",
//     clockOut: "06:12 PM",
//     worked: "8h 54m",
//   },
//   "2026-09-24": {
//     date: "2026-09-24",
//     status: "present",
//     clockIn: "09:42 AM",
//     clockOut: "06:05 PM",
//     worked: "8h 23m",
//   },
//   "2026-09-25": {
//     date: "2026-09-25",
//     status: "present",
//     clockIn: "02:35 PM",
//     worked: "1h 07m",
//   },
// };

/* =========================================================
   HELPERS
   ========================================================= */

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value?: string | null): string | undefined {
  if (!value) return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWorkedHours(
  totalHours?: number | null
): string | undefined {
  if (
    totalHours === undefined ||
    totalHours === null ||
    Number.isNaN(Number(totalHours))
  ) {
    return undefined;
  }

  const totalMinutes = Math.round(Number(totalHours) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function isPastWorkingDay(date: string): boolean {
  const selected = new Date(`${date}T00:00:00`);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return selected < today && !isWeekend(date);
}

function getJoiningDateOnly(
  joiningDate?: string | null
): string | null {
  if (!joiningDate) return null;

  const date = joiningDate.slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function AttendanceCalendar({
  logs,
  leaveRequests,
  year: initialYear,
  month: initialMonth,
  employeeJoiningDate,
  onDateSelect,
  onSelectedDateChange,
  onMonthChange,
}: AttendanceCalendarProps) {
  const today = new Date();

  const joiningDate = getJoiningDateOnly(employeeJoiningDate);
  const joiningMonth = joiningDate
    ? joiningDate.slice(0, 7)
    : undefined;

  const initialCalendarYear = initialYear ?? today.getFullYear();
  const initialCalendarMonth = initialMonth ?? today.getMonth();

  const initialMonthValue = `${initialCalendarYear}-${String(
    initialCalendarMonth + 1
  ).padStart(2, "0")}`;

  const startingMonth =
    joiningMonth && initialMonthValue < joiningMonth
      ? joiningMonth
      : initialMonthValue;

  const [year, setYear] = useState(() =>
    Number(startingMonth.slice(0, 4))
  );

  const [month, setMonth] = useState(
    () => Number(startingMonth.slice(5, 7)) - 1
  );

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const currentMonthValue = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}`;

    if (
      currentMonthValue === startingMonth &&
      (!joiningDate || formatDate(today) >= joiningDate)
    ) {
      return formatDate(today);
    }

    return "";
  });

  /* =======================================================
     CALENDAR DAYS
     ======================================================= */

  const { days, firstDay } = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    return {
      days: Array.from(
        { length: totalDays },
        (_, index) => index + 1
      ),
      firstDay: firstDayOfMonth,
    };
  }, [year, month]);

  /* =======================================================
     APPROVED LEAVE DATES
     ======================================================= */

  const leaveDates = useMemo(() => {
    const dates = new Set<string>();

    leaveRequests
      .filter(
        (request) => String(request.status).toLowerCase() === "approved"
      )
      .forEach((request) => {
        if (!request.start_date || !request.end_date) return;

        const startValue = request.start_date.slice(0, 10);
        const endValue = request.end_date.slice(0, 10);

        const start = new Date(`${startValue}T00:00:00`);
        const end = new Date(`${endValue}T00:00:00`);

        if (
          Number.isNaN(start.getTime()) ||
          Number.isNaN(end.getTime()) ||
          start > end
        ) {
          return;
        }

        const current = new Date(start);

        while (current <= end) {
          const date = formatDate(current);

          // Do not show leave before the employee joined.
          if (!joiningDate || date >= joiningDate) {
            dates.add(date);
          }

          current.setDate(current.getDate() + 1);
        }
      });

    return dates;
  }, [leaveRequests, joiningDate]);

  /* =======================================================
     ATTENDANCE LOGS BY DATE
     ======================================================= */

  const logByDate = useMemo(() => {
    const map = new Map<string, AttendanceLog>();

    logs.forEach((log) => {
      if (!log.attendance_date) return;

      const date = log.attendance_date.slice(0, 10);

      // Ignore any stored attendance before joining.
      if (joiningDate && date < joiningDate) return;

      map.set(date, log);
    });

    return map;
  }, [logs, joiningDate]);

  /* =======================================================
     GET DAY STATE
     ======================================================= */

  const getDayState = (day: number): DayState => {
    const date = `${year}-${String(month + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;

    // Dates before the employee joined never show attendance or demo data.
    if (joiningDate && date < joiningDate) {
      return "empty";
    }

    // Preserve the existing demo data.
    // if (dummyAttendance[date]) {
    //   return dummyAttendance[date].status;
    // }

    // Approved leave takes priority over missing attendance.
    if (leaveDates.has(date)) {
      return "leave";
    }

    const log = logByDate.get(date);

    if (log) {
      const status = String(log.status).toLowerCase();

      if (status === "on_leave" || status === "leave") {
        return "leave";
      }

      if (status === "half_day") {
        return "half_day";
      }

      if (status === "present") {
        return "present";
      }

      if (status === "absent" || status === "not_present") {
        return "absent";
      }
    }

    // Past working days without attendance are absent.
    // Today, future dates, and weekends are not automatically absent.
    if (isPastWorkingDay(date)) {
      return "absent";
    }

    return "empty";
  };

  /* =======================================================
     GET ATTENDANCE DETAILS
     ======================================================= */

  const getAttendanceDetails = (
    day: number
  ): SelectedAttendance => {
    const date = `${year}-${String(month + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;

    if (joiningDate && date < joiningDate) {
      return {
        date,
        status: "empty",
      };
    }

    // if (dummyAttendance[date]) {
    //   return dummyAttendance[date];
    // }

    const state = getDayState(day);

    if (
      state === "leave" ||
      state === "absent" ||
      state === "empty"
    ) {
      return {
        date,
        status: state,
      };
    }

    const log = logByDate.get(date);

    if (!log) {
      return {
        date,
        status: state,
      };
    }

    return {
      date,
      status: state,
      clockIn: formatTime(log.check_in_time),
      clockOut: formatTime(log.check_out_time),
      worked: formatWorkedHours(log.total_hours),
    };
  };

  /* =======================================================
     CHANGE MONTH
     ======================================================= */

  const changeMonth = (newYear: number, newMonth: number) => {
    const newMonthValue = `${newYear}-${String(
      newMonth + 1
    ).padStart(2, "0")}`;

    // Do not allow a month before the joining month.
    if (joiningMonth && newMonthValue < joiningMonth) {
      return;
    }

    setYear(newYear);
    setMonth(newMonth);
    setSelectedDate("");
    onSelectedDateChange?.("");
    onMonthChange?.(newYear, newMonth);
  };

  /* =======================================================
     DATE CLICK
     ======================================================= */

  const handleDateClick = (day: number) => {
    const date = `${year}-${String(month + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;

    // Ignore clicks on dates before joining.
    if (joiningDate && date < joiningDate) {
      return;
    }

    setSelectedDate(date);
    onSelectedDateChange?.(date);
    onDateSelect?.(getAttendanceDetails(day));
  };

  /* =======================================================
     PREVIOUS / NEXT MONTH
     ======================================================= */

  const goToPreviousMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    changeMonth(newDate.getFullYear(), newDate.getMonth());
  };

  const goToNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    changeMonth(newDate.getFullYear(), newDate.getMonth());
  };

  /* =======================================================
     MONTH LABEL
     ======================================================= */

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  );

  const selectedMonth = `${year}-${String(month + 1).padStart(
    2,
    "0"
  )}`;

  /* =======================================================
     DAY STYLE
     ======================================================= */

  const getDayClass = (
    state: DayState,
    isSelected: boolean,
    isBeforeJoiningDate: boolean
  ) => {
    const base =
      "h-11 sm:h-12 rounded-xl border flex items-center justify-center transition-all duration-150";

    const selected = isSelected
      ? " ring-2 ring-indigo-500 ring-offset-1"
      : "";

    if (isBeforeJoiningDate) {
      return `${base} bg-slate-50 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed`;
    }

    switch (state) {
      case "present":
        return `${base} bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200${selected}`;

      case "half_day":
        return `${base} bg-yellow-100 border-yellow-300 text-yellow-900 hover:bg-yellow-200${selected}`;

      case "leave":
        return `${base} bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200${selected}`;

      case "absent":
        return `${base} bg-red-500 border-red-600 text-white hover:bg-red-600${selected}`;

      default:
        return `${base} bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100${selected}`;
    }
  };

  /* =======================================================
     UI
     ======================================================= */

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <CalendarDays
              size={20}
              className="text-indigo-600"
            />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Attendance Calendar
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Click a date to view attendance
            </p>
          </div>
        </div>

        {/* MONTH AND YEAR SELECTOR */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            aria-label="Previous month"
            disabled={
              !!joiningMonth && selectedMonth <= joiningMonth
            }
            className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>

          <input
            type="month"
            aria-label="Select attendance month and year"
            value={selectedMonth}
            min={joiningMonth}
            onChange={(event) => {
              if (!event.target.value) return;

              const [newYear, newMonth] = event.target.value
                .split("-")
                .map(Number);

              changeMonth(newYear, newMonth - 1);
            }}
            className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="Next month"
            className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* CURRENT MONTH LABEL */}
      <p className="text-sm font-semibold text-slate-700 mb-4">
        {monthLabel}
      </p>

      {/* WEEK DAYS */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
          (day) => (
            <div
              key={day}
              className="text-center text-xs font-bold text-slate-500 py-2"
            >
              {day}
            </div>
          )
        )}
      </div>

      {/* CALENDAR */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: firstDay }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="h-11 sm:h-12"
          />
        ))}

        {days.map((day) => {
          const date = `${year}-${String(month + 1).padStart(
            2,
            "0"
          )}-${String(day).padStart(2, "0")}`;

          const state = getDayState(day);
          const isSelected = selectedDate === date;

          const isBeforeJoiningDate =
            !!joiningDate && date < joiningDate;

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDateClick(day)}
              disabled={isBeforeJoiningDate}
              aria-label={`${date}: ${
                isBeforeJoiningDate
                  ? "before joining date"
                  : state.replace("_", " ")
              }`}
              aria-pressed={isSelected}
              className={getDayClass(
                state,
                isSelected,
                isBeforeJoiningDate
              )}
            >
              <span className="text-sm font-extrabold">
                {day}
              </span>
            </button>
          );
        })}
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-slate-100">
        <Legend color="bg-emerald-400" label="Present" />
        <Legend color="bg-yellow-400" label="Half Day" />
        <Legend color="bg-rose-400" label="Leave" />
        <Legend color="bg-red-500" label="Absent" />
      </div>
    </section>
  );
}

/* =========================================================
   LEGEND
   ========================================================= */

function Legend({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}
