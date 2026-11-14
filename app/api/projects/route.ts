import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(
      { error: "Project creation is disabled for this role" },
      { status: 403 }
    );
  } catch (error: unknown) {
    console.error("Project creation error:", error);
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}