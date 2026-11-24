
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

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[Move Candidate] Role lookup failed:", profileError);

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
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authorization = await authorizeHrOrCeo();

  if (!authorization.ok) {
    return responseError(
      authorization.error,
      authorization.status
    );
  }

  const { admin, user, role } = authorization;
  const { id: candidateId } = await context.params;

  if (!UUID_PATTERN.test(candidateId)) {
    return responseError("Invalid candidate ID.", 400);
  }

  try {
    // 1. Load the candidate and verify the current workflow state.
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select(`
        id,
        status,
        accepted_offer_document_id,
        conversion_status,
        employee_record_id,
        add_employee_moved_at
      `)
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) {
      throw candidateError;
    }

    if (!candidate) {
      return responseError("Joining candidate not found.", 404);
    }

    if (candidate.status !== "offer_accepted") {
      return responseError(
        "Only candidates who have accepted their offer can be moved to Add Employee.",
        409
      );
    }

    if (
      candidate.conversion_status === "processing" ||
      candidate.conversion_status === "completed" ||
      candidate.employee_record_id
    ) {
      return responseError(
        "This candidate is already being converted or has already been added as an employee.",
        409
      );
    }

    if (candidate.add_employee_moved_at) {
      return responseError(
        "This candidate has already been moved to Add Employee.",
        409
      );
    }

    const acceptedOfferDocumentId =
      candidate.accepted_offer_document_id;

    if (
      !acceptedOfferDocumentId ||
      !UUID_PATTERN.test(acceptedOfferDocumentId)
    ) {
      return responseError(
        "The accepted offer reference is missing or invalid. Resolve the offer record before moving this candidate.",
        409
      );
    }

    // 2. Verify the exact offer accepted by the candidate.
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
        "The exact accepted offer document could not be verified. The candidate has not been moved.",
        409
      );
    }

    const snapshot: unknown = acceptedOffer.offer_snapshot;

    if (
      !isRecord(snapshot) ||
      !isRecord(snapshot.candidate) ||
      !isRecord(snapshot.compensation) ||
      !isRecord(snapshot.statutory)
    ) {
      return responseError(
        "The accepted offer is missing a valid compensation and statutory snapshot. Resolve the offer record before moving this candidate.",
        409
      );
    }

    // 3. Record the handoff once. The conditions protect against a
    // concurrent move or a candidate conversion happening meanwhile.
    const movedAt = new Date().toISOString();

    const { data: movedCandidate, error: moveError } = await admin
      .from("joining_candidates")
      .update({
        add_employee_moved_at: movedAt,
        add_employee_moved_by: user.id,
      })
      .eq("id", candidateId)
      .eq("status", "offer_accepted")
      .eq("accepted_offer_document_id", acceptedOfferDocumentId)
      .is("add_employee_moved_at", null)
      .is("employee_record_id", null)
      .in("conversion_status", ["not_started", "failed"])
      .select("id, add_employee_moved_at")
      .maybeSingle();

    if (moveError) {
      throw moveError;
    }

    if (!movedCandidate) {
      return responseError(
        "The candidate's status changed or the candidate was already moved. Refresh the page and check the Add Employee queue.",
        409
      );
    }

    console.info("[Move Candidate] Candidate moved to Add Employee.", {
      candidateId,
      actorUserId: user.id,
      actorRole: role,
      movedAt,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Candidate moved to Add Employee successfully.",
        candidateId: movedCandidate.id,
        movedAt: movedCandidate.add_employee_moved_at,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[Move Candidate] Move failed:", error);

    return responseError(
      "Unable to move this candidate. Please try again.",
      500
    );
  }
}
