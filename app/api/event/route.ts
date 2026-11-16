
import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// =====================================================
// ERROR HANDLING
// =====================================================

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

function databaseErrorResponse(
  action: string,
  error: {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string;
  }
) {
  console.error(`${action} DATABASE ERROR:`, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });

  return NextResponse.json(
    {
      success: false,
      error: error.message || "Database operation failed.",
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
    },
    { status: 500 }
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

// =====================================================
// AUTHENTICATION
// =====================================================

async function getAuthContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      admin: null,
      role: null,
    };
  }

  const admin = await createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("PROFILE ROLE ERROR:", profileError);

    return {
      user,
      admin,
      role: null,
    };
  }

  return {
    user,
    admin,
    role: profile?.role || null,
  };
}

function isHR(role: string | null) {
  return role === "hr" || role === "ceo";
}

// =====================================================
// GET EVENTS
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { user, admin, role } = await getAuthContext();

    if (!user || !admin) {
      return errorResponse("Please login to continue.", 401);
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("id");

    let query = admin
      .from("company_events")
      .select(`
        id,
        title,
        description,
        event_date,
        start_time,
        end_time,
        location,
        invitation_image_url,
        status,
        created_by,
        created_at,
        updated_at,
        event_photos (
          id,
          photo_url,
          uploaded_by,
          created_at
        )
      `);

    // Employees can only see published events.
    if (!isHR(role)) {
      query = query.eq("status", "published");
    }

    if (eventId) {
      query = query.eq("id", eventId);
    }

    query = query.order("event_date", {
      ascending: true,
    });

    const { data: events, error } = await query;

    if (error) {
      return databaseErrorResponse("GET EVENTS", error);
    }

    return NextResponse.json({
      success: true,
      events: events || [],
    });
  } catch (error) {
    console.error("GET EVENTS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

// =====================================================
// POST EVENTS
// CREATE / UPDATE / PUBLISH / CANCEL / ADD PHOTO
// DELETE PHOTO
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const { user, admin, role } = await getAuthContext();

    if (!user || !admin) {
      return errorResponse("Please login to continue.", 401);
    }

    if (!isHR(role)) {
      return errorResponse(
        "Only HR or CEO can manage company events.",
        403
      );
    }

    const body = await request.json();
    const action = body.action;

    // =================================================
    // CREATE EVENT
    // =================================================

    if (action === "create") {
      const {
        title,
        description,
        event_date,
        start_time,
        end_time,
        location,
        invitation_image_url,
        status,
      } = body;

      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof event_date !== "string" ||
        !event_date.trim()
      ) {
        return errorResponse(
          "Event title and date are required."
        );
      }

      const eventStatus =
        status === "published" ? "published" : "draft";

      const { data: event, error } = await admin
        .from("company_events")
        .insert({
          title: title.trim(),
          description: description || null,
          event_date,
          start_time: start_time || null,
          end_time: end_time || null,
          location: location || null,
          invitation_image_url: invitation_image_url || null,
          status: eventStatus,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        return databaseErrorResponse("CREATE EVENT", error);
      }

      return NextResponse.json(
        {
          success: true,
          message:
            eventStatus === "published"
              ? "Event published successfully."
              : "Event saved as draft.",
          event,
        },
        { status: 201 }
      );
    }

    // =================================================
    // UPDATE EVENT
    // =================================================

    if (action === "update") {
      const {
        event_id,
        title,
        description,
        event_date,
        start_time,
        end_time,
        location,
        invitation_image_url,
      } = body;

      if (!event_id) {
        return errorResponse("Event ID is required.");
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) {
          return errorResponse("Event title cannot be empty.");
        }

        updates.title = title.trim();
      }

      if (description !== undefined) {
        updates.description = description || null;
      }

      if (event_date !== undefined) {
        updates.event_date = event_date;
      }

      if (start_time !== undefined) {
        updates.start_time = start_time || null;
      }

      if (end_time !== undefined) {
        updates.end_time = end_time || null;
      }

      if (location !== undefined) {
        updates.location = location || null;
      }

      if (invitation_image_url !== undefined) {
        updates.invitation_image_url =
          invitation_image_url || null;
      }

      const { data: event, error } = await admin
        .from("company_events")
        .update(updates)
        .eq("id", event_id)
        .select()
        .single();

      if (error) {
        return databaseErrorResponse("UPDATE EVENT", error);
      }

      return NextResponse.json({
        success: true,
        message: "Event updated successfully.",
        event,
      });
    }

    // =================================================
    // PUBLISH EVENT
    // =================================================

    if (action === "publish") {
      const { event_id } = body;

      if (!event_id) {
        return errorResponse("Event ID is required.");
      }

      const { data: event, error } = await admin
        .from("company_events")
        .update({
          status: "published",
          updated_at: new Date().toISOString(),
        })
        .eq("id", event_id)
        .select()
        .single();

      if (error) {
        return databaseErrorResponse("PUBLISH EVENT", error);
      }

      return NextResponse.json({
        success: true,
        message: "Event published successfully.",
        event,
      });
    }

    // =================================================
    // CANCEL EVENT
    // =================================================

    if (action === "cancel") {
      const { event_id } = body;

      if (!event_id) {
        return errorResponse("Event ID is required.");
      }

      const { data: event, error } = await admin
        .from("company_events")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", event_id)
        .select()
        .single();

      if (error) {
        return databaseErrorResponse("CANCEL EVENT", error);
      }

      return NextResponse.json({
        success: true,
        message: "Event cancelled successfully.",
        event,
      });
    }

    // =================================================
    // ADD EVENT PHOTO
    // =================================================

    if (action === "add_photo") {
      const { event_id, photo_url } = body;

      if (
        !event_id ||
        typeof photo_url !== "string" ||
        !photo_url.trim()
      ) {
        return errorResponse(
          "Event ID and photo URL are required."
        );
      }

      const { data: existingEvent, error: eventError } =
        await admin
          .from("company_events")
          .select("id")
          .eq("id", event_id)
          .maybeSingle();

      if (eventError) {
        return databaseErrorResponse(
          "CHECK EVENT BEFORE ADDING PHOTO",
          eventError
        );
      }

      if (!existingEvent) {
        return errorResponse("Event not found.", 404);
      }

      const { data: photo, error } = await admin
        .from("event_photos")
        .insert({
          event_id,
          photo_url: photo_url.trim(),
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) {
        return databaseErrorResponse("ADD EVENT PHOTO", error);
      }

      return NextResponse.json(
        {
          success: true,
          message: "Event photo added successfully.",
          photo,
        },
        { status: 201 }
      );
    }

    // =================================================
    // DELETE EVENT PHOTO
    // =================================================

    if (action === "delete_photo") {
      const { photo_id } = body;

      if (!photo_id) {
        return errorResponse("Photo ID is required.");
      }

      const { error } = await admin
        .from("event_photos")
        .delete()
        .eq("id", photo_id);

      if (error) {
        return databaseErrorResponse(
          "DELETE EVENT PHOTO",
          error
        );
      }

      return NextResponse.json({
        success: true,
        message: "Event photo deleted successfully.",
      });
    }

    // =================================================
    // INVALID ACTION
    // =================================================

    return errorResponse("Invalid event action.");
  } catch (error) {
    console.error("POST EVENTS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE EVENT
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    const { user, admin, role } = await getAuthContext();

    if (!user || !admin) {
      return errorResponse("Please login to continue.", 401);
    }

    if (!isHR(role)) {
      return errorResponse(
        "Only HR or CEO can delete events.",
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("id");

    if (!eventId) {
      return errorResponse("Event ID is required.");
    }

    const { error } = await admin
      .from("company_events")
      .delete()
      .eq("id", eventId);

    if (error) {
      return databaseErrorResponse("DELETE EVENT", error);
    }

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE EVENT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
