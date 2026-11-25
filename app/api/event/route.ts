
import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      role: null,
      error: "Unauthorized. Please login again.",
    };
  }

  const admin = await createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile lookup error:", profileError.message);

    return {
      user: null,
      role: null,
      error: "Unable to verify user permissions.",
    };
  }

  return {
    user,
    role: String(profile?.role || "").toLowerCase(),
    error: null,
  };
}

// --------------------------------------------------
// HR PERMISSION
// --------------------------------------------------

async function checkHRPermission() {
  const auth = await getAuthenticatedUser();

  if (!auth.user) {
    return {
      allowed: false,
      error: auth.error || "Unauthorized.",
      admin: null,
    };
  }

  if (!["hr", "ceo"].includes(auth.role || "")) {
    return {
      allowed: false,
      error: "You do not have permission to manage company events.",
      admin: null,
    };
  }

  const admin = await createAdminClient();

  return {
    allowed: true,
    error: null,
    admin,
  };
}

// --------------------------------------------------
// GET EVENTS
// Employee and HR can view published events.
// Returns event photos inside event.media.
// --------------------------------------------------

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const admin = await createAdminClient();
    const now = new Date().toISOString();

    const { data: eventRows, error: eventsError } = await admin
      .from("company_events")
      .select(`
        id,
        title,
        description,
        event_type,
        status,
        audience_scope,
        event_date,
        end_date,
        location,
        expires_at,
        created_by,
        published_at,
        created_at,
        updated_at
      `)
      .eq("event_type", "event")
      .eq("status", "published")
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("event_date", { ascending: true });

    if (eventsError) {
      console.error(
        "GET company_events error:",
        eventsError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load company events.",
        },
        { status: 500 }
      );
    }

    const eventIds = (eventRows || []).map(
      (event) => event.id
    );

    let eventMedia: {
      id: string;
      event_id: string;
      image_url: string;
      cloudinary_public_id: string | null;
      alt_text: string | null;
      sort_order: number | null;
      created_at: string;
    }[] = [];

    // Load photos for all returned events.

    if (eventIds.length > 0) {
      const { data: mediaRows, error: mediaError } =
        await admin
          .from("company_event_media")
          .select(`
            id,
            event_id,
            image_url,
            cloudinary_public_id,
            alt_text,
            sort_order,
            created_at
          `)
          .in("event_id", eventIds)
          .order("sort_order", { ascending: true });

      if (mediaError) {
        console.error(
          "GET company_event_media error:",
          mediaError.message
        );

        return NextResponse.json(
          {
            success: false,
            error: "Unable to load event photos.",
          },
          { status: 500 }
        );
      }

      eventMedia = mediaRows || [];
    }

    // Attach photos to their matching events.

    const events = (eventRows || []).map((event) => ({
      ...event,

      media: eventMedia.filter(
        (photo) => photo.event_id === event.id
      ),
    }));

    return NextResponse.json(
      {
        success: true,
        events,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET events unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong while loading events.",
      },
      { status: 500 }
    );
  }
}

