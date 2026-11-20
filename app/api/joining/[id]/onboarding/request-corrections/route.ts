import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responseError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate the current user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return responseError("Unauthorized.", 401);
    }

    // 2. Verify HR or CEO role.
    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[Onboarding Corrections] Role lookup failed:",
        profileError
      );

      return responseError("Unable to verify access.", 500);
    }

    const role = String(profile?.role || "").toLowerCase();

    if (!["hr", "ceo"].includes(role)) {
      return responseError("HR or CEO access required.", 403);
    }

    // 3. Validate candidate ID.
    const { id: candidateId } = await context.params;

    if (!UUID_PATTERN.test(candidateId)) {
      return responseError("Invalid candidate ID.", 400);
    }

    // 4. Validate correction instructions.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return responseError("Invalid request body.", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("instructions" in body) ||
      typeof body.instructions !== "string"
    ) {
      return responseError(
        "Correction instructions are required.",
        400
      );
    }

    const instructions = body.instructions.trim();

    if (!instructions) {
      return responseError(
        "Please enter the corrections required.",
        400
      );
    }

    if (instructions.length > 4000) {
      return responseError(
        "Correction instructions cannot exceed 4000 characters.",
        400
      );
    }

    // 5. Load the candidate's current submission.
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select("id, onboarding_submission_id")
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) {
      console.error(
        "[Onboarding Corrections] Candidate lookup failed:",
        candidateError
      );

      return responseError("Unable to load candidate details.", 500);
    }

    if (!candidate?.onboarding_submission_id) {
      return responseError(
        "No active onboarding submission was found.",
        409
      );
    }

    // 6. Atomically create the correction draft and audit event.
    const { data: result, error: rpcError } = await admin.rpc(
      "request_candidate_onboarding_corrections",
      {
        p_candidate_id: candidateId,
        p_expected_submission_id: candidate.onboarding_submission_id,
        p_actor_user_id: user.id,
        p_actor_type: role,
        p_instructions: instructions,
      }
    );

    if (rpcError) {
      console.error(
        "[Onboarding Corrections] Database operation failed:",
        rpcError
      );

      const message = rpcError.message || "";

      if (
        /not submitted|status|changed|conversion|employee|submission/i.test(
          message
        )
      ) {
        return responseError(
          "The onboarding submission is no longer eligible for corrections. Refresh and try again.",
          409
        );
      }

      return responseError(
        "Unable to request onboarding corrections.",
        500
      );
    }

    const correctionResult = result as
      | {
          success?: boolean;
          error?: string;
          submission_id?: string;
          version?: number;
          status?: string;
        }
      | null;

    if (!correctionResult || correctionResult.success !== true) {
      return responseError(
        correctionResult?.error ||
          "Unable to create the correction request.",
        409
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Correction request created successfully.",
        submissionId: correctionResult.submission_id,
        version: correctionResult.version,
        onboardingStatus: correctionResult.status,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[Onboarding Corrections] Request failed:", error);

    return responseError(
      "Unable to request onboarding corrections.",
      500
    );
  }
}
