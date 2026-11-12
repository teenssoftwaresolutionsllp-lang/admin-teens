
"use client";

import { useMemo, useState } from "react";
import type {
  AttendanceLog,
  Employee,
  Project,
  HolidayCalendar,
} from "@/lib/types";

type ApprovedLeave = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  leave_duration: "first_half" | "second_half" | null;
  leave_type: { id: string; name: string; code: string }[] | null;
};

type AttendanceSetting = {
  setting_key: string;
  employee_id: string | null;
  count_approved_leaves_toward_weekly_minimum: boolean;
};

type ReportStatus =
  | "Present"
  | "Half Day"
  | "Absent"
  | "Approved Leave"
  | "Holiday"
  | "Weekend"
  | "No Punch"
  | "Not Employed"
  | "Review Calendar"
  | "Review Leave"
  | "Future";

interface Props {
  logs: AttendanceLog[];
  employees: Employee[];
  projects: Project[];
  approvedLeaves: ApprovedLeave[];
  attendanceSettings: AttendanceSetting[];
  globalAttendanceSetting: AttendanceSetting | null;
  holidayCalendars: HolidayCalendar[];
}

type DayResult = {
  date: string;
  status: ReportStatus;
  detail?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateString(date);
}

function getWeekStart(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();

  return addDays(dateString, -((day + 6) % 7));
}

