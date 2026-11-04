import { NextResponse } from "next/server";
import type {
  UploadApiErrorResponse,
  UploadApiResponse,
} from "cloudinary";

import { createClient, createAdminClient } from "@/lib/supabase-server";
import { cloudinary } from "@/lib/cloudinary-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = [
  "resume",
  "experience_document",
] as const;

type DocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number];

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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
    console.error("[Joining Documents] Role check failed:", error);
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

  return { admin, user };
}

function uploadPrivateDocument(
  buffer: Buffer,
  publicId: string,
  mimeType: string
): Promise<{ public_id: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "authenticated",
        access_mode: "authenticated",
        public_id: publicId,
        overwrite: false,
        tags: ["joining-candidate-document"],
        context: {
          mime_type: mimeType,
        },
      },
      (
        error: UploadApiErrorResponse | undefined,
        result: UploadApiResponse | undefined
      ) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.public_id) {
          reject(new Error("Cloudinary did not return an asset ID."));
          return;
        }

        resolve({ public_id: result.public_id });
      }
    ).end(buffer);
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let uploadedPublicId: string | null = null;
  let documentSaved = false;

  try {
    const auth = await authorizeHr();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { id: candidateId } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        candidateId
      )
    ) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const file = formData.get("file");
    const documentType = formData.get("document_type");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a document." },
        { status: 400 }
      );
    }

    if (
      typeof documentType !== "string" ||
      !ALLOWED_DOCUMENT_TYPES.includes(documentType as DocumentType)
    ) {
      return NextResponse.json(
        { error: "Invalid document type." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be between 1 byte and 10 MB." },
        { status: 400 }
      );
    }

    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    if (
      !ALLOWED_EXTENSIONS.includes(extension) ||
      !ALLOWED_MIME_TYPES.includes(file.type)
    ) {
      return NextResponse.json(
        { error: "Only PDF, DOC and DOCX files are allowed." },
        { status: 400 }
      );
    }

    const { admin, user } = auth;

    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select("id")
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) {
      throw candidateError;
    }

    if (!candidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    const { data: previousDocuments, error: versionError } = await admin
      .from("joining_documents")
      .select("version")
      .eq("candidate_id", candidateId)
      .eq("document_type", documentType)
      .order("version", { ascending: false })
      .limit(1);

    if (versionError) {
      throw versionError;
    }

    const version = (previousDocuments?.[0]?.version ?? 0) + 1;

    const safeFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-150);

    const publicId =
      `teens-hr/joining-candidate-documents/${candidateId}/` +
      `${documentType}-v${version}-${Date.now()}${extension}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await uploadPrivateDocument(
      buffer,
      publicId,
      file.type
    );

    uploadedPublicId = uploaded.public_id;

    const { data: document, error: insertError } = await admin
      .from("joining_documents")
      .insert({
        candidate_id: candidateId,
        document_type: documentType,
        version,
        storage_path: uploaded.public_id,
        file_name: safeFileName,
        mime_type: file.type,
        created_by: user.id,
      })
      .select(
        "id, candidate_id, document_type, version, storage_path, file_name, mime_type, created_at, generated_at"
      )
      .single();

    if (insertError) {
      throw insertError;
    }

    documentSaved = true;
    uploadedPublicId = null;

    return NextResponse.json(
      {
        success: true,
        message:
          version === 1
            ? "Document uploaded successfully."
            : "New document version uploaded successfully.",
        document,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Joining Documents] Upload failed:", error);

    if (uploadedPublicId && !documentSaved) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: "raw",
          type: "authenticated",
        });
      } catch (cleanupError) {
        console.error(
          "[Joining Documents] Cloudinary cleanup failed:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to upload candidate document." },
      { status: 500 }
    );
  }
}
