import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import { decryptOnboardingSensitiveFields } from "@/lib/onboarding-encryption";
import { getAvailableOfficialEmail, normalizeAccountName } from "@/lib/official-email";

export const dynamic = "force-dynamic";

function getAppBaseUrl() {
  const configuredUrl = process.env.APP_BASE_URL;

  if (!configuredUrl) {
    throw new Error("APP_BASE_URL is not configured.");
  }

  return configuredUrl.replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

type StatutoryDetails = {
  pf_eligible: boolean;
  uan_number: string | null;
  esi_healthcare_eligible: boolean;
  esi_number: string | null;
  pt_eligible: boolean;
  pt_number: string | null;
  tds_eligible: boolean;
};

type EmployeeEmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "intern";

class DuplicateEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateEmailError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validateActualJoiningDate(value: unknown): string {
  const date = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Please provide a valid actual joining date.");
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("The actual joining date is invalid.");
  }

  if (date > getTodayIST()) {
    throw new Error("The actual joining date cannot be in the future.");
  }

  return date;
}

function addMonths(dateString: string, months: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0)
  ).getUTCDate();

  return [
    targetYear,
    String(normalizedMonth + 1).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
}

function normalizeEmploymentType(
  value: unknown
): EmployeeEmploymentType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const employmentTypes: Record<
    string,
    EmployeeEmploymentType
  > = {
    full_time: "full-time",
    part_time: "part-time",
    contract: "contract",
    intern: "intern",
  };

  const result = employmentTypes[normalized];

  if (!result) {
    throw new Error(
      `The accepted offer contains an unsupported employment type: "${String(value ?? "")}".`
    );
  }

  return result;
}

async function getAuthorizedHr() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "Unauthorized",
      status: 401 as const,
    };
  }

  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      error: "Unable to verify HR access.",
      status: 500 as const,
    };
  }

  if (profile?.role !== "hr") {
    return {
      error: "HR access required.",
      status: 403 as const,
    };
  }

  return { admin, user };
}

