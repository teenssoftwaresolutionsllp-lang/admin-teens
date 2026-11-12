
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const execute = process.argv.includes("--execute");
const IST = "Asia/Kolkata";
const ALERT_AFTER_MINUTES = 180;

type Employee = {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  status: string;
  joining_date: string;
  exit_date: string | null;
  planned_last_working_date: string | null;
  project_id: string | null;
  retained_calendar_id: string | null;
  retained_shift_start_time: string | null;
  retained_shift_end_time: string | null;
  shift_type: string | null;
};

type Project = {
  id: string;
  calendar_id: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
};

type Leave = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  leave_duration: string | null;
};

type Attendance = {
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  hr_decision_by: string | null;
  hr_decision_at: string | null;
  status: string | null;
};

type Recipient = {
  id: string;
  role: string;
};

function indiaDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400000);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateAtMinutes(date: string, minutes: number): Date {
  const [year, month, day] = date.split("-").map(Number);

  // Shift times are stored as IST. Convert IST to UTC for comparison.
  return new Date(
    Date.UTC(year, month - 1, day, 0, minutes - 330)
  );
}

function shiftMinutes(
  start: string,
  end: string
): {
  start: number;
  end: number;
  duration: number;
} {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = toMinutes(start);
  let endMinutes = toMinutes(end);

  if (endMinutes <= startMinutes) {
    endMinutes += 1440;
  }

  return {
    start: startMinutes,
    end: endMinutes,
    duration: endMinutes - startMinutes,
  };
}

function formatIndiaTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

