import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const employment_type = searchParams.get('employment_type');

    let query = supabase
      .from('employees')
      .select(`
        *,
        department:departments(id, name)
      `)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`);
    }
    
    if (department) {
      query = query.eq('department_id', department);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (employment_type) {
      query = query.eq('employment_type', employment_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employees:', error);
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeData = Object.fromEntries(
      Object.entries(await request.json()).map(([field, value]) => [
        field,
        typeof value === 'string' && value.trim() === '' ? null : value,
      ])
    );

    const { data, error } = await supabase
      .from('employees')
      .insert(employeeData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        if (error.message.includes('employee_id')) {
          return NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 });
        }
        if (error.message.includes('email')) {
          return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Record already exists' }, { status: 409 });
      }
      console.error('Error creating employee:', error);
      return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
