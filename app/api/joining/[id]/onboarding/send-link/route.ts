
import { NextResponse } from "next/server";
import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { Resend } from "resend";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOKEN_EXPIRY_DAYS = 7;

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type RpcAdminClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: {
      code?: string;
      message: string;
    } | null;
  }>;
};


function responseError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}



async function rollbackTokenGeneration(
  admin: AdminClient,
  candidateId: string,
  lockId: string,
  newTokenId: string,
  previousTokenId: string | null
) {
  const rpcAdmin = admin as unknown as RpcAdminClient;
  const { error } = await rpcAdmin.rpc(
    "rollback_candidate_onboarding_link_generation",
    {
      p_candidate_id: candidateId,
      p_lock_id: lockId,
      p_new_token_id: newTokenId,
      p_previous_token_id: previousTokenId,
    }
  );

  if (error) {
    console.error(
      "[Onboarding Link] Token generation rollback failed:",
      error
    );
  }
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
    console.error("[Onboarding Link] Role lookup failed:", error);

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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate HR or CEO.
    const auth = await authorizeHrOrCeo();

    if (!auth.ok) {
      return responseError(auth.error, auth.status);
    }

    const { id: candidateId } = await context.params;

    if (!UUID_PATTERN.test(candidateId)) {
      return responseError("Invalid candidate ID.", 400);
    }

    const body = await request.json().catch(() => ({}));
    const correctionMode = body?.correctionMode === true;

    const { admin, user, role } = auth;

    // 2. Load candidate.
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select(`
        id,
        first_name,
        last_name,
        personal_email,
        status,
        onboarding_status,
        onboarding_submission_id,
        onboarding_link_sent_at,
        onboarding_verification_reopened_at,
        conversion_status,
        employee_record_id
      `)
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) throw candidateError;

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
        "The candidate must accept the offer or have an authorized verification reopening before receiving an onboarding link.",
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

    const recipient = candidate.personal_email?.trim();

    if (!recipient) {
      return responseError(
        "The candidate does not have a personal email address.",
        400
      );
    }

    if (!candidate.onboarding_submission_id) {
      return responseError(
        "The active onboarding submission could not be found.",
        409
      );
    }

    // 3. Validate sending mode.
    if (correctionMode) {
      if (candidate.onboarding_status !== "correction_required") {
        return responseError(
          "A correction link can only be sent when corrections are required.",
          409
        );
      }
    } else if (
        candidate.onboarding_status !== "not_started" &&
        candidate.onboarding_status !== "draft" &&
        candidate.onboarding_status !== "link_sent"
    ) {
      return responseError(
        "The initial onboarding link cannot be sent in the candidate's current status.",
        409
      );
    }

    // 4. Confirm the exact active submission.
    const { data: submission, error: submissionError } = await admin
      .from("joining_onboarding_submissions")
      .select("id, candidate_id, status, version")
      .eq("id", candidate.onboarding_submission_id)
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (submissionError) throw submissionError;

    if (!submission || submission.status !== "draft") {
      return responseError(
        "The current onboarding submission is not an editable draft.",
        409
      );
    }

    // 5. Retrieve HR correction instructions.
    let correctionInstructions = "";

    if (correctionMode) {
      const { data: correctionEvent, error: correctionEventError } =
        await admin
          .from("joining_onboarding_events")
          .select("id, submission_id, event_details")
          .eq("candidate_id", candidateId)
          .eq("submission_id", submission.id)
          .eq("event_type", "onboarding_corrections_requested")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (correctionEventError) throw correctionEventError;

      correctionInstructions = String(
        correctionEvent?.event_details?.instructions || ""
      ).trim();

      if (!correctionInstructions) {
        return responseError(
          "Correction instructions are missing. Please request corrections again.",
          409
        );
      }
    }

    // 6. Validate email configuration.
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const configuredBaseUrl = process.env.APP_BASE_URL;

    if (!apiKey || !fromEmail || !configuredBaseUrl) {
      console.error(
        "[Onboarding Link] RESEND_API_KEY, RESEND_FROM_EMAIL or APP_BASE_URL is missing."
      );

      return responseError(
        "Email service or application URL is not configured.",
        500
      );
    }

    const baseUrl = configuredBaseUrl.replace(/\/+$/, "");

    let parsedBaseUrl: URL;

    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch {
      return responseError("APP_BASE_URL is invalid.", 500);
    }

    if (
      process.env.NODE_ENV === "production" &&
      parsedBaseUrl.protocol !== "https:"
    ) {
      return responseError(
        "APP_BASE_URL must use HTTPS in production.",
        500
      );
    }

    // 7. Generate a secure token bound to this submission.
    const rawToken = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const now = new Date();
    const nowIso = now.toISOString();

    const expiresAt = new Date(
      now.getTime() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const onboardingUrl = new URL("/candidate-onboarding", baseUrl);
    onboardingUrl.searchParams.set("token", rawToken);

    // 8. Atomically replace the previous token and claim a generation lock.
    const generationLockId = randomUUID();

    const {
      data: generationData,
      error: generationError,
    } = await (admin as unknown as RpcAdminClient).rpc(
      "begin_candidate_onboarding_link_generation",
      {
        p_candidate_id: candidateId,
        p_submission_id: submission.id,
        p_lock_id: generationLockId,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_created_by: user.id,
      }
    );

    if (generationError) {
      console.error(
        "[Onboarding Link] Token generation failed:",
        generationError
      );

      if (
        generationError.code === "55P03" ||
        generationError.message?.includes("being generated concurrently")
      ) {
        return responseError(
          "An onboarding link is being generated concurrently. Please refresh and try again.",
          409
        );
      }

      if (
        generationError.message?.includes("submission has changed")
      ) {
        return responseError(
          "The onboarding submission has changed. Refresh and try again.",
          409
        );
      }

      throw generationError;
    }

    const generation = Array.isArray(generationData)
      ? generationData[0]
      : generationData;

    if (!generation?.new_token_id) {
      throw new Error(
        "Token generation did not return a new token ID."
      );
    }

    const tokenRecord = {
      id: generation.new_token_id as string,
    };

    const previousTokenId =
      (generation.previous_token_id as string | null) || null;

    // 9. Update candidate link timestamp.
    const targetStatus = correctionMode
      ? "correction_required"
      : "link_sent";

    let candidateUpdate = admin
      .from("joining_candidates")
      .update({
        onboarding_status: targetStatus,
        onboarding_link_sent_at: nowIso,
      })
      .eq("id", candidateId)
      .eq("status", candidate.status)
      .eq("onboarding_status", candidate.onboarding_status)
      .eq("onboarding_submission_id", submission.id)
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
      await rollbackTokenGeneration(
        admin,
        candidateId,
        generationLockId,
        tokenRecord.id,
        previousTokenId
      );

      if (updateError) throw updateError;

      return responseError(
        "Candidate details changed while generating the link. Refresh and try again.",
        409
      );
    }

    // 10. Prepare email.
    const resend = new Resend(apiKey);

    const fullName =
      `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim();

    const safeName = escapeHtml(fullName || "Candidate");
    const safeUrl = escapeHtml(onboardingUrl.toString());
    const safeInstructions = escapeHtml(correctionInstructions);

    const subject = correctionMode
      ? "Action Required: Correct Your Employee Onboarding Details - TEENS SOFTWARE SOLUTIONS LLP"
      : "Complete Your Employee Onboarding - TEENS SOFTWARE SOLUTIONS LLP";

    const text = correctionMode
      ? [
          `Dear ${fullName || "Candidate"},`,
          "",
          "HR has reviewed your onboarding submission and requires a few corrections.",
          "",
          "Please review the following instructions:",
          correctionInstructions,
          "",
          "Use the secure link below to update your onboarding details and resubmit:",
          onboardingUrl.toString(),
          "",
          `This link expires in ${TOKEN_EXPIRY_DAYS} days.`,
          "Please do not share this link with anyone.",
          "",
          "Your previously submitted information has been retained. Please review and update the requested details.",
          "",
          "Regards,",
          "HR Team",
          "TEENS SOFTWARE SOLUTIONS LLP",
          "Hyderabad, Telangana, India",
        ].join("\n")
      : [
          `Dear ${fullName || "Candidate"},`,
          "",
          "Congratulations on accepting your offer!",
          "",
          "Please complete your employee onboarding using the secure link below:",
          "",
          onboardingUrl.toString(),
          "",
          `This link expires in ${TOKEN_EXPIRY_DAYS} days.`,
          "Please do not share this link with anyone.",
          "",
          "You can use this link to submit your personal details and required documents.",
          "Your employee account will only be created after HR completes verification and formally adds you to Employee Master Data.",
          "",
          "Regards,",
          "HR Team",
          "TEENS SOFTWARE SOLUTIONS LLP",
          "Hyderabad, Telangana, India",
        ].join("\n");

    const html = correctionMode
      ? `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #222; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #b45309;">Corrections Required for Your Onboarding</h2>
          <p>Dear ${safeName},</p>
          <p>HR has reviewed your onboarding submission and requires a few corrections.</p>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 6px;">
            <strong>HR correction instructions:</strong>
            <p style="white-space: pre-wrap;">${safeInstructions}</p>
          </div>
          <p>Please use the secure link below to review and update your onboarding details.</p>
          <p style="margin: 28px 0;">
            <a href="${safeUrl}" style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: bold;">
              Correct Onboarding Details
            </a>
          </p>
          <p><strong>Important:</strong> This link expires in ${TOKEN_EXPIRY_DAYS} days. Please do not share it with anyone.</p>
          <p>Your previous submission has been retained. Your employee account will only be created after HR verifies your onboarding and formally adds you to Employee Master Data.</p>
          <p>Regards,<br />HR Team<br />TEENS SOFTWARE SOLUTIONS LLP<br />Hyderabad, Telangana, India</p>
        </div>
      `
      : `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #222; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1f2937;">Complete Your Employee Onboarding</h2>
          <p>Dear ${safeName},</p>
          <p>Congratulations on accepting your offer at <strong>TEENS SOFTWARE SOLUTIONS LLP</strong>.</p>
          <p>Please use the secure link below to complete your onboarding details and upload the required documents.</p>
          <p style="margin: 28px 0;">
            <a href="${safeUrl}" style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: bold;">
              Complete Onboarding
            </a>
          </p>
          <p><strong>Important:</strong> This link expires in ${TOKEN_EXPIRY_DAYS} days. Please do not share it with anyone.</p>
          <p>Your employee account and portal access will only be created after HR verifies your onboarding and formally adds you to Employee Master Data.</p>
          <p>If you have questions, please contact the HR team.</p>
          <p>Regards,<br />HR Team<br />TEENS SOFTWARE SOLUTIONS LLP<br />Hyderabad, Telangana, India</p>
        </div>
      `;

    // 11. Create an audit record before attempting email delivery.
    const { data: sendAttemptEvent, error: sendAttemptAuditError } =
      await admin
        .from("joining_onboarding_events")
        .insert({
          candidate_id: candidateId,
          submission_id: submission.id,
          actor_type: role,
          actor_user_id: user.id,
          event_type: correctionMode
            ? "onboarding_correction_link_send_started"
            : "onboarding_link_send_started",
          event_details: {
            token_id: tokenRecord.id,
            expires_at: expiresAt,
            submission_version: submission.version,
            recipient,
          },
        })
        .select("id")
        .single();

    if (sendAttemptAuditError || !sendAttemptEvent) {
      console.error(
        "[Onboarding Link] Unable to create send audit record:",
        sendAttemptAuditError
      );

      await rollbackTokenGeneration(
        admin,
        candidateId,
        generationLockId,
        tokenRecord.id,
        previousTokenId
      );

      await admin
        .from("joining_candidates")
        .update({
          onboarding_status: candidate.onboarding_status,
          onboarding_link_sent_at: candidate.onboarding_link_sent_at,
        })
        .eq("id", candidateId)
        .eq("onboarding_link_sent_at", nowIso)
        .eq("onboarding_status", targetStatus);

      return responseError(
        "Unable to record the onboarding email attempt. No email was sent.",
        500
      );
    }

    // 12. Send email.
    let emailResult: Awaited<ReturnType<typeof resend.emails.send>>;

    try {
      emailResult = await resend.emails.send({
        from: fromEmail,
        to: [recipient],
        subject,
        text,
        html,
      });
    } catch (sendError) {
      // A network exception can leave delivery uncertain.
      // Retain the new token and lock temporarily to avoid immediate
      // duplicate sends. The lock expires after 10 minutes.
      console.error(
        "[Onboarding Link] Email outcome could not be confirmed:",
        sendError
      );

      const unknownEventType = correctionMode
        ? "onboarding_correction_link_send_outcome_unknown"
        : "onboarding_link_send_outcome_unknown";

      const { error: unknownAuditError } = await admin
        .from("joining_onboarding_events")
        .update({
          event_type: unknownEventType,
          event_details: {
            token_id: tokenRecord.id,
            expires_at: expiresAt,
            submission_version: submission.version,
            recipient,
            reason: "The email provider outcome could not be confirmed.",
          },
        })
        .eq("id", sendAttemptEvent.id)
        .eq("candidate_id", candidateId)
        .eq("submission_id", submission.id);

      if (unknownAuditError) {
        console.error(
          "[Onboarding Link] Unknown-outcome audit update failed:",
          unknownAuditError
        );
      }

      return responseError(
        "The email provider's delivery outcome could not be confirmed. Check email delivery activity before trying again.",
        502
      );
    }

    // 13. Handle a definite email-provider error.
    if (emailResult.error) {
      console.error(
        "[Onboarding Link] Resend delivery failed:",
        emailResult.error
      );

      await rollbackTokenGeneration(
        admin,
        candidateId,
        generationLockId,
        tokenRecord.id,
        previousTokenId
      );

      const { error: statusRollbackError } = await admin
        .from("joining_candidates")
        .update({
          onboarding_status: candidate.onboarding_status,
          onboarding_link_sent_at: candidate.onboarding_link_sent_at,
        })
        .eq("id", candidateId)
        .eq("onboarding_link_sent_at", nowIso)
        .eq("onboarding_status", targetStatus);

      if (statusRollbackError) {
        console.error(
          "[Onboarding Link] Status rollback failed:",
          statusRollbackError
        );
      }

      const failedEventType = correctionMode
        ? "onboarding_correction_link_email_failed"
        : "onboarding_link_email_failed";

      const { error: failedAuditError } = await admin
        .from("joining_onboarding_events")
        .update({
          event_type: failedEventType,
          event_details: {
            token_id: tokenRecord.id,
            reason: "Email provider returned an error.",
            submission_version: submission.version,
            recipient,
          },
        })
        .eq("id", sendAttemptEvent.id)
        .eq("candidate_id", candidateId)
        .eq("submission_id", submission.id);

      if (failedAuditError) {
        console.error(
          "[Onboarding Link] Failed to update email failure audit:",
          failedAuditError
        );
      }

      return responseError(
        correctionMode
          ? "The correction email could not be sent. Please try again."
          : "The onboarding email could not be sent. Please try again.",
        502
      );
    }

    // 14. Update the same audit record after successful delivery.
    const successEventType = correctionMode
      ? "onboarding_correction_link_sent"
      : "onboarding_link_sent";

    const { error: successAuditError } = await admin
      .from("joining_onboarding_events")
      .update({
        event_type: successEventType,
        event_details: {
          token_id: tokenRecord.id,
          expires_at: expiresAt,
          submission_version: submission.version,
          recipient,
        },
      })
      .eq("id", sendAttemptEvent.id)
      .eq("candidate_id", candidateId)
      .eq("submission_id", submission.id);

    if (successAuditError) {
      // Email was sent. Do not tell HR to resend and risk duplicates.
      // Retain the lock temporarily until the audit is reconciled.
      console.error(
        "[Onboarding Link] Successful delivery audit update failed:",
        successAuditError
      );

      return NextResponse.json(
        {
          success: true,
          message:
            "The email was sent, but its audit record could not be finalized. Please check the onboarding event history before attempting another send.",
          expiresAt,
          onboardingStatus: targetStatus,
          auditWarning: true,
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 15. Release the generation lock after confirmed delivery and audit.
    const { error: finishError } = await (admin as unknown as RpcAdminClient).rpc(
      "finish_candidate_onboarding_link_generation",
      {
        p_candidate_id: candidateId,
        p_lock_id: generationLockId,
      }
    );

    if (finishError) {
      console.error(
        "[Onboarding Link] Failed to release generation lock:",
        finishError
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: correctionMode
          ? "Correction link sent successfully."
          : "Onboarding link sent successfully.",
        expiresAt,
        onboardingStatus: targetStatus,
        previousLinksRevoked: true,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[Onboarding Link] Failed:", error);

    return responseError(
      "Unable to send the onboarding link. Please try again.",
      500
    );
  }
}