
import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: noCacheHeaders,
  });
}

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

// GET: Fetch notifications for the logged-in user.
export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized",
          notifications: [],
          unreadCount: 0,
        },
        401
      );
    }

    const admin = await createAdminClient();

    const employeeId = await getEmployeeId(
      admin,
      user.id,
      user.email
    );

    // Notifications directly assigned to the logged-in user.
    const { data: recipientRows, error: recipientError } =
      await admin
        .from("notifications")
        .select(
          "id, title, message, type, is_read, created_at"
        )
        .eq("recipient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

    if (recipientError) {
      throw new Error(recipientError.message);
    }

    // Notifications assigned through the employee record.
    let employeeRows: typeof recipientRows = [];

    if (employeeId) {
      const { data, error } = await admin
        .from("notifications")
        .select(
          "id, title, message, type, is_read, created_at"
        )
        .eq("employee_id", employeeId)
        .is("recipient_user_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(error.message);
      }

      employeeRows = data ?? [];
    }

    // Remove duplicate notifications.
    const uniqueRows = new Map(
      [...(recipientRows ?? []), ...(employeeRows ?? [])].map(
        (item) => [item.id, item]
      )
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

    return jsonResponse({
      success: true,
      notifications,
      unreadCount: notifications.filter(
        (item) => !item.read
      ).length,
    });
  } catch (error: unknown) {
    console.error("GET /api/notifications failed:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load notifications.",
        notifications: [],
        unreadCount: 0,
      },
      500
    );
  }
}

// PATCH: Mark one notification or all notifications as read.
export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized",
        },
        401
      );
    }

    const admin = await createAdminClient();

    const employeeId = await getEmployeeId(
      admin,
      user.id,
      user.email
    );

    const requestBody = await request.text();

    let body: {
      notificationId?: string | number;
    } = {};

    if (requestBody.trim()) {
      try {
        body = JSON.parse(requestBody);
      } catch {
        return jsonResponse(
          {
            success: false,
            error: "Invalid request body.",
          },
          400
        );
      }
    }

    // Mark one notification as read.
    if (
      body.notificationId !== undefined &&
      body.notificationId !== null
    ) {
      const notificationId = String(
        body.notificationId
      ).trim();

      if (!notificationId) {
        return jsonResponse(
          {
            success: false,
            error: "Invalid notification ID.",
          },
          400
        );
      }

      const { data: recipientNotification, error: recipientError } =
        await admin
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
        return jsonResponse(
          {
            success: false,
            error:
              "Notification not found or you do not have permission to update it.",
          },
          404
        );
      }

      return jsonResponse({
        success: true,
        notificationId,
      });
    }

    // Mark all user notifications as read.
    const { error: recipientError } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false)
      .eq("recipient_user_id", user.id);

    if (recipientError) {
      throw new Error(recipientError.message);
    }

    // Also update employee-linked notifications.
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

    return jsonResponse({
      success: true,
    });
  } catch (error: unknown) {
    console.error("PATCH /api/notifications failed:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark notifications as read.",
      },
      500
    );
  }
}
