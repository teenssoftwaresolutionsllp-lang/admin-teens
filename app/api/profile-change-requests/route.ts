
import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import {
  createClient,
  createAdminClient,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ======================================================
// CONSTANTS
// ======================================================

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

const CERTIFICATION_DOCUMENT_TYPE =
  'professional certification';

const CERTIFICATION_TEXT_FIELDS = [
  'professional_certification_name',
  'professional_certification_organization',
  'professional_certification_credential_id',
];

const CERTIFICATION_DATE_FIELDS = [
  'professional_certification_issue_date',
  'professional_certification_expiry_date',
];

// These fields are updated directly.
// They do not require HR approval.
const DIRECT_UPDATE_FIELDS = [
  ...CERTIFICATION_TEXT_FIELDS,
  ...CERTIFICATION_DATE_FIELDS,
  'technical_skills',
];

// ======================================================
// DATE VALIDATION
// ======================================================

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// ======================================================
// GET PROFILE CHANGE REQUESTS
// HR AND CEO ONLY
// ======================================================

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

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: 'Unable to verify user permissions.',
        },
        { status: 403 },
      );
    }

    const role = String(profile.role ?? '')
      .trim()
      .toLowerCase();

    if (!['hr', 'ceo'].includes(role)) {
      return NextResponse.json(
        {
          error:
            'Only HR and CEO can view profile change requests.',
        },
        { status: 403 },
      );
    }

    const requests =
      await DataStore.getProfileChangeRequests();

    return NextResponse.json(requests);
  } catch (error: unknown) {
    console.error(
      'GET profile change requests error:',
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load profile change requests.',
      },
      { status: 500 },
    );
  }
}

