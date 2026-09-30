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

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Invalid login credentials' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
      const temporaryLoginStatuses = [
        'pending',
        'probation',
        'resigned',
        'laid_off',
      ];

      // Get employee record
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, status, user_id, temporary_login_expires_at')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (employeeError) {
        console.error('Employee lookup error:', employeeError);
      }

      if (employee) {
        const employeeStatus = employee.status?.toLowerCase();

        // Active employees can always log in
        if (employeeStatus === 'active') {
          // No expiry check required
        }

        // Pending, probation, resigned and laid_off
        // can log in only until temporary_login_expires_at
        else if (temporaryLoginStatuses.includes(employeeStatus)) {
          if (
            !employee.temporary_login_expires_at ||
            new Date() > new Date(employee.temporary_login_expires_at)
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

        // Terminated, inactive, or any other status
        // cannot log in
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

    // Determine role and appropriate landing destination
    const role = profile?.role || (authData.user.user_metadata?.role) || 'employee';
    const redirectTo = role === 'employee' ? '/portal/profile' : '/dashboard';

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
