
"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
type Candidate = {
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
  joiningDate: string | null;
  department: string;
  employmentType: string;
  experienceLevel: string;
  totalExperienceYears: number;
  totalExperienceMonths: number;
};

type Contact = {
  name: string;
  relation: string;
  phone: string;
};

type EmploymentHistoryItem = {
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

type OnboardingData = {
  personalDetails?: unknown;
  addressDetails?: unknown;
  bankDetails?: unknown;
  educationDetails?: unknown;
  identityDetails?: {
    uanNumber?: unknown;
    [key: string]: unknown;
  };
  previousEmploymentDetails?: {
    uanNumber?: unknown;
    employmentHistory?: unknown;
    previousCompanyName?: unknown;
    previousDesignation?: unknown;
    employmentStartDate?: unknown;
    employmentEndDate?: unknown;
    referencePersonName?: unknown;
    referencePersonDesignation?: unknown;
    referenceContactNumber?: unknown;
    referenceOfficialEmail?: unknown;
  };
  emergencyContacts?: unknown;
};

type FormValues = {
  personalDetails: {
    dateOfBirth: string;
    bloodGroup: string;
    maritalStatus: string;
  };

  addressDetails: {
    permanentAddress: string;
    permanentCity: string;
    permanentState: string;
    permanentPincode: string;
    temporaryAddress: string;
    temporaryCity: string;
    temporaryState: string;
    temporaryPincode: string;
  };

  bankDetails: {
    bankName: string;
    bankAccountNumber: string;
    bankIfsc: string;
  };

  educationDetails: {
    highestQualification: string;
    course: string;
    specialization: string;
    institution: string;
    university: string;
    yearOfPassing: string;
    percentageOrCgpa: string;

    tenthSchoolName: string;
    tenthBoard: string;
    tenthYearOfPassing: string;
    tenthResultType: string;
    tenthResult: string;
    tenthResultTotal: string;

    twelfthInstitution: string;
    twelfthBoard: string;
    twelfthStream: string;
    twelfthYearOfPassing: string;
    twelfthResultType: string;
    twelfthResult: string;
    twelfthResultTotal: string;

    graduationInstitution: string;
    graduationUniversity: string;
    graduationCourse: string;
    graduationSpecialization: string;
    graduationYearOfPassing: string;
    graduationResultType: string;
    graduationResult: string;
    graduationResultTotal: string;


    postGraduationInstitution: string;
    postGraduationUniversity: string;
    postGraduationCourse: string;
    postGraduationSpecialization: string;
    postGraduationYearOfPassing: string;
    postGraduationResultType: string;
    postGraduationResult: string;
    postGraduationResultTotal: string;


    otherQualification: string;
    otherInstitution: string;
    otherAuthority: string;
    otherYearOfPassing: string;
    otherResultType: string;
    otherResult: string;
    otherResultTotal: string;
  };

  identityDetails: {
    aadhaarNumber: string;
    panNumber: string;
    passportNumber: string;
    drivingLicenseNumber: string;
    uanNumber: string;
  };

  previousEmploymentDetails: {
    uanNumber: string;
    employmentHistory: EmploymentHistoryItem[];
  };

  emergencyContacts: Contact[];
};

type OnboardingDocument = {
  id: string;
  document_type: string;
  employment_record_id: string | null;
  version: number;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: number;
  verification_status: string;
  uploaded_at: string;
  reviewed_at: string | null;
};

const MAX_EMPLOYERS = 20;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXPERIENCE_DOCUMENTS = [
  {
    type: "experience_document",
    label: "Experience Letter / Certificate",
    required: true,
  },
  {
    type: "relieving_letter",
    label: "Relieving Letter",
    required: true,
  },
  {
    type: "previous_joining_letter",
    label: "Previous Company Joining Letter",
    required: true,
  },
  {
    type: "payslip_1",
    label: "Payslip 1",
    required: false,
  },
  {
    type: "payslip_2",
    label: "Payslip 2",
    required: false,
  },
  {
    type: "payslip_3",
    label: "Payslip 3",
    required: false,
  },
  {
    type: "payslip_4",
    label: "Payslip 4",
    required: false,
  },
  {
    type: "payslip_5",
    label: "Payslip 5",
    required: false,
  },
  {
    type: "payslip_6",
    label: "Payslip 6",
    required: false,
  },
  {
    type: "salary_hike_letter",
    label: "Salary Hike / Increment Letter",
    required: true,
  },
  {
    type: "appraisal_letter",
    label: "Appraisal Letter (Optional)",
    required: false,
  },
] as const;

function createEmptyEmployment(): EmploymentHistoryItem {
  return {
    id: crypto.randomUUID(),
    previousCompanyName: "",
    previousDesignation: "",
    employmentStartDate: "",
    employmentEndDate: "",
    referencePersonName: "",
    referencePersonDesignation: "",
    referenceContactNumber: "",
    referenceOfficialEmail: "",
  };
}

function emptyForm(): FormValues {
  return {
    personalDetails: {
      dateOfBirth: "",
      bloodGroup: "",
      maritalStatus: "",
    },

    addressDetails: {
      permanentAddress: "",
      permanentCity: "",
      permanentState: "",
      permanentPincode: "",
      temporaryAddress: "",
      temporaryCity: "",
      temporaryState: "",
      temporaryPincode: "",
    },

    bankDetails: {
      bankName: "",
      bankAccountNumber: "",
      bankIfsc: "",
    },

    educationDetails: {
      highestQualification: "",
      course: "",
      specialization: "",
      institution: "",
      university: "",
      yearOfPassing: "",
      percentageOrCgpa: "",

      tenthSchoolName: "",
      tenthBoard: "",
      tenthYearOfPassing: "",
      tenthResultType: "",
      tenthResult: "",
      tenthResultTotal: "",


      twelfthInstitution: "",
      twelfthBoard: "",
      twelfthStream: "",
      twelfthYearOfPassing: "",
      twelfthResultType: "",
      twelfthResult: "",
      twelfthResultTotal: "",


      graduationInstitution: "",
      graduationUniversity: "",
      graduationCourse: "",
      graduationSpecialization: "",
      graduationYearOfPassing: "",
      graduationResultType: "",
      graduationResult: "",
      graduationResultTotal: "",

      postGraduationInstitution: "",
      postGraduationUniversity: "",
      postGraduationCourse: "",
      postGraduationSpecialization: "",
      postGraduationYearOfPassing: "",
      postGraduationResultType: "",
      postGraduationResult: "",
      postGraduationResultTotal: "",


      otherQualification: "",
      otherInstitution: "",
      otherAuthority: "",
      otherYearOfPassing: "",
      otherResultType: "",
      otherResult: "",
      otherResultTotal: "",
    },

    identityDetails: {
      aadhaarNumber: "",
      panNumber: "",
      passportNumber: "",
      drivingLicenseNumber: "",
      uanNumber: "",
    },

    previousEmploymentDetails: {
      uanNumber: "",
      employmentHistory: [],
    },

    emergencyContacts: [],
  };
}


function validateFinalSubmission(form: FormValues): string | null {
  const personal = form.personalDetails;
  const address = form.addressDetails;
  const bank = form.bankDetails;
  const identity = form.identityDetails;
  const education = form.educationDetails;

  // Date of birth: valid date and at least 18 years old.
  if (!personal.dateOfBirth) {
    return "Please enter your Date of Birth.";
  }

  const dob = new Date(`${personal.dateOfBirth}T00:00:00.000Z`);

  if (
    Number.isNaN(dob.getTime()) ||
    dob.toISOString().slice(0, 10) !== personal.dateOfBirth
  ) {
    return "Please enter a valid Date of Birth.";
  }

  const indiaToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [todayYear, todayMonth, todayDay] = indiaToday
    .split("-")
    .map(Number);

  let age = todayYear - dob.getUTCFullYear();

  if (
    todayMonth < dob.getUTCMonth() + 1 ||
    (todayMonth === dob.getUTCMonth() + 1 &&
      todayDay < dob.getUTCDate())
  ) {
    age--;
  }

  if (age < 18) {
    return "You must be at least 18 years old to submit onboarding.";
  }

  if (!personal.maritalStatus.trim()) {
    return "Please select your Marital Status.";
  }

  // Temporary address.
  const temporaryAddressFields = [
    ["Temporary Address", address.temporaryAddress],
    ["Temporary City", address.temporaryCity],
    ["Temporary State", address.temporaryState],
  ];

  for (const [label, value] of temporaryAddressFields) {
    if (!value.trim()) {
      return `Please enter ${label}.`;
    }
  }

  if (!/^\d{6}$/.test(address.temporaryPincode.trim())) {
    return "Please enter a valid 6-digit Temporary Address Pincode.";
  }

  // Permanent address.
  const permanentAddressFields = [
    ["Permanent Address", address.permanentAddress],
    ["Permanent City", address.permanentCity],
    ["Permanent State", address.permanentState],
  ];

  for (const [label, value] of permanentAddressFields) {
    if (!value.trim()) {
      return `Please enter ${label}.`;
    }
  }

  if (!/^\d{6}$/.test(address.permanentPincode.trim())) {
    return "Please enter a valid 6-digit Permanent Address Pincode.";
  }

  // Bank details.
  if (!bank.bankName.trim()) {
    return "Please enter your Bank Name.";
  }

  if (!bank.bankAccountNumber.trim()) {
    return "Please enter your Bank Account Number.";
  }

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.bankIfsc.trim())) {
    return "Please enter a valid 11-character IFSC Code.";
  }

  // Identity numbers.
  if (!/^\d{12}$/.test(identity.aadhaarNumber.trim())) {
    return "Please enter a valid 12-digit Aadhaar Number.";
  }

  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(identity.panNumber.trim())) {
    return "Please enter a valid PAN Number (for example, ABCDE1234F).";
  }

  // At least one complete emergency contact is mandatory.
  const completeContacts = form.emergencyContacts.filter(
    (contact) =>
      contact.name.trim() &&
      contact.relation.trim() &&
      contact.phone.trim()
  );

  if (completeContacts.length === 0) {
    return "Please add at least one emergency contact with Name, Relationship and Phone.";
  }

  // Any additional contact that has been started must also be complete.
  for (let index = 0; index < form.emergencyContacts.length; index++) {
    const contact = form.emergencyContacts[index];

    const hasAnyValue =
      contact.name.trim() ||
      contact.relation.trim() ||
      contact.phone.trim();

    if (!hasAnyValue) continue;

    if (
      !contact.name.trim() ||
      !contact.relation.trim() ||
      !contact.phone.trim()
    ) {
      return `Please complete Name, Relationship and Phone for Emergency Contact ${index + 1}.`;
    }

    const phoneDigits = contact.phone.replace(/\D/g, "");

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return `Please enter a valid phone number for Emergency Contact ${index + 1}.`;
    }
  }

  // 10th standard is the minimum required education record.
  const tenthFields = [
    ["10th School Name", education.tenthSchoolName],
    ["10th Board", education.tenthBoard],
    ["10th Year of Passing", education.tenthYearOfPassing],
    ["10th Result Type", education.tenthResultType],
    ["10th Result", education.tenthResult],
  ];

  for (const [label, value] of tenthFields) {
    if (!value.trim()) {
      return `Please complete ${label}.`;
    }
  }

  if (!/^\d{4}$/.test(education.tenthYearOfPassing.trim())) {
    return "Please enter a valid 4-digit 10th Year of Passing.";
  }

  // If a higher qualification is started, require all its details.
  const qualificationGroups = [
    {
      label: "12th Standard",
      fields: [
        ["School / College Name", education.twelfthInstitution],
        ["Board", education.twelfthBoard],
        ["Stream", education.twelfthStream],
        ["Year of Passing", education.twelfthYearOfPassing],
        ["Result Type", education.twelfthResultType],
        ["Result", education.twelfthResult],
      ],
    },
    {
      label: "Graduation",
      fields: [
        ["College Name", education.graduationInstitution],
        ["University", education.graduationUniversity],
        ["Degree / Course", education.graduationCourse],
        ["Specialization", education.graduationSpecialization],
        ["Year of Passing", education.graduationYearOfPassing],
        ["Result Type", education.graduationResultType],
        ["Result", education.graduationResult],
      ],
    },
    {
      label: "Post-Graduation",
      fields: [
        ["College Name", education.postGraduationInstitution],
        ["University", education.postGraduationUniversity],
        ["Degree / Course", education.postGraduationCourse],
        ["Specialization", education.postGraduationSpecialization],
        ["Year of Passing", education.postGraduationYearOfPassing],
        ["Result Type", education.postGraduationResultType],
        ["Result", education.postGraduationResult],
      ],
    },
    {
      label: "Other Qualification",
      fields: [
        ["Qualification Name", education.otherQualification],
        ["Institution Name", education.otherInstitution],
        ["Board / University / Authority", education.otherAuthority],
        ["Year of Passing", education.otherYearOfPassing],
        ["Result Type", education.otherResultType],
        ["Result", education.otherResult],
      ],
    },
  ];

  for (const group of qualificationGroups) {
    const started = group.fields.some(([, value]) => value.trim());

    if (!started) continue;

    for (const [fieldLabel, value] of group.fields) {
      if (!value.trim()) {
        return `Please complete ${fieldLabel} in ${group.label}.`;
      }
    }

    const yearField = group.fields.find(
      ([fieldLabel]) => fieldLabel === "Year of Passing"
    );

    if (yearField && !/^\d{4}$/.test(yearField[1].trim())) {
      return `Please enter a valid Year of Passing in ${group.label}.`;
    }
  }

  return null;
}


