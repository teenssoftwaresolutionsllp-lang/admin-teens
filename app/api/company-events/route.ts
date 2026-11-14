import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;


type EventType = "event" | "emergency_announcement";
type AudienceScope = "company" | "departments" | "individuals";
type EventStatus = "draft" | "published";

interface EventPayload {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  event_type?: unknown;
  audience_scope?: unknown;
  status?: unknown;
  event_date?: unknown;
  end_date?: unknown;
  location?: unknown;
  expires_at?: unknown;
  department_ids?: unknown;
  employee_ids?: unknown;
}

interface TargetEmployee {
  id: string;
  user_id: string | null;
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

async function getManager(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string
) {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (
    profile &&
    ["hr", "ceo"].includes(String(profile.role).toLowerCase())
  );
}

async function getEmployee(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  email?: string
) {
  let query = await admin
    .from("employees")
    .select("id, user_id, department_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (query.error) throw new Error(query.error.message);

  if (!query.data && email) {
    query = await admin
      .from("employees")
      .select("id, user_id, department_id, status")
      .ilike("email", email.trim())
      .maybeSingle();

    if (query.error) throw new Error(query.error.message);
  }

  return query.data;
}

function validStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0
    )
  );
}

function optionalDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  if (
    typeof value !== "string" ||
    Number.isNaN(new Date(value).getTime())
  ) {
    return undefined;
  }

  return value;
}

