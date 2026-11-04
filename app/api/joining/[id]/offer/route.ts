
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UploadedPrivatePdf = {
  public_id: string;
};

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
    return { error: "Unauthorized", status: 401 as const };
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
            reject(new Error("Cloudinary did not return an asset ID."));
            return;
          }

          resolve({ public_id: result.public_id });
        }
      )
      .end(buffer);
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

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await context.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
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
        { error: "Please enter valid experience months (0–11)." },
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

    // Joining date and probation are intentionally not updated here.
    // They are managed by the separate Joining Letter workflow.
    const { data: updatedCandidate, error: updateError } = await auth.admin
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

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // 2. Validate candidate ID.
    const { id } = await context.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    // 3. Load candidate.
    const { data: candidate, error: candidateError } = await auth.admin
      .from("joining_candidates")
      .select(
        "id, first_name, last_name, personal_email, designation, joining_date, annual_ctc, status, gender, department, probation_period_months, employment_type, work_location, experience_level, total_experience_years, total_experience_months"
      )
      .eq("id", id)
      .maybeSingle();

    if (candidateError) throw candidateError;

    if (!candidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    // 4. Validate required employment details.
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
        {error:"Cannot generate the offer. Please complete the candidate's gender, designation, department, joining date, probation period, employment type, and work location first.",},
        { status: 400 }
      );
    }

    if (!["selected", "offer_sent"].includes(candidate.status)) {
      return NextResponse.json(
        {error:"An offer cannot be generated for this candidate's current status."},
        { status: 409 }
      );
    }

    if (
      !candidate.experience_level ||
      !allowedExperienceLevels.includes(candidate.experience_level)
    ) {
      return NextResponse.json(
        {error:"Please select the candidate's experience level before generating the offer."},
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

    // 5. Validate email configuration.
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

    // 6. Calculate next offer version.
    const { data: previousDocuments, error: versionError } =
      await auth.admin
        .from("joining_documents")
        .select("version")
        .eq("candidate_id", id)
        .eq("document_type", "offer_letter")
        .order("version", { ascending: false })
        .limit(1);

    if (versionError) throw versionError;

    const version = (previousDocuments?.[0]?.version ?? 0) + 1;

    // 7. Generate PDF.
    const pdf = await generateOfferLetterPdf({
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      designation: candidate.designation,
      annualCtc: Number(candidate.annual_ctc),
      candidateId: candidate.id,
      department: candidate.department,
      employmentType: candidate.employment_type,
      workLocation: candidate.work_location,
    });

    // 8. Upload privately to Cloudinary.
    const publicId =
      `teens-hr/joining-offers/${candidate.id}/offer-v${version}`;

    const uploaded = await uploadPrivatePdf(pdf, publicId);
    uploadedPublicId = uploaded.public_id;

    // 9. Save document record.
    const { data: documentRecord, error: insertError } = await auth.admin
      .from("joining_documents")
      .insert({
        candidate_id: candidate.id,
        document_type: "offer_letter",
        version,
        storage_path: uploaded.public_id,
        created_by: auth.user.id,
      })
      .select("id, candidate_id, document_type, version, generated_at")
      .single();

    if (insertError) throw insertError;

    documentSaved = true;

    // Keep the uploaded PDF if email sending fails.
    uploadedPublicId = null;

    // 10. Create secure action tokens.
    const acceptToken = createActionToken();
    const declineToken = createActionToken();

    const tokenExpiry = new Date(
      Date.now() + 15 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: tokenInsertError } = await auth.admin
      .from("joining_action_tokens")
      .insert([
        {
          candidate_id: candidate.id,
          token_hash: acceptToken.tokenHash,
          action: "accept_offer",
          expires_at: tokenExpiry,
        },
        {
          candidate_id: candidate.id,
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
        { error: "Unable to create offer response links." },
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

    // 11. Format email details.
    const formatValue = (value: unknown): string => {
      if (value === null || value === undefined || value === "") {
        return "";
      }

      return String(value);
    };

    const formatEmploymentType = (value: unknown): string => {
      const types: Record<string, string> = {
        full_time: "Full-time",
        contract: "Contract",
        intern: "Intern",
      };

      const type = formatValue(value);

      return types[type] || type;
    };

    const formatExperienceLevel = (value: unknown): string => {
      const levels: Record<string, string> = {
        fresher: "Fresher",
        experienced: "Experienced",
      };

      const level = formatValue(value);

      return levels[level] || level;
    };

    const formatExperience = (
      level: unknown,
      years: unknown,
      months: unknown
    ): string => {
      if (level === "fresher") {
        return "Fresher (0 Years 0 Months)";
      }

      const y = Number(years ?? 0);
      const m = Number(months ?? 0);

      return `${y} ${y === 1 ? "Year" : "Years"} ${m} ${
        m === 1 ? "Month" : "Months"
      }`;
    };

    const formatProbation = (value: unknown): string => {
      if (value === null || value === undefined || value === "") {
        return "";
      }

      const months = Number(value);

      if (!Number.isFinite(months)) return "";

      return months === 0
        ? "No probation"
        : `${months} ${months === 1 ? "month" : "months"}`;
    };

    const formatJoiningDate = (value: unknown): string => {
      const date = formatValue(value);

      if (!date) return "";

      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

      if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
      }

      const parsed = new Date(date);

      return Number.isNaN(parsed.getTime())
        ? date
        : parsed.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          });
    };

    const formatCtc = (value: unknown): string => {
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
    };

    const experienceValue = formatExperience(
      candidate.experience_level,
      experienceYears,
      experienceMonths
    );

    const employmentDetails = ([
      ["Designation", formatValue(candidate.designation)],
      ["Department", formatValue(candidate.department)],
      ["Employment Type", formatEmploymentType(candidate.employment_type),],
      ["Work Location", formatValue(candidate.work_location)],
      ["Annual CTC", formatCtc(candidate.annual_ctc)],
      ["Experience Level",formatExperienceLevel(candidate.experience_level),],
      ["Total Experience", experienceValue],
    ]as [string, string][]).filter(([, value]) => Boolean(value));

    const escapeHtml = (value: string): string =>
      value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        };

        return entities[char];
      });

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

    // 12. Send offer email.
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
          "EMPLOYMENT DETAILS",
          "------------------",
          ...detailsText,
          "",
          "Please review the attached offer letter carefully, including the terms and conditions.",
          "",
          "Please confirm your decision using one of the links below:",
          "",
          `Accept Offer: ${acceptUrl}`,
          "",
          `Reject Offer: ${declineUrl}`,
          "",
          "These links expire 15 days after they are issued. You will be asked to confirm your decision before it is submitted.",
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
              employment details for your reference.
            </p>

            <h3 style="font-size: 16px; margin: 24px 0 10px; color: #1f2937;">
              Employment Details
            </h3>

            <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 14px;">
              <tbody>
                ${detailsHtml}
              </tbody>
            </table>

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
              These links expire 15 days after they are issued. After selecting
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

    if (emailError || !emailData?.id) {
      console.error("[Joining Offer] Resend failed:", emailError);

      return NextResponse.json(
        {
          error:
            "The offer PDF was generated and saved, but the email could not be sent. Check the server logs and Resend dashboard before retrying.",
          document: documentRecord,
        },
        { status: 502 }
      );
    }

    // 13. Record successful provider acceptance.
    const sentAt = new Date().toISOString();

    const { error: documentUpdateError } = await auth.admin
      .from("joining_documents")
      .update({
        sent_at: sentAt,
        email_provider_id: emailData.id,
      })
      .eq("id", documentRecord.id);

    if (documentUpdateError) {
      console.error(
        "[Joining Offer] Email sent, but document tracking failed:",
        documentUpdateError.message
      );

      return NextResponse.json(
        {
          error:
            "The email was accepted by Resend, but its send record could not be updated. Check Resend before retrying to avoid sending a duplicate.",
          emailAccepted: true,
          document: documentRecord,
        },
        { status: 500 }
      );
    }

    // 14. Update candidate status after Resend accepts the email.
    const { error: candidateUpdateError } = await auth.admin
      .from("joining_candidates")
      .update({
        status: "offer_sent",
        offer_sent_at: sentAt,
      })
      .eq("id", candidate.id);

    if (candidateUpdateError) {
      console.error(
        "[Joining Offer] Email sent, but candidate status update failed:",
        candidateUpdateError.message
      );

      return NextResponse.json(
        {
          error:
            "The email was accepted by Resend, but the candidate status could not be updated. Check the record before retrying.",
          emailAccepted: true,
          document: documentRecord,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: `Offer letter sent to ${recipient}.`,
        emailAccepted: true,
        emailId: emailData.id,
        document: {
          ...documentRecord,
          sent_at: sentAt,
          email_provider_id: emailData.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Joining Offer] Generation or sending failed:", error);

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
