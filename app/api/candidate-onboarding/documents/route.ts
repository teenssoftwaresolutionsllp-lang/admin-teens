
import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import { cloudinary } from "@/lib/cloudinary-client";
import { createAdminClient } from "@/lib/supabase-server";
import {
  ONBOARDING_SESSION_COOKIE,
  verifyOnboardingSession,
} from "@/lib/joining-onboarding-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const DOCUMENT_TYPES = [
  "aadhaar_card",
  "pan_card",
  "driving_license",
  "passport_photo",
  "passport",
  "address_proof",
  "education_10th",
  "education_12th",
  "education_graduation",
  "education_post_graduation",
  "education_other",
  "experience_document",
  "relieving_letter",
  "previous_joining_letter",
  "payslip_1",
  "payslip_2",
  "payslip_3",
  "payslip_4",
  "payslip_5",
  "payslip_6",
  "salary_hike_letter",
  "appraisal_letter",
  "bank_account_proof",
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

const EMPLOYMENT_DOCUMENT_TYPES = [
  "experience_document",
  "relieving_letter",
  "previous_joining_letter",
  "payslip_1",
  "payslip_2",
  "payslip_3",
  "payslip_4",
  "payslip_5",
  "payslip_6",
  "salary_hike_letter",
  "appraisal_letter",
] as const;

type EmploymentDocumentType =
  (typeof EMPLOYMENT_DOCUMENT_TYPES)[number];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);

  return cleaned || "document";
}

function detectMimeType(buffer: Buffer): string | null {
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  ) {
    return "application/pdf";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
      ])
    )
  ) {
    return "image/png";
  }

  return null;
}

function uploadToCloudinary(
  buffer: Buffer,
  publicId: string,
  mimeType: string
): Promise<{ public_id: string }> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "raw",
        type: "authenticated",
        access_mode: "authenticated",
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        tags: ["candidate-onboarding-private"],
        context: {
          mime_type: mimeType,
        },
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }

        resolve({ public_id: result.public_id });
      }
    );

    upload.end(buffer);
  });
}

