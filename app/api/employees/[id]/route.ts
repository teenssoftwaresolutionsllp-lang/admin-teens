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

    const updateData = Object.fromEntries(
      Object.entries(await request.json()).map(([field, value]) => [
        field,
        typeof value === 'string' && value.trim() === '' ? null : value,
      ])
    );

    const updated = await DataStore.updateEmployee(id, updateData);

    if (!updated) {
      return NextResponse.json({ error: 'Employee not found or update failed' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('API Error in PUT /api/employees/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;

    await DataStore.deleteEmployee(id);
    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('API Error in DELETE /api/employees/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

