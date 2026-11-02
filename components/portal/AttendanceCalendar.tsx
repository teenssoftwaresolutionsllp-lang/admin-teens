
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
  | "late"
  | "work_from_home"
  | "holiday"
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
  holidays?: Array<{
    holiday_date: string;
    title?: string;
    is_working_day?: boolean;
  }>;
  year?: number;
  month?: number;
  employeeJoiningDate?: string | null;
  compact?: boolean;
  selectedDate?: string;
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

   function isWorkFromHome(log: AttendanceLog): boolean {
     const values = log as AttendanceLog & Record<string, unknown>;
     const mode = [
       values.work_mode,
       values.work_location,
       values.location_mode,
       values.attendance_mode,
       values.mode,
       log.status,
     ]
       .filter((value): value is string => typeof value === "string")
       .join(" ")
       .toLowerCase()
       .replaceAll("-", "_")
       .replaceAll(" ", "_");

     return ["work_from_home", "wfh", "remote", "home"].some((value) =>
       mode.includes(value)
     );
   }

   /* =========================================================
      COMPONENT
   ========================================================= */

export default function AttendanceCalendar({
  logs,
  leaveRequests,
  holidays = [],
  year: initialYear,
  month: initialMonth,
  employeeJoiningDate,
  compact = false,
  selectedDate: initialSelectedDate,
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
    if (
      initialSelectedDate?.startsWith(startingMonth) &&
      (!joiningDate || initialSelectedDate >= joiningDate)
    ) {
      return initialSelectedDate;
    }

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

  const { days, firstDay, totalCells } = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    return {
      days: Array.from(
        { length: totalDays },
        (_, index) => index + 1
      ),
      firstDay: firstDayOfMonth,
      totalDays,
      totalCells:
        Math.ceil((firstDayOfMonth + totalDays) / 7) * 7,
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

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, string>();

    holidays.forEach((holiday) => {
      const date = holiday.holiday_date.slice(0, 10);

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        holiday.is_working_day !== true
      ) {
        map.set(date, holiday.title || "Holiday");
      }
    });

    return map;
  }, [holidays]);

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

    // A configured non-working holiday keeps its holiday color, even if a
    // leave or attendance row also exists for that date.
    if (holidaysByDate.has(date)) {
      return "holiday";
    }

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

      if (isWorkFromHome(log)) {
        return "work_from_home";
      }

      if (status === "late" || log.is_late) {
        return "late";
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
      state === "holiday" ||
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
    const firstDate = `${newYear}-${String(newMonth + 1).padStart(
      2,
      "0"
    )}-01`;
    const nextSelectedDate =
      joiningDate && firstDate < joiningDate
        ? joiningDate
        : firstDate;
    setSelectedDate(nextSelectedDate);
    onSelectedDateChange?.(nextSelectedDate);
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
      "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-150";

    if (isBeforeJoiningDate) {
      return `${base} cursor-not-allowed text-slate-300 opacity-50`;
    }

    const selectedRing = isSelected
      ? " ring-2 ring-slate-900 ring-offset-1"
      : "";

    switch (state) {
      case "present":
        return `${base} bg-emerald-100 text-emerald-800 hover:bg-emerald-200${selectedRing}`;

      case "half_day":
      case "late":
        return `${base} bg-amber-100 text-amber-800 hover:bg-amber-200${selectedRing}`;

      case "leave":
      case "absent":
        return `${base} bg-rose-100 text-rose-800 hover:bg-rose-200${selectedRing}`;

      case "work_from_home":
        return `${base} bg-blue-100 text-blue-800 hover:bg-blue-200${selectedRing}`;

      case "holiday":
        return `${base} bg-[#94a3b8] text-white hover:bg-[#64748b]${selectedRing}`;

      default:
        return isSelected
          ? `${base} bg-blue-600 text-white shadow-sm ring-2 ring-blue-100`
          : `${base} text-slate-700 hover:bg-slate-100`;
    }
  };

  /* =======================================================
     UI
     ======================================================= */

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${
        compact ? "p-3" : "p-5"
      }`}
    >
      {/* HEADER */}
      <div className="mb-2 flex items-center justify-between gap-2">
        {!compact && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <CalendarDays size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Attendance Calendar
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Click a date to view attendance
              </p>
            </div>
          </div>
        )}

        <div
          className={`flex items-center gap-2 ${
            compact ? "w-full justify-between" : ""
          }`}
        >
          <button
            type="button"
            onClick={goToPreviousMonth}
            aria-label="Previous month"
            disabled={
              !!joiningMonth && selectedMonth <= joiningMonth
            }
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-center text-sm font-bold text-slate-900">
            {monthLabel}
          </span>

          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* WEEK DAYS */}
      <div className="mb-1 grid grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
          (day) => (
            <div
              key={day}
              className="py-1 text-center text-[10px] font-medium text-slate-500"
            >
              {day}
            </div>
          )
        )}
      </div>

      {/* CALENDAR */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: totalCells }, (_, index) => {
          const day = index - firstDay + 1;
          const isOutsideMonth = day < 1 || day > days.length;

          if (isOutsideMonth) {
            const outsideDay =
              day < 1
                ? new Date(year, month, 0).getDate() + day
                : day - days.length;

            return (
              <div
                key={`outside-${index}`}
                className="flex h-8 items-center justify-center text-xs text-slate-300"
                aria-hidden="true"
              >
                {outsideDay}
              </div>
            );
          }

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
              title={holidaysByDate.get(date)}
              aria-pressed={isSelected}
              className={getDayClass(
                state,
                isSelected,
                isBeforeJoiningDate
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* LEGEND */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
        <Legend color="bg-emerald-500" label="Present" />
        <Legend color="bg-rose-500" label="Absent" />
        <Legend color="bg-amber-400" label="Late" />
        <Legend color="bg-blue-500" label="Work From Home" />
        <Legend color="bg-[#94a3b8]" label="Holiday" />
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
