
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type ExperienceLevel = "fresher" | "experienced";

type StatutoryApplicability = {
  pf_eligible: boolean;
  esi_eligible: boolean;
  pt_eligible: boolean;
  tds_eligible: boolean;
};

function parseExperience(body: Record<string, unknown>) {
  const level =
    typeof body.experience_level === "string"
      ? body.experience_level.trim().toLowerCase()
      : "";

  const years = Number(body.total_experience_years);
  const months = Number(body.total_experience_months);

  if (level !== "fresher" && level !== "experienced") {
    return {
      error: "Select a valid experience level: Fresher or Experienced.",
    } as const;
  }

  if (
    !Number.isInteger(years) ||
    years < 0 ||
    years > 50 ||
    !Number.isInteger(months) ||
    months < 0 ||
    months > 11
  ) {
    return {
      error: "Enter valid experience. Years must be 0–50 and months 0–11.",
    } as const;
  }

  if (level === "fresher" && (years !== 0 || months !== 0)) {
    return {
      error:
        "Fresher candidates must have 0 years and 0 months of experience.",
    } as const;
  }

  if (level === "experienced" && years === 0 && months === 0) {
    return {
      error:
        "Experienced candidates must have at least 1 month of experience.",
    } as const;
  }

  return {
    experience_level: level as ExperienceLevel,
    total_experience_years: years,
    total_experience_months: months,
  } as const;
}

function parseStatutoryApplicability(
  body: Record<string, unknown>
):
  | { data: StatutoryApplicability }
  | { error: string } {
  const fields = [
    ["pf_eligible", "PF"],
    ["esi_eligible", "ESI"],
    ["pt_eligible", "Professional Tax"],
    ["tds_eligible", "TDS"],
  ] as const;

  for (const [key, label] of fields) {
    if (typeof body[key] !== "boolean") {
      return {
        error: `Please select whether ${label} is applicable or not applicable.`,
      };
    }
  }

  return {
    data: {
      pf_eligible: body.pf_eligible as boolean,
      esi_eligible: body.esi_eligible as boolean,
      pt_eligible: body.pt_eligible as boolean,
      tds_eligible: body.tds_eligible as boolean,
    },
  };
}

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

