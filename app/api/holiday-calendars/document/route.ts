import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getContentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
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

    // 2. Verify HR / CEO
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(profile?.role || "").toLowerCase();

    if (
      profileError ||
      !profile ||
      (role !== "hr" && role !== "ceo")
    ) {
      return NextResponse.json(
        { error: "Only HR and CEO can access holiday documents." },
        { status: 403 }
      );
    }

    // 3. Validate request
    const calendarId = request.nextUrl.searchParams.get("calendar_id");
    const disposition =
      request.nextUrl.searchParams.get("disposition") === "attachment"
        ? "attachment"
        : "inline";

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required." },
        { status: 400 }
      );
    }

    // 4. Get document metadata from database
    const admin = await createAdminClient();

    const { data: calendar, error: calendarError } = await admin
      .from("holiday_calendars")
      .select("id, document_public_id, document_file_name")
      .eq("id", calendarId)
      .maybeSingle();

    if (calendarError || !calendar) {
      return NextResponse.json(
        { error: "Holiday calendar not found." },
        { status: 404 }
      );
    }

    if (!calendar.document_public_id || !calendar.document_file_name) {
      return NextResponse.json(
        { error: "No document is available for this calendar." },
        { status: 404 }
      );
    }

    const contentType = getContentType(calendar.document_file_name);

    if (!contentType) {
      return NextResponse.json(
        { error: "Unsupported document type." },
        { status: 415 }
      );
    }

    const resourceType =
      contentType === "application/pdf" ? "raw" : "image";

    // 5. Resolve the stored Cloudinary document
    const resource = await cloudinary.api.resource(
      calendar.document_public_id,
      { resource_type: resourceType }
    );

    if (!resource.secure_url) {
      throw new Error("Cloudinary did not return a secure document URL.");
    }

    // 6. Fetch the original document
    const fileResponse = await fetch(resource.secure_url, {
      cache: "no-store",
    });

    if (!fileResponse.ok) {
      throw new Error("Could not retrieve the uploaded document.");
    }

    const arrayBuffer = await fileResponse.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "The document exceeds the 5 MB limit." },
        { status: 413 }
      );
    }

    // 7. Return the file for viewing or downloading
    const safeFileName = calendar.document_file_name.replace(
      /[\r\n"]/g,
      "_"
    );

    return new NextResponse(new Uint8Array(arrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(
          safeFileName
        )}`,
        "Content-Length": String(arrayBuffer.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Holiday document retrieval error:", error);

    return NextResponse.json(
      { error: "Could not open the holiday document." },
      { status: 500 }
    );
  }
}
