import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-server";
import { decryptOnboardingSensitiveFields } from "@/lib/onboarding-encryption";
import {
  createOnboardingSession,
  ONBOARDING_SESSION_COOKIE,
} from "@/lib/joining-onboarding-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

function invalidLink() {
  return NextResponse.json(
    {
      success: false,
      error:
        "This onboarding link is invalid, expired or no longer available. Please contact HR for a new link.",
    },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function serverError(message: string) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const token =
      typeof body?.token === "string"
        ? body.token.trim()
        : "";

    if (!TOKEN_PATTERN.test(token)) {
      return invalidLink();
    }

    // 1. Hash the raw token before looking it up.
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = await createAdminClient();
    const now = new Date();

    // 2. Validate token, expiry and revocation status.
    // Each token is bound to an exact onboarding submission version.
    const { data: tokenRecord, error: tokenError } = await admin
      .from("joining_onboarding_tokens")
      .select("id, candidate_id, submission_id, expires_at")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now.toISOString())
      .maybeSingle();

    if (tokenError) {
      console.error(
        "[Candidate Onboarding] Token lookup failed:",
        tokenError
      );

      return serverError("Unable to validate the onboarding link.");
    }

    if (!tokenRecord || !tokenRecord.submission_id) {
      return invalidLink();
    }

    // 3. Load the candidate.
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select(`
        id,
        first_name,
        last_name,
        personal_email,
        designation,
        joining_date,
        department,
        employment_type,
        experience_level,
        total_experience_years,
        total_experience_months,
        onboarding_status,
        onboarding_submission_id,
        onboarding_verification_reopened_at,
        status,
        conversion_status,
        employee_record_id
      `)
      .eq("id", tokenRecord.candidate_id)
      .maybeSingle();

    if (candidateError) {
      console.error(
        "[Candidate Onboarding] Candidate lookup failed:",
        candidateError
      );

      return serverError("Unable to load onboarding details.");
    }

    // A reopened verification is valid only when the candidate remains
    // in joining_letter_sent and has an authorized reopening timestamp.
    const isReopenedVerification =
      candidate?.status === "joining_letter_sent" &&
      Boolean(candidate.onboarding_verification_reopened_at);

    if (
      !candidate ||
      (candidate.status !== "offer_accepted" &&
        !isReopenedVerification) ||
      candidate.conversion_status === "processing" ||
      candidate.conversion_status === "completed" ||
      candidate.employee_record_id ||
      !candidate.onboarding_submission_id
    ) {
      return invalidLink();
    }

    // 4. A token must match the candidate's exact active submission.
    if (
      candidate.onboarding_submission_id !== tokenRecord.submission_id
    ) {
      return invalidLink();
    }

    // 5. Load only the exact active submission.
    const { data: submission, error: submissionError } = await admin
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
      .eq("id", tokenRecord.submission_id)
      .eq("candidate_id", candidate.id)
      .maybeSingle();

    if (submissionError) {
      console.error(
        "[Candidate Onboarding] Submission lookup failed:",
        submissionError
      );

      return serverError("Unable to load your onboarding form.");
    }

    if (!submission) {
      return invalidLink();
    }

    if (
      submission.status !== "draft" &&
      submission.status !== "submitted"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This onboarding submission is no longer editable.",
        },
        {
          status: 409,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 6. Check whether this exact submission is a correction submission.
    const { data: correctionEvent, error: correctionEventError } =
      await admin
        .from("joining_onboarding_events")
        .select("id, event_details")
        .eq("candidate_id", candidate.id)
        .eq("submission_id", submission.id)
        .eq("event_type", "onboarding_corrections_requested")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (correctionEventError) {
      console.error(
        "[Candidate Onboarding] Correction event lookup failed:",
        correctionEventError
      );

      return serverError("Unable to load correction instructions.");
    }

    const isCorrection = Boolean(correctionEvent);

    const allowedStatuses = isCorrection
      ? ["correction_required", "in_progress", "submitted"]
      : ["link_sent", "in_progress", "submitted"];

    if (!allowedStatuses.includes(candidate.onboarding_status)) {
      return invalidLink();
    }

    const correctionInstructions = isCorrection
      ? String(
          correctionEvent?.event_details?.instructions || ""
        ).trim()
      : "";

    const eventDetails = correctionEvent?.event_details as
      | Record<string, unknown>
      | null;

    const rawCorrectionItems = eventDetails?.correction_items;

    const correctionItems =
      isCorrection && Array.isArray(rawCorrectionItems)
        ? rawCorrectionItems.flatMap((item) => {
            if (
              !item ||
              typeof item !== "object" ||
              Array.isArray(item)
            ) {
              return [];
            }

            const record = item as Record<string, unknown>;

            const instruction =
              typeof record.instruction === "string"
                ? record.instruction.trim()
                : "";

            const type = record.type;
            const key = record.key;

            if (
              !instruction ||
              (type !== "section" && type !== "document") ||
              typeof key !== "string"
            ) {
              return [];
            }

            return [
              {
                type,
                key,
                label:
                  typeof record.label === "string"
                    ? record.label
                    : "",
                documentType:
                  typeof record.document_type === "string"
                    ? record.document_type
                    : null,
                documentId:
                  typeof record.document_id === "string"
                    ? record.document_id
                    : null,
                employmentRecordId:
                  typeof record.employment_record_id === "string"
                    ? record.employment_record_id
                    : null,
                fileName:
                  typeof record.file_name === "string"
                    ? record.file_name
                    : null,
                instruction,
              },
            ];
          })
        : [];

    if (isCorrection && !correctionInstructions) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Correction instructions are unavailable. Please contact HR.",
        },
        {
          status: 409,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // A correction-required submission must still be an editable draft.
    if (
      isCorrection &&
      candidate.onboarding_status === "correction_required" &&
      submission.status !== "draft"
    ) {
      return invalidLink();
    }

    // 7. Start onboarding when the candidate opens the link.
    const shouldStart =
      candidate.onboarding_status === "link_sent" ||
      candidate.onboarding_status === "correction_required";

    if (shouldStart) {
      let candidateUpdate = admin
        .from("joining_candidates")
        .update({
          onboarding_status: "in_progress",
        })
        .eq("id", candidate.id)
        .eq("onboarding_status", candidate.onboarding_status)
        .eq("onboarding_submission_id", submission.id)
        .eq("status", candidate.status)
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
        await candidateUpdate
          .select("id")
          .maybeSingle();

      if (updateError) {
        console.error(
          "[Candidate Onboarding] Status update failed:",
          updateError
        );

        return serverError("Unable to start onboarding. Please try again.");
      }

      if (!updatedCandidate) {
        // Another request may have started onboarding first.
        const { data: latestCandidate, error: latestError } =
          await admin
            .from("joining_candidates")
            .select(`
              id,
              status,
              onboarding_status,
              onboarding_submission_id,
              onboarding_verification_reopened_at,
              conversion_status,
              employee_record_id
            `)
            .eq("id", candidate.id)
            .maybeSingle();

        if (latestError) {
          console.error(
            "[Candidate Onboarding] Concurrent status check failed:",
            latestError
          );

          return serverError(
            "Unable to verify onboarding status. Please try again."
          );
        }

        const latestIsReopenedVerification =
          latestCandidate?.status === "joining_letter_sent" &&
          Boolean(
            latestCandidate.onboarding_verification_reopened_at
          );

        if (
          !latestCandidate ||
          (latestCandidate.status !== "offer_accepted" &&
            !latestIsReopenedVerification) ||
          latestCandidate.onboarding_status !== "in_progress" ||
          latestCandidate.onboarding_submission_id !== submission.id ||
          latestCandidate.conversion_status === "processing" ||
          latestCandidate.conversion_status === "completed" ||
          latestCandidate.employee_record_id
        ) {
          return invalidLink();
        }
      } else {
        const { error: eventError } = await admin
          .from("joining_onboarding_events")
          .insert({
            candidate_id: candidate.id,
            submission_id: submission.id,
            actor_type: "candidate",
            actor_user_id: null,
            event_type: isCorrection
              ? "onboarding_correction_started"
              : "onboarding_started",
            event_details: {
              submission_version: submission.version,
            },
          });

        if (eventError) {
          console.error(
            "[Candidate Onboarding] Start event insert failed:",
            eventError
          );
        }
      }
    }

    // 8. Decrypt sensitive fields before returning the submission.
    const decryptedSubmissionData =
      decryptOnboardingSensitiveFields(
        submission.submission_data as Record<string, unknown>
      );

    // 9. Establish a signed, HTTP-only session.
    const sessionValue = createOnboardingSession({
      candidateId: candidate.id,
      submissionId: submission.id,
      tokenId: tokenRecord.id,
      expiresAt: tokenRecord.expires_at,
    });

    const maxAge = Math.floor(
      (Date.parse(tokenRecord.expires_at) - Date.now()) / 1000
    );

    if (maxAge <= 0) {
      return invalidLink();
    }

    const response = NextResponse.json(
      {
        success: true,
        candidate: {
          firstName: candidate.first_name,
          lastName: candidate.last_name,
          email: candidate.personal_email,
          designation: candidate.designation,
          joiningDate: candidate.joining_date,
          department: candidate.department,
          employmentType: candidate.employment_type,
          experienceLevel: candidate.experience_level,
          totalExperienceYears: candidate.total_experience_years,
          totalExperienceMonths: candidate.total_experience_months,
        },
        submission: {
          id: submission.id,
          version: submission.version,
          data: decryptedSubmissionData,
          status: submission.status,
        },
        isCorrection,
        correctionInstructions: correctionInstructions || null,
        correctionItems,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, private",
          Pragma: "no-cache",
        },
      }
    );

    response.cookies.set({
      name: ONBOARDING_SESSION_COOKIE,
      value: sessionValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/candidate-onboarding",
      maxAge,
    });

    return response;
  } catch (error) {
    console.error(
      "[Candidate Onboarding] Validation failed:",
      error
    );

    return serverError("Unable to validate your onboarding link.");
  }
}