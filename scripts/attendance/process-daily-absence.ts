import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultCalendarId = process.env.DEFAULT_HOLIDAY_CALENDAR_ID;

const execute = process.argv.includes("--execute");
const dateArgument = process.argv.find((arg) => arg.startsWith("--date="));

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Employee = {
  id: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  joining_date: string;
  exit_date: string | null;
  planned_last_working_date: string | null;
  project_id: string | null;
};

type AttendanceRow = {
  employee_id: string;
  attendance_date: string;
  status: string;
};

type LeaveRow = {
  id: string;
  employee_id: string;
  is_half_day: boolean;
  start_date: string;
  end_date: string;
  total_days: number | string | null;
};

type InsertRow = {
  employee_id: string;
  attendance_date: string;
  status: "absent" | "half_day";
  is_late: boolean;
  is_regularized: boolean;
  absence_marked_at: string;
  absence_reason: string;
};

function indiaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function previousIndiaDate(): string {
  const today = indiaDate();
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function employeeName(employee: Employee): string {
  return (
    [employee.first_name, employee.last_name]
      .filter(Boolean)
      .join(" ") || employee.employee_id
  );
}

async function main() {
  const attendanceDate = dateArgument
    ? dateArgument.replace("--date=", "")
    : previousIndiaDate();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
    throw new Error(`Invalid attendance date: ${attendanceDate}`);
  }

  if (attendanceDate >= indiaDate()) {
    throw new Error("Only previous dates can be processed.");
  }

  if (!defaultCalendarId) {
    throw new Error("Missing DEFAULT_HOLIDAY_CALENDAR_ID.");
  }

  console.log("====================================");
  console.log("DAILY ATTENDANCE ABSENCE PROCESS");
  console.log("====================================");
  console.log(`India date: ${indiaDate()}`);
  console.log(`Attendance date: ${attendanceDate}`);
  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN"}`);

  // 1. Fetch eligible employees.
  const { data: employees, error: employeeError } = await supabase
    .from("employees")
    .select(
      "id, employee_id, first_name, last_name, status, joining_date, exit_date, planned_last_working_date, project_id"
    )
    .in("status", ["active", "on_notice"])
    .lte("joining_date", attendanceDate)
    .or(`exit_date.is.null,exit_date.gte.${attendanceDate}`)
    .order("employee_id");

  if (employeeError) {
    throw new Error(`Employee query failed: ${employeeError.message}`);
  }

  const eligibleEmployees = (employees ?? []).filter((employee) => {
    if (
      employee.status === "on_notice" &&
      employee.planned_last_working_date &&
      employee.planned_last_working_date < attendanceDate
    ) {
      return false;
    }

    return true;
  }) as Employee[];

  console.log(`Eligible employees: ${eligibleEmployees.length}`);

  if (eligibleEmployees.length === 0) {
    console.log("No eligible employees. Job finished.");
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

  // 2. Resolve project calendars.
  const projectCalendarMap = new Map<string, string>();

  if (projectIds.length > 0) {
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id, calendar_id")
      .in("id", projectIds);

    if (projectError) {
      throw new Error(`Project query failed: ${projectError.message}`);
    }

    for (const project of projects ?? []) {
      if (project.calendar_id) {
        projectCalendarMap.set(project.id, project.calendar_id);
      }
    }
  }

  const employeeCalendarMap = new Map<string, string | null>();

  for (const employee of eligibleEmployees) {
    const calendarId = employee.project_id
      ? projectCalendarMap.get(employee.project_id) ?? null
      : defaultCalendarId;

    employeeCalendarMap.set(employee.id, calendarId);
  }

  const calendarIds = [
    ...new Set(
      [...employeeCalendarMap.values()].filter(
        (id): id is string => Boolean(id)
      )
    ),
  ];

  // Verify that all referenced calendars actually exist.
  const validCalendarIds = new Set<string>();

  if (calendarIds.length > 0) {
    const { data: calendars, error: calendarError } = await supabase
      .from("holiday_calendars")
      .select("id")
      .in("id", calendarIds);

    if (calendarError) {
      throw new Error(`Calendar query failed: ${calendarError.message}`);
    }

    for (const calendar of calendars ?? []) {
      validCalendarIds.add(calendar.id);
    }
  }

  // 3. Fetch holidays for the target date.
  const holidayMap = new Map<
    string,
    { is_working_day: boolean | null }
  >();

  if (calendarIds.length > 0) {
    const { data: holidays, error: holidayError } = await supabase
      .from("holidays")
      .select("calendar_id, is_working_day")
      .in("calendar_id", calendarIds)
      .eq("holiday_date", attendanceDate);

    if (holidayError) {
      throw new Error(`Holiday query failed: ${holidayError.message}`);
    }

    for (const holiday of holidays ?? []) {
      holidayMap.set(holiday.calendar_id, {
        is_working_day: holiday.is_working_day,
      });
    }
  }

  // 4. Fetch existing attendance.
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance_logs")
    .select("employee_id, attendance_date, status")
    .in("employee_id", employeeIds)
    .eq("attendance_date", attendanceDate);

  if (attendanceError) {
    throw new Error(
      `Attendance query failed: ${attendanceError.message}`
    );
  }

  const attendanceMap = new Map<string, AttendanceRow>();

  for (const row of attendance ?? []) {
    attendanceMap.set(row.employee_id, row);
  }

  // 5. Fetch approved leave overlapping the target date.
  const { data: leaves, error: leaveError } = await supabase
    .from("leave_requests")
    .select("id, employee_id, is_half_day, start_date, end_date, total_days")
    .in("employee_id", employeeIds)
    .eq("status", "approved")
    .lte("start_date", attendanceDate)
    .gte("end_date", attendanceDate);

  if (leaveError) {
    throw new Error(`Leave query failed: ${leaveError.message}`);
  }

  const leaveMap = new Map<string, LeaveRow[]>();

  for (const leave of leaves ?? []) {
    const existing = leaveMap.get(leave.employee_id) ?? [];
    existing.push(leave);
    leaveMap.set(leave.employee_id, existing);
  }

  // 6. Classify employees.
  const insertRows: InsertRow[] = [];

  let skippedExisting = 0;
  let skippedNonWorking = 0;
  let skippedFullDayLeave = 0;
  let reviewRequired = 0;

  const markedAt = new Date().toISOString();

  for (const employee of eligibleEmployees) {
    const name = employeeName(employee);
    const existingAttendance = attendanceMap.get(employee.id);

    if (existingAttendance) {
      skippedExisting++;
      console.log(
        `PRESERVE: ${name} already has ${existingAttendance.status}.`
      );
      continue;
    }

    const calendarId = employeeCalendarMap.get(employee.id);

    if (!calendarId || !validCalendarIds.has(calendarId)) {
      reviewRequired++;
      console.log(`REVIEW: ${name} has no valid holiday calendar.`);
      continue;
    }

    const holiday = holidayMap.get(calendarId);

    if (
      holiday &&
      (holiday.is_working_day === false ||
        holiday.is_working_day === null)
    ) {
      skippedNonWorking++;
      console.log(`SKIP: ${name} has a non-working holiday.`);
      continue;
    }

    if (!holiday && isWeekend(attendanceDate)) {
      skippedNonWorking++;
      continue;
    }

    const approvedLeaves = leaveMap.get(employee.id) ?? [];

    if (approvedLeaves.length > 1) {
      reviewRequired++;
      console.log(
        `REVIEW: ${name} has ${approvedLeaves.length} overlapping approved leave requests.`
      );
      continue;
    }
    if (approvedLeaves.length === 1) {
        const leave = approvedLeaves[0];

        // Full-day approved leave: do not mark absent.
        if (!leave.is_half_day) {
            skippedFullDayLeave++;
            console.log(`SKIP: ${name} has approved full-day leave.`);
            continue;
        }

        // Half-day leave is automatic only when it covers exactly
        // one date and the approved duration is exactly 0.5 day.
        const isValidSingleDayHalfLeave =
            leave.start_date === attendanceDate &&
            leave.end_date === attendanceDate &&
            Number(leave.total_days) === 0.5;

        if (!isValidSingleDayHalfLeave) {
            reviewRequired++;
            console.log(
            `REVIEW: ${name} has an ambiguous multi-day or invalid half-day leave request.`
            );
            continue;
        }

        insertRows.push({
            employee_id: employee.id,
            attendance_date: attendanceDate,
            status: "half_day",
            is_late: false,
            is_regularized: false,
            absence_marked_at: markedAt,
            absence_reason:
            "Approved single-day half-day leave; no attendance punch.",
        });

        console.log(`HALF DAY: ${name}`);
        continue;
    }

    insertRows.push({
      employee_id: employee.id,
      attendance_date: attendanceDate,
      status: "absent",
      is_late: false,
      is_regularized: false,
      absence_marked_at: markedAt,
      absence_reason:
        "No attendance or approved leave on working day.",
    });

    console.log(`ABSENT: ${name}`);
  }

  const absentCandidates = insertRows.filter(
    (row) => row.status === "absent"
  ).length;

  const halfDayCandidates = insertRows.filter(
    (row) => row.status === "half_day"
  ).length;

  console.log("------------------------------------");
  console.log(`Absent candidates: ${absentCandidates}`);
  console.log(`Half-day candidates: ${halfDayCandidates}`);
  console.log(`Existing attendance preserved: ${skippedExisting}`);
  console.log(`Non-working days skipped: ${skippedNonWorking}`);
  console.log(`Full-day leave skipped: ${skippedFullDayLeave}`);
  console.log(`Review required: ${reviewRequired}`);

  if (!execute) {
    console.log("------------------------------------");
    console.log("DRY RUN: No attendance or notifications inserted.");
    return;
  }

  // 7. Insert attendance without overwriting existing records.
  if (insertRows.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("attendance_logs")
      .upsert(insertRows, {
        onConflict: "employee_id,attendance_date",
        ignoreDuplicates: true,
      })
      .select("employee_id, status");

    if (insertError) {
      throw new Error(
        `Attendance insertion failed: ${insertError.message}`
      );
    }

    const inserted = insertedRows ?? [];

    console.log(
      `Actually inserted absent: ${
        inserted.filter((row) => row.status === "absent").length
      }`
    );

    console.log(
      `Actually inserted half-day: ${
        inserted.filter((row) => row.status === "half_day").length
      }`
    );
  } else {
    console.log("No new attendance records to insert.");
  }

  // 8. Build the notification summary from attendance records
  // created by this automation. This also supports notification retries.
  const automationReasons = [
    "No attendance or approved leave on working day.",
    "Approved single-day half-day leave; no attendance punch.",
  ];

  const { data: automatedAttendance, error: summaryError } = await supabase
    .from("attendance_logs")
    .select("status")
    .eq("attendance_date", attendanceDate)
    .not("absence_marked_at", "is", null)
    .in("absence_reason", automationReasons);

  if (summaryError) {
    throw new Error(
      `Could not fetch automated attendance summary: ${summaryError.message}`
    );
  }

  const summaryRows = automatedAttendance ?? [];

  const summaryAbsent = summaryRows.filter(
    (row) => row.status === "absent"
  ).length;

  const summaryHalfDay = summaryRows.filter(
    (row) => row.status === "half_day"
  ).length;

  if (summaryRows.length > 0) {
    const { data: recipients, error: recipientError } = await supabase
      .from("profiles")
      .select("id, role")
      .in("role", ["hr", "ceo"]);

    if (recipientError) {
      throw new Error(
        `Could not fetch HR/CEO recipients: ${recipientError.message}`
      );
    }

    const title = "Daily Attendance Absence Summary";
    const type = "attendance_absence";
    const message =
      `${summaryAbsent} employee(s) marked absent and ` +
      `${summaryHalfDay} employee(s) marked half-day for ${attendanceDate}.`;

    const recipientIds = (recipients ?? []).map(
      (recipient) => recipient.id
    );

    if (recipientIds.length > 0) {
      // Check whether this exact daily summary already exists.
      const { data: existingNotifications, error: existingError } =
        await supabase
          .from("notifications")
          .select("recipient_user_id")
          .eq("title", title)
          .eq("type", type)
          .eq("message", message)
          .in("recipient_user_id", recipientIds);

      if (existingError) {
        throw new Error(
          `Could not check existing notifications: ${existingError.message}`
        );
      }

      const alreadyNotified = new Set(
        (existingNotifications ?? []).map(
          (notification) => notification.recipient_user_id
        )
      );

      const notificationRows = (recipients ?? [])
        .filter((recipient) => !alreadyNotified.has(recipient.id))
        .map((recipient) => ({
          employee_id: null,
          recipient_user_id: recipient.id,
          title,
          message,
          type,
          is_read: false,
        }));

      if (notificationRows.length > 0) {
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notificationRows);

        if (notificationError) {
          throw new Error(
            `Attendance was processed, but notifications failed: ${notificationError.message}`
          );
        }

        console.log(
          `Created ${notificationRows.length} HR/CEO notification(s).`
        );
      } else {
        console.log(
          "HR/CEO notifications already exist. No duplicates created."
        );
      }
    } else {
      console.warn("No HR or CEO profiles found for notifications.");
    }
  } else {
    console.log(
      "No automation-created attendance records found for notification."
    );
  }

  console.log("Daily attendance job finished.");

}

main().catch((error: unknown) => {
  console.error(
    "Daily attendance job failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
