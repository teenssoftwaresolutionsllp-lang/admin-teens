import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
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

    const { id } = await params;
    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError);
      return NextResponse.json(
        { error: "Unable to verify permissions." },
        { status: 500 }
      );
    }

    const role = String(profile?.role ?? "").toLowerCase();

    if (role !== "hr" && role !== "ceo") {
      return NextResponse.json(
        { error: "You are not authorized to view this document." },
        { status: 403 }
      );
    }

    const { data: resignation, error: requestError } = await admin
      .from("resignation_requests")
      .select("document_url, document_name")
      .eq("id", id)
      .maybeSingle();

    if (requestError) {
      console.error("Resignation lookup failed:", requestError);
      return NextResponse.json(
        { error: "Unable to retrieve resignation request." },
        { status: 500 }
      );
    }

    if (!resignation?.document_url) {
      return NextResponse.json(
        { error: "Supporting document not found." },
        { status: 404 }
      );
    }

    const storagePath = resignation.document_url;

    // Only allow paths belonging to this resignation's employee.
    const { data: requestOwner, error: ownerError } = await admin
      .from("resignation_requests")
      .select("employee_id")
      .eq("id", id)
      .single();

    if (ownerError || !requestOwner) {
      return NextResponse.json(
        { error: "Unable to verify document ownership." },
        { status: 500 }
      );
    }

    if (
      !storagePath.startsWith(`${requestOwner.employee_id}/`) ||
      storagePath.includes("..") ||
      storagePath.startsWith("/") ||
      storagePath.includes("\\")
    ) {
      return NextResponse.json(
        { error: "Invalid document path." },
        { status: 400 }
      );
    }

    const { data: file, error: downloadError } = await admin.storage
      .from("employee-exit-documents")
      .download(storagePath);

    if (downloadError || !file) {
      console.error("Document download failed:", downloadError);
      return NextResponse.json(
        { error: "Unable to download supporting document." },
        { status: 404 }
      );
    }

    const safeName = String(resignation.document_name || "resignation-document")
      .replace(/[\r\n"]/g, "_");

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Resignation document route error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}