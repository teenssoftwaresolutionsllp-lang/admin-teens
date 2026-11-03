import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

async function getEmployeeId(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  email?: string
): Promise<string | null> {
  let employeeQuery = await admin
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (employeeQuery.error) {
    throw new Error(employeeQuery.error.message);
  }

  if (!employeeQuery.data && email) {
    employeeQuery = await admin
      .from("employees")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (employeeQuery.error) {
      throw new Error(employeeQuery.error.message);
    }
  }

  return employeeQuery.data?.id ?? null;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          notifications: [],
          unreadCount: 0,
        },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const admin = await createAdminClient();
    const employeeId = await getEmployeeId(admin, user.id, user.email);
    const { data: recipientRows, error: recipientError } = await admin
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (recipientError) {
      throw new Error(recipientError.message);
    }

    let employeeRows: typeof recipientRows = [];

    if (employeeId) {
      const { data, error } = await admin
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("employee_id", employeeId)
        .is("recipient_user_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(error.message);
      }

      employeeRows = data ?? [];
    }

    const uniqueRows = new Map(
      [...(recipientRows ?? []), ...employeeRows].map((item) => [
        item.id,
        item,
      ])
    );

    const notifications = [...uniqueRows.values()]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .slice(0, 50)
      .map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        type: item.type ?? "info",
        time: item.created_at,
        created_at: item.created_at,
        read: Boolean(item.is_read),
      }));

    return NextResponse.json(
      {
        success: true,
        notifications,
        unreadCount: notifications.filter((item) => !item.read).length,
      },
      { headers: noCacheHeaders }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load notifications.";

    console.error("GET /api/notifications failed:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
        notifications: [],
        unreadCount: 0,
      },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const admin = await createAdminClient();
    const employeeId = await getEmployeeId(admin, user.id, user.email);
    const requestBody = await request.text();
    let body: { notificationId?: string | number } = {};

    if (requestBody.trim()) {
      try {
        body = JSON.parse(requestBody) as typeof body;
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid request body." },
          { status: 400, headers: noCacheHeaders }
        );
      }
    }

    if (body.notificationId !== undefined && body.notificationId !== null) {
      const notificationId = String(body.notificationId).trim();

      if (!notificationId) {
        return NextResponse.json(
          { success: false, error: "Invalid notification ID." },
          { status: 400, headers: noCacheHeaders }
        );
      }

      const { data: recipientNotification, error: recipientError } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("recipient_user_id", user.id)
        .eq("is_read", false)
        .select("id")
        .maybeSingle();

      if (recipientError) {
        throw new Error(recipientError.message);
      }

      let updatedNotification = recipientNotification;

      if (!updatedNotification && employeeId) {
        const { data, error } = await admin
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notificationId)
          .eq("employee_id", employeeId)
          .is("recipient_user_id", null)
          .eq("is_read", false)
          .select("id")
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        updatedNotification = data;
      }

      if (!updatedNotification) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Notification not found or you do not have permission to update it.",
          },
          { status: 404, headers: noCacheHeaders }
        );
      }

      return NextResponse.json(
        { success: true, notificationId },
        { headers: noCacheHeaders }
      );
    }

    const { error: recipientError } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false)
      .eq("recipient_user_id", user.id);

    if (recipientError) {
      throw new Error(recipientError.message);
    }

    if (employeeId) {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("employee_id", employeeId)
        .is("recipient_user_id", null)
        .eq("is_read", false);

      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.json(
      { success: true },
      { headers: noCacheHeaders }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to mark notifications as read.";

    console.error("PATCH /api/notifications failed:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