// --------------------------------------------------
// POST
// Supported actions:
// create
// update
// publish
// cancel
// add_photo
// delete_photo
// --------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const permission = await checkHRPermission();

    if (!permission.allowed || !permission.admin) {
      return NextResponse.json(
        {
          success: false,
          error: permission.error,
        },
        { status: 403 }
      );
    }

    const admin = permission.admin;
    const body = await request.json();

    const action = String(body.action || "").trim().toLowerCase();

    // --------------------------------------------------
    // CREATE EVENT
    // --------------------------------------------------

    if (action === "create") {
      const {
        title,
        description,
        event_date,
        end_date,
        location,
        event_type,
        audience_scope,
        expires_at,
        status,
      } = body;

      if (!title || !String(title).trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Event title is required.",
          },
          { status: 400 }
        );
      }

      if (!event_date) {
        return NextResponse.json(
          {
            success: false,
            error: "Event date is required.",
          },
          { status: 400 }
        );
      }

      const auth = await getAuthenticatedUser();

      if (!auth.user) {
        return NextResponse.json(
          {
            success: false,
            error: auth.error,
          },
          { status: 401 }
        );
      }

      const insertData = {
        title: String(title).trim(),
        description: description || null,
        event_date,
        end_date: end_date || null,
        location: location || null,
        event_type: event_type || "event",
        audience_scope: audience_scope || "all",
        expires_at: expires_at || null,
        status: status || "draft",
        created_by: auth.user.id,
        published_at:
          status === "published"
            ? new Date().toISOString()
            : null,
      };

      const { data, error } = await admin
        .from("company_events")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Create event error:", error.message);

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Event created successfully.",
        event: {
          ...data,
          media: [],
        },
      });
    }

    // --------------------------------------------------
    // UPDATE EVENT
    // --------------------------------------------------

    if (action === "update") {
      const { id, ...fields } = body;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: "Event ID is required.",
          },
          { status: 400 }
        );
      }

      const allowedFields = [
        "title",
        "description",
        "event_date",
        "end_date",
        "location",
        "event_type",
        "audience_scope",
        "expires_at",
      ];

      const updateData: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(fields, field)) {
          updateData[field] = fields[field] || null;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No valid event fields provided.",
          },
          { status: 400 }
        );
      }

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await admin
        .from("company_events")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Update event error:", error.message);

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Event updated successfully.",
        event: data,
      });
    }

    // --------------------------------------------------
    // PUBLISH EVENT
    // --------------------------------------------------

    if (action === "publish") {
      const { id } = body;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: "Event ID is required.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await admin
        .from("company_events")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Publish event error:", error.message);

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Event published successfully.",
        event: data,
      });
    }

    // --------------------------------------------------
    // CANCEL EVENT
    // --------------------------------------------------

    if (action === "cancel") {
      const { id } = body;

      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: "Event ID is required.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await admin
        .from("company_events")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Cancel event error:", error.message);

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Event cancelled successfully.",
        event: data,
      });
    }

    // --------------------------------------------------
    // ADD EVENT PHOTO
    // --------------------------------------------------

    if (action === "add_photo") {
      const {
        event_id,
        image_url,
        photo_url,
        alt_text,
        cloudinary_public_id,
        sort_order,
      } = body;

      const finalImageUrl = image_url || photo_url;

      if (!event_id) {
        return NextResponse.json(
          {
            success: false,
            error: "Event ID is required.",
          },
          { status: 400 }
        );
      }

      if (!finalImageUrl) {
        return NextResponse.json(
          {
            success: false,
            error: "Image URL is required.",
          },
          { status: 400 }
        );
      }

      const { data: event, error: eventError } = await admin
        .from("company_events")
        .select("id")
        .eq("id", event_id)
        .maybeSingle();

      if (eventError || !event) {
        return NextResponse.json(
          {
            success: false,
            error: "Event not found.",
          },
          { status: 404 }
        );
      }

      const insertData = {
        event_id,
        image_url: finalImageUrl,
        cloudinary_public_id:
          cloudinary_public_id || null,
        alt_text: alt_text || null,
        sort_order: Number.isFinite(Number(sort_order))
          ? Number(sort_order)
          : 0,
      };

      const { data, error } = await admin
        .from("company_event_media")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Add event photo error:", error.message);

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Event photo uploaded successfully.",
        photo: data,
      });
    }

    // --------------------------------------------------
    // DELETE EVENT PHOTO
    // --------------------------------------------------

    if (action === "delete_photo") {
      const { id, photo_id } = body;
      const photoId = photo_id || id;

      if (!photoId) {
        return NextResponse.json(
          {
            success: false,
            error: "Photo ID is required.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await admin
        .from("company_event_media")
        .delete()
        .eq("id", photoId)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          "Delete event photo error:",
          error.message
        );

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          {
            success: false,
            error: "Event photo not found.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Event photo deleted successfully.",
      });
    }

    // --------------------------------------------------
    // INVALID ACTION
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST event unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong while processing the event.",
      },
      { status: 500 }
    );
  }
}

// --------------------------------------------------
// DELETE EVENT
// Deletes its photos first, then the event.
// --------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const permission = await checkHRPermission();

    if (!permission.allowed || !permission.admin) {
      return NextResponse.json(
        {
          success: false,
          error: permission.error,
        },
        { status: 403 }
      );
    }

    const admin = permission.admin;

    let eventId =
      request.nextUrl.searchParams.get("id");

    if (!eventId) {
      try {
        const body = await request.json();
        eventId = body.id || body.event_id || null;
      } catch {
        // No JSON body; use query parameter.
      }
    }

    if (!eventId) {
      return NextResponse.json(
        {
          success: false,
          error: "Event ID is required.",
        },
        { status: 400 }
      );
    }

    // Delete associated photos first.

    const { error: mediaError } = await admin
      .from("company_event_media")
      .delete()
      .eq("event_id", eventId);

    if (mediaError) {
      console.error(
        "Delete event media error:",
        mediaError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to delete event photos.",
        },
        { status: 500 }
      );
    }

    // Delete event.

    const { data, error } = await admin
      .from("company_events")
      .delete()
      .eq("id", eventId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Delete event error:", error.message);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Event not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Event and its photos deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE event unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong while deleting the event.",
      },
      { status: 500 }
    );
  }
}
