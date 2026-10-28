
import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // Employee lookup is optional because an HR account may
    // not have a linked employee record.
    let employeeId: string | null = null;

    let employeeQuery = await admin
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employeeQuery.error) {
      throw new Error(employeeQuery.error.message);
    }

    if (!employeeQuery.data && user.email) {
      employeeQuery = await admin
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (employeeQuery.error) {
        throw new Error(employeeQuery.error.message);
      }
    }

    employeeId = employeeQuery.data?.id ?? null;

    // HR notifications are addressed to the authenticated
    // Supabase user. Employee notifications retain employee_id.
    let notificationQuery = admin
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: recipientRows, error: recipientError } =
      await notificationQuery;

    if (recipientError) {
      throw new Error(recipientError.message);
    }

    let employeeRows: typeof recipientRows = [];

    if (employeeId) {
      const { data, error } = await admin
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(error.message);
      }

      employeeRows = data ?? [];
    }

    // Avoid duplicate rows if an account has both recipient types.
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
        type: item.type,
        time: item.created_at,
        created_at: item.created_at,
        read: item.is_read,
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
        : "Unable to fetch notifications.";

    console.error("Notifications API error:", message);

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

export async function PATCH() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = await createAdminClient();

    let employeeId: string | null = null;

    let employeeQuery = await admin
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employeeQuery.error) {
      throw new Error(employeeQuery.error.message);
    }

    if (!employeeQuery.data && user.email) {
      employeeQuery = await admin
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (employeeQuery.error) {
        throw new Error(employeeQuery.error.message);
      }
    }

    employeeId = employeeQuery.data?.id ?? null;

    // Always target this user's HR notifications, and also their
    // employee notifications when an employee record exists.
    let query = admin
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false)
      .eq("recipient_user_id", user.id);

    // The recipient_user_id filter above is intentionally scoped
    // to this user. Handle employee-owned notifications separately.
    const { error: recipientError } = await query;

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
        : "Unable to mark notifications as read.";

    console.error("Mark notifications as read error:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
