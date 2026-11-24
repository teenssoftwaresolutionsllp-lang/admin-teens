
import { NextResponse } from "next/server";
import type {
  UploadApiErrorResponse,
  UploadApiResponse,
} from "cloudinary";
import { Resend } from "resend";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient, createAdminClient } from "@/lib/supabase-server";
import { generateOfferLetterPdf } from "@/lib/joining/offer-letter";
import { cloudinary } from "@/lib/cloudinary-client";
import {
  calculateMasterPayrollRow,
  type MasterPayrollEmployee,
} from "@/lib/payroll/master-payroll-engine";

import type {
  OfferSalaryBreakdown,
  OfferSalaryLine,
  OfferEmployerContribution,
  OfferEmployeeDeduction,
} from "@/lib/joining/offer-letter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UploadedPrivatePdf = {
  public_id: string;
};

type StatutoryApplicability = {
  pf_eligible: boolean;
  esi_eligible: boolean;
  pt_eligible: boolean;
  tds_eligible: boolean;
};

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type FinalizeOfferResult = {
  success?: boolean;
  error?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const allowedGenders = [
  "male",
  "female",
  "non_binary",
  "prefer_not_to_say",
];

const allowedEmploymentTypes = [
  "full_time",
  "contract",
  "intern",
];

const allowedExperienceLevels = [
  "fresher",
  "experienced",
];

function isObjectBody(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseStatutoryApplicability(
  body: Record<string, unknown>
): ValidationResult<StatutoryApplicability> {
  const fields = [
    ["pf_eligible", "PF"],
    ["esi_eligible", "ESI"],
    ["pt_eligible", "Professional Tax"],
    ["tds_eligible", "TDS"],
  ] as const;

  for (const [key, label] of fields) {
    if (typeof body[key] !== "boolean") {
      return {
        ok: false,
        error: `Please select whether ${label} is applicable or not applicable.`,
      };
    }
  }

  return {
    ok: true,
    data: {
      pf_eligible: body.pf_eligible as boolean,
      esi_eligible: body.esi_eligible as boolean,
      pt_eligible: body.pt_eligible as boolean,
      tds_eligible: body.tds_eligible as boolean,
    },
  };
}

function validateCandidateStatutory(
  candidate: Record<string, unknown>
): ValidationResult<StatutoryApplicability> {
  const fields = [
    ["pf_eligible", "PF"],
    ["esi_eligible", "ESI"],
    ["pt_eligible", "Professional Tax"],
    ["tds_eligible", "TDS"],
  ] as const;

  for (const [key, label] of fields) {
    if (typeof candidate[key] !== "boolean") {
      return {
        ok: false,
        error: `Please update the candidate and select whether ${label} is applicable or not applicable before generating the offer.`,
      };
    }
  }

  return {
    ok: true,
    data: {
      pf_eligible: candidate.pf_eligible as boolean,
      esi_eligible: candidate.esi_eligible as boolean,
      pt_eligible: candidate.pt_eligible as boolean,
      tds_eligible: candidate.tds_eligible as boolean,
    },
  };
}

function createActionToken() {
  const token = randomBytes(32).toString("hex");

  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  };
}

function getAppBaseUrl() {
  const configuredUrl = process.env.APP_BASE_URL;

  if (!configuredUrl) {
    throw new Error("APP_BASE_URL is not configured.");
  }

  return configuredUrl.replace(/\/+$/, "");
}

async function authorizeHr() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false as const,
      error: "Unauthorized",
      status: 401,
    };
  }

  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Offer role check failed:", error.message);

    return {
      ok: false as const,
      error: "Unable to verify access",
      status: 500,
    };
  }

  if (profile?.role !== "hr") {
    return {
      ok: false as const,
      error: "HR access required",
      status: 403,
    };
  }

  return {
    ok: true as const,
    admin,
    user,
  };
}