function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readSection<T extends Record<string, string>>(
  source: unknown,
  defaults: T
): T {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { ...defaults };
  }

  const result = { ...defaults };

  for (const key of Object.keys(defaults) as (keyof T)[]) {
    result[key] = readString(
      (source as Record<string, unknown>)[key as string]
    ) as T[keyof T];
  }

  return result;
}

function readContacts(value: unknown): Contact[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 3).map((item) => ({
    name: readString(item?.name),
    relation: readString(item?.relation),
    phone: readString(item?.phone),
  }));
}

function readEmploymentHistory(
  value: unknown
): EmploymentHistoryItem[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_EMPLOYERS).map((item) => ({
    id:
      typeof item?.id === "string" && UUID_REGEX.test(item.id)
        ? item.id
        : crypto.randomUUID(),

    previousCompanyName: readString(item?.previousCompanyName),
    previousDesignation: readString(item?.previousDesignation),
    employmentStartDate: readString(item?.employmentStartDate),
    employmentEndDate: readString(item?.employmentEndDate),
    referencePersonName: readString(item?.referencePersonName),
    referencePersonDesignation: readString(
      item?.referencePersonDesignation
    ),
    referenceContactNumber: readString(
      item?.referenceContactNumber
    ),
    referenceOfficialEmail: readString(
      item?.referenceOfficialEmail
    ),
  }));
}

