
import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
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
        { error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const adminSupabase = await createAdminClient();

    // Find the employee linked to the logged-in user.
    const { data: employeeByUser, error: employeeError } =
      await adminSupabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (employeeError) {
      throw employeeError;
    }

    let employee = employeeByUser;

    // Fallback: find the employee using their email.
    if (!employee && user.email) {
      const { data: employeeByEmail, error: emailError } =
        await adminSupabase
          .from("employees")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();

      if (emailError) {
        throw emailError;
      }

      employee = employeeByEmail;
    }

    if (!employee) {
      return NextResponse.json(
        {
          notifications: [],
          unreadCount: 0,
        },
        { headers: noCacheHeaders }
      );
    }

    // Fetch saved notifications, including leave and payslip notifications.
    const {
      data: savedNotifications,
      error: notificationError,
    } = await adminSupabase
      .from("notifications")
      .select(
        "id, employee_id, title, message, type, is_read, created_at"
      )
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (notificationError) {
      throw notificationError;
    }

    // Use only saved notifications.
    // Do not generate another notification from leave_requests,
    // because the leave review API already saves the notification.
    const notifications = (savedNotifications ?? []).map(
      (item: any) => ({
        id: `notification-${item.id}`,
        title: item.title,
        message: item.message,
        type: item.type ?? "info",
        read: Boolean(item.is_read),
        created_at: item.created_at,
        time: item.created_at,
      })
    );

    return NextResponse.json(
      {
        notifications,
        unreadCount: notifications.filter(
          (item) => !item.read
        ).length,
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
      { error: message },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function PATCH() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const adminSupabase = await createAdminClient();

    // Find the employee linked to the logged-in user.
    const { data: employee, error: employeeError } =
      await adminSupabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (employeeError) {
      throw employeeError;
    }

    if (employee) {
      // Mark saved notifications as read.
      const { error: updateError } = await adminSupabase
        .from("notifications")
        .update({ is_read: true })
        .eq("employee_id", employee.id)
        .eq("is_read", false);

      if (updateError) {
        throw updateError;
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
      { error: message },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