function getStatutoryDetails(
  offerSnapshot: Record<string, unknown>,
  decryptedSubmission: Record<string, unknown>
): StatutoryDetails {
  const statutory = offerSnapshot.statutory;

  if (!isRecord(statutory)) {
    throw new Error(
      "The accepted offer does not contain valid statutory details."
    );
  }

  const pfEligible = statutory.pf_eligible;
  const esiEligible = statutory.esi_eligible;
  const ptEligible = statutory.pt_eligible;
  const tdsEligible = statutory.tds_eligible;

  if (
    typeof pfEligible !== "boolean" ||
    typeof esiEligible !== "boolean" ||
    typeof ptEligible !== "boolean" ||
    typeof tdsEligible !== "boolean"
  ) {
    throw new Error(
      "The accepted offer contains invalid statutory eligibility information."
    );
  }

  const previousEmployment = isRecord(
    decryptedSubmission.previousEmploymentDetails
  )
    ? decryptedSubmission.previousEmploymentDetails
    : {};

  const identityDetails = isRecord(
    decryptedSubmission.identityDetails
  )
    ? decryptedSubmission.identityDetails
    : {};

  const submittedUan = String(
    previousEmployment.uanNumber ??
      identityDetails.uanNumber ??
      ""
  ).trim();

  if (
    pfEligible &&
    submittedUan &&
    !/^\d{12}$/.test(submittedUan)
  ) {
    throw new Error(
      "The UAN number in the submitted onboarding details is invalid. Please correct the onboarding record before conversion."
    );
  }

  return {
    pf_eligible: pfEligible,
    uan_number:
      pfEligible && submittedUan ? submittedUan : null,

    esi_healthcare_eligible: esiEligible,
    esi_number: null,

    pt_eligible: ptEligible,
    pt_number: null,

    tds_eligible: tdsEligible,
  };
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const auth = await getAuthorizedHr();

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const { admin } = auth;
  const { id } = await context.params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    return NextResponse.json(
      { error: "Invalid candidate ID." },
      { status: 400 }
    );
  }

  let email: string;
  let requestedJoiningDate: string;

  try {
    const body = await request.json();

    requestedJoiningDate = validateActualJoiningDate(
      body?.actual_joining_date
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid request. Please provide a valid actual joining date.",
      },
      { status: 400 }
    );
  }

  try {
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (candidateError) throw candidateError;

    if (!candidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    // Return the linked employee if conversion is already complete.
    if (
      candidate.conversion_status === "completed" &&
      candidate.employee_record_id
    ) {
      const { data: existingEmployee, error } = await admin
        .from("employees")
        .select("id, employee_id, first_name, last_name, email")
        .eq("id", candidate.employee_record_id)
        .maybeSingle();

      if (error) throw error;

      if (!existingEmployee) {
        return NextResponse.json(
          { error: "The linked employee record no longer exists." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "This candidate has already been converted.",
        employee: existingEmployee,
        already_completed: true,
      });
    }

    if (candidate.status !== "joining_letter_sent") {
      return NextResponse.json(
        { error: "The candidate must have a sent joining letter." },
        { status: 409 }
      );
    }

    if (candidate.joining_letter_send_status !== "sent") {
      return NextResponse.json(
        { error: "The joining letter has not been confirmed as sent." },
        { status: 409 }
      );
    }

    if (!candidate.joining_date) {
      return NextResponse.json(
        { error: "The candidate's scheduled joining date is missing." },
        { status: 400 }
      );
    }

    if (
      ![0, 3, 6, 12].includes(
        Number(candidate.probation_period_months)
      )
    ) {
      return NextResponse.json(
        { error: "The candidate's probation duration is invalid." },
        { status: 400 }
      );
    }

    if (!candidate.accepted_offer_document_id) {
      return NextResponse.json(
        { error: "The accepted offer document is missing." },
        { status: 400 }
      );
    }

    if (!candidate.onboarding_submission_id) {
      return NextResponse.json(
        { error: "The submitted onboarding record is missing." },
        { status: 400 }
      );
    }

    // Atomically claim conversion to prevent concurrent processing.
    const { data: claimed, error: claimError } = await admin
      .from("joining_candidates")
      .update({
        conversion_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "joining_letter_sent")
      .eq("joining_letter_send_status", "sent")
      .in("conversion_status", ["not_started", "failed"])
      .is("employee_record_id", null)
      .select("*")
      .maybeSingle();

    if (claimError) throw claimError;

    if (!claimed) {
      const { data: latest, error } = await admin
        .from("joining_candidates")
        .select("conversion_status, employee_record_id")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (
        latest?.conversion_status === "completed" &&
        latest.employee_record_id
      ) {
        const { data: employee, error: employeeError } = await admin
          .from("employees")
          .select("id, employee_id, first_name, last_name, email")
          .eq("id", latest.employee_record_id)
          .maybeSingle();

        if (employeeError) throw employeeError;

        if (employee) {
          return NextResponse.json({
            success: true,
            message: "This candidate has already been converted.",
            employee,
            already_completed: true,
          });
        }
      }

      return NextResponse.json(
        {
          error:
            latest?.conversion_status === "processing"
              ? "Conversion is already in progress or requires reconciliation. Please contact HR administration."
              : latest?.employee_record_id
                ? "An employee is already linked to this candidate. Please contact HR administration."
                : "This candidate cannot be converted in the current state.",
        },
        { status: 409 }
      );
    }

    let employeeRecordId: string | null = null;
    let createdAuthUserId: string | null = null;

    try {
      // Verify the exact accepted offer document.
      const { data: acceptedOffer, error: acceptedOfferError } =
        await admin
          .from("joining_documents")
          .select(
            "id, candidate_id, document_type, version, sent_at, offer_snapshot"
          )
          .eq("id", claimed.accepted_offer_document_id)
          .eq("candidate_id", claimed.id)
          .eq("document_type", "offer_letter")
          .maybeSingle();

      if (acceptedOfferError) throw acceptedOfferError;

      if (!acceptedOffer) {
        throw new Error(
          "The accepted offer document could not be verified."
        );
      }

      if (!acceptedOffer.sent_at) {
        throw new Error(
          "The accepted offer has not been confirmed as sent."
        );
      }

      if (!isRecord(acceptedOffer.offer_snapshot)) {
        throw new Error(
          "The accepted offer does not contain a valid offer snapshot."
        );
      }

      const offerSnapshot = acceptedOffer.offer_snapshot;

      if (
        !isRecord(offerSnapshot.candidate) ||
        !isRecord(offerSnapshot.compensation) ||
        !isRecord(offerSnapshot.statutory)
      ) {
        throw new Error(
          "The accepted offer snapshot is incomplete. Please review the accepted offer before conversion."
        );
      }

      // Accepted offer is the authoritative source for employment terms.
      const offerCandidate = offerSnapshot.candidate;
      const offerCompensation = offerSnapshot.compensation;

      if (offerCandidate.id !== claimed.id) {
        throw new Error(
          "The accepted offer belongs to a different candidate."
        );
      }

      const firstName = String(
        offerCandidate.first_name ?? ""
      ).trim();

      const lastName = String(
        offerCandidate.last_name ?? ""
      ).trim();

      const designation = String(
        offerCandidate.designation ?? ""
      ).trim();

      const department = String(
        offerCandidate.department ?? ""
      ).trim();

      const employmentType = normalizeEmploymentType(
        offerCandidate.employment_type
      );

      const workLocation = String(
        offerCandidate.work_location ?? ""
      ).trim();

      const experienceLevel = String(
        offerCandidate.experience_level ?? "fresher"
      ).trim();

      const experienceYears = Number(
        offerCandidate.total_experience_years ?? 0
      );

      const experienceMonths = Number(
        offerCandidate.total_experience_months ?? 0
      );

      // Annual CTC is taken only from the accepted offer snapshot.
      const annualCtcInRupees = Number(
        offerCompensation.annualCtc
      );

      if (!firstName || !lastName || !designation) {
        throw new Error(
          "The accepted offer is missing the candidate's name or designation."
        );
      }

      // Generate the official email using the accepted offer name.
      email = await getAvailableOfficialEmail(
        admin,
        firstName,
        lastName
      );

      // Initial password: normalized first name followed by @12345.
      const normalizedFirstName = normalizeAccountName(firstName);

      if (!normalizedFirstName) {
        throw new Error(
          "Unable to generate the employee's initial password from the accepted name."
        );
      }

      const initialPassword = `${normalizedFirstName}@12345`;

      if (
        !Number.isFinite(annualCtcInRupees) ||
        annualCtcInRupees <= 0
      ) {
        throw new Error(
          "The accepted offer contains an invalid annual CTC."
        );
      }

      if (
        !Number.isFinite(experienceYears) ||
        !Number.isFinite(experienceMonths) ||
        experienceYears < 0 ||
        experienceMonths < 0 ||
        experienceMonths > 11
      ) {
        throw new Error(
          "The accepted offer contains invalid experience details."
        );
      }

      if (
        experienceLevel !== "fresher" &&
        experienceLevel !== "experienced"
      ) {
        throw new Error(
          "The accepted offer contains an invalid experience level."
        );
      }

      // Load the submitted onboarding record from the database.
      const { data: onboardingSubmission, error: onboardingError } =
        await admin
          .from("joining_onboarding_submissions")
          .select("id, candidate_id, status, submission_data")
          .eq("id", claimed.onboarding_submission_id)
          .eq("candidate_id", claimed.id)
          .maybeSingle();

      if (onboardingError) throw onboardingError;

      if (!onboardingSubmission) {
        throw new Error(
          "The submitted onboarding record could not be verified."
        );
      }

      if (onboardingSubmission.status !== "submitted") {
        throw new Error(
          "The candidate's onboarding submission is not in submitted status."
        );
      }

      if (!isRecord(onboardingSubmission.submission_data)) {
        throw new Error(
          "The submitted onboarding data is missing or invalid."
        );
      }

      // Decrypt sensitive onboarding values on the server.
      let decryptedSubmission: Record<string, unknown>;

      try {
        decryptedSubmission = decryptOnboardingSensitiveFields(
          onboardingSubmission.submission_data
        );
      } catch {
        throw new Error(
          "Unable to decrypt the submitted onboarding details. Please review the onboarding record before conversion."
        );
      }

      const statutoryDetails = getStatutoryDetails(
        offerSnapshot,
        decryptedSubmission
      );

      // Resolve department using the accepted offer snapshot.
      let departmentId: string | null = null;

      if (department) {
        const departmentAliases: Record<string, string> = {
          "human resources": "HR",
        };

        const normalizedDepartment =
          departmentAliases[department.toLowerCase()] ??
          department;

        const { data: departments, error } = await admin
          .from("departments")
          .select("id, name")
          .ilike("name", normalizedDepartment)
          .limit(2);

        if (error) throw error;

        if ((departments ?? []).length > 1) {
          throw new Error(
            `Multiple departments match "${normalizedDepartment}".`
          );
        }

        departmentId = departments?.[0]?.id ?? null;

        if (!departmentId) {
          throw new Error(
            `Department "${normalizedDepartment}" was not found.`
          );
        }
      }

      // HR-confirmed actual joining date.
      // The candidate's original scheduled date remains unchanged.
      const joiningDate = requestedJoiningDate;

      // Probation duration is retained from the joining candidate.
      const probationMonths = Number(
        claimed.probation_period_months
      );

      const probationEndDate =
        probationMonths > 0
          ? addMonths(joiningDate, probationMonths)
          : null;

      // employees.salary stores annual CTC in lakhs.
      const annualCtcInLakhs =
        annualCtcInRupees / 100000;

      // Create the employee Auth account with the generated initial password.
      // The employee must change this password after first login.
      const { data: authData, error: authCreateError } =
        await admin.auth.admin.createUser({
          email,
          password: initialPassword,
          email_confirm: true,
          user_metadata: {
            full_name: `${firstName} ${lastName}`.trim(),
            role: "employee",
            must_change_password: true,
          },
        });

      if (authCreateError) {
        if (
          authCreateError.message.toLowerCase().includes("already") ||
          authCreateError.message.toLowerCase().includes("exists")
        ) {
          throw new DuplicateEmailError(
            `The generated email ${email} was registered during conversion. Please retry the conversion.`
          );
        }

        throw new Error(
          `Unable to create the employee login: ${authCreateError.message}`
        );
      }

      const authUser = authData.user;

      if (!authUser) {
        throw new Error(
          "Unable to create the employee login."
        );
      }

      createdAuthUserId = authUser.id;

      const fullName = `${firstName} ${lastName}`.trim();

      const { error: profileError } = await admin
        .from("profiles")
        .upsert({
          id: authUser.id,
          email,
          full_name: fullName,
          role: "employee",
          must_change_password: true,
        });

      if (profileError) throw profileError;

      // Create employee record.
      // DataStore generates the next employee ID.

      const personalDetails = isRecord(decryptedSubmission.personalDetails)
        ? decryptedSubmission.personalDetails
        : {};

      const addressDetails = isRecord(decryptedSubmission.addressDetails)
        ? decryptedSubmission.addressDetails
        : {};

      const bankDetails = isRecord(decryptedSubmission.bankDetails)
        ? decryptedSubmission.bankDetails
        : {};

      const identityDetails = isRecord(decryptedSubmission.identityDetails)
        ? decryptedSubmission.identityDetails
        : {};

      const readOnboardingText = (
        section: Record<string, unknown>,
        key: string
      ): string | null => {
        const value = section[key];
        return typeof value === "string" && value.trim()
          ? value.trim()
          : null;
      };

      const emergencyContacts = Array.isArray(decryptedSubmission.emergencyContacts)
        ? decryptedSubmission.emergencyContacts
            .slice(0, 3)
            .map((contact) => isRecord(contact) ? contact : {})
        : [];

      const contact1 = emergencyContacts[0] ?? {};
      const contact2 = emergencyContacts[1] ?? {};
      const contact3 = emergencyContacts[2] ?? {};

      const employee = await DataStore.createEmployee({
        user_id: authUser.id,
        shift_type: "general",
        first_name: firstName,
        last_name: lastName,
        email,
        phone: claimed.mobile_number,
        gender: claimed.gender || null,
        department_id: departmentId,
        designation,
        employment_type: employmentType,
        joining_date: joiningDate,
        probation_duration: probationMonths,
        probation_end_date: probationEndDate,
        appointment_date: joiningDate,
        work_location: workLocation || null,
        salary: annualCtcInLakhs,
        experience_level: experienceLevel,
        total_experience_years: experienceYears,
        total_experience_months: experienceMonths,
        status: "active",

        // Personal information from submitted onboarding
        date_of_birth: readOnboardingText(personalDetails, "dateOfBirth"),
        blood_group: readOnboardingText(personalDetails, "bloodGroup"),
        marital_status: readOnboardingText(personalDetails, "maritalStatus"),

        // Permanent and temporary addresses
        permanent_address: readOnboardingText(addressDetails, "permanentAddress"),
        permanent_city: readOnboardingText(addressDetails, "permanentCity"),
        permanent_state: readOnboardingText(addressDetails, "permanentState"),
        permanent_pincode: readOnboardingText(addressDetails, "permanentPincode"),

        temporary_address: readOnboardingText(addressDetails, "temporaryAddress"),
        temporary_city: readOnboardingText(addressDetails, "temporaryCity"),
        temporary_state: readOnboardingText(addressDetails, "temporaryState"),
        temporary_pincode: readOnboardingText(addressDetails, "temporaryPincode"),

        // Bank details
        bank_name: readOnboardingText(bankDetails, "bankName"),
        bank_account_number: readOnboardingText(bankDetails, "bankAccountNumber"),
        ifsc_code: readOnboardingText(bankDetails, "bankIfsc"),

        // Identity details
        pan_number: readOnboardingText(identityDetails, "panNumber"),
        aadhar_number: readOnboardingText(identityDetails, "aadhaarNumber"),
        passport_number: readOnboardingText(identityDetails, "passportNumber"),
        driving_license_number: readOnboardingText(identityDetails,"drivingLicenseNumber"),

        // UAN remains governed by the existing statutory extraction
        uan_number: statutoryDetails.uan_number,

        // Emergency contact 1
        emergency_contact_name: readOnboardingText(contact1, "name"),
        emergency_contact_relation: readOnboardingText(contact1, "relation"),
        emergency_contact_phone: readOnboardingText(contact1, "phone"),

        // Emergency contact 2
        emergency_contact_name_2: readOnboardingText(contact2, "name"),
        emergency_contact_relation_2: readOnboardingText(contact2, "relation"),
        emergency_contact_phone_2: readOnboardingText(contact2, "phone"),

        // Emergency contact 3
        emergency_contact_name_3: readOnboardingText(contact3, "name"),
        emergency_contact_relation_3: readOnboardingText(contact3, "relation"),
        emergency_contact_phone_3: readOnboardingText(contact3, "phone"),

      } as Parameters<typeof DataStore.createEmployee>[0]);

      if (!employee?.id || !employee?.employee_id) {
        throw new Error(
          "Employee creation did not return a valid employee record and ID."
        );
      }

      employeeRecordId = employee.id;


      // =============================================
      // Transfer submitted education into employee_education
      // =============================================

      const educationDetails = isRecord(decryptedSubmission.educationDetails)
        ? decryptedSubmission.educationDetails
        : {};

      const normalizeResultType = (
        value: string | null
      ): "Percentage" | "CGPA" | "Grade" | null => {
        if (!value) return null;

        const normalized = value.trim().toLowerCase();

        if (normalized === "percentage") return "Percentage";
        if (normalized === "cgpa") return "CGPA";
        if (normalized === "grade") return "Grade";

        return null;
      };

      const educationDefinitions = [
        {
          key: "tenth",
          type: "10th",
          name: "10th Standard",
          institution: "tenthSchoolName",
          board: "tenthBoard",
          university: null,
          stream: null,
          course: null,
          specialization: null,
          year: "tenthYearOfPassing",
          resultType: "tenthResultType",
          result: "tenthResult",
          total: "tenthResultTotal",
        },
        {
          key: "twelfth",
          type: "12th",
          name: "12th Standard",
          institution: "twelfthInstitution",
          board: "twelfthBoard",
          university: null,
          stream: "twelfthStream",
          course: null,
          specialization: null,
          year: "twelfthYearOfPassing",
          resultType: "twelfthResultType",
          result: "twelfthResult",
          total: "twelfthResultTotal",
        },
        {
          key: "graduation",
          type: "Graduation",
          name: "Graduation",
          institution: "graduationInstitution",
          board: null,
          university: "graduationUniversity",
          stream: null,
          course: "graduationCourse",
          specialization: "graduationSpecialization",
          year: "graduationYearOfPassing",
          resultType: "graduationResultType",
          result: "graduationResult",
          total: "graduationResultTotal",
        },
        {
          key: "post_graduation",
          type: "Post Graduation",
          name: "Post Graduation",
          institution: "postGraduationInstitution",
          board: null,
          university: "postGraduationUniversity",
          stream: null,
          course: "postGraduationCourse",
          specialization: "postGraduationSpecialization",
          year: "postGraduationYearOfPassing",
          resultType: "postGraduationResultType",
          result: "postGraduationResult",
          total: "postGraduationResultTotal",
        },
        {
          key: "other",
          type: "Other",
          name: "Other Qualification",
          institution: "otherInstitution",
          board: "otherAuthority",
          university: null,
          stream: null,
          course: "otherQualification",
          specialization: null,
          year: "otherYearOfPassing",
          resultType: "otherResultType",
          result: "otherResult",
          total: "otherResultTotal",
        },
      ] as const;

      const educationRows = educationDefinitions
        .map((definition) => {
          const getValue = (key: string | null) =>
            key ? readOnboardingText(educationDetails, key) : null;

          const institutionName = getValue(definition.institution);
          const qualificationName =
            definition.key === "other"
              ? getValue("otherQualification") || definition.name
              : definition.name;

          const row = {
            employee_id: employee.id,
            source_submission_id: claimed.onboarding_submission_id,
            source_qualification_key: definition.key,
            qualification_type: definition.type,
            qualification_name: qualificationName,
            course: getValue(definition.course),
            specialization: getValue(definition.specialization),
            institution_name: institutionName,
            board: getValue(definition.board),
            university: getValue(definition.university),
            stream: getValue(definition.stream),
            year_of_passing: getValue(definition.year),
            result_type: normalizeResultType(getValue(definition.resultType)),
            result_value: getValue(definition.result),
            result_total: getValue(definition.total),
          };

          const hasData = [
            row.course,
            row.specialization,
            row.institution_name,
            row.board,
            row.university,
            row.stream,
            row.year_of_passing,
            row.result_value,
            row.result_total,
          ].some(Boolean);

          return hasData ? row : null;
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      // Support older submissions using the generic education fields.
      if (educationRows.length === 0) {
        const highestQualification = readOnboardingText(
          educationDetails,
          "highestQualification"
        );

        const genericInstitution = readOnboardingText(
          educationDetails,
          "institution"
        );

        const genericCourse = readOnboardingText(
          educationDetails,
          "course"
        );

        if (highestQualification || genericInstitution || genericCourse) {
          educationRows.push({
            employee_id: employee.id,
            source_submission_id: claimed.onboarding_submission_id,
            source_qualification_key: "other",
            qualification_type: "Other",
            qualification_name: highestQualification || "Other Qualification",
            course: genericCourse,
            specialization: readOnboardingText(educationDetails, "specialization"),
            institution_name: genericInstitution,
            board: null,
            university: readOnboardingText(educationDetails, "university"),
            stream: null,
            year_of_passing: readOnboardingText(
              educationDetails,
              "yearOfPassing"
            ),
            result_type: normalizeResultType(
              readOnboardingText(educationDetails, "resultType")
            ),
            result_value: readOnboardingText(
              educationDetails,
              "percentageOrCgpa"
            ),
            result_total: null,
          });
        }
      }

      if (educationRows.length > 0) {
        const { error: educationTransferError } = await admin
          .from("employee_education")
          .upsert(educationRows, {
            onConflict:
              "employee_id,source_submission_id,source_qualification_key",
          });

        if (educationTransferError) {
          throw new Error(
            `Employee created, but education transfer failed: ${educationTransferError.message}`
          );
        }
      }

      // =============================================
      // Transfer previous employment into employee_previous_employment
      // =============================================

      const previousEmploymentDetails = isRecord(
        decryptedSubmission.previousEmploymentDetails
      )
        ? decryptedSubmission.previousEmploymentDetails
        : {};

      const rawEmploymentHistory = previousEmploymentDetails.employmentHistory;

      const employmentRows: Array<{
        employee_id: string;
        source_submission_id: string;
        source_employment_record_id: string;
        company_name: string;
        designation: string;
        employment_start_date: string | null;
        employment_end_date: string | null;
        reference_person_name: string | null;
        reference_person_designation: string | null;
        reference_contact_number: string | null;
        reference_official_email: string | null;
      }> = [];

      if (Array.isArray(rawEmploymentHistory)) {
        for (const item of rawEmploymentHistory) {
          if (!isRecord(item)) continue;

          const companyName = readOnboardingText(
            item,
            "previousCompanyName"
          );

          const designation = readOnboardingText(
            item,
            "previousDesignation"
          );

          // Ignore an unused empty employer entry.
          if (!companyName && !designation) continue;

          if (!companyName || !designation) {
            throw new Error(
              "Previous employment transfer failed: company name or designation is missing."
            );
          }

          const sourceEmploymentId = readOnboardingText(item, "id");

          if (
            !sourceEmploymentId ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              sourceEmploymentId
            )
          ) {
            throw new Error(
              `Previous employment transfer failed: invalid employer record ID for ${companyName}.`
            );
          }

          employmentRows.push({
            employee_id: employee.id,
            source_submission_id: claimed.onboarding_submission_id,
            source_employment_record_id: sourceEmploymentId,
            company_name: companyName,
            designation,
            employment_start_date: readOnboardingText(
              item,
              "employmentStartDate"
            ),
            employment_end_date: readOnboardingText(
              item,
              "employmentEndDate"
            ),
            reference_person_name: readOnboardingText(
              item,
              "referencePersonName"
            ),
            reference_person_designation: readOnboardingText(
              item,
              "referencePersonDesignation"
            ),
            reference_contact_number: readOnboardingText(
              item,
              "referenceContactNumber"
            ),
            reference_official_email: readOnboardingText(
              item,
              "referenceOfficialEmail"
            ),
          });
        }
      } else {
        // Backward compatibility with older single-employer submissions.
        const legacyCompany = readOnboardingText(
          previousEmploymentDetails,
          "previousCompanyName"
        );

        const legacyDesignation = readOnboardingText(
          previousEmploymentDetails,
          "previousDesignation"
        );

        if (legacyCompany || legacyDesignation) {
          if (!legacyCompany || !legacyDesignation) {
            throw new Error(
              "Previous employment transfer failed: legacy company name or designation is missing."
            );
          }

          employmentRows.push({
            employee_id: employee.id,
            source_submission_id: claimed.onboarding_submission_id,
            source_employment_record_id: claimed.id,
            company_name: legacyCompany,
            designation: legacyDesignation,
            employment_start_date: readOnboardingText(
              previousEmploymentDetails,
              "employmentStartDate"
            ),
            employment_end_date: readOnboardingText(
              previousEmploymentDetails,
              "employmentEndDate"
            ),
            reference_person_name: readOnboardingText(
              previousEmploymentDetails,
              "referencePersonName"
            ),
            reference_person_designation: readOnboardingText(
              previousEmploymentDetails,
              "referencePersonDesignation"
            ),
            reference_contact_number: readOnboardingText(
              previousEmploymentDetails,
              "referenceContactNumber"
            ),
            reference_official_email: readOnboardingText(
              previousEmploymentDetails,
              "referenceOfficialEmail"
            ),
          });
        }
      }

      if (employmentRows.length > 0) {
        const { error: employmentTransferError } = await admin
          .from("employee_previous_employment")
          .upsert(employmentRows, {
            onConflict:
              "employee_id,source_submission_id,source_employment_record_id",
          });

        if (employmentTransferError) {
          throw new Error(
            `Employee created, but previous employment transfer failed: ${employmentTransferError.message}`
          );
        }
      }



      // Save statutory details from the accepted offer and onboarding.
      const { error: statutoryUpdateError } = await admin
        .from("employees")
        .update({
          pf_eligible: statutoryDetails.pf_eligible,
          uan_number: statutoryDetails.uan_number,
          esi_healthcare_eligible:
            statutoryDetails.esi_healthcare_eligible,
          esi_number: statutoryDetails.esi_number,
          pt_eligible: statutoryDetails.pt_eligible,
          pt_number: statutoryDetails.pt_number,
          tds_eligible: statutoryDetails.tds_eligible,
        })
        .eq("id", employee.id);

      if (statutoryUpdateError) {
        throw new Error(
          `Employee was created, but statutory details could not be saved: ${statutoryUpdateError.message}`
        );
      }

      // Register the exact accepted offer and latest relevant documents.
      const {
        data: joiningDocuments,
        error: joiningDocumentsError,
      } = await admin
        .from("joining_documents")
        .select("id, document_type, version")
        .eq("candidate_id", claimed.id)
        .in("document_type", [
          "joining_letter",
          "resume",
          "experience_document",
        ])
        .order("version", { ascending: false });

      if (joiningDocumentsError) {
        throw new Error(
          `Unable to fetch joining documents: ${joiningDocumentsError.message}`
        );
      }

      const latestDocuments = new Map<
        string,
        { id: string; document_type: string }
      >();

      for (const document of joiningDocuments ?? []) {
        if (!latestDocuments.has(document.document_type)) {
          latestDocuments.set(document.document_type, {
            id: document.id,
            document_type: document.document_type,
          });
        }
      }

      // Never substitute a newer offer revision for the accepted offer.
      latestDocuments.set("offer_letter", {
        id: acceptedOffer.id,
        document_type: "offer_letter",
      });

      const documentTypeMap: Record<
        string,
        { document_type: string; document_name: string }
      > = {
        offer_letter: {
          document_type: "Offer Letter",
          document_name: "Offer Letter.pdf",
        },
        joining_letter: {
          document_type: "Joining Letter",
          document_name: "Joining Letter.pdf",
        },
        resume: {
          document_type: "Resume",
          document_name: "Resume",
        },
        experience_document: {
          document_type: "Experience Letter",
          document_name: "Experience Letter",
        },
      };

      for (const document of latestDocuments.values()) {
        const mappedDocument =
          documentTypeMap[document.document_type];

        if (!mappedDocument) continue;

        const { data: existingDocument, error: existingError } =
          await admin
            .from("employee_documents")
            .select("id")
            .eq("source_joining_document_id", document.id)
            .maybeSingle();

        if (existingError) {
          throw new Error(
            `Unable to check existing employee document: ${existingError.message}`
          );
        }

        if (existingDocument) continue;

        const { error: insertError } = await admin
          .from("employee_documents")
          .insert({
            employee_id: employee.id,
            document_type: mappedDocument.document_type,
            document_name: mappedDocument.document_name,
            document_url: `joining-document://${document.id}`,
            source_joining_document_id: document.id,
            verification_status: "approved",
          });

        if (insertError && insertError.code !== "23505") {
          throw new Error(
            `Unable to register ${mappedDocument.document_type}: ${insertError.message}`
          );
        }
      }



      // =============================================
      // Transfer all onboarding documents and versions
      // =============================================

      // Load the complete submission history, starting from
      // the exact submission used for employee conversion.
      const { data: submissionHistory, error: historyError } =
        await admin
          .from("joining_onboarding_submissions")
          .select("id, supersedes_submission_id")
          .eq("candidate_id", claimed.id);

      if (historyError) {
        throw new Error(
          `Unable to load onboarding submission history: ${historyError.message}`
        );
      }

      const submissionMap = new Map(
        (submissionHistory ?? []).map((submission) => [
          submission.id,
          submission.supersedes_submission_id,
        ])
      );

      const submissionIds: string[] = [];
      const visitedSubmissions = new Set<string>();

      let currentSubmissionId: string | null =
        claimed.onboarding_submission_id;

      while (currentSubmissionId) {
        if (visitedSubmissions.has(currentSubmissionId)) {
          throw new Error(
            "Invalid onboarding history: a submission cycle was detected."
          );
        }

        if (!submissionMap.has(currentSubmissionId)) {
          throw new Error(
            "Unable to verify the complete onboarding submission history."
          );
        }

        visitedSubmissions.add(currentSubmissionId);
        submissionIds.push(currentSubmissionId);

        currentSubmissionId =
          submissionMap.get(currentSubmissionId) ?? null;
      }

      if (!submissionIds.length) {
        throw new Error(
          "No onboarding submission history was found."
        );
      }

      // Fetch every document version from the verified history.
      const { data: onboardingDocuments, error: onboardingDocumentsError } =
        await admin
          .from("joining_onboarding_documents")
          .select(`
            id,
            candidate_id,
            submission_id,
            document_type,
            version,
            original_file_name,
            storage_path,
            mime_type,
            file_size_bytes,
            sha256_hash,
            verification_status,
            uploaded_at,
            reviewed_at,
            reviewed_by,
            review_reason,
            employment_record_id
          `)
          .eq("candidate_id", claimed.id)
          .in("submission_id", submissionIds)
          .order("uploaded_at", { ascending: true });

      if (onboardingDocumentsError) {
        throw new Error(
          `Unable to fetch onboarding documents: ${onboardingDocumentsError.message}`
        );
      }

      const documentTypeLabels: Record<string, string> = {
        aadhaar_card: "Aadhaar Card",
        pan_card: "PAN Card",
        passport_photo: "Passport Photo",
        driving_license: "Driving Licence",
        bank_account_proof: "Bank Account Proof",
        education_10th: "10th Education Certificate",
        education_12th: "12th Education Certificate",
        education_graduation: "Graduation Certificate",
        education_post_graduation: "Post Graduation Certificate",
        experience_document: "Experience Document",
        previous_joining_letter: "Previous Joining Letter",
        relieving_letter: "Relieving Letter",
        payslip_1: "Payslip 1",
        payslip_2: "Payslip 2",
        payslip_3: "Payslip 3",
        payslip_4: "Payslip 4",
        salary_hike_letter: "Salary Hike Letter",
        appraisal_letter: "Appraisal Letter",
      };

      const allowedDocumentStatuses = new Set([
        "pending",
        "approved",
        "rejected",
        "resubmission_required",
      ]);

      for (const sourceDocument of onboardingDocuments ?? []) {
        if (!sourceDocument.storage_path) {
          throw new Error(
            `Onboarding document ${sourceDocument.id} has no Cloudinary storage path.`
          );
        }

        if (!sourceDocument.original_file_name) {
          throw new Error(
            `Onboarding document ${sourceDocument.id} has no original filename.`
          );
        }

        if (
          !allowedDocumentStatuses.has(
            sourceDocument.verification_status
          )
        ) {
          throw new Error(
            `Onboarding document ${sourceDocument.id} has an unsupported verification status.`
          );
        }

        const { data: existingOnboardingDocument, error: existingDocumentError } =
          await admin
            .from("employee_documents")
            .select("id")
            .eq(
              "source_onboarding_document_id",
              sourceDocument.id
            )
            .maybeSingle();

        if (existingDocumentError) {
          throw new Error(
            `Unable to check transferred onboarding document: ${existingDocumentError.message}`
          );
        }

        // Safe for retries: never create a second employee record
        // for the same original onboarding document.
        if (existingOnboardingDocument) continue;

        const readableType =
          documentTypeLabels[sourceDocument.document_type] ||
          sourceDocument.document_type
            .split("_")
            .map((part: string) =>
              part.charAt(0).toUpperCase() + part.slice(1)
            )
            .join(" ");

        const { error: documentInsertError } = await admin
          .from("employee_documents")
          .insert({
            employee_id: employee.id,
            document_type: readableType,
            document_name: sourceDocument.original_file_name,

            // Internal placeholder. The authenticated viewer resolves
            // the original private Cloudinary file using the source ID.
            document_url:
              `onboarding-document://${sourceDocument.id}`,

            cloudinary_resource_type: "raw",

            verification_status:
              sourceDocument.verification_status,

            reviewed_by: sourceDocument.reviewed_by,
            reviewed_at: sourceDocument.reviewed_at,
            review_notes: sourceDocument.review_reason,

            uploaded_at: sourceDocument.uploaded_at,

            source_onboarding_document_id:
              sourceDocument.id,
            source_onboarding_submission_id:
              sourceDocument.submission_id,
            source_employment_record_id:
              sourceDocument.employment_record_id,

            source_onboarding_storage_path:
              sourceDocument.storage_path,

            original_file_name:
              sourceDocument.original_file_name,
            source_document_version:
              sourceDocument.version,
            source_mime_type:
              sourceDocument.mime_type,
            source_file_size_bytes:
              sourceDocument.file_size_bytes,
            source_sha256_hash:
              sourceDocument.sha256_hash,
            source_uploaded_at:
              sourceDocument.uploaded_at,
          });

        if (documentInsertError) {
          // A concurrent retry may have inserted the same source
          // document after our existence check.
          if (documentInsertError.code === "23505") {
            const { data: duplicateDocument } = await admin
              .from("employee_documents")
              .select("id")
              .eq(
                "source_onboarding_document_id",
                sourceDocument.id
              )
              .maybeSingle();

            if (duplicateDocument) continue;
          }

          throw new Error(
            `Unable to transfer ${sourceDocument.original_file_name}: ${documentInsertError.message}`
          );
        }
      }

      // Initialize missing default salary components without overwriting
      // any existing component values.
      const defaultCodes = [
        "BASIC",
        "HRA",
        "SPECIAL_ALLOWANCE",
        "PF",
        "ESI",
        "PT",
        "TDS",
      ];

      const { data: masters, error: mastersError } = await admin
        .from("salary_components")
        .select("id, calculation_type, value")
        .in("code", defaultCodes)
        .eq("is_active", true);

      if (mastersError) throw mastersError;

      if (masters?.length) {
        const {
          data: existingComponents,
          error: existingError,
        } = await admin
          .from("employee_salary_components")
          .select("salary_component_id")
          .eq("employee_id", employee.id);

        if (existingError) throw existingError;

        const existingIds = new Set(
          (existingComponents ?? []).map(
            (component) => component.salary_component_id
          )
        );

        const missingComponents = masters
          .filter((component) => !existingIds.has(component.id))
          .map((component) => ({
            employee_id: employee.id,
            salary_component_id: component.id,
            calculation_type: component.calculation_type,
            value: Number(component.value || 0),
            is_active: true,
            gratuity_5_year_taken: false,
            gratuity_5_year_taken_date: null,
            gratuity_5_year_amount: 0,
            gratuity_10_year_taken: false,
            gratuity_10_year_taken_date: null,
            gratuity_10_year_amount: 0,
          }));

        if (missingComponents.length) {
          const { error: insertError } = await admin
            .from("employee_salary_components")
            .insert(missingComponents);

          if (insertError) throw insertError;
        }
      }

      // Initialize leave balances before marking conversion complete.
      await DataStore.getLeaveBalances(employee.id);

      // Link the employee to the original candidate record.
      const { data: completed, error: completeError } = await admin
        .from("joining_candidates")
        .update({
          employee_record_id: employee.id,
          employee_id: employee.employee_id,
          conversion_status: "completed",
          status: "joined",
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("conversion_status", "processing")
        .is("employee_record_id", null)
        .select("id")
        .maybeSingle();

      if (completeError) throw completeError;

      if (!completed) {
        const { data: latest, error: latestError } = await admin
          .from("joining_candidates")
          .select("conversion_status, employee_record_id")
          .eq("id", id)
          .maybeSingle();

        if (latestError) throw latestError;

        if (
          latest?.conversion_status !== "completed" ||
          latest.employee_record_id !== employee.id
        ) {
          throw new Error(
            "Employee exists, but candidate linking failed. Manual reconciliation is required before retrying."
          );
        }
      }

      // Notify the HR user who created the candidate and welcome the employee.
      const candidateName = `${firstName} ${lastName}`.trim();

      const joiningNotifications = [
        ...(typeof claimed.created_by === "string"
          ? [
              {
                recipient_user_id: claimed.created_by,
                employee_id: null,
                title: "Candidate Joined",
                message: `${candidateName} has been confirmed as joined. Employee ID: ${employee.employee_id}.`,
                type: "joining",
                is_read: false,
              },
            ]
          : []),

        {
          recipient_user_id: authUser.id,
          employee_id: employee.id,
          title: "Welcome to Teens Software Solutions",
          message: `Your joining has been confirmed. Your employee ID is ${employee.employee_id}.`,
          type: "joining",
          is_read: false,
        },
      ];

      const { error: joiningNotificationError } = await admin
        .from("notifications")
        .insert(joiningNotifications);

      if (joiningNotificationError) {
        console.error(
          "Joining notification insert failed:",
          joiningNotificationError.message
        );
      }


      let credentialsEmailSent = false;
      let credentialsEmailError: string | null = null;
      let credentialsEmailStatusSaved = false;
      let credentialsEmailStatusError: string | null = null;

      const recipient = String(claimed.personal_email ?? "").trim();

      try {
        if (!recipient) {
          throw new Error("Candidate personal email is missing.");
        }

        const apiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL;

        if (!apiKey || !fromEmail) {
          throw new Error("Resend email configuration is incomplete.");
        }

        const baseUrl = getAppBaseUrl();
        const resend = new Resend(apiKey);

        const safeName = escapeHtml(`${firstName} ${lastName}`.trim());
        const safeEmail = escapeHtml(employee.email);
        const safePassword = escapeHtml(initialPassword);
        const loginUrl = `${baseUrl}/login`;
        const safeLoginUrl = escapeHtml(loginUrl);

        const { error: sendError } = await resend.emails.send({
          from: fromEmail,
          to: [recipient],
          subject: "Your TEENS Software Solutions Employee Login Credentials",
          text: [
            `Hello ${firstName},`,
            "",
            "Your employee account has been created successfully.",
            "",
            `Official email: ${employee.email}`,
            `Temporary password: ${initialPassword}`,
            `Login link: ${loginUrl}`,
            "",
            "Please sign in using these credentials.",
            "You must change your temporary password immediately after your first login before accessing HRMS.",
            "",
            "Regards,",
            "TEENS Software Solutions HR Team",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
              <h2>Welcome to TEENS Software Solutions</h2>
              <p>Hello ${safeName},</p>
              <p>Your employee account has been created successfully.</p>
              <p><strong>Your login credentials:</strong></p>
              <table style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; font-weight: bold;">Official email</td>
                  <td style="padding: 8px;">${safeEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold;">Temporary password</td>
                  <td style="padding: 8px;">${safePassword}</td>
                </tr>
              </table>
              <p>
                <a href="${safeLoginUrl}"
                  style="display: inline-block; padding: 10px 18px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 5px;">
                  Sign in to HRMS
                </a>
              </p>
              <p>
                You must change your temporary password immediately after your
                first login before accessing HRMS.
              </p>
              <p>Regards,<br />TEENS Software Solutions HR Team</p>
            </div>
          `,
        });

        if (sendError) {
          throw new Error(sendError.message);
        }

        // Resend accepted the email.
        credentialsEmailSent = true;

        // Record successful email delivery in the candidate record.
        const { error: emailStatusError } = await admin
          .from("joining_candidates")
          .update({
            credentials_email_status: "sent",
            credentials_email_sent_at: new Date().toISOString(),
            credentials_email_error: null,
          })
          .eq("id", id)
          .eq("conversion_status", "completed");

        if (emailStatusError) {
          credentialsEmailStatusError = emailStatusError.message;

          console.error(
            "Credentials email sent, but status update failed:",
            emailStatusError.message
          );
        } else {
          credentialsEmailStatusSaved = true;
        }
      } catch (emailError) {
        credentialsEmailError =
          emailError instanceof Error
            ? emailError.message
            : "Unable to send credentials email.";

        // Record the email failure without affecting employee conversion.
        const { error: emailStatusError } = await admin
          .from("joining_candidates")
          .update({
            credentials_email_status: "failed",
            credentials_email_error: credentialsEmailError.slice(0, 1000),
          })
          .eq("id", id)
          .eq("conversion_status", "completed");

        if (emailStatusError) {
          credentialsEmailStatusError = emailStatusError.message;

          console.error(
            "Failed to record credentials email failure:",
            emailStatusError.message
          );
        } else {
          credentialsEmailStatusSaved = true;
        }

        console.error(
          "Credentials email delivery failed:",
          credentialsEmailError
        );
      }

      // Employee conversion remains successful even if email delivery fails.
      return NextResponse.json({
        success: true,
        message: credentialsEmailSent
          ? credentialsEmailStatusSaved
            ? "Employee created and credentials email sent successfully."
            : "Employee created and credentials email sent, but its delivery status could not be saved."
          : "Employee created successfully, but the credentials email could not be sent. HR follow-up is required.",
        credentials_email_sent: credentialsEmailSent,
        credentials_email_error: credentialsEmailError,
        credentials_email_status_saved: credentialsEmailStatusSaved,
        credentials_email_status_error: credentialsEmailStatusError,
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
        },
      });
    } catch (error) {
      console.error("Confirm joined conversion failed:", error);

      // Check the latest candidate state before cleanup or retry handling.
      const {
        data: latestCandidate,
        error: latestCandidateError,
      } = await admin
        .from("joining_candidates")
        .select("conversion_status, employee_record_id")
        .eq("id", id)
        .maybeSingle();

      if (latestCandidateError) {
        console.error(
          "Unable to check candidate conversion state:",
          latestCandidateError
        );
      }

      const linkedEmployeeId =
        latestCandidate?.employee_record_id ?? null;

      const employeeAlreadyLinked =
        Boolean(employeeRecordId) &&
        linkedEmployeeId === employeeRecordId;

      const employeeExistsOrIsLinked =
        Boolean(employeeRecordId) || Boolean(linkedEmployeeId);

      // Only mark as failed when no employee has been created or linked
      // and the candidate state was successfully read.
      if (
        !employeeExistsOrIsLinked &&
        !latestCandidateError &&
        latestCandidate?.conversion_status === "processing"
      ) {
        const { error: resetError } = await admin
          .from("joining_candidates")
          .update({
            conversion_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("conversion_status", "processing")
          .is("employee_record_id", null);

        if (resetError) {
          console.error(
            "Failed to mark conversion as failed:",
            resetError
          );
        }
      }

      // Delete the Auth account and profile only when employee creation
      // definitely did not happen and no employee is linked.
      if (
        createdAuthUserId &&
        !employeeExistsOrIsLinked &&
        !latestCandidateError
      ) {
        const { error: deleteAuthError } =
          await admin.auth.admin.deleteUser(createdAuthUserId);

        if (deleteAuthError) {
          console.error(
            "Failed to clean up orphaned Auth user:",
            deleteAuthError
          );
        } else {
          const { error: deleteProfileError } = await admin
            .from("profiles")
            .delete()
            .eq("id", createdAuthUserId);

          if (deleteProfileError) {
            console.error(
              "Failed to clean up orphaned profile:",
              deleteProfileError
            );
          }
        }
      }

      const isDuplicateEmail =
        error instanceof DuplicateEmailError;

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to confirm joining.",
          employee_created: employeeExistsOrIsLinked,
          manual_reconciliation_required:
            employeeExistsOrIsLinked || Boolean(latestCandidateError),
          employee_linked: employeeAlreadyLinked,
        },
        { status: isDuplicateEmail ? 409 : 500 }
      );
    }
  } catch (error) {
    console.error(
      "POST /api/joining/[id]/confirm-joined failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to confirm joining.",
      },
      { status: 500 }
    );
  }
}