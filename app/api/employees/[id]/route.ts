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
    const params = await props.params;
    const { id } = params;

    const rawBody = await request.json();

    const updateData = Object.fromEntries(
      Object.entries(rawBody).map(([field, value]) => [
        field,
        typeof value === 'string' && value.trim() === '' ? null : value,
      ])
    );

    // Get the current employee before updating
    const adminClient = await createAdminClient();

    const { data: currentEmployee, error: currentEmployeeError } =
      await adminClient
        .from('employees')
        .select('id, status, temporary_login_days,temporary_login_expires_at')
        .eq('id', id)
        .single();

    if (currentEmployeeError || !currentEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const oldStatus = currentEmployee.status?.toLowerCase();

    const newStatus =
      typeof updateData.status === 'string'
        ? updateData.status.toLowerCase()
        : oldStatus;

    // ---------------------------------------------------------
    // RESIGNED / LAID OFF / TERMINATED
    // Give employee 45 days of temporary login access
    // HR can give temporary login access from 0 to 45 days.
    // ---------------------------------------------------------
    if (
      (newStatus === 'resigned' || newStatus === 'laid_off' || newStatus === 'terminated') &&
      oldStatus !== newStatus
    ) {
      const loginDays = Number(updateData.temporary_login_days);
      if (!Number.isFinite(loginDays) || loginDays < 0 || loginDays > 45) {
        return NextResponse.json(
          {
            error: 'Temporary login access must be between 0 and 45 days.',
          },
          { status: 400 }
        );
      }

      // Use Exit Date if provided.
      // Otherwise use today's date.
      const expiryDate = updateData.exit_date ? new Date(`${updateData.exit_date}T23:59:59`) : new Date();

      if (Number.isNaN(expiryDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid exit date',
          },
          { status: 400 }
        );
      }

      // Calculate expiry date
      expiryDate.setDate(expiryDate.getDate() + loginDays);

      // Store both values in employees table
      updateData.temporary_login_days = loginDays;
      updateData.temporary_login_expires_at = expiryDate.toISOString();
      console.log(`Employee ${id} will have login access for ${loginDays} days.`,`Login expires: ${expiryDate.toISOString()}`)

    }

    // ---------------------------------------------------------
    // ACTIVE
    // Active employees have permanent login access.
    // ---------------------------------------------------------
    if (newStatus === 'active') {
      updateData.temporary_login_expires_at = null;
    }


    // ---------------------------------------------------------
    // UPDATE EMPLOYEE
    // ---------------------------------------------------------
    const updated = await DataStore.updateEmployee(
      id,
      updateData
    );

    if (!updated) {
      return NextResponse.json(
        {
          error: 'Employee not found or update failed',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('API Error in PUT /api/employees/[id]:',error);
    console.error('Error message:', error?.message);
    console.error('Error details:', error?.details);
    console.error('Error hint:', error?.hint);
    console.error('Error code:', error?.code);

    return NextResponse.json(
      {
        error: error?.message || 'Internal server error',
      },
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

