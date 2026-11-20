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
    // 1. Authenticate the current user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return responseError("Unauthorized.", 401);
    }

    // 2. Verify HR role.
    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[Complete Onboarding Verification] Role lookup failed:",
        profileError
      );

      return responseError("Unable to verify access.", 500);
    }

    if (profile?.role !== "hr") {
      return responseError("HR access required.", 403);
    }

    // 3. Validate candidate ID.
    const { id: candidateId } = await context.params;

    if (!UUID_PATTERN.test(candidateId)) {
      return responseError("Invalid candidate ID.", 400);
    }

    // 4. Call the atomic database verification RPC.
    const { data: result, error: rpcError } = await admin.rpc(
      "complete_candidate_onboarding_verification",
      {
        p_candidate_id: candidateId,
        p_actor_user_id: user.id,
      }
    );

    if (rpcError) {
      console.error(
        "[Complete Onboarding Verification] RPC failed:",
        rpcError
      );

      const message = rpcError.message || "";

      if (
        /already completed|partially recorded|not found|only an hr|not eligible/i.test(
          message
        )
      ) {
        return responseError(message, 409);
      }

      return responseError(
        "Unable to complete HR onboarding verification.",
        500
      );
    }

    if (result !== true) {
      return responseError(
        "Verification cannot be completed. Check all required sections, documents, and employment details.",
        409
      );
    }

    // 5. Return success only after the database transaction succeeds.
    return NextResponse.json(
      {
        success: true,
        message: "HR onboarding verification completed successfully.",
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error(
      "[Complete Onboarding Verification] Request failed:",
      error
    );

    return responseError(
      "Unable to complete HR onboarding verification.",
      500
    );
  }
}
