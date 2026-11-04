import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultCalendarId = process.env.DEFAULT_HOLIDAY_CALENDAR_ID;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
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
};

type Project = {
  id: string;
  calendar_id: string | null;
  shift_start_time: string;
  shift_end_time: string;
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

function shiftMinutes(start: string, end: string): {
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

  if (endMinutes <= startMinutes) endMinutes += 1440;

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

  const { data: employees, error: employeeError } = await supabase
    .from("employees")
    .select(
      "id, employee_id, first_name, last_name, status, joining_date, exit_date, planned_last_working_date, project_id"
    )
    .in("status", ["active", "on_notice"])
    .lte("joining_date", today)
    .or(`exit_date.is.null,exit_date.gte.${yesterday}`)
    .order("employee_id");

  if (employeeError) throw employeeError;

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

  const { data: projects, error: projectError } = projectIds.length
    ? await supabase
        .from("projects")
        .select("id, calendar_id, shift_start_time, shift_end_time")
        .in("id", projectIds)
    : { data: [], error: null };

  if (projectError) throw projectError;

  const projectMap = new Map(
    ((projects ?? []) as Project[]).map((project) => [
      project.id,
      project,
    ])
  );

  const calendarIds = [
    ...new Set(
      eligibleEmployees.map((employee) =>
        employee.project_id
          ? projectMap.get(employee.project_id)?.calendar_id ?? null
          : defaultCalendarId ?? null
      ).filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: calendars, error: calendarError } = calendarIds.length
    ? await supabase
        .from("holiday_calendars")
        .select("id")
        .in("id", calendarIds)
    : { data: [], error: null };

  if (calendarError) throw calendarError;

  const validCalendarIds = new Set(
    (calendars ?? []).map((calendar) => calendar.id)
  );

  const { data: holidays, error: holidayError } = calendarIds.length
    ? await supabase
        .from("holidays")
        .select("calendar_id, holiday_date, is_working_day")
        .in("calendar_id", calendarIds)
        .in("holiday_date", dates)
    : { data: [], error: null };

  if (holidayError) throw holidayError;

  const holidayMap = new Map(
    (holidays ?? []).map((holiday) => [
      `${holiday.calendar_id}:${holiday.holiday_date}`,
      holiday.is_working_day,
    ])
  );

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance_logs")
    .select(
      "employee_id, attendance_date, check_in_time, hr_decision_by, hr_decision_at"
    )
    .in("employee_id", employeeIds)
    .in("attendance_date", dates);

  if (attendanceError) throw attendanceError;

  const attendanceMap = new Map(
    ((attendance ?? []) as Attendance[]).map((row) => [
      `${row.employee_id}:${row.attendance_date}`,
      row,
    ])
  );

  const { data: leaves, error: leaveError } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, start_date, end_date, total_days, is_half_day, leave_duration"
    )
    .in("employee_id", employeeIds)
    .eq("status", "approved")
    .lte("start_date", today)
    .gte("end_date", yesterday);

  if (leaveError) throw leaveError;

  const leaveRows = (leaves ?? []) as Leave[];

  const { data: recipients, error: recipientError } = await supabase
    .from("profiles")
    .select("id, role")
    .in("role", ["hr", "ceo"]);

  if (recipientError) throw recipientError;

  const recipientRows = (recipients ?? []) as Recipient[];

  if (!recipientRows.length) {
    console.log("No HR/CEO notification recipients found.");
    return;
  }

  let checked = 0;
  let skipped = 0;
  let created = 0;

  for (const employee of eligibleEmployees) {
    const project = employee.project_id
      ? projectMap.get(employee.project_id)
      : null;

    if (employee.project_id && !project) {
      console.log(`REVIEW: ${employee.employee_id} has missing project data.`);
      skipped++;
      continue;
    }

    const shiftStart = project?.shift_start_time ?? "09:00";
    const shiftEnd = project?.shift_end_time ?? "18:00";
    const shift = shiftMinutes(shiftStart, shiftEnd);

    const calendarId = employee.project_id
      ? project?.calendar_id ?? null
      : defaultCalendarId ?? null;

    if (!calendarId || !validCalendarIds.has(calendarId)) {
      console.log(`REVIEW: ${employee.employee_id} has no valid holiday calendar.`);
      skipped++;
      continue;
    }

    for (const date of dates) {
      if (date < employee.joining_date) continue;
      if (employee.exit_date && date > employee.exit_date) continue;

      if (
        employee.status === "on_notice" &&
        employee.planned_last_working_date &&
        date > employee.planned_last_working_date
      ) continue;

      const holidayKey = `${calendarId}:${date}`;
      const holidayValue = holidayMap.get(holidayKey);

      if (holidayValue === false || holidayValue === null || (holidayValue === undefined && isWeekend(date))) {
        skipped++;
        continue;
      }

      if (holidayValue === undefined && !isWeekend(date)) {
        // No holiday row on a normal working day.
      }

      const attendanceRow = attendanceMap.get(`${employee.id}:${date}`);

      if (
        attendanceRow?.check_in_time ||
        attendanceRow?.hr_decision_by ||
        attendanceRow?.hr_decision_at
      ) {
        skipped++;
        continue;
      }

      const dayLeaves = leaveRows.filter(
        (leave) =>
          leave.employee_id === employee.id &&
          leave.start_date <= date &&
          leave.end_date >= date
      );

      if (dayLeaves.length > 1) {
        console.log(`REVIEW: overlapping approved leaves for ${employee.employee_id} on ${date}.`);
        skipped++;
        continue;
      }

      let thresholdMinutes = shift.start + ALERT_AFTER_MINUTES;

      if (dayLeaves.length === 1) {
        const leave = dayLeaves[0];

        if (!leave.is_half_day || Number(leave.total_days) >= 1) {
          skipped++;
          continue;
        }

        if (
          leave.start_date !== date ||
          leave.end_date !== date ||
          Number(leave.total_days) !== 0.5
        ) {
          console.log(`REVIEW: malformed half-day leave for ${employee.employee_id} on ${date}.`);
          skipped++;
          continue;
        }

        if (leave.leave_duration === "first_half") {
          thresholdMinutes =
            shift.start + Math.floor(shift.duration / 2) + ALERT_AFTER_MINUTES;
        } else if (leave.leave_duration === "second_half") {
          thresholdMinutes = shift.start + ALERT_AFTER_MINUTES;
        } else {
          console.log(`REVIEW: legacy half-day leave without duration for ${employee.employee_id} on ${date}.`);
          skipped++;
          continue;
        }
      }

      const threshold = dateAtMinutes(date, thresholdMinutes);
      if (Date.now() < threshold.getTime()) continue;

      checked++;

      const title = "Missing Punch-In Alert";
      const message =
        `${employee.first_name} ${employee.last_name} (${employee.employee_id}) ` +
        `has not punched in for the ${shiftStart}–${shiftEnd} IST shift on ${date}. ` +
        `The 3-hour alert threshold was ${formatIndiaTime(threshold)} IST.`;

      console.log(
        `${execute ? "QUEUE" : "DRY RUN"}: ${employee.employee_id} | ${date} | ${message}`
      );

      for (const recipient of recipientRows) {
        const { data: existing, error: duplicateError } = await supabase
          .from("notifications")
          .select("id")
          .eq("employee_id", employee.id)
          .eq("recipient_user_id", recipient.id)
          .eq("title", title)
          .eq("message", message)
          .limit(1);

        if (duplicateError) throw duplicateError;

        if (existing?.length) continue;

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

          if (insertError) throw insertError;
        }

        created++;
      }
    }
  }

  console.log("--- Summary ---");
  console.log(`Employees: ${eligibleEmployees.length}`);
  console.log(`Alert candidates checked: ${checked}`);
  console.log(`Skipped checks: ${skipped}`);
  console.log(`${execute ? "Notifications inserted" : "Notifications previewed"}: ${created}`);
}

main().catch((error) => {
  console.error("Missing-punch notification job failed:", error);
  process.exit(1);
});
