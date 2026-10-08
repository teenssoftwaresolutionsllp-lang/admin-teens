import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get("employee_id");

    if (!employeeId) {
      return NextResponse.json(
        {
          error: "employee_id is required",
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = await createAdminClient();

    const { data, error } = await supabaseAdmin
      .from("employee_documents")
      .select(`
        id,
        employee_id,
        document_name,
        document_type,
        document_url,
        cloudinary_public_id,
        cloudinary_resource_type,
        created_at,
        updated_at
      `)
      .eq("employee_id", employeeId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Error fetching employee documents:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Failed to fetch employee documents",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        documents: data || [],
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error(
      "GET /api/documents error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}