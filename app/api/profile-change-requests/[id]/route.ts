import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const role = String(profile.role ?? '').trim().toLowerCase();

    if (!['hr', 'ceo'].includes(role)) {
      return NextResponse.json(
        { error: 'Only HR and CEO can review profile changes.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, rejectionReason } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const success = await DataStore.reviewProfileChangeRequest({
      requestId: id,
      status,
      reviewerId: user.id,
      rejectionReason,
    });

    if (!success) {
      return NextResponse.json({ error: 'Profile change request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
