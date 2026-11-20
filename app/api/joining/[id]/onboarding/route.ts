
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

async function authorizeHrOrCeo() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false as const,
      error: "Unauthorized",
      status: 401,
    };
  }

  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[Onboarding Draft] Role lookup failed:", error);

    return {
      ok: false as const,
      error: "Unable to verify access.",
      status: 500,
    };
  }

  const role = String(profile?.role || "").toLowerCase();

  if (!["hr", "ceo"].includes(role)) {
    return {
      ok: false as const,
      error: "HR or CEO access required.",
      status: 403,
    };
  }

  return {
    ok: true as const,
    admin,
    user,
    role: role as "hr" | "ceo",
  };
}

function responseError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

/**
 * Candidate details are prefilled from the current candidate record.
 * Compensation and statutory terms are carried only from the exact
 * accepted offer snapshot. Do not calculate or replace those terms here.
 */
function buildInitialSubmissionData(
  candidate: JsonRecord,
  acceptedOfferDocumentId: string,
  offerSnapshot: JsonRecord
): JsonRecord {
  return {
    firstName: candidate.first_name ?? "",
    lastName: candidate.last_name ?? "",
    email: candidate.personal_email ?? "",
    mobileNumber: candidate.mobile_number ?? "",
    gender: candidate.gender ?? null,

    designation: candidate.designation ?? "",
    department: candidate.department ?? "",
    joiningDate: candidate.joining_date ?? null,
    employmentType: candidate.employment_type ?? "",
    workLocation: candidate.work_location ?? "",
    experienceLevel: candidate.experience_level ?? "",
    totalExperienceYears: candidate.total_experience_years ?? 0,
    totalExperienceMonths: candidate.total_experience_months ?? 0,
    probationPeriodMonths: candidate.probation_period_months ?? null,

    // This is the immutable offer accepted by the candidate.
    acceptedOffer: {
      documentId: acceptedOfferDocumentId,
      snapshot: offerSnapshot,
    },

    // Candidate-submitted details and documents will be added later.
    personalDetails: {},
    addressDetails: {},
    bankDetails: {},
    identityDetails: {},
    emergencyContacts: [],
  };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeHrOrCeo();

    if (!auth.ok) {
      return responseError(auth.error, auth.status);
    }

    const { id: candidateId } = await context.params;

    if (!UUID_PATTERN.test(candidateId)) {
      return responseError("Invalid candidate ID.", 400);
    }

    const { admin, user, role } = auth;

    // 1. Load the candidate and their accepted-offer reference.
    const { data: candidate, error: candidateError } = await admin
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
        status,
        accepted_offer_document_id,
        onboarding_status,
        onboarding_submission_id,
        onboarding_verification_reopened_at,
        conversion_status,
        employee_record_id
      `)
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) {
      throw candidateError;
    }

    if (!candidate) {
      return responseError("Joining candidate not found.", 404);
    }

    const isReopenedVerification =
      candidate.status === "joining_letter_sent" &&
      Boolean(candidate.onboarding_verification_reopened_at);

    if (
      candidate.status !== "offer_accepted" &&
      !isReopenedVerification
    ) {
      return responseError(
        "Onboarding can only be prepared after offer acceptance or an authorized verification reopening.",
        409
      );
    }

    if (
      candidate.conversion_status === "processing" ||
      candidate.conversion_status === "completed" ||
      candidate.employee_record_id
    ) {
      return responseError(
        "This candidate is already being converted or has been added as an employee.",
        409
      );
    }

    // 2. Require the exact accepted offer reference.
    const acceptedOfferDocumentId =
      candidate.accepted_offer_document_id;

    if (
      !acceptedOfferDocumentId ||
      !UUID_PATTERN.test(acceptedOfferDocumentId)
    ) {
      return responseError(
        "The accepted offer reference is missing or invalid. Verify the candidate's offer acceptance before preparing onboarding.",
        409
      );
    }

    // 3. Load the exact accepted offer. Never select a different/latest
    // offer here: the accepted document reference is authoritative.
    const { data: acceptedOffer, error: offerError } = await admin
      .from("joining_documents")
      .select(`
        id,
        candidate_id,
        document_type,
        sent_at,
        offer_snapshot
      `)
      .eq("id", acceptedOfferDocumentId)
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (offerError) {
      throw offerError;
    }

    if (
      !acceptedOffer ||
      acceptedOffer.document_type !== "offer_letter" ||
      !acceptedOffer.sent_at
    ) {
      return responseError(
        "The accepted offer document could not be verified. Onboarding preparation has been blocked.",
        409
      );
    }

    const offerSnapshot: unknown = acceptedOffer.offer_snapshot;

    if (
      !isRecord(offerSnapshot) ||
      !isRecord(offerSnapshot.candidate) ||
      !isRecord(offerSnapshot.compensation) ||
      !isRecord(offerSnapshot.statutory)
    ) {
      return responseError(
        "The accepted offer does not contain a valid compensation and statutory snapshot. Please resolve the offer record before continuing.",
        409
      );
    }

    const initialSubmissionData = buildInitialSubmissionData(
      candidate as unknown as JsonRecord,
      acceptedOffer.id,
      offerSnapshot
    );

    // 4. Reuse the current submission if one is already linked.
    if (candidate.onboarding_submission_id) {
      const { data: existingSubmission, error: submissionError } =
        await admin
          .from("joining_onboarding_submissions")
          .select(`
            id,
            candidate_id,
            version,
            status,
            submission_data,
            created_at,
            updated_at
          `)
          .eq("id", candidate.onboarding_submission_id)
          .eq("candidate_id", candidateId)
          .maybeSingle();

      if (submissionError) {
        throw submissionError;
      }

      if (!existingSubmission) {
        throw new Error(
          "Candidate onboarding submission reference is invalid."
        );
      }

      let submission = existingSubmission;

      // An older draft may have been created empty by the previous
      // implementation. Prefill it only if it is still an empty draft.
      // Never overwrite candidate-entered or HR-reviewed information.
      if (
        existingSubmission.status === "draft" &&
        isEmptyRecord(existingSubmission.submission_data)
      ) {
        const { data: prefilledSubmission, error: prefillError } =
          await admin
            .from("joining_onboarding_submissions")
            .update({
              submission_data: initialSubmissionData,
            })
            .eq("id", existingSubmission.id)
            .eq("candidate_id", candidateId)
            .eq("status", "draft")
            .eq("submission_data", existingSubmission.submission_data)
            .select(`
              id,
              candidate_id,
              version,
              status,
              submission_data,
              created_at,
              updated_at
            `)
            .maybeSingle();

        if (prefillError) {
          throw prefillError;
        }

        // If another request changed the draft, keep that newer version.
        if (prefilledSubmission) {
          submission = prefilledSubmission;
        } else {
          const { data: latestSubmission, error: latestError } =
            await admin
              .from("joining_onboarding_submissions")
              .select(`
                id,
                candidate_id,
                version,
                status,
                submission_data,
                created_at,
                updated_at
              `)
              .eq("id", existingSubmission.id)
              .eq("candidate_id", candidateId)
              .maybeSingle();

          if (latestError) {
            throw latestError;
          }

          if (!latestSubmission) {
            throw new Error(
              "The current onboarding submission could not be reloaded."
            );
          }

          submission = latestSubmission;
        }
      }

      return NextResponse.json(
        {
          success: true,
          reused: true,
          message: "Existing onboarding submission found.",
          submission,
          acceptedOffer: {
            documentId: acceptedOffer.id,
            snapshot: offerSnapshot,
          },
          onboardingStatus: candidate.onboarding_status,
        },
        {
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 5. Find the previous version so submission history is preserved.
    const { data: previousSubmissions, error: versionError } =
      await admin
        .from("joining_onboarding_submissions")
        .select("id, version")
        .eq("candidate_id", candidateId)
        .order("version", { ascending: false })
        .limit(1);

    if (versionError) {
      throw versionError;
    }

    const previousSubmission = previousSubmissions?.[0] ?? null;
    const nextVersion = (previousSubmission?.version ?? 0) + 1;

    // 6. Create a prefilled onboarding draft.
    // This is NOT an employee record and does NOT create an Auth account.
    const { data: submission, error: insertError } = await admin
      .from("joining_onboarding_submissions")
      .insert({
        candidate_id: candidateId,
        version: nextVersion,
        status: "draft",
        submission_data: initialSubmissionData,
        supersedes_submission_id: previousSubmission?.id ?? null,
      })
      .select(`
        id,
        candidate_id,
        version,
        status,
        submission_data,
        created_at,
        updated_at
      `)
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return responseError(
          "Another onboarding preparation request is already being processed. Refresh and try again.",
          409
        );
      }

      throw insertError;
    }

    // 7. Link the draft only if the candidate still has the same
    // accepted offer and remains eligible for onboarding.
    const createdAt = new Date().toISOString();

    let candidateUpdate = admin
      .from("joining_candidates")
      .update({
        onboarding_submission_id: submission.id,
        onboarding_draft_created_at: createdAt,
        onboarding_draft_created_by: user.id,
      })
      .eq("id", candidateId)
      .eq("status", candidate.status)
      .eq("accepted_offer_document_id", acceptedOffer.id)
      .is("onboarding_submission_id", null)
      .is("employee_record_id", null);

    if (candidate.onboarding_verification_reopened_at) {
      candidateUpdate = candidateUpdate.eq(
        "onboarding_verification_reopened_at",
        candidate.onboarding_verification_reopened_at
      );
    } else {
      candidateUpdate = candidateUpdate.is(
        "onboarding_verification_reopened_at",
        null
      );
    }

    const { data: updatedCandidate, error: updateError } =
      await candidateUpdate.select("id").maybeSingle();

    if (updateError || !updatedCandidate) {
      const { error: cleanupError } = await admin
        .from("joining_onboarding_submissions")
        .delete()
        .eq("id", submission.id)
        .eq("candidate_id", candidateId);

      if (cleanupError) {
        console.error(
          "[Onboarding Draft] Unlinked draft cleanup failed:",
          cleanupError
        );
      }

      if (updateError) {
        throw updateError;
      }

      return responseError(
        "The candidate changed while onboarding was being prepared. Refresh and try again.",
        409
      );
    }

    // 8. Record the HR/CEO action.
    const { error: eventError } = await admin
      .from("joining_onboarding_events")
      .insert({
        candidate_id: candidateId,
        submission_id: submission.id,
        actor_type: role,
        actor_user_id: user.id,
        event_type: "onboarding_draft_created",
        event_details: {
          version: nextVersion,
          created_by_role: role,
          accepted_offer_document_id: acceptedOffer.id,
        },
      });

    if (eventError) {
      console.error(
        "[Onboarding Draft] Audit event insert failed:",
        eventError
      );

      const { error: rollbackError } = await admin
        .from("joining_candidates")
        .update({
          onboarding_submission_id: null,
          onboarding_draft_created_at: null,
          onboarding_draft_created_by: null,
        })
        .eq("id", candidateId)
        .eq("onboarding_submission_id", submission.id);

      if (rollbackError) {
        console.error(
          "[Onboarding Draft] Candidate rollback failed:",
          rollbackError
        );
      }

      const { error: deleteError } = await admin
        .from("joining_onboarding_submissions")
        .delete()
        .eq("id", submission.id)
        .eq("candidate_id", candidateId);

      if (deleteError) {
        console.error(
          "[Onboarding Draft] Draft rollback failed:",
          deleteError
        );
      }

      return responseError(
        "The onboarding draft could not be audited. Please retry.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        reused: false,
        message: "Onboarding draft prepared successfully.",
        submission,
        acceptedOffer: {
          documentId: acceptedOffer.id,
          snapshot: offerSnapshot,
        },
        onboardingStatus: candidate.onboarding_status,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[Onboarding Draft] Preparation failed:", error);

    return responseError(
      "Unable to prepare onboarding. Please try again.",
      500
    );
  }
}