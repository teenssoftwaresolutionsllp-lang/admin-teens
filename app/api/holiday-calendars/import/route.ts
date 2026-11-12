import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      !["hr", "ceo"].includes(String(profile.role).toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Only HR and CEO can import holiday calendars." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { calendar_id, holidays } = body;

    if (
      typeof calendar_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(calendar_id)
    ) {
      return NextResponse.json(
        { error: "A valid calendar_id is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(holidays) || holidays.length === 0 || holidays.length > 500) {
      return NextResponse.json(
        { error: "Provide between 1 and 500 holiday entries." },
        { status: 400 }
      );
    }

    const normalizedHolidays = holidays.map((holiday: unknown) => {
      if (!holiday || typeof holiday !== "object") {
        throw new Error("Invalid holiday entry.");
      }

      const item = holiday as Record<string, unknown>;

      if (
        typeof item.holiday_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.holiday_date) ||
        typeof item.title !== "string" ||
        !item.title.trim() ||
        item.title.trim().length > 150 ||
        (item.is_optional !== undefined && typeof item.is_optional !== "boolean") ||
        (item.is_working_day !== undefined && typeof item.is_working_day !== "boolean")
      ) {
        throw new Error("Each holiday needs a valid date, title, and boolean flags.");
      }

      return {
        holiday_date: item.holiday_date,
        title: item.title.trim(),
        is_optional: item.is_optional === true,
        is_working_day: item.is_working_day === true,
      };
    });

    const { data, error } = await admin.rpc(
      "import_holiday_calendar_with_edits",
      {
        p_calendar_id: calendar_id,
        p_imported_by: user.id,
        p_holidays: normalizedHolidays,
      }
    );

    if (error) {
      console.error("Holiday calendar import error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to import holiday calendar." },
        { status: 500 }
      );
    }

    if (data?.success === false) {
      return NextResponse.json(data, { status: 409 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while importing holiday calendar.",
      },
      { status: 400 }
    );
  }
}