async function deleteCloudinaryAsset(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });
  } catch (error) {
    console.error(
      "[Candidate Onboarding] Cloudinary cleanup failed:",
      error
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verify the signed candidate session.
    const cookieValue = request.cookies.get(
      ONBOARDING_SESSION_COOKIE
    )?.value;

    const session = verifyOnboardingSession(cookieValue);

    if (!session) {
      return fail(
        "Your onboarding session has expired. Please reopen your link.",
        401
      );
    }

    // 2. Revalidate the onboarding token.
    const admin = await createAdminClient();
    const now = new Date().toISOString();

    const { data: token, error: tokenError } = await admin
      .from("joining_onboarding_tokens")
      .select("id, submission_id, expires_at")
      .eq("id", session.tokenId)
      .eq("candidate_id", session.candidateId)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .maybeSingle();

    if (tokenError) {
      console.error(
        "[Candidate Onboarding] Document-list token lookup failed:",
        tokenError
      );

      return fail("Unable to verify your onboarding session.", 500);
    }

    if (
        !token ||
        token.submission_id !== session.submissionId ||
        token.expires_at !== session.expiresAt
    ) {
        return fail("Your onboarding link is no longer valid.", 401);
    }

    // 3. Confirm that this is still the candidate's active submission.
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select(`
        id,
        status,
        onboarding_verification_reopened_at,
        onboarding_status,
        onboarding_submission_id,
        conversion_status,
        employee_record_id
      `)
      .eq("id", session.candidateId)
      .maybeSingle();

    if (candidateError) {
      console.error(
        "[Candidate Onboarding] Document-list candidate lookup failed:",
        candidateError
      );

      return fail("Unable to verify your onboarding details.", 500);
    }

    console.log("[Onboarding Documents] GET authorization diagnostic:", {
      candidateFound: Boolean(candidate),
      candidateIdMatches: candidate?.id === session.candidateId,
      status: candidate?.status,
      reopened: Boolean(candidate?.onboarding_verification_reopened_at),
      onboardingStatus: candidate?.onboarding_status,
      activeSubmissionMatches:
        candidate?.onboarding_submission_id === session.submissionId,
      conversionStatus: candidate?.conversion_status,
      hasEmployeeRecord: Boolean(candidate?.employee_record_id),
      sessionSubmissionId: session.submissionId,
    });

    if (!candidate ||!(
        candidate.status === "offer_accepted" ||
        (candidate.status === "joining_letter_sent" && Boolean(candidate.onboarding_verification_reopened_at))) ||
      !["in_progress", "submitted"].includes(candidate.onboarding_status) ||
      candidate.onboarding_submission_id !== session.submissionId ||
      candidate.conversion_status === "processing" ||
      candidate.conversion_status === "completed" ||
      candidate.employee_record_id
    ) {
      return fail("Your onboarding form is no longer editable.", 403);
    }

        // 4. Find the active submission and its previous submission history.
    const { data: submissions, error: submissionsError } = await admin
      .from("joining_onboarding_submissions")
      .select("id, supersedes_submission_id")
      .eq("candidate_id", session.candidateId);

    if (submissionsError) {
      console.error(
        "[Candidate Onboarding] Submission-history lookup failed:",
        submissionsError
      );

      return fail("Unable to load your onboarding history.", 500);
    }

    const submissionMap = new Map(
      (submissions ?? []).map((submission) => [
        submission.id,
        submission.supersedes_submission_id,
      ])
    );

    if (!submissionMap.has(session.submissionId)) {
      return fail("Your onboarding submission could not be found.", 404);
    }

    // Follow only the active submission's ancestry.
    // This prevents unrelated or future submissions from being included.
    const submissionIds: string[] = [];
    const visited = new Set<string>();

    let currentSubmissionId: string | null = session.submissionId;

    while (
      currentSubmissionId &&
      !visited.has(currentSubmissionId) &&
      submissionMap.has(currentSubmissionId)
    ) {
      visited.add(currentSubmissionId);
      submissionIds.push(currentSubmissionId);

      currentSubmissionId =
        submissionMap.get(currentSubmissionId) ?? null;
    }

    // 5. Return safe document metadata from the active and previous
    // submissions. New uploads remain attached to the active submission.
    const { data: documents, error: documentsError } = await admin
      .from("joining_onboarding_documents")
      .select(`
        id,
        document_type,
        employment_record_id,
        version,
        original_file_name,
        mime_type,
        file_size_bytes,
        verification_status,
        uploaded_at,
        reviewed_at
      `)
      .eq("candidate_id", session.candidateId)
      .in("submission_id", submissionIds)
      .order("uploaded_at", { ascending: false });

    if (documentsError) {
      console.error(
        "[Candidate Onboarding] Document-list query failed:",
        documentsError
      );

      return fail("Unable to load your uploaded documents.", 500);
    }

    return NextResponse.json(
      {
        success: true,
        documents: documents ?? [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, private",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error(
      "[Candidate Onboarding] Document-list request failed:",
      error
    );

    return fail("Unable to load your uploaded documents.", 500);
  }
}

export async function POST(request: NextRequest) {
  let uploadedPublicId: string | null = null;

  try {
    // 1. Verify the signed candidate session.
    const cookieValue = request.cookies.get(
      ONBOARDING_SESSION_COOKIE
    )?.value;

    const session = verifyOnboardingSession(cookieValue);

    if (!session) {
      return fail(
        "Your onboarding session has expired. Please reopen your link.",
        401
      );
    }

    // 2. Read multipart form data.
    const formData = await request.formData();

    const file = formData.get("file");
    const documentTypeValue = formData.get("documentType");
    const employmentRecordIdValue = formData.get("employmentRecordId");

    if (!(file instanceof File)) {
      return fail("Please select a document to upload.");
    }

    if (
      typeof documentTypeValue !== "string" ||
      !DOCUMENT_TYPES.includes(documentTypeValue as DocumentType)
    ) {
      return fail("Invalid document type.");
    }

    const documentType = documentTypeValue as DocumentType;

    // 3. Validate employer association for experience documents.
    const isEmploymentDocument =
      EMPLOYMENT_DOCUMENT_TYPES.includes(
        documentType as EmploymentDocumentType
      );

    const employmentRecordId =
      typeof employmentRecordIdValue === "string"
        ? employmentRecordIdValue.trim()
        : "";

    if (
      isEmploymentDocument &&
      !UUID_REGEX.test(employmentRecordId)
    ) {
      return fail(
        "Please select a valid previous employment record."
      );
    }

    if (!isEmploymentDocument && employmentRecordId) {
      return fail(
        "An employment record is not allowed for this document."
      );
    }

    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return fail(
        "Each document must be between 1 byte and 10 MB."
      );
    }

    // 4. Validate the file using its actual signature.
    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length !== file.size) {
      return fail(
        "The uploaded file could not be read correctly."
      );
    }

    const mimeType = detectMimeType(buffer);

    if (!mimeType) {
      return fail(
        "Only valid PDF, JPEG and PNG documents are allowed."
      );
    }

    const hash = createHash("sha256")
      .update(buffer)
      .digest("hex");

    // 5. Revalidate the token and candidate using the database.
    const admin = await createAdminClient();
    const now = new Date().toISOString();

    const { data: token, error: tokenError } = await admin
      .from("joining_onboarding_tokens")
      .select("id, candidate_id, expires_at, submission_id")
      .eq("id", session.tokenId)
      .eq("candidate_id", session.candidateId)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .maybeSingle();

    if (tokenError) {
      console.error(
        "Onboarding token lookup failed:",
        tokenError
      );

      return fail(
        "Unable to verify your onboarding session.",
        500
      );
    }

    if (
        !token ||
        token.submission_id !== session.submissionId ||
        token.expires_at !== session.expiresAt
    ) {
        return fail(
            "Your onboarding link is no longer valid.",
            401
        );
    }

    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select(`
        id,
        status,
        onboarding_verification_reopened_at,
        onboarding_status,
        onboarding_submission_id,
        conversion_status,
        employee_record_id
      `)
      .eq("id", session.candidateId)
      .maybeSingle();

    if (candidateError) {
      console.error(
        "Candidate lookup failed:",
        candidateError
      );

      return fail(
        "Unable to verify your onboarding details.",
        500
      );
    }

    if (
      !candidate ||
      !(
        candidate.status === "offer_accepted" ||
        (
          candidate.status === "joining_letter_sent" &&
          Boolean(candidate.onboarding_verification_reopened_at)
        )
      ) ||
      candidate.onboarding_status !== "in_progress" ||
      candidate.onboarding_submission_id !== session.submissionId ||
      candidate.conversion_status === "processing" ||
      candidate.conversion_status === "completed" ||
      candidate.employee_record_id
    ) {
      return fail(
        "Your onboarding form is no longer editable.",
        403
      );
    }

    // 6. Generate a private Cloudinary storage path.
    const safeName = safeFileName(file.name);
    const uniqueId = randomUUID();

    const storagePath =
      `teens-hr/candidate-onboarding/` +
      `${session.candidateId}/${session.submissionId}/` +
      `${
        employmentRecordId
          ? `${employmentRecordId}/`
          : ""
      }${documentType}-${uniqueId}-${safeName}`;

    // 7. Upload as an authenticated private raw asset.
    const uploadResult = await uploadToCloudinary(
      buffer,
      storagePath,
      mimeType
    );

    uploadedPublicId = uploadResult.public_id;

    // 8. Atomically register metadata and assign version number.
    const { data: registered, error: registerError } =
      await admin.rpc(
        "register_candidate_onboarding_document",
        {
          p_candidate_id: session.candidateId,
          p_submission_id: session.submissionId,
          p_token_id: session.tokenId,
          p_document_type: documentType,
          p_original_file_name: safeName,
          p_storage_path: storagePath,
          p_mime_type: mimeType,
          p_file_size_bytes: file.size,
          p_sha256_hash: hash,
          p_employment_record_id: employmentRecordId || null,
        }
      );

    if (registerError || !registered) {
      console.error(
        "[Candidate Onboarding] Document registration failed:",
        registerError
      );

      await deleteCloudinaryAsset(uploadedPublicId);
      uploadedPublicId = null;

      return fail(
        "The document could not be saved. Please try uploading it again.",
        500
      );
    }

    // 9. Return metadata only.
    // Never return Cloudinary URLs or private storage paths.
    return NextResponse.json(
      {
        success: true,
        message: "Document uploaded successfully.",
        document: {
          id: registered.id,
          documentType: registered.document_type,
          employmentRecordId: registered.employment_record_id,
          version: registered.version,
          verificationStatus: registered.verification_status,
          uploadedAt: registered.uploaded_at,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, private",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error(
      "[Candidate Onboarding] Document upload failed:",
      error
    );

    if (uploadedPublicId) {
      await deleteCloudinaryAsset(uploadedPublicId);
    }

    return fail(
      "Unable to upload the document. Please try again.",
      500
    );
  }
}
