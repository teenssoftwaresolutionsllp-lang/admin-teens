import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-server";
import {
  decryptOnboardingSensitiveFields,
} from "@/lib/onboarding-encryption";
import {
  ONBOARDING_SESSION_COOKIE,
  verifyOnboardingSession,
} from "@/lib/joining-onboarding-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
};

type OnboardingSection = Record<string, unknown>;

type OnboardingData = {
  educationDetails?: OnboardingSection;
  previousEmploymentDetails?: OnboardingSection;
  identityDetails?: OnboardingSection;
  [key: string]: unknown;
};

type EmploymentRecord = {
  id: string;
  previousCompanyName: string;
  previousDesignation: string;
  employmentStartDate: string;
  employmentEndDate: string;
  referencePersonName: string;
  referencePersonDesignation: string;
  referenceContactNumber: string;
  referenceOfficialEmail: string;
};

function response(
  success: boolean,
  error: string | null,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success,
      ...(error ? { error } : {}),
      ...extra,
    },
    {
      status,
      headers: NO_CACHE_HEADERS,
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getText(
  value: Record<string, unknown>,
  key: string
): string {
  return typeof value[key] === "string"
    ? (value[key] as string).trim()
    : "";
}

function normalizeQualification(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function hasEducationValues(
  education: Record<string, unknown>,
  fields: string[]
): boolean {
  return fields.some((field) => {
    const value = education[field];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function getRequiredEducationDocuments(
  education: Record<string, unknown>
): string[] | null {
  const required = ["education_10th"];

  const hasNewEducationData = hasEducationValues(education, [
    "tenthSchoolName",
    "tenthBoard",
    "tenthYearOfPassing",
    "tenthResultType",
    "tenthResult",
    "tenthResultTotal",
    "twelfthInstitution",
    "twelfthBoard",
    "twelfthStream",
    "twelfthYearOfPassing",
    "twelfthResultType",
    "twelfthResult",
    "twelfthResultTotal",
    "diplomaInstitution",
    "diplomaAuthority",
    "diplomaCourse",
    "diplomaSpecialization",
    "diplomaYearOfPassing",
    "diplomaResultType",
    "diplomaResult",
    "diplomaResultTotal",
    "graduationInstitution",
    "graduationUniversity",
    "graduationCourse",
    "graduationSpecialization",
    "graduationYearOfPassing",
    "graduationResultType",
    "graduationResult",
    "graduationResultTotal",
    "postGraduationInstitution",
    "postGraduationUniversity",
    "postGraduationCourse",
    "postGraduationSpecialization",
    "postGraduationYearOfPassing",
    "postGraduationResultType",
    "postGraduationResult",
    "postGraduationResultTotal",
    "otherQualification",
    "otherInstitution",
    "otherAuthority",
    "otherYearOfPassing",
    "otherResultType",
    "otherResult",
    "otherResultTotal",
  ]);

  if (hasNewEducationData) {
    const has12th = hasEducationValues(education, [
      "twelfthInstitution",
      "twelfthBoard",
      "twelfthStream",
      "twelfthYearOfPassing",
      "twelfthResultType",
      "twelfthResult",
    ]);

    const hasDiploma = hasEducationValues(education, [
      "diplomaInstitution",
      "diplomaAuthority",
      "diplomaCourse",
      "diplomaSpecialization",
      "diplomaYearOfPassing",
      "diplomaResultType",
      "diplomaResult",
      "diplomaResultTotal",
    ]);

    const hasGraduation = hasEducationValues(education, [
      "graduationInstitution",
      "graduationUniversity",
      "graduationCourse",
      "graduationSpecialization",
      "graduationYearOfPassing",
      "graduationResultType",
      "graduationResult",
    ]);

    const hasPostGraduation = hasEducationValues(education, [
      "postGraduationInstitution",
      "postGraduationUniversity",
      "postGraduationCourse",
      "postGraduationSpecialization",
      "postGraduationYearOfPassing",
      "postGraduationResultType",
      "postGraduationResult",
    ]);

    const hasOther = hasEducationValues(education, [
      "otherQualification",
      "otherInstitution",
      "otherAuthority",
      "otherYearOfPassing",
      "otherResultType",
      "otherResult",
    ]);

    if (has12th || hasGraduation || hasPostGraduation) {
      required.push("education_12th");
    }

    if (hasDiploma) {
      required.push("education_diploma");
    }

    if (hasGraduation || hasPostGraduation) {
      required.push("education_graduation");
    }

    if (hasPostGraduation) {
      required.push("education_post_graduation");
    }

    if (hasOther) {
      required.push("education_other");
    }

    return required;
  }

  // Backward compatibility for drafts saved using the old form.
  const highestQualification =
    typeof education.highestQualification === "string"
      ? education.highestQualification
      : "";

  const value = normalizeQualification(highestQualification);

  if (!value) return null;

  const isOther =
    value === "other" ||
    value.includes("other qualification") ||
    value.includes("not listed");

  if (isOther) {
    required.push("education_other");
    return required;
  }

  const is10thOnly =
    value.includes("10th") ||
    value.includes("secondary") ||
    value.includes("matric");

  if (is10thOnly) {
    return required;
  }

  required.push("education_12th");

  const isPostgraduate =
    value.includes("post graduate") ||
    value.includes("postgraduate") ||
    value.includes("master") ||
    value.includes("mba") ||
    value.includes("mca") ||
    value.includes("m.tech") ||
    value.includes("mtech") ||
    value.includes("m.sc") ||
    value.includes("msc") ||
    value.includes("phd") ||
    value.includes("doctorate") ||
    value.includes("post graduation");

  if (isPostgraduate) {
    required.push("education_graduation");
    required.push("education_post_graduation");
    return required;
  }

  const isGraduation =
    value.includes("graduation") ||
    value.includes("graduate") ||
    value.includes("bachelor") ||
    value.includes("degree") ||
    value.includes("b.tech") ||
    value.includes("btech") ||
    value.includes("b.e.") ||
    value.includes("be ") ||
    value.includes("b.com") ||
    value.includes("bcom") ||
    value.includes("b.sc") ||
    value.includes("bsc") ||
    value.includes("bca") ||
    value.includes("bba");

  if (isGraduation) {
    required.push("education_graduation");
    return required;
  }

  const isDiplomaOrVocational =
    value.includes("diploma") ||
    value.includes("iti") ||
    value.includes("vocational");

  if (isDiplomaOrVocational) {
    required.push("education_other");
    return required;
  }

  return null;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}


function validateRequiredOnboardingFields(
  data: OnboardingData
): string | null {
  const personal = isRecord(data.personalDetails)
    ? data.personalDetails
    : {};

  const address = isRecord(data.addressDetails)
    ? data.addressDetails
    : {};

  const bank = isRecord(data.bankDetails)
    ? data.bankDetails
    : {};

  const identity = isRecord(data.identityDetails)
    ? data.identityDetails
    : {};

  const education = isRecord(data.educationDetails)
    ? data.educationDetails
    : {};

  // Date of birth and minimum age.
  const dateOfBirth = getText(personal, "dateOfBirth");

  if (!isValidDateOnly(dateOfBirth)) {
    return "Please enter a valid Date of Birth.";
  }

  const [birthYear, birthMonth, birthDay] = dateOfBirth
    .split("-")
    .map(Number);

  const indiaToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [todayYear, todayMonth, todayDay] = indiaToday
    .split("-")
    .map(Number);

  let age = todayYear - birthYear;

  if (
    todayMonth < birthMonth ||
    (todayMonth === birthMonth && todayDay < birthDay)
  ) {
    age--;
  }

  if (age < 18) {
    return "You must be at least 18 years old to submit onboarding.";
  }

  if (!getText(personal, "maritalStatus")) {
    return "Please select your Marital Status.";
  }

  // Temporary and permanent addresses.
  const requiredAddressFields = [
    ["Temporary Address", "temporaryAddress"],
    ["Temporary City", "temporaryCity"],
    ["Temporary State", "temporaryState"],
    ["Permanent Address", "permanentAddress"],
    ["Permanent City", "permanentCity"],
    ["Permanent State", "permanentState"],
  ] as const;

  for (const [label, key] of requiredAddressFields) {
    if (!getText(address, key)) {
      return `Please enter ${label}.`;
    }
  }

  if (!/^\d{6}$/.test(getText(address, "temporaryPincode"))) {
    return "Please enter a valid 6-digit Temporary Address Pincode.";
  }

  if (!/^\d{6}$/.test(getText(address, "permanentPincode"))) {
    return "Please enter a valid 6-digit Permanent Address Pincode.";
  }

  // Bank details.
  if (!getText(bank, "bankName")) {
    return "Please enter your Bank Name.";
  }

  if (!getText(bank, "bankAccountNumber")) {
    return "Please enter your Bank Account Number.";
  }

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(getText(bank, "bankIfsc").toUpperCase())) {
    return "Please enter a valid 11-character IFSC Code.";
  }

  // Aadhaar and PAN numbers.
  if (!/^\d{12}$/.test(getText(identity, "aadhaarNumber"))) {
    return "Please enter a valid 12-digit Aadhaar Number.";
  }

  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(getText(identity, "panNumber").toUpperCase())) {
    return "Please enter a valid PAN Number.";
  }

  // At least one complete emergency contact.
  const contacts = Array.isArray(data.emergencyContacts)
    ? data.emergencyContacts
    : [];

  const completeContacts = contacts.filter((contact) => {
    if (!isRecord(contact)) return false;

    return (
      getText(contact, "name") &&
      getText(contact, "relation") &&
      getText(contact, "phone")
    );
  });

  if (completeContacts.length === 0) {
    return "Please add at least one emergency contact with Name, Relationship and Phone.";
  }

  for (let index = 0; index < contacts.length; index++) {
    const contact = contacts[index];

    if (!isRecord(contact)) {
      return `Please check Emergency Contact ${index + 1}.`;
    }

    const name = getText(contact, "name");
    const relation = getText(contact, "relation");
    const phone = getText(contact, "phone");

    const hasAnyValue = name || relation || phone;

    if (!hasAnyValue) continue;

    if (!name || !relation || !phone) {
      return `Please complete Name, Relationship and Phone for Emergency Contact ${index + 1}.`;
    }

    const phoneDigits = phone.replace(/\D/g, "");

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return `Please enter a valid phone number for Emergency Contact ${index + 1}.`;
    }
  }

  // 10th standard is the minimum required education record.
  const tenthFields = [
    ["10th School Name", "tenthSchoolName"],
    ["10th Board", "tenthBoard"],
    ["10th Year of Passing", "tenthYearOfPassing"],
    ["10th Result Type", "tenthResultType"],
    ["10th Result", "tenthResult"],
    ["10th Total Marks / Scale", "tenthResultTotal"],
  ] as const;

  for (const [label, key] of tenthFields) {
    if (!getText(education, key)) {
      return `Please complete ${label}.`;
    }
  }

  if (!/^\d{4}$/.test(getText(education, "tenthYearOfPassing"))) {
    return "Please enter a valid 4-digit 10th Year of Passing.";
  }

  // A higher qualification may be left blank, but if started,
  // all its details must be completed.
  const qualificationGroups = [
    {
      label: "12th Standard",
      fields: [
        ["School / College Name", "twelfthInstitution"],
        ["Board", "twelfthBoard"],
        ["Stream", "twelfthStream"],
        ["Year of Passing", "twelfthYearOfPassing"],
        ["Result Type", "twelfthResultType"],
        ["Result", "twelfthResult"],
        ["Total Marks / Scale", "twelfthResultTotal"],
      ],
    },
    {
      label: "Diploma",
      fields: [
        ["Course", "diplomaCourse"],
        ["Board / Authority", "diplomaAuthority"],
        ["Institution Name", "diplomaInstitution"],
        ["Specialization", "diplomaSpecialization"],
        ["Year of Passing", "diplomaYearOfPassing"],
        ["Result Type", "diplomaResultType"],
        ["Result", "diplomaResult"],
        ["Total Marks / Scale", "diplomaResultTotal"],
      ],
    },
    {
      label: "UG (Undergraduate)",
      fields: [
        ["College Name", "graduationInstitution"],
        ["University", "graduationUniversity"],
        ["Degree / Course", "graduationCourse"],
        ["Specialization", "graduationSpecialization"],
        ["Year of Passing", "graduationYearOfPassing"],
        ["Result Type", "graduationResultType"],
        ["Result", "graduationResult"],
        ["Total Marks / Scale", "graduationResultTotal"],
      ],
    },
    {
      label: "PG (Postgraduate)",
      fields: [
        ["College Name", "postGraduationInstitution"],
        ["University", "postGraduationUniversity"],
        ["Degree / Course", "postGraduationCourse"],
        ["Specialization", "postGraduationSpecialization"],
        ["Year of Passing", "postGraduationYearOfPassing"],
        ["Result Type", "postGraduationResultType"],
        ["Result", "postGraduationResult"],
        ["Total Marks / Scale", "postGraduationResultTotal"],
      ],
    },
    {
      label: "Additional Qualifications / Certifications",
      fields: [
        ["Qualification Name", "otherQualification"],
        ["Institution Name", "otherInstitution"],
        ["Board / University / Authority", "otherAuthority"],
        ["Year of Passing", "otherYearOfPassing"],
        ["Result Type", "otherResultType"],
        ["Result", "otherResult"],
        ["Total Marks / Scale", "otherResultTotal"],
      ],
    },
  ] as const;

  for (const group of qualificationGroups) {
    const started = group.fields.some(([, key]) => getText(education, key));

    if (!started) continue;

    for (const [fieldLabel, key] of group.fields) {
      if (!getText(education, key)) {
        return `Please complete ${fieldLabel} in ${group.label}.`;
      }
    }

    const yearField = group.fields.find(
      ([fieldLabel]) => fieldLabel === "Year of Passing"
    );

    if (yearField && !/^\d{4}$/.test(getText(education, yearField[1]))) {
      return `Please enter a valid Year of Passing in ${group.label}.`;
    }
  }

  return null;
}

function validateEmploymentHistory(
  previousEmployment: Record<string, unknown>
): EmploymentRecord[] | null {
  const history = previousEmployment.employmentHistory;

  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  if (history.length > 20) {
    throw new Error(
      "You can provide details for a maximum of 20 previous employers."
    );
  }

  const seenIds = new Set<string>();

  const requiredFields: Array<{
    key: keyof Omit<EmploymentRecord, "id" | "referenceOfficialEmail">;
    label: string;
  }> = [
    {
      key: "previousCompanyName",
      label: "Previous company name",
    },
    {
      key: "previousDesignation",
      label: "Designation",
    },
    {
      key: "employmentStartDate",
      label: "Employment start date",
    },
    {
      key: "employmentEndDate",
      label: "Employment end date",
    },
    {
      key: "referencePersonName",
      label: "Reference person name",
    },
    {
      key: "referencePersonDesignation",
      label: "Reference person designation",
    },
    {
      key: "referenceContactNumber",
      label: "Reference contact number",
    },
  ];

  const records: EmploymentRecord[] = [];

  for (let index = 0; index < history.length; index++) {
    const item = history[index];
    const employerNumber = index + 1;

    if (!isRecord(item)) {
      throw new Error(
        `Invalid details for previous employer ${employerNumber}.`
      );
    }

    const id = getText(item, "id");

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      throw new Error(
        `Invalid record ID for previous employer ${employerNumber}. Please reload the form and try again.`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(
        "Duplicate previous employment records were found."
      );
    }

    seenIds.add(id);

    const record: EmploymentRecord = {
      id,
      previousCompanyName: getText(item, "previousCompanyName"),
      previousDesignation: getText(item, "previousDesignation"),
      employmentStartDate: getText(item, "employmentStartDate"),
      employmentEndDate: getText(item, "employmentEndDate"),
      referencePersonName: getText(item, "referencePersonName"),
      referencePersonDesignation: getText(
        item,
        "referencePersonDesignation"
      ),
      referenceContactNumber: getText(
        item,
        "referenceContactNumber"
      ),
      referenceOfficialEmail: getText(
        item,
        "referenceOfficialEmail"
      ),
    };

    for (const field of requiredFields) {
      if (!record[field.key]) {
        throw new Error(
          `${field.label} is required for previous employer ${employerNumber}.`
        );
      }
    }

    if (!isValidDateOnly(record.employmentStartDate)) {
      throw new Error(
        `Please provide a valid employment start date for previous employer ${employerNumber}.`
      );
    }

    if (!isValidDateOnly(record.employmentEndDate)) {
      throw new Error(
        `Please provide a valid employment end date for previous employer ${employerNumber}.`
      );
    }

    if (
      record.employmentEndDate < record.employmentStartDate
    ) {
      throw new Error(
        `Employment end date cannot be earlier than the start date for previous employer ${employerNumber}.`
      );
    }

    if (
      record.referenceOfficialEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        record.referenceOfficialEmail
      )
    ) {
      throw new Error(
        `Please provide a valid reference email for previous employer ${employerNumber}.`
      );
    }

    records.push(record);
  }

  return records;
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(
      ONBOARDING_SESSION_COOKIE
    )?.value;

    if (!sessionCookie) {
      return response(
        false,
        "Your onboarding session has expired. Please open your onboarding link again.",
        401
      );
    }

    const session = verifyOnboardingSession(sessionCookie);

    if (!session) {
      return response(
        false,
        "Your onboarding session is invalid. Please open your onboarding link again.",
        401
      );
    }

    if (
      !session.candidateId ||
      !session.submissionId ||
      !session.tokenId ||
      !session.expiresAt ||
      Date.parse(session.expiresAt) <= Date.now()
    ) {
      return response(
        false,
        "Your onboarding session has expired. Please contact HR.",
        401
      );
    }

    const admin = await createAdminClient();
    const now = new Date().toISOString();

    // 1. Revalidate the exact token associated with this session.
    const { data: token, error: tokenError } = await admin
      .from("joining_onboarding_tokens")
      .select("id, candidate_id, submission_id, expires_at")
      .eq("id", session.tokenId)
      .eq("candidate_id", session.candidateId)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .maybeSingle();

    if (tokenError) {
      console.error(
        "[Candidate Onboarding Submit] Token lookup failed:",
        tokenError
      );

      return response(
        false,
        "Unable to verify your onboarding link. Please try again.",
        500
      );
    }

    if (
      !token ||
      token.expires_at !== session.expiresAt ||
      token.submission_id !== session.submissionId
    ) {
      return response(
        false,
        "Your onboarding link is invalid or expired. Please contact HR.",
        401
      );
    }

    // 2. Revalidate candidate eligibility and current submission.
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select(`
        id,
        status,
        onboarding_verification_reopened_at,
        experience_level,
        total_experience_years,
        total_experience_months,
        onboarding_status,
        onboarding_submission_id,
        conversion_status,
        employee_record_id
      `)
      .eq("id", session.candidateId)
      .maybeSingle();

    if (candidateError) {
      console.error(
        "[Candidate Onboarding Submit] Candidate lookup failed:",
        candidateError
      );

      return response(
        false,
        "Unable to load your onboarding details.",
        500
      );
    }

    const isReopenedVerification =
      candidate?.status === "joining_letter_sent" &&
      Boolean(candidate.onboarding_verification_reopened_at);

    if (
      !candidate ||
      !(
        candidate.status === "offer_accepted" ||
        isReopenedVerification
      ) ||
      !["in_progress", "correction_required"].includes(
        candidate.onboarding_status
      ) ||
      candidate.onboarding_submission_id !== session.submissionId ||
      candidate.conversion_status === "processing" ||
      candidate.conversion_status === "completed" ||
      candidate.employee_record_id
    ) {
      return response(
        false,
        "This onboarding submission is no longer available.",
        409
      );
    }

    // 3. Load only the exact current draft.
    const { data: submission, error: submissionError } =
      await admin
        .from("joining_onboarding_submissions")
        .select("id, candidate_id, version, status, submission_data")
        .eq("id", session.submissionId)
        .eq("candidate_id", session.candidateId)
        .maybeSingle();

    if (submissionError) {
      console.error(
        "[Candidate Onboarding Submit] Submission lookup failed:",
        submissionError
      );

      return response(
        false,
        "Unable to load your saved onboarding form.",
        500
      );
    }

    if (!submission || submission.status !== "draft") {
      return response(
        false,
        "This onboarding submission is no longer editable.",
        409
      );
    }

    // 4. Decrypt saved data before validating it.
    let data: OnboardingData;

    try {
      const rawSubmissionData = isRecord(submission.submission_data)
        ? submission.submission_data
        : {};

      data = decryptOnboardingSensitiveFields(
        rawSubmissionData
      ) as OnboardingData;
    } catch (error) {
      console.error(
        "[Candidate Onboarding Submit] Decryption failed:",
        error
      );

      return response(
        false,
        "Unable to validate your saved information. Please contact HR.",
        500
      );
    }


    // 5. Validate all mandatory onboarding form fields.
    const requiredFieldsError =
      validateRequiredOnboardingFields(data);

    if (requiredFieldsError) {
      return response(false, requiredFieldsError, 400);
    }

    // 6. Validate education details.
    const educationDetails: OnboardingSection =
      isRecord(data.educationDetails)
        ? data.educationDetails
        : {};

    const educationDocuments =
      getRequiredEducationDocuments(educationDetails);

    if (!educationDocuments) {
      return response(
        false,
        "Please enter a clear highest qualification before submitting. For example: 10th, 12th, Graduation, Post Graduation, Diploma or Other.",
        400
      );
    }

    // 6. Determine whether the candidate is experienced.
    const experienceLevel = String(
        candidate.experience_level ?? ""
    )
        .trim()
        .toLowerCase();

    const experienceYears = Number(candidate.total_experience_years ?? 0);

    const experienceMonths = Number(candidate.total_experience_months ?? 0);

    console.log("[Onboarding Experience Check]", {
        candidateId: candidate.id,
        experienceLevel: candidate.experience_level,
        normalizedExperienceLevel: experienceLevel,
        experienceYears,
        experienceMonths,
    });

    const isExperienced = experienceLevel === "fresher" ? false : experienceLevel === "experienced" ? true : experienceYears > 0 || experienceMonths > 0;

    const employmentRecordIds: string[] = [];

    if (isExperienced) { 
        const previousEmployment = isRecord(data.previousEmploymentDetails) ? data.previousEmploymentDetails : {};

      // UAN is optional. Support old drafts where it was stored
      // under identityDetails.
      const identityDetails = isRecord(data.identityDetails)
        ? data.identityDetails
        : {};

      const uanNumber =
        getText(previousEmployment, "uanNumber") ||
        getText(identityDetails, "uanNumber");

      if (uanNumber && !/^\d{12}$/.test(uanNumber)) {
        return response(
          false,
          "UAN number must contain exactly 12 digits.",
          400
        );
      }

      let employmentHistory: EmploymentRecord[] | null;

      try {
        employmentHistory =
          validateEmploymentHistory(previousEmployment);
      } catch (error) {
        return response(
          false,
          error instanceof Error
            ? error.message
            : "Invalid previous employment details.",
          400
        );
      }

      if (!employmentHistory || employmentHistory.length === 0) {
        return response(
          false,
          "Please add at least one previous employer and complete its employment details.",
          400
        );
      }

      employmentRecordIds.push(
        ...employmentHistory.map((record) => record.id)
      );
    }

    // 7. Build the general required document list.
    // Experience and relieving documents are checked separately
    // for each employer by the database RPC.
    const requiredDocuments = [
      "aadhaar_card",
      "pan_card",
      "driving_license",
      "passport_photo",
      "bank_account_proof",
      ...educationDocuments,
    ];

    // 8. The four-argument database RPC checks all general documents
    // and both employment documents for every supplied employer ID.

    // 8. The database RPC validates general documents, all four
    // mandatory employment documents per employer, and latest-employer payslips.
    const { data: result, error: submitError } = await admin.rpc(
      "submit_candidate_onboarding",
      {
        p_candidate_id: candidate.id,
        p_submission_id: submission.id,
        p_token_id: session.tokenId,
        p_required_document_types: requiredDocuments,
        p_employment_record_ids: employmentRecordIds,
      }
    );

    if (submitError) {
      const message = submitError.message ?? "";

      console.error(
        "[Candidate Onboarding Submit] RPC failed:",
        submitError
      );

      if (message.includes("REQUIRED_DOCUMENT_MISSING:")) {
        const documentType = message.split(
          "REQUIRED_DOCUMENT_MISSING:"
        )[1]?.trim();

        return response(
          false,
          `Please upload the required document: ${documentType || "missing document"}.`,
          400
        );
      }

      if (message.includes("REQUIRED_DOCUMENT_INVALID:")) {
        const documentType = message.split(
          "REQUIRED_DOCUMENT_INVALID:"
        )[1]?.trim();

        return response(
          false,
          `Your latest ${documentType || "document"} upload requires correction. Please contact HR.`,
          400
        );
      }

      if (
        message.includes(
          "LATEST_EMPLOYER_REQUIRES_AT_LEAST_3_PAYSLIPS"
        )
      ) {
        return response(
          false,
          "Please upload at least 3 payslips for your most recent previous employer. You can upload up to 6.",
          400
        );
      }

      if (
        message.includes(
          "EMPLOYMENT_END_DATE_REQUIRED_FOR_PAYSLIP_VALIDATION"
        ) ||
        message.includes(
          "EMPLOYMENT_END_DATE_INVALID_FOR_PAYSLIP_VALIDATION"
        ) ||
        message.includes(
          "MOST_RECENT_EMPLOYER_DATE_AMBIGUOUS"
        ) ||
        message.includes(
          "MOST_RECENT_EMPLOYER_COULD_NOT_BE_DETERMINED"
        )
      ) {
        return response(
          false,
          "We could not determine your most recent employer from your employment end dates. Please check and correct the end dates for all previous employers.",
          400
        );
      }

      if (
        message.includes("EMPLOYMENT_DOCUMENT_MISSING:") ||
        message.includes("EMPLOYMENT_DOCUMENT_INVALID:")
      ) {
        const documentType = message.split(":").pop()?.trim() ?? "";

        const documentLabels: Record<string, string> = {
          experience_document: "Experience Letter / Certificate",
          relieving_letter: "Relieving Letter",
          previous_joining_letter: "Previous Company Joining Letter",
          salary_hike_letter: "Salary Hike / Increment Letter",
          payslip_1: "Payslip 1",
          payslip_2: "Payslip 2",
          payslip_3: "Payslip 3",
          payslip_4: "Payslip 4",
          payslip_5: "Payslip 5",
          payslip_6: "Payslip 6",
        };

        const documentLabel =
          documentLabels[documentType] || "employment document";

        return response(
          false,
          message.includes("EMPLOYMENT_DOCUMENT_INVALID:")
            ? `${documentLabel} requires correction. Please upload a corrected document.`
            : `Please upload the required ${documentLabel} for the corresponding previous employer.`,
          400
        );
      }

      if (
        message.includes("EMPLOYMENT_RECORD_INVALID:") ||
        message.includes("EMPLOYMENT_RECORDS_REQUIRED:")
      ) {
        return response(
          false,
          "Your previous employment details could not be verified. Please check each employer's details and try again.",
          400
        );
      }

      if (
        message.includes("CANDIDATE_NOT_ELIGIBLE") ||
        message.includes("SUBMISSION_NOT_EDITABLE")
      ) {
        return response(
          false,
          "This onboarding submission is no longer editable.",
          409
        );
      }

      if (
        message.includes("CANDIDATE_NOT_FOUND") ||
        message.includes("SUBMISSION_NOT_FOUND")
      ) {
        return response(
          false,
          "Your onboarding submission could not be found. Please contact HR.",
          404
        );
      }

      return response(
        false,
        "Unable to submit onboarding right now. Please try again or contact HR.",
        500
      );
    }

    return response(
      true,
      null,
      200,
      {
        message: "Your onboarding details have been submitted successfully.",
        submission: result,
      }
    );
  } catch (error) {
    console.error(
      "[Candidate Onboarding Submit] Unexpected error:",
      error
    );

    return response(
      false,
      "Unable to submit your onboarding details. Please try again.",
      500
    );
  }
}