async function getTargetEmployees(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  scope: AudienceScope,
  departmentIds: string[],
  employeeIds: string[]
): Promise<TargetEmployee[]> {
  if (scope === "individuals") {
    if (employeeIds.length === 0) return [];

    const { data, error } = await admin
      .from("employees")
      .select("id, user_id")
      .in("id", employeeIds)
      .in("status", ["active", "on_notice"]);

    if (error) throw new Error(error.message);
    return (data ?? []) as TargetEmployee[];
  }

  let query = admin
    .from("employees")
    .select("id, user_id")
    .in("status", ["active", "on_notice"]);

  if (scope === "departments") {
    query = query.in("department_id", departmentIds);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as TargetEmployee[];
}


async function sendEventNotifications(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  eventId: string,
  eventType: EventType,
  employees: TargetEmployee[],
  title: string,
  description: string,
  eventDate: string | null,
  endDate: string | null,
  location: string | null
) {
  if (employees.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const employeeIds = employees.map((employee) => employee.id);

  const notificationTitle =
    eventType === "event"
      ? `New Company Event: ${title}`
      : `Emergency Announcement: ${title}`;

  const formatNotificationDate = (value: string) =>
    new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

  const messageParts: string[] = [];

  if (description.trim()) {
    messageParts.push(description.trim());
  }

  if (eventDate) {
    messageParts.push(
      `Date: ${formatNotificationDate(eventDate)}`
    );
  }

  if (endDate) {
    messageParts.push(
      `End: ${formatNotificationDate(endDate)}`
    );
  }

  if (location) {
    messageParts.push(`Location: ${location}`);
  }

  const notificationMessage = messageParts.join("\n\n") || title;

  const { data: existing, error: existingError } = await admin
    .from("notifications")
    .select("id, employee_id, is_read, created_at")
    .eq("event_id", eventId)
    .in("employee_id", employeeIds)
    .order("created_at", { ascending: false });

  if (existingError) {
    console.error(
      "Event notification lookup failed:",
      existingError.message
    );

    return { sent: 0, failed: employees.length };
  }

  // Keep the latest unread notification for each employee.
  const latestUnread = new Map<string, string>();

  for (const notification of existing ?? []) {
    if (
      notification.is_read === false &&
      !latestUnread.has(notification.employee_id)
    ) {
      latestUnread.set(
        notification.employee_id,
        notification.id
      );
    }
  }

  let updatedCount = 0;
  let failedCount = 0;

  // Update unread notifications without changing read status.
  for (const notificationId of latestUnread.values()) {
    const { error } = await admin
      .from("notifications")
      .update({
        title: notificationTitle,
        message: notificationMessage,
        type: "announcement",
      })
      .eq("id", notificationId)
      .eq("is_read", false);

    if (error) {
      console.error(
        "Event notification update failed:",
        error.message
      );
      failedCount++;
    } else {
      updatedCount++;
    }
  }

  // If an employee has no unread notification,
  // create a fresh notification (including when the previous one was read).
  const employeesNeedingNewNotification = employees.filter(
    (employee) => !latestUnread.has(employee.id)
  );

  if (employeesNeedingNewNotification.length === 0) {
    return {
      sent: updatedCount,
      failed: failedCount,
    };
  }

  const rows = employeesNeedingNewNotification.map((employee) => ({
    event_id: eventId,
    employee_id: employee.id,
    recipient_user_id: employee.user_id,
    title: notificationTitle,
    message: notificationMessage,
    type: "announcement",
    is_read: false,
  }));

  const { error: insertError } = await admin
    .from("notifications")
    .insert(rows);

  if (insertError) {
    console.error(
      "Event notification insert failed:",
      insertError.message
    );

    failedCount += rows.length;
  }

  return {
    sent: updatedCount + (insertError ? 0 : rows.length),
    failed: failedCount,
  };
}



// GET:
// HR/CEO receives all records for management.
// Employees receive published normal events and only announcements
// that match their authenticated employee record.
export async function GET() {
  try {
    const user = await getUser();

    if (!user) return json({ error: "Unauthorized." }, 401);

    const admin = await createAdminClient();
    const isManager = await getManager(admin, user.id);

    if (isManager) {
      const { data, error } = await admin
        .from("company_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const eventIds = (data ?? []).map((item) => item.id);

      let media: Record<string, unknown>[] = [];

      if (eventIds.length > 0) {
        const { data: mediaRows, error: mediaError } = await admin
          .from("company_event_media")
          .select("*")
          .in("event_id", eventIds)
          .order("sort_order", { ascending: true });

        if (mediaError) throw new Error(mediaError.message);
        media = mediaRows ?? [];
      }

            let departmentLinks: {
        event_id: string;
        department_id: string;
      }[] = [];

      let employeeLinks: {
        event_id: string;
        employee_id: string;
      }[] = [];

    if (eventIds.length > 0) {
        const { data: departmentRows, error: departmentError } =
            await admin
                .from("company_event_departments")
                .select("event_id, department_id")
                .in("event_id", eventIds);

        if (departmentError) {
            throw new Error(departmentError.message);
        }

        departmentLinks = departmentRows ?? [];

        const { data: employeeRows, error: employeeError } =
        await admin
            .from("company_event_employees")
            .select("event_id, employee_id")
            .in("event_id", eventIds);

        if (employeeError) {
            throw new Error(employeeError.message);
        }

        employeeLinks = employeeRows ?? [];
    }

      return json({
        success: true,
        events: (data ?? []).map((event) => ({
          ...event,
          media: media.filter(
            (item) => item.event_id === event.id
          ),
          department_ids: departmentLinks
            .filter((item) => item.event_id === event.id)
            .map((item) => item.department_id),
          employee_ids: employeeLinks
            .filter((item) => item.event_id === event.id)
            .map((item) => item.employee_id),
        })),
        isManager: true,
      });
    }

    const employee = await getEmployee(
      admin,
      user.id,
      user.email
    );

    if (!employee) {
      return json(
        { error: "Employee profile not found.", events: [] },
        404
      );
    }

    const now = new Date().toISOString();

    // All published normal events are visible to employees.
    const { data: normalEvents, error: normalError } = await admin
      .from("company_events")
      .select("*")
      .eq("event_type", "event")
      .eq("status", "published")
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("event_date", { ascending: true });

    if (normalError) throw new Error(normalError.message);

    // Fetch published emergency announcements server-side.
    const { data: announcements, error: announcementError } =
      await admin
        .from("company_events")
        .select("*")
        .eq("event_type", "emergency_announcement")
        .eq("status", "published")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false });

    if (announcementError) {
      throw new Error(announcementError.message);
    }

    const announcementIds = (announcements ?? []).map(
      (item) => item.id
    );

    let departmentLinks: { event_id: string }[] = [];
    let employeeLinks: { event_id: string }[] = [];

    if (announcementIds.length > 0 && employee.department_id) {
      const { data, error } = await admin
        .from("company_event_departments")
        .select("event_id")
        .in("event_id", announcementIds)
        .eq("department_id", employee.department_id);

      if (error) throw new Error(error.message);
      departmentLinks = data ?? [];
    }

    if (announcementIds.length > 0) {
      const { data, error } = await admin
        .from("company_event_employees")
        .select("event_id")
        .in("event_id", announcementIds)
        .eq("employee_id", employee.id);

      if (error) throw new Error(error.message);
      employeeLinks = data ?? [];
    }

    const allowedIds = new Set([
      ...(announcements ?? [])
        .filter((item) => item.audience_scope === "company")
        .map((item) => item.id),
      ...departmentLinks.map((item) => item.event_id),
      ...employeeLinks.map((item) => item.event_id),
    ]);

    const visibleAnnouncements = (announcements ?? []).filter(
      (item) => allowedIds.has(item.id)
    );

    const visibleEvents = [
      ...(normalEvents ?? []),
      ...visibleAnnouncements,
    ];

    const visibleIds = visibleEvents.map((item) => item.id);

    let media: Record<string, unknown>[] = [];

    if (visibleIds.length > 0) {
      const { data, error } = await admin
        .from("company_event_media")
        .select("*")
        .in("event_id", visibleIds)
        .order("sort_order", { ascending: true });

      if (error) throw new Error(error.message);
      media = data ?? [];
    }

    return json({
      success: true,
      isManager: false,
      events: visibleEvents.map((event) => ({
        ...event,
        media: media.filter(
          (item) => item.event_id === event.id
        ),
      })),
    });
  } catch (error) {
    console.error("Company events GET error:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load events.",
      },
      500
    );
  }
}

