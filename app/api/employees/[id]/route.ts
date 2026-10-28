import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { DataStore } from '@/lib/data-store';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;

    const employee = await DataStore.getEmployeeById(id);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    let documents: any[] = [];
    try {
      const supabase = await createAdminClient();
      const { data } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', id);
      documents = data || [];
    } catch {
      // ignore
    }

    return NextResponse.json({
      employee,
      documents,
    });
  } catch (error) {
    console.error('API Error in GET /api/employees/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const rawBody = await request.json();

    const updateData: Record<string, any> = Object.fromEntries(
      Object.entries(rawBody).map(([field, value]) => [
        field,
        typeof value === "string" && value.trim() === "" ? null : value,
      ])
    );

    const adminClient = await createAdminClient();

    const { data: currentEmployee, error: currentEmployeeError } =
      await adminClient
        .from("employees")
        .select(
          "id, user_id, first_name, last_name, status, temporary_login_days, temporary_login_expires_at, exit_date, resignation_date, notice_period_days, planned_last_working_date, notice_status"
          )
        .eq("id", id)
        .single();

    if (currentEmployeeError || !currentEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const oldStatus = String(currentEmployee.status ?? "").toLowerCase();

    let newStatus =
      typeof updateData.status === "string"
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
      newStatus === "on_notice" ||
      updateData.notice_status === "notice_period"
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
              "Provide a valid resignation date and notice period between 1 and 365 days.",
          },
          { status: 400 }
        );
      }

      const plannedDate = addCalendarDays(resignationDate, noticeDays);

      if (!plannedDate) {
        return NextResponse.json(
          { error: "Invalid resignation date." },
          { status: 400 }
        );
      }

      newStatus = "on_notice";

      updateData.status = "on_notice";
      updateData.resignation_date = resignationDate;
      updateData.notice_period_days = noticeDays;
      updateData.planned_last_working_date = plannedDate;
      updateData.notice_status = "notice_period";

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
      updateData.notice_status === "early_release" ||
      updateData.early_release_date
    ) {
      const releaseDate = updateData.early_release_date;
      const releaseReason = String(
        updateData.early_release_reason ?? ""
      ).trim();

      if (!releaseDate) {
        return NextResponse.json(
          { error: "Please provide the actual early-release date." },
          { status: 400 }
        );
      }

      if (!releaseReason) {
        return NextResponse.json(
          { error: "A reason is required for early release." },
          { status: 400 }
        );
      }

      if (Number.isNaN(new Date(`${releaseDate}T00:00:00.000Z`).getTime())) {
        return NextResponse.json(
          { error: "Invalid early-release date." },
          { status: 400 }
        );
      }

      if (
        oldStatus !== "on_notice" &&
        currentEmployee.notice_status !== "notice_period"
      ) {
        return NextResponse.json(
          { error: "Only employees in a notice period can be released early." },
          { status: 400 }
        );
      }

      newStatus = "resigned";

      updateData.status = "resigned";
      updateData.notice_status = "early_release";
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
    if (updateData.notice_status === "notice_completed") {
      const plannedDate =
        updateData.planned_last_working_date ??
        currentEmployee.planned_last_working_date;

      if (!plannedDate) {
        return NextResponse.json(
          { error: "The planned last working date is missing." },
          { status: 400 }
        );
      }

      if (
        oldStatus !== "on_notice" &&
        currentEmployee.notice_status !== "notice_period"
      ) {
        return NextResponse.json(
          { error: "Only employees in a notice period can complete it." },
          { status: 400 }
        );
      }

      newStatus = "resigned";
      updateData.status = "resigned";
      updateData.notice_status = "notice_completed";
      updateData.exit_date = plannedDate;
    }

    // ---------------------------------------------------------
    // LEGACY RESIGNED / LAID OFF / TERMINATED
    // Keep existing exit and temporary-login behavior.
    // ---------------------------------------------------------
    if (
      ["resigned", "laid_off", "terminated"].includes(newStatus) &&
      oldStatus !== newStatus
    ) {
      const loginDays = Number(updateData.temporary_login_days);

      if (
        !Number.isFinite(loginDays) ||
        loginDays < 0 ||
        loginDays > 45
      ) {
        return NextResponse.json(
          {
            error:
              "Temporary login access must be between 0 and 45 days.",
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
          { error: "Invalid exit date." },
          { status: 400 }
        );
      }

      expiryDate.setUTCDate(expiryDate.getUTCDate() + loginDays);

      updateData.temporary_login_days = loginDays;
      updateData.temporary_login_expires_at =
        expiryDate.toISOString();
    }

    // Active employees have permanent login access.
    if (newStatus === "active") {
      updateData.temporary_login_expires_at = null;
    }

    const updated = await DataStore.updateEmployee(id, updateData);

    if (!updated) {
      return NextResponse.json(
        { error: "Employee not found or update failed." },
        { status: 404 }
      );
    }


    // Notify the employee and HR when the notice period is completed.
    if ( updateData.notice_status === "notice_completed" && currentEmployee.notice_status !== "notice_completed") 
    {
      const employeeName = [
        currentEmployee.first_name,
        currentEmployee.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const { data: hrUsers, error: hrError } = await adminClient
        .from("profiles")
        .select("id")
        .eq("role", "hr");

      if (hrError) {
        console.error(
          "Failed to fetch HR recipients for notice completion:",
          hrError
        );
      }

      const notificationRows = [
        ...(currentEmployee.user_id
          ? [
              {
                employee_id: currentEmployee.id,
                recipient_user_id: currentEmployee.user_id,
                title: "Notice Period Completed",
                message: "Your notice period has been completed.",
                type: "resignation",
                is_read: false,
              },
            ]
          : []),
        ...(hrError
          ? []
          : (hrUsers ?? []).map((hr) => ({
              employee_id: currentEmployee.id,
              recipient_user_id: hr.id,
              title: "Notice Period Completed",
              message: `The notice period for ${employeeName || "an employee"} has been completed.`,
              type: "resignation",
              is_read: false,
            }))),
      ];

      if (notificationRows.length > 0) {
        const { error: notificationError } = await adminClient
          .from("notifications")
          .insert(notificationRows);

        if (notificationError) {
          console.error(
            "Failed to create notice-completion notifications:",
            notificationError
          );
        }
      }
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("API Error in PUT /api/employees/[id]:", error);

    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}


export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('API Error in DELETE /api/employees/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

