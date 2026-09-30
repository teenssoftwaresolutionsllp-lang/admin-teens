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
  | "empty";

export interface SelectedAttendance {
  date: string;
  status: DayState;
  clockIn?: string;
  clockOut?: string;
  worked?: string;
}

/*
 * IMPORTANT
 * Parent can receive both:
 * 1. selected attendance details
 * 2. selected date
 */
interface AttendanceCalendarProps {
  logs: AttendanceLog[];
  leaveRequests: LeaveRequest[];
  year?: number;
  month?: number;

  onDateSelect?: (
    attendance: SelectedAttendance
  ) => void;

  onSelectedDateChange?: (
    date: string
  ) => void;
}

/* =========================================================
   DUMMY DATA
========================================================= */

const dummyAttendance: Record<
  string,
  SelectedAttendance
> = {
  "2026-09-10": {
    date: "2026-09-10",
    status: "leave",
  },

  "2026-09-11": {
    date: "2026-09-11",
    status: "leave",
  },

  "2026-09-22": {
    date: "2026-09-22",
    status: "half_day",
    clockIn: "09:20 AM",
    clockOut: "01:15 PM",
    worked: "3h 55m",
  },

  "2026-09-23": {
    date: "2026-09-23",
    status: "present",
    clockIn: "09:18 AM",
    clockOut: "06:12 PM",
    worked: "8h 54m",
  },

  "2026-09-24": {
    date: "2026-09-24",
    status: "present",
    clockIn: "09:42 AM",
    clockOut: "06:05 PM",
    worked: "8h 23m",
  },

  "2026-09-25": {
    date: "2026-09-25",
    status: "present",
    clockIn: "02:35 PM",
    worked: "1h 07m",
  },
};

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatTime(
  value?: string | null
): string | undefined {
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

  const totalMinutes = Math.round(
    Number(totalHours) * 60
  );

  const hours = Math.floor(
    totalMinutes / 60
  );

  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(
    2,
    "0"
  )}m`;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AttendanceCalendar({
  logs,
  leaveRequests,
  year: initialYear,
  month: initialMonth,
  onDateSelect,
  onSelectedDateChange,
}: AttendanceCalendarProps) {
  const today = new Date();

  const [year, setYear] = useState(
    initialYear ?? today.getFullYear()
  );

  const [month, setMonth] = useState(
    initialMonth ?? today.getMonth()
  );

  /*
   * Store actual date string.
   *
   * Earlier you were storing only:
   * selectedDate = 25
   *
   * Now we store:
   * selectedDate = "2026-09-25"
   *
   * This is important because ClockInWidget
   * needs to know whether selected date is today.
   */
  const [selectedDate, setSelectedDate] =
    useState<string>(() => {
      const currentYear =
        initialYear ?? today.getFullYear();

      const currentMonth =
        initialMonth ?? today.getMonth();

      if (
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonth
      ) {
        return formatDate(today);
      }

      return "";
    });

  /* =======================================================
     CALENDAR DAYS
  ======================================================= */

  const { days, firstDay } = useMemo(() => {
    const totalDays = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const firstDayOfMonth = new Date(
      year,
      month,
      1
    ).getDay();

    return {
      days: Array.from(
        { length: totalDays },
        (_, index) => index + 1
      ),
      firstDay: firstDayOfMonth,
    };
  }, [year, month]);

  /* =======================================================
     LEAVE DATES
  ======================================================= */

  const leaveDates = useMemo(() => {
    const dates = new Set<string>();

    leaveRequests
      .filter(
        (request) =>
          String(request.status) ===
          "approved"
      )
      .forEach((request) => {
        const start = new Date(
          `${request.start_date}T00:00:00`
        );

        const end = new Date(
          `${request.end_date}T00:00:00`
        );

        const current = new Date(start);

        while (current <= end) {
          dates.add(formatDate(current));

          current.setDate(
            current.getDate() + 1
          );
        }
      });

    return dates;
  }, [leaveRequests]);

  /* =======================================================
     REAL ATTENDANCE LOGS
  ======================================================= */

  const logByDate = useMemo(() => {
    const map = new Map<
      string,
      AttendanceLog
    >();

    logs.forEach((log) => {
      if (log.attendance_date) {
        map.set(
          log.attendance_date.slice(0, 10),
          log
        );
      }
    });

    return map;
  }, [logs]);

  /* =======================================================
     GET DAY STATE
  ======================================================= */

  const getDayState = (
    day: number
  ): DayState => {
    const date = `${year}-${String(
      month + 1
    ).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    /*
     * Dummy data first.
     */
    if (dummyAttendance[date]) {
      return dummyAttendance[date].status;
    }

    if (leaveDates.has(date)) {
      return "leave";
    }

    const log = logByDate.get(date);

    if (!log) {
      return "empty";
    }

    const status = String(log.status);

    if (status === "on_leave") {
      return "leave";
    }

    if (status === "half_day") {
      return "half_day";
    }

    if (status === "present") {
      return "present";
    }

    return "empty";
  };

  /* =======================================================
     GET ATTENDANCE DETAILS
  ======================================================= */

  const getAttendanceDetails = (
    day: number
  ): SelectedAttendance => {
    const date = `${year}-${String(
      month + 1
    ).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    /*
     * Dummy data.
     */
    if (dummyAttendance[date]) {
      return dummyAttendance[date];
    }

    /*
     * Leave.
     */
    if (leaveDates.has(date)) {
      return {
        date,
        status: "leave",
      };
    }

    /*
     * Real attendance.
     */
    const log = logByDate.get(date);

    if (!log) {
      return {
        date,
        status: "empty",
      };
    }

    const extendedLog =
      log as AttendanceLog & {
        check_in_time?: string | null;
        check_out_time?: string | null;
        total_hours?: number | null;
      };

    const status = String(log.status);

    let dayStatus: DayState = "empty";

    if (status === "on_leave") {
      dayStatus = "leave";
    } else if (status === "half_day") {
      dayStatus = "half_day";
    } else if (status === "present") {
      dayStatus = "present";
    }

    return {
      date,
      status: dayStatus,

      clockIn: formatTime(
        extendedLog.check_in_time
      ),

      clockOut: formatTime(
        extendedLog.check_out_time
      ),

      worked: formatWorkedHours(
        extendedLog.total_hours
      ),
    };
  };

  /* =======================================================
     DATE CLICK
  ======================================================= */

  const handleDateClick = (
    day: number
  ) => {
    /*
     * Create complete date.
     */
    const date = `${year}-${String(
      month + 1
    ).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    /*
     * Save selected date.
     */
    setSelectedDate(date);

    /*
     * Send selected date to parent.
     */
    onSelectedDateChange?.(date);

    /*
     * Get attendance information.
     */
    const attendance =
      getAttendanceDetails(day);

    /*
     * Send attendance to parent.
     */
    onDateSelect?.(attendance);
  };

  /* =======================================================
     PREVIOUS MONTH
  ======================================================= */

  const goToPreviousMonth = () => {
    setSelectedDate("");

    if (month === 0) {
      const newYear = year - 1;
      const newMonth = 11;

      setYear(newYear);
      setMonth(newMonth);

      onSelectedDateChange?.("");
    } else {
      const newMonth = month - 1;

      setMonth(newMonth);

      onSelectedDateChange?.("");
    }
  };

  /* =======================================================
     NEXT MONTH
  ======================================================= */

  const goToNextMonth = () => {
    setSelectedDate("");

    if (month === 11) {
      const newYear = year + 1;
      const newMonth = 0;

      setYear(newYear);
      setMonth(newMonth);

      onSelectedDateChange?.("");
    } else {
      const newMonth = month + 1;

      setMonth(newMonth);

      onSelectedDateChange?.("");
    }
  };

  /* =======================================================
     MONTH LABEL
  ======================================================= */

  const monthLabel = new Date(
    year,
    month,
    1
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  /* =======================================================
     DAY STYLE
  ======================================================= */

  const getDayClass = (
    state: DayState,
    isSelected: boolean
  ) => {
    const base =
      "h-11 sm:h-12 rounded-xl border flex items-center justify-center transition-all duration-150";

    const selected = isSelected
      ? " ring-2 ring-indigo-500 ring-offset-1"
      : "";

    switch (state) {
      case "present":
        return `${base} bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200${selected}`;

      case "half_day":
        return `${base} bg-yellow-100 border-yellow-300 text-yellow-900 hover:bg-yellow-200${selected}`;

      case "leave":
        return `${base} bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200${selected}`;

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

      <div className="flex items-center justify-between mb-5">
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

        {/* MONTH NAVIGATION */}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="min-w-[145px] text-center text-sm font-bold text-slate-800">
            {monthLabel}
          </div>

          <button
            type="button"
            onClick={goToNextMonth}
            className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* WEEK DAYS */}

      <div className="grid grid-cols-7 gap-2 mb-2">
        {[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-bold text-slate-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* CALENDAR */}

      <div className="grid grid-cols-7 gap-2">
        {/* EMPTY DAYS */}

        {Array.from({
          length: firstDay,
        }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="h-11 sm:h-12"
          />
        ))}

        {/* DATES */}

        {days.map((day) => {
          const state =
            getDayState(day);

          const date = `${year}-${String(
            month + 1
          ).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;

          const isSelected =
            selectedDate === date;

          return (
            <button
              key={day}
              type="button"
              onClick={() =>
                handleDateClick(day)
              }
              className={getDayClass(
                state,
                isSelected
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
        <Legend
          color="bg-emerald-400"
          label="Present"
        />

        <Legend
          color="bg-yellow-400"
          label="Half Day"
        />

        <Legend
          color="bg-rose-400"
          label="Leave"
        />
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
      <span
        className={`h-3 w-3 rounded-full ${color}`}
      />

      <span>{label}</span>
    </div>
  );
}