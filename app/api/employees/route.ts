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

    // Save employee using DataStore and adminClient (bypassing RLS issues)
    const saved = await DataStore.createEmployee(employeeData as any);

    // Initialize leave balances for the newly added employee
    if (saved?.id) {
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