function isWeekend(dateString: string) {
  const day = new Date(`${dateString}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function getWeekdayLabel(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(
    "en-US",
    { weekday: "short" }
  );
}

function monthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: count }, (_, index) => {
    return `${year}-${pad(monthNumber)}-${pad(index + 1)}`;
  });
}

function getLeaveType(leave: ApprovedLeave) {
  return leave.leave_type?.[0]?.code?.toUpperCase() ?? "";
}

function isEligibleLeaveType(leave: ApprovedLeave) {
  return ["CL", "SL", "ML", "PL"].includes(getLeaveType(leave));
}

function getEmployeeCalendarId(
  employee: Employee,
  year: number,
  projects: Project[],
  calendars: HolidayCalendar[]
): string | null {
  if (employee.project_id) {
    const project = projects.find(
      (item) => item.id === employee.project_id
    );

    return project?.calendar_id ?? null;
  }

  const hasRetainedSettings =
    Boolean(employee.retained_calendar_id) ||
    Boolean(employee.retained_shift_start_time) ||
    Boolean(employee.retained_shift_end_time);

  if (hasRetainedSettings) {
    if (
      employee.retained_calendar_id &&
      employee.retained_shift_start_time &&
      employee.retained_shift_end_time
    ) {
      return employee.retained_calendar_id;
    }

    return null;
  }

  const shiftType =
    employee.shift_type === "night" ? "night" : "general";

  return (
    calendars.find(
      (calendar) =>
        calendar.country_code === "IN" &&
        Number(calendar.calendar_year) === year &&
        calendar.shift_type === shiftType
    )?.id ?? null
  );
}

function getLastWorkingDate(employee: Employee) {
  return (
    employee.exit_date ??
    (employee.status === "on_notice"
      ? employee.planned_last_working_date
      : null)
  );
}

function isEmployedOnDate(employee: Employee, date: string) {
  if (employee.joining_date && date < employee.joining_date) {
    return false;
  }

  const lastWorkingDate = getLastWorkingDate(employee);

  if (lastWorkingDate && date > lastWorkingDate) {
    return false;
  }

  return true;
}

function isEmployedDuringMonth(
  employee: Employee,
  month: string
) {
  const [year, monthNumber] = month.split("-").map(Number);

  const monthStart = `${month}-01`;
  const monthEnd = `${year}-${pad(monthNumber)}-${pad(
    new Date(year, monthNumber, 0).getDate()
  )}`;

  if (
    employee.joining_date &&
    employee.joining_date > monthEnd
  ) {
    return false;
  }

  const lastWorkingDate = getLastWorkingDate(employee);

  if (lastWorkingDate && lastWorkingDate < monthStart) {
    return false;
  }

  return true;
}

export default function AttendanceReports({
  logs,
  employees,
  projects,
  approvedLeaves,
  attendanceSettings,
  globalAttendanceSetting,
  holidayCalendars,
}: Props) {
  const today = localDateString();

  // Report tabs
  const [reportView, setReportView] = useState<"daily" | "monthly">(
    "daily"
  );

  // Daily report filters
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedDailyStatus, setSelectedDailyStatus] = useState<
    "all" | "Present" | "Absent" | "Holiday"
  >("all");
  const [dailyDepartment, setDailyDepartment] = useState("all");

  // Monthly report filters
  const [selectedMonth, setSelectedMonth] = useState(
    today.slice(0, 7)
  );
  const [search, setSearch] = useState("");
  const [monthlyDepartment, setMonthlyDepartment] = useState("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceLog>();

    logs.forEach((log) => {
      map.set(
        `${log.employee_id}:${log.attendance_date}`,
        log
      );
    });

    return map;
  }, [logs]);

  const employeeSettingMap = useMemo(() => {
    const map = new Map<string, boolean>();

    attendanceSettings.forEach((setting) => {
      if (setting.employee_id) {
        map.set(
          setting.employee_id,
          setting.count_approved_leaves_toward_weekly_minimum
        );
      }
    });

    return map;
  }, [attendanceSettings]);

  const globalSetting =
    globalAttendanceSetting
      ?.count_approved_leaves_toward_weekly_minimum ?? false;

  const getCountApprovedLeaves = (employeeId: string) =>
    employeeSettingMap.get(employeeId) ?? globalSetting;

  const getEmployeeLeaves = (
    employeeId: string,
    date: string
  ) =>
    approvedLeaves.filter(
      (leave) =>
        leave.employee_id === employeeId &&
        leave.start_date <= date &&
        leave.end_date >= date
    );

  // Base attendance result for an individual date.
  const getDayResult = (
    employee: Employee,
    date: string,
    weekendIsWorking: boolean
  ): DayResult => {
    if (!isEmployedOnDate(employee, date)) {
      return { date, status: "Not Employed" };
    }

    if (date > today) {
      return { date, status: "Future" };
    }

    const calendarId = getEmployeeCalendarId(
      employee,
      Number(date.slice(0, 4)),
      projects,
      holidayCalendars
    );

    if (!calendarId) {
      return {
        date,
        status: "Review Calendar",
        detail: "No calendar assigned",
      };
    }

    const calendar = holidayCalendars.find(
      (item) => item.id === calendarId
    );

    if (
      !calendar ||
      calendar.document_status !== "imported"
    ) {
      return {
        date,
        status: "Review Calendar",
        detail: calendar
          ? `Calendar status: ${
              calendar.document_status ?? "not_uploaded"
            }`
          : "Calendar not found",
      };
    }

    const holiday = calendar.holidays?.find(
      (item) => item.holiday_date.slice(0, 10) === date
    );

    if (
      holiday &&
      (holiday.is_working_day === false ||
        holiday.is_working_day == null)
    ) {
      return {
        date,
        status: "Holiday",
        detail: holiday.title,
      };
    }

    if (isWeekend(date) && !weekendIsWorking) {
      return { date, status: "Weekend" };
    }

    const leaves = getEmployeeLeaves(employee.id, date);

    if (leaves.length > 1) {
      return { date, status: "Review Leave" };
    }

    const log = attendanceMap.get(
      `${employee.id}:${date}`
    );

    if (leaves.length === 1) {
      const leave = leaves[0];

      if (!leave.is_half_day) {
        return {
          date,
          status: "Approved Leave",
          detail: getLeaveType(leave),
        };
      }

      const validHalfDay =
        leave.start_date === date &&
        leave.end_date === date &&
        Number(leave.total_days) === 0.5 &&
        ["first_half", "second_half"].includes(
          leave.leave_duration ?? ""
        );

      if (!validHalfDay) {
        return { date, status: "Review Leave" };
      }

      return {
        date,
        status: "Approved Leave",
        detail: `Half day ${getLeaveType(leave)}`,
      };
    }

    if (log?.is_regularized) {
      if (log.status === "present") {
        return {
          date,
          status: "Present",
          detail: "Regularized",
        };
      }

      if (log.status === "half_day") {
        return {
          date,
          status: "Half Day",
          detail: "Regularized",
        };
      }
    }

    if (log?.status === "present") {
      return { date, status: "Present" };
    }

    if (log?.status === "half_day") {
      return { date, status: "Half Day" };
    }

    if (log?.status === "absent") {
      return { date, status: "Absent" };
    }

    if (log?.status === "holiday") {
      return { date, status: "Holiday" };
    }

    if (log?.status === "weekend") {
      return { date, status: "Weekend" };
    }

    if (log?.status === "on_leave") {
      return { date, status: "Approved Leave" };
    }

    return { date, status: "No Punch" };
  };

  // Calculate weekly credits from Monday through Sunday.
  // Half-day attendance and eligible half-day leave can combine
  // across different dates in the same week.
  const getWeekEligibleDays = (
    employee: Employee,
    weekStart: string
  ) => {
    let eligible = 0;

    for (let index = 0; index < 7; index++) {
      const date = addDays(weekStart, index);

      if (
        !isEmployedOnDate(employee, date) ||
        date > today
      ) {
        continue;
      }

      const calendarId = getEmployeeCalendarId(
        employee,
        Number(date.slice(0, 4)),
        projects,
        holidayCalendars
      );

      if (!calendarId) continue;

      const calendar = holidayCalendars.find(
        (item) => item.id === calendarId
      );

      if (
        !calendar ||
        calendar.document_status !== "imported"
      ) {
        continue;
      }

      const holiday = calendar.holidays?.find(
        (item) => item.holiday_date.slice(0, 10) === date
      );

      if (
        holiday &&
        (holiday.is_working_day === false ||
          holiday.is_working_day == null)
      ) {
        continue;
      }

      // Normal weekends do not earn credits.
      // Explicitly configured working weekends can earn credits.
      if (
        isWeekend(date) &&
        holiday?.is_working_day !== true
      ) {
        continue;
      }

      const leaves = getEmployeeLeaves(employee.id, date);

      if (leaves.length > 1) {
        continue;
      }

      const log = attendanceMap.get(
        `${employee.id}:${date}`
      );

      let dailyCredit = 0;

      if (log?.status === "present") {
        dailyCredit = 1;
      } else if (log?.status === "half_day") {
        dailyCredit = 0.5;
      }

      if (
        leaves.length === 1 &&
        getCountApprovedLeaves(employee.id)
      ) {
        const leave = leaves[0];

        if (isEligibleLeaveType(leave)) {
          if (!leave.is_half_day) {
            dailyCredit += 1;
          } else {
            const validHalfDay =
              leave.start_date === date &&
              leave.end_date === date &&
              Number(leave.total_days) === 0.5 &&
              ["first_half", "second_half"].includes(
                leave.leave_duration ?? ""
              );

            if (validHalfDay) {
              dailyCredit += 0.5;
            }
          }
        }
      }

      eligible += Math.min(dailyCredit, 1);
    }

    return eligible;
  };

  // Apply the weekly minimum rule to a date.
  // If weekday credits are below 3, ordinary weekend dates
  // become working days. A missing punch on those days is absent.
  const getEmployeeDayResult = (
    employee: Employee,
    date: string
  ): DayResult => {
    const calendarId = getEmployeeCalendarId(
      employee,
      Number(date.slice(0, 4)),
      projects,
      holidayCalendars
    );

    const calendar = holidayCalendars.find(
      (item) => item.id === calendarId
    );

    const holiday = calendar?.holidays?.find(
      (item) => item.holiday_date.slice(0, 10) === date
    );

    const explicitlyWorkingWeekend =
      isWeekend(date) &&
      holiday?.is_working_day === true;

    const weeklyEligibleDays = getWeekEligibleDays(
      employee,
      getWeekStart(date)
    );

    const weeklyMinimumWeekend =
      isWeekend(date) && weeklyEligibleDays < 3;

    const weekendIsWorking =
      explicitlyWorkingWeekend || weeklyMinimumWeekend;

    const result = getDayResult(
      employee,
      date,
      weekendIsWorking
    );

    if (
      weeklyMinimumWeekend &&
      result.status === "No Punch"
    ) {
      return {
        date,
        status: "Absent",
        detail: "Weekly minimum: fewer than 3 eligible days",
      };
    }

    return result;
  };

  const getEmployeeMonthResults = (
    employee: Employee
  ) => {
    return monthDates(selectedMonth).map((date) =>
      getEmployeeDayResult(employee, date)
    );
  };

  // Department options
  const departmentOptions = useMemo(() => {
    const departments = new Map<string, string>();

    employees.forEach((employee) => {
      if (employee.department_id) {
        departments.set(
          employee.department_id,
          employee.department?.name || "Unknown Department"
        );
      }
    });

    return Array.from(departments.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // DAILY EMPLOYEE FILTERING
  // This uses only the Daily department filter.
  const dailyFilteredEmployees = employees.filter((employee) => {
    const matchesDepartment =
      dailyDepartment === "all" ||
      employee.department_id === dailyDepartment;

    return (
      matchesDepartment &&
      isEmployedOnDate(employee, selectedDate)
    );
  });

  // MONTHLY EMPLOYEE FILTERING
  // This uses only Monthly search, department and employee selection.
  const monthlyFilteredEmployees = employees.filter((employee) => {
    const query = search.trim().toLowerCase();

    const fullName =
      `${employee.first_name} ${employee.last_name}`.toLowerCase();

    const employeeCode =
      employee.employee_id?.toLowerCase() ?? "";

    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      employeeCode.includes(query);

    const matchesDepartment =
      monthlyDepartment === "all" ||
      employee.department_id === monthlyDepartment;

    const matchesSelectedEmployee =
      selectedEmployeeId === "all" ||
      employee.id === selectedEmployeeId;

    return (
      matchesSearch &&
      matchesDepartment &&
      matchesSelectedEmployee &&
      isEmployedDuringMonth(employee, selectedMonth)
    );
  });

  // Daily attendance rows
  const dailyAttendanceRows = dailyFilteredEmployees
    .map((employee) => ({
      employee,
      result: getEmployeeDayResult(employee, selectedDate),
    }))
    .filter(({ result }) => {
      if (selectedDailyStatus === "all") return true;
      return result.status === selectedDailyStatus;
    });

  // Daily summary counts
  const dailyStatusCounts = {
    present: dailyFilteredEmployees.filter(
      (employee) =>
        getEmployeeDayResult(employee, selectedDate).status === "Present"
    ).length,

    absent: dailyFilteredEmployees.filter(
      (employee) =>
        getEmployeeDayResult(employee, selectedDate).status === "Absent"
    ).length,

    holiday: dailyFilteredEmployees.filter(
      (employee) =>
        getEmployeeDayResult(employee, selectedDate).status === "Holiday"
    ).length,
  };

  // Monthly attendance rows and totals
  const monthlyRows = monthlyFilteredEmployees.map((employee) => {
    const results = getEmployeeMonthResults(employee);

    const totals = {
      present: results.filter(
        (result) => result.status === "Present"
      ).length,

      halfDay: results.filter(
        (result) => result.status === "Half Day"
      ).length,

      absent: results.filter(
        (result) => result.status === "Absent"
      ).length,

      leave: results.filter(
        (result) => result.status === "Approved Leave"
      ).length,

      holiday: results.filter(
        (result) => result.status === "Holiday"
      ).length,

      weekend: results.filter(
        (result) => result.status === "Weekend"
      ).length,
    };

    return { employee, results, totals };
  });

  const statusClass = (status: ReportStatus) => {
    switch (status) {
      case "Present":
        return "bg-green-100 text-green-800";
      case "Half Day":
        return "bg-yellow-100 text-yellow-800";
      case "Absent":
        return "bg-red-100 text-red-800";
      case "Approved Leave":
        return "bg-blue-100 text-blue-800";
      case "Holiday":
        return "bg-purple-100 text-purple-800";
      case "Weekend":
        return "bg-gray-100 text-gray-600";
      case "No Punch":
        return "bg-orange-100 text-orange-800";
      case "Not Employed":
        return "bg-gray-200 text-gray-600";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const summaryColumnWidth = 64;

  const summaryColumns = [
    { key: "present", label: "Present" },
    { key: "halfDay", label: "Half" },
    { key: "absent", label: "Absent" },
    { key: "leave", label: "Leave" },
    { key: "holiday", label: "Holiday" },
    { key: "weekend", label: "Weekend" },
  ] as const;

  const getSummaryRight = (index: number) =>
    (summaryColumns.length - index - 1) * summaryColumnWidth;

  const clearMonthlyFilters = () => {
    setSearch("");
    setMonthlyDepartment("all");
    setSelectedEmployeeId("all");
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">
            HRMS / Attendance
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Attendance Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor daily and monthly employee attendance.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Report period
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-800">
            {reportView === "daily"
              ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                  "en-IN",
                  { day: "2-digit", month: "short", year: "numeric" }
                )
              : new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString(
                  "en-IN",
                  { month: "long", year: "numeric" }
                )}
          </p>
        </div>
      </div>

      {/* REPORT TABS */}
      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setReportView("daily")}
            className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
              reportView === "daily"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            Daily Attendance
          </button>

          <button
            type="button"
            onClick={() => setReportView("monthly")}
            className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
              reportView === "monthly"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            Monthly Attendance
          </button>
        </div>
      </div>

      {/* DAILY REPORT - ONLY VISIBLE WHEN DAILY TAB IS SELECTED */}
      {reportView === "daily" && (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Daily Attendance Report
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  View employee attendance for a selected date.
                </p>
              </div>

              {/* DAILY FILTERS - INDEPENDENT */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    Select date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) =>
                      setSelectedDate(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    Department
                  </label>
                  <select
                    value={dailyDepartment}
                    onChange={(event) =>
                      setDailyDepartment(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All Departments</option>
                    {departmentOptions.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    Attendance status
                  </label>
                  <select
                    value={selectedDailyStatus}
                    onChange={(event) =>
                      setSelectedDailyStatus(
                        event.target.value as
                          | "all"
                          | "Present"
                          | "Absent"
                          | "Holiday"
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Holiday">On Holiday</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* DAILY SUMMARY */}
          <div className="grid grid-cols-2 gap-3 border-b border-gray-100 bg-gray-50/70 p-5 sm:grid-cols-4 sm:px-6">
            <div className="rounded-xl border border-green-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500">Present</p>
              <p className="mt-2 text-3xl font-bold text-green-700">
                {dailyStatusCounts.present}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Present employees
              </p>
            </div>

            <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500">Absent</p>
              <p className="mt-2 text-3xl font-bold text-red-700">
                {dailyStatusCounts.absent}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Absent employees
              </p>
            </div>

            <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500">
                On Holiday
              </p>
              <p className="mt-2 text-3xl font-bold text-purple-700">
                {dailyStatusCounts.holiday}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Holiday employees
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500">
                Selected Date
              </p>
              <p className="mt-2 text-xl font-bold text-blue-700">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                  "en-IN",
                  { day: "2-digit", month: "short", year: "numeric" }
                )}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {getWeekdayLabel(selectedDate)}
              </p>
            </div>
          </div>

          {/* DAILY TABLE */}
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  Employee Attendance List
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  {dailyAttendanceRows.length} employees displayed
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                {selectedDailyStatus === "all"
                  ? "All statuses"
                  : selectedDailyStatus === "Holiday"
                    ? "On Holiday"
                    : selectedDailyStatus}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {dailyAttendanceRows.map(({ employee, result }) => (
                    <tr
                      key={employee.id}
                      className="transition hover:bg-blue-50/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                        {employee.employee_id}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-semibold text-gray-900">
                          {employee.first_name} {employee.last_name}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {employee.department?.name ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            result.status
                          )}`}
                        >
                          {result.status === "Holiday"
                            ? "On Holiday"
                            : result.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-500">
                        {result.detail || "—"}
                      </td>
                    </tr>
                  ))}

                  {dailyAttendanceRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <p className="text-sm font-semibold text-gray-700">
                          No employees found
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Try selecting another department, status or date.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* MONTHLY REPORT - ONLY VISIBLE WHEN MONTHLY TAB IS SELECTED */}
      {reportView === "monthly" && (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Monthly Attendance Report
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Monthly attendance overview for all employees.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Select month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) =>
                    setSelectedMonth(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* MONTHLY FILTERS - INDEPENDENT */}
          <div className="border-b border-gray-100 bg-gray-50/70 p-5 sm:px-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Search employee
                </label>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSelectedEmployeeId("all");
                  }}
                  placeholder="Search employee name or ID..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Department
                </label>
                <select
                  value={monthlyDepartment}
                  onChange={(event) =>
                    setMonthlyDepartment(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All Departments</option>
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={clearMonthlyFilters}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
              >
                Clear Filters
              </button>
            </div>

            {selectedEmployeeId !== "all" && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="text-xs font-medium text-blue-700">
                  Showing attendance for one selected employee.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeId("all")}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  Show all employees
                </button>
              </div>
            )}
          </div>

          {/* STATUS LEGEND */}
          <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-4 sm:px-6">
            {(
              [
                "Present",
                "Half Day",
                "Absent",
                "Approved Leave",
                "Holiday",
                "Weekend",
                "No Punch",
                "Not Employed",
              ] as ReportStatus[]
            ).map((status) => (
              <span
                key={status}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                  status
                )}`}
              >
                {status === "Not Employed" ? "NE - Not Employed" : status}
              </span>
            ))}
          </div>

          {/* MONTHLY ATTENDANCE MATRIX */}
          <div className="p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  Attendance Overview
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  Click an employee name to filter. Click again to show
                  everyone.
                </p>
              </div>

              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {monthlyRows.length} employees
              </span>
            </div>

            <div className="overflow-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-max table-fixed text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="sticky left-0 z-40 w-[170px] min-w-[170px] border-r border-gray-200 bg-gray-50 px-3 py-3 text-left font-semibold">
                      Employee
                    </th>

                    {monthDates(selectedMonth).map((date) => (
                      <th
                        key={date}
                        className="w-[52px] min-w-[52px] px-2 py-3 text-center"
                      >
                        <div className="text-[10px] font-medium uppercase text-gray-400">
                          {getWeekdayLabel(date)}
                        </div>
                        <div className="mt-1 text-sm font-bold text-gray-700">
                          {Number(date.slice(-2))}
                        </div>
                      </th>
                    ))}

                    {summaryColumns.map((column, index) => (
                      <th
                        key={column.key}
                        style={{
                          right: `${getSummaryRight(index)}px`,
                          width: `${summaryColumnWidth}px`,
                          minWidth: `${summaryColumnWidth}px`,
                        }}
                        className="sticky z-40 bg-gray-100 px-2 py-3 text-center font-semibold shadow-[-1px_0_0_#e5e7eb]"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {monthlyRows.map(({ employee, results, totals }) => (
                    <tr
                      key={employee.id}
                      className="hover:bg-blue-50/30"
                    >
                      <td className="sticky left-0 z-30 min-w-[170px] border-r border-gray-100 bg-white px-3 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeId((current) =>
                              current === employee.id ? "all" : employee.id
                            );
                          }}
                          className={`w-full text-left transition ${
                            selectedEmployeeId === employee.id
                              ? "text-blue-700"
                              : "text-gray-900 hover:text-blue-700"
                          }`}
                          title="Click to filter by this employee"
                        >
                          <div className="font-semibold">
                            {employee.first_name} {employee.last_name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-gray-400">
                            {employee.employee_id}
                          </div>
                        </button>
                      </td>

                      {results.map((result) => {
                        const beforeJoining =
                          Boolean(employee.joining_date) &&
                          result.date < employee.joining_date!;

                        return (
                          <td
                            key={result.date}
                            title={
                              beforeJoining
                                ? `${result.date}: Before joining date`
                                : `${result.date}: ${result.status}${
                                    result.detail
                                      ? ` (${result.detail})`
                                      : ""
                                  }`
                            }
                            className="w-[52px] min-w-[52px] px-1 py-2 text-center"
                          >
                            <span
                              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md text-[10px] font-bold ${
                                beforeJoining
                                  ? "bg-slate-200 text-slate-600"
                                  : statusClass(result.status)
                              }`}
                            >
                              {beforeJoining
                                ? "NE"
                                : result.status === "Present"
                                  ? "P"
                                  : result.status === "Half Day"
                                    ? "HD"
                                    : result.status === "Absent"
                                      ? "A"
                                      : result.status === "Approved Leave"
                                        ? result.detail
                                            ?.replace(/^Half day\s+/i, "")
                                            .toUpperCase() || "AL"
                                        : result.status === "Holiday"
                                          ? "H"
                                          : result.status === "Weekend"
                                            ? "W"
                                            : result.status === "No Punch"
                                              ? "NP"
                                              : result.status === "Future"
                                                ? "—"
                                                : result.status === "Not Employed"
                                                  ? "NE"
                                                  : "!"}
                            </span>
                          </td>
                        );
                      })}

                      {summaryColumns.map((column, index) => (
                        <td
                          key={column.key}
                          style={{
                            right: `${getSummaryRight(index)}px`,
                            width: `${summaryColumnWidth}px`,
                            minWidth: `${summaryColumnWidth}px`,
                          }}
                          className="sticky z-20 bg-white px-2 py-2 text-center shadow-[-1px_0_0_#e5e7eb]"
                        >
                          <span
                            className={
                              column.key === "absent"
                                ? "font-bold text-red-700"
                                : column.key === "present"
                                  ? "font-bold text-green-700"
                                  : "font-semibold text-gray-600"
                            }
                          >
                            {totals[column.key]}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}

                  {monthlyRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={monthDates(selectedMonth).length + 7}
                        className="px-4 py-12 text-center text-sm text-gray-500"
                      >
                        No employees found for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-[11px] leading-5 text-gray-500">
              <strong className="text-gray-700">Legend:</strong> P = Present,
              HD = Half Day, A = Absent, AL = Approved Leave, H = Holiday,
              W = Weekend, NP = No Punch, NE = Not Employed, ! = Review
              required. Dates before joining are marked NE.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
