import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";
import {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} from "@/lib/cloudinary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(request: Request) {
  let uploadedPublicId: string | null = null;

  try {
    // =========================================
    // AUTHENTICATION
    // =========================================

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({ error: "Unauthorized." }, 401);
    }

    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return json({ error: profileError.message }, 500);
    }

    const role = String(profile?.role ?? "").toLowerCase();

    if (!["hr", "ceo"].includes(role)) {
      return json(
        { error: "You are not authorized to upload event images." },
        403
      );
    }

    // =========================================
    // FORM DATA VALIDATION
    // =========================================

    const formData = await request.formData();

    const eventId = formData.get("event_id");
    const file = formData.get("file");
    const altText = formData.get("alt_text");

    if (
      typeof eventId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        eventId
      )
    ) {
      return json({ error: "A valid event ID is required." }, 400);
    }

    if (!(file instanceof File)) {
      return json({ error: "Please select an image." }, 400);
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return json(
        { error: "Only JPEG, PNG, and WebP images are allowed." },
        400
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return json(
        { error: "Image size must be greater than 0 and no more than 8 MB." },
        400
      );
    }

    if (
      altText !== null &&
      typeof altText !== "string"
    ) {
      return json({ error: "Invalid image description." }, 400);
    }

    const cleanAltText =
      typeof altText === "string"
        ? altText.trim().slice(0, 250)
        : null;

    // =========================================
    // VERIFY EVENT
    // =========================================

    const { data: event, error: eventError } = await admin
      .from("company_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      return json({ error: eventError.message }, 500);
    }

    if (!event) {
      return json({ error: "Event not found." }, 404);
    }

    // =========================================
    // ENFORCE MAXIMUM 10 IMAGES PER EVENT
    // =========================================

    const { count, error: countError } = await admin
        .from("company_event_media")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);

    if (countError) {
        return json(
            { error: "Unable to verify the event image limit." },
            500
        );
    }

    if ((count ?? 0) >= 10) {
        return json(
            { error: "An event can have a maximum of 10 images." },
            400
        );
    }

    // =========================================
    // UPLOAD IMAGE TO CLOUDINARY
    // =========================================

    const uploaded = await uploadImageToCloudinary(
      file,
      "company-events"
    );

    uploadedPublicId = uploaded.public_id;

    // =========================================
    // SAVE IMAGE RECORD
    // =========================================

    const { data: media, error: mediaError } = await admin
      .from("company_event_media")
      .insert({
        event_id: eventId,
        image_url: uploaded.url,
        cloudinary_public_id: uploaded.public_id,
        alt_text: cleanAltText,
      })
      .select(
        "id, event_id, image_url, cloudinary_public_id, alt_text, sort_order, created_at"
      )
      .single();

    if (mediaError) {
      await deleteFromCloudinary(uploaded.public_id).catch(() => null);
      uploadedPublicId = null;

      return json(
        { error: "Image uploaded but could not be saved to the event." },
        500
      );
    }

    uploadedPublicId = null;

    return json(
      {
        message: "Event image uploaded successfully.",
        media,
      },
      201
    );
  } catch (error) {
    if (uploadedPublicId) {
      await deleteFromCloudinary(uploadedPublicId).catch(() => null);
    }

    console.error("Company event image upload error:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload event image.",
      },
      500
    );
  }
}
