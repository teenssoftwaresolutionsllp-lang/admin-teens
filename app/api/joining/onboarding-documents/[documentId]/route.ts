import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { cloudinary } from "@/lib/cloudinary-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!["hr", "ceo"].includes(String(profile?.role || "").toLowerCase())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { documentId } = await context.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    const { data: document, error } = await admin
      .from("joining_onboarding_documents")
      .select(
        "id, candidate_id, submission_id, storage_path, original_file_name, mime_type"
      )
      .eq("id", documentId)
      .maybeSingle();

    if (error) throw error;

    if (!document?.storage_path) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select(
        "id, status, add_employee_moved_at, onboarding_submission_id, conversion_status, employee_record_id"
      )
      .eq("id", document.candidate_id)
      .maybeSingle();

    if (candidateError) throw candidateError;

    if (
      !candidate ||
      candidate.status !== "offer_accepted" ||
      !candidate.add_employee_moved_at ||
      candidate.employee_record_id ||
      ["processing", "completed"].includes(candidate.conversion_status)
    ) {
      return NextResponse.json(
        { error: "Document access denied" },
        { status: 403 }
      );
    }

    const { data: submissions, error: submissionsError } = await admin
      .from("joining_onboarding_submissions")
      .select("id, supersedes_submission_id")
      .eq("candidate_id", document.candidate_id);

    if (submissionsError) throw submissionsError;

    const submissionMap = new Map(
      (submissions ?? []).map((submission) => [
        submission.id,
        submission.supersedes_submission_id,
      ])
    );

    let currentSubmissionId: string | null = candidate.onboarding_submission_id;

    const visited = new Set<string>();
    let belongsToSubmissionHistory = false;

    while (
      currentSubmissionId &&
      !visited.has(currentSubmissionId) &&
      submissionMap.has(currentSubmissionId)
    ) {
      if (currentSubmissionId === document.submission_id) {
        belongsToSubmissionHistory = true;
        break;
      }

      visited.add(currentSubmissionId);
      currentSubmissionId = submissionMap.get(currentSubmissionId) ?? null;
    }

    if (!belongsToSubmissionHistory) {
      return NextResponse.json(
        { error: "Document access denied" },
        { status: 403 }
      );
    }

    const mimeTypes: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
    };

    const extension = mimeTypes[document.mime_type];

    if (!extension) {
      return NextResponse.json(
        { error: "Unsupported document format" },
        { status: 400 }
      );
    }

    const signedUrl = cloudinary.utils.private_download_url(
      document.storage_path,
      extension,
      {
        resource_type: "raw",
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      }
    );

    const response = await fetch(signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok || !response.body) {
      return NextResponse.json(
        { error: "Unable to retrieve document" },
        { status: 502 }
      );
    }

    const fileName = document.original_file_name.replace(/["\r\n]/g, "_");

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": document.mime_type,
        "Content-Disposition": `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
          fileName
        )}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[Onboarding Document] Retrieval failed:", error);

    return NextResponse.json(
      { error: "Failed to retrieve onboarding document" },
      { status: 500 }
    );
  }
}
