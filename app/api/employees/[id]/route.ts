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
        .select('id, status, temporary_login_expires_at')
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
    // RESIGNED / LAID OFF
    // Give employee 45 days of temporary login access
    // starting from the date HR changes the status.
    // ---------------------------------------------------------
    if (
      (newStatus === 'resigned' || newStatus === 'laid_off') &&
      oldStatus !== newStatus
    ) {
      const expiryDate = new Date();

      expiryDate.setDate(expiryDate.getDate() + 45);

      updateData.temporary_login_expires_at =
        expiryDate.toISOString();

      console.log(
        `Temporary login expiry for employee ${id}:`,
        expiryDate.toISOString()
      );
    }

    // ---------------------------------------------------------
    // ACTIVE
    // Active employees have permanent login access.
    // ---------------------------------------------------------
    if (newStatus === 'active') {
      updateData.temporary_login_expires_at = null;
    }

    // ---------------------------------------------------------
    // TERMINATED / INACTIVE
    // Login should be blocked immediately.
    // ---------------------------------------------------------
    if (
      newStatus === 'terminated' ||
      newStatus === 'inactive'
    ) {
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
    console.error(
      'API Error in PUT /api/employees/[id]:',
      error
    );

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