function readPreviousEmployment(
  data: OnboardingData,
  hasPreviousExperience: boolean
): FormValues["previousEmploymentDetails"] {
  const previous = data.previousEmploymentDetails ?? {};

  const uanNumber =
    readString(previous.uanNumber) ||
    readString(data.identityDetails?.uanNumber);

  const savedHistory = readEmploymentHistory(
    previous.employmentHistory
  );

  if (savedHistory.length > 0) {
    return {
      uanNumber,
      employmentHistory: savedHistory,
    };
  }

  // Backward compatibility with the old single-employer format.
  const hasLegacyEmployer =
    !!readString(previous.previousCompanyName) ||
    !!readString(previous.previousDesignation);

  if (hasLegacyEmployer) {
    return {
      uanNumber,
      employmentHistory: [
        {
          ...createEmptyEmployment(),
          previousCompanyName: readString(
            previous.previousCompanyName
          ),
          previousDesignation: readString(
            previous.previousDesignation
          ),
          employmentStartDate: readString(
            previous.employmentStartDate
          ),
          employmentEndDate: readString(
            previous.employmentEndDate
          ),
          referencePersonName: readString(
            previous.referencePersonName
          ),
          referencePersonDesignation: readString(
            previous.referencePersonDesignation
          ),
          referenceContactNumber: readString(
            previous.referenceContactNumber
          ),
          referenceOfficialEmail: readString(
            previous.referenceOfficialEmail
          ),
        },
      ],
    };
  }

  return {
    uanNumber,
    employmentHistory: hasPreviousExperience
      ? [createEmptyEmployment()]
      : [],
  };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  required = false,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  required?: boolean;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>

      <input
        type={type}
        value={value}
        maxLength={maxLength}
        max={max}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}


function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Select</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EducationResultFields({
  resultType,
  result,
  resultTotal,
  onResultTypeChange,
  onResultChange,
  onResultTotalChange,
}: {
  resultType: string;
  result: string;
  resultTotal: string;
  onResultTypeChange: (value: string) => void;
  onResultChange: (value: string) => void;
  onResultTotalChange: (value: string) => void;
}) {
  const resultLabel =
    resultType === "Percentage"
      ? "Marks Obtained"
      : resultType === "CGPA"
        ? "CGPA Obtained"
        : resultType === "Grade"
          ? "Grade Obtained"
          : "Obtained Result";

  const totalLabel =
    resultType === "Percentage"
      ? "Total Marks"
      : resultType === "CGPA"
        ? "CGPA Scale"
        : resultType === "Grade"
          ? "Maximum Grade"
          : "Total Marks / Scale";

  return (
    <>
      <SelectField
        label="Result Type"
        value={resultType}
        onChange={onResultTypeChange}
        options={["Percentage", "CGPA", "Grade"]}
      />

      <Field
        label={resultLabel}
        value={result}
        maxLength={30}
        onChange={onResultChange}
      />

      <Field
        label={totalLabel}
        value={resultTotal}
        maxLength={30}
        onChange={onResultTotalChange}
      />
    </>
  );
}


function DocumentUpload({
  documentType,
  label,
  documents,
  uploading,
  onUpload,
  employmentRecordId,
  correctionItems,
  isCorrection,
}: {
  documentType: string;
  label: string;
  documents: OnboardingDocument[];
  uploading: string | null;
  onUpload: (
    documentType: string,
    file?: File,
    employmentRecordId?: string
  ) => void;
  employmentRecordId?: string;
  correctionItems: Array<{
    type: "section" | "document";
    key: string;
    label: string;
    documentType: string | null;
    documentId: string | null;
    employmentRecordId: string | null;
    fileName: string | null;
    instruction: string;
  }>;
  isCorrection: boolean;
}) {
  const uploadKey =
    `${employmentRecordId ?? "general"}:${documentType}`;

  const matchingDocuments = documents
    .filter(
      (item) =>
        item.document_type === documentType &&
        (item.employment_record_id ?? null) ===
          (employmentRecordId ?? null)
    )
    .sort((a, b) => b.version - a.version);

  const requestedCorrection = correctionItems.find(
    (item) =>
      item.type === "document" &&
      item.documentId !== null &&
      item.documentType === documentType &&
      (item.employmentRecordId ?? null) ===
        (employmentRecordId ?? null)
  );

  const requestedDocument = requestedCorrection
    ? matchingDocuments.find(
        (item) => item.id === requestedCorrection.documentId
      )
    : undefined;

  const replacementDocument =
    requestedDocument
      ? matchingDocuments.find(
          (item) =>
            item.id !== requestedDocument.id &&
            item.version > requestedDocument.version
        )
      : undefined;

  const approvedDocument = matchingDocuments.find(
    (item) => item.verification_status === "approved"
  );

  const document =
    replacementDocument ??
    requestedDocument ??
    approvedDocument ??
    matchingDocuments[0];

  const canUpload =
    !isCorrection ||
    (
      Boolean(requestedCorrection) &&
      Boolean(requestedDocument) &&
      !replacementDocument
    );

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-800">
        {label}
      </p>

      <p className="mt-1 break-words text-xs text-slate-500">
        {document
          ? `${document.original_file_name} · ${document.verification_status.replaceAll("_", " ")} · Version ${document.version}`
          : "Not uploaded"}
      </p>

      {canUpload ? (
        <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
          {uploading === uploadKey
            ? "Uploading..."
            : document
              ? "Upload replacement"
              : "Choose file"}

          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={uploading !== null}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                onUpload(
                  documentType,
                  file,
                  employmentRecordId
                );
              }

              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          {replacementDocument
            ? "Replacement uploaded — awaiting HR review"
            : document?.verification_status === "approved"
              ? "Approved by HR — replacement is locked"
              : "No document replacement requested by HR"}
        </p>
      )}

      {requestedCorrection && canUpload && (
        <p className="mt-2 text-xs text-amber-800">
          HR correction: {requestedCorrection.instruction}
        </p>
      )}
    </div>
  );
}


function Section({
  title,
  description,
  children,
  editable = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  editable?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        )}

        {!editable && (
          <p className="mt-1 text-xs font-medium text-slate-500">
            Read-only — this section has not been requested for correction.
          </p>
        )}
      </div>

      <fieldset disabled={!editable} className="contents">
        {children}
      </fieldset>
    </section>
  );
}


