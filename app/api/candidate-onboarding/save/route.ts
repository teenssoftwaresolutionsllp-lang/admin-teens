import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import {
  ONBOARDING_SESSION_COOKIE,
  verifyOnboardingSession,
} from "@/lib/joining-onboarding-session";
import { decryptOnboardingSensitiveFields,encryptOnboardingSensitiveFields } from "@/lib/onboarding-encryption";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_SIZE = 64 * 1024;

const SECTION_FIELDS = {
  personalDetails: {
    dateOfBirth: 10,
    bloodGroup: 10,
    maritalStatus: 30,
  },
  addressDetails: {
    permanentAddress: 500,
    permanentCity: 100,
    permanentState: 100,
    permanentPincode: 6,
    temporaryAddress: 500,
    temporaryCity: 100,
    temporaryState: 100,
    temporaryPincode: 6,
  },
  bankDetails: {
    bankName: 150,
    bankAccountNumber: 40,
    bankIfsc: 11,
  },
  identityDetails: {
    aadhaarNumber: 12,
    panNumber: 10,
    passportNumber: 20,
    drivingLicenseNumber: 30,
    // Legacy compatibility for drafts saved before UAN was moved.
    uanNumber: 12,
  },
  previousEmploymentDetails: {
    // UAN is optional and belongs to the candidate, not an employer.
    uanNumber: 12,

    // Legacy draft compatibility.
    previousCompanyName: 200,
    previousDesignation: 150,
    employmentStartDate: 10,
    employmentEndDate: 10,
    referencePersonName: 120,
    referencePersonDesignation: 150,
    referenceContactNumber: 20,
    referenceOfficialEmail: 254,
  },
  educationDetails: {
    // Legacy draft compatibility
    highestQualification: 100,
    course: 150,
    specialization: 150,
    institution: 200,
    university: 200,
    yearOfPassing: 4,
    percentageOrCgpa: 30,

    // 10th
    tenthSchoolName: 200,
    tenthBoard: 150,
    tenthYearOfPassing: 4,
    tenthResultType: 30,
    tenthResult: 30,
    tenthResultTotal: 30,

    // 12th
    twelfthInstitution: 200,
    twelfthBoard: 150,
    twelfthStream: 100,
    twelfthYearOfPassing: 4,
    twelfthResultType: 30,
    twelfthResult: 30,
    twelfthResultTotal: 30,

    // Graduation
    graduationInstitution: 200,
    graduationUniversity: 200,
    graduationCourse: 150,
    graduationSpecialization: 150,
    graduationYearOfPassing: 4,
    graduationResultType: 30,
    graduationResult: 30,
    graduationResultTotal: 30,

    // Post-graduation
    postGraduationInstitution: 200,
    postGraduationUniversity: 200,
    postGraduationCourse: 150,
    postGraduationSpecialization: 150,
    postGraduationYearOfPassing: 4,
    postGraduationResultType: 30,
    postGraduationResult: 30,
    postGraduationResultTotal: 30,

    // Other
    otherQualification: 150,
    otherInstitution: 200,
    otherAuthority: 200,
    otherYearOfPassing: 4,
    otherResultType: 30,
    otherResult: 30,
    otherResultTotal: 30,
  },
} as const;

type ObjectSection = keyof typeof SECTION_FIELDS;

type AllowedSection = ObjectSection | "emergencyContacts";

type JsonObject = Record<string, unknown>;

const ALLOWED_SECTIONS: readonly AllowedSection[] = [
  "personalDetails",
  "addressDetails",
  "bankDetails",
  "identityDetails",
  "previousEmploymentDetails",
  "educationDetails",
  "emergencyContacts",
];

const EMERGENCY_CONTACT_FIELDS = {
  name: 120,
  relation: 60,
  phone: 20,
} as const;

const EMPLOYMENT_HISTORY_FIELDS = {
  previousCompanyName: 200,
  previousDesignation: 150,
  employmentStartDate: 10,
  employmentEndDate: 10,
  referencePersonName: 120,
  referencePersonDesignation: 150,
  referenceContactNumber: 20,
  referenceOfficialEmail: 254,
} as const;

function fail(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, private",
        Pragma: "no-cache",
      },
    }
  );
}

