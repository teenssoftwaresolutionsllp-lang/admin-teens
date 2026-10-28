
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Invalid login credentials' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();

      return NextResponse.json(
        { error: 'Unable to verify your account. Please contact HR.' },
        { status: 500 }
      );
    }

    const temporaryLoginStatuses = [
      'pending',
      'probation',
      'resigned',
      'laid_off',
    ];

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select(
        'id, status, user_id, temporary_login_expires_at, planned_last_working_date'
      )
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (employeeError) {
      console.error('Employee lookup error:', employeeError);
      await supabase.auth.signOut();

      return NextResponse.json(
        { error: 'Unable to verify employee login eligibility.' },
        { status: 500 }
      );
    }

    if (employee) {
      const employeeStatus = employee.status?.trim().toLowerCase();

      // Active employees retain permanent login access.
      if (employeeStatus === 'active') {
        // No expiry check required.
      }

      // Employees on notice can log in through the end of
      // their planned last working date.
      else if (employeeStatus === 'on_notice') {
        const lastWorkingDate = employee.planned_last_working_date;

        const expiry = lastWorkingDate
          ? new Date(`${lastWorkingDate}T23:59:59.999Z`)
          : null;

        if (
          !expiry ||
          Number.isNaN(expiry.getTime()) ||
          new Date() > expiry
        ) {
          await supabase.auth.signOut();

          return NextResponse.json(
            {
              error:
                'Your notice-period login access has expired. Please contact HR.',
            },
            { status: 403 }
          );
        }
      }

      // Temporary login statuses require a valid expiry date.
      else if (temporaryLoginStatuses.includes(employeeStatus ?? '')) {
        const expiry = employee.temporary_login_expires_at
          ? new Date(employee.temporary_login_expires_at)
          : null;

        if (
          !expiry ||
          Number.isNaN(expiry.getTime()) ||
          new Date() > expiry
        ) {
          await supabase.auth.signOut();

          return NextResponse.json(
            {
              error:
                'Your temporary login credentials have expired. Please contact HR.',
            },
            { status: 403 }
          );
        }
      }

      // Terminated, inactive, and unsupported statuses remain blocked.
      else {
        await supabase.auth.signOut();

        return NextResponse.json(
          {
            error:
              'Your account is not currently eligible for login. Please contact HR.',
          },
          { status: 403 }
        );
      }
    }

    const role =
      profile?.role ||
      authData.user.user_metadata?.role ||
      'employee';

    const redirectTo =
      role === 'employee' ? '/portal/profile' : '/dashboard';

    return NextResponse.json({
      user: authData.user,
      profile: profile || null,
      role,
      redirectTo,
    });
  } catch (error) {
    console.error('Login error:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred during login' },
      { status: 500 }
    );
  }
}
