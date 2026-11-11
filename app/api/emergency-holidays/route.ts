
import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";

type HolidayScope = "company" | "project";

interface AffectedEmployee {
  id: string;
  user_id: string | null;
  project_id: string | null;
  retained_project_id: string | null;
  status: string;
  joining_date: string | null;
  planned_last_working_date: string | null;
}

interface EmergencyHolidayRow {
  id: string;
  holiday_date: string;
  title: string;
  reason: string | null;
  scope: HolidayScope;
  project_id: string | null;
  status: string;
}

interface EmergencyHolidayInsert {
  calendar_id: null;
  holiday_date: string;
  title: string;
  is_optional: boolean;
  is_working_day: boolean;
  holiday_type: "emergency";
  scope: HolidayScope;
  project_id: string | null;
  reason: string;
  status: "active";
  created_by: string;
}

async function authorizeHrOrCeo() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  const admin = await createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !["hr", "ceo"].includes(String(profile.role).toLowerCase())
  ) {
    return {
      error: NextResponse.json(
        {
          error: "Only HR and CEO can manage emergency holidays.",
        },
        { status: 403 }
      ),
    };
  }

  return { admin, user };
}

function isValidDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isEligibleOnDate(
  employee: AffectedEmployee,
  holidayDate: string
): boolean {
  if (!["active", "on_notice"].includes(employee.status)) {
    return false;
  }

  if (
    employee.joining_date &&
    employee.joining_date > holidayDate
  ) {
    return false;
  }

  if (
    employee.planned_last_working_date &&
    employee.planned_last_working_date < holidayDate
  ) {
    return false;
  }

  return true;
}

async function getAffectedEmployees(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  holiday: Pick<
    EmergencyHolidayRow,
    "holiday_date" | "scope" | "project_id"
  >
): Promise<AffectedEmployee[]> {
  const { data, error } = await admin
    .from("employees")
    .select(
      "id, user_id, project_id, retained_project_id, status, joining_date, planned_last_working_date"
    );

  if (error) {
    throw new Error(
      `Unable to load employees: ${error.message}`
    );
  }

  const employees = (data || []) as unknown as AffectedEmployee[];

  return employees.filter((employee) => {
    if (!isEligibleOnDate(employee, holiday.holiday_date)) {
      return false;
    }

    if (holiday.scope === "company") {
      return true;
    }

    // Assigned project takes precedence.
    // Bench employees use their retained project.
    const effectiveProjectId =
      employee.project_id || employee.retained_project_id;

    return effectiveProjectId === holiday.project_id;
  });
}

async function notifyEmployees(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  employees: AffectedEmployee[],
  title: string,
  message: string
) {
  let sent = 0;
  let failed = 0;

  for (const employee of employees) {
    // Avoid duplicate notifications for the same employee and message.
    const { data: existing, error: lookupError } = await admin
      .from("notifications")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("title", title)
      .eq("message", message)
      .limit(1);

    if (lookupError) {
      failed += 1;

      console.error(
        "Emergency holiday notification lookup failed:",
        lookupError.message
      );

      continue;
    }

    if (existing && existing.length > 0) {
      continue;
    }

    const { error: insertError } = await admin
      .from("notifications")
      .insert({
        employee_id: employee.id,
        recipient_user_id: employee.user_id || null,
        title,
        message,
        type: "emergency_holiday",
        is_read: false,
      });

    if (insertError) {
      failed += 1;

      console.error(
        "Emergency holiday notification failed:",
        insertError.message
      );
    } else {
      sent += 1;
    }
  }

  return { sent, failed };
}

// =========================================================
// CREATE EMERGENCY HOLIDAY
// =========================================================

