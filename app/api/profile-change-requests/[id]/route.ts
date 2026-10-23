import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient, createAdminClient } from '@/lib/supabase-server';

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

    let notificationCreated = false;

    try {
      const admin = await createAdminClient();
      const { data: changeRequest, error: requestError } = await admin
        .from('profile_change_requests')
        .select('employee_id')
        .eq('id', id)
        .maybeSingle();

      if (requestError) {
        throw requestError;
      }

      if (changeRequest?.employee_id) {
        const title =
          status === 'approved'
            ? 'Personal Details Request Approved'
            : 'Personal Details Request Rejected';

        const message =
          status === 'approved'
            ? 'Your personal details change request has been approved by HR.'
            : `Your personal details change request has been rejected by HR.${
                rejectionReason?.trim()
                  ? ` Reason: ${rejectionReason.trim()}`
                  : ''
              }`;

        const { error: notificationError } = await admin
          .from('notifications')
          .insert({
            employee_id: changeRequest.employee_id,
            title,
            message,
            type: 'profile_change',
            is_read: false,
          });

        if (notificationError) {
          throw notificationError;
        }

        notificationCreated = true;
      }
    } catch (notificationError) {
      // A notification failure should not undo a successful review.
      console.error(
        'Profile-change notification failed:',
        notificationError
      );
    }

    return NextResponse.json({ 
      success: true ,
      notificationCreated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
