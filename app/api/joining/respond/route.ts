
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OfferAction = "accept_offer" | "decline_offer";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isValidAction(value: unknown): value is OfferAction {
  return value === "accept_offer" || value === "decline_offer";
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function invalidLink() {
  return NextResponse.json(
    {
      valid: false,
      error: "This link is invalid, expired, or unavailable.",
    },
    {
      status: 400,
      headers: noStoreHeaders(),
    }
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    const action = url.searchParams.get("action");

    if (!isValidAction(action)) return invalidLink();

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return invalidLink();
    }

    const admin = await createAdminClient();

    // 1. Find the exact response token.
    const { data: tokenRecord, error: tokenError } = await admin
      .from("joining_action_tokens")
      .select(
        "candidate_id, document_id, activated_at, expires_at, used_at, revoked_at"
      )
      .eq("token_hash", hashToken(token))
      .eq("action", action)
      .maybeSingle();

    if (tokenError) throw tokenError;

    // Only activated tokens linked to an exact offer document are valid.
    if (
      !tokenRecord ||
      !tokenRecord.document_id ||
      !tokenRecord.activated_at ||
      tokenRecord.used_at ||
      tokenRecord.revoked_at ||
      !tokenRecord.expires_at ||
      new Date(tokenRecord.expires_at).getTime() <= Date.now()
    ) {
      return invalidLink();
    }

    // 2. Candidate must still be awaiting an offer decision.
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select("id, first_name, status, accepted_offer_document_id")
      .eq("id", tokenRecord.candidate_id)
      .maybeSingle();

    if (candidateError) throw candidateError;

    if (
      !candidate ||
      candidate.status !== "offer_sent" ||
      candidate.accepted_offer_document_id !== null
    ) {
      return invalidLink();
    }

    // 3. Verify the exact document belongs to this candidate.
    const { data: offerDocument, error: documentError } = await admin
      .from("joining_documents")
      .select("id, version, sent_at, offer_snapshot")
      .eq("id", tokenRecord.document_id)
      .eq("candidate_id", tokenRecord.candidate_id)
      .eq("document_type", "offer_letter")
      .maybeSingle();

    if (documentError) throw documentError;

    if (
      !offerDocument ||
      !offerDocument.sent_at ||
      !offerDocument.offer_snapshot ||
      typeof offerDocument.offer_snapshot !== "object" ||
      Array.isArray(offerDocument.offer_snapshot)
    ) {
      return invalidLink();
    }

    // 4. Only the latest offer revision can be accepted or declined.
    // Include unsent revisions so an older sent offer cannot remain valid
    // when a newer revision has already been created.
    const { data: latestOffer, error: latestOfferError } = await admin
      .from("joining_documents")
      .select("id, version")
      .eq("candidate_id", tokenRecord.candidate_id)
      .eq("document_type", "offer_letter")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestOfferError) throw latestOfferError;

    if (
      !latestOffer ||
      latestOffer.id !== offerDocument.id ||
      latestOffer.version !== offerDocument.version
    ) {
      return invalidLink();
    }

    return NextResponse.json(
      {
        valid: true,
        firstName: candidate.first_name,
        action,
      },
      {
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error("[Offer Response] Validation failed:", error);

    return NextResponse.json(
      {
        error: "Unable to validate this offer link. Please try again.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const token = body?.token;
    const action = body?.action;

    if (!isValidAction(action)) return invalidLink();

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return invalidLink();
    }

    const admin = await createAdminClient();
    const tokenHash = hashToken(token);

    // Find the candidate before the atomic RPC consumes the token.
    // The RPC remains responsible for all authoritative validation.
    const { data: tokenOwner, error: tokenOwnerError } = await admin
      .from("joining_action_tokens")
      .select("candidate_id")
      .eq("token_hash", tokenHash)
      .eq("action", action)
      .maybeSingle();

    if (tokenOwnerError) throw tokenOwnerError;

    let candidateOwner: {
      id: string;
      first_name: string;
      last_name: string;
      created_by: string | null;
    } | null = null;

    if (tokenOwner?.candidate_id) {
      const { data: candidateData, error: candidateLookupError } =
        await admin
          .from("joining_candidates")
          .select("id, first_name, last_name, created_by")
          .eq("id", tokenOwner.candidate_id)
          .maybeSingle();

      if (candidateLookupError) throw candidateLookupError;

      candidateOwner = candidateData;
    }

    // The database function atomically validates and consumes the token,
    // checks the exact offer version, and records the candidate decision.
    const { data, error } = await admin.rpc(
      "respond_to_joining_offer",
      {
        p_token_hash: tokenHash,
        p_action: action,
      }
    );

    if (error) {
      console.error("[Offer Response] Decision failed:", error);

      return NextResponse.json(
        {
          error: "Unable to record your decision. Please contact HR.",
        },
        {
          status: 500,
          headers: noStoreHeaders(),
        }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.message ??
            "This offer link is no longer available.",
        },
        {
          status: 409,
          headers: noStoreHeaders(),
        }
      );
    }

    // Notify the HR user who created the candidate.
    if (candidateOwner?.created_by) {
      const accepted = action === "accept_offer";

      const candidateName =
        `${candidateOwner.first_name} ${candidateOwner.last_name}`.trim();

      const { error: notificationError } = await admin
        .from("notifications")
        .insert({
          recipient_user_id: candidateOwner.created_by,
          employee_id: null,
          title: accepted
            ? "Joining Offer Accepted"
            : "Joining Offer Declined",
          message: `${candidateName} has ${
            accepted ? "accepted" : "declined"
          } the joining offer.`,
          type: "joining",
          is_read: false,
        });

      if (notificationError) {
        console.error(
          "[Offer Response] HR notification insert failed:",
          notificationError.message
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        status: data.status,
        message: data.message,
      },
      {
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error("[Offer Response] Request failed:", error);

    return NextResponse.json(
      {
        error: "Unable to process your decision. Please try again.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }
}
