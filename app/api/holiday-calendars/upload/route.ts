import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  let uploadedPublicId: string | null = null;
  let uploadedResourceType: "raw" | "image" | null = null;

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

    // 2. Verify HR / CEO role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 403 }
      );
    }

    const role = String(profile.role || "").toLowerCase();

    if (role !== "hr" && role !== "ceo") {
      return NextResponse.json(
        { error: "Only HR and CEO can upload holiday documents." },
        { status: 403 }
      );
    }

    // 3. Read form data
    const formData = await request.formData();

    const calendarId = String(
      formData.get("calendar_id") || ""
    ).trim();

    const file = formData.get("file");

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a document." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be between 1 byte and 5 MB." },
        { status: 400 }
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    const isPdf =
      file.type === "application/pdf" || extension === "pdf";

    const isJpeg =
      file.type === "image/jpeg" ||
      extension === "jpg" ||
      extension === "jpeg";

    const isPng =
      file.type === "image/png" || extension === "png";

    if (
      !ALLOWED_TYPES.includes(file.type) &&
      !isPdf &&
      !isJpeg &&
      !isPng
    ) {
      return NextResponse.json(
        { error: "Only PDF, JPG, and PNG files are allowed." },
        { status: 400 }
      );
    }

    // 4. Load selected calendar
    const admin = await createAdminClient();

    const { data: calendar, error: calendarError } = await admin
      .from("holiday_calendars")
      .select("id, name, document_status")
      .eq("id", calendarId)
      .maybeSingle();

    if (calendarError || !calendar) {
      return NextResponse.json(
        { error: "Holiday calendar not found." },
        { status: 404 }
      );
    }

    if (calendar.document_status === "imported") {
      return NextResponse.json(
        {
          error:
            "This calendar has already been imported. Its document cannot be replaced.",
        },
        { status: 409 }
      );
    }

    // 5. Prepare Cloudinary upload
    const resourceType: "raw" | "image" = isPdf ? "raw" : "image";

    uploadedResourceType = resourceType;

    const fileBuffer = Buffer.from(
      await file.arrayBuffer()
    );

    const base64Data = fileBuffer.toString("base64");

    const dataURI = `data:${isPdf ? "application/pdf" : file.type || (isJpeg ? "image/jpeg" : "image/png")};base64,${base64Data}`;

    // 6. Upload to Cloudinary
    const uploadResult = await new Promise<any>(
      (resolve, reject) => {
        cloudinary.uploader.upload(
          dataURI,
          {
            folder: "teens-hr/holiday-calendars",
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else if (!result) {
              reject(new Error("Cloudinary returned no upload result."));
            } else {
              resolve(result);
            }
          }
        );
      }
    );

    uploadedPublicId = uploadResult.public_id;

    // 7. Save document metadata
    const { data: updatedCalendar, error: updateError } = await admin
      .from("holiday_calendars")
      .update({
        document_public_id: uploadResult.public_id,
        document_file_name: file.name,
        document_uploaded_by: user.id,
        document_uploaded_at: new Date().toISOString(),

        extracted_holidays: null,
        document_status: "uploaded",

        approved_by: null,
        approved_at: null,
        approval_remarks: null,

        imported_at: null,
        imported_by: null,
      })
      .eq("id", calendarId)
      .neq("document_status", "imported")
      .select("id, name, document_file_name, document_status")
      .maybeSingle();

    if (updateError || !updatedCalendar) {
      // Remove newly uploaded file if the database update failed.
      await cloudinary.uploader.destroy(
        uploadResult.public_id,
        {
          resource_type: resourceType,
          invalidate: true,
        }
      );

      uploadedPublicId = null;

      if (updateError) {
        console.error("Holiday calendar update error:", updateError);
      }

      return NextResponse.json(
        {
          error:
            "Could not save the document. The calendar may have been imported. Please refresh and try again.",
        },
        { status: 409 }
      );
    }

    uploadedPublicId = null;

    revalidatePath("/dashboard/projects");

    return NextResponse.json({
      success: true,
      message: "Holiday document uploaded successfully.",
      calendar: updatedCalendar,
    });
  } catch (error) {
    console.error("Holiday document upload error:", error);

    if (uploadedPublicId && uploadedResourceType) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: uploadedResourceType,
          invalidate: true,
        });
      } catch (cleanupError) {
        console.error(
          "Holiday document cleanup error:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to upload holiday document." },
      { status: 500 }
    );
  }
}
