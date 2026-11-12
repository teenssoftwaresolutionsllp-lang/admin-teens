"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AttendanceLog,
  AttendanceRegularization,
  Employee,
  LeaveRequest,
  LeaveType,
  Project,
} from "@/lib/types";

import {
  Clock,
  CheckCircle2,
  XCircle,
  Home,
  FileCheck,
  Loader2,
  Calendar,
  CalendarOff,
  X,
  AlertCircle,
  MoreHorizontal,
  House,
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
  leaveRequests?: LeaveRequest[];
  leaveTypes?: LeaveType[];
  
}

/* ============================================================
   HELPERS
============================================================ */

function getTodayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateDaysBetween(
  startDate: string,
  endDate: string
) {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return 0;
  }

  const difference = end.getTime() - start.getTime();

  return (
    Math.floor(
      difference / (1000 * 60 * 60 * 24)
    ) + 1
  );
}

function getClockIn(
  log: AttendanceLog | null | undefined
) {
  if (!log) return null;

  return (
    (log as any).clock_in ??
    (log as any).clockIn ??
    (log as any).check_in_time ??
    (log as any).check_in ??
    (log as any).checkIn ??
    null
  );
}


function getClockOut(
  log: AttendanceLog | null | undefined
) {
  if (!log) return null;

  return (
    (log as any).clock_out ??
    (log as any).clockOut ??
    (log as any).check_out_time ??
    (log as any).check_out ??
    (log as any).checkOut ??
    null
  );
}

