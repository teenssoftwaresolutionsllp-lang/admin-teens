import { createClient, createAdminClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  ChevronRight,
  UserRound,
  ArrowLeft,
  Users,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/types";
import AddEmployeeWorkspace from "@/components/admin/AddEmployeeWorkspace";
import MovedCandidatesQueue from "@/components/admin/MovedCandidatesQueue";
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

  const candidateIds = eligibleCandidates.map((c) => c.id);

  let candidateDocuments: {
    candidate_id: string;
    document_type: string;
    sent_at: string | null;
    created_at: string;
  }[] = [];

  let candidateActionTokens: {
    candidate_id: string;
    action: string;
    used_at: string | null;
  }[] = [];

  let candidateSubmissions: {
    candidate_id: string;
    created_at: string;
    status: string;
  }[] = [];

  if (candidateIds.length > 0) {
    const [docsRes, tokensRes, subsRes] = await Promise.all([
      adminClient
        .from("joining_documents")
        .select("candidate_id, document_type, sent_at, created_at")
        .in("candidate_id", candidateIds)
        .in("document_type", ["offer_letter", "joining_letter"]),
      adminClient
        .from("joining_action_tokens")
        .select("candidate_id, action, used_at")
        .in("candidate_id", candidateIds)
        .eq("action", "accept_offer")
        .not("used_at", "is", null),
      adminClient
        .from("joining_onboarding_submissions")
        .select("candidate_id, created_at, status")
        .in("candidate_id", candidateIds)
        .order("created_at", { ascending: false }),
    ]);

    candidateDocuments = (docsRes.data || []) as typeof candidateDocuments;
    candidateActionTokens = (tokensRes.data || []) as typeof candidateActionTokens;
    candidateSubmissions = (subsRes.data || []) as typeof candidateSubmissions;
  }

  const enrichedEligibleCandidates = eligibleCandidates.map((c) => {
    const offerDoc = candidateDocuments.find(
      (d) => d.candidate_id === c.id && d.document_type === "offer_letter" && d.sent_at
    );
    const joiningDoc = candidateDocuments.find(
      (d) => d.candidate_id === c.id && d.document_type === "joining_letter" && d.sent_at
    );
    const acceptToken = candidateActionTokens.find(
      (t) => t.candidate_id === c.id
    );
    const submission = candidateSubmissions.find(
      (s) => s.candidate_id === c.id
    );

    return {
      ...c,
      timeline_history: {
        offer_sent_at: offerDoc?.sent_at || null,
        offer_accepted_at:
          acceptToken?.used_at ||
          c.add_employee_moved_at ||
          null,
        onboarding_submitted_at:
          submission?.created_at ||
          (c.onboarding_status === "submitted" || c.onboarding_status === "verified"
            ? c.onboarding_verified_at || c.add_employee_moved_at
            : null),
        onboarding_verified_at: c.onboarding_verified_at || null,
        joining_letter_sent_at:
          c.joining_letter_sent_at || joiningDoc?.sent_at || null,
      },
    };
  });

  // ---------------------------------------------------------
  // 3. Normal /dashboard/employees/add: Show candidates list & filters
  // ---------------------------------------------------------

  if (!requestedCandidateId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        {/* Page Heading */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Add Employee
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Candidates who accepted their offer and were moved to Add Employee. Select a candidate to review onboarding details and finalize employee creation.
          </p>
        </div>

        {/* Candidates Queue with all filters */}
        {enrichedEligibleCandidates.length === 0 ? (
          <section className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <UserRound className="h-7 w-7" />
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              No candidates in the Add Employee queue
            </h2>

            <p className="mx-auto max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
              Candidates appear here after their offer letter is accepted and they are explicitly moved to Add Employee from the Joining Candidates section.
            </p>
          </section>
        ) : (
          <MovedCandidatesQueue candidates={enrichedEligibleCandidates} />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------
  // 4. Candidate-specific view: /dashboard/employees/add?candidateId=XYZ
  // ---------------------------------------------------------

  const candidate =
    enrichedEligibleCandidates.find(
      (item) =>
        UUID_PATTERN.test(requestedCandidateId) &&
        item.id === requestedCandidateId
    ) || null;

  if (!candidate) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Link href="/dashboard" className="hover:text-indigo-600">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/dashboard/employees/add" className="hover:text-indigo-600">
            Add Employee
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900">Candidate Not Found</span>
        </nav>

        <section className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Candidate not found in Add Employee queue
          </h2>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-slate-500">
            This candidate either does not exist, has already been converted to an active employee, or is not in the Add Employee queue.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/employees/add"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Candidates Queue
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const candidateId = candidate.id;

  // ---------------------------------------------------------
  // 5. Verify exact accepted offer document and snapshot
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
  // 6. Load existing onboarding submission
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
  // 7. Load uploaded onboarding document metadata
  // ---------------------------------------------------------

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
  // 8. Candidate display information
  // ---------------------------------------------------------

  const onboardingStatus =
    candidate.onboarding_status || "not_started";

  const candidateFullName = [candidate.first_name, candidate.last_name]
    .filter(Boolean)
    .join(" ") || "Candidate";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Breadcrumbs & Back Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Link href="/dashboard" className="hover:text-indigo-600 transition">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/dashboard/employees/add" className="hover:text-indigo-600 transition">
            Add Employee Queue
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-bold truncate max-w-[200px]">
            {candidateFullName}
          </span>
        </nav>

        <Link
          href="/dashboard/employees/add"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-indigo-600 w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Candidates List</span>
        </Link>
      </div>

      {/* Candidate Header Summary Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50 p-5 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white font-bold text-base shadow-xs">
            {candidate.first_name?.[0] || "C"}
            {candidate.last_name?.[0] || ""}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
              {candidateFullName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mt-0.5">
              {candidate.designation || "Designation pending"}{" "}
              {candidate.department ? `• ${candidate.department}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {candidate.onboarding_verified_at || candidate.onboarding_status === "verified" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
              Verified & Ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
              Onboarding Review
            </span>
          )}
        </div>
      </div>

      {/* Candidate Queue Switcher (if more than 1 candidate in queue) */}
      {eligibleCandidates.length > 1 && (
        <section className="space-y-2.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              Add Employee Queue ({eligibleCandidates.length} candidates)
            </span>
            <Link
              href="/dashboard/employees/add"
              className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              View list with filters →
            </Link>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
            {eligibleCandidates.map((c) => {
              const isSelected = c.id === candidate.id;
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Candidate";

              return (
                <Link
                  key={c.id}
                  href={`/dashboard/employees/add?candidateId=${encodeURIComponent(c.id)}`}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition shrink-0 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span>{name}</span>
                  {c.department && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        isSelected
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-200/70 text-slate-600"
                      }`}
                    >
                      {c.department}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Add Employee Workspace */}
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

      {/* Bottom Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <Link
          href="/dashboard/employees/add"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Candidates Queue</span>
        </Link>

        <Link
          href="/dashboard/joining"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          View Offers & Pre-Onboarding →
        </Link>
      </div>
    </div>
  );
}
