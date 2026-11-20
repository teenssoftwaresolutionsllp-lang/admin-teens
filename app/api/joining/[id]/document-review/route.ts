import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

async function authorizeHrOrCeo() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false as const,
      error: "Unauthorized.",
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
    console.error("[Onboarding Document Review] Role lookup failed:", error);

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
    const auth = await authorizeHrOrCeo();

    if (!auth.ok) {
      return responseError(auth.error, auth.status);
    }

    const { id: candidateId } = await context.params;

    if (!UUID_PATTERN.test(candidateId)) {
      return responseError("Invalid candidate ID.", 400);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return responseError("A valid request body is required.", 400);
    }

    const submissionId = body.submissionId;
    const documentId = body.documentId;
    const decision = body.decision;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const candidateInstruction = typeof body.candidateInstruction === "string" ? body.candidateInstruction.trim() : "";

    if (
      typeof submissionId !== "string" ||
      !UUID_PATTERN.test(submissionId)
    ) {
      return responseError("A valid submission ID is required.", 400);
    }

    if (
      typeof documentId !== "string" ||
      !UUID_PATTERN.test(documentId)
    ) {
      return responseError("A valid document ID is required.", 400);
    }

    if (
      !["approve", "reject", "request_resubmission"].includes(decision)
    ) {
      return responseError("Invalid document review decision.", 400);
    }

    if (
      ["reject", "request_resubmission"].includes(decision) &&
      !candidateInstruction
    ) {
      return responseError(
        "Please provide a reason for rejecting this document.",
        400
      );
    }

    if (reason.length > 2000) {
      return responseError(
        "Review reason cannot exceed 2000 characters.",
        400
      );
    }

    if (candidateInstruction.length > 2000) {
        return responseError(
            "Candidate correction instructions cannot exceed 2000 characters.",
            400
        );
    }

    const rpcAdmin = auth.admin as unknown as RpcAdminClient;

    const { data, error } = await rpcAdmin.rpc(
      "review_candidate_onboarding_document",
      {
        p_candidate_id: candidateId,
        p_expected_submission_id: submissionId,
        p_document_id: documentId,
        p_actor_user_id: auth.user.id,
        p_actor_type: auth.role,
        p_decision: decision,
        p_review_reason: reason || null,
        p_candidate_instruction: candidateInstruction || null,
      }
    );

    if (error) {
      console.error(
        "[Onboarding Document Review] Database review failed:",
        error
      );

      const status =
        error.code === "P0001" ||
        error.code === "23514" ||
        error.code === "22023"
          ? 409
          : 500;

      return responseError(
        status === 409
          ? error.message
          : "Unable to save the document review.",
        status
      );
    }

    return NextResponse.json(
      {
        success: true,
        result: data,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error(
      "[Onboarding Document Review] Unexpected error:",
      error
    );

    return responseError(
      "An unexpected error occurred while reviewing the document.",
      500
    );
  }
}