function uploadPrivatePdf(
  buffer: Buffer,
  publicId: string
): Promise<UploadedPrivatePdf> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: "raw",
          type: "authenticated",
          access_mode: "authenticated",
          public_id: publicId,
          overwrite: false,
          format: "pdf",
          tags: ["joining-offer"],
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined
        ) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result?.public_id) {
            reject(
              new Error("Cloudinary did not return an asset ID.")
            );
            return;
          }

          resolve({ public_id: result.public_id });
        }
      )
      .end(buffer);
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function formatEmploymentType(value: unknown): string {
  const types: Record<string, string> = {
    full_time: "Full-time",
    contract: "Contract",
    intern: "Intern",
  };

  const type = formatValue(value);

  return types[type] || type;
}

function formatExperienceLevel(value: unknown): string {
  const levels: Record<string, string> = {
    fresher: "Fresher",
    experienced: "Experienced",
  };

  const level = formatValue(value);

  return levels[level] || level;
}

function formatExperience(
  level: unknown,
  years: unknown,
  months: unknown
): string {
  if (level === "fresher") {
    return "Fresher (0 Years 0 Months)";
  }

  const y = Number(years ?? 0);
  const m = Number(months ?? 0);

  return `${y} ${y === 1 ? "Year" : "Years"} ${m} ${
    m === 1 ? "Month" : "Months"
  }`;
}

function formatCtc(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "";

  return `${amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  })} per annum`;
}

function formatApplicability(value: boolean): string {
  return value ? "Applicable" : "Not applicable";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

// ============================================================
// PATCH: UPDATE OFFER DETAILS
// ============================================================

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeHr();

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await context.params;

    if (!uuidPattern.test(id)) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
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
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { data: candidate, error: fetchError } = await auth.admin
      .from("joining_candidates")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!candidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    if (!["selected", "offer_sent"].includes(candidate.status)) {
      return NextResponse.json(
        {
          error:
            "Offer details cannot be edited for the candidate's current status.",
        },
        { status: 409 }
      );
    }

    const {
      gender,
      designation,
      department,
      employment_type,
      work_location,
      annual_ctc,
      experience_level,
      total_experience_years,
      total_experience_months,
    } = body;

    if (
      typeof gender !== "string" ||
      !allowedGenders.includes(gender)
    ) {
      return NextResponse.json(
        { error: "Please select a valid gender." },
        { status: 400 }
      );
    }

    if (
      typeof designation !== "string" ||
      !designation.trim()
    ) {
      return NextResponse.json(
        { error: "Designation is required." },
        { status: 400 }
      );
    }

    if (
      typeof department !== "string" ||
      !department.trim()
    ) {
      return NextResponse.json(
        { error: "Department is required." },
        { status: 400 }
      );
    }

    if (
      typeof employment_type !== "string" ||
      !allowedEmploymentTypes.includes(employment_type)
    ) {
      return NextResponse.json(
        { error: "Please select a valid employment type." },
        { status: 400 }
      );
    }

    if (
      typeof work_location !== "string" ||
      !work_location.trim()
    ) {
      return NextResponse.json(
        { error: "Work location is required." },
        { status: 400 }
      );
    }

    const ctc = Number(annual_ctc);

    if (
      annual_ctc === null ||
      annual_ctc === undefined ||
      annual_ctc === "" ||
      !Number.isFinite(ctc) ||
      ctc <= 0
    ) {
      return NextResponse.json(
        { error: "Please enter a valid annual CTC." },
        { status: 400 }
      );
    }

    if (
      typeof experience_level !== "string" ||
      !allowedExperienceLevels.includes(experience_level)
    ) {
      return NextResponse.json(
        { error: "Please select a valid experience level." },
        { status: 400 }
      );
    }

    const years = Number(total_experience_years);
    const months = Number(total_experience_months);

    if (
      total_experience_years === null ||
      total_experience_years === undefined ||
      total_experience_years === "" ||
      !Number.isInteger(years) ||
      years < 0 ||
      years > 50
    ) {
      return NextResponse.json(
        { error: "Please enter valid experience years." },
        { status: 400 }
      );
    }

    if (
      total_experience_months === null ||
      total_experience_months === undefined ||
      total_experience_months === "" ||
      !Number.isInteger(months) ||
      months < 0 ||
      months > 11
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter valid experience months (0–11).",
        },
        { status: 400 }
      );
    }

    if (
      experience_level === "fresher" &&
      (years !== 0 || months !== 0)
    ) {
      return NextResponse.json(
        {
          error:
            "Experience must be zero years and zero months for a fresher.",
        },
        { status: 400 }
      );
    }

    if (
      experience_level === "experienced" &&
      years === 0 &&
      months === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter the candidate's experience for an experienced candidate.",
        },
        { status: 400 }
      );
    }

    const statutory = parseStatutoryApplicability(body);

    if (!statutory.ok) {
      return NextResponse.json(
        { error: statutory.error },
        { status: 400 }
      );
    }

    const { data: updatedCandidate, error: updateError } =
      await auth.admin
        .from("joining_candidates")
        .update({
          gender,
          designation: designation.trim(),
          department: department.trim(),
          employment_type,
          work_location: work_location.trim(),
          annual_ctc: ctc,
          experience_level,
          total_experience_years: years,
          total_experience_months: months,
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
      message: "Offer details updated successfully.",
      candidate: updatedCandidate,
    });
  } catch (error) {
    console.error("[Joining Offer] Update failed:", error);

    return NextResponse.json(
      { error: "Failed to update offer details." },
      { status: 500 }
    );
  }
}

