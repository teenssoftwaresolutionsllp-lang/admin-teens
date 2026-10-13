
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Verify the logged-in user.
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

    // Only HR and CEO can view pending document requests.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Unable to verify user permissions.' },
        { status: 403 }
      );
    }

    const role = String(profile.role ?? '').toLowerCase();

    if (!['hr', 'ceo'].includes(role)) {
      return NextResponse.json(
        { error: 'Only HR and CEO can view pending documents.' },
        { status: 403 }
      );
    }

    // Fetch all documents awaiting review.
    const { data: documents, error: documentsError } = await supabase
      .from('employee_documents')
      .select(`
        id,
        employee_id,
        document_type,
        document_name,
        document_url,
        verification_status,
        previous_document_id,
        uploaded_at,
        bank_name,
        bank_account_number,
        ifsc_code,
        aadhaar_number,
        pan_number,
        passport_number
      `)
      .eq('verification_status', 'pending')
      .order('uploaded_at', { ascending: false });

    if (documentsError) {
      console.error(
        'Failed to fetch pending documents:',
        documentsError.message
      );

      return NextResponse.json(
        { error: 'Failed to load pending documents.' },
        { status: 500 }
      );
    }

    // Fetch employee details separately to avoid assuming a
    // foreign-key relationship name in the Supabase schema.
    const employeeIds = [
      ...new Set((documents ?? []).map((doc) => doc.employee_id)),
    ];

    let employeesById: Record<string, Record<string, unknown>> = {};

    if (employeeIds.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, employee_id, first_name, last_name, email')
        .in('id', employeeIds);

      if (employeesError) {
        console.error(
          'Failed to fetch document employees:',
          employeesError.message
        );

        return NextResponse.json(
          { error: 'Failed to load employee details.' },
          { status: 500 }
        );
      }

      employeesById = Object.fromEntries(
        (employees ?? []).map((employee) => [
          employee.id,
          employee as Record<string, unknown>,
        ])
      );
    }

    const result = (documents ?? []).map((document) => ({
      ...document,
      employee: employeesById[document.employee_id] ?? null,
    }));

    return NextResponse.json(
      { success: true, documents: result },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Pending documents API error:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred while loading pending documents.' },
      { status: 500 }
    );
  }
}