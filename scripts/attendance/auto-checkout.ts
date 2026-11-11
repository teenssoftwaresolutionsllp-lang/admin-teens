
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const execute = process.argv.includes("--execute");

const DEFAULT_TIMEZONE = "Asia/Kolkata";

type OpenAttendance = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  session_check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | string | null;
  status: string;
  is_regularized: boolean;
};

type EmployeeShiftRecord = {
  id: string;
  project_id: string | null;
  shift_type: string | null;
  retained_shift_start_time: string | null;
  retained_shift_end_time: string | null;
  retained_grace_period_minutes: number | null;
  retained_half_day_cutoff_minutes: number | null;
};

type ProjectShift = {
  id: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  timezone: string | null;
  grace_period_minutes: number | null;
  half_day_cutoff_minutes: number | null;
};

type EffectiveShift = {
  startTime: string;
  endTime: string;
  timezone: string;
};

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function validateDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;

  const date = new Date(`${dateKey}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === dateKey
  );
}

function getLocalParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function zonedDateTimeToUtc(
  dateKey: string,
  time: string,
  timezone: string
): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const targetUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute
  );

  let result = targetUtc;

  for (let i = 0; i < 4; i++) {
    const local = getLocalParts(new Date(result), timezone);

    const representedUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute
    );

    const difference = targetUtc - representedUtc;

    result += difference;

    if (difference === 0) break;
  }

  return new Date(result);
}

function resolveEffectiveShift(
  employee: EmployeeShiftRecord,
  projects: Map<string, ProjectShift>
): EffectiveShift {
  // Priority 1: Assigned project.
  if (employee.project_id) {
    const project = projects.get(employee.project_id);

    if (!project) {
      throw new Error(
        "Assigned project could not be loaded."
      );
    }

    if (!project.shift_start_time || !project.shift_end_time) {
      throw new Error(
        "Project shift start or end time is missing."
      );
    }

    return {
      startTime: project.shift_start_time,
      endTime: project.shift_end_time,
      timezone: project.timezone || DEFAULT_TIMEZONE,
    };
  }

  // Priority 2: Retained project shift for bench employees.
  if (
    employee.retained_shift_start_time &&
    employee.retained_shift_end_time
  ) {
    return {
      startTime: employee.retained_shift_start_time,
      endTime: employee.retained_shift_end_time,
      timezone: DEFAULT_TIMEZONE,
    };
  }

  // Priority 3: Employee-level shift.
  if (employee.shift_type === "night") {
    return {
      startTime: "18:30",
      endTime: "03:30",
      timezone: DEFAULT_TIMEZONE,
    };
  }

  return {
    startTime: "09:00",
    endTime: "18:00",
    timezone: DEFAULT_TIMEZONE,
  };
}

function getScheduledShiftEnd(
  attendanceDate: string,
  shift: EffectiveShift
): Date {
  const startMinutes = parseTime(shift.startTime);
  const endMinutes = parseTime(shift.endTime);

  if (startMinutes === null || endMinutes === null) {
    throw new Error("Invalid configured shift time.");
  }

  const overnight = endMinutes <= startMinutes;

  const endDate = overnight
    ? addDays(attendanceDate, 1)
    : attendanceDate;

  const shiftEnd = zonedDateTimeToUtc(
    endDate,
    shift.endTime,
    shift.timezone
  );

  if (Number.isNaN(shiftEnd.getTime())) {
    throw new Error("Could not calculate scheduled shift end.");
  }

  return shiftEnd;
}

async function main() {
  const now = new Date();

  const { data: openRows, error } = await supabase
    .from("attendance_logs")
    .select(
      "id, employee_id, attendance_date, check_in_time, session_check_in_time, check_out_time, total_hours, status, is_regularized"
    )
    .is("check_out_time", null)
    .not("session_check_in_time", "is", null);

  if (error) throw error;

  const rows = (openRows ?? []) as OpenAttendance[];

  if (rows.length === 0) {
    console.log("No open attendance sessions found.");
    return;
  }

  // Load each employee once.
  const employeeIds = [
    ...new Set(rows.map((row) => row.employee_id)),
  ];

  const { data: employeeRows, error: employeeError } =
    await supabase
      .from("employees")
      .select(
        "id, project_id, shift_type, retained_shift_start_time, retained_shift_end_time, retained_grace_period_minutes, retained_half_day_cutoff_minutes"
      )
      .in("id", employeeIds);

  if (employeeError) throw employeeError;

  const employees = new Map(
    ((employeeRows ?? []) as EmployeeShiftRecord[]).map(
      (employee) => [employee.id, employee]
    )
  );

  // Load all assigned projects once.
  const projectIds = [
    ...new Set(
      [...employees.values()]
        .map((employee) => employee.project_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const projects = new Map<string, ProjectShift>();

  if (projectIds.length > 0) {
    const { data: projectRows, error: projectError } =
      await supabase
        .from("projects")
        .select(
          "id, shift_start_time, shift_end_time, timezone, grace_period_minutes, half_day_cutoff_minutes"
        )
        .in("id", projectIds);

    if (projectError) throw projectError;

    for (const project of (projectRows ?? []) as ProjectShift[]) {
      projects.set(project.id, project);
    }
  }

  let eligible = 0;
  let checkedOut = 0;
  let skipped = 0;
  let reviewRequired = 0;

  for (const row of rows) {
    const log = `${row.employee_id} | ${row.attendance_date}`;

    try {
      if (!row.session_check_in_time) {
        skipped++;
        continue;
      }

      if (row.is_regularized) {
        skipped++;
        console.log(`SKIP: Regularized attendance | ${log}`);
        continue;
      }

      if (!validateDateKey(row.attendance_date)) {
        reviewRequired++;
        console.log(`REVIEW: Invalid attendance date | ${log}`);
        continue;
      }

      const sessionStart = new Date(row.session_check_in_time);

      if (Number.isNaN(sessionStart.getTime())) {
        reviewRequired++;
        console.log(`REVIEW: Invalid session start | ${log}`);
        continue;
      }

      if (sessionStart.getTime() > now.getTime()) {
        reviewRequired++;
        console.log(`REVIEW: Future session start | ${log}`);
        continue;
      }

      const employee = employees.get(row.employee_id);

      if (!employee) {
        reviewRequired++;
        console.log(`REVIEW: Employee not found | ${log}`);
        continue;
      }

      const shift = resolveEffectiveShift(employee, projects);

      // Validate timezone before calculating checkout.
      new Intl.DateTimeFormat("en-US", {
        timeZone: shift.timezone,
      });

      const scheduledEnd = getScheduledShiftEnd(
        row.attendance_date,
        shift
      );

      // Never close a session before its configured shift end.
      // Show diagnostic details for every open session.
      const currentTimeInShiftTimezone = now.toLocaleString("en-IN", {
        timeZone: shift.timezone,
        dateStyle: "medium",
        timeStyle: "medium",
      });

      const scheduledEndInShiftTimezone = scheduledEnd.toLocaleString("en-IN", {
        timeZone: shift.timezone,
        dateStyle: "medium",
        timeStyle: "medium",
      });

      const sessionStartInShiftTimezone = sessionStart.toLocaleString("en-IN", {
        timeZone: shift.timezone,
        dateStyle: "medium",
        timeStyle: "medium",
      });

      console.log(
        `\nCHECK SESSION: ${log}\n` +
        `  Shift: ${shift.startTime}-${shift.endTime}\n` +
        `  Timezone: ${shift.timezone}\n` +
        `  Current time: ${currentTimeInShiftTimezone}\n` +
        `  Session started: ${sessionStartInShiftTimezone}\n` +
        `  Scheduled shift end: ${scheduledEndInShiftTimezone}\n` +
        `  Current UTC: ${now.toISOString()}\n` +
        `  Scheduled end UTC: ${scheduledEnd.toISOString()}`
      );

      // Never close a session before its configured shift end.
      if (now.getTime() < scheduledEnd.getTime()) {
        console.log(`WAIT: Configured shift has not ended | ${log}`);
        continue;
      }

      console.log(`ELIGIBLE: Configured shift has ended | ${log}`);

      // A session started after the scheduled shift end is
      // ambiguous and must be reviewed instead of auto-closed.
      if (sessionStart.getTime() >= scheduledEnd.getTime()) {
        reviewRequired++;
        console.log(
          `REVIEW: Session started at or after shift end | ${log}`
        );
        continue;
      }

      const previousHours = Number(row.total_hours ?? 0);

      if (
        !Number.isFinite(previousHours) ||
        previousHours < 0
      ) {
        reviewRequired++;
        console.log(`REVIEW: Invalid total_hours | ${log}`);
        continue;
      }

      // Add only the actual duration of this open session.
      const elapsedSessionHours =(scheduledEnd.getTime() - sessionStart.getTime()) /(60 * 60 * 1000);

      // Match the existing manual checkout's 9-hour session cap.
      const sessionHours = Math.min(elapsedSessionHours, 9);

      const totalHours = Number(
        (previousHours + sessionHours).toFixed(2)
      );

      if (!Number.isFinite(totalHours)) {
        reviewRequired++;
        console.log(`REVIEW: Invalid calculated hours | ${log}`);
        continue;
      }

      console.log(
        `${execute ? "AUTO CHECKOUT" : "DRY RUN"}: ${log} | ` +
        `Shift: ${shift.startTime}-${shift.endTime} | ` +
        `Timezone: ${shift.timezone} | ` +
        `Session start: ${sessionStart.toISOString()} | ` +
        `Scheduled checkout: ${scheduledEnd.toISOString()} | ` +
        `Session hours: ${sessionHours.toFixed(2)} | ` +
        `Total hours: ${totalHours}`
      );

      eligible++;

      if (!execute) continue;

      // Protect against manual checkout or concurrent job updates.
      const { data: updated, error: updateError } =
        await supabase
          .from("attendance_logs")
          .update({
            check_out_time: scheduledEnd.toISOString(),
            session_check_in_time: null,
            total_hours: totalHours,
          })
          .eq("id", row.id)
          .is("check_out_time", null)
          .eq(
            "session_check_in_time",
            row.session_check_in_time
          )
          .select("id");

      if (updateError) throw updateError;

      if (updated?.length) {
        checkedOut++;
      } else {
        skipped++;
        console.log(
          `SKIP: Session changed before update | ${log}`
        );
      }
    } catch (error) {
      reviewRequired++;

      console.error(
        `REVIEW: ${log} |`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log("\n--- Automatic Checkout Summary ---");
  console.log(`Open sessions found: ${rows.length}`);
  console.log(`Eligible for checkout: ${eligible}`);
  console.log(
    `${execute ? "Automatically checked out" : "Checkout previews"}: ${
      execute ? checkedOut : eligible
    }`
  );
  console.log(`Skipped: ${skipped}`);
  console.log(`Review required: ${reviewRequired}`);
}

main().catch((error) => {
  console.error("Automatic checkout job failed:", error);
  process.exit(1);
});
