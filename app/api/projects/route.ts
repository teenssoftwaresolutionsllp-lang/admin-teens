import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    if (!body.name || !body.calendar_id || !body.shift_start_time || !body.shift_end_time) {
      return NextResponse.json({ error: "Project name, calendar, and shift times are required" }, { status: 400 });
    }

    const project = await DataStore.saveProject(body);
    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: any) {
    console.error("Project creation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create project" }, { status: 500 });
  }
}