// ============================================================
// MASTER PAYROLL SALARY BREAKDOWN
// ============================================================

function buildOfferSalaryBreakdown(
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    designation: string;
    department: string;
    annual_ctc: number | string | null;
  },
  statutory: {
    pf_eligible: boolean;
    esi_eligible: boolean;
    pt_eligible: boolean;
    tds_eligible: boolean;
  }
): OfferSalaryBreakdown {
  const annualCtc = Number(candidate.annual_ctc);

  if (!Number.isFinite(annualCtc) || annualCtc <= 0) {
    throw new Error("Candidate annual CTC is invalid.");
  }

  // The Master Payroll Engine accepts monthly rupees in this range.
  // Its existing getMonthlyCtc() interprets values >= 1,000,000
  // as annual rupees, so do not silently miscalculate higher salaries.
  const monthlyCtc = annualCtc / 12;

  if (monthlyCtc >= 1_000_000) {
    throw new Error(
      "This annual CTC exceeds the currently supported monthly salary input range. " +
        "The Master Payroll Engine needs an explicit monthly-CTC input before this offer can be generated."
    );
  }

  const employee: MasterPayrollEmployee = {
    id: candidate.id,
    employee_id: candidate.id,
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    joining_date: null,
    designation: candidate.designation,
    bank_name: null,
    bank_account_number: null,
    ifsc_code: null,
    pan_number: null,
    uan_number: null,
    pf_number: null,
    salary: monthlyCtc,
    status: "active",
    department: candidate.department,

    pf_eligible: statutory.pf_eligible,
    esi_healthcare_eligible: statutory.esi_eligible,
    pt_eligible: statutory.pt_eligible,
    tds_eligible: statutory.tds_eligible,
  };

  const row = calculateMasterPayrollRow(
    employee,
    30,
    0,
    {
      lopDays: 0,
      incentive: 0,
      arrears: 0,
      advance: 0,
      tds: 0,
      recoverPendingStatutory: false,
    },
    null,
    {
      pf: 0,
      esi: 0,
    },
    30
  );

  const annualize = (monthlyAmount: number): number =>
    Math.round(monthlyAmount * 12);

  const earnings: OfferSalaryLine[] = [
    {
      label: "Basic Salary",
      monthlyAmount: row.basic,
      annualAmount: annualize(row.basic),
    },
    {
      label: "House Rent Allowance (HRA)",
      monthlyAmount: row.hra,
      annualAmount: annualize(row.hra),
    },
    {
      label: "Conveyance Allowance",
      monthlyAmount: row.conveyance,
      annualAmount: annualize(row.conveyance),
    },
    {
      label: "Medical Allowance",
      monthlyAmount: row.medical_allowance,
      annualAmount: annualize(row.medical_allowance),
    },
    {
      label: "Leave Travel Allowance",
      monthlyAmount: row.leave_travel_allowance,
      annualAmount: annualize(row.leave_travel_allowance),
    },
    {
      label: "Special Allowance",
      monthlyAmount: row.special_allowance,
      annualAmount: annualize(row.special_allowance),
    },
  ];

  const employerContributions: OfferEmployerContribution[] = [
    {
      label: "Employer ESI",
      monthlyAmount: row.esic_empr,
      annualAmount: annualize(row.esic_empr),
      includedInCtc: false,
    },
    {
      label: "PF Administration Charges",
      monthlyAmount: row.pf_admin,
      annualAmount: annualize(row.pf_admin),
      includedInCtc: false,
    },
  ];

  const employeeDeductions: OfferEmployeeDeduction[] = [
    {
      label: "Employee Provident Fund",
      monthlyAmount: row.epf,
      annualAmount: annualize(row.epf),
    },
    {
      label: "Employee ESI",
      monthlyAmount: row.esic_emp,
      annualAmount: annualize(row.esic_emp),
    },
    {
      label: "Professional Tax",
      monthlyAmount: row.pt,
      annualAmount: annualize(row.pt),
    },
    {
      label: "Tax Deducted at Source (TDS)",
      monthlyAmount: statutory.tds_eligible ? null : 0,
      annualAmount: statutory.tds_eligible ? null : 0,
      note: statutory.tds_eligible
        ? "TDS applicability has been confirmed by HR. The actual withholding amount will be determined during payroll."
        : "TDS marked as not applicable at the offer stage.",
    },
  ];

  const takeHomeNote = statutory.tds_eligible
    ? "Estimated take-home excludes TDS because the current Master Payroll Engine does not calculate income-tax withholding automatically. Actual take-home will be lower if TDS applies. This estimate also excludes attendance-related LOP and other future payroll adjustments."
    : "Estimated full-month take-home using the current Master Payroll Engine, assuming no LOP, advance, arrears, incentive, or other adjustments. Actual payroll may vary.";

  return {
    annualCtc,
    monthlyCtc: row.ctc,
    monthlyGross: row.gross_salary,
    earnings,
    employerContributions,
    employeeDeductions,
    estimatedMonthlyTakeHome: row.net_payout,
    takeHomeNote,
  };
}

