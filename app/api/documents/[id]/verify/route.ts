import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required.' },
        { status: 400 }
      );
    }

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

    // Only HR and CEO can review documents.
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
        { error: 'Only HR and CEO can review documents.' },
        { status: 403 }
      );
    }

    // Validate the request.
    let body: {
      decision?: string;
      notes?: string | null;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const decision = body.decision?.toLowerCase();
    const notes =
      typeof body.notes === 'string' ? body.notes.trim() : null;

    if (!['approve', 'reject'].includes(decision ?? '')) {
      return NextResponse.json(
        { error: 'Decision must be approve or reject.' },
        { status: 400 }
      );
    }

    if (notes && notes.length > 2000) {
      return NextResponse.json(
        { error: 'Review notes cannot exceed 2000 characters.' },
        { status: 400 }
      );
    }

    // Perform the review atomically in PostgreSQL.
    // The database function must validate HR/CEO permissions too.
    const { data, error } = await supabase.rpc(
      'review_employee_document',
      {
        p_document_id: id,
        p_decision: decision,
        p_review_notes: notes,
      }
    );

    if (error) {
      console.error('Document review failed:', error.message);

      return NextResponse.json(
        { error: error.message || 'Failed to review document.' },
        { status: 400 }
      );
    }

    revalidatePath('/dashboard/employees');
    revalidatePath('/dashboard/approvals');

    
    const documentStatus = String(
    data?.verification_status ?? ''
    ).toLowerCase();

    let message: string;

    if (decision === 'reject') {
    message = 'Document rejected successfully.';
    } else if (documentStatus === 'verified') {
    message =
        'Document verified. Profile-change approval is still required.';
    } else if (documentStatus === 'approved') {
    message =
        'Document approved successfully. Supported employee fields have been updated.';
    } else {
    message = 'Document review completed.';
    }

    return NextResponse.json({
    success: true,
    message,
    document: data,
    });
  } catch (error) {
    console.error('Document verification API error:', error);

    return NextResponse.json(
      { error: 'An unexpected error occurred while reviewing the document.' },
      { status: 500 }
    );
  }
}