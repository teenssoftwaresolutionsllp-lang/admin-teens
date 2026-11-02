import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { cloudinary } from "@/lib/cloudinary-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authorizeHr() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Document role check failed:", error.message);
    return { error: "Unable to verify access", status: 500 as const };
  }

  if (profile?.role !== "hr") {
    return { error: "HR access required", status: 403 as const };
  }

  return { admin };
}

const allowedDocuments = [
  "offer_letter",
  "joining_letter",
  "resume",
  "experience_document",
];

const allowedExtensions = ["pdf", "doc", "docx"];

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const auth = await authorizeHr();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { documentId } = await context.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID." },
        { status: 400 }
      );
    }

    const { data: record, error } = await auth.admin
      .from("joining_documents")
      .select(
        "id, candidate_id, document_type, storage_path, version, file_name, mime_type"
      )
      .eq("id", documentId)
      .in("document_type", allowedDocuments)
      .maybeSingle();

    if (error) throw error;

    if (!record) {
      return NextResponse.json(
        { error: "Joining document not found." },
        { status: 404 }
      );
    }

    if (!record.storage_path) {
      return NextResponse.json(
        { error: "Document file is not available." },
        { status: 404 }
      );
    }

    const defaultNames: Record<string, string> = {
      offer_letter: `offer-${record.candidate_id}-v${record.version}.pdf`,
      joining_letter: `joining-letter-${record.candidate_id}-v${record.version}.pdf`,
      resume: "Resume.pdf",
      experience_document: "Experience-Document.pdf",
    };

    const fileName = record.file_name || defaultNames[record.document_type];

    const extension = fileName.split(".").pop()?.toLowerCase() || "pdf";

    if (!allowedExtensions.includes(extension)) {
      return NextResponse.json(
        { error: "Unsupported document format." },
        { status: 400 }
      );
    }

    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    const contentType =
      record.mime_type || mimeTypes[extension] || "application/octet-stream";

    const signedUrl = cloudinary.utils.private_download_url(
      record.storage_path,
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
      const responseText = await response.text().catch(() => "");

      console.error("[Joining Document] Cloudinary download failed:", {
        status: response.status,
        response: responseText.slice(0, 500),
        documentId,
        documentType: record.document_type,
      });

      return NextResponse.json(
        { error: "Unable to retrieve the document." },
        { status: 502 }
      );
    }

    const safeFileName = fileName.replace(/["\r\n]/g, "_");
    const encodedFileName = encodeURIComponent(safeFileName);

    // PDFs can be previewed in the browser. Word files download.
    const disposition = extension === "pdf" ? "inline" : "attachment";

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition":
          `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[Joining Document] Retrieval failed:", error);

    return NextResponse.json(
      { error: "Failed to retrieve the joining document." },
      { status: 500 }
    );
  }
}
