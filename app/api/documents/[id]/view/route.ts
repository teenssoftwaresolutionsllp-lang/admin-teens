
import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";
import { cloudinary } from "@/lib/cloudinary-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    // Fetch through the authenticated client to preserve
    // the existing employee document access rules.
    const { data: document, error } = await supabase
      .from("employee_documents")
      .select(`
        id,
        document_url,
        document_name,
        source_joining_document_id
      `)
      .eq("id", id)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    let fileUrl = document.document_url;
    let fileName =
      document.document_name || "employee-document";

    if (document.source_joining_document_id) {
      const admin = await createAdminClient();

      const { data: joiningDocument, error: joiningError } =
        await admin
          .from("joining_documents")
          .select(`
            id,
            document_type,
            storage_path,
            file_name,
            mime_type
          `)
          .eq("id", document.source_joining_document_id)
          .maybeSingle();

      if (joiningError) {
        console.error(
          "Joining document lookup failed:",
          joiningError.message
        );

        return NextResponse.json(
          { error: "Unable to retrieve joining document" },
          { status: 500 }
        );
      }

      if (!joiningDocument?.storage_path) {
        return NextResponse.json(
          { error: "Joining document file not found" },
          { status: 404 }
        );
      }

      const documentType = joiningDocument.document_type;

      const defaultNames: Record<string, string> = {
        offer_letter: "Offer Letter.pdf",
        joining_letter: "Joining Letter.pdf",
        resume: "Resume",
        experience_document: "Experience Letter",
      };

      fileName =
        joiningDocument.file_name ||
        defaultNames[documentType] ||
        "employee-document";

      const extension = getExtension(fileName);

      if (!extension) {
        return NextResponse.json(
          { error: "Document filename has no extension" },
          { status: 400 }
        );
      }

      fileUrl = cloudinary.utils.private_download_url(
        joiningDocument.storage_path,
        extension.slice(1),
        {
          resource_type: "raw",
          type: "authenticated",
          expires_at: Math.floor(Date.now() / 1000) + 60,
        }
      );
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: "Document URL not found" },
        { status: 404 }
      );
    }

    const cloudinaryResponse = await fetch(fileUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!cloudinaryResponse.ok || !cloudinaryResponse.body) {
      console.error("Document fetch failed:", {
        status: cloudinaryResponse.status,
        statusText: cloudinaryResponse.statusText,
        documentId: id,
      });

      return NextResponse.json(
        { error: "Failed to fetch document" },
        { status: 502 }
      );
    }

    const extension = getExtension(fileName);
    const contentType =
      MIME_TYPES[extension] || "application/octet-stream";

    // Only PDF and image formats are suitable for inline browser preview.
    const canPreviewInline =
      contentType === "application/pdf" ||
      contentType.startsWith("image/");

    const safeFileName = fileName.replace(/["\r\n]/g, "_");

    return new Response(cloudinaryResponse.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition":
          `${canPreviewInline ? "inline" : "attachment"}; filename="${safeFileName}"`,
        "Cache-Control":
          "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Document view error:", error);

    return NextResponse.json(
      { error: "Failed to view document" },
      { status: 500 }
    );
  }
}
