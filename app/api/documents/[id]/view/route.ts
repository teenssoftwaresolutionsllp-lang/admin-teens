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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Keep employee_documents access controlled by RLS.
    const { data: document, error } = await supabase
      .from("employee_documents")
      .select(`
        id,
        employee_id,
        document_url,
        document_name,
        cloudinary_public_id,
        cloudinary_resource_type,
        source_joining_document_id,
        source_onboarding_document_id
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Confirm the caller is HR/CEO or the employee who owns this record.
    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const role = String(profile?.role || "").toLowerCase();

    if (role !== "hr" && role !== "ceo") {
      const { data: employee, error: employeeError } = await admin
        .from("employees")
        .select("id")
        .eq("id", document.employee_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (employeeError) throw employeeError;

      if (!employee) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
    }

    let fileUrl = document.document_url;
    let fileName =
      document.document_name || "employee-document";

    // Original onboarding document.
    if (document.source_onboarding_document_id) {
      const { data: onboardingDocument, error: onboardingError } =
        await admin
          .from("joining_onboarding_documents")
          .select(`
            id,
            storage_path,
            original_file_name,
            mime_type
          `)
          .eq("id", document.source_onboarding_document_id)
          .maybeSingle();

      if (onboardingError) throw onboardingError;

      if (!onboardingDocument?.storage_path) {
        return NextResponse.json(
          { error: "Onboarding document file not found" },
          { status: 404 }
        );
      }

      fileName =
        onboardingDocument.original_file_name ||
        fileName;

      const extension = getExtension(fileName);

      if (!extension) {
        return NextResponse.json(
          { error: "Document filename has no extension" },
          { status: 400 }
        );
      }

      fileUrl = cloudinary.utils.private_download_url(
        onboardingDocument.storage_path,
        extension.slice(1),
        {
          resource_type: "raw",
          type: "authenticated",
          expires_at: Math.floor(Date.now() / 1000) + 60,
        }
      );
    }

    // Existing joining document.
    else if (document.source_joining_document_id) {
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

      if (joiningError) throw joiningError;

      if (!joiningDocument?.storage_path) {
        return NextResponse.json(
          { error: "Joining document file not found" },
          { status: 404 }
        );
      }

      fileName =
        joiningDocument.file_name ||
        fileName;

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

    const response = await fetch(fileUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok || !response.body) {
      console.error("Document fetch failed:", {
        status: response.status,
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

    const canPreviewInline =
      contentType === "application/pdf" ||
      contentType.startsWith("image/");

    const safeFileName = fileName.replace(/["\r\n]/g, "_");

    return new Response(response.body, {
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