// ============================================================
// POST: GENERATE AND SEND OFFER LETTER
// ============================================================

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let uploadedPublicId: string | null = null;
  let documentSaved = false;

  try {
    // 1. Authenticate HR.
    const auth = await authorizeHr();

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // 2. Validate candidate ID.
    const { id } = await context.params;

    if (!uuidPattern.test(id)) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    // 3. Load candidate.
    type OfferCandidate = {
      id: string;
      first_name: string;
      last_name: string;
      personal_email: string | null;
      designation: string | null;
      annual_ctc: number | null;
      status: string;
      gender: string | null;
      department: string | null;
      employment_type: string | null;
      work_location: string | null;
      experience_level: string | null;
      total_experience_years: number | null;
      total_experience_months: number | null;
      pf_eligible: boolean | null;
      esi_eligible: boolean | null;
      pt_eligible: boolean | null;
      tds_eligible: boolean | null;
    };

    const {
      data: candidateData,
      error: candidateError,
    } = await auth.admin
      .from("joining_candidates")
      .select(
        "id, first_name, last_name, personal_email, designation, annual_ctc, status, gender, department, employment_type, work_location, experience_level, total_experience_years, total_experience_months, pf_eligible, esi_eligible, pt_eligible, tds_eligible"
      )
      .eq("id", id)
      .maybeSingle();

    if (candidateError) throw candidateError;

    const candidate =
      candidateData as unknown as OfferCandidate | null;

    if (!candidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    // 4. Validate employment details.
    if (
      !candidate.gender ||
      !allowedGenders.includes(candidate.gender) ||
      !candidate.department?.trim() ||
      !candidate.designation?.trim() ||
      !candidate.employment_type ||
      !allowedEmploymentTypes.includes(candidate.employment_type) ||
      !candidate.work_location?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot generate the offer. Please complete the candidate's gender, designation, department, employment type and work location first.",
        },
        { status: 400 }
      );
    }

    if (!["selected", "offer_sent"].includes(candidate.status)) {
      return NextResponse.json(
        {
          error:
            "An offer cannot be generated for this candidate's current status.",
        },
        { status: 409 }
      );
    }

    if (
      !candidate.experience_level ||
      !allowedExperienceLevels.includes(candidate.experience_level)
    ) {
      return NextResponse.json(
        {
          error:
            "Please select the candidate's experience level before generating the offer.",
        },
        { status: 400 }
      );
    }

    const experienceYears = Number(
      candidate.total_experience_years ?? 0
    );

    const experienceMonths = Number(
      candidate.total_experience_months ?? 0
    );

    if (
      !Number.isInteger(experienceYears) ||
      experienceYears < 0 ||
      experienceYears > 50 ||
      !Number.isInteger(experienceMonths) ||
      experienceMonths < 0 ||
      experienceMonths > 11
    ) {
      return NextResponse.json(
        { error: "Candidate experience details are invalid." },
        { status: 400 }
      );
    }

    if (
      candidate.experience_level === "fresher" &&
      (experienceYears !== 0 || experienceMonths !== 0)
    ) {
      return NextResponse.json(
        {
          error:
            "A fresher must have zero years and zero months of experience.",
        },
        { status: 400 }
      );
    }

    if (
      candidate.experience_level === "experienced" &&
      experienceYears === 0 &&
      experienceMonths === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter the candidate's total experience before generating the offer.",
        },
        { status: 400 }
      );
    }

    // 5. Statutory applicability must be explicitly selected.
    const statutory = validateCandidateStatutory(
      candidate as unknown as Record<string, unknown>
    );

    if (!statutory.ok) {
      return NextResponse.json(
        { error: statutory.error },
        { status: 400 }
      );
    }

    const recipient = candidate.personal_email?.trim();

    if (!recipient) {
      return NextResponse.json(
        {
          error:
            "The candidate does not have a personal email address. Add the email before generating and sending the offer.",
        },
        { status: 400 }
      );
    }

    // 6. Validate email configuration.
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      console.error(
        "[Joining Offer] RESEND_API_KEY or RESEND_FROM_EMAIL is missing."
      );

      return NextResponse.json(
        {
          error:
            "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL on the server.",
        },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    // 7. Calculate next offer version.
    const { data: previousDocuments, error: versionError } =
      await auth.admin
        .from("joining_documents")
        .select("version")
        .eq("candidate_id", id)
        .eq("document_type", "offer_letter")
        .order("version", { ascending: false })
        .limit(1);

    if (versionError) throw versionError;

    const version =
      (previousDocuments?.[0]?.version ?? 0) + 1;

    // 8. Calculate the salary structure using the Master Payroll Engine.
    const salaryBreakdown = buildOfferSalaryBreakdown(
      {
        id: candidate.id,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        designation: candidate.designation,
        department: candidate.department,
        annual_ctc: candidate.annual_ctc,
      },
      {
        pf_eligible: statutory.data.pf_eligible,
        esi_eligible: statutory.data.esi_eligible,
        pt_eligible: statutory.data.pt_eligible,
        tds_eligible: statutory.data.tds_eligible,
      }
    );

    // 9. Generate PDF using the same salary structure that will be saved.
    const pdf = await generateOfferLetterPdf({
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      designation: candidate.designation,
      annualCtc: Number(candidate.annual_ctc),
      candidateId: candidate.id,
      department: candidate.department,
      employmentType: candidate.employment_type,
      workLocation: candidate.work_location,

      pfEligible: statutory.data.pf_eligible,
      esiEligible: statutory.data.esi_eligible,
      ptEligible: statutory.data.pt_eligible,
      tdsEligible: statutory.data.tds_eligible,

      salaryBreakdown,
    });

    // 10. Upload privately to Cloudinary.
    const publicId =
      `teens-hr/joining-offers/${candidate.id}/offer-v${version}`;

    const uploaded = await uploadPrivatePdf(pdf, publicId);
    uploadedPublicId = uploaded.public_id;

    // 11. Prepare this revision.
    // This revokes older unused offer-response links.
    const {
      data: prepareResult,
      error: prepareError,
    } = await auth.admin.rpc("prepare_joining_offer_revision", {
      p_candidate_id: candidate.id,
    });

    if (prepareError) {
      throw prepareError;
    }

    if (!prepareResult || prepareResult.success !== true) {
      throw new Error(
        prepareResult?.error ||
          "Unable to prepare this offer revision."
      );
    }

    // 12. Freeze the exact offer terms used to generate this PDF.
    // This snapshot is the source of truth for the accepted offer.
    const offerSnapshot = {
      schema_version: 1,
      currency: "INR",
      candidate: {
        id: candidate.id,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        designation: candidate.designation,
        department: candidate.department,
        employment_type: candidate.employment_type,
        work_location: candidate.work_location,
        experience_level: candidate.experience_level,
        total_experience_years: experienceYears,
        total_experience_months: experienceMonths,
      },
      compensation: salaryBreakdown,
      statutory: {
        pf_eligible: statutory.data.pf_eligible,
        esi_eligible: statutory.data.esi_eligible,
        pt_eligible: statutory.data.pt_eligible,
        tds_eligible: statutory.data.tds_eligible,
      },
    };

    // 13. Save the offer document and immutable salary snapshot.
    const {
      data: documentRecord,
      error: insertError,
    } = await auth.admin
      .from("joining_documents")
      .insert({
        candidate_id: candidate.id,
        document_type: "offer_letter",
        version,
        storage_path: uploaded.public_id,
        created_by: auth.user.id,
        offer_snapshot: offerSnapshot,
      })
      .select(
        "id, candidate_id, document_type, version, generated_at"
      )
      .single();

    if (insertError) throw insertError;

    documentSaved = true;

    // The private PDF is now associated with a saved document record.
    uploadedPublicId = null;

    // 14. Create separate, secure accept and decline tokens.
    // They remain inactive until Resend accepts the email and the
    // finalization RPC activates both tokens.
    const acceptToken = createActionToken();
    const declineToken = createActionToken();

    const tokenExpiry = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: tokenInsertError } = await auth.admin
      .from("joining_action_tokens")
      .insert([
        {
          candidate_id: candidate.id,
          document_id: documentRecord.id,
          token_hash: acceptToken.tokenHash,
          action: "accept_offer",
          expires_at: tokenExpiry,
        },
        {
          candidate_id: candidate.id,
          document_id: documentRecord.id,
          token_hash: declineToken.tokenHash,
          action: "decline_offer",
          expires_at: tokenExpiry,
        },
      ]);

    if (tokenInsertError) {
      console.error(
        "[Joining Offer] Token creation failed:",
        tokenInsertError
      );

      return NextResponse.json(
        {
          error:
            "The offer PDF was generated, but the response links could not be created. Check the offer document before retrying.",
          document: documentRecord,
        },
        { status: 500 }
      );
    }

    const baseUrl = getAppBaseUrl();

    const logoBuffer = await readFile(
      path.join(process.cwd(), "public", "logo.png")
    );

    const acceptUrl =
      `${baseUrl}/joining/respond?token=${acceptToken.token}&action=accept_offer`;

    const declineUrl =
      `${baseUrl}/joining/respond?token=${declineToken.token}&action=decline_offer`;

    // 15. Format email details.
    const experienceValue = formatExperience(
      candidate.experience_level,
      experienceYears,
      experienceMonths
    );

    const employmentDetails: [string, string][] = [
      ["Designation", formatValue(candidate.designation)],
      ["Department", formatValue(candidate.department)],
      [
        "Employment Type",
        formatEmploymentType(candidate.employment_type),
      ],
      ["Work Location", formatValue(candidate.work_location)],
      ["Annual CTC", formatCtc(candidate.annual_ctc)],
      [
        "Experience Level",
        formatExperienceLevel(candidate.experience_level),
      ],
      ["Total Experience", experienceValue],
      [
        "Provident Fund (PF)",
        formatApplicability(statutory.data.pf_eligible),
      ],
      [
        "Employee State Insurance (ESI)",
        formatApplicability(statutory.data.esi_eligible),
      ],
      [
        "Professional Tax (PT)",
        formatApplicability(statutory.data.pt_eligible),
      ],
      [
        "Tax Deducted at Source (TDS)",
        formatApplicability(statutory.data.tds_eligible),
      ],
    ];

    const detailsText = employmentDetails.map(
      ([label, value]) => `${label}: ${value}`
    );

    const detailsHtml = employmentDetails
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e5e7eb; color: #555; width: 42%;">
              <strong>${escapeHtml(label)}</strong>
            </td>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e5e7eb;">
              ${escapeHtml(value)}
            </td>
          </tr>
        `
      )
      .join("");

    const statutoryDisclaimer =
      "Statutory applicability is based on the information confirmed by HR at the offer stage. Final statutory treatment and deductions are subject to applicable law, employee details and payroll verification.";

    // 16. Send offer email.
    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: fromEmail,
        to: [recipient],
        subject: `Offer Letter - ${candidate.first_name} ${candidate.last_name}`,

        text: [
          `Dear ${candidate.first_name} ${candidate.last_name},`,
          "",
          "Congratulations!",
          "",
          "We are pleased to offer you a position at TEENS SOFTWARE SOLUTIONS LLP.",
          "Please find your offer letter attached to this email.",
          "",
          "EMPLOYMENT AND STATUTORY DETAILS",
          "--------------------------------",
          ...detailsText,
          "",
          statutoryDisclaimer,
          "",
          "Please review the attached offer letter carefully, including the terms and conditions.",
          "",
          "Please confirm your decision using one of the links below:",
          "",
          `Accept Offer: ${acceptUrl}`,
          "",
          `Reject Offer: ${declineUrl}`,
          "",
          "These links expire 7 days after they are issued. You will be asked to confirm your decision before it is submitted.",
          "",
          "If you have any questions, please contact our HR team.",
          "",
          "Regards,",
          "HR Team",
          "TEENS SOFTWARE SOLUTIONS LLP",
          "Hyderabad, Telangana, India",
        ].join("\n"),

        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; color: #222; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px;">

            <div style="text-align: center; margin-bottom: 28px;">
              <img
                src="cid:company-logo"
                alt="TEENS SOFTWARE SOLUTIONS LLP"
                width="180"
                style="display:block;width:180px;height:auto;margin:0 auto;"
              />
            </div>

            <p>Dear ${escapeHtml(formatValue(candidate.first_name))} ${escapeHtml(formatValue(candidate.last_name))},</p>

            <p>
              Congratulations! We are pleased to offer you a position at
              <strong>TEENS SOFTWARE SOLUTIONS LLP</strong>.
            </p>

            <p>
              Please find your offer letter attached. Below is a summary of your
              employment and statutory details for your reference.
            </p>

            <h3 style="font-size: 16px; margin: 24px 0 10px; color: #1f2937;">
              Employment and Statutory Details
            </h3>

            <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 14px;">
              <tbody>
                ${detailsHtml}
              </tbody>
            </table>

            <p style="font-size: 12px; color: #666; margin-top: 12px;">
              ${escapeHtml(statutoryDisclaimer)}
            </p>

            <p>
              Please review the attached offer letter carefully, including the
              employment terms and applicable company policies.
            </p>

            <h3 style="font-size: 16px; margin: 24px 0 10px; color: #1f2937;">
              Confirm Your Decision
            </h3>

            <p>Please select one of the options below:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a
                href="${acceptUrl}"
                style="display: inline-block; background-color: #16803d; color: #ffffff; padding: 13px 26px; margin: 6px; text-decoration: none; border-radius: 6px; font-weight: bold;"
              >Accept Offer</a>

              <a
                href="${declineUrl}"
                style="display: inline-block; background-color: #b42318; color: #ffffff; padding: 13px 26px; margin: 6px; text-decoration: none; border-radius: 6px; font-weight: bold;"
              >Reject Offer</a>
            </div>

            <p style="font-size: 14px; color: #555;">
              These links expire 7 days after they are issued. After selecting
              an option, you will be asked to confirm your decision before it
              is submitted.
            </p>

            <p>
              If you have any questions or need clarification, please contact our HR team.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 26px 0;" />

            <p>
              Best regards,<br />
              HR Team<br />
              <strong>TEENS SOFTWARE SOLUTIONS LLP</strong><br />
              Hyderabad, Telangana, India
            </p>
          </div>
        `,

        attachments: [
          {
            filename: `Offer-Letter-${candidate.id}-v${version}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
          {
            filename: "logo.png",
            content: logoBuffer,
            contentType: "image/png",
            contentId: "company-logo",
          },
        ],
      });

    // 17. If Resend rejects the email, revoke the inactive tokens.
    if (emailError || !emailData?.id) {
      console.error("[Joining Offer] Resend failed:", emailError);

      const { error: revokeError } = await auth.admin
        .from("joining_action_tokens")
        .update({
          revoked_at: new Date().toISOString(),
        })
        .eq("document_id", documentRecord.id)
        .is("used_at", null)
        .is("revoked_at", null);

      if (revokeError) {
        console.error(
          "[Joining Offer] Failed to revoke inactive response tokens:",
          revokeError
        );
      }

      return NextResponse.json(
        {
          error:
            "The offer PDF was generated and saved, but the email could not be sent. Check the server logs and Resend dashboard before retrying.",
          document: documentRecord,
        },
        { status: 502 }
      );
    }

    // 18. Finalize the offer in one database transaction.
    //
    // This RPC must:
    // - Verify the candidate and offer document.
    // - Verify this is the latest offer revision.
    // - Verify exactly one accept and one decline token exist.
    // - Record sent_at and the Resend provider ID.
    // - Activate both response tokens.
    // - Revoke older unused response tokens.
    // - Set the candidate status to offer_sent.
    //
    // Do not separately update joining_documents or joining_candidates here.
    const {
      data: finalizeResult,
      error: finalizeError,
    } = await auth.admin.rpc("finalize_joining_offer_send", {
      p_candidate_id: candidate.id,
      p_document_id: documentRecord.id,
      p_email_provider_id: emailData.id,
    });

    const finalized = finalizeResult as FinalizeOfferResult | null;

    if (
      finalizeError ||
      !finalized ||
      finalized.success !== true
    ) {
      console.error(
        "[Joining Offer] Email accepted, but offer finalization failed:",
        finalizeError || finalized
      );

      return NextResponse.json(
        {
          error:
            "Resend accepted the email, but the offer could not be finalized in the database. Check the Resend dashboard and database record before retrying.",
          emailAccepted: true,
          emailId: emailData.id,
          document: documentRecord,
        },
        { status: 500 }
      );
    }

    // 19. Read the finalized document so the response uses the
    // database's actual sent_at and email_provider_id values.
    const {
      data: finalizedDocument,
      error: finalizedDocumentError,
    } = await auth.admin
      .from("joining_documents")
      .select(
        "id, candidate_id, document_type, version, generated_at, sent_at, email_provider_id"
      )
      .eq("id", documentRecord.id)
      .single();

    if (finalizedDocumentError || !finalizedDocument) {
      console.error(
        "[Joining Offer] Offer finalized, but document read-back failed:",
        finalizedDocumentError
      );

      return NextResponse.json(
        {
          error:
            "The offer email was sent and the offer was finalized, but the final document details could not be loaded.",
          emailAccepted: true,
          emailId: emailData.id,
          offerFinalized: true,
          documentId: documentRecord.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: `Offer letter sent to ${recipient}.`,
        emailAccepted: true,
        emailId: emailData.id,
        offerFinalized: true,
        document: finalizedDocument,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "[Joining Offer] Generation or sending failed:",
      error
    );

    // Clean up only if the document was not saved to Supabase.
    if (uploadedPublicId && !documentSaved) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: "raw",
          type: "authenticated",
        });
      } catch (cleanupError) {
        console.error(
          "[Joining Offer] Cloudinary cleanup failed:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate or send the offer letter." },
      { status: 500 }
    );
  }
}
