import { createClient, createAdminClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  ChevronRight,
  UserRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/types";
import AddEmployeeWorkspace from "@/components/admin/AddEmployeeWorkspace";
import { decryptOnboardingSensitiveFields } from "@/lib/onboarding-encryption";
import { getAvailableOfficialEmail } from "@/lib/official-email";

interface AddEmployeePageProps {
  searchParams: Promise<{
    candidateId?: string;
  }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export default async function AddEmployeePage({
  searchParams,
}: AddEmployeePageProps) {
  const { candidateId: requestedCandidateId } = await searchParams;

  // ---------------------------------------------------------
  // 1. Authentication and authorization
  // ---------------------------------------------------------

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const adminClient = await createAdminClient();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/dashboard");
  }

  const role = String(profile.role || "").toLowerCase() as UserRole;

  if (!["hr", "ceo"].includes(role)) {
    redirect("/dashboard");
  }

  // ---------------------------------------------------------
  // 2. Load candidates moved to Add Employee
  // ---------------------------------------------------------

  const { data: queueData, error: queueError } = await adminClient
    .from("joining_candidates")
    .select(`
      id,
      first_name,
      last_name,
      personal_email,
      mobile_number,
      gender,
      designation,
      department,
      joining_date,
      annual_ctc,
      employment_type,
      work_location,
      experience_level,
      total_experience_years,
      total_experience_months,
      probation_period_months,
      accepted_offer_document_id,
      onboarding_status,
      onboarding_submission_id,
      onboarding_verified_at,
      onboarding_verified_by,
      conversion_status,
      employee_record_id,
      status,
      add_employee_moved_at,
      joining_letter_sent_at,
      joining_letter_send_status
    `)
    .not("add_employee_moved_at", "is", null)
    .is("employee_record_id", null)
    .in("status", ["offer_accepted", "joining_letter_sent"])
    .order("add_employee_moved_at", { ascending: false });

  if (queueError) {
    console.error(
      "[Add Employee] Queue lookup failed:",
      queueError
    );

    throw new Error("Unable to load the Add Employee queue.");
  }

  const eligibleCandidates = (queueData || []).filter(
    (item) =>
      item.conversion_status !== "processing" &&
      item.conversion_status !== "completed" &&
      !item.employee_record_id
  );

  // Select requested candidate if it belongs to this queue.
  // Otherwise select the newest moved candidate automatically.
  const candidate =
    eligibleCandidates.find(
      (item) =>
        UUID_PATTERN.test(requestedCandidateId || "") &&
        item.id === requestedCandidateId
    ) ||
    eligibleCandidates[0] ||
    null;

  // ---------------------------------------------------------
  // 3. Empty queue
  // ---------------------------------------------------------

  if (!candidate) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Link
            href="/dashboard"
            className="hover:text-indigo-600"
          >
            Dashboard
          </Link>

          <ChevronRight className="h-3.5 w-3.5" />

          <span className="text-slate-900">Add Employee</span>
        </nav>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Add Employee
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage accepted candidates before final employee creation.
          </p>
        </div>

        <section className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <UserRound className="mx-auto h-10 w-10 text-slate-400" />

          <h2 className="text-lg font-bold text-slate-900">
            No candidates in the Add Employee queue
          </h2>

          <p className="mx-auto max-w-md text-sm text-slate-500">
            Candidates appear here after HR accepts their offer
            and explicitly moves them from Joining Candidates.
          </p>

          <Link
            href="/dashboard/joining"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            View Joining Candidates
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    );
  }

  const candidateId = candidate.id;

  // ---------------------------------------------------------
  // 4. Verify exact accepted offer document and snapshot
  // ---------------------------------------------------------

  let offer: {
    id: string;
    document_type: string;
    sent_at: string | null;
    offer_snapshot: unknown;
  } | null = null;

  if (
    candidate.accepted_offer_document_id &&
    UUID_PATTERN.test(candidate.accepted_offer_document_id)
  ) {
    const { data, error } = await adminClient
      .from("joining_documents")
      .select("id, document_type, sent_at, offer_snapshot")
      .eq("id", candidate.accepted_offer_document_id)
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (error) {
      console.error(
        "[Candidate Onboarding] Accepted offer lookup failed:",
        error
      );

      throw new Error("Unable to load accepted offer.");
    }

    offer = data;
  }

  // Keep the raw snapshot separate for TypeScript type narrowing.
  const rawSnapshot: unknown = offer?.offer_snapshot;

  const snapshotIsObject = isPlainObject(rawSnapshot);

  const snapshot: Record<string, unknown> = snapshotIsObject
    ? rawSnapshot
    : {};

  const compensation = isPlainObject(snapshot.compensation)
    ? snapshot.compensation
    : {};

  const statutory = isPlainObject(snapshot.statutory)
    ? snapshot.statutory
    : {};

  const snapshotCandidate = isPlainObject(snapshot.candidate)
    ? snapshot.candidate
    : {};

  const acceptedOfferValid = Boolean(
    offer &&
      offer.document_type === "offer_letter" &&
      offer.sent_at &&
      snapshotIsObject &&
      isPlainObject(snapshot.candidate) &&
      isPlainObject(snapshot.compensation) &&
      isPlainObject(snapshot.statutory)
  );

  let officialEmailPreview: string | null = null;
  let officialEmailPreviewError: string | null = null;

  if (acceptedOfferValid) {
    try {
      officialEmailPreview = await getAvailableOfficialEmail(
        adminClient,
        String(snapshotCandidate.first_name ?? ""),
        String(snapshotCandidate.last_name ?? "")
      );
    } catch (error) {
      officialEmailPreviewError =
        error instanceof Error
          ? error.message
          : "Unable to generate the official email preview.";
    }
  }

  // ---------------------------------------------------------
  // 5. Load existing onboarding submission
  // ---------------------------------------------------------

  let submission: {
    id: string;
    version: number;
    status: string;
    submission_data: unknown;
    created_at: string;
    updated_at: string;

    employment_verification_status: string;
    employment_verified_at: string | null;
    employment_verified_by: string | null;
    employment_review_notes: string | null;

    personal_verification_status: string;
    personal_verified_at: string | null;
    personal_verified_by: string | null;
    personal_review_notes: string | null;

    address_verification_status: string;
    address_verified_at: string | null;
    address_verified_by: string | null;
    address_review_notes: string | null;

    bank_verification_status: string;
    bank_verified_at: string | null;
    bank_verified_by: string | null;
    bank_review_notes: string | null;

    identity_verification_status: string;
    identity_verified_at: string | null;
    identity_verified_by: string | null;
    identity_review_notes: string | null;

    education_verification_status: string;
    education_verified_at: string | null;
    education_verified_by: string | null;
    education_review_notes: string | null;

    emergency_verification_status: string;
    emergency_verified_at: string | null;
    emergency_verified_by: string | null;
    emergency_review_notes: string | null;
  } | null = null;

  let decryptedSubmissionData: Record<string, unknown> | null = null;
  let submissionDecryptionFailed = false;

  let onboardingDocuments: Array<{
    id: string;
    document_type: string;
    employment_record_id: string | null;
    version: number;
    original_file_name: string;
    mime_type: string;
    file_size_bytes: number;
    verification_status: string;
    uploaded_at: string;
    created_at: string;
    reviewed_at: string | null;
    review_reason: string | null;
    correction_instructions: string | null;
    resubmission_requested_at: string | null;
    resubmission_requested_by: string | null;
    resubmission_instructions: string | null;
  }> = [];

  if (candidate.onboarding_submission_id) {
    const { data, error } = await adminClient
      .from("joining_onboarding_submissions")
      .select(`
        id,
        version,
        status,
        submission_data,
        created_at,
        updated_at,
        employment_verification_status,
        employment_verified_at,
        employment_verified_by,
        employment_review_notes,
        personal_verification_status,
        personal_verified_at,
        personal_verified_by,
        personal_review_notes,
        address_verification_status,
        address_verified_at,
        address_verified_by,
        address_review_notes,
        bank_verification_status,
        bank_verified_at,
        bank_verified_by,
        bank_review_notes,
        identity_verification_status,
        identity_verified_at,
        identity_verified_by,
        identity_review_notes,
        education_verification_status,
        education_verified_at,
        education_verified_by,
        education_review_notes,
        emergency_verification_status,
        emergency_verified_at,
        emergency_verified_by,
        emergency_review_notes
      `)
      .eq("id", candidate.onboarding_submission_id)
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (error) {
      console.error(
        "[Candidate Onboarding] Submission lookup failed:",
        error
      );

      throw new Error("Unable to load onboarding submission.");
    }

    if (!data) {
      throw new Error(
        "The candidate's onboarding submission is missing."
      );
    }

    submission = data;

    if (isPlainObject(data.submission_data)) {
      try {
        decryptedSubmissionData = decryptOnboardingSensitiveFields(
          data.submission_data
        );
      } catch (decryptError) {
        console.error(
          "[Add Employee] Unable to decrypt onboarding submission:",
          decryptError
        );

        submissionDecryptionFailed = true;
      }
    } else {
      submissionDecryptionFailed = true;
    }
  }

  // ---------------------------------------------------------
  // 6. Load uploaded onboarding document metadata
  // ---------------------------------------------------------

  // Private storage paths are deliberately not selected or rendered here.
  if (submission) {
    const submissionHistoryResult: {
      data: Array<{
        id: string;
        supersedes_submission_id: string | null;
      }> | null;
      error: { message: string } | null;
    } = await adminClient
      .from("joining_onboarding_submissions")
      .select("id, supersedes_submission_id")
      .eq("candidate_id", candidateId);

    if (submissionHistoryResult.error) {
      console.error(
        "[Add Employee] Submission history lookup failed:",
        submissionHistoryResult.error
      );

      throw new Error(
        "Unable to load onboarding document history."
      );
    }

    const historyById = new Map<string, string | null>(
      (submissionHistoryResult.data ?? []).map((item) => [
        item.id,
        item.supersedes_submission_id,
      ])
    );

    const submissionIds: string[] = [];
    const visitedSubmissionIds = new Set<string>();
    let currentSubmissionId: string | null = submission.id;

    // Follow active submission ancestry: V3 -> V2 -> V1.
    for (
      let depth = 0;
      currentSubmissionId && depth < 20;
      depth++
    ) {
      if (visitedSubmissionIds.has(currentSubmissionId)) {
        console.error(
          "[Add Employee] Circular submission ancestry detected:",
          currentSubmissionId
        );
        break;
      }

      visitedSubmissionIds.add(currentSubmissionId);
      submissionIds.push(currentSubmissionId);

      currentSubmissionId =
        historyById.get(currentSubmissionId) ?? null;
    }

    const { data: documentData, error: documentError } =
      await adminClient
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
          created_at,
          reviewed_at,
          review_reason,
          correction_instructions,
          resubmission_requested_at,
          resubmission_requested_by,
          resubmission_instructions
        `)
        .eq("candidate_id", candidateId)
        .in("submission_id", submissionIds)
        .order("uploaded_at", { ascending: false });

    if (documentError) {
      console.error(
        "[Add Employee] Onboarding document lookup failed:",
        documentError
      );

      throw new Error("Unable to load onboarding documents.");
    }

    onboardingDocuments = documentData ?? [];
  }

  // ---------------------------------------------------------
  // 7. Candidate display information
  // ---------------------------------------------------------

  const onboardingStatus =
    candidate.onboarding_status || "not_started";

  // ---------------------------------------------------------
  // 8. Main page
  // ---------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link
          href="/dashboard"
          className="hover:text-indigo-600"
        >
          Dashboard
        </Link>

        <ChevronRight className="h-3.5 w-3.5" />

        <Link
          href="/dashboard/joining"
          className="hover:text-indigo-600"
        >
          Joining Candidates
        </Link>

        <ChevronRight className="h-3.5 w-3.5" />

        <span className="text-slate-900">Add Employee</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Add Employee
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Review accepted candidates, complete onboarding, and verify
          their information before final employee creation.
        </p>
      </div>

      {/* Candidate queue */}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">
              Add Employee Queue
            </h2>

            <p className="text-xs text-slate-500">
              Candidates explicitly moved from Joining Candidates.
            </p>
          </div>

          <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {eligibleCandidates.length} candidates
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {eligibleCandidates.map((item) => {
            const itemName = [
              item.first_name,
              item.last_name,
            ]
              .filter(Boolean)
              .join(" ");

            const isSelected = item.id === candidate.id;

            return (
              <Link
                key={item.id}
                href={`/dashboard/employees/add?candidateId=${encodeURIComponent(item.id)}`}
                className={`rounded-lg border p-2 transition ${
                  isSelected
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                }`}
              >
                <p className="truncate text-sm font-semibold text-slate-900">
                  {itemName || "Candidate"}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.designation || "Designation not provided"}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.personal_email || "Email not provided"}
                </p>

                <p className="mt-2 text-xs font-medium text-indigo-700">
                  {isSelected
                    ? "Currently selected"
                    : "View candidate"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <AddEmployeeWorkspace
        candidate={{ ...candidate }}
        offer={offer ? { id: offer.id } : null}
        acceptedOfferValid={acceptedOfferValid}
        officialEmailPreview={officialEmailPreview}
        officialEmailPreviewError={officialEmailPreviewError}
        candidateId={candidateId}
        canSendJoiningLetter={role === "hr"}
        onboardingStatus={String(onboardingStatus)}
        hasSubmission={Boolean(submission)}
        verificationCompletedAt={candidate.onboarding_verified_at ?? null}
        verificationCompletedBy={candidate.onboarding_verified_by ?? null}
        snapshotCandidate={snapshotCandidate}
        compensation={compensation}
        statutory={statutory}
        submission={
          submission
            ? {
                id: submission.id,
                version: submission.version,
                status: submission.status,
                updated_at: submission.updated_at,

                employment_verification_status:
                  submission.employment_verification_status,
                employment_verified_at:
                  submission.employment_verified_at,
                employment_verified_by:
                  submission.employment_verified_by,
                employment_review_notes:
                  submission.employment_review_notes,

                personal_verification_status:
                  submission.personal_verification_status,
                personal_verified_at: submission.personal_verified_at,
                personal_verified_by: submission.personal_verified_by,
                personal_review_notes: submission.personal_review_notes,

                address_verification_status:
                  submission.address_verification_status,
                address_verified_at: submission.address_verified_at,
                address_verified_by: submission.address_verified_by,
                address_review_notes: submission.address_review_notes,

                bank_verification_status:
                  submission.bank_verification_status,
                bank_verified_at: submission.bank_verified_at,
                bank_verified_by: submission.bank_verified_by,
                bank_review_notes: submission.bank_review_notes,

                identity_verification_status:
                  submission.identity_verification_status,
                identity_verified_at: submission.identity_verified_at,
                identity_verified_by: submission.identity_verified_by,
                identity_review_notes: submission.identity_review_notes,

                education_verification_status:
                  submission.education_verification_status,
                education_verified_at: submission.education_verified_at,
                education_verified_by: submission.education_verified_by,
                education_review_notes: submission.education_review_notes,

                emergency_verification_status:
                  submission.emergency_verification_status,
                emergency_verified_at: submission.emergency_verified_at,
                emergency_verified_by: submission.emergency_verified_by,
                emergency_review_notes: submission.emergency_review_notes,
              }
            : null
        }
        submissionData={decryptedSubmissionData}
        documents={onboardingDocuments}
        decryptionFailed={submissionDecryptionFailed}
      />

      <div className="flex justify-end">
        <Link
          href="/dashboard/joining"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to Joining Candidates
        </Link>
      </div>
    </div>
  );
}