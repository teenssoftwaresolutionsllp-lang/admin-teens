import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile?.role !== "hr") {
      return NextResponse.json(
        { error: "HR access required" },
        { status: 403 }
      );
    }

    const { data: departments, error } = await admin
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      { departments: departments ?? [] },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/departments failed:", error);

    return NextResponse.json(
      { error: "Unable to load departments." },
      { status: 500 }
    );
  }
}