function getLogDate(
  log: AttendanceLog | null | undefined
) {
  if (!log) return "";

  const value =
    (log as any).attendance_date ??
    (log as any).attendanceDate ??
    (log as any).date ??
    "";

  if (!value) return "";

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(
    parsed.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    parsed.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* ============================================================
   UPDATED TIME FORMATTER

   IMPORTANT:
   Supports:
   09:30
   09:30:00
   09:30 AM
   2026-10-08T09:30:00
============================================================ */

function formatAttendanceTime(
  value?: string | null
) {
  if (!value) return "--";

  const stringValue = String(value).trim();

  if (!stringValue) return "--";

  /* HH:mm */
  const shortTimeMatch =
    stringValue.match(
      /^(\d{1,2}):(\d{2})$/
    );

  if (shortTimeMatch) {
    let hours = Number(
      shortTimeMatch[1]
    );

    const minutes = Number(
      shortTimeMatch[2]
    );

    if (
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59
    ) {
      const period =
        hours >= 12 ? "PM" : "AM";

      const displayHour =
        hours % 12 || 12;

      return `${String(
        displayHour
      ).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")} ${period}`;
    }
  }

  /* HH:mm:ss */
  const longTimeMatch =
    stringValue.match(
      /^(\d{1,2}):(\d{2}):(\d{2})$/
    );

  if (longTimeMatch) {
    let hours = Number(
      longTimeMatch[1]
    );

    const minutes = Number(
      longTimeMatch[2]
    );

    const seconds = Number(
      longTimeMatch[3]
    );

    if (
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59 &&
      seconds >= 0 &&
      seconds <= 59
    ) {
      const period =
        hours >= 12 ? "PM" : "AM";

      const displayHour =
        hours % 12 || 12;

      return `${String(
        displayHour
      ).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")} ${period}`;
    }
  }

  /* Already formatted AM/PM */
  if (
    /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(
      stringValue
    )
  ) {
    return stringValue;
  }

  /* ISO / timestamp */
  const date = new Date(
    stringValue
  );

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  );
}

function getTimeInputValue(
  value?: string | null
) {
  if (!value) return "";

  const stringValue = String(value).trim();

  if (
    /^\d{2}:\d{2}$/.test(
      stringValue
    )
  ) {
    return stringValue;
  }

  if (
    /^\d{2}:\d{2}:\d{2}$/.test(
      stringValue
    )
  ) {
    return stringValue.slice(0, 5);
  }

  const amPmMatch =
    stringValue.match(
      /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i
    );

  if (amPmMatch) {
    let hours = Number(
      amPmMatch[1]
    );

    const minutes = Number(
      amPmMatch[2]
    );

    const period =
      amPmMatch[3].toUpperCase();

    if (period === "PM" && hours < 12) {
      hours += 12;
    }

    if (period === "AM" && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  }

  const date = new Date(
    stringValue
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${String(
    date.getHours()
  ).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function formatDateForDisplay(
  value: string
) {
  if (!value) return "--";

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function calculateWorkingHours(
  clockIn?: string | null,
  clockOut?: string | null
) {
  if (!clockIn || !clockOut) {
    return "--";
  }

  /*
   * Handle HH:mm / HH:mm:ss values
   * used by regularization.
   */
  const parseTime = (
    value: string
  ) => {
    const match = String(value)
      .trim()
      .match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
      );

    if (match) {
      return (
        Number(match[1]) * 60 +
        Number(match[2])
      );
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return (
      date.getHours() * 60 +
      date.getMinutes()
    );
  };

  const startMinutes =
    parseTime(clockIn);

  const endMinutes =
    parseTime(clockOut);

  if (
    startMinutes === null ||
    endMinutes === null
  ) {
    return "--";
  }

  let difference =
    endMinutes - startMinutes;

  /*
   * Support overnight shifts.
   */
  if (difference < 0) {
    difference += 24 * 60;
  }

  if (difference <= 0) {
    return "--";
  }

  const hours = Math.floor(
    difference / 60
  );

  const minutes =
    difference % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatTotalHours(totalHours: number | null) {
  if (totalHours === null || !Number.isFinite(totalHours)) {
    return "--";
  }

  const totalMinutes = Math.round(totalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function getAttendanceMode(log: AttendanceLog): string {
  if (isWorkFromHome(log)) {
    return "Work From Home";
  }

  const values = log as AttendanceLog & Record<string, unknown>;
  const mode = [
    values.work_mode,
    values.work_location,
    values.location_mode,
    values.attendance_mode,
    values.mode,
  ].find((value) => typeof value === "string" && value.trim());

  if (typeof mode === "string") {
    return mode.trim().replaceAll("_", " ");
  }

  return normalizeAttendanceStatus(log.status) === "work_from_home"
    ? "Work From Home"
    : "—";
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

/* ============================================================
   LEAVE TYPE HELPERS
============================================================ */

function getLeaveTypeCode(
  value: any
) {
  return String(
    value?.leaveType?.code ??
      value?.leave_type?.code ??
      value?.leaveTypeCode ??
      value?.leave_type_code ??
      value?.code ??
      value?.leaveType?.leave_code ??
      value?.leave_type?.leave_code ??
      value?.leaveType?.name ??
      value?.leave_type?.name ??
      value?.name ??
      ""
  )
    .trim()
    .toUpperCase();
}

/* ============================================================
   ATTENDANCE STATUS
============================================================ */

function normalizeAttendanceStatus(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/* ============================================================
   LEAVE REQUEST HELPERS
============================================================ */

function getLeaveRequestStatus(
  request: any
) {
  return String(
    request?.status ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/* ============================================================
   LEAVE TYPE HELPERS
============================================================ */

function getLeaveTypeId(
  request: any
) {
  return String(
    request?.leave_type_id ??
      request?.leaveTypeId ??
      request?.leave_type?.id ??
      request?.leaveType?.id ??
      ""
  ).trim();
}

function getLeaveTypeName(
  value: any
) {
  return String(
    value?.leaveType?.name ??
      value?.leave_type?.name ??
      value?.name ??
      ""
  ).trim();
}

/* ============================================================
   COMPONENT
============================================================ */

export default function EmployeeAttendanceView({
  employee,
  project,
  todayLog,
  historyLogs,
  regularizations,
  leaveRequests: initialLeaveRequests = [],
  leaveTypes: initialLeaveTypes = [],
}: EmployeeAttendanceViewProps) {
  const [logs, setLogs] =
    useState<AttendanceLog[]>(
      historyLogs ?? []
    );

  const [selectedCalendarYear, setSelectedCalendarYear] =
    useState(() => new Date().getFullYear());

  const [selectedCalendarMonth, setSelectedCalendarMonth] =
    useState(() => new Date().getMonth());

  const [showAllAttendanceLogs, setShowAllAttendanceLogs] =
    useState(false);

  const [
    currentTodayLog,
    setCurrentTodayLog,
  ] = useState<AttendanceLog | null>(
    todayLog
  );

  const [regs, setRegs] =
    useState<AttendanceRegularization[]>(
      regularizations ?? []
    );

  const [
    selectedAttendance,
    setSelectedAttendance,
  ] = useState<SelectedAttendance | null>(
    null
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState<string>(
    getTodayString()
  );

  const [
    leaveRequests,
    setLeaveRequests,
  ] = useState<LeaveRequest[]>(
    initialLeaveRequests ?? []
  );

  const [leaveTypes, setLeaveTypes] =
    useState<LeaveType[]>(
      initialLeaveTypes ?? []
    );

  const [loadingLeaves, setLoadingLeaves] =
    useState(false);

  const [showLeaveModal, setShowLeaveModal] =
    useState(false);

  const [
    submittingLeave,
    setSubmittingLeave,
  ] = useState(false);

  const [leaveError, setLeaveError] =
    useState<string | null>(null);

  const [
    leaveSuccess,
    setLeaveSuccess,
  ] = useState<string | null>(null);

  const [leaveForm, setLeaveForm] =
    useState({
      leaveTypeId: "",
      startDate: "",
      endDate: "",
      totalDays: 1,
      isHalfDay: false,
      leaveDuration: "" as "" | "first_half" | "second_half",
      reason: "",
    });


  /* ============================================================
    WFH REQUEST STATE
  ============================================================ */

  const [wfhRequests, setWfhRequests] = useState<any[]>([]);
  const [loadingWfh, setLoadingWfh] = useState(false);
  const [showWfhModal, setShowWfhModal] = useState(false);
  const [submittingWfh, setSubmittingWfh] = useState(false);
  const [wfhError, setWfhError] = useState<string | null>(null);
  const [wfhSuccess, setWfhSuccess] = useState<string | null>(null);

  const [wfhForm, setWfhForm] = useState({requestDate: "",reason: "",});

  /* ============================================================
     REGULARIZATION STATE
  ============================================================ */

  const [
    showRegularizationRequests,
    setShowRegularizationRequests,
  ] = useState(false);

  const [
    isRegularizationModalOpen,
    setIsRegularizationModalOpen,
  ] = useState(false);

  const [
    submittingRegularization,
    setSubmittingRegularization,
  ] = useState(false);

  const [
    regularizationSuccess,
    setRegularizationSuccess,
  ] = useState<string | null>(null);

  const [
    regularizationError,
    setRegularizationError,
  ] = useState<string | null>(null);

  const [
    regularizationForm,
    setRegularizationForm,
  ] = useState({
    attendanceDate: "",
    proposedCheckIn: "",
    proposedCheckOut: "",
    reason: "",
  });

  const todayString =
    getTodayString();

  /* ============================================================
     LOAD LEAVE DATA
  ============================================================ */

  const refreshLeaveData = useCallback(async () => {
      try {
        setLoadingLeaves(true);

        const response = await fetch(
          `/api/leaves?employeeId=${encodeURIComponent(
            String(employee.id)
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          await response
            .json()
            .catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Failed to load leave information."
          );
        }

        const requests =
          Array.isArray(
            data?.leaveRequests
          )
            ? data.leaveRequests
            : Array.isArray(
                data?.requests
              )
            ? data.requests
            : [];

        const types =
          Array.isArray(
            data?.leaveTypes
          )
            ? data.leaveTypes
            : Array.isArray(
                data?.types
              )
            ? data.types
            : [];

        setLeaveRequests(
          requests
        );
        setLeaveTypes(types);

      } catch (error) {
        console.error(
          "Failed to load leaves:",
          error
        );
      } finally {
        setLoadingLeaves(false);
      }
    }, [employee.id]);

  useEffect(() => {refreshLeaveData();

    const interval =
      setInterval(() => {
        refreshLeaveData();
      }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [refreshLeaveData]);


  /* ============================================================
    LOAD WFH REQUESTS
  ============================================================ */

  const refreshWfhRequests = useCallback(async () => {
    try {
      setLoadingWfh(true);

      const response = await fetch("/api/wfh", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to load WFH requests."
        );
      }

      const requests =
        data?.requests ??
        data?.wfhRequests ??
        data?.data ??
        [];

      setWfhRequests(Array.isArray(requests) ? requests : []);
    } catch (error) {
      console.error("WFH loading error:", error);
    } finally {
      setLoadingWfh(false);
    }
  }, []);

  useEffect(() => {
    refreshWfhRequests();

    const interval = setInterval(refreshWfhRequests, 30000);

    return () => clearInterval(interval);
  }, [refreshWfhRequests]);

  /* ============================================================
     CURRENT ATTENDANCE
  ============================================================ */

  const currentAttendanceLog =
    useMemo(() => {
      if (selectedAttendance?.date) {
        const selected =
          logs.find(
            (log) =>
              getLogDate(log) ===
              selectedAttendance.date
          );

        if (selected) {
          return selected;
        }

        if (
          currentTodayLog &&
          getLogDate(
            currentTodayLog
          ) ===
            selectedAttendance.date
        ) {
          return currentTodayLog;
        }
      }

      return currentTodayLog;
    }, [
      selectedAttendance,
      logs,
      currentTodayLog,
    ]);

  /* ============================================================
     SUMMARY
  ============================================================ */


 const presentCount = useMemo(() => {
  const approvedLeaveDates = new Set<string>();

  for (const request of leaveRequests as any[]) {
    if (getLeaveRequestStatus(request) !== "approved") {
      continue;
    }

    const start = String(
      request.start_date ?? request.startDate ?? ""
    ).slice(0, 10);

    const end = String(
      request.end_date ?? request.endDate ?? start
    ).slice(0, 10);

    if (!start || !end || start > end) continue;

    const cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);

    while (cursor <= last) {
      approvedLeaveDates.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return logs.reduce((total, log) => {
    const rawLog = log as any;

    const attendanceDate = String(
      rawLog.attendance_date ??
      rawLog.attendanceDate ??
      rawLog.date ??
      ""
    ).slice(0, 10);

    if (!attendanceDate) return total;

    const [year, month] = attendanceDate.split("-").map(Number);

    if (
      year !== selectedCalendarYear ||
      month !== selectedCalendarMonth + 1
    ) {
      return total;
    }

    // Approved leave should not count as present.
    if (approvedLeaveDates.has(attendanceDate)) {
      return total;
    }

    const status = normalizeAttendanceStatus(rawLog.status);

    // Count office Present, Late, and WFH in Present.
    if (
      status === "present" ||
      status === "late" ||
      status === "work_from_home" ||
      isWorkFromHome(log) ||
      rawLog.is_late
    ) {
      return total + 1;
    }

    if (status === "half_day") {
      return total + 0.5;
    }

    return total;
  }, 0);
}, [
  logs,
  leaveRequests,
  selectedCalendarYear,
  selectedCalendarMonth,
]);
  const absentCount = useMemo(() => {
    const today = getTodayString();

    const startDate = `${selectedCalendarYear}-${String(
      selectedCalendarMonth + 1
    ).padStart(2, "0")}-01`;

    const monthEnd = new Date(
      selectedCalendarYear,
      selectedCalendarMonth + 1,
      0
    );

    const lastDate = `${selectedCalendarYear}-${String(
      selectedCalendarMonth + 1
    ).padStart(2, "0")}-${String(
      monthEnd.getDate()
    ).padStart(2, "0")}`;

    // Do not count future dates in the selected month.
    const endDate = lastDate < today ? lastDate : today;

    // Do not count dates before the employee joined.
    const effectiveStartDate =
      employee.joining_date &&
      employee.joining_date.slice(0, 10) > startDate
        ? employee.joining_date.slice(0, 10)
        : startDate;

    if (effectiveStartDate > endDate) return 0;

    const logsByDate = new Map<string, AttendanceLog[]>();

    for (const log of logs) {
      const date = getLogDate(log);
      if (!date) continue;

      const existing = logsByDate.get(date) || [];
      existing.push(log);
      logsByDate.set(date, existing);
    }

    const holidays = (
      project.calendar?.holidays || []
    ) as Array<{
      holiday_date: string;
      is_optional?: boolean;
      is_working_day?: boolean;
    }>;

    const holidaysByDate = new Map<string, typeof holidays>();

    for (const holiday of holidays) {
      const date = String(holiday.holiday_date || "").slice(0, 10);

      if (!date) continue;

      const existing = holidaysByDate.get(date) || [];
      existing.push(holiday);
      holidaysByDate.set(date, existing);
    }

    const approvedLeaveDates = new Set<string>();

    for (const request of leaveRequests as any[]) {
      if (getLeaveRequestStatus(request) !== "approved") {
        continue;
      }

      const start = String(
        request.start_date ?? request.startDate ?? ""
      ).slice(0, 10);

      const end = String(
        request.end_date ?? request.endDate ?? start
      ).slice(0, 10);

      if (!start || !end || start > end) continue;

      const leaveCursor = new Date(`${start}T00:00:00Z`);
      const leaveLast = new Date(`${end}T00:00:00Z`);

      while (leaveCursor <= leaveLast) {
        approvedLeaveDates.add(
          leaveCursor.toISOString().slice(0, 10)
        );

        leaveCursor.setUTCDate(leaveCursor.getUTCDate() + 1);
      }
    }

    let count = 0;

    const cursor = new Date(`${effectiveStartDate}T00:00:00Z`);
    const last = new Date(`${endDate}T00:00:00Z`);

    while (cursor <= last) {
      const date = cursor.toISOString().slice(0, 10);
      const dayOfWeek = cursor.getUTCDay();
      const dateLogs = logsByDate.get(date) || [];
      const dateHolidays = holidaysByDate.get(date) || [];

      const isWorkingSaturday =
        dayOfWeek === 6 &&
        dateHolidays.some(
          (holiday) => holiday.is_working_day === true
        );

      // Sundays and ordinary Saturdays are weekly offs.
      if (
        dayOfWeek === 0 ||
        (dayOfWeek === 6 && !isWorkingSaturday)
      ) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Exclude non-optional holidays unless marked as working.
      const isHoliday = dateHolidays.some(
        (holiday) =>
          holiday.is_working_day !== true &&
          holiday.is_optional !== true
      );

      if (isHoliday) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Approved leave dates are not counted as absent.
      if (approvedLeaveDates.has(date)) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      if (dateLogs.length > 0) {
        const hasExplicitAbsence = dateLogs.some((log) => {
          const status = normalizeAttendanceStatus(
            (log as any).status
          );

          return (
            status === "absent" ||
            status === "not_present"
          );
        });

        if (hasExplicitAbsence) count++;
      } else {
        // No attendance record on an eligible working day.
        count++;
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return count;
  }, [
    logs,
    employee.joining_date,
    project,
    leaveRequests,
    selectedCalendarYear,
    selectedCalendarMonth,
  ]);


const selectedMonthLogs = useMemo(() => {
  const monthStart = new Date(
    selectedCalendarYear,
    selectedCalendarMonth,
    1
  );

  const monthEnd = new Date(
    selectedCalendarYear,
    selectedCalendarMonth + 1,
    0
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const joiningDate = employee.joining_date
    ? employee.joining_date.slice(0, 10)
    : null;

  const approvedLeaveDates = new Set<string>();

  leaveRequests
    .filter(
      (request) =>
        String(request.status).toLowerCase() === "approved"
    )
    .forEach((request) => {
      if (!request.start_date || !request.end_date) return;

      const start = new Date(
        `${request.start_date.slice(0, 10)}T00:00:00`
      );

      const end = new Date(
        `${request.end_date.slice(0, 10)}T00:00:00`
      );

      for (
        let current = new Date(start);
        current <= end;
        current.setDate(current.getDate() + 1)
      ) {
        const date = [
          current.getFullYear(),
          String(current.getMonth() + 1).padStart(2, "0"),
          String(current.getDate()).padStart(2, "0"),
        ].join("-");

        if (
          current.getDay() !== 0 &&
          current.getDay() !== 6 &&
          (!joiningDate || date >= joiningDate)
        ) {
          approvedLeaveDates.add(date);
        }
      }
    });

  const attendanceMap = new Map<string, AttendanceLog>();

  logs.forEach((log) => {
    const date = getLogDate(log);
    if (date) {
      attendanceMap.set(date, log);
    }
  });

  const holidays = new Set(
  (project.calendar?.holidays || [])
    .filter(
      (holiday) =>
        (holiday as any).is_working_day !== true
    )
    .map((holiday) => holiday.holiday_date.slice(0, 10))
);

  const generatedLogs: AttendanceLog[] = [];

  for (
    let current = new Date(monthStart);
    current <= monthEnd;
    current.setDate(current.getDate() + 1)
  ) {
    const date = [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, "0"),
      String(current.getDate()).padStart(2, "0"),
    ].join("-");

    if (joiningDate && date < joiningDate) continue;
    if (current > today) continue;

    // Exclude weekends.
    if (current.getDay() === 0 || current.getDay() === 6) {
      continue;
    }

    const existingLog = attendanceMap.get(date);

    if (existingLog) {
      generatedLogs.push(existingLog);
      continue;
    }

    let status = "absent";

    if (holidays.has(date)) {
      status = "holiday";
    } else if (approvedLeaveDates.has(date)) {
      status = "on_leave";
    }

    generatedLogs.push({
      employee_id: employee.id,
      attendance_date: date,
      status,
    } as AttendanceLog);
  }

  return generatedLogs.sort((a, b) =>
    getLogDate(b).localeCompare(getLogDate(a))
  );
}, [
  logs,
  selectedCalendarYear,
  selectedCalendarMonth,
  employee.id,
  employee.joining_date,
  leaveRequests,
  project.calendar?.holidays,
]);

// const lateCount = selectedMonthLogs.filter(
//   (log) =>
//     Boolean(log.is_late) ||
//     normalizeAttendanceStatus(log.status) === "late"
// ).length;

const workFromHomeCount = selectedMonthLogs.filter(isWorkFromHome).length;

const totalWorkingDays = useMemo(() => {
  const holidays = (project.calendar?.holidays || []) as Array<{
    holiday_date?: string;
    is_optional?: boolean;
    is_working_day?: boolean;
  }>;
  const joiningDate = employee.joining_date?.slice(0, 10);
  const firstDay =
    joiningDate?.startsWith(
      `${selectedCalendarYear}-${String(
        selectedCalendarMonth + 1
      ).padStart(2, "0")}`
    )
      ? Number(joiningDate.slice(8, 10))
      : 1;
  const daysInMonth = new Date(
    selectedCalendarYear,
    selectedCalendarMonth + 1,
    0
  ).getDate();

  let count = 0;

  for (let day = firstDay; day <= daysInMonth; day++) {
    const date = `${selectedCalendarYear}-${String(
      selectedCalendarMonth + 1
    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(
      selectedCalendarYear,
      selectedCalendarMonth,
      day
    ).getDay();
    const dateHolidays = holidays.filter(
      (holiday) => holiday.holiday_date?.slice(0, 10) === date
    );
    const isWorkingSaturday =
      weekday === 6 &&
      dateHolidays.some((holiday) => holiday.is_working_day === true);

    if (
      weekday === 0 ||
      (weekday === 6 && !isWorkingSaturday) ||
      dateHolidays.some(
        (holiday) =>
          holiday.is_working_day !== true &&
          holiday.is_optional !== true
      )
    ) {
      continue;
    }

    count++;
  }

  return count;
}, [
  employee.joining_date,
  project.calendar?.holidays,
  selectedCalendarYear,
  selectedCalendarMonth,
]);

  const visibleLeaveTypes =
    useMemo(() => {
      const allowed = [
        "CL",
        "SL",
        "EL",
        "LOP",
      ];

      return leaveTypes.filter(
        (type: any) =>
          allowed.includes(
            getLeaveTypeCode(type)
          )
      );
    }, [leaveTypes]);

  const getRequestLeaveType =
    useCallback(
      (request: any) => {
        const requestTypeId =
          getLeaveTypeId(request);

        const matchedType =
          leaveTypes.find(
            (type: any) =>
              String(
                type?.id ?? ""
              ).trim() ===
                requestTypeId &&
              requestTypeId
          );

        if (matchedType) {
          return {
            code:
              getLeaveTypeCode(
                matchedType
              ) || "--",
            name:
              getLeaveTypeName(
                matchedType
              ) || "",
          };
        }

        return {
          code:
            getLeaveTypeCode(
              request
            ) || "--",
          name:
            getLeaveTypeName(
              request
            ) || "",
        };
      },
      [leaveTypes]
    );

  /* ============================================================
     LEAVE MODAL
  ============================================================ */

  const openLeaveModal = () => {
    setLeaveError(null);
    setLeaveSuccess(null);

    setLeaveForm({
      leaveTypeId:
        visibleLeaveTypes[0]
          ? String(
              (visibleLeaveTypes[0] as any)
                .id
            )
          : "",
      startDate: "",
      endDate: "",
      totalDays: 1,
      isHalfDay: false,
      leaveDuration: "",
      reason: "",
    });

    setShowLeaveModal(true);
  };

  const closeLeaveModal = () => {
    if (submittingLeave) return;

    setShowLeaveModal(false);
    setLeaveError(null);
  };

  useEffect(() => {
    if (
      leaveForm.startDate &&
      leaveForm.endDate
    ) {
      const days =
        calculateDaysBetween(
          leaveForm.startDate,
          leaveForm.endDate
        );

      setLeaveForm((prev) => ({
        ...prev,
        totalDays: prev.isHalfDay
          ? 0.5
          : Math.max(days, 1),
      }));
    }
  }, [
    leaveForm.startDate,
    leaveForm.endDate,
    leaveForm.isHalfDay,
  ]);

  /* ============================================================
     SUBMIT LEAVE
  ============================================================ */

  const handleLeaveSubmit =
    async (
      e: FormEvent<HTMLFormElement>
    ) => {
      e.preventDefault();

      setLeaveError(null);
      setLeaveSuccess(null);

      if (!leaveForm.leaveTypeId) {
        setLeaveError(
          "Please select a leave type."
        );
        return;
      }

      if (!leaveForm.startDate) {
        setLeaveError(
          "Please select start date."
        );
        return;
      }

      if (!leaveForm.endDate) {
        setLeaveError(
          "Please select end date."
        );
        return;
      }

      if (
        leaveForm.endDate <
        leaveForm.startDate
      ) {
        setLeaveError(
          "End date cannot be before start date."
        );
        return;
      }

      if (leaveForm.isHalfDay) {
        if (leaveForm.startDate !== leaveForm.endDate) {
          setLeaveError("Half-day leave must be for a single date.");
          return;
        }

        if (leaveForm.totalDays !== 0.5) {
          setLeaveError("Half-day leave must be 0.5 days.");
          return;
        }

        if (!leaveForm.leaveDuration) {
          setLeaveError("Please select First Half or Second Half.");
          return;
        }
      }

      if (
        leaveForm.totalDays <= 0
      ) {
        setLeaveError(
          "Total days must be greater than 0."
        );
        return;
      }

      if (
        !leaveForm.reason.trim()
      ) {
        setLeaveError(
          "Please enter the reason."
        );
        return;
      }

      try {
        setSubmittingLeave(true);

        const response =
          await fetch(
            "/api/leaves",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                employeeId:employee.id,
                leaveTypeId:leaveForm.leaveTypeId,
                startDate:leaveForm.startDate,
                endDate:leaveForm.endDate,
                totalDays:leaveForm.totalDays,
                isHalfDay:leaveForm.isHalfDay,
                leaveDuration: leaveForm.isHalfDay ? leaveForm.leaveDuration: null,
                reason:leaveForm.reason.trim(),
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Failed to submit leave request."
          );
         
        }

        const newRequest =
          data?.request ??
          data?.leaveRequest;

        if (newRequest) {
          setLeaveRequests(
            (prev) => [
              newRequest,
              ...prev,
            ]
          );
        }

        await refreshLeaveData();

        setLeaveSuccess(
          "Leave request submitted successfully."
        );

        setLeaveForm({
          leaveTypeId: "",
          startDate: "",
          endDate: "",
          totalDays: 1,
          isHalfDay: false,
          leaveDuration: "",
          reason: "",
        });

        setTimeout(() => {
          setShowLeaveModal(false);
          setLeaveSuccess(null);
        }, 900);
      } catch (error) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : "Failed to submit leave request.";

  setLeaveError(errorMessage);
} finally {
  setSubmittingLeave(false);
}
    };

  /* ============================================================
     OPEN REGULARIZATION
  ============================================================ */

  const openRegularization =
    () => {
      setRegularizationError(null);
      setRegularizationSuccess(null);

      const date =
        selectedAttendance?.date ||
        selectedDate ||
        getLogDate(
          currentAttendanceLog
        ) ||
        todayString;

      const selectedLog =
        logs.find(
          (log) =>
            getLogDate(log) ===
            date
        ) ??
        (getLogDate(
          currentAttendanceLog
        ) === date
          ? currentAttendanceLog
          : null);

      setRegularizationForm({
        attendanceDate: date,

        proposedCheckIn:
          getTimeInputValue(
            getClockIn(
              selectedLog
            )
          ),

        proposedCheckOut:
          getTimeInputValue(
            getClockOut(
              selectedLog
            )
          ),

        reason: "",
      });

      setIsRegularizationModalOpen(
        true
      );
    };

  const closeRegularization =
    () => {
      if (
        submittingRegularization
      ) {
        return;
      }

      setIsRegularizationModalOpen(
        false
      );

      setRegularizationError(
        null
      );
    };

  /* ============================================================
     SUBMIT REGULARIZATION

     IMPORTANT FIX:
     The entered Punch In / Punch Out are explicitly added
     to the new request before putting it into `regs`.

     This guarantees that Pending requests show timings
     immediately.
  ============================================================ */

  const handleRegularizationSubmit =
    async (
      e: FormEvent<HTMLFormElement>
    ) => {
      e.preventDefault();

      setRegularizationError(null);
      setRegularizationSuccess(null);

      const attendanceDate =
        regularizationForm.attendanceDate.trim();

      const proposedCheckIn =
        regularizationForm.proposedCheckIn.trim();

      const proposedCheckOut =
        regularizationForm.proposedCheckOut.trim();

      const reason =
        regularizationForm.reason.trim();

      if (!attendanceDate) {
        setRegularizationError(
          "Please select attendance date."
        );
        return;
      }

      if (!proposedCheckIn) {
        setRegularizationError(
          "Please enter punch in time."
        );
        return;
      }

      if (!proposedCheckOut) {
        setRegularizationError(
          "Please enter punch out time."
        );
        return;
      }

      if (!reason) {
        setRegularizationError(
          "Please enter the reason."
        );
        return;
      }

      try {
        setSubmittingRegularization(
          true
        );

        const response =
          await fetch(
            "/api/attendance/regularization",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                employeeId: String(
                  employee.id
                ),
                attendanceDate,
                proposedCheckIn,
                proposedCheckOut,
                reason,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Failed to submit regularization request."
          );
        }

        const apiRequest =
          data?.regularization ??
          data?.request ??
          data?.data ??
          {};

        /*
         * IMPORTANT:
         *
         * Always merge the values entered in the popup
         * into the request object.
         *
         * This fixes the case where the POST API returns
         * only id/status/reason but not the proposed times.
         */
        const newRegularization =
          {
            ...apiRequest,

            attendance_date:
              apiRequest?.attendance_date ??
              apiRequest?.attendanceDate ??
              attendanceDate,

            proposed_check_in:
              proposedCheckIn,

            proposed_check_out:
              proposedCheckOut,

            proposedCheckIn:
              proposedCheckIn,

            proposedCheckOut:
              proposedCheckOut,

            reason:
              apiRequest?.reason ??
              reason,

            status:
              apiRequest?.status ??
              "pending",
          };

        setRegs(
          (prev) => [
            newRegularization as AttendanceRegularization,
            ...prev,
          ]
        );

        setIsRegularizationModalOpen(
          false
        );

        /*
         * Automatically open the request table
         * so the employee can immediately see:
         *
         * Punch In
         * Punch Out
         * Reason
         * Pending
         */
        setShowRegularizationRequests(
          true
        );

        setRegularizationSuccess(
          "Attendance regularization request submitted successfully."
        );

        setRegularizationForm({
          attendanceDate: "",
          proposedCheckIn: "",
          proposedCheckOut: "",
          reason: "",
        });
      } catch (error) {
        console.error(
          "Regularization submit error:",
          error
        );

        setRegularizationError(
          error instanceof Error
            ? error.message
            : "Failed to submit regularization request."
        );
      } finally {
        setSubmittingRegularization(
          false
        );
      }
    };

  /* ============================================================
     ACTIVE DATE
  ============================================================ */

  const activeDate =
    selectedDate ||
    (selectedCalendarYear === new Date().getFullYear() &&
    selectedCalendarMonth === new Date().getMonth()
      ? todayString
      : `${selectedCalendarYear}-${String(
          selectedCalendarMonth + 1
        ).padStart(2, "0")}-01`);
    

  const selectedLog = useMemo(() => {
    const found = logs.find(
      (log) =>
        getLogDate(log) ===
        activeDate
    );

    if (found) {
      return found;
    }

    if (
      currentTodayLog &&
      getLogDate(
        currentTodayLog
      ) === activeDate
    ) {
      return currentTodayLog;
    }

    return null;
  }, [
    logs,
    currentTodayLog,
    activeDate,
  ]);

  const selectedClockIn =
    selectedAttendance?.date ===
    activeDate
      ? selectedAttendance.clockIn ??
        getClockIn(selectedLog)
      : getClockIn(selectedLog);

  const selectedClockOut =
    selectedAttendance?.date ===
    activeDate
      ? selectedAttendance.clockOut ??
        getClockOut(selectedLog)
      : getClockOut(selectedLog);

  /* ============================================================
     CALENDAR
  ============================================================ */

  const handleCalendarDateSelect =
    (
      attendance: SelectedAttendance
    ) => {
      setSelectedAttendance(
        attendance
      );

      setSelectedDate(
        attendance.date
      );
    };

  /* ============================================================
     REGULARIZATION DATE
  ============================================================ */

  const handleRegularizationDateChange =
    (value: string) => {
      const matchingLog =
        logs.find(
          (log) =>
            getLogDate(log) ===
            value
        ) ??
        (getLogDate(
          currentTodayLog
        ) === value
          ? currentTodayLog
          : null);

      setRegularizationForm(
        (prev) => ({
          ...prev,
          attendanceDate:
            value,

          proposedCheckIn:
            getTimeInputValue(
              getClockIn(
                matchingLog
              )
            ),

          proposedCheckOut:
            getTimeInputValue(
              getClockOut(
                matchingLog
              )
            ),
        })
      );
    };

  /* ============================================================
     REGULARIZATION STATUS
  ============================================================ */

  const getRegularizationStatus =
    (request: any) => {
      return String(
        request?.status ??
          "pending"
      ).toLowerCase();
    };

  const getStatusLabel =
    (request: any) => {
      const status =
        getRegularizationStatus(
          request
        );

      switch (status) {
        case "approved":
          return "Approved";

        case "rejected":
          return "Rejected";

        case "pending":
          return "Pending";

        default:
          return status
            .replaceAll(
              "_",
              " "
            )
            .replace(
              /\b\w/g,
              (char) =>
                char.toUpperCase()
            );
      }
    };

  /* ============================================================
    WFH REQUEST HANDLERS
  ============================================================ */

  const getIndiaToday = () => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  };

  const openWfhModal = () => {
    setWfhError(null);
    setWfhSuccess(null);

    setWfhForm({
      requestDate: getIndiaToday(),
      reason: "",
    });

    setShowWfhModal(true);
  };

  const closeWfhModal = () => {
    if (submittingWfh) return;

    setShowWfhModal(false);
    setWfhError(null);
  };

  const handleWfhSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setWfhError(null);
    setWfhSuccess(null);

    if (!wfhForm.requestDate) {
      setWfhError("Please select a WFH date.");
      return;
    }

    if (wfhForm.requestDate < getIndiaToday()) {
      setWfhError("Past dates are not allowed.");
      return;
    }

    if (wfhForm.reason.trim().length < 5) {
      setWfhError("Please enter a reason with at least 5 characters.");
      return;
    }

    try {
      setSubmittingWfh(true);

      const response = await fetch("/api/wfh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_date: wfhForm.requestDate,
          reason: wfhForm.reason.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Failed to submit WFH request."
        );
      }

      await refreshWfhRequests();

      setWfhSuccess("WFH request submitted successfully.");

      setWfhForm({
        requestDate: "",
        reason: "",
      });

      setTimeout(() => {
        setShowWfhModal(false);
        setWfhSuccess(null);
      }, 1000);
    } catch (error) {
      setWfhError(
        error instanceof Error
          ? error.message
          : "Failed to submit WFH request."
      );
    } finally {
      setSubmittingWfh(false);
    }
  };

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="space-y-4">

      {/* HEADER */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Attendance
          </h1>

          <p className="mt-0.5 text-sm text-slate-500">
            Track your attendance, work hours and logs.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="relative">
            <span className="sr-only">Select attendance month</span>
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="month"
              aria-label="Select attendance month"
              value={`${selectedCalendarYear}-${String(
                selectedCalendarMonth + 1
              ).padStart(2, "0")}`}
              min={employee.joining_date?.slice(0, 7)}
              onChange={(event) => {
                if (!event.target.value) return;

                const [year, month] = event.target.value
                  .split("-")
                  .map(Number);
                setSelectedCalendarYear(year);
                setSelectedCalendarMonth(month - 1);
                setSelectedDate(`${event.target.value}-01`);
                setSelectedAttendance(null);
                setShowAllAttendanceLogs(false);
              }}
              className="w-40 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <button
            type="button"
            onClick={openWfhModal}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <House className="h-4 w-4" />
            Request WFH
          </button>

          {/* <button
            type="button"
            onClick={openLeaveModal}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <CalendarOff className="h-4 w-4" />
            Request Leave
          </button> */}

          {/* <button
            type="button"
            onClick={openRegularization}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <FileCheck className="h-4 w-4" />
            Regularization Request
          </button> */}
        </div>
      </div>

      {/* SUCCESS */}

      {regularizationSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />

          <span>
            {regularizationSuccess}
          </span>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          {
            label: "Present",
            value: presentCount,
            icon: CheckCircle2,
            border: "border-emerald-100",
            iconColor: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Absent",
            value: absentCount,
            icon: XCircle,
            border: "border-rose-100",
            iconColor: "bg-rose-50 text-rose-600",
          },
          // {
          //   label: "Late",
          //   value: lateCount,
          //   icon: Clock,
          //   border: "border-amber-100",
          //   iconColor: "bg-amber-50 text-amber-600",
          // },
          {
            label: "Work From Home",
            value: workFromHomeCount,
            icon: Home,
            border: "border-blue-100",
            iconColor: "bg-blue-50 text-blue-600",
          },
          {
            label: "Total Working Days",
            value: totalWorkingDays,
            icon: Calendar,
            border: "border-purple-100",
            iconColor: "bg-purple-50 text-purple-600",
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <section
              key={item.label}
              className={`flex min-h-[72px] items-center gap-3 rounded-lg border bg-white px-3 py-2.5 shadow-sm ${item.border}`}
            >
              <span className={`shrink-0 rounded-lg p-2 ${item.iconColor}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {item.label}
                </p>
                <p className="mt-0.5 text-lg font-bold leading-5 text-slate-900">
                  {item.value}
                  {item.label === "Total Working Days" ? " days" : ""}
                </p>
              </div>
            </section>
          );
        })}
      </div>

      {/* CALENDAR + CLOCK */}

      <div className="grid grid-cols-1 items-start gap-2.5 xl:grid-cols-[minmax(215px,0.36fr)_minmax(0,1fr)]">

        <div>
          <AttendanceCalendar
            logs={logs}
            leaveRequests={leaveRequests}
            holidays={project.calendar?.holidays}
            employeeJoiningDate={employee.joining_date}
            selectedDate={selectedDate}
            compact
            onDateSelect={handleCalendarDateSelect}
            onSelectedDateChange={(date) => {
              setSelectedDate(date);
              setSelectedAttendance(null);
            }}
            onMonthChange={(year, month) => {
              setSelectedCalendarYear(year);
              setSelectedCalendarMonth(month);
              setShowAllAttendanceLogs(false);
            }}
          />

        </div>

        <div className="space-y-5">
          <section className="flex h-[70vh] min-h-[360px] max-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Attendance Logs
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setShowAllAttendanceLogs((previous) => !previous)
                }
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {showAllAttendanceLogs ? "Show Less" : "View All"}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[670px] text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Check In</th>
                    <th className="px-4 py-3">Check Out</th>
                    <th className="px-4 py-3">Work Hours</th>
                    <th className="px-4 py-3">Location / Mode</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {selectedMonthLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No attendance records for this month.
                      </td>
                    </tr>
                  ) : (
                    selectedMonthLogs
                      .slice(
                        0,
                        showAllAttendanceLogs
                          ? selectedMonthLogs.length
                          : 8
                      )
                      .map((log) => {
                      const date = getLogDate(log);
                      const status = normalizeAttendanceStatus(log.status);
                      const isLate =
                        Boolean(log.is_late) || status === "late";
                      const workFromHome = isWorkFromHome(log);

                      return (
                       <tr
                          key={`${employee.id}-${date}-${log.id || log.status}`}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-800">
                            {formatDateForDisplay(date)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                            {new Date(`${date}T00:00:00`).toLocaleDateString(
                              "en-US",
                              { weekday: "short" }
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                            {formatAttendanceTime(log.check_in_time)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                            {formatAttendanceTime(log.check_out_time)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-700">
                            {log.total_hours !== null &&
                            log.total_hours !== undefined
                              ? formatTotalHours(log.total_hours)
                              : calculateWorkingHours(
                                  log.check_in_time,
                                  log.check_out_time
                                )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                            {getAttendanceMode(log)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${
                                workFromHome
                                  ? "bg-blue-100 text-blue-800"
                                  : isLate
                                  ? "bg-amber-100 text-amber-800"
                                  : status === "present"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : status === "absent"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {workFromHome
                                ? "Present"
                                : isLate
                                  ? "Late"
                                  : status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(date);
                                setSelectedAttendance(null);
                              }}
                              aria-label={`View attendance for ${date}`}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {false && (
          <details className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
              Clock In / Out
            </summary>
            <div className="mt-3">
          <ClockInWidget
            employeeId={String(
              employee.id
            )}
            initialLog={
              currentTodayLog
            }
            project={project}
            selectedDate={activeDate}

            isApprovedLeave={leaveRequests.some((request) => {
              if (getLeaveRequestStatus(request) !== "approved") {
                return false;
              }

              const start = String(
                (request as any).start_date ??
                (request as any).startDate ??
                ""
              ).slice(0, 10);

              const end = String(
                (request as any).end_date ??
                (request as any).endDate ??
                start
              ).slice(0, 10);

              return (
                Boolean(start) &&
                activeDate >= start &&
                activeDate <= end
              );
            })}

            selectedAttendance={
              selectedAttendance
            }
            onRequestRegularization={
              openRegularization
            }
            onAttendanceUpdate={(
              updatedLog
            ) => {
              setCurrentTodayLog(
                updatedLog
              );

              setLogs((prev) => {
                const updatedDate =
                  getLogDate(
                    updatedLog
                  );

                const exists =
                  prev.some(
                    (log) =>
                      getLogDate(
                        log
                      ) ===
                      updatedDate
                  );

                if (exists) {
                  return prev.map(
                    (log) =>
                      getLogDate(
                        log
                      ) ===
                      updatedDate
                        ? updatedLog
                        : log
                  );
                }

                return [
                  updatedLog,
                  ...prev,
                ];
              });

              const updatedDate =
                getLogDate(
                  updatedLog
                );

              const status =
                String(
                  (updatedLog as any)
                    .status ??
                    "present"
                ).toLowerCase();

              let selectedStatus:
                | "present"
                | "half_day"
                | "late"
                | "work_from_home"
                | "leave"
                | "empty" =
                "present";

              if (
                status ===
                "half_day"
              ) {
                selectedStatus =
                  "half_day";
              } else if (status === "late") {
                selectedStatus = "late";
              } else if (isWorkFromHome(updatedLog)) {
                selectedStatus = "work_from_home";
              } else if (
                status ===
                  "on_leave" ||
                status === "leave"
              ) {
                selectedStatus =
                  "leave";
              }

              const updatedClockIn =
                getClockIn(
                  updatedLog
                );

              const updatedClockOut =
                getClockOut(
                  updatedLog
                );

              const totalHours =
                (updatedLog as any)
                  .total_hours ??
                (updatedLog as any)
                  .totalHours;

              let worked = "--";

              if (
                totalHours !==
                  undefined &&
                totalHours !==
                  null &&
                totalHours !== ""
              ) {
                worked = `${totalHours} hrs`;
              } else {
                worked =
                  calculateWorkingHours(
                    updatedClockIn,
                    updatedClockOut
                  );
              }

              setSelectedAttendance({
                date: updatedDate,
                status:
                  selectedStatus,
                clockIn:
                  updatedClockIn ??
                  undefined,
                clockOut:
                  updatedClockOut ??
                  undefined,
                worked,
              });

              setSelectedDate(
                updatedDate
              );
            }}
          />
            </div>
          </details>
          )}
        </div>
      </div>

      {false && (
      <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Attendance Summary
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(
              selectedCalendarYear,
              selectedCalendarMonth
            ).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Working Days",
              value: totalWorkingDays,
              color: "text-blue-700",
              background: "bg-blue-50",
            },
            {
              label: "Present Days",
              value: presentCount,
              color: "text-emerald-700",
              background: "bg-emerald-50",
            },
            {
              label: "Absent Days",
              value: absentCount,
              color: "text-rose-700",
              background: "bg-rose-50",
            },
            // {
            //   label: "Late Days",
            //   value: lateCount,
            //   color: "text-amber-700",
            //   background: "bg-amber-50",
            // },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-100 p-4"
            >
              <span
                className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${item.background} ${item.color}`}
              >
                {item.label}
              </span>
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ATTENDANCE DETAILS */}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Attendance Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              View attendance timing and status for the selected date.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-2">
            <Clock className="h-5 w-5 text-slate-500" />
          </div>
        </div>

        <div className="p-5">

          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Attendance Date
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              {formatDateForDisplay(
                activeDate
              )}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">

            <table className="w-full min-w-[750px]">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Clock In
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Clock Out
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Worked
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Attendance
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shift
                  </th>

                </tr>
              </thead>

              <tbody>
                <tr className="border-b border-slate-100 last:border-0">

                  <td className="px-5 py-4 text-sm font-medium text-slate-800">
                    {formatDateForDisplay(
                      activeDate
                    )}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {selectedClockIn
                      ? formatAttendanceTime(
                          selectedClockIn
                        )
                      : "--"}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {selectedClockOut
                      ? formatAttendanceTime(
                          selectedClockOut
                        )
                      : "--"}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                    {selectedAttendance?.date ===
                      activeDate &&
                    selectedAttendance?.worked
                      ? selectedAttendance?.worked
                      : calculateWorkingHours(
                          selectedClockIn,
                          selectedClockOut
                        )}
                  </td>

                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {selectedAttendance?.date ===
                        activeDate &&
                      selectedAttendance?.status
                        ? selectedAttendance?.status?.replaceAll(
                            "_",
                            " "
                          )
                        : selectedLog
                        ? String(
                            (selectedLog as any)
                              .status ??
                              "Not Available"
                          ).replaceAll(
                            "_",
                            " "
                          )
                        : "Not Available"}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {(selectedLog as any)
                      ?.shift_name ??
                      (selectedLog as any)
                        ?.shift ??
                      (selectedLog as any)
                        ?.shiftName ??
                      project?.name ??
                      "--"}
                  </td>

                </tr>
              </tbody>

            </table>
          </div>
        </div>
      </div>

      {/* ATTENDANCE REGULARIZATION */}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Attendance Regularization
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Submit and track attendance correction
              requests.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowRegularizationRequests(
                (prev) => !prev
              )
            }
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {showRegularizationRequests
              ? "Hide Requests"
              : "View Requests"}
          </button>

        </div>

        {showRegularizationRequests && (
          <div className="overflow-x-auto">

            {regs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No regularization requests found.
              </div>
            ) : (
              <table className="w-full min-w-[800px]">

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Punch In
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Punch Out
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reason
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {regs.map(
                    (
                      request: any,
                      index
                    ) => {

                      const date =
                        request?.attendance_date ??
                        request?.attendanceDate ??
                        request?.date ??
                        "";

                      /*
                       * Support every possible field name.
                       */
                      const checkIn =
                        request?.proposed_check_in ??
                        request?.proposedCheckIn ??
                        request?.punch_in ??
                        request?.punchIn ??
                        request?.punchInTime ??
                        request?.check_in ??
                        request?.checkIn ??
                        null;

                      const checkOut =
                        request?.proposed_check_out ??
                        request?.proposedCheckOut ??
                        request?.punch_out ??
                        request?.punchOut ??
                        request?.punchOutTime ??
                        request?.check_out ??
                        request?.checkOut ??
                        null;

                      const status =
                        getRegularizationStatus(
                          request
                        );

                      return (
                        <tr
                          key={
                            request?.id ??
                            `${date}-${index}`
                          }
                          className="border-b border-slate-100 last:border-0"
                        >

                          <td className="px-5 py-4 text-sm font-medium text-slate-800">
                            {date
                              ? formatDateForDisplay(
                                  String(
                                    date
                                  ).slice(
                                    0,
                                    10
                                  )
                                )
                              : "--"}
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                            {formatAttendanceTime(
                              checkIn
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                            {formatAttendanceTime(
                              checkOut
                            )}
                          </td>

                          <td className="max-w-xs px-5 py-4 text-sm text-slate-600">
                            <div className="truncate">
                              {request?.reason ||
                                "--"}
                            </div>
                          </td>

                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                status ===
                                "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : status ===
                                    "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {getStatusLabel(
                                request
                              )}
                            </span>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>
            )}

          </div>
        )}

      </div>

      {/* WFH REQUEST MANAGEMENT */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Work From Home Requests
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              View and track your WFH requests.
            </p>
          </div>

          {loadingWfh && (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          )}
        </div>

        <div className="p-5">
          {wfhRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <House className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                No WFH requests found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                      Requested Date
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                      HR Remarks
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {wfhRequests.map((request: any) => {
                    const status = String(
                      request.status || "pending"
                    ).toLowerCase();

                    return (
                      <tr
                        key={request.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-4 py-4 text-sm font-medium text-slate-800">
                          {formatDateForDisplay(
                            String(request.request_date).slice(0, 10)
                          )}
                        </td>

                        <td className="max-w-xs px-4 py-4 text-sm text-slate-600">
                          {request.reason || "--"}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              status === "approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {status.charAt(0).toUpperCase() +
                              status.slice(1)}
                          </span>
                        </td>

                        <td className="max-w-xs px-4 py-4 text-sm text-slate-600">
                          {request.rejection_reason || "--"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* LEAVE MANAGEMENT */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 p-5">

          <div className="flex items-center justify-between gap-4">

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Leave Management
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                View your leave requests.
              </p>
            </div>

            {loadingLeaves && (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            )}

          </div>

        </div>

        <div className="p-5">

          {leaveRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">

              <CalendarOff className="mx-auto h-8 w-8 text-slate-300" />

              <p className="mt-3 text-sm font-medium text-slate-600">
                No leave requests found.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[850px]">

                <thead>
                  <tr className="border-b border-slate-200 text-left">

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Leave Type
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Start
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      End
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Days
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reason
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {leaveRequests.map(
                    (
                      request: any,
                      index
                    ) => {

                      const requestLeaveType =
                        getRequestLeaveType(
                          request
                        );

                      const typeCode =
                        requestLeaveType.code;

                      const typeName =
                        requestLeaveType.name;

                      const status =
                        String(
                          request?.status ??
                            "pending"
                        ).toLowerCase();

                      return (
                        <tr
                          key={
                            request?.id ??
                            index
                          }
                          className="border-b border-slate-100 last:border-0"
                        >

                          <td className="px-4 py-4">

                            <div className="flex items-center gap-2">

                              <span className="inline-flex min-w-[38px] items-center justify-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">
                                {String(
                                  typeCode
                                ).toUpperCase()}
                              </span>

                              {typeName && (
                                <span className="text-sm text-slate-600">
                                  {typeName}
                                </span>
                              )}

                            </div>

                          </td>

                          <td className="px-4 py-4 text-sm text-slate-600">
                            {request?.start_date ??
                              request?.startDate ??
                              "--"}
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-600">
                            {request?.end_date ??
                              request?.endDate ??
                              "--"}
                          </td>

                          <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                            {request?.is_half_day ??
                              request?.isHalfDay
                              ? 0.5
                              : request?.total_days ??
                                request?.totalDays ??
                                "--"}
                          </td>

                          <td className="max-w-xs px-4 py-4 text-sm text-slate-600">
                            <div className="truncate">
                              {request?.reason ??
                                "--"}
                            </div>
                          </td>

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                status ===
                                "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : status ===
                                    "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {status
                                .replaceAll(
                                  "_",
                                  " "
                                )
                                .replace(
                                  /\b\w/g,
                                  (
                                    char
                                  ) =>
                                    char.toUpperCase()
                                )}
                            </span>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>
      </div>

      </>
      )}

      {/* ======================================================
          REGULARIZATION POPUP
      ====================================================== */}

      {isRegularizationModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(e) => {
            if (
              e.target ===
                e.currentTarget &&
              !submittingRegularization
            ) {
              closeRegularization();
            }
          }}
        >

          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Request Attendance Regularization
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Correct your attendance for the
                  selected date
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeRegularization
                }
                disabled={
                  submittingRegularization
                }
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <form
              onSubmit={
                handleRegularizationSubmit
              }
            >

              <div className="space-y-5 px-6 py-5">

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Attendance Date
                  </label>

                  <div className="relative">

                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="date"
                      value={
                        regularizationForm.attendanceDate
                      }
                      onChange={(e) =>
                        handleRegularizationDateChange(
                          e.target.value
                        )
                      }
                      required
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />

                  </div>

                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Punch In Time
                    </label>

                    <div className="relative">

                      <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="time"
                        value={
                          regularizationForm.proposedCheckIn
                        }
                        onChange={(e) =>
                          setRegularizationForm(
                            (prev) => ({
                              ...prev,
                              proposedCheckIn:
                                e.target
                                  .value,
                            })
                          )
                        }
                        required
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />

                    </div>

                  </div>

                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Punch Out Time
                    </label>

                    <div className="relative">

                      <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="time"
                        value={
                          regularizationForm.proposedCheckOut
                        }
                        onChange={(e) =>
                          setRegularizationForm(
                            (prev) => ({
                              ...prev,
                              proposedCheckOut:
                                e.target
                                  .value,
                            })
                          )
                        }
                        required
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />

                    </div>

                  </div>

                </div>

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Reason
                  </label>

                  <textarea
                    value={
                      regularizationForm.reason
                    }
                    onChange={(e) =>
                      setRegularizationForm(
                        (prev) => ({
                          ...prev,
                          reason:
                            e.target
                              .value,
                        })
                      )
                    }
                    rows={4}
                    required
                    placeholder="Please enter the reason for attendance regularization..."
                    className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />

                </div>

                {regularizationError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">

                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                    <span>
                      {
                        regularizationError
                      }
                    </span>

                  </div>
                )}

              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">

                <button
                  type="button"
                  onClick={
                    closeRegularization
                  }
                  disabled={
                    submittingRegularization
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    submittingRegularization
                  }
                  className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {submittingRegularization ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ======================================================
          LEAVE POPUP
      ====================================================== */}

      {showLeaveModal && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (
              e.target ===
                e.currentTarget &&
              !submittingLeave
            ) {
              closeLeaveModal();
            }
          }}
        >

          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Apply for Leave
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Submit a new leave request
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeLeaveModal
                }
                disabled={
                  submittingLeave
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <form
              onSubmit={
                handleLeaveSubmit
              }
            >

              <div className="space-y-4 px-6 py-5">

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Leave Type
                  </label>

                  <select
                    value={
                      leaveForm.leaveTypeId
                    }
                    onChange={(e) =>
                      setLeaveForm(
                        (prev) => ({
                          ...prev,
                          leaveTypeId:
                            e.target
                              .value,
                        })
                      )
                    }
                    required
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  >

                    <option value="">
                      Select Leave Type
                    </option>

                    {visibleLeaveTypes.map(
                      (type: any) => (
                        <option
                          key={type.id}
                          value={type.id}
                        >
                          {getLeaveTypeCode(
                            type
                          )}
                        </option>
                      )
                    )}

                  </select>

                </div>

                <div className="grid grid-cols-2 gap-3">

                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Start Date
                    </label>

                    <input
                      type="date"
                      value={
                        leaveForm.startDate
                      }
                      onChange={(e) =>
                        setLeaveForm(
                          (prev) => ({
                            ...prev,
                            startDate:
                              e.target
                                .value,
                          })
                        )
                      }
                      required
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />

                  </div>

                  <div>

                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      End Date
                    </label>

                    <input
                      type="date"
                      value={
                        leaveForm.endDate
                      }
                      onChange={(e) =>
                        setLeaveForm(
                          (prev) => ({
                            ...prev,
                            endDate:
                              e.target
                                .value,
                          })
                        )
                      }
                      required
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />

                  </div>

                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3">

                  <input
                    type="checkbox"
                    checked={
                      leaveForm.isHalfDay
                    }
                      onChange={(e) =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          isHalfDay: e.target.checked,
                          leaveDuration: "",
                          totalDays: e.target.checked
                            ? 0.5
                            : Math.max(
                                calculateDaysBetween(
                                  prev.startDate,
                                  prev.endDate
                                ),
                                1
                              ),
                        }))
                      }
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  <span className="text-sm font-medium text-slate-700">
                    Half Day
                  </span>

                </label>

                {leaveForm.isHalfDay && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Select Half-Day Leave
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ["first_half", "First Half"],
                          ["second_half", "Second Half"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setLeaveForm((prev) => ({
                              ...prev,
                              leaveDuration: value,
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                            leaveForm.leaveDuration === value
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-300 text-slate-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <p className="text-xs text-slate-500">
                      First Half Leave: You work the second half of your shift.
                      Second Half Leave: You work the first half of your shift.
                    </p>
                  </div>
                )}

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Total Days
                  </label>

                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={
                      leaveForm.totalDays
                    }
                    onChange={(e) =>
                      setLeaveForm(
                        (prev) => ({
                          ...prev,
                          totalDays:
                            Number(
                              e.target
                                .value
                            ),
                        })
                      )
                    }
                    required
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Reason
                  </label>

                  <textarea
                    rows={3}
                    value={
                      leaveForm.reason
                    }
                    onChange={(e) =>
                      setLeaveForm(
                        (prev) => ({
                          ...prev,
                          reason:
                            e.target
                              .value,
                        })
                      )
                    }
                    required
                    placeholder="Enter reason..."
                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />

                </div>

                {leaveError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">

                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                    <span>
                      {leaveError}
                    </span>

                  </div>
                )}

                {leaveSuccess && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                    {leaveSuccess}
                  </div>
                )}

              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">

                <button
                  type="button"
                  onClick={
                    closeLeaveModal
                  }
                  disabled={
                    submittingLeave
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    submittingLeave
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >

                  {submittingLeave && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {submittingLeave
                    ? "Submitting..."
                    : "Submit Leave"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ======================================================
          WFH REQUEST POPUP
      ====================================================== */}

      {showWfhModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !submittingWfh
            ) {
              closeWfhModal();
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Request Work From Home
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Submit your WFH request for HR approval.
                </p>
              </div>

              <button
                type="button"
                onClick={closeWfhModal}
                disabled={submittingWfh}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleWfhSubmit}>
              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    WFH Date
                  </label>

                  <input
                    type="date"
                    min={getIndiaToday()}
                    value={wfhForm.requestDate}
                    onChange={(e) =>
                      setWfhForm((prev) => ({
                        ...prev,
                        requestDate: e.target.value,
                      }))
                    }
                    required
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Reason
                  </label>

                  <textarea
                    rows={4}
                    maxLength={1000}
                    value={wfhForm.reason}
                    onChange={(e) =>
                      setWfhForm((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    required
                    placeholder="Explain why you need to work from home..."
                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />

                  <p className="mt-1 text-right text-xs text-slate-400">
                    {wfhForm.reason.length}/1000
                  </p>
                </div>

                {wfhError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {wfhError}
                  </div>
                )}

                {wfhSuccess && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                    {wfhSuccess}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeWfhModal}
                  disabled={submittingWfh}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingWfh}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submittingWfh && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {submittingWfh ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}