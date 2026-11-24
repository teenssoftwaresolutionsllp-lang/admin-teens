import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { DataStore } from '@/lib/data-store';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    let user = null;

    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch {
      // ignore
    }

    if (!user) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        user = session?.user || null;
      } catch {
        // ignore
      }
    }

        // Only HR and CEO can access the complete employee list.
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const authAdminClient = await createAdminClient();

    const { data: authProfile, error: authProfileError } =
      await authAdminClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (authProfileError || !authProfile) {
      return NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 403 }
      );
    }

    if (!["hr", "ceo"].includes(authProfile.role)) {
      return NextResponse.json(
        { error: "You are not authorized to access the employee list." },
        { status: 403 }
      );
    }



    // Check for last-working-day reminders when HR/CEO loads employees.
    // This is event-triggered; no cron job is used.
    try {
      if (user) {
        const adminClient = await createAdminClient();

        const { data: profile, error: profileError } = await adminClient
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (
          !profileError &&
          (profile?.role === "hr" || profile?.role === "ceo")
        ) {
          // Calculate tomorrow's date in India Standard Time.
          const indiaToday = new Date(
            Date.now() + 330 * 60 * 1000
          )
            .toISOString()
            .slice(0, 10);

          const tomorrowDate = new Date(
            `${indiaToday}T00:00:00.000Z`
          );
          tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
          const tomorrow = tomorrowDate.toISOString().slice(0, 10);

          const { data: employeesDue, error: employeesDueError } =
            await adminClient
              .from("employees")
              .select(
                "id, employee_id, first_name, last_name, planned_last_working_date, notice_status"
              )
              .eq("notice_status", "notice_period")
              .eq("planned_last_working_date", tomorrow);

          if (employeesDueError) {
            console.error(
              "Failed to check upcoming last working days:",
              employeesDueError
            );
          } else if (employeesDue?.length) {
            const { data: hrUsers, error: hrUsersError } =
              await adminClient
                .from("profiles")
                .select("id")
                .in("role", ["hr", "ceo"]);

            if (hrUsersError) {
              console.error(
                "Failed to load HR/CEO notification recipients:",
                hrUsersError
              );
            } else if (hrUsers?.length) {
              const employeeIds = employeesDue.map(
                (employee) => employee.id
              );
              const recipientIds = hrUsers.map((hr) => hr.id);

              const {
                data: existingNotifications,
                error: existingError,
              } = await adminClient
                .from("notifications")
                .select("employee_id, recipient_user_id, message")
                .eq("title", "Last Working Day Tomorrow")
                .eq("type", "resignation")
                .in("employee_id", employeeIds)
                .in("recipient_user_id", recipientIds);

              if (existingError) {
                console.error(
                  "Failed to check duplicate last-working-day notifications:",
                  existingError
                );
              } else {
                const notificationRows = [];

                for (const employee of employeesDue) {
                  const employeeName = [
                    employee.first_name,
                    employee.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  const message =
                    `Reminder: ${employeeName || employee.employee_id} ` +
                    `has their planned last working day tomorrow (${tomorrow}).`;

                  for (const hr of hrUsers) {
                    const alreadyExists = (
                      existingNotifications ?? []
                    ).some(
                      (notification) =>
                        notification.employee_id === employee.id &&
                        notification.recipient_user_id === hr.id &&
                        notification.message.includes(
                          `planned last working day tomorrow (${tomorrow}).`
                        )
                    );

                    if (!alreadyExists) {
                      notificationRows.push({
                        employee_id: employee.id,
                        recipient_user_id: hr.id,
                        title: "Last Working Day Tomorrow",
                        message,
                        type: "resignation",
                        is_read: false,
                      });
                    }
                  }
                }

                if (notificationRows.length > 0) {
                  const { error: insertError } = await adminClient
                    .from("notifications")
                    .insert(notificationRows);

                  if (insertError) {
                    console.error(
                      "Failed to create last-working-day notifications:",
                      insertError
                    );
                  }
                }
              }
            }
          }
        }
      }
    } catch (reminderError) {
      // A reminder failure must not break the employee-list API.
      console.error(
        "Last-working-day reminder check failed:",
        reminderError
      );
    }



    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const company = searchParams.get('company');
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const employment_type = searchParams.get('employment_type');

    // Retrieve from DataStore (which connects to DB and syncs cache)
    let employees = await DataStore.getEmployees();

    if (search) {
      const searchLower = search.toLowerCase();
      employees = employees.filter(
        (emp) =>
          `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchLower) ||
          emp.email?.toLowerCase().includes(searchLower) ||
          emp.employee_id?.toLowerCase().includes(searchLower)
      );
    }

    if (department && department !== 'all') {
      employees = employees.filter((emp) => emp.department_id === department);
    }

    if (status && status !== 'all') {
      employees = employees.filter((emp) => emp.status === status);
    }

    if (employment_type && employment_type !== 'all') {
      employees = employees.filter((emp) => emp.employment_type === employment_type);
    }

    return NextResponse.json(employees);
  } catch (error) {
      console.error("API Error in GET /api/employees:", error);

      return NextResponse.json(
        { error: "Failed to load employees." },
        { status: 500 }
      );
    }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct employee creation is disabled. Employees must be created through the verified onboarding and joining conversion workflow.",
    },
    { status: 403 }
  );
}