export default function CandidateOnboardingForm({
  token,
}: {
  token: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [submissionStatus, setSubmissionStatus] = useState<
    "draft" | "submitted"
  >("draft");

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isCorrection, setIsCorrection] = useState(false);
  const [correctionInstructions, setCorrectionInstructions] = useState("");
  const [correctionItems, setCorrectionItems] = useState<
    Array<{
        type: "section" | "document";
        key: string;
        label: string;
        documentType: string | null;
        documentId: string | null;
        employmentRecordId: string | null;
        fileName: string | null;
        instruction: string;
    }>
    >([]);
  const [submissionData, setSubmissionData] = useState<
    Record<string, unknown>
  >({});

  const [form, setForm] = useState<FormValues>(emptyForm());

  const canEditSection = (sectionKey: string) => {
    if (isSubmitted) return false;

    // During normal onboarding, all sections are editable.
    if (!isCorrection) return true;

    // During corrections, only sections explicitly requested by HR are editable.
    return correctionItems.some(
        (item) =>
        item.type === "section" &&
        item.key === sectionKey
    );
    };

  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isSubmitted = submissionStatus === "submitted";

  const hasPreviousExperience = (() => {
    const level = String(candidate?.experienceLevel ?? "")
        .trim()
        .toLowerCase();

    if (level === "fresher") return false;
    if (level === "experienced") return true;

    return (
        Number(candidate?.totalExperienceYears ?? 0) > 0 ||
        Number(candidate?.totalExperienceMonths ?? 0) > 0
    );
  })();

  const loadDocuments = useCallback(async () => {
    const response = await fetch(
      "/api/candidate-onboarding/documents",
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error || "Unable to load uploaded documents."
      );
    }

    setDocuments(result.documents ?? []);
  }, [setDocuments]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
          throw new Error("The onboarding link is invalid.");
        }

        const response = await fetch(
          "/api/candidate-onboarding/validate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({ token }),
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to open onboarding."
          );
        }

        if (cancelled) return;

        const data: OnboardingData = result.submission?.data && typeof result.submission.data === "object" && !Array.isArray(result.submission.data) ? result.submission.data : {};
        const experienced =
          Number(result.candidate?.totalExperienceYears ?? 0) > 0 ||
          Number(result.candidate?.totalExperienceMonths ?? 0) > 0 ||
          /experienced/i.test(
            result.candidate?.experienceLevel ?? ""
          );

        setCandidate(result.candidate);
        setSubmissionData(data);
        setIsCorrection(result.isCorrection === true);
        setCorrectionInstructions(
            typeof result.correctionInstructions === "string"
                ? result.correctionInstructions
                : ""
            );
        setCorrectionItems(
            Array.isArray(result.correctionItems)
                ? result.correctionItems
                : []
            );

        if (result.submission?.status === "submitted") {
          setSubmissionStatus("submitted");
        }

        const defaults = emptyForm();

        setForm({
          personalDetails: readSection(
            data.personalDetails,
            defaults.personalDetails
          ),

          addressDetails: readSection(
            data.addressDetails,
            defaults.addressDetails
          ),

          bankDetails: readSection(
            data.bankDetails,
            defaults.bankDetails
          ),

          educationDetails: readSection(
            data.educationDetails,
            defaults.educationDetails
          ),

          identityDetails: readSection(
            data.identityDetails,
            defaults.identityDetails
          ),

          previousEmploymentDetails: readPreviousEmployment(
            data,
            experienced
          ),

          emergencyContacts: readContacts(
            data.emergencyContacts
          ),
        });

        await loadDocuments();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to open onboarding."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [token, loadDocuments]);

  function updateSection<
    K extends
      | "personalDetails"
      | "addressDetails"
      | "bankDetails"
      | "educationDetails"
      | "identityDetails"
  >(
    section: K,
    field: keyof FormValues[K],
    value: string
  ) {
    if (isSubmitted) return;

    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  function updateEmployment(
    employmentId: string,
    field: keyof Omit<EmploymentHistoryItem, "id">,
    value: string
  ) {
    if (!canEditSection("employment")) return;

    setForm((current) => ({
      ...current,
      previousEmploymentDetails: {
        ...current.previousEmploymentDetails,
        employmentHistory:
          current.previousEmploymentDetails.employmentHistory.map(
            (item) =>
              item.id === employmentId
                ? {
                    ...item,
                    [field]: value,
                  }
                : item
          ),
      },
    }));
  }

  function addEmployment() {
    if (!canEditSection("employment")) return;

    setForm((current) => {
      if (
        current.previousEmploymentDetails.employmentHistory.length >=
        MAX_EMPLOYERS
      ) {
        return current;
      }

      return {
        ...current,
        previousEmploymentDetails: {
          ...current.previousEmploymentDetails,
          employmentHistory: [
            ...current.previousEmploymentDetails.employmentHistory,
            createEmptyEmployment(),
          ],
        },
      };
    });
  }

  function removeEmployment(employmentId: string) {
    if (isSubmitted) return;

    const history =
      form.previousEmploymentDetails.employmentHistory;

    if (history.length <= 1) {
      setError("At least one previous employer record must remain.");
      return;
    }

    const hasUploadedDocuments = documents.some(
      (document) =>
        document.employment_record_id === employmentId
    );

    if (hasUploadedDocuments) {
      setError(
        "This employer has uploaded documents. Please contact HR before removing this employment record so its document history is preserved."
      );
      return;
    }

    setError("");

    setForm((current) => ({
      ...current,
      previousEmploymentDetails: {
        ...current.previousEmploymentDetails,
        employmentHistory:
          current.previousEmploymentDetails.employmentHistory.filter(
            (item) => item.id !== employmentId
          ),
      },
    }));
  }

  async function saveDraft(event?: React.FormEvent) {
    event?.preventDefault();

    if (isSubmitted || submitting) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/candidate-onboarding/save",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            data: form,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to save your details."
        );
      }

      setMessage(
        "Your onboarding details have been saved successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your details."
      );
    } finally {
      setSaving(false);
    }
  }


  async function submitOnboarding() {
    if (isSubmitted || saving || submitting || uploading !== null) {
      return;
    }
    setError("");
    setMessage("");
    const validationError = validateFinalSubmission(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to submit your onboarding details to HR? You will not be able to edit your submission after submitting."
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const saveResponse = await fetch(
        "/api/candidate-onboarding/save",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            data: form,
          }),
        }
      );

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok || !saveResult.success) {
        throw new Error(
          saveResult.error ||
            "Unable to save your latest onboarding details."
        );
      }

      const response = await fetch(
        "/api/candidate-onboarding/submit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to submit your onboarding."
        );
      }

      setSubmissionStatus("submitted");

      setMessage(
        result.message ||
          "Your onboarding details have been submitted successfully. HR will review your information and documents."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your onboarding."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadDocument(
    documentType: string,
    file?: File,
    employmentRecordId?: string
  ) {
    if (!file || isSubmitted || submitting) return;

    const uploadKey =
      `${employmentRecordId ?? "general"}:${documentType}`;

    setUploading(uploadKey);
    setError("");
    setMessage("");

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          "Each document must be smaller than 10 MB."
        );
      }

      const body = new FormData();

      body.append("file", file);
      body.append("documentType", documentType);

      if (employmentRecordId) {
        body.append("employmentRecordId", employmentRecordId);
      }

      const response = await fetch(
        "/api/candidate-onboarding/documents",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          body,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Document upload failed."
        );
      }

      await loadDocuments();

      setMessage(`${file.name} uploaded successfully.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Document upload failed."
      );
    } finally {
      setUploading(null);
    }
  }

  function addEmergencyContact() {
    if (isSubmitted || form.emergencyContacts.length >= 3) {
      return;
    }

    setForm((current) => ({
      ...current,
      emergencyContacts: [
        ...current.emergencyContacts,
        {
          name: "",
          relation: "",
          phone: "",
        },
      ],
    }));
  }

  function updateContact(
    index: number,
    field: keyof Contact,
    value: string
  ) {
    if (isSubmitted) return;

    setForm((current) => ({
      ...current,
      emergencyContacts: current.emergencyContacts.map(
        (contact, i) =>
          i === index
            ? {
                ...contact,
                [field]: value,
              }
            : contact
      ),
    }));
  }

  function removeContact(index: number) {
    if (isSubmitted) return;

    setForm((current) => ({
      ...current,
      emergencyContacts: current.emergencyContacts.filter(
        (_, i) => i !== index
      ),
    }));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">
          Loading your onboarding form...
        </p>
      </main>
    );
  }

  if (error && !candidate) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Unable to open onboarding
          </h1>

          <p className="mt-3 text-sm text-red-700">{error}</p>

          <p className="mt-4 text-sm text-slate-600">
            Please contact HR and request a new onboarding link if your
            link has expired.
          </p>
        </div>
      </main>
    );
  }

  if (!candidate) return null;

  const acceptedOffer =
    submissionData.acceptedOffer &&
    typeof submissionData.acceptedOffer === "object" &&
    !Array.isArray(submissionData.acceptedOffer)
      ? (submissionData.acceptedOffer as Record<string, unknown>)
      : null;

  return (
    <main className="h-screen overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6 rounded-xl bg-slate-900 p-6 text-white">
            <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white p-2">
                <Image
                    src="/logo.png"
                    alt="TEENS SOFTWARE SOLUTIONS Logo"
                    width={120}
                    height={120}
                    priority
                    className="h-full w-full object-contain"
                />
                </div>

                <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
                    TEENS SOFTWARE SOLUTIONS
                </p>

                <h1 className="mt-2 text-2xl font-bold">
                    Employee Onboarding
                </h1>
                </div>
            </div>

        <p className="mt-4 text-sm text-slate-300">
            Complete your personal information and upload the required
            documents.
        </p>
        </header>

        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-semibold text-blue-950">
            Welcome, {candidate.firstName} {candidate.lastName}
          </h2>

          <p className="mt-1 text-sm text-blue-900">
            Please complete the form carefully. Your accepted offer
            details are controlled by HR and cannot be edited here.
          </p>
        </div>

                {isCorrection && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h2 className="font-semibold text-amber-950">
              HR has requested corrections
            </h2>

            <p className="mt-1 text-sm text-amber-900">
              Please review the instructions below, correct the relevant
              information, and submit your onboarding details again.
            </p>

            {correctionItems.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Items requiring correction
                </p>

                <div className="mt-3 space-y-3">
                {correctionItems.map((item, index) => (
                    <div
                    key={`${item.type}-${item.key}-${index}`}
                    className="rounded-lg border border-slate-200 p-3"
                    >
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                        {item.label || item.key}
                        </span>

                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                        {item.type === "document" ? "Document" : "Section"}
                        </span>
                    </div>

                    {item.fileName && (
                        <p className="mt-1 text-xs text-slate-500">
                        File: {item.fileName}
                        </p>
                    )}

                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {item.instruction}
                    </p>
                    </div>
                ))}
                </div>
            </div>
            )}

            <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                General instructions from HR
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                {correctionInstructions}
            </p>
            </div>

            <p className="mt-3 text-xs text-amber-900">
              Your previously submitted information has been retained.
              You can edit the form and upload corrected documents.
            </p>
          </div>
        )}

        {isSubmitted && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <h2 className="font-semibold text-green-900">
              Onboarding submitted successfully
            </h2>

            <p className="mt-1 text-sm text-green-800">
              Your details and documents have been submitted to HR
              for verification. You can no longer edit this submission.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        <form onSubmit={saveDraft} className="space-y-5">
          <fieldset disabled={isSubmitted} className="contents">
            {/* OFFER AND JOINING DETAILS */}

            <Section
              title="Offer and Joining Details"
              description="These details are taken from your accepted offer and cannot be changed here."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Full name</p>
                  <p className="font-medium">
                    {candidate.firstName} {candidate.lastName}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="font-medium">{candidate.email}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Designation</p>
                  <p className="font-medium">
                    {candidate.designation || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="font-medium">
                    {candidate.department || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Joining date</p>
                  <p className="font-medium">
                    {candidate.joiningDate || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Employment type
                  </p>
                  <p className="font-medium">
                    {candidate.employmentType || "—"}
                  </p>
                </div>
              </div>

              {acceptedOffer !== null && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Accepted Offer Letter
                  </h3>

                  <p className="mt-1 text-xs text-slate-600">
                    This is the original offer letter accepted by you.
                    Its terms are controlled by HR.
                  </p>

                  <a
                    href="/api/candidate-onboarding/accepted-offer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    View Accepted Offer PDF
                  </a>
                </div>
              )}
            </Section>

            {/* PERSONAL DETAILS */}

            <Section title="Personal Details" editable={canEditSection("personal")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Date of birth"
                        type="date"
                        value={form.personalDetails.dateOfBirth}
                        max={(() => {
                            const today = new Date();
                            const cutoff = new Date(
                            today.getFullYear() - 18,
                            today.getMonth(),
                            today.getDate()
                            );

                            return [
                            cutoff.getFullYear(),
                            String(cutoff.getMonth() + 1).padStart(2, "0"),
                            String(cutoff.getDate()).padStart(2, "0"),
                            ].join("-");
                        })()}
                        onChange={(value) =>
                            updateSection(
                            "personalDetails",
                            "dateOfBirth",
                            value
                            )
                        }
                    />
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Blood group
                    </span>

                    <select
                      value={form.personalDetails.bloodGroup}
                      onChange={(event) =>
                        updateSection(
                          "personalDetails",
                          "bloodGroup",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">Select</option>

                      {[
                        "A+",
                        "A-",
                        "B+",
                        "B-",
                        "AB+",
                        "AB-",
                        "O+",
                        "O-",
                      ].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Marital status
                    </span>

                    <select
                      value={form.personalDetails.maritalStatus}
                      onChange={(event) =>
                        updateSection(
                          "personalDetails",
                          "maritalStatus",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">Select</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>

                <DocumentUpload
                  documentType="passport_photo"
                  label="Passport-size Photograph"
                  documents={documents}
                  uploading={uploading}
                  onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                />
              </div>
            </Section>

            {/* ADDRESS DETAILS */}

            <Section
              title="Address Details"
              editable={canEditSection("address")}
              description="Provide your permanent and current communication addresses."
            >
              <div className="space-y-5">
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Temporary / communication address
                    </h3>

                    <button
                        type="button"
                        onClick={() => {
                            setForm((current) => ({
                            ...current,
                            addressDetails: {
                                ...current.addressDetails,
                                permanentAddress:
                                current.addressDetails.temporaryAddress,
                                permanentCity:
                                current.addressDetails.temporaryCity,
                                permanentState:
                                current.addressDetails.temporaryState,
                                permanentPincode:
                                current.addressDetails.temporaryPincode,
                            },
                            }));
                        }}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                        Same as Temporary Address
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Address"
                      value={form.addressDetails.temporaryAddress}
                      maxLength={500}
                      onChange={(value) =>
                        updateSection(
                          "addressDetails",
                          "temporaryAddress",
                          value
                        )
                      }
                    />

                    <Field
                      label="City"
                      value={form.addressDetails.temporaryCity}
                      maxLength={100}
                      onChange={(value) =>
                        updateSection(
                          "addressDetails",
                          "temporaryCity",
                          value
                        )
                      }
                    />

                    <Field
                      label="State"
                      value={form.addressDetails.temporaryState}
                      maxLength={100}
                      onChange={(value) =>
                        updateSection(
                          "addressDetails",
                          "temporaryState",
                          value
                        )
                      }
                    />

                    <Field
                      label="Pincode"
                      value={form.addressDetails.temporaryPincode}
                      maxLength={6}
                      onChange={(value) =>
                        updateSection(
                          "addressDetails",
                          "temporaryPincode",
                          value.replace(/\D/g, "")
                        )
                      }
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">
                    Permanent address
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Address"
                      value={form.addressDetails.permanentAddress}
                      maxLength={500}
                      onChange={(value) =>
                        updateSection(
                          "addressDetails",
                          "permanentAddress",
                          value
                        )
                      }
                    />

                    <Field
                      label="City"
                      value={form.addressDetails.permanentCity}
                      maxLength={100}
                      onChange={(value) =>
                        updateSection(
                          "addressDetails",
                          "permanentCity",
                          value
                        )
                      }
                    />

                    <Field
                      label="State"
                      value={form.addressDetails.permanentState}
                      maxLength={100}
                      onChange={(value) =>
                        updateSection(
                          "addressDetails",
                          "permanentState",
                          value
                        )
                      }
                    />

                    <Field
                      label="Pincode"
                      value={form.addressDetails.permanentPincode}
                      maxLength={6}
                      onChange={(value) =>
                        updateSection(
                          "addressDetails",
                          "permanentPincode",
                          value.replace(/\D/g, "")
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* BANK DETAILS */}

            <Section
              title="Bank Details"
              editable={canEditSection("bank")}
              description="Enter the account details where your salary should be credited."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Bank name"
                  value={form.bankDetails.bankName}
                  maxLength={150}
                  onChange={(value) =>
                    updateSection("bankDetails", "bankName", value)
                  }
                />

                <DocumentUpload
                  documentType="bank_account_proof"
                  label="Bank Account Proof"
                  documents={documents}
                  uploading={uploading}
                  onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                />

                <Field
                  label="Account number"
                  value={form.bankDetails.bankAccountNumber}
                  maxLength={40}
                  onChange={(value) =>
                    updateSection(
                      "bankDetails",
                      "bankAccountNumber",
                      value
                    )
                  }
                />

                <Field
                  label="IFSC code"
                  value={form.bankDetails.bankIfsc}
                  maxLength={11}
                  onChange={(value) =>
                    updateSection(
                      "bankDetails",
                      "bankIfsc",
                      value.toUpperCase()
                    )
                  }
                />
              </div>
            </Section>

            {/* IDENTITY DETAILS */}

            <Section
              title="Identity Details"
              editable={canEditSection("identity")}
              description="Your identity numbers are encrypted before being stored."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Aadhaar number"
                  value={form.identityDetails.aadhaarNumber}
                  maxLength={12}
                  onChange={(value) =>
                    updateSection(
                      "identityDetails",
                      "aadhaarNumber",
                      value.replace(/\D/g, "")
                    )
                  }
                />

                <DocumentUpload
                  documentType="aadhaar_card"
                  label="Aadhaar Card"
                  documents={documents}
                  uploading={uploading}
                  onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                />

                <Field
                  label="PAN number"
                  value={form.identityDetails.panNumber}
                  maxLength={10}
                  onChange={(value) =>
                    updateSection(
                      "identityDetails",
                      "panNumber",
                      value.toUpperCase()
                    )
                  }
                />

                <DocumentUpload
                  documentType="pan_card"
                  label="PAN Card"
                  documents={documents}
                  uploading={uploading}
                  onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                />

                <Field
                  label="Passport number (if available)"
                  value={form.identityDetails.passportNumber}
                  maxLength={20}
                  onChange={(value) =>
                    updateSection(
                      "identityDetails",
                      "passportNumber",
                      value.toUpperCase()
                    )
                  }
                />

                <DocumentUpload
                  documentType="passport"
                  label="Passport Document (Optional)"
                  documents={documents}
                  uploading={uploading}
                  onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                />

                <Field
                  label="Driving Licence number (if available)"
                  value={form.identityDetails.drivingLicenseNumber}
                  maxLength={20}
                  onChange={(value) =>
                    updateSection(
                      "identityDetails",
                      "drivingLicenseNumber",
                      value.toUpperCase()
                    )
                  }
                />

                <DocumentUpload
                  documentType="driving_license"
                  label="Driving Licence"
                  documents={documents}
                  uploading={uploading}
                  onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                />
              </div>
            </Section>

            {/* EDUCATION DETAILS */}

            <Section
                title="Education Details"
                editable={canEditSection("education")}
                description="Enter your educational qualifications exactly as shown on your certificates and upload the supporting documents."
            >
                <div className="space-y-6">

                    {/* 10TH STANDARD */}
                    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">
                        1. 10th Standard
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                        label="School Name"
                        value={form.educationDetails.tenthSchoolName}
                        maxLength={200}
                        onChange={(value) =>
                            updateSection("educationDetails", "tenthSchoolName", value)
                        }
                        />

                        <SelectField
                        label="Board"
                        value={form.educationDetails.tenthBoard}
                        onChange={(value) =>
                            updateSection("educationDetails", "tenthBoard", value)
                        }
                        options={["CBSE", "ICSE", "ISC", "State Board", "NIOS", "Other"]}
                        />

                        <Field
                        label="Year of Passing"
                        value={form.educationDetails.tenthYearOfPassing}
                        maxLength={4}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "tenthYearOfPassing",
                            value.replace(/\D/g, "")
                            )
                        }
                        />

                        <EducationResultFields
                        resultType={form.educationDetails.tenthResultType}
                        result={form.educationDetails.tenthResult}
                        resultTotal={form.educationDetails.tenthResultTotal}
                        onResultTypeChange={(value) =>
                            updateSection("educationDetails", "tenthResultType", value)
                        }
                        onResultChange={(value) =>
                            updateSection("educationDetails", "tenthResult", value)
                        }
                        onResultTotalChange={(value) =>
                            updateSection("educationDetails", "tenthResultTotal", value)
                        }
                        />
                    </div>

                    <DocumentUpload
                        documentType="education_10th"
                        label="10th Certificate"
                        documents={documents}
                        uploading={uploading}
                        onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                    />
                    </div>

                    {/* 12TH STANDARD */}
                    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">
                        2. 12th Standard
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                        label="School / College Name"
                        value={form.educationDetails.twelfthInstitution}
                        maxLength={200}
                        onChange={(value) =>
                            updateSection("educationDetails", "twelfthInstitution", value)
                        }
                        />

                        <SelectField
                        label="Board"
                        value={form.educationDetails.twelfthBoard}
                        onChange={(value) =>
                            updateSection("educationDetails", "twelfthBoard", value)
                        }
                        options={["CBSE", "ICSE", "ISC", "State Board", "NIOS", "Other"]}
                        />

                        <Field
                        label="Stream (Science / Commerce / Arts / Other)"
                        value={form.educationDetails.twelfthStream}
                        maxLength={100}
                        onChange={(value) =>
                            updateSection("educationDetails", "twelfthStream", value)
                        }
                        />

                        <Field
                        label="Year of Passing"
                        value={form.educationDetails.twelfthYearOfPassing}
                        maxLength={4}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "twelfthYearOfPassing",
                            value.replace(/\D/g, "")
                            )
                        }
                        />

                        <EducationResultFields
                        resultType={form.educationDetails.twelfthResultType}
                        result={form.educationDetails.twelfthResult}
                        resultTotal={form.educationDetails.twelfthResultTotal}
                        onResultTypeChange={(value) =>
                            updateSection("educationDetails", "twelfthResultType", value)
                        }
                        onResultChange={(value) =>
                            updateSection("educationDetails", "twelfthResult", value)
                        }
                        onResultTotalChange={(value) =>
                            updateSection("educationDetails", "twelfthResultTotal", value)
                        }
                        />
                    </div>

                    <DocumentUpload
                        documentType="education_12th"
                        label="12th Certificate"
                        documents={documents}
                        uploading={uploading}
                        onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                    />
                    </div>

                    {/* GRADUATION */}
                    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">
                        3. Graduation
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                        label="College Name"
                        value={form.educationDetails.graduationInstitution}
                        maxLength={200}
                        onChange={(value) =>
                            updateSection("educationDetails", "graduationInstitution", value)
                        }
                        />

                        <Field
                        label="University"
                        value={form.educationDetails.graduationUniversity}
                        maxLength={200}
                        onChange={(value) =>
                            updateSection("educationDetails", "graduationUniversity", value)
                        }
                        />

                        <Field
                        label="Degree / Course"
                        value={form.educationDetails.graduationCourse}
                        maxLength={150}
                        onChange={(value) =>
                            updateSection("educationDetails", "graduationCourse", value)
                        }
                        />

                        <Field
                        label="Specialization"
                        value={form.educationDetails.graduationSpecialization}
                        maxLength={150}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "graduationSpecialization",
                            value
                            )
                        }
                        />

                        <Field
                        label="Year of Passing"
                        value={form.educationDetails.graduationYearOfPassing}
                        maxLength={4}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "graduationYearOfPassing",
                            value.replace(/\D/g, "")
                            )
                        }
                        />

                        <EducationResultFields
                        resultType={form.educationDetails.graduationResultType}
                        result={form.educationDetails.graduationResult}
                        resultTotal={form.educationDetails.graduationResultTotal}
                        onResultTypeChange={(value) =>
                            updateSection("educationDetails", "graduationResultType", value)
                        }
                        onResultChange={(value) =>
                            updateSection("educationDetails", "graduationResult", value)
                        }
                        onResultTotalChange={(value) =>
                            updateSection("educationDetails", "graduationResultTotal", value)
                        }
                        />
                    </div>

                    <DocumentUpload
                        documentType="education_graduation"
                        label="Graduation Certificate"
                        documents={documents}
                        uploading={uploading}
                        onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                    />
                    </div>

                    {/* POST-GRADUATION */}
                    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">
                        4. Post-Graduation
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                        label="College Name"
                        value={form.educationDetails.postGraduationInstitution}
                        maxLength={200}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "postGraduationInstitution",
                            value
                            )
                        }
                        />

                        <Field
                        label="University"
                        value={form.educationDetails.postGraduationUniversity}
                        maxLength={200}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "postGraduationUniversity",
                            value
                            )
                        }
                        />

                        <Field
                        label="Degree / Course"
                        value={form.educationDetails.postGraduationCourse}
                        maxLength={150}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "postGraduationCourse",
                            value
                            )
                        }
                        />

                        <Field
                        label="Specialization"
                        value={form.educationDetails.postGraduationSpecialization}
                        maxLength={150}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "postGraduationSpecialization",
                            value
                            )
                        }
                        />

                        <Field
                        label="Year of Passing"
                        value={form.educationDetails.postGraduationYearOfPassing}
                        maxLength={4}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "postGraduationYearOfPassing",
                            value.replace(/\D/g, "")
                            )
                        }
                        />

                        <EducationResultFields
                        resultType={form.educationDetails.postGraduationResultType}
                        result={form.educationDetails.postGraduationResult}
                        resultTotal={form.educationDetails.postGraduationResultTotal}
                        onResultTypeChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "postGraduationResultType",
                            value
                            )
                        }
                        onResultChange={(value) =>
                            updateSection("educationDetails", "postGraduationResult", value)
                        }
                        onResultTotalChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "postGraduationResultTotal",
                            value
                            )
                        }
                        />
                    </div>

                    <DocumentUpload
                        documentType="education_post_graduation"
                        label="Post-Graduation Certificate"
                        documents={documents}
                        uploading={uploading}
                        onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                    />
                    </div>

                    {/* OTHER QUALIFICATION */}
                    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">
                        5. Other Qualification (Diploma / ITI / Vocational / Other)
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                        label="Qualification Name"
                        value={form.educationDetails.otherQualification}
                        maxLength={150}
                        onChange={(value) =>
                            updateSection("educationDetails", "otherQualification", value)
                        }
                        />

                        <Field
                        label="Institution Name"
                        value={form.educationDetails.otherInstitution}
                        maxLength={200}
                        onChange={(value) =>
                            updateSection("educationDetails", "otherInstitution", value)
                        }
                        />

                        <Field
                        label="Board / University / Issuing Authority"
                        value={form.educationDetails.otherAuthority}
                        maxLength={200}
                        onChange={(value) =>
                            updateSection("educationDetails", "otherAuthority", value)
                        }
                        />

                        <Field
                        label="Year of Passing"
                        value={form.educationDetails.otherYearOfPassing}
                        maxLength={4}
                        onChange={(value) =>
                            updateSection(
                            "educationDetails",
                            "otherYearOfPassing",
                            value.replace(/\D/g, "")
                            )
                        }
                        />

                        <EducationResultFields
                        resultType={form.educationDetails.otherResultType}
                        result={form.educationDetails.otherResult}
                        resultTotal={form.educationDetails.otherResultTotal}
                        onResultTypeChange={(value) =>
                            updateSection("educationDetails", "otherResultType", value)
                        }
                        onResultChange={(value) =>
                            updateSection("educationDetails", "otherResult", value)
                        }
                        onResultTotalChange={(value) =>
                            updateSection("educationDetails", "otherResultTotal", value)
                        }
                        />
                    </div>

                    <DocumentUpload
                        documentType="education_other"
                        label="Other Educational Certificate"
                        documents={documents}
                        uploading={uploading}
                        onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                    />
                    </div>
                </div>
            </Section>

            {/* PREVIOUS EMPLOYMENT */}

            {hasPreviousExperience && (
              <Section
                title="Previous Employment Details & Documents"
                editable={canEditSection("employment")}
                description="Add every previous company separately. Provide employment details, reference information and supporting documents for each company."
              >
                <div className="mb-6 max-w-md">
                  <Field
                    label="UAN Number (if available)"
                    value={
                      form.previousEmploymentDetails.uanNumber
                    }
                    maxLength={12}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        previousEmploymentDetails: {
                          ...current.previousEmploymentDetails,
                          uanNumber: value.replace(/\D/g, ""),
                        },
                      }))
                    }
                  />

                  <p className="mt-1 text-xs text-slate-500">
                    Enter your Universal Account Number if available.
                  </p>
                </div>

                <div className="space-y-5">
                  {form.previousEmploymentDetails.employmentHistory.map(
                    (employment, index) => (
                      <div
                        key={employment.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
                      >
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              Previous Employer {index + 1}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              Enter the details for this employer.
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={
                              form.previousEmploymentDetails
                                .employmentHistory.length <= 1
                            }
                            onClick={() =>
                              removeEmployment(employment.id)
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove Employer
                          </button>
                        </div>

                        {/* EMPLOYMENT DETAILS */}

                        <h4 className="mb-3 text-sm font-semibold text-slate-800">
                          Employment Details
                        </h4>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            label="Previous Company Name"
                            value={employment.previousCompanyName}
                            maxLength={200}
                            onChange={(value) =>
                              updateEmployment(
                                employment.id,
                                "previousCompanyName",
                                value
                              )
                            }
                          />

                          <Field
                            label="Designation / Job Title"
                            value={employment.previousDesignation}
                            maxLength={150}
                            onChange={(value) =>
                              updateEmployment(
                                employment.id,
                                "previousDesignation",
                                value
                              )
                            }
                          />

                          <Field
                            label="Employment Start Date"
                            type="date"
                            value={employment.employmentStartDate}
                            onChange={(value) =>
                              updateEmployment(
                                employment.id,
                                "employmentStartDate",
                                value
                              )
                            }
                          />

                          <Field
                            label="Employment End Date"
                            type="date"
                            value={employment.employmentEndDate}
                            onChange={(value) =>
                              updateEmployment(
                                employment.id,
                                "employmentEndDate",
                                value
                              )
                            }
                          />
                        </div>

                        {/* REFERENCE DETAILS */}

                        <div className="mt-6 border-t border-slate-100 pt-5">
                          <h4 className="mb-1 text-sm font-semibold text-slate-800">
                            Previous Employer Reference Details
                          </h4>

                          <p className="mb-4 text-xs text-slate-500">
                            Provide a reference person from this particular company.
                          </p>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                              label="Reference Person Name"
                              value={employment.referencePersonName}
                              maxLength={120}
                              onChange={(value) =>
                                updateEmployment(
                                  employment.id,
                                  "referencePersonName",
                                  value
                                )
                              }
                            />

                            <Field
                              label="Reference Person Designation"
                              value={
                                employment.referencePersonDesignation
                              }
                              maxLength={150}
                              onChange={(value) =>
                                updateEmployment(
                                  employment.id,
                                  "referencePersonDesignation",
                                  value
                                )
                              }
                            />

                            <Field
                              label="Reference Contact Number"
                              value={employment.referenceContactNumber}
                              maxLength={20}
                              onChange={(value) =>
                                updateEmployment(
                                  employment.id,
                                  "referenceContactNumber",
                                  value
                                )
                              }
                            />

                            <Field
                              label="Reference Official Email (Optional)"
                              type="email"
                              value={employment.referenceOfficialEmail}
                              maxLength={254}
                              onChange={(value) =>
                                updateEmployment(
                                  employment.id,
                                  "referenceOfficialEmail",
                                  value
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* EMPLOYER-SPECIFIC DOCUMENTS */}

                        <div className="mt-6 border-t border-slate-100 pt-5">
                          <h4 className="mb-1 text-sm font-semibold text-slate-800">
                            Employment Documents
                          </h4>

                          <p className="mb-4 text-xs text-slate-500">
                            Experience Letter, Relieving Letter, Previous Company Joining Letter,
                            and Salary Hike / Increment Letter are mandatory for every previous
                            employer. For your most recent employer, upload at least 3 payslips
                            (up to 6). Payslips for earlier employers and Appraisal Letters are
                            optional. HR will verify the payslip months during onboarding review.
                          </p>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {EXPERIENCE_DOCUMENTS.map((item) => (
                              <DocumentUpload
                                key={`${employment.id}-${item.type}`}
                                documentType={item.type}
                                label={`${item.label}${item.required ? " *" : ""}`}
                                documents={documents}
                                uploading={uploading}
                                onUpload={uploadDocument}
                  correctionItems={correctionItems}
                  isCorrection={isCorrection}
                                employmentRecordId={employment.id}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={
                    form.previousEmploymentDetails.employmentHistory
                      .length >= MAX_EMPLOYERS
                  }
                  onClick={addEmployment}
                  className="mt-5 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add Another Experience
                </button>

                <p className="mt-2 text-xs text-slate-500">
                  You can add up to 20 previous employers. Each employer
                  requires its own experience certificate and relieving letter.
                </p>
              </Section>
            )}

            {/* EMERGENCY CONTACTS */}

            <Section
              title="Emergency Contacts"
              editable={canEditSection("emergency")}
              description="You can provide up to three emergency contacts."
            >
              <div className="space-y-4">
                {form.emergencyContacts.map((contact, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        Contact {index + 1}
                      </h3>

                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="text-xs font-medium text-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field
                        label="Name"
                        value={contact.name}
                        maxLength={120}
                        onChange={(value) =>
                          updateContact(index, "name", value)
                        }
                      />

                      <Field
                        label="Relationship"
                        value={contact.relation}
                        maxLength={60}
                        onChange={(value) =>
                          updateContact(index, "relation", value)
                        }
                      />

                      <Field
                        label="Phone"
                        value={contact.phone}
                        maxLength={20}
                        onChange={(value) =>
                          updateContact(index, "phone", value)
                        }
                      />
                    </div>
                  </div>
                ))}

                {form.emergencyContacts.length < 3 && (
                  <button
                    type="button"
                    onClick={addEmergencyContact}
                    className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    + Add emergency contact
                  </button>
                )}
              </div>
            </Section>
          </fieldset>

          {/* SAVE DRAFT AND FINAL SUBMISSION */}

          <div className="sticky bottom-0 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            {isSubmitted ? (
              <div className="text-center">
                <p className="font-semibold text-green-800">
                  Your onboarding has been submitted to HR.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Please contact HR if you need to make any corrections.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Save your progress while completing the form. Submit
                  only when all required information and documents are ready.
                </p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={
                      saving || submitting || uploading !== null
                    }
                    className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>

                  <button
                    type="button"
                    onClick={submitOnboarding}
                    disabled={
                      saving || submitting || uploading !== null
                    }
                    className="rounded-lg bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Onboarding"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>

        <footer className="py-8 text-center text-xs text-slate-500">
          TEENS SOFTWARE SOLUTIONS · Candidate Onboarding
        </footer>
      </div>
    </main>
  );
}