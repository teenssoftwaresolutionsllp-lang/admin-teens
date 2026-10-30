import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";
import { cloudinary } from "@/lib/cloudinary-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    // First fetch through the authenticated client.
    // This preserves the existing employee document access rules.
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
    let fileName = document.document_name || "employee-document.pdf";

    // Joining documents are stored privately in Cloudinary.
    // Generate a temporary private URL using the original joining document.
    if (document.source_joining_document_id) {
      const admin = await createAdminClient();

      const { data: joiningDocument, error: joiningError } = await admin
        .from("joining_documents")
        .select("id, document_type, storage_path, candidate_id, version")
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

      fileUrl = cloudinary.utils.private_download_url(
        joiningDocument.storage_path,
        "pdf",
        {
          resource_type: "raw",
          type: "authenticated",
          expires_at: Math.floor(Date.now() / 1000) + 60,
        }
      );

      fileName =
        joiningDocument.document_type === "joining_letter"
          ? "Joining Letter.pdf"
          : "Offer Letter.pdf";
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: "Document URL not found" },
        { status: 404 }
      );
    }

    // Retrieve the document from Cloudinary.
    const cloudinaryResponse = await fetch(fileUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!cloudinaryResponse.ok || !cloudinaryResponse.body) {
      console.error("Cloudinary fetch failed:", {
        status: cloudinaryResponse.status,
        statusText: cloudinaryResponse.statusText,
        documentId: id,
      });

      return NextResponse.json(
        { error: "Failed to fetch document from Cloudinary" },
        { status: 502 }
      );
    }

    // Determine content type from file name.
    let contentType = "application/octet-stream";

    if (fileName.toLowerCase().endsWith(".pdf")) {
      contentType = "application/pdf";
    } else if (/\.(jpg|jpeg)$/i.test(fileName)) {
      contentType = "image/jpeg";
    } else if (/\.png$/i.test(fileName)) {
      contentType = "image/png";
    }

    return new Response(cloudinaryResponse.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
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
