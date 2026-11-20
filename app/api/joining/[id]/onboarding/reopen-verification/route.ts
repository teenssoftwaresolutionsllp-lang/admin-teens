
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
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return responseError("Unauthorized", 401);
    }

    const { id: candidateId } = await context.params;

    if (!UUID_PATTERN.test(candidateId)) {
      return responseError("Invalid candidate ID.", 400);
    }

    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[Reopen Verification] Profile lookup failed:", profileError);
      return responseError("Unable to verify access.", 500);
    }

    if (String(profile?.role ?? "").toLowerCase() !== "hr") {
      return responseError(
        "Only HR users can reopen onboarding verification.",
        403
      );
    }

    const { data, error } = await admin.rpc(
      "reopen_candidate_onboarding_verification",
      {
        p_candidate_id: candidateId,
        p_actor_user_id: user.id,
      }
    );

    if (error) {
      console.error("[Reopen Verification] RPC failed:", error);

      const message = error.message || "";

      if (
        /not found|already reopened|already completed|only an HR|only completed|converted|converting|joining letter|submission is missing/i.test(
          message
        )
      ) {
        return responseError(message, 409);
      }

      return responseError(
        "Unable to reopen onboarding verification.",
        500
      );
    }

    if (data !== true) {
      return responseError(
        "Onboarding verification could not be reopened.",
        409
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Onboarding verification reopened successfully.",
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[Reopen Verification] Unexpected error:", error);

    return responseError(
      "An unexpected error occurred while reopening verification.",
      500
    );
  }
}