// POST: HR/CEO create a draft or publish a new event/announcement.
export async function POST(request: Request) {
  try {
    const user = await getUser();

    if (!user) return json({ error: "Unauthorized." }, 401);

    const admin = await createAdminClient();
    const isManager = await getManager(admin, user.id);

    if (!isManager) {
      return json(
        { error: "Only HR and CEO can create events." },
        403
      );
    }

    const body = (await request.json()) as EventPayload;

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const eventType = body.event_type;
    const audienceScope = body.audience_scope;
    const status = body.status;

    if (!title || title.length > 200) {
      return json(
        { error: "Title is required and must be under 200 characters." },
        400
      );
    }

    if (
      eventType !== "event" &&
      eventType !== "emergency_announcement"
    ) {
      return json({ error: "Invalid event type." }, 400);
    }

    if (
      audienceScope !== "company" &&
      audienceScope !== "departments" &&
      audienceScope !== "individuals"
    ) {
      return json({ error: "Invalid audience scope." }, 400);
    }

    if (eventType === "event" && audienceScope !== "company") {
      return json(
        { error: "Normal events must be company-wide." },
        400
      );
    }

    if (status !== "draft" && status !== "published") {
      return json({ error: "Invalid event status." }, 400);
    }

    const departmentIds =
      body.department_ids === undefined
        ? []
        : body.department_ids;

    const employeeIds =
      body.employee_ids === undefined
        ? []
        : body.employee_ids;

    if (
      !validStringArray(departmentIds) ||
      !validStringArray(employeeIds)
    ) {
      return json(
        { error: "Invalid department or employee selection." },
        400
      );
    }

    if (
      audienceScope === "departments" &&
      departmentIds.length === 0
    ) {
      return json(
        { error: "Select at least one department." },
        400
      );
    }

    if (
      audienceScope === "individuals" &&
      employeeIds.length === 0
    ) {
      return json(
        { error: "Select at least one employee." },
        400
      );
    }

    if (
      audienceScope !== "departments" &&
      departmentIds.length > 0
    ) {
      return json(
        { error: "Departments are not valid for this audience." },
        400
      );
    }

    if (
      audienceScope !== "individuals" &&
      employeeIds.length > 0
    ) {
      return json(
        { error: "Individual employees are not valid for this audience." },
        400
      );
    }

    const eventDate = optionalDate(body.event_date);
    const endDate = optionalDate(body.end_date);
    const expiresAt = optionalDate(body.expires_at);

    if (
      eventDate === undefined ||
      endDate === undefined ||
      expiresAt === undefined
    ) {
      return json({ error: "Invalid date value." }, 400);
    }

    if (
      eventDate &&
      endDate &&
      new Date(endDate).getTime() < new Date(eventDate).getTime()
    ) {
      return json(
        { error: "End date cannot be before the event date." },
        400
      );
    }

    if (
      audienceScope === "departments" &&
      departmentIds.length > 0
    ) {
      const { data, error } = await admin
        .from("departments")
        .select("id")
        .in("id", departmentIds);

      if (error) throw new Error(error.message);

      if ((data ?? []).length !== new Set(departmentIds).size) {
        return json(
          { error: "One or more selected departments are invalid." },
          400
        );
      }
    }
    let targets: TargetEmployee[] = [];

    if (
    eventType === "event" ||
    eventType === "emergency_announcement"
    ) {
    const targetScope: AudienceScope =
        eventType === "event" ? "company" : audienceScope;

    targets = await getTargetEmployees(
        admin,
        targetScope,
        departmentIds,
        employeeIds
    );

    if (
        eventType === "emergency_announcement" &&
        audienceScope === "individuals" &&
        targets.length !== new Set(employeeIds).size
    ) {
        return json(
        { error: "One or more selected employees are invalid or inactive." },
        400
        );
    }
    }

    const { data: created, error: createError } = await admin
      .from("company_events")
      .insert({
        title,
        description: description || null,
        event_type: eventType as EventType,
        audience_scope: audienceScope as AudienceScope,
        status: status as EventStatus,
        event_date: eventDate ?? null,
        end_date: endDate ?? null,
        location:
          typeof body.location === "string"
            ? body.location.trim() || null
            : null,
        expires_at: expiresAt ?? null,
        created_by: user.id,
        published_at: status === "published"
          ? new Date().toISOString()
          : null,
      })
      .select("*")
      .single();

    if (createError || !created) {
      throw new Error(
        createError?.message || "Unable to create event."
      );
    }

    // Save department targeting.
    if (
      audienceScope === "departments" &&
      departmentIds.length > 0
    ) {
      const { error } = await admin
        .from("company_event_departments")
        .insert(
          departmentIds.map((departmentId) => ({
            event_id: created.id,
            department_id: departmentId,
          }))
        );

      if (error) {
        await admin
          .from("company_events")
          .delete()
          .eq("id", created.id);

        throw new Error(error.message);
      }
    }

    // Save individual employee targeting.
    if (
      audienceScope === "individuals" &&
      employeeIds.length > 0
    ) {
      const { error } = await admin
        .from("company_event_employees")
        .insert(
          employeeIds.map((employeeId) => ({
            event_id: created.id,
            employee_id: employeeId,
          }))
        );

      if (error) {
        await admin
          .from("company_events")
          .delete()
          .eq("id", created.id);

        throw new Error(error.message);
      }
    }

    let notifications = { sent: 0, failed: 0 };

    // Normal events do not send emergency notifications.
    if (status === "published") {
        notifications = await sendEventNotifications(
            admin,
            created.id,
            eventType as EventType,
            targets,
            title,
            description,
            eventDate ?? null,
            endDate ?? null,
            typeof body.location === "string" ? body.location.trim() || null : null 
        );
    }

    return json(
      {
        success: true,
        event: created,
        notifications,
      },
      201
    );
  } catch (error) {
    console.error("Company events POST error:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create event.",
      },
      500
    );
  }
}

