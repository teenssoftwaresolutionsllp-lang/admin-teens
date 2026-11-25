import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cloudinary } from "@/lib/cloudinary-client";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

async function authorizePolicyManager() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized.", status: 401 };
  }

  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return {
      error: "Unable to verify permissions.",
      status: 403,
    };
  }

  const role = String(profile.role || "").toLowerCase();

  if (role !== "hr" && role !== "ceo") {
    return {
      error: "Only HR and CEO can upload policy documents.",
      status: 403,
    };
  }

  return { user };
}

function detectDocumentType(
  buffer: Buffer,
  extension: string
): boolean {
  if (extension === "pdf") {
    return (
      buffer.length >= 5 &&
      buffer.subarray(0, 5).toString("ascii") === "%PDF-"
    );
  }

  if (extension === "doc") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([
          0xd0, 0xcf, 0x11, 0xe0,
          0xa1, 0xb1, 0x1a, 0xe1,
        ])
      )
    );
  }

  if (extension === "docx") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(buffer[2]) &&
      [0x04, 0x06, 0x08].includes(buffer[3])
    );
  }

  return false;
}

function uploadToCloudinary(
  buffer: Buffer,
  publicId: string,
  mimeType: string
): Promise<{ public_id: string }> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "raw",
        type: "authenticated",
        access_mode: "authenticated",
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        tags: ["company-policy-private"],
        context: {
          mime_type: mimeType,
        },
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed."));
          return;
        }

        resolve({ public_id: result.public_id });
      }
    );

    upload.end(buffer);
  });
}

export async function POST(request: Request) {
  try {
    const auth = await authorizePolicyManager();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a document." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The selected file is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Maximum document size is 10 MB." },
        { status: 400 }
      );
    }

    const originalName = file.name
      .normalize("NFKC")
      .replace(/[\r\n"]/g, "_")
      .slice(0, 255);

    const extension =
      originalName.split(".").pop()?.toLowerCase() || "";

    if (!["pdf", "doc", "docx"].includes(extension)) {
      return NextResponse.json(
        { error: "Only PDF, DOC and DOCX files are allowed." },
        { status: 400 }
      );
    }

    const expectedMime = MIME_TYPES[extension];

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!detectDocumentType(buffer, extension)) {
      return NextResponse.json(
        { error: "The file content does not match its extension." },
        { status: 400 }
      );
    }

    const publicId =
      `policies/${auth.user.id}/${randomUUID()}`;

    const uploaded = await uploadToCloudinary(
      buffer,
      publicId,
      expectedMime
    );

    return NextResponse.json(
      {
        document: {
          cloudinary_public_id: uploaded.public_id,
          cloudinary_resource_type: "raw",
          document_name: originalName,
          document_content_type: expectedMime,
          document_url: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Policy Upload] Failed:", error);

    return NextResponse.json(
      { error: "Failed to upload policy document." },
      { status: 500 }
    );
  }
}
