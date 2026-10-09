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
  EmployeeLeaveBalance,
  LeaveRequest,
  LeaveType,
  Project,
} from "@/lib/types";

import {
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck,
  Loader2,
  Calendar,
  CalendarOff,
  Plus,
  X,
  AlertCircle,
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
  leaveBalances?: EmployeeLeaveBalance[];
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

/* ============================================================
   LEAVE BALANCE HELPERS
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

function getBalanceValue(
  balance: any
) {
  const value =
    balance?.balance_days ??
    balance?.balanceDays ??
    balance?.available ??
    balance?.available_days ??
    balance?.availableDays ??
    balance?.remaining ??
    balance?.remaining_days ??
    balance?.remainingDays ??
    0;

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
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

function getLeaveRequestDays(
  request: any
) {
  const isHalfDay =
    request?.is_half_day ??
    request?.isHalfDay ??
    false;

  if (Boolean(isHalfDay)) {
    return 0.5;
  }

  const totalDays =
    request?.total_days ??
    request?.totalDays ??
    request?.days ??
    0;

  const days = Number(
    totalDays
  );

  if (
    Number.isFinite(days) &&
    days > 0
  ) {
    return days;
  }

  const startDate =
    request?.start_date ??
    request?.startDate ??
    "";

  const endDate =
    request?.end_date ??
    request?.endDate ??
    "";

  if (startDate && endDate) {
    return calculateDaysBetween(
      String(startDate).slice(0, 10),
      String(endDate).slice(0, 10)
    );
  }

  return 0;
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
  leaveBalances: initialLeaveBalances = [],
  leaveRequests: initialLeaveRequests = [],
  leaveTypes: initialLeaveTypes = [],
}: EmployeeAttendanceViewProps) {
  const [logs, setLogs] =
    useState<AttendanceLog[]>(
      historyLogs ?? []
    );

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

  const [
    leaveBalances,
    setLeaveBalances,
  ] = useState<EmployeeLeaveBalance[]>(
    initialLeaveBalances ?? []
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
      reason: "",
    });

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

  const refreshLeaveData =
    useCallback(async () => {
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

        const balances =
          Array.isArray(
            data?.leaveBalances
          )
            ? data.leaveBalances
            : Array.isArray(
                data?.balances
              )
            ? data.balances
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
        setLeaveBalances(
          balances
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

  useEffect(() => {
    refreshLeaveData();

    const interval =
      setInterval(() => {
        refreshLeaveData();
      }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [refreshLeaveData]);

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

  const presentCount = useMemo(
    () => {
      return logs.filter(
        (log) => {
          const status =
            normalizeAttendanceStatus(
              (log as any).status
            );

          return (
            status === "present" ||
            status === "half_day" ||
            Boolean(
              (log as any).is_late
            )
          );
        }
      ).length;
    },
    [logs]
  );

  const absentCount = useMemo(
    () => {
      return logs.filter(
        (log) => {
          const status =
            normalizeAttendanceStatus(
              (log as any).status
            );

          return (
            status === "absent" ||
            status ===
              "not_present"
          );
        }
      ).length;
    },
    [logs]
  );

  const leaveCount = useMemo(
    () => {
      return leaveRequests.reduce(
        (
          total,
          request: any
        ) => {
          const status =
            getLeaveRequestStatus(
              request
            );

          if (
            status !== "approved"
          ) {
            return total;
          }

          return (
            total +
            getLeaveRequestDays(
              request
            )
          );
        },
        0
      );
    },
    [leaveRequests]
  );


const sickLeaveRemaining = useMemo(() => {
  const balance = leaveBalances.find(
    (item: any) => getLeaveTypeCode(item) === "SL"
  );

  return balance ? Math.max(0, getBalanceValue(balance)) : 0;
}, [leaveBalances]);

const casualLeaveRemaining = useMemo(() => {
  const balance = leaveBalances.find(
    (item: any) => getLeaveTypeCode(item) === "CL"
  );

  return balance ? Math.max(0, getBalanceValue(balance)) : 0;
}, [leaveBalances]);

const leaveBalance = useMemo(
  () => sickLeaveRemaining + casualLeaveRemaining,
  [sickLeaveRemaining, casualLeaveRemaining]
);

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
                employeeId:
                  employee.id,
                leaveTypeId:
                  leaveForm.leaveTypeId,
                startDate:
                  leaveForm.startDate,
                endDate:
                  leaveForm.endDate,
                totalDays:
                  leaveForm.totalDays,
                isHalfDay:
                  leaveForm.isHalfDay,
                reason:
                  leaveForm.reason.trim(),
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
          reason: "",
        });

        setTimeout(() => {
          setShowLeaveModal(false);
          setLeaveSuccess(null);
        }, 900);
      } catch (error) {
        console.error(
          "Leave submit error:",
          error
        );

        setLeaveError(
          error instanceof Error
            ? error.message
            : "Failed to submit leave request."
        );
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
    selectedDate || todayString;

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
     RENDER
  ============================================================ */

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Attendance & Leaves
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your attendance, leave requests
            and attendance regularization.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={
              openRegularization
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FileCheck className="h-4 w-4" />
            Request Regularization
          </button>

          <button
            type="button"
            onClick={openLeaveModal}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Apply for Leave
          </button>
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Present
            </p>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {presentCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Absent
            </p>
            <XCircle className="h-5 w-5 text-red-500" />
          </div>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {absentCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Leave
            </p>
            <CalendarOff className="h-5 w-5 text-yellow-500" />
          </div>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {leaveCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Yearly Leaves
            </p>

            <Calendar className="h-5 w-5 text-slate-500" />
          </div>

          <div className="mt-3 grid grid-cols-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {sickLeaveRemaining}
              </p>

              <p className="mt-1 text-xs font-bold text-slate-600">
                SL
              </p>

              <p className="text-[11px] text-slate-400">
                Sick Leave
              </p>
            </div>

            <div className="border-l border-slate-200 text-center">
              <p className="text-2xl font-bold text-slate-900">
                {casualLeaveRemaining}
              </p>

              <p className="mt-1 text-xs font-bold text-slate-600">
                CL
              </p>

              <p className="text-[11px] text-slate-400">
                Casual Leave
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Leave Balance
            </p>

            <Calendar className="h-5 w-5 text-blue-500" />
          </div>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {leaveBalance}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            SL + CL remaining
          </p>
        </div>

      </div>

      {/* CALENDAR + CLOCK */}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Attendance Calendar
            </h2>

            <p className="text-sm text-slate-500">
              Select a date to view attendance details.
            </p>
          </div>

          <AttendanceCalendar
            logs={logs}
            leaveRequests={
              leaveRequests
            }
            onDateSelect={
              handleCalendarDateSelect
            }
            onSelectedDateChange={(
              date
            ) => {
              setSelectedDate(date);

              if (!date) {
                setSelectedAttendance(
                  null
                );
              }
            }}
          />
        </div>

        <div>
          <ClockInWidget
            employeeId={String(
              employee.id
            )}
            initialLog={
              currentTodayLog
            }
            project={project}
            selectedDate={activeDate}
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
                | "leave"
                | "empty" =
                "present";

              if (
                status ===
                "half_day"
              ) {
                selectedStatus =
                  "half_day";
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
      </div>

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
                      ? selectedAttendance.worked
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
                        ? selectedAttendance.status.replaceAll(
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
                      setLeaveForm(
                        (prev) => ({
                          ...prev,
                          isHalfDay:
                            e.target
                              .checked,
                          totalDays:
                            e.target
                              .checked
                              ? 0.5
                              : Math.max(
                                  calculateDaysBetween(
                                    prev.startDate,
                                    prev.endDate
                                  ),
                                  1
                                ),
                        })
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  <span className="text-sm font-medium text-slate-700">
                    Half Day
                  </span>

                </label>

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

    </div>
  );
}