// ======================================================
// POST PROFILE CHANGE REQUEST
// ======================================================

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // AUTHENTICATE USER
    // --------------------------------------------------

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

    // --------------------------------------------------
    // READ REQUEST BODY
    // --------------------------------------------------

    const body = await request.json();

    console.log(
      '[PROFILE CHANGE REQUEST] Incoming payload:',
      {
        employeeId: body.employeeId,
        requestedChanges: body.requestedChanges,
        sensitiveDocumentIds:
          body.sensitiveDocumentIds,
        certificationDocumentId:
          body.certificationDocumentId,
      },
    );

    const {
      employeeId,
      requestedChanges,
      previousValues,
      sensitiveDocumentIds = {},
      certificationDocumentId,
    } = body;

    // --------------------------------------------------
    // VALIDATE REQUEST BODY
    // --------------------------------------------------

    if (
      !employeeId ||
      !requestedChanges ||
      typeof requestedChanges !== 'object' ||
      Array.isArray(requestedChanges)
    ) {
      return NextResponse.json(
        {
          error:
            'Missing or invalid employeeId or requestedChanges.',
        },
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

    if (
      Object.keys(requestedChanges).length === 0
    ) {
      return NextResponse.json(
        {
          error: 'No profile changes were submitted.',
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // VERIFY LOGGED-IN EMPLOYEE
    // --------------------------------------------------

    const employeeRecord =
      (await DataStore.getEmployeeByUserId(user.id)) ??
      (user.email
        ? await DataStore.getEmployeeByEmail(user.email)
        : null);

    if (
      !employeeRecord ||
      String(employeeRecord.id) !== String(employeeId)
    ) {
      return NextResponse.json(
        {
          error:
            'The profile change request does not match your employee account.',
        },
        { status: 403 },
      );
    }

    // --------------------------------------------------
    // VALIDATE CERTIFICATION TEXT FIELDS
    // --------------------------------------------------

    for (const field of CERTIFICATION_TEXT_FIELDS) {
      if (
        Object.prototype.hasOwnProperty.call(
          requestedChanges,
          field,
        )
      ) {
        const value = requestedChanges[field];

        if (typeof value !== 'string') {
          return NextResponse.json(
            {
              error: `${field.replaceAll('_', ' ')} must be text.`,
            },
            { status: 400 },
          );
        }

        requestedChanges[field] = value.trim();
      }
    }

    // --------------------------------------------------
    // VALIDATE CERTIFICATION DATE FIELDS
    // --------------------------------------------------

    for (const field of CERTIFICATION_DATE_FIELDS) {
      if (
        Object.prototype.hasOwnProperty.call(
          requestedChanges,
          field,
        )
      ) {
        const value = requestedChanges[field];

        if (value === null || value === '') {
          requestedChanges[field] = null;
          continue;
        }

        if (
          typeof value !== 'string' ||
          !isValidDateOnly(value.trim())
        ) {
          return NextResponse.json(
            {
              error: `${field.replaceAll('_', ' ')} must be a valid date.`,
            },
            { status: 400 },
          );
        }

        requestedChanges[field] = value.trim();
      }
    }

    // --------------------------------------------------
    // VALIDATE TECHNICAL SKILLS
    // --------------------------------------------------

    if (
      Object.prototype.hasOwnProperty.call(
        requestedChanges,
        'technical_skills',
      )
    ) {
      const skills = requestedChanges.technical_skills;

      if (
        !Array.isArray(skills) ||
        skills.some(
          (skill: unknown) =>
            typeof skill !== 'string',
        )
      ) {
        return NextResponse.json(
          {
            error:
              'Technical skills must be an array of text values.',
          },
          { status: 400 },
        );
      }

      requestedChanges.technical_skills = [
        ...new Set(
          skills
            .map((skill: string) => skill.trim())
            .filter(Boolean),
        ),
      ];
    }

    // --------------------------------------------------
    // SPLIT DIRECT FIELDS AND APPROVAL FIELDS
    // --------------------------------------------------

    const directChanges: Record<string, unknown> = {};
    const approvalChanges: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(
      requestedChanges,
    )) {
      if (DIRECT_UPDATE_FIELDS.includes(field)) {
        directChanges[field] = value;
      } else {
        approvalChanges[field] = value;
      }
    }

    const hasDirectChanges =
      Object.keys(directChanges).length > 0;

    const hasApprovalChanges =
      Object.keys(approvalChanges).length > 0;

    console.log(
      'DIRECT CHANGES:',
      directChanges,
    );

    console.log(
      'APPROVAL CHANGES:',
      approvalChanges,
    );

    console.log(
      'EMPLOYEE UUID:',
      employeeId,
    );

    // --------------------------------------------------
    // PREPARE SENSITIVE DOCUMENTS
    // --------------------------------------------------

    const hasSensitiveChanges = Object.keys(
      approvalChanges,
    ).some((field) =>
      SENSITIVE_PROFILE_FIELDS.includes(field),
    );

    const documentEntries = Object.entries(
      sensitiveDocumentIds,
    ) as [string, string][];

    const normalizedDocuments = documentEntries.map(
      ([documentType, documentId]) => ({
        documentType: documentType
          .trim()
          .toLowerCase(),
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
          !SENSITIVE_DOCUMENT_TYPES.includes(
            documentType,
          ) || !documentId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid sensitive document type or ID.',
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // PREPARE CERTIFICATION DOCUMENT ID
    // --------------------------------------------------

    const normalizedCertificationDocumentId =
      String(certificationDocumentId ?? '').trim();

    // --------------------------------------------------
    // VERIFY EMPLOYEE IN DATABASE
    // --------------------------------------------------

    const admin = await createAdminClient();

    const {
      data: employee,
      error: employeeError,
    } = await admin
      .from('employees')
      .select('id, first_name, last_name')
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

    // --------------------------------------------------
    // VALIDATE SENSITIVE DOCUMENTS
    // These documents must be pending and unlinked.
    // --------------------------------------------------

    for (const item of normalizedDocuments) {
      const {
        data: document,
        error: documentError,
      } = await admin
        .from('employee_documents')
        .select(
          'id, employee_id, document_type, verification_status, profile_change_request_id',
        )
        .eq('id', item.documentId)
        .maybeSingle();

      if (documentError) {
        throw documentError;
      }

      if (
        !document ||
        String(document.employee_id) !==
          String(employeeId) ||
        String(document.document_type ?? '')
          .trim()
          .toLowerCase() !== item.documentType
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
        String(document.verification_status ?? '')
          .toLowerCase() !== 'pending' ||
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

    // --------------------------------------------------
    // VALIDATE OPTIONAL CERTIFICATION DOCUMENT
    //
    // Professional Certification is not an approval
    // document. The upload API normally saves it with
    // verification_status = approved.
    //
    // Accept approved or pending for compatibility
    // with previously uploaded certification documents.
    //
    // Never link it to a profile-change request.
    // --------------------------------------------------

    if (normalizedCertificationDocumentId) {
      const {
        data: certificationDocument,
        error: certificationError,
      } = await admin
        .from('employee_documents')
        .select(
          'id, employee_id, document_type, verification_status, profile_change_request_id',
        )
        .eq('id', normalizedCertificationDocumentId)
        .maybeSingle();

      if (certificationError) {
        throw certificationError;
      }

      if (
        !certificationDocument ||
        String(certificationDocument.employee_id) !==
          String(employeeId) ||
        String(certificationDocument.document_type ?? '')
          .trim()
          .toLowerCase() !==
          CERTIFICATION_DOCUMENT_TYPE
      ) {
        return NextResponse.json(
          {
            error:
              'The professional certification document does not match this employee.',
          },
          { status: 400 },
        );
      }

      if (
        certificationDocument.profile_change_request_id
      ) {
        return NextResponse.json(
          {
            error:
              'The certification document is already linked to another request.',
          },
          { status: 409 },
        );
      }

      const certificationStatus = String(
        certificationDocument.verification_status ?? '',
      )
        .trim()
        .toLowerCase();

      if (
        !['approved', 'pending'].includes(
          certificationStatus,
        )
      ) {
        return NextResponse.json(
          {
            error:
              'The certification document has an invalid verification status.',
          },
          { status: 409 },
        );
      }
    }

    // --------------------------------------------------
    // SAVE CERTIFICATION AND SKILLS DIRECTLY
    // NO HR APPROVAL REQUIRED
    // --------------------------------------------------

    let updatedEmployee: Record<string, unknown> | null =
      null;

    if (hasDirectChanges) {
      const {
        data,
        error: updateError,
      } = await admin
        .from('employees')
        .update(directChanges)
        .eq('id', employeeId)
        .select(`
          id,
          professional_certification_name,
          professional_certification_organization,
          professional_certification_credential_id,
          professional_certification_issue_date,
          professional_certification_expiry_date,
          technical_skills
        `)
        .maybeSingle();

      if (updateError) {
        console.error(
          'DIRECT UPDATE ERROR:',
          updateError,
        );

        throw updateError;
      }

      console.log(
        'UPDATED EMPLOYEE DATA:',
        data,
      );

      if (!data) {
        throw new Error(
          'Employee update returned no record.',
        );
      }

      updatedEmployee = data;
    }

    // --------------------------------------------------
    // CREATE APPROVAL REQUEST FOR OTHER PROFILE FIELDS
    // --------------------------------------------------

    let newRequest: { id: string } | null = null;

    if (hasApprovalChanges) {
      newRequest =
        await DataStore.createProfileChangeRequest({
          employeeId,
          requestedChanges: approvalChanges,
          previousValues,
        });

      if (
        !newRequest?.id ||
        String(newRequest.id).startsWith('pcr-')
      ) {
        return NextResponse.json(
          {
            error:
              'The profile-change request could not be saved to the database.',
            directUpdateSaved: hasDirectChanges,
          },
          { status: 500 },
        );
      }

      // ------------------------------------------------
      // LINK SENSITIVE DOCUMENTS TO APPROVAL REQUEST
      // ------------------------------------------------

      for (const item of normalizedDocuments) {
        const {
          data: linkedDocument,
          error: linkError,
        } = await admin
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
    }

    // --------------------------------------------------
    // SEND INFORMATIONAL NOTIFICATION TO HR
    // --------------------------------------------------

    try {
      const {
        data: hrProfiles,
        error: hrProfilesError,
      } = await admin
        .from('profiles')
        .select('id, role')
        .eq('role', 'hr');

      if (hrProfilesError) {
        throw new Error(
          hrProfilesError.message,
        );
      }

      if (
        !hrProfiles ||
        hrProfiles.length === 0
      ) {
        console.warn(
          'No HR profiles found. Notification was not created.',
        );
      } else {
        const employeeName = [
          employee.first_name,
          employee.last_name,
        ]
          .filter(Boolean)
          .join(' ');

        const notificationTitle =
          hasDirectChanges
            ? 'Employee Profile Details Updated'
            : 'New Profile Change Request';

        let notificationMessage = '';

        if (
          hasDirectChanges &&
          hasApprovalChanges
        ) {
          notificationMessage =
            `${employeeName} updated Professional Certification and Technical Skills. ` +
            `Other profile changes are waiting for HR approval. Request ID: ${newRequest?.id}`;
        } else if (hasDirectChanges) {
          notificationMessage =
            `${employeeName} updated Professional Certification and Technical Skills. No approval is required.`;
        } else {
          notificationMessage =
            `${employeeName} submitted a profile change request. Request ID: ${newRequest?.id}`;
        }

        const notificationRows = hrProfiles.map(
          (hrProfile) => ({
            recipient_user_id: hrProfile.id,
            employee_id: employeeId,
            title: notificationTitle,
            message: notificationMessage,
            type: 'profile_request',
            is_read: false,
          }),
        );

        const {
          data: insertedNotifications,
          error: notificationError,
        } = await admin
          .from('notifications')
          .insert(notificationRows)
          .select(
            'id, recipient_user_id, title, type',
          );

        if (notificationError) {
          throw new Error(
            notificationError.message,
          );
        }

        console.log(
          'HR notifications successfully created:',
          insertedNotifications,
        );
      }
    } catch (notificationError: unknown) {
      // Notification failure must not undo a saved update.
      console.error(
        'HR PROFILE NOTIFICATION ERROR:',
        notificationError instanceof Error
          ? notificationError.message
          : notificationError,
      );
    }

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: true,

        message:
          hasDirectChanges && hasApprovalChanges
            ? 'Professional Certification and Technical Skills updated. Other profile changes were submitted for HR approval.'
            : hasDirectChanges
              ? 'Professional Certification and Technical Skills updated successfully.'
              : 'Profile change request submitted successfully.',

        directUpdate: directChanges,

        updatedEmployee,

        request: newRequest,

        certificationDocumentReceived:
          Boolean(
            normalizedCertificationDocumentId,
          ),

        certificationDocumentLinkedToApproval:
          false,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error(
      'Profile-change request error:',
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to submit profile changes.',
      },
      { status: 500 },
    );
  }
}
