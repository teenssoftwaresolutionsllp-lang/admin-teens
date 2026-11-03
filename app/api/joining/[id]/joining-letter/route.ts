import { NextResponse } from "next/server";
import type {
  UploadApiErrorResponse,
  UploadApiResponse,
} from "cloudinary";
import { Resend } from "resend";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient, createAdminClient } from "@/lib/supabase-server";
import { generateJoiningLetterPdf } from "@/lib/joining/joining-letter";
import { cloudinary } from "@/lib/cloudinary-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UploadedPrivatePdf = {
  public_id: string;
};

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
          tags: ["joining-letter"],
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
    console.error("[Joining Letter] Role check failed:", error.message);

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

/**
 * Returns today's calendar date in India, independent of the
 * server's configured timezone.
 */
function getIndiaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let uploadedPublicId: string | null = null;
  let documentSaved = false;
  let sendClaimed = false;
  let emailAttempted = false;
  let candidateId: string | null = null;

  try {
    // 1. Authenticate and authorize HR.
    const auth = await authorizeHr();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // 2. Validate candidate ID.
    const { id } = await context.params;
    candidateId = id;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    // 3. Parse and validate the popup values.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "A valid JSON request body is required." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const requestBody = body as Record<string, unknown>;

    const joiningDateValue = requestBody.joining_date;
    const probationValue = requestBody.probation_period_months;

    if (
      typeof joiningDateValue !== "string" ||
      !isValidCalendarDate(joiningDateValue)
    ) {
      return NextResponse.json(
        { error: "Select a valid joining date." },
        { status: 400 }
      );
    }

    const joiningDate = joiningDateValue;
    const indiaToday = getIndiaToday();

    if (joiningDate < indiaToday) {
      return NextResponse.json(
        {
          error:
            "The joining date cannot be before today in India. Select today or a future date.",
        },
        { status: 400 }
      );
    }

    // Probation comes from the popup, not the candidate's existing record.
    const allowedProbationPeriods = [0, 3, 6, 12];

    if (
      typeof probationValue !== "number" ||
      !Number.isInteger(probationValue) ||
      !allowedProbationPeriods.includes(probationValue)
    ) {
      return NextResponse.json(
        {
          error:
            "Select a valid probation duration: No probation, 3, 6, or 12 months.",
        },
        { status: 400 }
      );
    }

    const probationPeriodMonths = probationValue;

    // 4. Fetch candidate.
    const { data: candidate, error: candidateError } = await auth.admin
      .from("joining_candidates")
      .select(
        "id, first_name, last_name, personal_email, designation, joining_date, annual_ctc, status, department, employment_type, work_location, joining_letter_sent_at, joining_letter_send_status"
      )
      .eq("id", id)
      .maybeSingle();

    if (candidateError) {
      throw candidateError;
    }

    if (!candidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    // 5. Only candidates who accepted the offer can receive a joining letter.
    if (candidate.status !== "offer_accepted") {
      return NextResponse.json(
        {
          error:
            "A joining letter can only be generated after the candidate accepts the offer.",
        },
        { status: 409 }
      );
    }

    // 6. Validate employment details.
    // Probation is intentionally not checked against the old candidate record.
    const allowedEmploymentTypes = [
      "full_time",
      "contract",
      "intern",
    ];

    if (
      !candidate.department?.trim() ||
      !candidate.work_location?.trim() ||
      !candidate.employment_type ||
      !allowedEmploymentTypes.includes(candidate.employment_type)
    ) {
      return NextResponse.json(
        {
          error:
            "Complete the candidate's department, employment type, and work location before generating the joining letter.",
        },
        { status: 400 }
      );
    }

    const recipient = candidate.personal_email?.trim();

    if (!recipient) {
      return NextResponse.json(
        { error: "The candidate's personal email address is missing." },
        { status: 400 }
      );
    }

    // 7. Validate email configuration before claiming the send.
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      return NextResponse.json(
        { error: "Email service is not configured on the server." },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    // 8. Atomically claim this candidate's joining-letter send.
    const { data: claimed, error: claimError } = await auth.admin.rpc(
      "claim_joining_letter_send",
      {
        p_candidate_id: candidate.id,
      }
    );

    if (claimError) {
      console.error(
        "[Joining Letter] Atomic claim failed:",
        claimError.message
      );

      return NextResponse.json(
        {
          error:
            "Unable to claim the joining-letter send. Please try again later.",
        },
        { status: 500 }
      );
    }

    if (claimed !== true) {
      return NextResponse.json(
        {
          error:
            "A joining-letter send has already started, has already been sent, or requires verification. Check the candidate's send status before retrying.",
        },
        { status: 409 }
      );
    }

    sendClaimed = true;

    // 9. Save the joining date and popup-selected probation duration.
    const { data: updatedDateRecord, error: dateUpdateError } =
      await auth.admin
        .from("joining_candidates")
        .update({
          joining_date: joiningDate,
          probation_period_months: probationPeriodMonths,
        })
        .eq("id", candidate.id)
        .eq("status", "offer_accepted")
        .select("id")
        .maybeSingle();

    if (dateUpdateError) {
      throw dateUpdateError;
    }

    if (!updatedDateRecord) {
      throw new Error(
        "The candidate status changed before the joining details could be saved."
      );
    }

    // 10. Calculate the next document version.
    const { data: previousDocuments, error: versionError } =
      await auth.admin
        .from("joining_documents")
        .select("version")
        .eq("candidate_id", candidate.id)
        .eq("document_type", "joining_letter")
        .order("version", { ascending: false })
        .limit(1);

    if (versionError) {
      throw versionError;
    }

    const version = (previousDocuments?.[0]?.version ?? 0) + 1;

    // 11. Generate the PDF using the popup-selected values.
    const pdf = await generateJoiningLetterPdf({
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      designation: candidate.designation,
      joiningDate,
      annualCtc: Number(candidate.annual_ctc),
      candidateId: candidate.id,
      department: candidate.department,
      employmentType: candidate.employment_type,
      workLocation: candidate.work_location,
      probationPeriodMonths,
    });

    // 12. Upload the PDF privately to Cloudinary.
    const publicId =
      `teens-hr/joining-letters/${candidate.id}/joining-letter-v${version}`;

    const uploaded = await uploadPrivatePdf(pdf, publicId);
    uploadedPublicId = uploaded.public_id;

    // 13. Save the document before sending the email.
    const { data: documentRecord, error: insertError } = await auth.admin
      .from("joining_documents")
      .insert({
        candidate_id: candidate.id,
        document_type: "joining_letter",
        version,
        storage_path: uploaded.public_id,
        created_by: auth.user.id,
      })
      .select("id, candidate_id, document_type, version, generated_at")
      .single();

    if (insertError) {
      throw insertError;
    }

    documentSaved = true;

    // Keep the PDF if its database record exists.
    uploadedPublicId = null;

    // 14. Read the company logo.
    const logoBuffer = await readFile(
      path.join(process.cwd(), "public", "logo.png")
    );

    const fullName =
      `${candidate.first_name} ${candidate.last_name}`.trim();

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

    // Format YYYY-MM-DD without converting it to the server's local timezone.
    const formattedJoiningDate = new Date(
      `${joiningDate}T00:00:00.000Z`
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    const formattedProbation =
      probationPeriodMonths === 0
        ? "No probation"
        : `${probationPeriodMonths} months`;

    // 15. Send the joining letter.
    // After the provider request starts, the outcome may be uncertain.
    // Do not automatically unlock the send after an ambiguous failure.
    emailAttempted = true;

    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: fromEmail,
        to: [recipient],
        subject: `Joining Letter - ${fullName}`,
        text: [
          `Dear ${candidate.first_name},`,
          "",
          "Congratulations, and welcome to TEENS SOFTWARE SOLUTIONS LLP!",
          "",
          "Please find your joining letter attached to this email.",
          "",
          `Designation: ${candidate.designation}`,
          `Department: ${candidate.department}`,
          `Employment Type: ${candidate.employment_type}`,
          `Work Location: ${candidate.work_location}`,
          `Date of Joining: ${formattedJoiningDate}`,
          `Probation Duration: ${formattedProbation}`,
          "",
          "Please retain the attached joining letter for your records.",
          "",
          "Regards,",
          "HR Team",
          "TEENS SOFTWARE SOLUTIONS LLP",
          "Hyderabad, Telangana, India",
        ].join("\n"),
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;">
            <div style="text-align:center;margin-bottom:24px;">
              <img
                src="cid:company-logo"
                alt="TEENS SOFTWARE SOLUTIONS LLP"
                width="180"
                style="display:block;width:180px;height:auto;margin:0 auto;"
              />
            </div>
            <p>Dear ${escapeHtml(candidate.first_name)},</p>
            <p>Congratulations, and welcome to <strong>TEENS SOFTWARE SOLUTIONS LLP</strong>!</p>
            <p>Your joining letter is attached to this email. Please review it and retain a copy for your records.</p>
            <p><strong>Date of Joining:</strong> ${escapeHtml(formattedJoiningDate)}</p>
            <p><strong>Probation Duration:</strong> ${escapeHtml(formattedProbation)}</p>
            <p>If you have questions about your joining arrangements, please contact the HR team.</p>
            <p>Regards,<br /><strong>HR Team</strong><br />TEENS SOFTWARE SOLUTIONS LLP<br />Hyderabad, Telangana, India</p>
          </div>
        `,
        attachments: [
          {
            filename: `Joining-Letter-${candidate.id}-v${version}.pdf`,
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
      console.error(
        "[Joining Letter] Resend returned an error:",
        emailError
      );

      return NextResponse.json(
        {
          error:
            "The joining letter was generated and saved, but the email outcome could not be confirmed. Check the Resend dashboard before retrying.",
          emailAccepted: false,
          document: documentRecord,
        },
        { status: 502 }
      );
    }

    // 16. Record that Resend accepted the email.
    const sentAt = new Date().toISOString();

    const { error: sendStatusError } = await auth.admin
      .from("joining_candidates")
      .update({
        joining_letter_send_status: "sent",
        joining_letter_email_provider_id: emailData.id,
      })
      .eq("id", candidate.id)
      .eq("joining_letter_send_status", "sending");

    if (sendStatusError) {
      console.error(
        "[Joining Letter] Email accepted, but send status update failed:",
        sendStatusError.message
      );

      return NextResponse.json(
        {
          error:
            "Resend accepted the email, but the send status update failed. Verify the email in Resend before taking further action.",
          emailAccepted: true,
          emailId: emailData.id,
          document: documentRecord,
        },
        { status: 500 }
      );
    }

    // 17. Update the document's delivery tracking.
    const { error: documentUpdateError } = await auth.admin
      .from("joining_documents")
      .update({
        sent_at: sentAt,
        email_provider_id: emailData.id,
      })
      .eq("id", documentRecord.id);

    if (documentUpdateError) {
      console.error(
        "[Joining Letter] Email accepted, but document tracking failed:",
        documentUpdateError.message
      );

      return NextResponse.json(
        {
          error:
            "Resend accepted the email, but document tracking failed. Verify the email in Resend before taking further action.",
          emailAccepted: true,
          emailId: emailData.id,
          document: documentRecord,
        },
        { status: 500 }
      );
    }

    // 18. Update candidate workflow status after email acceptance.
    const { data: updatedCandidate, error: candidateUpdateError } =
      await auth.admin
        .from("joining_candidates")
        .update({
          status: "joining_letter_sent",
          joining_letter_sent_at: sentAt,
        })
        .eq("id", candidate.id)
        .eq("status", "offer_accepted")
        .select("id")
        .maybeSingle();

    if (candidateUpdateError) {
      console.error(
        "[Joining Letter] Email accepted, but candidate update failed:",
        candidateUpdateError.message
      );

      return NextResponse.json(
        {
          error:
            "Resend accepted the email, but the candidate status update failed. Verify the candidate record before taking further action.",
          emailAccepted: true,
          emailId: emailData.id,
          document: documentRecord,
        },
        { status: 500 }
      );
    }

    if (!updatedCandidate) {
      console.error(
        "[Joining Letter] Email accepted, but candidate status was not updated.",
        candidate.id
      );

      return NextResponse.json(
        {
          error:
            "Resend accepted the email, but the candidate status changed before it could be updated. Verify the candidate record.",
          emailAccepted: true,
          emailId: emailData.id,
          document: documentRecord,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: `Joining letter sent to ${recipient}.`,
        emailAccepted: true,
        emailId: emailData.id,
        joining_date: joiningDate,
        probation_period_months: probationPeriodMonths,
        document: {
          ...documentRecord,
          sent_at: sentAt,
          email_provider_id: emailData.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "[Joining Letter] Generation or sending failed:",
      error
    );

    // Before an email attempt, a failure can be marked as failed.
    // After an email attempt begins, the provider outcome may be uncertain.
    if (sendClaimed && !emailAttempted && candidateId) {
      try {
        const admin = await createAdminClient();

        const { error: failureUpdateError } = await admin
          .from("joining_candidates")
          .update({
            joining_letter_send_status: "failed",
          })
          .eq("id", candidateId)
          .eq("joining_letter_send_status", "sending");

        if (failureUpdateError) {
          console.error(
            "[Joining Letter] Failed to record pre-email failure:",
            failureUpdateError.message
          );
        }
      } catch (failureTrackingError) {
        console.error(
          "[Joining Letter] Failure tracking threw an error:",
          failureTrackingError
        );
      }
    }

    // Clean up an uploaded PDF only when its database record was not saved.
    if (uploadedPublicId && !documentSaved) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: "raw",
          type: "authenticated",
        });
      } catch (cleanupError) {
        console.error(
          "[Joining Letter] Cloudinary cleanup failed:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error: emailAttempted
          ? "The email outcome may be uncertain. Check Resend before retrying."
          : "Failed to generate or prepare the joining letter.",
      },
      { status: 500 }
    );
  }
}