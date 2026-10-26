
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

    let employeeQuery = adminSupabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id);

    const { data: employeeByUser, error: employeeError } =
      await employeeQuery.maybeSingle();

    if (employeeError) {
      throw employeeError;
    }

    let employee = employeeByUser;

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
        { notifications: [], unreadCount: 0 },
        { headers: noCacheHeaders }
      );
    }

    // 1. Read existing database notifications, including payslip notifications.
    const {
      data: savedNotifications,
      error: notificationError,
    } = await adminSupabase
      .from("notifications")
      .select("id, employee_id, title, message, type, is_read, created_at")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (notificationError) {
      throw notificationError;
    }

    const databaseNotifications = (savedNotifications ?? []).map(
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

    // 2. Keep the existing leave approval/rejection notifications.
    const {
      data: leaveRequests,
      error: leaveError,
    } = await adminSupabase
      .from("leave_requests")
      .select(
        "id, employee_id, status, start_date, end_date, total_days, reviewed_at, rejection_reason"
      )
      .eq("employee_id", employee.id)
      .in("status", ["approved", "rejected"])
      .order("reviewed_at", { ascending: false })
      .limit(50);

    if (leaveError) {
      throw leaveError;
    }

    const leaveNotifications = (leaveRequests ?? []).map(
      (leave: any) => {
        const approved = leave.status === "approved";

        return {
          id: `leave-${leave.id}`,
          title: approved ? "Leave Approved" : "Leave Rejected",
          message: approved
            ? `Your leave from ${leave.start_date} to ${leave.end_date} has been approved.`
            : `Your leave from ${leave.start_date} to ${leave.end_date} was rejected.${
                leave.rejection_reason
                  ? ` Reason: ${leave.rejection_reason}`
                  : ""
              }`,
          type: approved ? "success" : "error",
          read: false,
          created_at: leave.reviewed_at,
          time: leave.reviewed_at,
        };
      }
    );

    // Combine both sources, newest first.
    const notifications = [
      ...databaseNotifications,
      ...leaveNotifications,
    ]
      .sort((a, b) => {
        const dateA = a.created_at
          ? new Date(a.created_at).getTime()
          : 0;
        const dateB = b.created_at
          ? new Date(b.created_at).getTime()
          : 0;

        return dateB - dateA;
      })
      .slice(0, 50);

    return NextResponse.json(
      {
        notifications,
        unreadCount: notifications.filter((item) => !item.read).length,
      },
      { headers: noCacheHeaders }
    );
  } catch (error: any) {
    console.error("GET /api/notifications failed:", error);

    return NextResponse.json(
      { error: error.message || "Failed to load notifications." },
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

    // Mark persisted notifications as read for this employee.
    const adminSupabase = await createAdminClient();

    const { data: employee } = await adminSupabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employee) {
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
  } catch (error: any) {
    console.error("PATCH /api/notifications failed:", error);

    return NextResponse.json(
      { error: error.message || "Failed to mark notifications as read." },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
