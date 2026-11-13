import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { DataStore } from '@/lib/data-store';


export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    // 1. Authenticate the requester.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    // 2. Verify the actual database role.
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 403 }
      );
    }

    const role = String(profile.role || "").toLowerCase();

    if (!["hr", "ceo", "employee"].includes(role)) {
      return NextResponse.json(
        { error: "You are not authorized to access this employee record." },
        { status: 403 }
      );
    }

    // 3. Fetch the requested employee.
    const employee = await DataStore.getEmployeeById(id);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    // 4. Employees can only access their own records.
    // Reporting managers must use a separate restricted team API.
    if (role === "employee") {
      const { data: currentEmployee, error: employeeError } =
        await adminClient
          .from("employees")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (
        employeeError ||
        !currentEmployee ||
        currentEmployee.id !== employee.id
      ) {
        return NextResponse.json(
          { error: "You are not authorized to access this employee record." },
          { status: 403 }
        );
      }
    }

    // 5. Fetch documents only after authorization.
    const { data: documents, error: documentsError } =
      await adminClient
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employee.id);

    if (documentsError) {
      console.error("Failed to fetch employee documents:", documentsError);

      return NextResponse.json(
        { error: "Failed to load employee documents." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      employee,
      documents: documents || [],
    });
  } catch (error) {
    console.error("API Error in GET /api/employees/[id]:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const rawBody = await request.json();

    const updateData: Record<string, unknown> = Object.fromEntries(
      Object.entries(rawBody).map(([field, value]) => [
        field,
        typeof value === 'string' && value.trim() === '' ? null : value,
      ])
    );

    // Reporting manager fields can only be changed through
    // dedicated, authorized reporting-manager APIs.
    const protectedManagerFields = [
      'reporting_manager_id',
      'is_reporting_manager',
    ];

    if (
      protectedManagerFields.some((field) =>
        Object.prototype.hasOwnProperty.call(updateData, field)
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Reporting manager assignments and permissions must be managed through the authorized reporting manager workflow.',
        },
        { status: 403 }
      );
    }

    // Retained shift/calendar settings are managed only by the server.
    delete updateData.retained_calendar_id;
    delete updateData.retained_shift_start_time;
    delete updateData.retained_shift_end_time;
    delete updateData.retained_grace_period_minutes;
    delete updateData.retained_half_day_cutoff_minutes;
    delete updateData.retained_project_id;

    const adminClient = await createAdminClient();

    // Validate department_id against the departments table.
    if (updateData.department_id) {
      const { data: department, error: departmentError } = await adminClient
        .from('departments')
        .select('id')
        .eq('id', updateData.department_id)
        .maybeSingle();

      if (departmentError) {
        throw new Error(
          `Failed to validate department: ${departmentError.message}`
        );
      }

      if (!department) {
        return NextResponse.json(
          {
            error:
              'Invalid department selected. Please select a valid department.',
          },
          { status: 400 }
        );
      }
    }

    // Fetch the existing employee record.
    const { data: currentEmployee, error: currentEmployeeError } =
      await adminClient
        .from('employees')
        .select(
          `
            id,
            user_id,
            first_name,
            last_name,
            status,
            temporary_login_days,
            temporary_login_expires_at,
            exit_date,
            resignation_date,
            notice_period_days,
            planned_last_working_date,
            notice_status,
            early_release_date,
            early_release_reason,
            project_id,
            retained_calendar_id,
            retained_project_id,
            retained_shift_start_time,
            retained_shift_end_time,
            retained_grace_period_minutes,
            retained_half_day_cutoff_minutes,
            early_release_by,
            early_release_recorded_at
          `
        )
        .eq('id', id)
        .single();

    if (currentEmployeeError || !currentEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // AUTHENTICATION AND AUTHORIZATION
    // Only HR and CEO can modify resignation / exit details.
    // Non-admin users can only update their own employee record.
    // ---------------------------------------------------------

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Failed to verify user role:', profileError);

      return NextResponse.json(
        { error: 'Unable to verify user permissions.' },
        { status: 403 }
      );
    }

    const userRole = String(profile.role || '').toLowerCase();
    const isAdmin = ['hr', 'ceo'].includes(userRole);

    // Non-admin users can only update their own employee record.
    if (!isAdmin && currentEmployee.user_id !== user.id) {
      return NextResponse.json(
        {
          error: 'You are not authorized to update this employee record.',
        },
        { status: 403 }
      );
    }

    // Fields that only HR and CEO can change.
    const adminOnlyFields = [
      'project_id',
      'status',
      'notice_status',
      'resignation_date',
      'notice_period_days',
      'planned_last_working_date',
      'early_release_date',
      'early_release_reason',
      'early_release_by',
      'early_release_recorded_at',
      'exit_date',
      'temporary_login_days',
      'temporary_login_expires_at',
    ];

    const currentValues =
      currentEmployee as unknown as Record<string, unknown>;

    const hasAdminOnlyChanges = adminOnlyFields.some((field) => {
      if (!Object.prototype.hasOwnProperty.call(updateData, field)) {
        return false;
      }

      const oldValue = currentValues[field];
      const newValue = updateData[field];

      return String(oldValue ?? '') !== String(newValue ?? '');
    });

    if (hasAdminOnlyChanges && !isAdmin) {
      return NextResponse.json(
        {
          error:
            'Only HR and CEO can update resignation, notice-period, and exit details.',
        },
        { status: 403 }
      );
    }


    // ---------------------------------------------------------
    // RETAIN PROJECT CALENDAR AND SHIFT SETTINGS
    // Preserve the latest project settings when an employee
    // moves to bench or changes project assignments.
    // ---------------------------------------------------------

    const isProjectAssignmentUpdate =
      Object.prototype.hasOwnProperty.call(updateData, 'project_id');

    const projectAssignmentChanged =
      isProjectAssignmentUpdate &&
      String(currentEmployee.project_id ?? '') !==
        String(updateData.project_id ?? '');

    if (projectAssignmentChanged) {
      // When assigning a new project, retain its settings.
      // When removing the project, retain the previous project's settings.
      const projectIdToRetain =
        updateData.project_id || currentEmployee.project_id;

      if (projectIdToRetain) {
        const { data: project, error: projectError } =
          await adminClient
            .from('projects')
            .select(`
              id,
              calendar_id,
              shift_start_time,
              shift_end_time,
              grace_period_minutes,
              half_day_cutoff_minutes
            `)
            .eq('id', projectIdToRetain)
            .maybeSingle();

        if (projectError) {
          throw new Error(
            `Failed to fetch project shift settings: ${projectError.message}`
          );
        }

        if (!project) {
          return NextResponse.json(
            { error: 'Selected project was not found.' },
            { status: 400 }
          );
        }

        if (
          !project.calendar_id ||
          !project.shift_start_time ||
          !project.shift_end_time
        ) {
          return NextResponse.json(
            {
              error:
                'The project must have a holiday calendar and shift timings configured.',
            },
            { status: 400 }
          );
        }

        updateData.retained_project_id = project.id;
        updateData.retained_calendar_id = project.calendar_id;
        updateData.retained_shift_start_time = project.shift_start_time;
        updateData.retained_shift_end_time = project.shift_end_time;
        updateData.retained_grace_period_minutes =
          project.grace_period_minutes;
        updateData.retained_half_day_cutoff_minutes =
          project.half_day_cutoff_minutes;
      }
    }



    const oldStatus = String(currentEmployee.status ?? '').toLowerCase();

    let newStatus =
      typeof updateData.status === 'string'
        ? updateData.status.toLowerCase()
        : oldStatus;

    // Calculate dates using calendar days in UTC.
    const addCalendarDays = (dateString: string, days: number) => {
      const date = new Date(`${dateString}T00:00:00.000Z`);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      date.setUTCDate(date.getUTCDate() + days);

      return date.toISOString().slice(0, 10);
    };

    // ---------------------------------------------------------
    // START RESIGNATION / NOTICE PERIOD
    // ---------------------------------------------------------

    if (
      newStatus === 'on_notice' ||
      updateData.notice_status === 'notice_period'
    ) {
      const resignationDate =
        updateData.resignation_date ??
        currentEmployee.resignation_date;

      const noticeDays = Number(
        updateData.notice_period_days ??
        currentEmployee.notice_period_days
      );

      if (
        !resignationDate ||
        !Number.isInteger(noticeDays) ||
        noticeDays < 1 ||
        noticeDays > 365
      ) {
        return NextResponse.json(
          {
            error:
              'Provide a valid resignation date and notice period between 1 and 365 days.',
          },
          { status: 400 }
        );
      }

      const plannedDate = addCalendarDays(resignationDate, noticeDays);

      if (!plannedDate) {
        return NextResponse.json(
          { error: 'Invalid resignation date.' },
          { status: 400 }
        );
      }

      newStatus = 'resigned';

      updateData.status = 'resigned';
      updateData.resignation_date = resignationDate;
      updateData.notice_period_days = noticeDays;
      updateData.planned_last_working_date = plannedDate;
      updateData.notice_status = 'notice_period';

      // The planned date is not the actual exit yet.
      updateData.exit_date = null;
      updateData.early_release_date = null;
      updateData.early_release_reason = null;
      updateData.early_release_by = null;
      updateData.early_release_recorded_at = null;
    }

    // ---------------------------------------------------------
    // EARLY RELEASE
    // The actual release date becomes the final exit date.
    // ---------------------------------------------------------

    if (
      updateData.notice_status === 'early_release' ||
      updateData.early_release_date
    ) {
      const releaseDate = updateData.early_release_date;

      const releaseReason = String(
        updateData.early_release_reason ?? ''
      ).trim();

      if (!releaseDate) {
        return NextResponse.json(
          { error: 'Please provide the actual early-release date.' },
          { status: 400 }
        );
      }

      if (!releaseReason) {
        return NextResponse.json(
          { error: 'A reason is required for early release.' },
          { status: 400 }
        );
      }

      if (
        Number.isNaN(
          new Date(`${releaseDate}T00:00:00.000Z`).getTime()
        )
      ) {
        return NextResponse.json(
          { error: 'Invalid early-release date.' },
          { status: 400 }
        );
      }

      if (
        oldStatus !== 'on_notice' &&
        currentEmployee.notice_status !== 'notice_period'
      ) {
        return NextResponse.json(
          {
            error:
              'Only employees in a notice period can be released early.',
          },
          { status: 400 }
        );
      }

      newStatus = 'resigned';

      updateData.status = 'resigned';
      updateData.notice_status = 'early_release';
      updateData.early_release_date = releaseDate;
      updateData.early_release_reason = releaseReason;
      updateData.exit_date = releaseDate;

      updateData.planned_last_working_date =
        updateData.planned_last_working_date ??
        currentEmployee.planned_last_working_date;

      updateData.early_release_recorded_at = new Date().toISOString();

      // Never allow an early release to use the planned date as exit_date.
    }

    // ---------------------------------------------------------
    // COMPLETE NOTICE PERIOD
    // ---------------------------------------------------------

    if (updateData.notice_status === 'notice_completed') {
      const plannedDate =
        updateData.planned_last_working_date ??
        currentEmployee.planned_last_working_date;

      if (!plannedDate) {
        return NextResponse.json(
          { error: 'The planned last working date is missing.' },
          { status: 400 }
        );
      }

      if (
        oldStatus !== 'on_notice' &&
        currentEmployee.notice_status !== 'notice_period'
      ) {
        return NextResponse.json(
          {
            error: 'Only employees in a notice period can complete it.',
          },
          { status: 400 }
        );
      }

      newStatus = 'resigned';

      updateData.status = 'resigned';
      updateData.notice_status = 'notice_completed';
      updateData.exit_date = plannedDate;
    }

    // ---------------------------------------------------------
    // LEGACY RESIGNED / LAID OFF / TERMINATED
    // Keep existing exit and temporary-login behavior.
    // ---------------------------------------------------------

    const isStartingNoticePeriod =
      updateData.notice_status === 'notice_period' &&
      currentEmployee.notice_status !== 'notice_period';

    const isCompletingNoticePeriod =
      ['notice_completed', 'early_release'].includes(
        String(updateData.notice_status || '')
      ) &&
      currentEmployee.notice_status === 'notice_period';

    const isLegacyExit =
      ['resigned', 'laid_off', 'terminated'].includes(newStatus) &&
      oldStatus !== newStatus &&
      !isStartingNoticePeriod &&
      !isCompletingNoticePeriod;

    if (isLegacyExit || isCompletingNoticePeriod) {
      const loginDays = Number(updateData.temporary_login_days);

      if (
        !Number.isFinite(loginDays) ||
        loginDays < 0 ||
        loginDays > 45
      ) {
        return NextResponse.json(
          {
            error:
              'Temporary login access must be between 0 and 45 days.',
          },
          { status: 400 }
        );
      }

      const finalExitDate = updateData.exit_date;

      const expiryDate = finalExitDate
        ? new Date(`${finalExitDate}T23:59:59.000Z`)
        : new Date();

      if (Number.isNaN(expiryDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid exit date.' },
          { status: 400 }
        );
      }

      expiryDate.setUTCDate(expiryDate.getUTCDate() + loginDays);

      updateData.temporary_login_days = loginDays;
      updateData.temporary_login_expires_at =
        expiryDate.toISOString();
    }

    // Active employees have permanent login access.
    if (newStatus === 'active') {
      updateData.temporary_login_expires_at = null;
    }

    // Update employee.
    const updated = await DataStore.updateEmployee(id, updateData);

    if (!updated) {
      return NextResponse.json(
        { error: 'Employee not found or update failed.' },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // NOTIFICATIONS
    // Notify employee and HR when notice period is completed.
    // ---------------------------------------------------------

    if (
      updateData.notice_status === 'notice_completed' &&
      currentEmployee.notice_status !== 'notice_completed'
    ) {
      const employeeName = [
        currentEmployee.first_name,
        currentEmployee.last_name,
      ]
        .filter(Boolean)
        .join(' ');

      const { data: hrUsers, error: hrError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('role', 'hr');

      if (hrError) {
        console.error(
          'Failed to fetch HR recipients for notice completion:',
          hrError
        );
      }

      const notificationRows = [
        ...(currentEmployee.user_id
          ? [
              {
                employee_id: currentEmployee.id,
                recipient_user_id: currentEmployee.user_id,
                title: 'Notice Period Completed',
                message: 'Your notice period has been completed.',
                type: 'resignation',
                is_read: false,
              },
            ]
          : []),

        ...(hrError
          ? []
          : (hrUsers ?? []).map((hr) => ({
              employee_id: currentEmployee.id,
              recipient_user_id: hr.id,
              title: 'Notice Period Completed',
              message: `The notice period for ${
                employeeName || 'an employee'
              } has been completed.`,
              type: 'resignation',
              is_read: false,
            }))),
      ];

      if (notificationRows.length > 0) {
        const { error: notificationError } = await adminClient
          .from('notifications')
          .insert(notificationRows);

        if (notificationError) {
          console.error(
            'Failed to create notice-completion notifications:',
            notificationError
          );
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('API Error in PUT /api/employees/[id]:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
