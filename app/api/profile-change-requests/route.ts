
import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-server';

const SENSITIVE_DOCUMENT_TYPES = [
  'aadhar card',
  'aadhaar card',
  'pan card',
  'passport',
  'bank passbook',
];

const SENSITIVE_PROFILE_FIELDS = [
  'bank_name',
  'bank_account_number',
  'ifsc_code',
  'aadhar_number',
  'aadhaar_number',
  'pan_number',
  'passport_number',
];

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const requests = await DataStore.getProfileChangeRequests();
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json();

    console.log('[PROFILE CHANGE REQUEST] Incoming payload:', {
      employeeId: body.employeeId,
      requestedChanges: body.requestedChanges,
      sensitiveDocumentIds: body.sensitiveDocumentIds,
    });

    const {
      employeeId,
      requestedChanges,
      previousValues,
      sensitiveDocumentIds = {},
    } = body;

    if (
      !employeeId ||
      !requestedChanges ||
      typeof requestedChanges !== 'object' ||
      Array.isArray(requestedChanges)
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid employeeId or requestedChanges.' },
        { status: 400 },
      );
    }

    if (
      !sensitiveDocumentIds ||
      typeof sensitiveDocumentIds !== 'object' ||
      Array.isArray(sensitiveDocumentIds)
    ) {
      return NextResponse.json(
        { error: 'Invalid sensitiveDocumentIds.' },
        { status: 400 },
      );
    }

    const hasSensitiveChanges = Object.keys(requestedChanges).some(
      (field) => SENSITIVE_PROFILE_FIELDS.includes(field),
    );

    const documentEntries = Object.entries(sensitiveDocumentIds) as [
      string,
      string,
    ][];

    const normalizedDocuments = documentEntries.map(
      ([documentType, documentId]) => ({
        documentType: documentType.trim().toLowerCase(),
        documentId: String(documentId ?? '').trim(),
      }),
    );

    if (
      hasSensitiveChanges &&
      normalizedDocuments.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Upload the supporting identity or bank document before submitting these sensitive profile changes.',
        },
        { status: 400 },
      );
    }

    if (
      normalizedDocuments.some(
        ({ documentType, documentId }) =>
          !SENSITIVE_DOCUMENT_TYPES.includes(documentType) ||
          !documentId,
      )
    ) {
      return NextResponse.json(
        { error: 'Invalid sensitive document type or ID.' },
        { status: 400 },
      );
    }

    const admin = await createAdminClient();

    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) {
      throw employeeError;
    }

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found.' },
        { status: 404 },
      );
    }

    // Validate every document before creating the request.
    for (const item of normalizedDocuments) {
      const { data: document, error: documentError } = await admin
        .from('employee_documents')
        .select('id, employee_id, document_type, verification_status, profile_change_request_id')
        .eq('id', item.documentId)
        .maybeSingle();

      if (documentError) {
        throw documentError;
      }

      if (
        !document ||
        String(document.employee_id) !== String(employeeId) ||
        String(document.document_type ?? '').trim().toLowerCase() !==
          item.documentType
      ) {
        return NextResponse.json(
          {
            error:
              'A supporting document does not match this employee or document type.',
          },
          { status: 400 },
        );
      }

      if (
        String(document.verification_status ?? '').toLowerCase() !==
          'pending' ||
        document.profile_change_request_id
      ) {
        return NextResponse.json(
          {
            error:
              'A supporting document is no longer pending or is already linked to another request. Refresh and upload again if needed.',
          },
          { status: 409 },
        );
      }
    }

    const newRequest = await DataStore.createProfileChangeRequest({
      employeeId,
      requestedChanges,
      previousValues,
    });

    if (!newRequest?.id || String(newRequest.id).startsWith('pcr-')) {
      return NextResponse.json(
        {
          error:
            'The profile-change request could not be saved to the database. No documents were linked.',
        },
        { status: 500 },
      );
    }

    // Link each submitted document to this exact profile-change request.
    for (const item of normalizedDocuments) {
      const { data: linkedDocument, error: linkError } = await admin
        .from('employee_documents')
        .update({
          profile_change_request_id: newRequest.id,
          profile_change_approved: false,
        })
        .eq('id', item.documentId)
        .eq('employee_id', employeeId)
        .eq('verification_status', 'pending')
        .is('profile_change_request_id', null)
        .select('id')
        .maybeSingle();

      if (linkError) {
        throw linkError;
      }

      if (!linkedDocument) {
        throw new Error(
          'A supporting document could not be linked. Please contact HR before retrying.',
        );
      }
    }

    return NextResponse.json(
      { success: true, request: newRequest },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Profile-change request error:', error);

    return NextResponse.json(
      { error: error.message || 'Unable to submit profile-change request.' },
      { status: 500 },
    );
  }
}