function isRecord(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isRecord(value)) {
    const sortedKeys = Object.keys(value).sort();

    return `{${sortedKeys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify(value[key])}`
      )
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "undefined";
}

function isAllowedSection(
  value: string
): value is AllowedSection {
  return ALLOWED_SECTIONS.includes(value as AllowedSection);
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validateStringFields(
  value: unknown,
  allowedFields: Record<string, number>,
  sectionName: string
): JsonObject {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${sectionName} data.`);
  }

  const result: JsonObject = {};

  for (const [key, fieldValue] of Object.entries(value)) {
    const maxLength = allowedFields[key];

    if (maxLength === undefined) {
      throw new Error(
        `Unsupported field "${key}" in ${sectionName}.`
      );
    }

    if (
      typeof fieldValue !== "string" &&
      fieldValue !== null
    ) {
      throw new Error(
        `Invalid value supplied for ${key}.`
      );
    }

    const normalizedValue =
      typeof fieldValue === "string"
        ? fieldValue.trim()
        : "";

    if (normalizedValue.length > maxLength) {
      throw new Error(
        `${key} cannot exceed ${maxLength} characters.`
      );
    }

    result[key] = normalizedValue;
  }

  return result;
}

function validatePreviousEmploymentDetails(
  value: unknown
): JsonObject {
  if (!isRecord(value)) {
    throw new Error("Invalid previous employment details.");
  }

  // Validate UAN and legacy fields for older drafts.
  const allowedFields = {
    uanNumber: 12,
    previousCompanyName: 200,
    previousDesignation: 150,
    employmentStartDate: 10,
    employmentEndDate: 10,
    referencePersonName: 120,
    referencePersonDesignation: 150,
    referenceContactNumber: 20,
    referenceOfficialEmail: 254,
  };

  const result = validateStringFields(
    Object.fromEntries(
      Object.entries(value).filter(
        ([key]) => key !== "employmentHistory"
      )
    ),
    allowedFields,
    "previous employment details"
  );

  // UAN is optional, but if entered it must contain 12 digits.
  const uanNumber = result.uanNumber;

  if (
    typeof uanNumber === "string" &&
    uanNumber !== "" &&
    !/^\d{12}$/.test(uanNumber)
  ) {
    throw new Error("UAN must contain exactly 12 digits.");
  }

  // Allow older drafts that do not contain employmentHistory.
  if (!("employmentHistory" in value)) {
    return result;
  }

  const history = value.employmentHistory;

  if (!Array.isArray(history) || history.length > 20) {
    throw new Error(
      "You can add up to 20 previous employers."
    );
  }

  const seenIds = new Set<string>();

  const validatedHistory = history.map((item, index) => {
    const employerNumber = index + 1;

    if (!isRecord(item)) {
      throw new Error(
        `Invalid details for previous employer ${employerNumber}.`
      );
    }

    const id = item.id;

    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      throw new Error(
        `Invalid record ID for previous employer ${employerNumber}.`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(
        "Duplicate previous employment record found."
      );
    }

    seenIds.add(id);

    const employer = validateStringFields(
      Object.fromEntries(
        Object.entries(item).filter(
          ([key]) => key !== "id"
        )
      ),
      EMPLOYMENT_HISTORY_FIELDS,
      `previous employer ${employerNumber}`
    );

    const startDate = employer.employmentStartDate;
    const endDate = employer.employmentEndDate;
    const email = employer.referenceOfficialEmail;

    // Validate dates only when the candidate has entered them.
    if (
      typeof startDate === "string" &&
      startDate !== "" &&
      !isValidDateOnly(startDate)
    ) {
      throw new Error(
        `Invalid employment start date for previous employer ${employerNumber}.`
      );
    }

    if (
      typeof endDate === "string" &&
      endDate !== "" &&
      !isValidDateOnly(endDate)
    ) {
      throw new Error(
        `Invalid employment end date for previous employer ${employerNumber}.`
      );
    }

    if (
      typeof startDate === "string" &&
      startDate !== "" &&
      typeof endDate === "string" &&
      endDate !== "" &&
      endDate < startDate
    ) {
      throw new Error(
        `Employment end date cannot be before the start date for previous employer ${employerNumber}.`
      );
    }

    // Reference email is optional, but must be valid if entered.
    if (
      typeof email === "string" &&
      email !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error(
        `Invalid reference email for previous employer ${employerNumber}.`
      );
    }

    return {
      id,
      ...employer,
    };
  });

  result.employmentHistory = validatedHistory;

  return result;
}

function validateSection(
  section: AllowedSection,
  value: unknown
): unknown {
  if (section === "emergencyContacts") {
    if (
      !Array.isArray(value) ||
      value.length > 3
    ) {
      throw new Error(
        "You can provide up to three emergency contacts."
      );
    }

    return value.map((contact, index) =>
      validateStringFields(
        contact,
        EMERGENCY_CONTACT_FIELDS,
        `emergency contact ${index + 1}`
      )
    );
  }

  if (section === "previousEmploymentDetails") {
    return validatePreviousEmploymentDetails(value);
  }

  return validateStringFields(
    value,
    SECTION_FIELDS[section],
    section
  );
}

function mergeSection(
  existing: unknown,
  incoming: unknown,
  section: AllowedSection
): unknown {
  const validated = validateSection(section, incoming);

  if (section === "emergencyContacts") {
    return validated;
  }

  if (
    existing !== undefined &&
    existing !== null &&
    !isRecord(existing)
  ) {
    throw new Error(
      `Existing ${section} data has an invalid format.`
    );
  }

  return {
    ...(isRecord(existing) ? existing : {}),
    ...(validated as JsonObject),
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the candidate's signed session.
    const cookieValue = request.cookies.get(
      ONBOARDING_SESSION_COOKIE
    )?.value;

    const session = verifyOnboardingSession(cookieValue);

    if (!session) {
      return fail(
        "Your onboarding session has expired. Please reopen your onboarding link.",
        401
      );
    }

    // 2. Enforce request-size limits.
    const contentLength = Number(
      request.headers.get("content-length") || 0
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_BODY_SIZE
    ) {
      return fail("Your submitted form is too large.", 413);
    }

    const rawBody = await request.text();

    if (
      Buffer.byteLength(rawBody, "utf8") >
      MAX_BODY_SIZE
    ) {
      return fail("Your submitted form is too large.", 413);
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("Invalid form data.");
    }

    if (
      !isRecord(body) ||
      !isRecord(body.data) ||
      Object.keys(body).some((key) => key !== "data")
    ) {
      return fail("Invalid onboarding form data.");
    }

    const incomingData = body.data;
    const incomingSections = Object.keys(incomingData);

    if (
      incomingSections.length === 0 ||
      incomingSections.some(
        (section) => !isAllowedSection(section)
      )
    ) {
      return fail(
        "The form contains unsupported or protected fields."
      );
    }

    // 3. Create privileged database client.
    const admin = await createAdminClient();
    const now = new Date().toISOString();

    // 4. Revalidate the onboarding token.
    const { data: token, error: tokenError } = await admin
      .from("joining_onboarding_tokens")
      .select("id, candidate_id, expires_at, submission_id")
      .eq("id", session.tokenId)
      .eq("candidate_id", session.candidateId)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .maybeSingle();

    if (tokenError) {
      console.error(
        "[Candidate Onboarding Save] Token lookup failed:",
        tokenError
      );

      return fail(
        "Unable to verify your onboarding session.",
        500
      );
    }

    if (
        !token ||
        token.submission_id !== session.submissionId ||
        token.expires_at !== session.expiresAt
    ) {
        return fail(
            "Your onboarding link is no longer valid.",
            401
        );
    }

    // 5. Confirm candidate eligibility.
    const { data: candidate, error: candidateError } =
      await admin
        .from("joining_candidates")
        .select(`
          id,
          status,
          onboarding_verification_reopened_at,
          onboarding_status,
          onboarding_submission_id,
          conversion_status,
          employee_record_id
        `)
        .eq("id", session.candidateId)
        .maybeSingle();

    if (candidateError) {
      console.error(
        "[Candidate Onboarding Save] Candidate lookup failed:",
        candidateError
      );

      return fail(
        "Unable to verify your onboarding details.",
        500
      );
    }

    const isReopenedVerification =
        candidate?.status === "joining_letter_sent" &&
        Boolean(candidate.onboarding_verification_reopened_at);

    if (
    !candidate ||
    !(candidate.status === "offer_accepted" || isReopenedVerification) ||
    candidate.onboarding_status !== "in_progress" ||
    candidate.onboarding_submission_id !== session.submissionId ||
    candidate.conversion_status === "processing" ||
    candidate.conversion_status === "completed" ||
    candidate.employee_record_id
    ) {
    return fail("Your onboarding form is no longer editable.",403);
    }

        // 6. Load correction instructions for this exact submission.
    const {
      data: correctionEvent,
      error: correctionEventError,
    } = await admin
      .from("joining_onboarding_events")
      .select("id, event_details")
      .eq("candidate_id", candidate.id)
      .eq("submission_id", session.submissionId)
      .eq("event_type", "onboarding_corrections_requested")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (correctionEventError) {
      console.error(
        "[Candidate Onboarding Save] Correction event lookup failed:",
        correctionEventError
      );

      return fail(
        "Unable to verify your correction permissions.",
        500
      );
    }

    const correctionEventDetails =
      correctionEvent?.event_details as
        | Record<string, unknown>
        | null;

    const rawCorrectionItems =
      correctionEventDetails?.correction_items;

    const allowedCorrectionSections = new Set<string>();

    if (Array.isArray(rawCorrectionItems)) {
      for (const item of rawCorrectionItems) {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item)
        ) {
          continue;
        }

        const record = item as Record<string, unknown>;

        if (
          record.type === "section" &&
          typeof record.key === "string"
        ) {
          allowedCorrectionSections.add(record.key);
        }
      }
    }

    // Load the current candidate draft.
    const { data: submission, error: submissionError } =
      await admin
        .from("joining_onboarding_submissions")
        .select(`
          id,
          candidate_id,
          version,
          status,
          submission_data,
          updated_at
        `)
        .eq("id", session.submissionId)
        .eq("candidate_id", session.candidateId)
        .maybeSingle();

    if (submissionError) {
      console.error(
        "[Candidate Onboarding Save] Submission lookup failed:",
        submissionError
      );

      return fail(
        "Unable to load your onboarding form.",
        500
      );
    }

    if (
      !submission ||
      submission.status !== "draft" ||
      !isRecord(submission.submission_data)
    ) {
      return fail(
        "Your onboarding draft is no longer editable.",
        403
      );
    }

    // 7. Decrypt, validate, merge, and identify changed sections.
    let existingData: JsonObject;
    const mergedData: JsonObject = {};

    const SECTION_REVIEW_KEYS: Partial<
      Record<AllowedSection, string>
    > = {
      personalDetails: "personal",
      addressDetails: "address",
      bankDetails: "bank",
      identityDetails: "identity",
      educationDetails: "education",
      emergencyContacts: "emergency",
      previousEmploymentDetails: "employment",
    };

    const changedReviewKeys = new Set<string>();

    try {
      existingData = decryptOnboardingSensitiveFields(
        submission.submission_data
      );

      Object.assign(mergedData, existingData);

      for (const sectionName of incomingSections) {
        if (!isAllowedSection(sectionName)) {
          return fail("Unsupported onboarding section.");
        }

        const previousSection = mergedData[sectionName];

        const nextSection = mergeSection(
          previousSection,
          incomingData[sectionName],
          sectionName
        );

        if (
          stableStringify(previousSection) !==
          stableStringify(nextSection)
        ) {
          const reviewKey = SECTION_REVIEW_KEYS[sectionName];

          // During correction, only sections explicitly requested
          // by HR may be modified.
          if (
            correctionEvent &&
            (!reviewKey ||
              !allowedCorrectionSections.has(reviewKey))
          ) {
            return fail(
              `HR has not requested changes to ${sectionName}. This section is read-only.`,
              403
            );
          }

          if (reviewKey) {
            changedReviewKeys.add(reviewKey);
          }
        }

        mergedData[sectionName] = nextSection;
      }
    } catch (error) {
      console.error(
        "[Candidate Onboarding Save] Decryption or merge failed:",
        error
      );

      return fail(
        error instanceof Error
          ? error.message
          : "Unable to process your onboarding details."
      );
    }

    // 8. Encrypt sensitive values before database storage.
    let encryptedData: JsonObject;

    try {
      encryptedData =
        encryptOnboardingSensitiveFields(mergedData);
    } catch (error) {
      console.error(
        "[Candidate Onboarding Save] Encryption failed:",
        error
      );

      return fail(
        "Unable to securely save your sensitive information.",
        500
      );
    }

    // 9. Save with optimistic concurrency protection.
    let updateQuery = admin
      .from("joining_onboarding_submissions")
      .update({
        submission_data: encryptedData,
        updated_at: now,

        ...(changedReviewKeys.has("personal")
            ? {
                personal_verification_status: "pending",
                personal_verified_at: null,
                personal_verified_by: null,
                personal_review_notes: null,
                personal_correction_instructions: null,
            }
            : {}),

        ...(changedReviewKeys.has("address")
            ? {
                address_verification_status: "pending",
                address_verified_at: null,
                address_verified_by: null,
                address_review_notes: null,
                address_correction_instructions: null,
            }
            : {}),

        ...(changedReviewKeys.has("bank")
            ? {
                bank_verification_status: "pending",
                bank_verified_at: null,
                bank_verified_by: null,
                bank_review_notes: null,
                bank_correction_instructions: null,
            }
            : {}),

        ...(changedReviewKeys.has("identity")
            ? {
                identity_verification_status: "pending",
                identity_verified_at: null,
                identity_verified_by: null,
                identity_review_notes: null,
                identity_correction_instructions: null,
            }
            : {}),

        ...(changedReviewKeys.has("education")
            ? {
                education_verification_status: "pending",
                education_verified_at: null,
                education_verified_by: null,
                education_review_notes: null,
                education_correction_instructions: null,
            }
            : {}),

        ...(changedReviewKeys.has("emergency")
            ? {
                emergency_verification_status: "pending",
                emergency_verified_at: null,
                emergency_verified_by: null,
                emergency_review_notes: null,
                emergency_correction_instructions: null,
            }
            : {}),

        ...(changedReviewKeys.has("employment")
            ? {
                employment_verification_status: "pending",
                employment_verified_at: null,
                employment_verified_by: null,
                employment_review_notes: null,
                employment_correction_instructions: null,
            }
            : {}),
     })
      .eq("id", session.submissionId)
      .eq("candidate_id", session.candidateId)
      .eq("status", "draft");

    if (submission.updated_at) {
      updateQuery = updateQuery.eq(
        "updated_at",
        submission.updated_at
      );
    } else {
      updateQuery = updateQuery.is(
        "updated_at",
        null
      );
    }

    const { data: saved, error: saveError } =
      await updateQuery
        .select("id, version, updated_at")
        .maybeSingle();

    if (saveError) {
      console.error(
        "[Candidate Onboarding Save] Database update failed:",
        saveError
      );

      return fail(
        "Unable to save your onboarding details. Please try again.",
        500
      );
    }

    if (!saved) {
      return fail(
        "Your form was updated in another session. Reload your onboarding form before saving again.",
        409
      );
    }

    // 10. Record the save in the audit trail.
    const { error: eventError } = await admin
      .from("joining_onboarding_events")
      .insert({
        candidate_id: session.candidateId,
        submission_id: session.submissionId,
        actor_type: "candidate",
        actor_user_id: null,
        event_type: "onboarding_draft_saved",
        event_details: {
          submission_version: saved.version,
          updated_sections: incomingSections,
        },
      });

    if (eventError) {
      console.error(
        "[Candidate Onboarding Save] Audit event failed:",
        eventError
      );
    }

    // 11. Return confirmation only.
    return NextResponse.json(
      {
        success: true,
        message: "Your onboarding details have been saved.",
        submission: {
          id: saved.id,
          version: saved.version,
          updatedAt: saved.updated_at,
          status: "draft",
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, private",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error(
      "[Candidate Onboarding Save] Unexpected error:",
      error
    );

    return fail(
      "Unable to save your onboarding details. Please try again.",
      500
    );
  }
}