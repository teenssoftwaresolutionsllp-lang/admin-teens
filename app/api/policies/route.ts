import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["Draft", "Active", "Inactive"];
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CATEGORY_LENGTH = 100;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizePolicyManager() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 403 }
      ),
    };
  }

  const role = String(profile.role || "").toLowerCase();

  if (role !== "hr" && role !== "ceo") {
    return {
      user: null,
      response: NextResponse.json(
        {
          error:
            "Only HR and CEO can manage company policies.",
        },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

function getDocumentFields(body: Record<string, unknown>) {
  const publicId =
    typeof body.cloudinary_public_id === "string"
      ? body.cloudinary_public_id.trim()
      : null;

  const name =
    typeof body.document_name === "string"
      ? body.document_name.trim()
      : null;

  const contentType =
    typeof body.document_content_type === "string"
      ? body.document_content_type.trim()
      : null;

  const resourceType =
    typeof body.cloudinary_resource_type === "string"
      ? body.cloudinary_resource_type.trim()
      : "raw";

  if (publicId && !publicId.startsWith("policies/")) {
    throw new Error("Invalid policy document reference.");
  }

  if (resourceType !== "raw") {
    throw new Error("Invalid policy document resource type.");
  }

  if (name && name.length > 255) {
    throw new Error("Document filename is too long.");
  }

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (contentType && !allowedTypes.includes(contentType)) {
    throw new Error("Unsupported policy document type.");
  }

  return {
    cloudinary_public_id: publicId,
    cloudinary_resource_type: resourceType,
    document_name: name,
    document_content_type: contentType,
    document_url: null,
  };
}

export async function GET() {
  try {
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

    const { data, error } = await supabase
      .from("policies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch policies error:", error);
      return NextResponse.json(
        { error: "Failed to fetch policies." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      policies: data || [],
    });
  } catch (error) {
    console.error("GET policies error:", error);
    return NextResponse.json(
      { error: "Failed to fetch policies." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await authorizePolicyManager();

    if (response || !user) return response!;

    const body = await request.json();

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const category =
      typeof body.category === "string"
        ? body.category.trim()
        : "General";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const effective_date = body.effective_date || null;
    const status = body.status || "Draft";

    if (!title || title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: "Please provide a valid policy title." },
        { status: 400 }
      );
    }

    if (!category || category.length > MAX_CATEGORY_LENGTH) {
      return NextResponse.json(
        { error: "Please provide a valid policy category." },
        { status: 400 }
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: "Policy description is too long." },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Invalid policy status." },
        { status: 400 }
      );
    }

    let documentFields;

    try {
      documentFields = getDocumentFields(body);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid document details.",
        },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const { data, error } = await admin
      .from("policies")
      .insert({
        title,
        category,
        description: description || null,
        effective_date,
        status,
        created_by: user.id,
        ...documentFields,
      })
      .select()
      .single();

    if (error) {
      console.error("Create policy error:", error);
      return NextResponse.json(
        { error: "Failed to create policy." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { policy: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST policies error:", error);
    return NextResponse.json(
      { error: "Failed to create policy." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { user, response } = await authorizePolicyManager();

    if (response || !user) return response!;

    const body = await request.json();

    const id = body.id;

    if (typeof id !== "string" || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "A valid policy ID is required." },
        { status: 400 }
      );
    }

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const category =
      typeof body.category === "string"
        ? body.category.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const effective_date = body.effective_date || null;
    const status = body.status;

    if (!title || title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: "Please provide a valid policy title." },
        { status: 400 }
      );
    }

    if (!category || category.length > MAX_CATEGORY_LENGTH) {
      return NextResponse.json(
        { error: "Please provide a valid policy category." },
        { status: 400 }
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: "Policy description is too long." },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Invalid policy status." },
        { status: 400 }
      );
    }

    let documentFields;

    try {
      documentFields = getDocumentFields(body);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid document details.",
        },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const { data, error } = await admin
      .from("policies")
      .update({
        title,
        category,
        description: description || null,
        effective_date,
        status,
        ...documentFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update policy error:", error);
      return NextResponse.json(
        { error: "Failed to update policy." },
        { status: 500 }
      );
    }

    return NextResponse.json({ policy: data });
  } catch (error) {
    console.error("PUT policies error:", error);
    return NextResponse.json(
      { error: "Failed to update policy." },
      { status: 500 }
    );
  }
}

// PATCH: Archive a policy without deleting its history.
export async function PATCH(request: Request) {
  try {
    const { user, response } = await authorizePolicyManager();

    if (response || !user) return response!;

    const body = await request.json();
    const id = body.id;

    if (typeof id !== "string" || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "A valid policy ID is required." },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const { data, error } = await admin
      .from("policies")
      .update({
        status: "Inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Archive policy error:", error);
      return NextResponse.json(
        { error: "Failed to archive policy." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      policy: data,
    });
  } catch (error) {
    console.error("PATCH policies error:", error);
    return NextResponse.json(
      { error: "Failed to archive policy." },
      { status: 500 }
    );
  }
}

// Backward compatibility: DELETE now archives instead of deleting.
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    return PATCH(
      new Request(request.url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
    );
  } catch (error) {
    console.error("DELETE policies error:", error);
    return NextResponse.json(
      { error: "Failed to archive policy." },
      { status: 500 }
    );
  }
}
