import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';
import { DataStore } from '@/lib/data-store';

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

    const rawBody = await request.json();
    const { initial_password, ...fields } = rawBody;

    const employeeData = Object.fromEntries(
      Object.entries(fields).map(([field, value]) => [
        field,
        typeof value === 'string' && value.trim() === '' ? null : value,
      ])
    );

    // Create Supabase Auth account for the employee so they can log in
    let authUserId = null;
    const adminClient = await createAdminClient();

    if (employeeData.email) {
      const passwordToSet = initial_password || 'Employee@123';
      const fullName = `${employeeData.first_name || ''} ${employeeData.last_name || ''}`.trim() || 'Employee';

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
      } else if (createError && (createError.message.includes('already exists') || createError.status === 422)) {
        // Look up existing user
        const { data: existingList } = await adminClient.auth.admin.listUsers();
        const found = existingList?.users?.find(u => u.email === employeeData.email);
        if (found) {
          authUserId = found.id;
          employeeData.user_id = authUserId;
        }
      }
    }

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

    // Initialize leave balances for the newly added employee
    if (data?.id) {
      await DataStore.getLeaveBalances(data.id);
    }

    return NextResponse.json({
      ...data,
      credentials_provisioned: !!authUserId,
      login_email: employeeData.email,
    }, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
