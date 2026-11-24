import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-server";
import { cloudinary } from "@/lib/cloudinary-client";
import {
  ONBOARDING_SESSION_COOKIE,
  verifyOnboardingSession,
} from "@/lib/joining-onboarding-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { error: "Your onboarding session is invalid or expired. Please reopen your onboarding link." },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET() {
  try {
    // 1. Verify the signed candidate session.
    const cookieStore = await cookies();

    const sessionValue = cookieStore.get(
      ONBOARDING_SESSION_COOKIE
    )?.value;

    const session = verifyOnboardingSession(sessionValue);

    if (!session) {
      return unauthorized();
    }

    const admin = await createAdminClient();
    const now = new Date();

    // 2. Revalidate the original onboarding token.
    const { data: tokenRecord, error: tokenError } = await admin
      .from("joining_onboarding_tokens")
      .select("id, candidate_id, expires_at")
      .eq("id", session.tokenId)
      .eq("candidate_id", session.candidateId)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now.toISOString())
      .maybeSingle();

    if (tokenError) {
      console.error(
        "[Accepted Offer] Token validation failed:",
        tokenError
      );

      return NextResponse.json(
        { error: "Unable to verify your onboarding session." },
        { status: 500 }
      );
    }

    if (!tokenRecord) {
      return unauthorized();
    }

    // 3. Verify the candidate and current onboarding submission.
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select(`
        id,
        status,
        onboarding_status,
        onboarding_submission_id,
        conversion_status,
        employee_record_id,
        accepted_offer_document_id
      `)
      .eq("id", session.candidateId)
      .maybeSingle();

    if (candidateError) {
      console.error(
        "[Accepted Offer] Candidate lookup failed:",
        candidateError
      );

      return NextResponse.json(
        { error: "Unable to verify candidate details." },
        { status: 500 }
      );
    }

    if (
      !candidate ||
      candidate.status !== "offer_accepted" ||
      !["in_progress", "submitted"].includes(
        candidate.onboarding_status
      ) ||
      candidate.onboarding_submission_id !== session.submissionId ||
      candidate.conversion_status === "processing" ||
      candidate.conversion_status === "completed" ||
      candidate.employee_record_id ||
      !candidate.accepted_offer_document_id
    ) {
      return unauthorized();
    }

    // 4. Verify the exact current submission.
    const { data: submission, error: submissionError } = await admin
      .from("joining_onboarding_submissions")
      .select("id, candidate_id, status")
      .eq("id", session.submissionId)
      .eq("candidate_id", session.candidateId)
      .maybeSingle();

    if (submissionError) {
      console.error(
        "[Accepted Offer] Submission lookup failed:",
        submissionError
      );

      return NextResponse.json(
        { error: "Unable to verify your onboarding submission." },
        { status: 500 }
      );
    }

    if (
      !submission ||
      !["draft", "submitted"].includes(submission.status)
    ) {
      return unauthorized();
    }

    // 5. Retrieve ONLY the original offer accepted by this candidate.
    // Never select the latest offer or trust a document ID from the browser.
    const { data: offer, error: offerError } = await admin
      .from("joining_documents")
      .select(`
        id,
        candidate_id,
        document_type,
        storage_path,
        version,
        file_name,
        mime_type,
        sent_at
      `)
      .eq("id", candidate.accepted_offer_document_id)
      .eq("candidate_id", candidate.id)
      .maybeSingle();

    if (offerError) {
      console.error(
        "[Accepted Offer] Document lookup failed:",
        offerError
      );

      return NextResponse.json(
        { error: "Unable to retrieve the accepted offer." },
        { status: 500 }
      );
    }

    if (
      !offer ||
      offer.document_type !== "offer_letter" ||
      !offer.sent_at ||
      !offer.storage_path
    ) {
      return NextResponse.json(
        { error: "The original accepted offer document is unavailable." },
        { status: 404 }
      );
    }

    // 6. Only the original PDF is allowed through this endpoint.
    const fileName =
      typeof offer.file_name === "string" && offer.file_name.trim()
        ? offer.file_name
        : `accepted-offer-${candidate.id}-v${offer.version}.pdf`;

    const extension =
      fileName.split(".").pop()?.toLowerCase() || "";

    if (extension !== "pdf") {
      return NextResponse.json(
        { error: "The accepted offer is not available as a PDF." },
        { status: 415 }
      );
    }

    if (
      offer.mime_type &&
      offer.mime_type !== "application/pdf"
    ) {
      return NextResponse.json(
        { error: "The accepted offer has an unsupported file format." },
        { status: 415 }
      );
    }

    // 7. Generate a short-lived private Cloudinary download URL.
    const signedUrl = cloudinary.utils.private_download_url(
      offer.storage_path,
      "pdf",
      {
        resource_type: "raw",
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      }
    );

    const fileResponse = await fetch(signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!fileResponse.ok || !fileResponse.body) {
      const responseText = await fileResponse
        .text()
        .catch(() => "");

      console.error(
        "[Accepted Offer] Cloudinary download failed:",
        {
          status: fileResponse.status,
          response: responseText.slice(0, 500),
          candidateId: candidate.id,
          documentId: offer.id,
        }
      );

      return NextResponse.json(
        { error: "Unable to retrieve the original offer PDF." },
        { status: 502 }
      );
    }

    // 8. Stream the original PDF directly to the candidate.
    const safeFileName = fileName.replace(/["\r\n]/g, "_");

    return new Response(fileResponse.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `inline; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "[Accepted Offer] Retrieval failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to retrieve the accepted offer." },
      { status: 500 }
    );
  }
}