function isObjectBody(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const allowedGenders = [
  "male",
  "female",
  "non_binary",
  "prefer_not_to_say",
] as const;

const allowedEmploymentTypes = [
  "full_time",
  "contract",
  "intern",
] as const;

async function validateDepartment(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  department: string
) {
  const { data: availableDepartments, error } = await admin
    .from("departments")
    .select("id, name");

  if (error) throw error;

  const normalizedDepartment =
    department.toLowerCase() === "human resources"
      ? "hr"
      : department.toLowerCase();

  const matchingDepartments = (availableDepartments ?? []).filter(
    (item) => item.name.trim().toLowerCase() === normalizedDepartment
  );

  if (matchingDepartments.length !== 1) {
    return {
      error: `Department "${department}" is not available. Please select a valid department.`,
    };
  }

  return { department: matchingDepartments[0].name };
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthorizedHr();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // Joining Candidates can request only candidates not yet
    // handed off to the Add Employee queue.
    const candidatesQuery = auth.admin
      .from("joining_candidates")
      .select("*");

    const excludeMoved =
      new URL(request.url).searchParams.get("excludeMoved") === "1";

    const { data: candidates, error } = await (
      excludeMoved
        ? candidatesQuery.is("add_employee_moved_at", null)
        : candidatesQuery
    ).order("created_at", { ascending: false });

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
      file_name: string | null;
      mime_type: string | null;
    };

    let documents: JoiningDocumentRow[] = [];
    let tokens: { candidate_id: string; action: string; used_at: string | null }[] = [];
    let submissions: { candidate_id: string; created_at: string; status: string }[] = [];

    if (candidateIds.length > 0) {
      const [documentsResult, tokensResult, submissionsResult] = await Promise.all([
        auth.admin
          .from("joining_documents")
          .select(
            "id, candidate_id, document_type, version, created_at, sent_at, file_name, mime_type"
          )
          .in("candidate_id", candidateIds)
          .in("document_type", [
            "offer_letter",
            "joining_letter",
            "resume",
            "experience_document",
          ])
          .order("version", { ascending: false }),
        auth.admin
          .from("joining_action_tokens")
          .select("candidate_id, action, used_at")
          .in("candidate_id", candidateIds)
          .eq("action", "accept_offer")
          .not("used_at", "is", null),
        auth.admin
          .from("joining_onboarding_submissions")
          .select("candidate_id, created_at, status")
          .in("candidate_id", candidateIds)
          .order("created_at", { ascending: false }),
      ]);

      if (documentsResult.error) throw documentsResult.error;

      documents = (documentsResult.data ?? []) as JoiningDocumentRow[];
      tokens = (tokensResult.data ?? []) as typeof tokens;
      submissions = (submissionsResult.data ?? []) as typeof submissions;
    }

    const candidatesWithDocuments = (candidates ?? []).map((candidate) => {
      const candidateDocs = documents.filter(
        (document) => document.candidate_id === candidate.id
      );
      const offerDoc = candidateDocs.find(
        (d) => d.document_type === "offer_letter" && d.sent_at
      );
      const joiningDoc = candidateDocs.find(
        (d) => d.document_type === "joining_letter" && d.sent_at
      );
      const acceptToken = tokens.find(
        (t) => t.candidate_id === candidate.id
      );
      const submission = submissions.find(
        (s) => s.candidate_id === candidate.id
      );

      return {
        ...candidate,
        joining_documents: candidateDocs.sort((a, b) => b.version - a.version),
        timeline_history: {
          offer_sent_at: offerDoc?.sent_at || null,
          offer_accepted_at:
            acceptToken?.used_at ||
            (candidate.status === "offer_accepted" || candidate.add_employee_moved_at
              ? candidate.add_employee_moved_at || candidate.updated_at || null
              : null),
          onboarding_submitted_at:
            submission?.created_at ||
            (candidate.onboarding_status === "submitted" ||
            candidate.onboarding_status === "verified"
              ? candidate.onboarding_verified_at || candidate.updated_at || null
              : null),
          onboarding_verified_at: candidate.onboarding_verified_at || null,
          joining_letter_sent_at:
            candidate.joining_letter_sent_at || joiningDoc?.sent_at || null,
        },
      };
    });

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

      if (!isObjectBody(parsedBody)) {
        return NextResponse.json(
          { error: "Invalid request body." },
          { status: 400 }
        );
      }

      body = parsedBody;
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

    const experience = parseExperience(body);

    if ("error" in experience) {
      return NextResponse.json(
        { error: experience.error },
        { status: 400 }
      );
    }

    const statutory = parseStatutoryApplicability(body);

    if ("error" in statutory) {
      return NextResponse.json(
        { error: statutory.error },
        { status: 400 }
      );
    }

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

    if (mobile_number.length < 7 || mobile_number.length > 20) {
      return NextResponse.json(
        { error: "Enter a valid mobile number." },
        { status: 400 }
      );
    }

    // The Add Candidate form sends annual CTC in lakhs.
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

    const departmentResult = await validateDepartment(
      auth.admin,
      department
    );

    if ("error" in departmentResult) {
      return NextResponse.json(
        { error: departmentResult.error },
        { status: 400 }
      );
    }

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

        // Joining date and probation are not part of candidate creation.
        joining_date: null,
        probation_period_months: null,

        // Convert lakhs to rupees before saving.
        annual_ctc: Math.round(ctcInLakhs * 100000),

        gender,
        department: departmentResult.department,
        employment_type,
        work_location,

        experience_level: experience.experience_level,
        total_experience_years:
          experience.total_experience_years,
        total_experience_months:
          experience.total_experience_months,

        // HR-confirmed statutory applicability.
        pf_eligible: statutory.data.pf_eligible,
        esi_eligible: statutory.data.esi_eligible,
        pt_eligible: statutory.data.pt_eligible,
        tds_eligible: statutory.data.tds_eligible,

        created_by: auth.user.id,
        status: "selected",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      { candidate },
      { status: 201 }
    );
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

      if (!isObjectBody(parsedBody)) {
        return NextResponse.json(
          { error: "Invalid request body." },
          { status: 400 }
        );
      }

      body = parsedBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const id =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!uuidPattern.test(id)) {
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
      body.annual_ctc === null ||
      body.annual_ctc === undefined ||
      body.annual_ctc === "" ||
      !Number.isFinite(annual_ctc) ||
      annual_ctc < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter all required candidate and offer details.",
        },
        { status: 400 }
      );
    }

    if (mobile_number.length < 7 || mobile_number.length > 20) {
      return NextResponse.json(
        { error: "Enter a valid mobile number." },
        { status: 400 }
      );
    }

    if (
      !allowedGenders.includes(
        gender as (typeof allowedGenders)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Select a valid gender." },
        { status: 400 }
      );
    }

    if (
      !allowedEmploymentTypes.includes(
        employment_type as (typeof allowedEmploymentTypes)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Select a valid employment type." },
        { status: 400 }
      );
    }

    const departmentResult = await validateDepartment(
      auth.admin,
      department
    );

    if ("error" in departmentResult) {
      return NextResponse.json(
        { error: departmentResult.error },
        { status: 400 }
      );
    }

    const { data: existingCandidate, error: lookupError } =
      await auth.admin
        .from("joining_candidates")
        .select(
          "id, status, experience_level, total_experience_years, total_experience_months"
        )
        .eq("id", id)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (!existingCandidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    if (
      !["selected", "offer_sent"].includes(
        existingCandidate.status
      )
    ) {
      return NextResponse.json(
        { error: "This candidate can no longer be edited." },
        { status: 409 }
      );
    }

    // Preserve saved experience when an older client omits these fields.
    const experience = parseExperience({
      experience_level:
        body.experience_level ??
        existingCandidate.experience_level ??
        "fresher",

      total_experience_years:
        body.total_experience_years ??
        existingCandidate.total_experience_years ??
        0,

      total_experience_months:
        body.total_experience_months ??
        existingCandidate.total_experience_months ??
        0,
    });

    if ("error" in experience) {
      return NextResponse.json(
        { error: experience.error },
        { status: 400 }
      );
    }

    const statutory = parseStatutoryApplicability(body);

    if ("error" in statutory) {
      return NextResponse.json(
        { error: statutory.error },
        { status: 400 }
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
          department: departmentResult.department,
          employment_type,
          work_location,

          // PATCH receives the stored CTC in rupees.
          annual_ctc: Math.round(annual_ctc),

          experience_level: experience.experience_level,
          total_experience_years:
            experience.total_experience_years,
          total_experience_months:
            experience.total_experience_months,

          pf_eligible: statutory.data.pf_eligible,
          esi_eligible: statutory.data.esi_eligible,
          pt_eligible: statutory.data.pt_eligible,
          tds_eligible: statutory.data.tds_eligible,
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
