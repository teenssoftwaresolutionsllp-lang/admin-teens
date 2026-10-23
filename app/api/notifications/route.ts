
import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

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
        { status: 401 }
      );
    }

    const adminSupabase = await createAdminClient();

    // Find the employee belonging to the logged-in user.
    let employeeQuery = await adminSupabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!employeeQuery.data && user.email) {
      employeeQuery = await adminSupabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
    }

    if (employeeQuery.error) {
      throw new Error(employeeQuery.error.message);
    }

    if (!employeeQuery.data) {
      return NextResponse.json(
        {
          success: true,
          notifications: [],
          unreadCount: 0,
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const employeeId = employeeQuery.data.id;

    // Read notifications from the persistent notifications table.
    const { data: notificationRows, error: notificationsError } =
      await adminSupabase
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(50);

    if (notificationsError) {
      throw new Error(notificationsError.message);
    }

    const notifications = (notificationRows || []).map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      type: item.type,
      time: item.created_at,
      created_at: item.created_at,
      read: item.is_read,
    }));

    const unreadCount = notifications.filter(
      (item) => !item.read
    ).length;

    return NextResponse.json(
      {
        success: true,
        notifications,
        unreadCount,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
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
      { status: 500 }
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

    const adminSupabase = await createAdminClient();

    let employeeQuery = await adminSupabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!employeeQuery.data && user.email) {
      employeeQuery = await adminSupabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
    }

    if (employeeQuery.error) {
      throw new Error(employeeQuery.error.message);
    }

    if (!employeeQuery.data) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }

    const { error } = await adminSupabase
      .from("notifications")
      .update({ is_read: true })
      .eq("employee_id", employeeQuery.data.id)
      .eq("is_read", false);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
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