// PATCH: HR/CEO edit an existing event or publish a draft.
export async function PATCH(request: Request) {
  try {
    const user = await getUser();

    if (!user) return json({ error: "Unauthorized." }, 401);

    const admin = await createAdminClient();
    const isManager = await getManager(admin, user.id);

    if (!isManager) {
      return json(
        { error: "Only HR and CEO can edit or publish events." },
        403
      );
    }

    const body = (await request.json()) as EventPayload;

    if (
      typeof body.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.id
      )
    ) {
      return json({ error: "A valid event ID is required." }, 400);
    }

    const { data: existing, error: existingError } = await admin
      .from("company_events")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (!existing) {
      return json({ error: "Event not found." }, 404);
    }

    // Load existing audience links.
    const { data: oldDepartmentLinks, error: oldDepartmentError } =
      await admin
        .from("company_event_departments")
        .select("department_id")
        .eq("event_id", body.id);

    if (oldDepartmentError) {
      throw new Error(oldDepartmentError.message);
    }

    const { data: oldEmployeeLinks, error: oldEmployeeError } =
      await admin
        .from("company_event_employees")
        .select("employee_id")
        .eq("event_id", body.id);

    if (oldEmployeeError) {
      throw new Error(oldEmployeeError.message);
    }

    const oldDepartmentIds = (oldDepartmentLinks ?? []).map(
      (item) => item.department_id
    );

    const oldEmployeeIds = (oldEmployeeLinks ?? []).map(
      (item) => item.employee_id
    );

    const title =
      body.title === undefined
        ? existing.title
        : typeof body.title === "string"
          ? body.title.trim()
          : "";

    const description =
      body.description === undefined
        ? existing.description ?? ""
        : typeof body.description === "string"
          ? body.description.trim()
          : "";

    const eventType =
      body.event_type === undefined
        ? existing.event_type
        : body.event_type;

    const audienceScope =
      body.audience_scope === undefined
        ? existing.audience_scope
        : body.audience_scope;

    const status =
      body.status === undefined
        ? existing.status
        : body.status;

    if (!title || title.length > 200) {
      return json(
        { error: "Title is required and must be under 200 characters." },
        400
      );
    }

    if (
      eventType !== "event" &&
      eventType !== "emergency_announcement"
    ) {
      return json({ error: "Invalid event type." }, 400);
    }

    if (
      audienceScope !== "company" &&
      audienceScope !== "departments" &&
      audienceScope !== "individuals"
    ) {
      return json({ error: "Invalid audience scope." }, 400);
    }

    if (eventType === "event" && audienceScope !== "company") {
      return json(
        { error: "Normal events must be company-wide." },
        400
      );
    }

    if (status !== "draft" && status !== "published") {
      return json({ error: "Invalid event status." }, 400);
    }

    const departmentIds =
      body.department_ids === undefined
        ? audienceScope === existing.audience_scope
          ? oldDepartmentIds
          : []
        : body.department_ids;

    const employeeIds =
      body.employee_ids === undefined
        ? audienceScope === existing.audience_scope
          ? oldEmployeeIds
          : []
        : body.employee_ids;

    if (
      !validStringArray(departmentIds) ||
      !validStringArray(employeeIds)
    ) {
      return json(
        { error: "Invalid department or employee selection." },
        400
      );
    }

    if (
      audienceScope === "departments" &&
      departmentIds.length === 0
    ) {
      return json(
        { error: "Select at least one department." },
        400
      );
    }

    if (
      audienceScope === "individuals" &&
      employeeIds.length === 0
    ) {
      return json(
        { error: "Select at least one employee." },
        400
      );
    }

    if (
      audienceScope !== "departments" &&
      departmentIds.length > 0
    ) {
      return json(
        { error: "Departments are not valid for this audience." },
        400
      );
    }

    if (
      audienceScope !== "individuals" &&
      employeeIds.length > 0
    ) {
      return json(
        { error: "Individual employees are not valid for this audience." },
        400
      );
    }

    const eventDateValue = optionalDate(body.event_date);
    const endDateValue = optionalDate(body.end_date);
    const expiresAtValue = optionalDate(body.expires_at);

    if (
      eventDateValue === undefined ||
      endDateValue === undefined ||
      expiresAtValue === undefined
    ) {
      return json({ error: "Invalid date value." }, 400);
    }

    const eventDate =
      body.event_date === undefined
        ? existing.event_date
        : eventDateValue;

    const endDate =
      body.end_date === undefined
        ? existing.end_date
        : endDateValue;

    const expiresAt =
      body.expires_at === undefined
        ? existing.expires_at
        : expiresAtValue;

    if (
      eventDate &&
      endDate &&
      new Date(endDate).getTime() < new Date(eventDate).getTime()
    ) {
      return json(
        { error: "End date cannot be before the event date." },
        400
      );
    }

    let location = existing.location;

    if (body.location !== undefined) {
      if (
        typeof body.location !== "string" &&
        body.location !== null
      ) {
        return json({ error: "Invalid location." }, 400);
      }

      location =
        typeof body.location === "string"
          ? body.location.trim() || null
          : null;
    }

    // Validate selected departments.
    if (
      audienceScope === "departments" &&
      departmentIds.length > 0
    ) {
      const { data, error } = await admin
        .from("departments")
        .select("id")
        .in("id", departmentIds);

      if (error) throw new Error(error.message);

      if ((data ?? []).length !== new Set(departmentIds).size) {
        return json(
          { error: "One or more selected departments are invalid." },
          400
        );
      }
    }

    // Resolve the new audience.
    // Normal events always target all active/on-notice employees.
    const targetScope: AudienceScope =
      eventType === "event" ? "company" : audienceScope;

    const newTargets = await getTargetEmployees(
      admin,
      targetScope,
      departmentIds,
      employeeIds
    );

    if (
      eventType === "emergency_announcement" &&
      audienceScope === "individuals" &&
      newTargets.length !== new Set(employeeIds).size
    ) {
      return json(
        { error: "One or more selected employees are invalid or inactive." },
        400
      );
    }

    // Replace existing targeting links.
    const { error: deleteDepartmentsError } = await admin
      .from("company_event_departments")
      .delete()
      .eq("event_id", body.id);

    if (deleteDepartmentsError) {
      throw new Error(deleteDepartmentsError.message);
    }

    const { error: deleteEmployeesError } = await admin
      .from("company_event_employees")
      .delete()
      .eq("event_id", body.id);

    if (deleteEmployeesError) {
      throw new Error(deleteEmployeesError.message);
    }

    // Save department targeting.
    if (
      audienceScope === "departments" &&
      departmentIds.length > 0
    ) {
      const { error } = await admin
        .from("company_event_departments")
        .insert(
          departmentIds.map((departmentId) => ({
            event_id: body.id as string,
            department_id: departmentId,
          }))
        );

      if (error) throw new Error(error.message);
    }

    // Save individual employee targeting.
    if (
      audienceScope === "individuals" &&
      employeeIds.length > 0
    ) {
      const { error } = await admin
        .from("company_event_employees")
        .insert(
          employeeIds.map((employeeId) => ({
            event_id: body.id as string,
            employee_id: employeeId,
          }))
        );

      if (error) throw new Error(error.message);
    }

    const publishedAt =
      status === "published"
        ? existing.published_at ?? new Date().toISOString()
        : null;

    const { data: updated, error: updateError } = await admin
      .from("company_events")
      .update({
        title,
        description: description || null,
        event_type: eventType as EventType,
        audience_scope: audienceScope as AudienceScope,
        status: status as EventStatus,
        event_date: eventDate,
        end_date: endDate,
        location,
        expires_at: expiresAt,
        published_at: publishedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error(
        updateError?.message || "Unable to update event."
      );
    }

    // Notify eligible employees when the event is published.
    // The helper prevents duplicate notifications for this event.
    let notifications = { sent: 0, failed: 0 };

    if (status === "published") {
      notifications = await sendEventNotifications(
        admin,
        body.id,
        eventType as EventType,
        newTargets,
        title,
        description,
        eventDate,
        endDate,
        location
      );
    }

    return json({
      success: true,
      event: updated,
      notifications,
    });
  } catch (error) {
    console.error("Company events PATCH error:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update event.",
      },
      500
    );
  }
}
