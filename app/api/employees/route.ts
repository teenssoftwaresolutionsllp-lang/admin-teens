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
    console.error('API Error in GET /api/employees:', error);
    const fallbackEmployees = await DataStore.getEmployees();
    return NextResponse.json(fallbackEmployees);
  }
}

export async function POST(request: Request) {
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

    const rawBody = await request.json();
    const { initial_password, employee_id: _providedEmployeeId, ...fields } = rawBody;

    const employeeData = Object.fromEntries(
      Object.entries(fields).map(([field, value]) => [
        field,
        typeof value === 'string' && value.trim() === '' ? null : value,
      ])
    );
    const adminClient = await createAdminClient();

    //gen emp ud
    if (!employeeData.employee_id) {
    const { data: existingEmployees, error: employeeIdError } = await adminClient
      .from('employees')
      .select('employee_id')
      .like('employee_id', 'TN%');

    if (employeeIdError) {
      throw new Error(
        `Failed to generate employee ID: ${employeeIdError.message}`
      );
    }

  let nextNumber = 5000;

  if (existingEmployees && existingEmployees.length > 0) {
    const numbers = existingEmployees
      .map((employee) => {
        const match = employee.employee_id?.match(/^TN(\d+)$/);
        return match ? Number(match[1]) : null;
      })
      .filter((number): number is number => number !== null);

    if (numbers.length > 0) {
      nextNumber = Math.max(...numbers) + 1;
    }
  }

  employeeData.employee_id = `TN${nextNumber}`;
}
  // Create Supabase Auth account for the employee so they can log in
  let authUserId = null;    
  if (employeeData.email) {
      const passwordToSet = initial_password || 'Employee@123';
      const fullName = `${employeeData.first_name || ''} ${employeeData.last_name || ''}`.trim() || 'Employee';

      try {
        const { data: authCreated, error: createError } = await adminClient.auth.admin.createUser({
          email: employeeData.email as string,
          password: passwordToSet,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role: 'employee',
          },
        });

        if (authCreated?.user) {
          authUserId = authCreated.user.id;
          employeeData.user_id = authUserId;

          // Ensure profile is set to role employee
          try {
            await adminClient.from('profiles').upsert({
              id: authUserId,
              email: employeeData.email as string,
              full_name: fullName,
              role: 'employee',
            });
          } catch (pe) {
            console.warn('Profile role warning:', pe);
          }
        } else if (createError && (createError.message.includes('already exists') || (createError as any).status === 422)) {
          // Look up existing user
          const { data: existingList } = await adminClient.auth.admin.listUsers();
          const found = existingList?.users?.find((u) => u.email === employeeData.email);
          if (found) {
            authUserId = found.id;
            employeeData.user_id = authUserId;
          }
        }
      } catch (authErr) {
        console.warn('Auth user creation warning:', authErr);
      }
  }

  console.log("EMPLOYEE DATA BEFORE CREATE:", {
      client_type: employeeData.client_type,
      company_name: employeeData.company_name,
  });

  // Save employee using DataStore and adminClient (bypassing RLS issues)
  const saved = await DataStore.createEmployee(employeeData as any);

  // =========================================================
  // INITIALIZE EMPLOYEE SALARY COMPONENTS
  // =========================================================

  if (saved?.id) {
    const defaultSalaryComponentCodes = [
      "BASIC",
      "HRA",
      "SPECIAL_ALLOWANCE",
      "PF",
      "ESI",
      "PT",
      "TDS",
    ];

    const {
      data: masterSalaryComponents,
      error: salaryComponentsError,
    } = await adminClient
      .from("salary_components")
      .select(`
        id,
        code,
        calculation_type,
        value,
        is_active
      `)
      .in("code", defaultSalaryComponentCodes)
      .eq("is_active", true);

    if (salaryComponentsError) {
      throw new Error(
        `Failed to load salary components: ${salaryComponentsError.message}`
      );
    }

    if (masterSalaryComponents?.length) {
      const employeeSalaryComponents = masterSalaryComponents.map(
        (component) => ({
          employee_id: saved.id,
          salary_component_id: component.id,
          calculation_type: component.calculation_type,
          value: Number(component.value || 0),
          is_active: true,

          gratuity_5_year_taken: false,
          gratuity_5_year_taken_date: null,
          gratuity_5_year_amount: 0,

          gratuity_10_year_taken: false,
          gratuity_10_year_taken_date: null,
          gratuity_10_year_amount: 0,
        })
      );

      const {
        error: employeeSalaryComponentsError,
      } = await adminClient
        .from("employee_salary_components")
        .insert(employeeSalaryComponents);

      if (employeeSalaryComponentsError) {
        throw new Error(
          `Failed to initialize employee salary components: ${employeeSalaryComponentsError.message}`
        );
      }
    }

    // =========================================================
    // INITIALIZE LEAVE BALANCES
    // =========================================================

    await DataStore.getLeaveBalances(saved.id);
  }

  return NextResponse.json({
      ...saved,
      credentials_provisioned: !!authUserId,
      login_email: employeeData.email,
    }, { status: 201 });
  } catch (error: any) {
    console.error('API Error creating employee:', error);
    return NextResponse.json({ error: error.message || 'Failed to create employee' }, { status: 500 });
  }
}

