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

    return {
      error: "Unable to verify access",
      status: 500 as const,
    };
  }

  if (profile?.role !== "hr") {
    return {
      error: "HR access required",
      status: 403 as const,
    };
  }

  return { admin };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    // 1. Authenticate and authorize HR.
    const auth = await authorizeHr();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // 2. Validate document ID.
    const { documentId } = await context.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID." },
        { status: 400 }
      );
    }

    // 3. Fetch either an offer letter or a joining letter.
    const { data: record, error } = await auth.admin
      .from("joining_documents")
      .select("id, candidate_id, document_type, storage_path, version")
      .eq("id", documentId)
      .in("document_type", ["offer_letter", "joining_letter"])
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!record) {
      return NextResponse.json(
        { error: "Joining document not found." },
        { status: 404 }
      );
    }

    if (!record.storage_path) {
      console.error("Joining document has no Cloudinary asset ID.", {
        documentId,
        documentType: record.document_type,
      });

      return NextResponse.json(
        { error: "PDF is not available for this document." },
        { status: 404 }
      );
    }

    // 4. Generate a short-lived private download URL.
    const signedUrl = cloudinary.utils.private_download_url(
      record.storage_path,
      "pdf",
      {
        resource_type: "raw",
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      }
    );

    // 5. Retrieve the PDF on the server.
    const response = await fetch(signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok || !response.body) {
      const responseText = await response.text().catch(() => "");

      console.error("[Joining Document] Cloudinary download failed:", {
        status: response.status,
        response: responseText.slice(0, 500),
        candidateId: record.candidate_id,
        documentType: record.document_type,
        version: record.version,
      });

      return NextResponse.json(
        { error: "Unable to retrieve the PDF." },
        { status: 502 }
      );
    }

    // 6. Select a filename based on document type.
    const prefix =
      record.document_type === "joining_letter"
        ? "joining-letter"
        : "offer";

    // 7. Stream the PDF to the authorized HR user.
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `inline; filename="${prefix}-${record.candidate_id}-v${record.version}.pdf"`,
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