export async function POST(request: Request) {
  const auth = await authorizeHrOrCeo();

  if ("error" in auth) {
    return auth.error;
  }

  const { admin, user } = auth;

  try {
    const body = await request.json();

    const holidayDate = body.holiday_date;

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    const scope = body.scope as HolidayScope;

    if (!isValidDate(holidayDate)) {
      return NextResponse.json(
        { error: "Please provide a valid holiday date." },
        { status: 400 }
      );
    }

    if (!title || title.length > 150) {
      return NextResponse.json(
        {
          error: "Holiday title must contain 1–150 characters.",
        },
        { status: 400 }
      );
    }

    if (!reason || reason.length > 1000) {
      return NextResponse.json(
        {
          error:
            "Reason is required and must not exceed 1000 characters.",
        },
        { status: 400 }
      );
    }

    if (!["company", "project"].includes(scope)) {
      return NextResponse.json(
        { error: "Invalid holiday scope." },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // VALIDATE PROJECT IDS
    // -----------------------------------------------------

    let projectIds: string[] = [];

    if (scope === "project") {
      if (!Array.isArray(body.project_ids)) {
        return NextResponse.json(
          { error: "Select at least one project." },
          { status: 400 }
        );
      }

      const selectedProjectIds: string[] =
        body.project_ids.filter(
          (id: unknown): id is string =>
            typeof id === "string" &&
            id.trim().length > 0
        );

      projectIds = Array.from(
        new Set<string>(selectedProjectIds)
      );

      if (projectIds.length === 0) {
        return NextResponse.json(
          { error: "Select at least one project." },
          { status: 400 }
        );
      }

      const { data: projects, error: projectError } =
        await admin
          .from("projects")
          .select("id")
          .in("id", projectIds);

      if (
        projectError ||
        !projects ||
        projects.length !== projectIds.length
      ) {
        return NextResponse.json(
          {
            error: "One or more selected projects are invalid.",
          },
          { status: 400 }
        );
      }
    }

    // -----------------------------------------------------
    // PREPARE INSERT ROWS
    // -----------------------------------------------------

    const rows: EmergencyHolidayInsert[] =
      scope === "company"
        ? [
            {
              calendar_id: null,
              holiday_date: holidayDate,
              title,
              is_optional: false,
              is_working_day: false,
              holiday_type: "emergency",
              scope: "company",
              project_id: null,
              reason,
              status: "active",
              created_by: user.id,
            },
          ]
        : projectIds.map(
            (projectId): EmergencyHolidayInsert => ({
              calendar_id: null,
              holiday_date: holidayDate,
              title,
              is_optional: false,
              is_working_day: false,
              holiday_type: "emergency",
              scope: "project",
              project_id: projectId,
              reason,
              status: "active",
              created_by: user.id,
            })
          );

    // -----------------------------------------------------
    // INSERT HOLIDAYS
    // -----------------------------------------------------

    const { data: createdRows, error: insertError } =
      await admin
        .from("holidays")
        .insert(rows)
        .select(
          "id, holiday_date, title, reason, scope, project_id, status"
        );

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "An emergency holiday already exists for this date and scope. Review the existing entry first.",
          },
          { status: 409 }
        );
      }

      throw new Error(insertError.message);
    }

    // -----------------------------------------------------
    // NOTIFY AFFECTED EMPLOYEES
    // -----------------------------------------------------

    const notificationResults = [];

    for (
      const holiday of
      (createdRows || []) as EmergencyHolidayRow[]
    ) {
      const affected = await getAffectedEmployees(
        admin,
        holiday
      );

      const notification = await notifyEmployees(
        admin,
        affected,
        "Emergency Holiday Declared",
        `${holiday.title} has been declared as an emergency holiday for ${holiday.holiday_date}. Reason: ${holiday.reason || "Not provided"}.`
      );

      notificationResults.push({
        holiday_id: holiday.id,
        affected_employees: affected.length,
        ...notification,
      });
    }

    return NextResponse.json({
      success: true,
      holidays: createdRows || [],
      notifications: notificationResults,
    });
  } catch (error) {
    console.error(
      "Emergency holiday creation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create emergency holiday.",
      },
      { status: 500 }
    );
  }
}

// =========================================================
// CANCEL EMERGENCY HOLIDAY
// =========================================================

export async function PATCH(request: Request) {
  const auth = await authorizeHrOrCeo();

  if ("error" in auth) {
    return auth.error;
  }

  const { admin, user } = auth;

  try {
    const body = await request.json();

    const holidayId =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!holidayId) {
      return NextResponse.json(
        {
          error: "Emergency holiday ID is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // LOAD HOLIDAY
    // -----------------------------------------------------

    const { data: holiday, error: loadError } =
      await admin
        .from("holidays")
        .select(
          "id, holiday_date, title, reason, scope, project_id, status, holiday_type"
        )
        .eq("id", holidayId)
        .eq("holiday_type", "emergency")
        .maybeSingle();

    if (loadError) {
      throw new Error(loadError.message);
    }

    if (!holiday) {
      return NextResponse.json(
        {
          error: "Emergency holiday not found.",
        },
        { status: 404 }
      );
    }

    if (holiday.status === "cancelled") {
      return NextResponse.json(
        {
          error: "This emergency holiday is already cancelled.",
        },
        { status: 409 }
      );
    }

    // -----------------------------------------------------
    // CANCEL HOLIDAY
    // -----------------------------------------------------

    const { data: updated, error: updateError } =
      await admin
        .from("holidays")
        .update({
          status: "cancelled",
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", holidayId)
        .eq("status", "active")
        .select(
          "id, holiday_date, title, reason, scope, project_id, holiday_type, status, created_at"
        )
        .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updated) {
      return NextResponse.json(
        {
          error: "The holiday was already cancelled.",
        },
        { status: 409 }
      );
    }

    // -----------------------------------------------------
    // NOTIFY AFFECTED EMPLOYEES
    // -----------------------------------------------------

    const affected = await getAffectedEmployees(
      admin,
      holiday
    );

    const notification = await notifyEmployees(
      admin,
      affected,
      "Emergency Holiday Cancelled",
      `The emergency holiday "${holiday.title}" scheduled for ${holiday.holiday_date} has been cancelled. Normal attendance rules apply.`
    );

    return NextResponse.json({
      success: true,
      holiday: updated,
      affected_employees: affected.length,
      notifications: notification,
    });
  } catch (error) {
    console.error(
      "Emergency holiday cancellation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to cancel emergency holiday.",
      },
      { status: 500 }
    );
  }
}
