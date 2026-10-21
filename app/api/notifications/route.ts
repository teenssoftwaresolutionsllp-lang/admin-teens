
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

    // Find the logged-in employee.
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
      return NextResponse.json({
        success: true,
        notifications: [],
        unreadCount: 0,
      });
    }

    const employeeId = employeeQuery.data.id;

    // 1. Leave approval/rejection notifications.
    const { data: leaveRequests, error: leaveError } =
      await adminSupabase
        .from("leave_requests")
        .select(
          "id, status, start_date, end_date, reviewed_at, rejection_reason"
        )
        .eq("employee_id", employeeId)
        .in("status", ["approved", "rejected"])
        .not("reviewed_at", "is", null)
        .order("reviewed_at", { ascending: false })
        .limit(50);

    if (leaveError) {
      throw new Error(leaveError.message);
    }

    const leaveNotifications = (leaveRequests || []).map((leave) => {
      const approved = leave.status === "approved";

      return {
        id: `leave-${leave.id}`,
        title: approved
          ? "Leave Request Approved"
          : "Leave Request Rejected",
        message: approved
          ? `Your leave request (${leave.start_date} to ${leave.end_date}) has been approved by HR.`
          : `Your leave request (${leave.start_date} to ${leave.end_date}) has been rejected by HR.${
              leave.rejection_reason
                ? ` Reason: ${leave.rejection_reason}`
                : ""
            }`,
        time: leave.reviewed_at,
        created_at: leave.reviewed_at,
        read: false,
      };
    });

    // 2. Attendance regularization notifications.
    const {
      data: regularizations,
      error: regularizationError,
    } = await adminSupabase
      .from("attendance_regularizations")
      .select(
        "id, employee_id, attendance_date, status, created_at, reviewed_at, rejection_reason"
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (regularizationError) {
      throw new Error(regularizationError.message);
    }

    const regularizationNotifications = (regularizations || [])
      .filter((item) =>
        ["pending", "approved", "rejected"].includes(
          String(item.status).toLowerCase()
        )
      )
      .map((item) => {
        const status = String(item.status).toLowerCase();
        const date = item.attendance_date;

        if (status === "pending") {
          return {
            id: `regularization-${item.id}`,
            title: "Regularization Request Submitted",
            message: `Your attendance regularization request for ${date} is waiting for HR approval.`,
            time: item.created_at,
            created_at: item.created_at,
            read: false,
          };
        }

        const approved = status === "approved";
        const notificationTime = item.reviewed_at || item.created_at;

        return {
          id: `regularization-${item.id}`,
          title: approved
            ? "Regularization Request Approved"
            : "Regularization Request Rejected",
          message: approved
            ? `Your attendance regularization request for ${date} has been approved by HR.`
            : `Your attendance regularization request for ${date} has been rejected by HR.${
                item.rejection_reason
                  ? ` Reason: ${item.rejection_reason}`
                  : ""
              }`,
          time: notificationTime,
          created_at: notificationTime,
          read: false,
        };
      });

    // 3. Profile-change approval/rejection notifications.
    const {
      data: profileRequests,
      error: profileError,
    } = await adminSupabase
      .from("profile_change_requests")
      .select("id, employee_id, status, created_at, reviewed_at")
      .eq("employee_id", employeeId)
      .in("status", ["approved", "rejected"])
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(50);

    if (profileError) {
      throw new Error(profileError.message);
    }

    const profileNotifications = (profileRequests || []).map((request) => {
      const approved =
        String(request.status).toLowerCase() === "approved";

      return {
        id: `profile-${request.id}`,
        title: approved
          ? "Profile Change Request Approved"
          : "Profile Change Request Rejected",
        message: approved
          ? "HR has approved your profile change request."
          : "HR has rejected your profile change request. Please check with HR for more details.",
        time: request.reviewed_at,
        created_at: request.reviewed_at,
        read: false,
      };
    });

    // Combine all notifications and show the newest first.
    const notifications = [
      ...leaveNotifications,
      ...regularizationNotifications,
      ...profileNotifications,
    ]
      .sort((a, b) => {
        const timeA = a.created_at
          ? new Date(a.created_at).getTime()
          : 0;
        const timeB = b.created_at
          ? new Date(b.created_at).getTime()
          : 0;

        return timeB - timeA;
      })
      .slice(0, 50);

    return NextResponse.json(
      {
        success: true,
        notifications,
        unreadCount: notifications.length,
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