async function main() {
  const today = indiaDate();
  const yesterday = indiaDate(-1);
  const dates = [yesterday, today];

  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`India dates checked: ${dates.join(", ")}`);

  // ---------------------------------------------------------
  // 1. FETCH ELIGIBLE EMPLOYEES
  // ---------------------------------------------------------

  const { data: employees, error: employeeError } = await supabase
    .from("employees")
    .select(
      "id, employee_id, first_name, last_name, status, joining_date, exit_date, planned_last_working_date, project_id, retained_calendar_id, retained_shift_start_time, retained_shift_end_time, shift_type"
    )
    .in("status", ["active", "on_notice"])
    .lte("joining_date", today)
    .or(`exit_date.is.null,exit_date.gte.${yesterday}`)
    .order("employee_id");

  if (employeeError) {
    throw employeeError;
  }

  const eligibleEmployees = ((employees ?? []) as Employee[]).filter(
    (employee) =>
      employee.status !== "on_notice" ||
      !employee.planned_last_working_date ||
      employee.planned_last_working_date >= yesterday
  );

  if (!eligibleEmployees.length) {
    console.log("No eligible employees found.");
    return;
  }

  const employeeIds = eligibleEmployees.map((employee) => employee.id);

  const projectIds = [
    ...new Set(
      eligibleEmployees
        .map((employee) => employee.project_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  // ---------------------------------------------------------
  // 2. FETCH PROJECT CALENDAR AND SHIFT SETTINGS
  // ---------------------------------------------------------

  const { data: projects, error: projectError } = projectIds.length
    ? await supabase
        .from("projects")
        .select("id, calendar_id, shift_start_time, shift_end_time")
        .in("id", projectIds)
    : { data: [], error: null };

  if (projectError) {
    throw projectError;
  }

  const projectMap = new Map(
    ((projects ?? []) as Project[]).map((project) => [
      project.id,
      project,
    ])
  );

  // ---------------------------------------------------------
  // 3. FETCH INDIA CALENDARS FOR ALL AVAILABLE YEARS
  // ---------------------------------------------------------

  // A year-specific map is required because this job checks
  // both yesterday and today, which can belong to different years.

  const { data: indiaCalendars, error: indiaCalendarError } =
    await supabase
      .from("holiday_calendars")
      .select("id, shift_type, calendar_year")
      .eq("country_code", "IN");

  if (indiaCalendarError) {
    throw indiaCalendarError;
  }

  const indiaCalendarMap = new Map<string, string>();

  for (const calendar of indiaCalendars ?? []) {
    if (calendar.shift_type && calendar.calendar_year) {
      indiaCalendarMap.set(
        `${calendar.shift_type}:${calendar.calendar_year}`,
        calendar.id
      );
    }
  }

  // ---------------------------------------------------------
  // 4. RESOLVE EMPLOYEE CALENDAR AND SHIFT SETTINGS
  // ---------------------------------------------------------

  const employeeUsesIndiaFallback = new Set<string>();

  const employeeCalendarMap = new Map<string, string | null>();

  const employeeShiftMap = new Map<
    string,
    {
      startTime: string;
      endTime: string;
    }
  >();

  for (const employee of eligibleEmployees) {
    let calendarId: string | null = null;
    let startTime: string | null = null;
    let endTime: string | null = null;

    // Priority 1: Assigned project settings.
    if (employee.project_id) {
      const project = projectMap.get(employee.project_id);

      if (
        project?.calendar_id &&
        project.shift_start_time &&
        project.shift_end_time
      ) {
        calendarId = project.calendar_id;
        startTime = project.shift_start_time;
        endTime = project.shift_end_time;
      }
    }

    // Priority 2: Retained project settings for bench employees.
    else if (
      employee.retained_calendar_id ||
      employee.retained_shift_start_time ||
      employee.retained_shift_end_time
    ) {
      if (
        employee.retained_calendar_id &&
        employee.retained_shift_start_time &&
        employee.retained_shift_end_time
      ) {
        calendarId = employee.retained_calendar_id;
        startTime = employee.retained_shift_start_time;
        endTime = employee.retained_shift_end_time;
      }
    }

    // Priority 3: Employee-level shift and India fallback.
    else {
      employeeUsesIndiaFallback.add(employee.id);

      const shiftType =
        employee.shift_type === "night" ? "night" : "general";

      if (shiftType === "night") {
        startTime = "18:30";
        endTime = "03:30";
      } else {
        startTime = "09:00";
        endTime = "18:00";
      }
    }

    employeeCalendarMap.set(employee.id, calendarId);

    if (startTime && endTime) {
      employeeShiftMap.set(employee.id, {
        startTime,
        endTime,
      });
    }
  }

  // ---------------------------------------------------------
  // 5. COLLECT ALL CALENDARS USED FOR BOTH DATES
  // ---------------------------------------------------------

  const calendarIds = [
    ...new Set(
      [
        // Assigned project and retained calendars.
        ...[...employeeCalendarMap.values()].filter(
          (id): id is string => Boolean(id)
        ),

        // India fallback calendars, separately for each date/year.
        ...eligibleEmployees.flatMap((employee) => {
          if (!employeeUsesIndiaFallback.has(employee.id)) {
            return [];
          }

          const shiftType =
            employee.shift_type === "night" ? "night" : "general";

          return dates
            .map((date) =>
              indiaCalendarMap.get(
                `${shiftType}:${Number(date.slice(0, 4))}`
              )
            )
            .filter((id): id is string => Boolean(id));
        }),
      ]
    ),
  ];

  // ---------------------------------------------------------
  // 6. VERIFY CALENDARS
  // ---------------------------------------------------------

  const { data: calendars, error: calendarError } = calendarIds.length
    ? await supabase
        .from("holiday_calendars")
        .select("id")
        .in("id", calendarIds)
    : { data: [], error: null };

  if (calendarError) {
    throw calendarError;
  }

  const validCalendarIds = new Set(
    (calendars ?? []).map((calendar) => calendar.id)
  );

  // ---------------------------------------------------------
  // 7. FETCH HOLIDAYS FOR BOTH DATES
  // ---------------------------------------------------------

  const { data: holidays, error: holidayError } = calendarIds.length
    ? await supabase
        .from("holidays")
        .select("calendar_id, holiday_date, is_working_day")
        .in("calendar_id", calendarIds)
        .in("holiday_date", dates)
    : { data: [], error: null };

  if (holidayError) {
    throw holidayError;
  }

  const holidayMap = new Map(
    (holidays ?? []).map((holiday) => [
      `${holiday.calendar_id}:${holiday.holiday_date}`,
      holiday.is_working_day,
    ])
  );

  // ---------------------------------------------------------
  // 8. FETCH EXISTING ATTENDANCE
  // ---------------------------------------------------------

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance_logs")
    .select(
      "employee_id, attendance_date, check_in_time, hr_decision_by, hr_decision_at, status"
    )
    .in("employee_id", employeeIds)
    .in("attendance_date", dates);

  if (attendanceError) {
    throw attendanceError;
  }

  const attendanceMap = new Map(
    ((attendance ?? []) as Attendance[]).map((row) => [
      `${row.employee_id}:${row.attendance_date}`,
      row,
    ])
  );

  // ---------------------------------------------------------
  // 9. FETCH APPROVED LEAVES
  // ---------------------------------------------------------

  const { data: leaves, error: leaveError } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, start_date, end_date, total_days, is_half_day, leave_duration"
    )
    .in("employee_id", employeeIds)
    .eq("status", "approved")
    .lte("start_date", today)
    .gte("end_date", yesterday);

  if (leaveError) {
    throw leaveError;
  }

  const leaveRows = (leaves ?? []) as Leave[];

  // ---------------------------------------------------------
  // 10. FETCH HR AND CEO NOTIFICATION RECIPIENTS
  // ---------------------------------------------------------

  const { data: recipients, error: recipientError } = await supabase
    .from("profiles")
    .select("id, role")
    .in("role", ["hr", "ceo"]);

  if (recipientError) {
    throw recipientError;
  }

  const recipientRows = (recipients ?? []) as Recipient[];

  if (!recipientRows.length) {
    console.log("No HR/CEO notification recipients found.");
    return;
  }

  // ---------------------------------------------------------
  // 11. PROCESS EMPLOYEES AND ATTENDANCE DATES
  // ---------------------------------------------------------

  let checked = 0;
  let skipped = 0;
  let created = 0;

  for (const employee of eligibleEmployees) {
    const shiftConfig = employeeShiftMap.get(employee.id);

    if (!shiftConfig) {
      console.log(
        `REVIEW: ${employee.employee_id} has missing shift settings.`
      );
      skipped++;
      continue;
    }

    const shiftStart = shiftConfig.startTime;
    const shiftEnd = shiftConfig.endTime;
    const shift = shiftMinutes(shiftStart, shiftEnd);

    for (const date of dates) {
      // Employee joining-date check.
      if (date < employee.joining_date) {
        continue;
      }

      // Employee exit-date check.
      if (employee.exit_date && date > employee.exit_date) {
        continue;
      }

      // Notice-period last-working-date check.
      if (
        employee.status === "on_notice" &&
        employee.planned_last_working_date &&
        date > employee.planned_last_working_date
      ) {
        continue;
      }

      // Resolve the calendar for this specific attendance date.
      // Project and retained calendars always retain priority.
      const calendarId = employeeUsesIndiaFallback.has(employee.id)
        ? indiaCalendarMap.get(
            `${
              employee.shift_type === "night" ? "night" : "general"
            }:${Number(date.slice(0, 4))}`
          ) ?? null
        : employeeCalendarMap.get(employee.id) ?? null;

      if (!calendarId || !validCalendarIds.has(calendarId)) {
        console.log(
          `REVIEW: ${employee.employee_id} has missing or invalid calendar settings for ${date}.`
        );
        skipped++;
        continue;
      }

      // -----------------------------------------------------
      // CHECK HOLIDAY / WORKING DAY
      // -----------------------------------------------------

      const holidayKey = `${calendarId}:${date}`;
      const holidayValue = holidayMap.get(holidayKey);

      if (
        holidayValue === false ||
        holidayValue === null ||
        (holidayValue === undefined && isWeekend(date))
      ) {
        skipped++;
        continue;
      }

      // No holiday row on a normal weekday means normal working day.

      // -----------------------------------------------------
      // CHECK EXISTING ATTENDANCE
      // -----------------------------------------------------

      const attendanceRow = attendanceMap.get(
        `${employee.id}:${date}`
      );

      if (
        attendanceRow?.check_in_time ||
        attendanceRow?.hr_decision_by ||
        attendanceRow?.hr_decision_at ||
        (attendanceRow?.status &&
          [
            "present",
            "absent",
            "half_day",
            "on_leave",
            "holiday",
            "weekend",
          ].includes(attendanceRow.status))
      ) {
        skipped++;
        continue;
      }

      // -----------------------------------------------------
      // CHECK APPROVED LEAVES
      // -----------------------------------------------------

      const dayLeaves = leaveRows.filter(
        (leave) =>
          leave.employee_id === employee.id &&
          leave.start_date <= date &&
          leave.end_date >= date
      );

      if (dayLeaves.length > 1) {
        console.log(
          `REVIEW: overlapping approved leaves for ${employee.employee_id} on ${date}.`
        );
        skipped++;
        continue;
      }

      let thresholdMinutes = shift.start + ALERT_AFTER_MINUTES;

      if (dayLeaves.length === 1) {
        const leave = dayLeaves[0];

        // Full-day leave: no missing-punch alert.
        if (!leave.is_half_day || Number(leave.total_days) >= 1) {
          skipped++;
          continue;
        }

        // Validate half-day leave.
        if (
          leave.start_date !== date ||
          leave.end_date !== date ||
          Number(leave.total_days) !== 0.5
        ) {
          console.log(
            `REVIEW: malformed half-day leave for ${employee.employee_id} on ${date}.`
          );
          skipped++;
          continue;
        }

        if (leave.leave_duration === "first_half") {
          thresholdMinutes =
            shift.start +
            Math.floor(shift.duration / 2) +
            ALERT_AFTER_MINUTES;
        } else if (leave.leave_duration === "second_half") {
          thresholdMinutes = shift.start + ALERT_AFTER_MINUTES;
        } else {
          console.log(
            `REVIEW: legacy half-day leave without duration for ${employee.employee_id} on ${date}.`
          );
          skipped++;
          continue;
        }
      }

      // -----------------------------------------------------
      // CHECK 3-HOUR ALERT THRESHOLD
      // -----------------------------------------------------

      const threshold = dateAtMinutes(date, thresholdMinutes);

      if (Date.now() < threshold.getTime()) {
        continue;
      }

      checked++;

      // -----------------------------------------------------
      // PREPARE NOTIFICATION
      // -----------------------------------------------------

      const title = "Missing Punch-In Alert";

      const message =
        `${employee.first_name} ${employee.last_name} (${employee.employee_id}) ` +
        `has not punched in for the ${shiftStart}–${shiftEnd} IST shift on ${date}. ` +
        `The 3-hour alert threshold was ${formatIndiaTime(threshold)} IST.`;

      console.log(
        `${execute ? "QUEUE" : "DRY RUN"}: ${employee.employee_id} | ${date} | ${message}`
      );

      // -----------------------------------------------------
      // INSERT NOTIFICATIONS FOR HR AND CEO
      // -----------------------------------------------------

      for (const recipient of recipientRows) {
        const { data: existing, error: duplicateError } = await supabase
          .from("notifications")
          .select("id")
          .eq("employee_id", employee.id)
          .eq("recipient_user_id", recipient.id)
          .eq("title", title)
          .eq("message", message)
          .limit(1);

        if (duplicateError) {
          throw duplicateError;
        }

        // Prevent duplicate notifications.
        if (existing?.length) {
          continue;
        }

        if (execute) {
          const { error: insertError } = await supabase
            .from("notifications")
            .insert({
              employee_id: employee.id,
              recipient_user_id: recipient.id,
              title,
              message,
              type: "attendance",
              is_read: false,
            });

          if (insertError) {
            throw insertError;
          }
        }

        created++;
      }
    }
  }

  // ---------------------------------------------------------
  // 12. SUMMARY
  // ---------------------------------------------------------

  console.log("--- Summary ---");
  console.log(`Employees: ${eligibleEmployees.length}`);
  console.log(`Alert candidates checked: ${checked}`);
  console.log(`Skipped checks: ${skipped}`);
  console.log(
    `${execute ? "Notifications inserted" : "Notifications previewed"}: ${created}`
  );
}

main().catch((error) => {
  console.error("Missing-punch notification job failed:", error);
  process.exit(1);
});
