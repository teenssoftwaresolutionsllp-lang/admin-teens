import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getAuthorizedHr() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const admin = await createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Joining role check failed:", profileError.message);

    return {
      error: "Unable to verify access",
      status: 500 as const,
    };
  }

  if (profile?.role !== "hr") {
    return {
      error: "HR access required",
      status: 403 as const,
    };
  }

  return { admin, user };
}

export async function GET() {
  try {
    const auth = await getAuthorizedHr();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { data: candidates, error } = await auth.admin
      .from("joining_candidates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const candidateIds = (candidates ?? []).map(
      (candidate) => candidate.id
    );

    type JoiningDocumentRow = {
      id: string;
      candidate_id: string;
      document_type: string;
      version: number;
      created_at: string;
      sent_at: string | null;
    };

    let documents: JoiningDocumentRow[] = [];

    if (candidateIds.length > 0) {
      const { data: documentRows, error: documentsError } =
        await auth.admin
          .from("joining_documents")
          .select(
            "id, candidate_id, document_type, version, created_at, sent_at"
          )
          .in("candidate_id", candidateIds)
          .in("document_type", ["offer_letter", "joining_letter"])
          .order("version", { ascending: false });

      if (documentsError) throw documentsError;

      documents = (documentRows ?? []) as JoiningDocumentRow[];
    }

    const candidatesWithDocuments = (candidates ?? []).map(
      (candidate) => ({
        ...candidate,
        joining_documents: documents
          .filter((document) => document.candidate_id === candidate.id)
          .sort((a, b) => b.version - a.version),
      })
    );

    return NextResponse.json(
      { candidates: candidatesWithDocuments },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/joining failed:", error);

    return NextResponse.json(
      { error: "Failed to load joining candidates" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthorizedHr();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body: Record<string, unknown>;

    try {
      const parsedBody: unknown = await request.json();

      if (
        typeof parsedBody !== "object" ||
        parsedBody === null ||
        Array.isArray(parsedBody)
      ) {
        return NextResponse.json(
          { error: "Invalid request body." },
          { status: 400 }
        );
      }

      body = parsedBody as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const first_name =
      typeof body.first_name === "string"
        ? body.first_name.trim()
        : "";

    const last_name =
      typeof body.last_name === "string"
        ? body.last_name.trim()
        : "";

    const personal_email =
      typeof body.personal_email === "string"
        ? body.personal_email.trim().toLowerCase()
        : "";

    const mobile_number =
      typeof body.mobile_number === "string"
        ? body.mobile_number.trim()
        : "";

    const designation =
      typeof body.designation === "string"
        ? body.designation.trim()
        : "";

    const annual_ctc = body.annual_ctc;

    const gender =
      typeof body.gender === "string"
        ? body.gender.trim()
        : "";

    const department =
      typeof body.department === "string"
        ? body.department.trim()
        : "";

    const employment_type =
      typeof body.employment_type === "string"
        ? body.employment_type.trim()
        : "";

    const work_location =
      typeof body.work_location === "string"
        ? body.work_location.trim()
        : "";

    // Joining date and probation duration are intentionally not
    // collected during candidate creation. HR selects them when
    // generating the Joining Letter.

    if (
      !first_name ||
      !last_name ||
      !personal_email ||
      !mobile_number ||
      !designation ||
      annual_ctc === undefined ||
      annual_ctc === null ||
      annual_ctc === ""
    ) {
      return NextResponse.json(
        { error: "Please complete all required fields." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal_email)) {
      return NextResponse.json(
        { error: "Enter a valid personal email address." },
        { status: 400 }
      );
    }

    // The form accepts annual CTC in lakhs.
    const ctcInLakhs = Number(annual_ctc);

    if (
      !Number.isFinite(ctcInLakhs) ||
      ctcInLakhs < 0 ||
      ctcInLakhs > 9999999
    ) {
      return NextResponse.json(
        { error: "Annual CTC must be a valid non-negative amount." },
        { status: 400 }
      );
    }

    const allowedGenders = [
      "male",
      "female",
      "non_binary",
      "prefer_not_to_say",
    ] as const;

    if (
      !allowedGenders.includes(
        gender as (typeof allowedGenders)[number]
      )
    ) {
      return NextResponse.json(
        {
          error: "Gender is required. Please select a valid gender.",
        },
        { status: 400 }
      );
    }

    if (!department) {
      return NextResponse.json(
        { error: "Department is required." },
        { status: 400 }
      );
    }

    const { data: availableDepartments, error: departmentError } =
      await auth.admin
        .from("departments")
        .select("id, name");

    if (departmentError) throw departmentError;

    const normalizedDepartment =
      department.toLowerCase() === "human resources"
        ? "hr"
        : department.toLowerCase();

    const matchingDepartments = (availableDepartments ?? []).filter(
      (item) => item.name.trim().toLowerCase() === normalizedDepartment
    );

    if (matchingDepartments.length !== 1) {
      return NextResponse.json(
        {
          error: `Department "${department}" is not available. Please select a valid department.`,
        },
        { status: 400 }
      );
    }

    const selectedDepartment = matchingDepartments[0].name;

    const allowedEmploymentTypes = [
      "full_time",
      "contract",
      "intern",
    ] as const;

    if (
      !allowedEmploymentTypes.includes(
        employment_type as (typeof allowedEmploymentTypes)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Employment type is required. Please select a valid type.",
        },
        { status: 400 }
      );
    }

    if (!work_location) {
      return NextResponse.json(
        { error: "Work location is required." },
        { status: 400 }
      );
    }

    const { data: candidate, error } = await auth.admin
      .from("joining_candidates")
      .insert({
        first_name,
        last_name,
        personal_email,
        mobile_number,
        designation,

        // HR selects the joining date when generating the Joining Letter.
        joining_date: null,

        annual_ctc: Math.round(ctcInLakhs * 100000),
        gender,

        // HR selects the probation duration in the same popup.
        probation_period_months: null,

        department: selectedDepartment,
        employment_type,
        work_location,
        created_by: auth.user.id,
        status: "selected",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    console.error("POST /api/joining failed:", error);

    return NextResponse.json(
      { error: "Failed to create joining candidate" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthorizedHr();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body: Record<string, unknown>;

    try {
      const parsedBody: unknown = await request.json();

      if (
        typeof parsedBody !== "object" ||
        parsedBody === null ||
        Array.isArray(parsedBody)
      ) {
        return NextResponse.json(
          { error: "Invalid request body." },
          { status: 400 }
        );
      }

      body = parsedBody as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const id =
      typeof body.id === "string" ? body.id.trim() : "";

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    const first_name =
      typeof body.first_name === "string"
        ? body.first_name.trim()
        : "";

    const last_name =
      typeof body.last_name === "string"
        ? body.last_name.trim()
        : "";

    const mobile_number =
      typeof body.mobile_number === "string"
        ? body.mobile_number.trim()
        : "";

    const gender =
      typeof body.gender === "string"
        ? body.gender.trim()
        : "";

    const designation =
      typeof body.designation === "string"
        ? body.designation.trim()
        : "";

    const department =
      typeof body.department === "string"
        ? body.department.trim()
        : "";

    const employment_type =
      typeof body.employment_type === "string"
        ? body.employment_type.trim()
        : "";

    const work_location =
      typeof body.work_location === "string"
        ? body.work_location.trim()
        : "";

    const annual_ctc = Number(body.annual_ctc);

    if (
      !first_name ||
      !last_name ||
      !mobile_number ||
      !gender ||
      !designation ||
      !department ||
      !work_location ||
      !Number.isFinite(annual_ctc) ||
      annual_ctc < 0
    ) {
      return NextResponse.json(
        { error: "Please enter all required candidate and offer details." },
        { status: 400 }
      );
    }

    const { data: availableDepartments, error: departmentError } =
      await auth.admin
        .from("departments")
        .select("id, name");

    if (departmentError) throw departmentError;

    const normalizedDepartment =
      department.toLowerCase() === "human resources"
        ? "hr"
        : department.toLowerCase();

    const matchingDepartments = (availableDepartments ?? []).filter(
      (item) => item.name.trim().toLowerCase() === normalizedDepartment
    );

    if (matchingDepartments.length !== 1) {
      return NextResponse.json(
        {
          error: `Department "${department}" is not available. Please select a valid department.`,
        },
        { status: 400 }
      );
    }

    const selectedDepartment = matchingDepartments[0].name;

    if (mobile_number.length < 7 || mobile_number.length > 20) {
      return NextResponse.json(
        { error: "Enter a valid mobile number." },
        { status: 400 }
      );
    }

    const allowedGenders = [
      "male",
      "female",
      "non_binary",
      "prefer_not_to_say",
    ];

    if (!allowedGenders.includes(gender)) {
      return NextResponse.json(
        { error: "Select a valid gender." },
        { status: 400 }
      );
    }

    const allowedEmploymentTypes = [
      "full_time",
      "contract",
      "intern",
    ];

    if (!allowedEmploymentTypes.includes(employment_type)) {
      return NextResponse.json(
        { error: "Select a valid employment type." },
        { status: 400 }
      );
    }

    const { data: existingCandidate, error: lookupError } =
      await auth.admin
        .from("joining_candidates")
        .select("id, status")
        .eq("id", id)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (!existingCandidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    if (!["selected", "offer_sent"].includes(existingCandidate.status)) {
      return NextResponse.json(
        { error: "This candidate can no longer be edited." },
        { status: 409 }
      );
    }

    const { data: candidate, error: updateError } =
      await auth.admin
        .from("joining_candidates")
        .update({
          first_name,
          last_name,
          mobile_number,
          gender,
          designation,
          department: selectedDepartment,
          employment_type,
          work_location,
          annual_ctc: Math.round(annual_ctc),
        })
        .eq("id", id)
        .select("*")
        .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      message: "Candidate offer details updated successfully.",
      candidate,
    });
  } catch (error) {
    console.error("PATCH /api/joining failed:", error);

    return NextResponse.json(
      { error: "Failed to update candidate offer details." },
      { status: 500 }
    );
  }
}

