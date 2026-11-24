import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary-client";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid policy ID." },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Unable to verify access." },
        { status: 403 }
      );
    }

    const role = String(profile.role || "").toLowerCase();
    const isManager = role === "hr" || role === "ceo";

    const { data: policy, error } = await admin
      .from("policies")
      .select(
        "id, status, cloudinary_public_id, cloudinary_resource_type, document_name, document_content_type"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[Policy Document] Lookup failed:", error);
      return NextResponse.json(
        { error: "Unable to retrieve policy." },
        { status: 500 }
      );
    }

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found." },
        { status: 404 }
      );
    }

    if (!isManager && policy.status !== "Active") {
      return NextResponse.json(
        { error: "This policy document is not available." },
        { status: 403 }
      );
    }

    if (
      !policy.cloudinary_public_id ||
      !policy.document_name
    ) {
      return NextResponse.json(
        { error: "No document is attached to this policy." },
        { status: 404 }
      );
    }

    if (
      policy.cloudinary_resource_type !== "raw" ||
      !policy.cloudinary_public_id.startsWith("policies/")
    ) {
      return NextResponse.json(
        { error: "Invalid document reference." },
        { status: 400 }
      );
    }

    const extension =
      policy.document_name.split(".").pop()?.toLowerCase() || "";

    if (!["pdf", "doc", "docx"].includes(extension)) {
      return NextResponse.json(
        { error: "Unsupported document format." },
        { status: 400 }
      );
    }

    const contentType =
      policy.document_content_type || MIME_TYPES[extension];

    if (contentType !== MIME_TYPES[extension]) {
      return NextResponse.json(
        { error: "Invalid document content type." },
        { status: 400 }
      );
    }

    const signedUrl = cloudinary.utils.private_download_url(
      policy.cloudinary_public_id,
      extension,
      {
        resource_type: "raw",
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      }
    );

    const cloudinaryResponse = await fetch(signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!cloudinaryResponse.ok || !cloudinaryResponse.body) {
      console.error(
        "[Policy Document] Cloudinary retrieval failed:",
        cloudinaryResponse.status
      );

      return NextResponse.json(
        { error: "Unable to retrieve the policy document." },
        { status: 502 }
      );
    }

    const safeName = policy.document_name.replace(
      /["\r\n]/g,
      "_"
    );

    const encodedName = encodeURIComponent(safeName);
    const disposition =
      extension === "pdf" ? "inline" : "attachment";

    return new Response(cloudinaryResponse.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition":
          `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[Policy Document] Retrieval failed:", error);

    return NextResponse.json(
      { error: "Failed to retrieve policy document." },
      { status: 500 }
    );
  }
}
