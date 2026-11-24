"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingLinkAction from "@/components/admin/OnboardingLinkAction";
import RequestOnboardingCorrectionsAction from "@/components/admin/RequestOnboardingCorrectionsAction";
import ResendOnboardingCorrectionLinkAction from "@/components/admin/ResendOnboardingCorrectionLinkAction";
import {
  UserRound,
  MapPin,
  Landmark,
  Fingerprint,
  GraduationCap,
  Briefcase,
  Users,
  FileText,
  IdCard,
  CreditCard,
  CarFront,
  Image,
  BookOpen,
  FileCheck,
  Eye,
  Mail,
  Phone,
  CalendarDays,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
} from "lucide-react";


type DocumentItem = {
  id: string;
  document_type: string;
  employment_record_id: string | null;
  version: number;
  original_file_name: string;
  verification_status: string;
  uploaded_at: string;
  created_at: string;
  reviewed_at: string | null;
  review_reason: string | null;
  correction_instructions: string | null;
  resubmission_requested_at: string | null;
  resubmission_requested_by: string | null;
  resubmission_instructions: string | null;
};

type Props = {
  candidate: Record<string, unknown>;
  offer: Record<string, unknown> | null;
  acceptedOfferValid: boolean;
  officialEmailPreview: string | null;
  officialEmailPreviewError: string | null;
  candidateId: string;
  canSendJoiningLetter: boolean;
  onboardingStatus: string;
  hasSubmission: boolean;
  snapshotCandidate: Record<string, unknown>;
  compensation: Record<string, unknown>;
  statutory: Record<string, unknown>;
  verificationCompletedAt: string | null;
  verificationCompletedBy: string | null;
  submission: {
    id: string;
    version: number;
    status: string;
    updated_at: string;

    employment_verification_status: string;
    employment_verified_at: string | null;
    employment_verified_by: string | null;
    employment_review_notes: string | null;

    personal_verification_status: string;
    personal_verified_at: string | null;
    personal_verified_by: string | null;
    personal_review_notes: string | null;

    address_verification_status: string;
    address_verified_at: string | null;
    address_verified_by: string | null;
    address_review_notes: string | null;


    bank_verification_status: string;
    bank_verified_at: string | null;
    bank_verified_by: string | null;
    bank_review_notes: string | null;

    identity_verification_status: string;
    identity_verified_at: string | null;
    identity_verified_by: string | null;
    identity_review_notes: string | null;

    education_verification_status: string;
    education_verified_at: string | null;
    education_verified_by: string | null;
    education_review_notes: string | null;

    emergency_verification_status: string;
    emergency_verified_at: string | null;
    emergency_verified_by: string | null;
    emergency_review_notes: string | null;
  } | null;
    submissionData: Record<string, unknown> | null;
    documents: DocumentItem[];
    decryptionFailed: boolean;
  };

const tabs = [
  { id: "personal", label: "Personal Details", icon: UserRound },
  { id: "address", label: "Address", icon: MapPin },
  { id: "bank", label: "Bank Details", icon: Landmark },
  { id: "identity", label: "Identity", icon: Fingerprint },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "employment", label: "Previous Employment", icon: Briefcase },
  { id: "emergency", label: "Emergency Contacts", icon: Users },
  { id: "documents", label: "Documents", icon: FileText },
];


const documentLabels: Record<string, string> = {
  aadhaar_card: "Aadhaar Card",
  pan_card: "PAN Card",
  driving_license: "Driving Licence",
  passport_photo: "Passport-size Photo",
  passport: "Passport",
  bank_account_proof: "Bank Account Proof",
  education_10th: "10th Certificate",
  education_12th: "12th Certificate",
  education_diploma: "Diploma Certificate",
  education_graduation: "UG Certificate",
  education_post_graduation: "PG Certificate",
  education_other: "Additional Qualification / Certification",
  experience_document: "Experience Letter / Certificate",
  relieving_letter: "Relieving Letter",
  previous_joining_letter: "Previous Company Joining Letter",
  payslip_1: "Payslip 1",
  payslip_2: "Payslip 2",
  payslip_3: "Payslip 3",
  payslip_4: "Payslip 4",
  payslip_5: "Payslip 5",
  payslip_6: "Payslip 6",
  salary_hike_letter: "Salary Hike / Increment Letter",
  appraisal_letter: "Appraisal Letter",
};


const sectionDocuments: Record<string, string[]> = {
  personal: ["passport_photo"],
  bank: ["bank_account_proof"],
  identity: [
    "aadhaar_card",
    "pan_card",
    "driving_license",
    "passport",
  ],
  education: [
    "education_10th",
    "education_12th",
    "education_diploma",
    "education_graduation",
    "education_post_graduation",
    "education_other",
  ],
};

function label(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString("en-IN");
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length ? `${value.length} item(s)` : "None";
  }

  if (typeof value === "object") {
    return "";
  }

  return String(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") {
    return "Not provided";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "NA";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function statusLabel(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "Not started";
  }

  return label(value);
}

function verificationStyle(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized === "verified" ||
    normalized === "approved" ||
    normalized === "accepted"
  ) {
    return {
      className: "bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }

  if (
    normalized === "rejected" ||
    normalized === "correction_required"
  ) {
    return {
      className: "bg-red-50 text-red-700",
      icon: AlertCircle,
    };
  }

  if (
    normalized === "pending" ||
    normalized === "uploaded" ||
    normalized === "submitted"
  ) {
    return {
      className: "bg-amber-50 text-amber-700",
      icon: Clock,
    };
  }

  return {
    className: "bg-slate-100 text-slate-600",
    icon: Clock,
  };
}

function FieldGrid({
  data,
  documents = [],
  documentFieldMap = {},
}: {
  data: Record<string, unknown>;
  documents?: DocumentItem[];
  documentFieldMap?: Record<string, string>;
}) {
  const entries = Object.entries(data).filter(
    ([key]) =>
      !["id", "created_at", "updated_at"].includes(key)
  );

  if (!entries.length) {
    return (
      <p className="text-sm text-slate-400">
        No details provided.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3"
        >
          <p className="text-xs font-medium text-slate-500">
            {label(key)}
          </p>

          {Array.isArray(value) ? (
            <div className="mt-1 space-y-2">
              {value.length ? (
                value.map((item, index) => (
                  <div
                    key={index}
                    className="text-sm text-slate-800"
                  >
                    {isObject(item) ? (
                      Object.entries(item).map(
                        ([childKey, childValue]) => (
                          <p
                            key={childKey}
                            className="break-words"
                          >
                            <span className="text-slate-500">
                              {label(childKey)}:{" "}
                            </span>

                            <span className="font-medium">
                              {display(childValue) ||
                                JSON.stringify(childValue)}
                            </span>
                          </p>
                        )
                      )
                    ) : (
                      display(item)
                    )}
                  </div>
                ))
              ) : (
                <span className="text-sm text-slate-400">
                  None
                </span>
              )}
            </div>
          ) : isObject(value) ? (
            <div className="mt-1 space-y-1 text-sm text-slate-800">
              {Object.entries(value).map(
                ([childKey, childValue]) => (
                  <p
                    key={childKey}
                    className="break-words"
                  >
                    {label(childKey)}:{" "}
                    {display(childValue) ||
                      JSON.stringify(childValue)}
                  </p>
                )
              )}
            </div>
          ) : (
            <p className="mt-1 break-words text-sm font-semibold text-slate-800">
              {display(value)}
            </p>
          )}

          {documentFieldMap[key] &&
            documents
              .filter(
                (doc) =>
                  doc.document_type === documentFieldMap[key]
              )
              .map((doc) => (
                <a
                  key={doc.id}
                  href={`/api/joining/onboarding-documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View{" "}
                  {documentLabels[doc.document_type] || "Document"}
                </a>
              ))}
        </div>
      ))}
    </div>
  );
}

function getDocumentIcon(documentType: string) {
  switch (documentType) {
    case "aadhaar_card":
      return IdCard;
    case "pan_card":
      return CreditCard;
    case "driving_license":
      return CarFront;
    case "passport":
      return BookOpen;
    case "passport_photo":
      return Image;
    case "bank_account_proof":
      return Landmark;
    case "education_10th":
    case "education_12th":
    case "education_diploma":
    case "education_graduation":
    case "education_post_graduation":
    case "education_other":
      return GraduationCap;
    case "experience_document":
      return Briefcase;
    case "relieving_letter":
      return FileCheck;
    default:
      return FileText;
  }
}

function calculateAge(dateOfBirth: unknown): string {
  if (
    typeof dateOfBirth !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
  ) {
    return "Not provided";
  }

  const [year, month, day] = dateOfBirth.split("-").map(Number);

  const dob = new Date(year, month - 1, day);

  if (
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return "Not provided";
  }

  const today = new Date();
  let age = today.getFullYear() - year;

  if (
    today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day)
  ) {
    age--;
  }

  return age >= 0 ? `${age} years` : "Not provided";
}

type DocumentReviewDecision = "approve" | "reject" | "request_resubmission";



function DocumentList({
  documents,
  variant = "list",
  onReview,
  reviewBusyId = null,
  reviewReasons = {},
  correctionInstructions = {},
  reviewErrors = {},
  onReasonChange,
  onCorrectionInstructionChange,
}: {
  documents: DocumentItem[];
  variant?: "list" | "grid";
  onReview?: (
    documentId: string,
    decision: DocumentReviewDecision,
    reason: string,
    candidateInstruction: string
  ) => void;
  reviewBusyId?: string | null;
  reviewReasons?: Record<string, string>;
  correctionInstructions?: Record<string, string>;
  reviewErrors?: Record<string, string>;
  onReasonChange?: (documentId: string, value: string) => void;
  onCorrectionInstructionChange?: (
    documentId: string,
    value: string
  ) => void;
}) {
  if (!documents.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center">
        <FileText className="mx-auto h-7 w-7 text-slate-300" />
        <p className="mt-2 text-sm text-slate-500">
          No matching documents uploaded.
        </p>
      </div>
    );
  }

  const renderReviewControls = (document: DocumentItem) => {
    if (!isLatestDocument(document)) {
      return null;
    }
    const status = document.verification_status.toLowerCase();
    const canReview =
      onReview &&
      ["pending", "resubmission_required"].includes(status);

    const canRequestResubmission =
      Boolean(onReview) &&
      status === "approved" &&
      !document.resubmission_requested_at;

    const reason = reviewReasons[document.id] ?? "";
    const candidateInstruction =
      correctionInstructions[document.id] ?? "";
    const busy = reviewBusyId === document.id;
    const error = reviewErrors[document.id];

    return (
      <div className="mt-3 border-t border-slate-100 pt-3">
        {canReview ? (
          <>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Internal HR remark (private, optional)
            </label>

            <textarea
              value={reason}
              onChange={(event) =>
                onReasonChange?.(document.id, event.target.value)
              }
              maxLength={2000}
              rows={2}
              disabled={busy}
              placeholder="Private notes for HR/CEO..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />

            <label className="mb-1 mt-3 block text-xs font-semibold text-slate-600">
              Candidate correction instructions (required to reject)
            </label>

            <textarea
              value={candidateInstruction}
              onChange={(event) =>
                onCorrectionInstructionChange?.(
                  document.id,
                  event.target.value
                )
              }
              maxLength={2000}
              rows={3}
              disabled={busy}
              placeholder="Tell the candidate exactly what is wrong and what they need to upload or correct..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
            />

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onReview?.(document.id, "approve", reason, "")
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {busy ? "Saving..." : "Approve"}
              </button>

              <button
                type="button"
                disabled={busy || !candidateInstruction.trim()}
                onClick={() =>
                  onReview?.(
                    document.id,
                    "reject",
                    reason,
                    candidateInstruction
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>

            {error && (
              <p className="mt-2 text-xs text-red-600">{error}</p>
            )}
          </>
        ) : (
          <>
            {document.reviewed_at && (
              <div className="space-y-1 text-xs text-slate-500">
                <p>Reviewed {formatDate(document.reviewed_at)}</p>
                {document.review_reason && (
                  <p className="break-words text-slate-600">
                    Internal HR remark: {document.review_reason}
                  </p>
                )}
                {document.correction_instructions && (
                  <p className="break-words text-amber-700">
                    Candidate instruction: {document.correction_instructions}
                  </p>
                )}
              </div>
            )}

            {status === "approved" && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                {document.resubmission_requested_at ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-700">
                      Resubmission requested — awaiting candidate replacement
                    </p>
                    {document.resubmission_instructions && (
                      <p className="text-xs text-slate-600">
                        Candidate instruction: {document.resubmission_instructions}
                      </p>
                    )}
                  </div>
                ) : canRequestResubmission ? (
                  <>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Request document replacement
                    </label>
                    <textarea
                      value={candidateInstruction}
                      onChange={(event) =>
                        onCorrectionInstructionChange?.(
                          document.id,
                          event.target.value
                        )
                      }
                      maxLength={2000}
                      rows={3}
                      disabled={busy}
                      placeholder="Explain why this approved document needs to be replaced..."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                    />

                    <button
                      type="button"
                      disabled={busy || !candidateInstruction.trim()}
                      onClick={() =>
                        onReview?.(
                          document.id,
                          "request_resubmission",
                          reason,
                          candidateInstruction
                        )
                      }
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      {busy ? "Saving..." : "Request resubmission"}
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  


  // Only the latest version of each document type and
  // employment record can be reviewed.
  const latestDocumentIds = new Map<string, string>();

  for (const document of documents) {
    const key = [
      document.document_type,
      document.employment_record_id ?? "general",
    ].join(":");

    const currentLatestId = latestDocumentIds.get(key);

    const currentLatest = documents.find(
      (item) => item.id === currentLatestId
    );

    if (
      !currentLatest ||
      document.version > currentLatest.version ||
      (
        document.version === currentLatest.version &&
        new Date(document.uploaded_at).getTime() >
          new Date(currentLatest.uploaded_at).getTime()
      )
    ) {
      latestDocumentIds.set(key, document.id);
    }
  }

  const isLatestDocument = (document: DocumentItem) => {
    const key = [
      document.document_type,
      document.employment_record_id ?? "general",
    ].join(":");

    return latestDocumentIds.get(key) === document.id;
  };




  if (variant === "grid") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {documents.map((document) => {
          const verification = verificationStyle(
            document.verification_status
          );
          const DocumentIcon = getDocumentIcon(document.document_type);

          return (
            <div
              key={document.id}
              className="min-w-0 rounded-lg border border-slate-200 p-2"
            >
              <a
                href={`/api/joining/onboarding-documents/${document.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${document.original_file_name}`}
                className="group flex min-w-0 flex-col items-center text-center"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700">
                  <DocumentIcon className="h-5 w-5" strokeWidth={1.7} />
                </div>

                <p className="mt-1.5 w-full text-xs font-semibold leading-4 text-slate-800">
                  {documentLabels[document.document_type] ||
                    label(document.document_type)}
                </p>

                <p className="mt-1 w-full truncate text-[9px] text-slate-500">
                  {document.original_file_name}
                </p>

                <span
                  className={`mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${verification.className}`}
                >
                  {isLatestDocument(document)
                    ? statusLabel(document.verification_status)
                    : "Superseded"}
                </span>

                <span className="mt-1 text-[10px] font-semibold text-indigo-600">
                  View document
                </span>
              </a>

              {renderReviewControls(document)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((document) => {
        const verification = verificationStyle(
          document.verification_status
        );
        const StatusIcon = verification.icon;

        return (
          <div
            key={document.id}
            className="rounded-lg border border-slate-200 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {documentLabels[document.document_type] ||
                      label(document.document_type)}
                  </p>

                  <p className="break-all text-xs text-slate-500">
                    {document.original_file_name}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Uploaded {formatDate(document.uploaded_at)}
                    {" · "}Version {document.version}
                  </p>

                  <span
                    className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${verification.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {isLatestDocument(document) ? statusLabel(document.verification_status) : "Superseded"}
                  </span>
                </div>
              </div>

              <a
                href={`/api/joining/onboarding-documents/${document.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </a>
            </div>

            {renderReviewControls(document)}
          </div>
        );
      })}
    </div>
  );
}

function EducationSection({
  data,
  documents,
}: {
  data: unknown;
  documents: DocumentItem[];
}) {
  if (!isObject(data)) {
    return (
      <p className="text-sm text-slate-400">
        No education details submitted.
      </p>
    );
  }

  const groups = [
    {
      title: "10th Standard",
      documentType: "education_10th",
      fields: [
        ["tenthBoard", "Board"],
        ["tenthSchoolName", "School"],
        ["tenthResultType", "Result Type"],
        ["tenthResult", "Result"],
        ["tenthResultTotal", "Total Marks / Scale"],
        ["tenthYearOfPassing", "Year of Passing"],
      ],
    },
    {
      title: "12th Standard",
      documentType: "education_12th",
      fields: [
        ["twelfthBoard", "Board"],
        ["twelfthStream", "Stream"],
        ["twelfthInstitution", "Institution"],
        ["twelfthResultType", "Result Type"],
        ["twelfthResult", "Result"],
        ["twelfthResultTotal", "Total Marks / Scale"],
        ["twelfthYearOfPassing", "Year of Passing"],
      ],
    },
    {
      title: "Diploma",
      documentType: "education_diploma",
      fields: [
        ["diplomaCourse", "Course"],
        ["diplomaAuthority", "Board / Authority"],
        ["diplomaInstitution", "Institution"],
        ["diplomaSpecialization", "Specialization"],
        ["diplomaResultType", "Result Type"],
        ["diplomaResult", "Result"],
        ["diplomaResultTotal", "Total Marks / Scale"],
        ["diplomaYearOfPassing", "Year of Passing"],
      ],
    },
    {
      title: "UG (Undergraduate)",
      documentType: "education_graduation",
      fields: [
        ["graduationCourse", "Course"],
        ["graduationUniversity", "University"],
        ["graduationInstitution", "Institution"],
        ["graduationSpecialization", "Specialization"],
        ["graduationResultType", "Result Type"],
        ["graduationResult", "Result"],
        ["graduationResultTotal", "Total Marks / Scale"],
        ["graduationYearOfPassing", "Year of Passing"],
      ],
    },
    {
      title: "PG (Postgraduate)",
      documentType: "education_post_graduation",
      fields: [
        ["postGraduationCourse", "Course"],
        ["postGraduationUniversity", "University"],
        ["postGraduationInstitution", "Institution"],
        ["postGraduationSpecialization", "Specialization"],
        ["postGraduationResultType", "Result Type"],
        ["postGraduationResult", "Result"],
        ["postGraduationResultTotal", "Total Marks / Scale"],
        ["postGraduationYearOfPassing", "Year of Passing"],
      ],
    },
    {
      title: "Additional Qualifications / Certifications",
      documentType: "education_other",
      fields: [
        ["highestQualification", "Highest Qualification"],
        ["otherQualification", "Qualification"],
        ["course", "Course"],
        ["university", "University"],
        ["institution", "Institution"],
        ["otherInstitution", "Other Institution"],
        ["otherAuthority", "Authority"],
        ["specialization", "Specialization"],
        ["percentageOrCgpa", "Percentage / CGPA"],
        ["otherResultType", "Result Type"],
        ["otherResult", "Result"],
        ["otherResultTotal", "Total Marks / Scale"],
        ["otherYearOfPassing", "Year of Passing"],
      ],
    },
  ];

  const hasValue = (value: unknown) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0);

  const renderedGroups = groups
    .map((group) => {
      const fields = group.fields.filter(([key]) =>
        hasValue(data[key])
      );

      const document = documents.find(
        (item) => item.document_type === group.documentType
      );

      return { ...group, fields, document };
    })
    .filter((group) => group.fields.length > 0 || group.document);

  if (!renderedGroups.length) {
    return (
      <p className="text-sm text-slate-400">
        No education details submitted.
      </p>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {renderedGroups.map((group) => (
        <section
          key={group.title}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-slate-900">
              {group.title}
            </h4>
            <GraduationCap className="h-4 w-4 text-indigo-500" />
          </div>

          {group.fields.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {group.fields.map(([key, fieldLabel]) => (
                <div
                  key={key}
                  className="min-w-0 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <p className="text-[11px] font-medium text-slate-500">
                    {fieldLabel}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                    {display(data[key])}
                  </p>
                </div>
              ))}
            </div>
          )}

          {group.document && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <a
                href={`/api/joining/onboarding-documents/${group.document.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                <Eye className="h-3.5 w-3.5" />
                View {documentLabels[group.document.document_type]}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Section({
  title,
  data,
  documents = [],
  documentFieldMap = {},
}: {
  title: string;
  data: unknown;
  documents?: DocumentItem[];
  documentFieldMap?: Record<string, string>;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">
          {title}
        </h3>
      </div>

      {isObject(data) ? (
        <FieldGrid
          data={data}
          documents={documents}
          documentFieldMap={documentFieldMap}
        />
      ) : (
        <p className="text-sm text-slate-400">
          No details provided.
        </p>
      )}
    </section>
  );
}

function EmploymentSection({ data }: { data: unknown }) {
  const details = isObject(data) ? data : {};

  const historyValue =
    details.employmentHistory ?? details.employment_history;

  const employmentHistory = Array.isArray(historyValue)
    ? historyValue.filter(isObject)
    : [];

  const uanNumber =
    details.uanNumber ?? details.uan_number;

  const getValue = (
    record: Record<string, unknown>,
    ...keys: string[]
  ) => {
    for (const key of keys) {
      const value = record[key];
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }
    return null;
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          UAN Number
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {display(uanNumber)}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Employment History
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Previous employer and employment reference details
          </p>
        </div>

        {employmentHistory.length > 0 ? (
          employmentHistory.map((item, index) => {
            const company = getValue(
              item,
              "previousCompanyName",
              "previous_company_name",
              "companyName",
              "company_name"
            );

            const designation = getValue(
              item,
              "previousDesignation",
              "previous_designation",
              "designation",
              "jobTitle",
              "job_title"
            );

            const startDate = getValue(
              item,
              "employmentStartDate",
              "employment_start_date",
              "startDate",
              "start_date"
            );

            const endDate = getValue(
              item,
              "employmentEndDate",
              "employment_end_date",
              "endDate",
              "end_date"
            );

            const referenceName = getValue(
              item,
              "referencePersonName",
              "reference_person_name"
            );

            const referenceDesignation = getValue(
              item,
              "referencePersonDesignation",
              "reference_person_designation"
            );

            const referencePhone = getValue(
              item,
              "referenceContactNumber",
              "reference_contact_number"
            );

            const referenceEmail = getValue(
              item,
              "referenceOfficialEmail",
              "reference_official_email"
            );

            const hasReference = [
              referenceName,
              referenceDesignation,
              referencePhone,
              referenceEmail,
            ].some(Boolean);

            return (
              <article
                key={index}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">
                    Previous Employer {index + 1}
                  </p>
                  <h4 className="mt-1 text-base font-bold text-slate-900">
                    {display(company)}
                  </h4>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {display(designation)}
                  </p>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Employment Start Date
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {formatDate(startDate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Employment End Date
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {formatDate(endDate)}
                    </p>
                  </div>
                </div>

                {hasReference && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <h5 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Reference Contact
                    </h5>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {referenceName && (
                        <div>
                          <p className="text-xs text-slate-500">
                            Contact Person
                          </p>
                          <p className="mt-1 break-words text-sm font-medium text-slate-800">
                            {display(referenceName)}
                          </p>
                        </div>
                      )}

                      {referenceDesignation && (
                        <div>
                          <p className="text-xs text-slate-500">
                            Designation
                          </p>
                          <p className="mt-1 break-words text-sm font-medium text-slate-800">
                            {display(referenceDesignation)}
                          </p>
                        </div>
                      )}

                      {referencePhone && (
                        <div>
                          <p className="text-xs text-slate-500">
                            Contact Number
                          </p>
                          <p className="mt-1 break-words text-sm font-medium text-slate-800">
                            {display(referencePhone)}
                          </p>
                        </div>
                      )}

                      {referenceEmail && (
                        <div>
                          <p className="text-xs text-slate-500">
                            Official Email
                          </p>
                          <p className="mt-1 break-all text-sm font-medium text-slate-800">
                            {display(referenceEmail)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400">
            No previous employment details provided.
          </p>
        )}
      </div>
    </section>
  );
}

function formatCurrency(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SalaryComponentCard({
  title,
  items,
  type,
}: {
  title: string;
  items: unknown[];
  type: "earning" | "deduction" | "employer";
}) {
  const headingColor =
    type === "earning"
      ? "text-emerald-700"
      : type === "deduction"
        ? "text-rose-700"
        : "text-indigo-700";

  const totalMonthly = items.reduce<number>((total, item) => {
    const row = isObject(item) ? item : {};
    const amount = Number(row.monthlyAmount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const totalAnnual = items.reduce<number>((total, item) => {
    const row = isObject(item) ? item : {};
    const amount = Number(row.annualAmount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3">
        <h4 className={`text-xs font-bold ${headingColor}`}>
          {title}
        </h4>
        <span className="text-[10px] font-medium text-slate-400">
          {items.length} components
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[240px] text-left">
          <thead className="bg-white">
            <tr className="border-b border-slate-100">
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Component
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Monthly
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Annual
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {items.length ? (
              items.map((item, index) => {
                const row = isObject(item) ? item : {};
                const itemLabel = String(row.label || `Component ${index + 1}`);

                return (
                  <tr key={`${itemLabel}-${index}`}>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-700">
                      <div>{itemLabel}</div>
                      {type === "employer" && row.includedInCtc === true && (
                        <span className="mt-1 inline-block text-[10px] text-indigo-600">
                          Included in CTC
                        </span>
                      )}
                      {typeof row.note === "string" && row.note && (
                        <p className="mt-1 max-w-[180px] text-[10px] leading-4 text-amber-700">
                          {row.note}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-slate-700">
                      {formatCurrency(row.monthlyAmount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-slate-700">
                      {formatCurrency(row.annualAmount)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-5 text-center text-xs text-slate-400">
                  No components available.
                </td>
              </tr>
            )}
          </tbody>

          {items.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className="px-3 py-3 text-xs font-bold text-slate-900">
                  Total
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-bold text-slate-900">
                  {formatCurrency(totalMonthly)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-bold text-slate-900">
                  {formatCurrency(totalAnnual)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

type SectionVerificationPanelProps = {
  title: string;
  locked: boolean;
  status: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  notes: string;
  onNotesChange: (value: string) => void;
  candidateInstruction: string;
  onCandidateInstructionChange: (value: string) => void;
  busy: boolean;
  error: string;
  onVerify: () => void;
  onRequestCorrections: () => void;
};

function SectionVerificationPanel({
  title,
  locked,
  status,
  reviewedAt,
  reviewNotes,
  notes,
  onNotesChange,
  candidateInstruction,
  onCandidateInstructionChange,
  busy,
  error,
  onVerify,
  onRequestCorrections,
}: SectionVerificationPanelProps) {
  const normalizedStatus = status.toLowerCase();

  const statusLabel =
    normalizedStatus === "verified"
      ? "Verified"
      : normalizedStatus === "correction_required"
        ? "Correction Required"
        : "Pending";

  const statusClass =
    normalizedStatus === "verified"
      ? "bg-green-50 text-green-700 border-green-200"
      : normalizedStatus === "correction_required"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            HR Verification — {title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Review this section independently from other onboarding sections.
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>

      {reviewedAt && (
        <p className="text-xs text-slate-500">
          Last reviewed: {new Date(reviewedAt).toLocaleString("en-IN")}
        </p>
      )}

      {reviewNotes && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">
            Previous HR-only remark
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
            {reviewNotes}
          </p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Internal HR remark (not visible to candidate)
        </label>
        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Optional internal note for HR records..."
          disabled={busy || locked}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {notes.length}/2000
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-red-700">
          Correction instructions for candidate (required to request corrections)
        </label>
        <textarea
          value={candidateInstruction}
          onChange={(event) =>
            onCandidateInstructionChange(event.target.value)
          }
          maxLength={2000}
          rows={3}
          placeholder="Clearly explain what information the candidate must correct..."
          disabled={busy || locked}
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-50"
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {candidateInstruction.length}/2000
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onVerify}
          disabled={busy || locked}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {busy ? "Saving..." : "Verify Section"}
        </button>

        <button
          type="button"
          onClick={onRequestCorrections}
          disabled={busy || locked || !candidateInstruction.trim()}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AlertCircle className="h-4 w-4" />
          {busy ? "Saving..." : "Request Corrections"}
        </button>
      </div>
    </section>
  );
}

export default function AddEmployeeWorkspace({
  candidate,
  offer,
  acceptedOfferValid,
  officialEmailPreview,
  officialEmailPreviewError,
  candidateId,
  canSendJoiningLetter,
  onboardingStatus: onboardingStatusProp,
  hasSubmission,
  verificationCompletedAt,
  verificationCompletedBy,
  compensation,
  statutory,
  submission,
  submissionData,
  documents,
  decryptionFailed,
}: Props) {
  const [activeTab, setActiveTab] = useState("personal");
  const router = useRouter();
  const verificationCompleted = Boolean(
    verificationCompletedAt && verificationCompletedBy
  );

  // Joining Letter state
  const [joiningLetterModalOpen, setJoiningLetterModalOpen] = useState(false);

  const [joiningLetterDate, setJoiningLetterDate] = useState(
    String(candidate.joining_date ?? "").slice(0, 10)
  );

  const [joiningLetterProbation, setJoiningLetterProbation] = useState(() => {
    const value = Number(candidate.probation_period_months ?? 3);
    return [0, 3, 6, 12].includes(value) ? value : 3;
  });

  const [joiningLetterBusy, setJoiningLetterBusy] = useState(false);
  const [joiningLetterError, setJoiningLetterError] = useState("");
  const [joiningLetterSuccess, setJoiningLetterSuccess] = useState("");

  // Secure Employee Conversion state
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [actualJoiningDate, setActualJoiningDate] = useState(
    String(candidate.joining_date ?? "").slice(0, 10)
  );
  const [conversionBusy, setConversionBusy] = useState(false);
  const [conversionError, setConversionError] = useState("");
  const [conversionResult, setConversionResult] = useState<{
    emailSent: boolean;
    emailError: string | null;
    statusSaved: boolean;
    statusError: string | null;
  } | null>(null);

  // HR Verification Completion state
  const [verificationCompleting, setVerificationCompleting] = useState(false);
  const [verificationCompletionError, setVerificationCompletionError] = useState("");
  const [verificationReopening, setVerificationReopening] = useState(false);
  const [verificationReopeningError, setVerificationReopeningError] = useState("");


  const [employmentCorrectionNotes, setEmploymentCorrectionNotes] = useState("");
  const [employmentReviewBusy, setEmploymentReviewBusy] = useState(false);
  const [employmentReviewError, setEmploymentReviewError] = useState("");
  const [employmentCandidateInstructions, setEmploymentCandidateInstructions] = useState("");


  type SectionKey =
    | "personal"
    | "address"
    | "bank"
    | "identity"
    | "education"
    | "emergency";

  const [sectionCorrectionNotes, setSectionCorrectionNotes] = useState<
    Record<SectionKey, string>
  >({
    personal: "",
    address: "",
    bank: "",
    identity: "",
    education: "",
    emergency: "",
  });

  const [sectionCandidateInstructions, setSectionCandidateInstructions] =
    useState<Record<SectionKey, string>>({
      personal: "",
      address: "",
      bank: "",
      identity: "",
      education: "",
      emergency: "",
    });

  const [sectionReviewBusy, setSectionReviewBusy] =
    useState<SectionKey | null>(null);

  const [sectionReviewErrors, setSectionReviewErrors] = useState<
    Partial<Record<SectionKey, string>>
  >({});


  const [documentReviewReasons, setDocumentReviewReasons] = useState<
    Record<string, string>
  >({});

  const [documentCorrectionInstructions, setDocumentCorrectionInstructions] =
    useState<Record<string, string>>({});

  const [documentReviewBusyId, setDocumentReviewBusyId] = useState<
    string | null
  >(null);

  const [documentReviewErrors, setDocumentReviewErrors] = useState<
    Record<string, string>
  >({});

  const [workspaceSection, setWorkspaceSection] = useState<
    "details" | "documents" | "verification" | "offer"
  >("details");

  const handleDocumentReview = async (
    documentId: string,
    decision: "approve" | "reject" | "request_resubmission",
    reason: string,
    candidateInstruction: string
  ) => {
    if (verificationCompleted) return;
    if (!submission?.id) {
      setDocumentReviewErrors((previous) => ({
        ...previous,
        [documentId]: "No active onboarding submission found.",
      }));
      return;
    }

  const reviewReason = reason.trim();
  const correctionInstruction = candidateInstruction.trim();

  if (
    ["reject", "request_resubmission"].includes(decision) &&
    !correctionInstruction
  ) {
    setDocumentReviewErrors((previous) => ({
      ...previous,
      [documentId]:
        "Please provide candidate-facing correction instructions.",
    }));
    return;
  }

  setDocumentReviewBusyId(documentId);
  setDocumentReviewErrors((previous) => ({
    ...previous,
    [documentId]: "",
  }));

  try {
    const response = await fetch(
      `/api/joining/${candidateId}/document-review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submissionId: submission.id,
          documentId,
          decision,
          reason: reviewReason || null,
          candidateInstruction: correctionInstruction || null,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error || "Unable to save the document review."
      );
    }


    router.refresh();
  } catch (error) {
    setDocumentReviewErrors((previous) => ({
      ...previous,
      [documentId]:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
    }));
  } finally {
    setDocumentReviewBusyId(null);
  }
};

  const handleEmploymentReview = async (
    decision: "verify" | "correction_required"
  ) => {

    if (verificationCompleted) return;
    if (!submission?.id) {
      setEmploymentReviewError("No active onboarding submission found.");
      return;
    }

    const notes = employmentCorrectionNotes.trim();
    const candidateInstruction = employmentCandidateInstructions.trim();

    if (decision === "correction_required" && !notes) {
      setEmploymentReviewError(
        "Please provide a reason for requesting corrections."
      );
      return;
    }

    setEmploymentReviewBusy(true);
    setEmploymentReviewError("");

    try {
      const response = await fetch(
        `/api/joining/${candidateId}/employment-review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionId: submission.id,
            decision,
            notes: notes || null,
            candidateInstruction: candidateInstruction || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to save the employment review."
        );
      }

      setEmploymentCorrectionNotes("");
      setEmploymentCandidateInstructions("");
      router.refresh();
    } catch (error) {
      setEmploymentReviewError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setEmploymentReviewBusy(false);
    }
  };


  const handleSectionReview = async (
    section: SectionKey,
    decision: "verify" | "correction_required"
  ) => {
    if (verificationCompleted) return;
    if (!submission?.id) {
      setSectionReviewErrors((previous) => ({
        ...previous,
        [section]: "No active onboarding submission found.",
      }));
      return;
    }

    const notes = sectionCorrectionNotes[section].trim();
    const candidateInstruction =
      sectionCandidateInstructions[section].trim();

    if (decision === "correction_required" && !candidateInstruction) {
      setSectionReviewErrors((previous) => ({
        ...previous,
        [section]: "Please provide candidate-facing correction instructions.",
      }));
      return;
    }

    setSectionReviewBusy(section);

    setSectionReviewErrors((previous) => ({
      ...previous,
      [section]: "",
    }));

    try {
      const response = await fetch(
        `/api/joining/${candidateId}/section-review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionId: submission.id,
            section,
            decision,
            notes: notes || null,
            candidateInstruction: candidateInstruction || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || `Unable to review ${section} details.`
        );
      }

      setSectionCorrectionNotes((previous) => ({
        ...previous,
        [section]: "",
      }));

      setSectionCandidateInstructions((previous) => ({
        ...previous,
        [section]: "",
      }));

      router.refresh();
    } catch (error) {
      setSectionReviewErrors((previous) => ({
        ...previous,
        [section]:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      }));
    } finally {
      setSectionReviewBusy(null);
    }
  };


  const handleCompleteVerification = async () => {
    if (
      verificationCompleted ||
      verificationCompleting ||
      overallVerificationProgress !== 100 ||
      !joiningLetterReady
    ) {
      return;
    }

    setVerificationCompleting(true);
    setVerificationCompletionError("");

    try {
      const response = await fetch(
        `/api/joining/${candidateId}/onboarding/complete-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error || "Unable to complete HR verification."
        );
      }

      router.refresh();
    } catch (error) {
      setVerificationCompletionError(
        error instanceof Error
          ? error.message
          : "Unable to complete HR verification."
      );
    } finally {
      setVerificationCompleting(false);
    }
  };

  const handleReopenVerification = async () => {
    if (!verificationCompleted || verificationReopening) {
      return;
    }

    const confirmed = window.confirm(
      "Reopen HR verification? This will unlock onboarding review and allow a fresh onboarding submission. The accepted offer, joining letter, and previous submission history will be preserved."
    );

    if (!confirmed) {
      return;
    }

    setVerificationReopening(true);
    setVerificationReopeningError("");

    try {
      const response = await fetch(
        `/api/joining/${candidateId}/onboarding/reopen-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error || "Unable to reopen HR verification."
        );
      }

      router.refresh();
    } catch (error) {
      setVerificationReopeningError(
        error instanceof Error
          ? error.message
          : "Unable to reopen HR verification."
      );
    } finally {
      setVerificationReopening(false);
    }
  };

  const today = new Date();
  const minJoiningDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");



  const handleSendJoiningLetter = async () => {
    if (!canSendJoiningLetter || !joiningLetterReady ||!verificationCompleted) return;

    if (!joiningLetterDate || joiningLetterDate < minJoiningDate) {
      setJoiningLetterError("Joining date cannot be in the past.");
      return;
    }

    setJoiningLetterBusy(true);
    setJoiningLetterError("");
    setJoiningLetterSuccess("");

    try {
      const response = await fetch(
        `/api/joining/${candidateId}/joining-letter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            joining_date: joiningLetterDate,
            probation_period_months: joiningLetterProbation,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to send the Joining Letter."
        );
      }

      setJoiningLetterModalOpen(false);
      setJoiningLetterSuccess(
        result.message || "Joining Letter sent successfully."
      );

      router.refresh();
    } catch (error) {
      setJoiningLetterError(
        error instanceof Error
          ? error.message
          : "Unable to send the Joining Letter."
      );
    } finally {
      setJoiningLetterBusy(false);
    }
  };

  const handleConvertEmployee = async () => {
    if (!canSendJoiningLetter || conversionBusy) return;

    if (
      String(candidate.status ?? "").toLowerCase() !== "joining_letter_sent" ||
      String(candidate.joining_letter_send_status ?? "").toLowerCase() !== "sent"
    ) {
      setConversionError(
        "The Joining Letter must be successfully sent before employee conversion."
      );
      return;
    }

    if (!actualJoiningDate) {
      setConversionError("Please confirm the actual joining date.");
      return;
    }

    setConversionBusy(true);
    setConversionError("");
    setConversionResult(null);

    try {
      const response = await fetch(
        `/api/joining/${candidateId}/confirm-joined`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actual_joining_date: actualJoiningDate,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error || "Unable to convert this candidate into an employee."
        );
      }

      setConversionResult({
        emailSent: result.credentials_email_sent === true,
        emailError:
          typeof result.credentials_email_error === "string"
            ? result.credentials_email_error
            : null,
        statusSaved: result.credentials_email_status_saved === true,
        statusError:
          typeof result.credentials_email_status_error === "string"
            ? result.credentials_email_status_error
            : null,
      });

      setConversionModalOpen(false);
      router.refresh();
    } catch (error) {
      setConversionError(
        error instanceof Error
          ? error.message
          : "Unable to complete employee conversion."
      );
    } finally {
      setConversionBusy(false);
    }
  };

  const personal = submissionData?.personalDetails;
  const address = submissionData?.addressDetails;
  const bank = submissionData?.bankDetails;
  const identity = submissionData?.identityDetails;
  const education = submissionData?.educationDetails;
  const employment = submissionData?.previousEmploymentDetails;
  const experienceLevel = String(
    candidate.experience_level ?? ""
  ).trim().toLowerCase();

  const totalExperienceYears = Number(
    candidate.total_experience_years ?? 0
  );

  const totalExperienceMonths = Number(
    candidate.total_experience_months ?? 0
  );

  const isFresher =
    experienceLevel === "fresher" ||
    (experienceLevel !== "experienced" &&
      totalExperienceYears <= 0 &&
      totalExperienceMonths <= 0);

  const emergency = submissionData?.emergencyContacts;



  const sectionVerificationConfig: Record<
    SectionKey,
    {
      status: string;
      reviewedAt: string | null;
      reviewNotes: string | null;
    }
  > = {
    personal: {
      status: submission?.personal_verification_status ?? "pending",
      reviewedAt: submission?.personal_verified_at ?? null,
      reviewNotes: submission?.personal_review_notes ?? null,
    },
    address: {
      status: submission?.address_verification_status ?? "pending",
      reviewedAt: submission?.address_verified_at ?? null,
      reviewNotes: submission?.address_review_notes ?? null,
    },
    bank: {
      status: submission?.bank_verification_status ?? "pending",
      reviewedAt: submission?.bank_verified_at ?? null,
      reviewNotes: submission?.bank_review_notes ?? null,
    },
    identity: {
      status: submission?.identity_verification_status ?? "pending",
      reviewedAt: submission?.identity_verified_at ?? null,
      reviewNotes: submission?.identity_review_notes ?? null,
    },
    education: {
      status: submission?.education_verification_status ?? "pending",
      reviewedAt: submission?.education_verified_at ?? null,
      reviewNotes: submission?.education_review_notes ?? null,
    },
    emergency: {
      status: submission?.emergency_verification_status ?? "pending",
      reviewedAt: submission?.emergency_verified_at ?? null,
      reviewNotes: submission?.emergency_review_notes ?? null,
    },
  };

  const renderSectionVerification = (
    section: SectionKey,
    title: string
  ) => {
    const config = sectionVerificationConfig[section];

    return (
      <SectionVerificationPanel
        title={title}
        locked={verificationCompleted}
        status={config.status}
        reviewedAt={config.reviewedAt}
        reviewNotes={config.reviewNotes}
        notes={sectionCorrectionNotes[section]}
        onNotesChange={(value) =>
          setSectionCorrectionNotes((previous) => ({
            ...previous,
            [section]: value,
          }))
        }
        candidateInstruction={sectionCandidateInstructions[section]}
        onCandidateInstructionChange={(value) =>
          setSectionCandidateInstructions((previous) => ({
            ...previous,
            [section]: value,
          }))
        }
        busy={sectionReviewBusy === section}
        error={sectionReviewErrors[section] ?? ""}
        onVerify={() => handleSectionReview(section, "verify")}
        onRequestCorrections={() =>
          handleSectionReview(section, "correction_required")
        }
      />
    );
  };

  const employmentDocumentTypes = [
    "experience_document",
    "relieving_letter",
    "previous_joining_letter",
    "payslip_1",
    "payslip_2",
    "payslip_3",
    "payslip_4",
    "payslip_5",
    "payslip_6",
    "salary_hike_letter",
    "appraisal_letter",
  ];

  const docsFor = (types: string[]) =>
    documents.filter((doc) =>
      types.includes(doc.document_type)
    );

  const employmentDetails = isObject(employment)
    ? employment
    : {};

  const employmentHistoryValue =
    employmentDetails.employmentHistory ??
    employmentDetails.employment_history;

  const employmentRecords = Array.isArray(employmentHistoryValue)
    ? employmentHistoryValue.filter(isObject)
    : [];

  const employerEndTimestamp = (record: Record<string, unknown>) => {
    const value =
      record.employmentEndDate ??
      record.employment_end_date ??
      record.endDate ??
      record.end_date;

    if (!value) return NaN;

    return new Date(String(value)).getTime();
  };

  const sortedEmployerRecords = [...employmentRecords].sort(
    (a, b) =>
      employerEndTimestamp(b) - employerEndTimestamp(a)
  );

  const latestEmployerDocumentGroupId =
    sortedEmployerRecords.length > 0 &&
    Number.isFinite(employerEndTimestamp(sortedEmployerRecords[0])) &&
    (
      sortedEmployerRecords.length === 1 ||
      employerEndTimestamp(sortedEmployerRecords[0]) !==
        employerEndTimestamp(sortedEmployerRecords[1])
    )
      ? String(sortedEmployerRecords[0].id ?? "")
      : null;

  const getEmployerDocuments = (employmentRecordId: string) =>
    documents.filter(
      (doc) =>
        employmentDocumentTypes.includes(doc.document_type) &&
        doc.employment_record_id === employmentRecordId
    );

  const getEmployerCompanyName = (record: Record<string, unknown>) =>
    String(
      record.previousCompanyName ??
        record.previous_company_name ??
        record.companyName ??
        record.company_name ??
        "Previous Employer"
    );

  const fullName = [
    String(candidate.first_name || ""),
    String(candidate.last_name || ""),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const onboardingStatus = String(
    onboardingStatusProp || candidate.onboarding_status || "not_started"
  );

  const statusText: Record<string, string> = {
    not_started: "Not Started",
    link_sent: "Onboarding Link Sent",
    in_progress: "In Progress",
    submitted: "Awaiting HR Review",
    correction_required: "Corrections Required",
    verified: "Verified",
  };

  const activeTabInfo = tabs.find(
    (tab) => tab.id === activeTab
  );

  const tabDescriptions: Record<string, string> = {
    personal: "Personal profile, date of birth and personal information",
    address: "Permanent and temporary residential address details",
    bank: "Bank account information submitted for payroll processing",
    identity: "Identity information and government identification details",
    education: "Academic qualifications, institutions and certificates",
    employment: "Previous employers, job roles, employment dates and experience history",
    emergency: "Emergency contact persons and their contact information",
    documents: "Documents uploaded as part of candidate onboarding",
  };

  const renderActiveTab = () => {
    if (decryptionFailed && activeTab !== "documents") {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <p className="text-sm font-semibold text-red-800">
                Submitted details could not be securely decrypted.
              </p>

              <p className="mt-1 text-xs text-red-700">
                The information is hidden to protect candidate data.
                Check the onboarding encryption key and stored
                submission format.
              </p>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "personal": {
        const personalDetails =
          personal && typeof personal === "object" && !Array.isArray(personal)
            ? (personal as Record<string, unknown>)
            : {};

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <UserRound className="h-4 w-4" />
                  <span className="text-xs font-medium">Full Name</span>
                </div>
                <p className="mt-2 break-words text-sm font-bold text-slate-800">
                  {fullName || "Not provided"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs font-medium">Age</span>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-800">
                  {calculateAge(personalDetails.dateOfBirth)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="h-4 w-4" />
                  <span className="text-xs font-medium">Phone Number</span>
                </div>
                <p className="mt-2 break-words text-sm font-bold text-slate-800">
                  {String(candidate.mobile_number || "Not provided")}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs font-medium">Personal Email</span>
                </div>
                <p className="mt-2 break-all text-sm font-bold text-slate-800">
                  {String(candidate.personal_email || "Not provided")}
                </p>
              </div>
            </div>

            <Section
              title="Personal details"
              data={personal}
              documents={docsFor(sectionDocuments.personal)}
              documentFieldMap={{
                passportPhoto: "passport_photo",
              }}
            />
             {renderSectionVerification("personal", "Personal Details")}
          </div>
        );
      }


      case "address":
        return (
          <div className="space-y-5">
            <Section
              title="Temporary / Current Address"
              data={
                isObject(address)
                  ? {
                      address: address.temporaryAddress,
                      city: address.temporaryCity,
                      state: address.temporaryState,
                      pincode: address.temporaryPincode,
                    }
                  : null
              }
            />
            
            <Section
              title="Permanent Address"
              data={
                isObject(address)
                  ? {
                      address: address.permanentAddress,
                      city: address.permanentCity,
                      state: address.permanentState,
                      pincode: address.permanentPincode,
                    }
                  : null
              }
            />

            {renderSectionVerification("address", "Address Details")}
          </div>
        );


      case "bank":
        return (
          <div className="space-y-5">
            <Section
              title="Bank details"
              data={bank}
              documents={docsFor(sectionDocuments.bank)}
              documentFieldMap={{
                bankAccountNumber: "bank_account_proof",
              }}
            />
            {renderSectionVerification("bank", "Bank Details")}
          </div>
        );

      case "identity":
        return (
          <div className="space-y-5">
            <Section
              title="Identity details"
              data={identity}
              documents={docsFor(sectionDocuments.identity)}
              documentFieldMap={{
                aadhaarNumber: "aadhaar_card",
                panNumber: "pan_card",
                passportNumber: "passport",
                drivingLicenseNumber: "driving_license",
              }}
            />
            {renderSectionVerification("identity", "Identity Details")}
          </div>
        );

      case "education":
        return (
          <div className="space-y-5">
            <EducationSection
              data={education}
              documents={docsFor(sectionDocuments.education)}
            />
            {renderSectionVerification("education", "Education Details")}
          </div>
        );

        case "employment":
          return isFresher ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <Briefcase className="h-5 w-5 text-blue-700" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-blue-900">
                    Fresher Candidate
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-blue-800">
                    This candidate is a fresher and has no previous employment
                    history.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              
              <EmploymentSection data={employment} />

              <div className="border-t border-slate-100 pt-4">
                  <h4 className="mb-3 text-sm font-bold text-slate-900">
                    Previous Employment Documents
                  </h4>

                  <div className="space-y-4">
                    {employmentRecords.map((record, index) => {
                      const employmentRecordId = String(record.id ?? "").trim();
                      const companyName = getEmployerCompanyName(record);
                      const employerDocuments = getEmployerDocuments(employmentRecordId);

                      const payslipTypes = [
                        "payslip_1",
                        "payslip_2",
                        "payslip_3",
                        "payslip_4",
                        "payslip_5",
                        "payslip_6",
                      ];

                      const verifiedPayslipCount = employerDocuments.filter(
                        (doc) =>
                          payslipTypes.includes(doc.document_type) &&
                          isDocumentVerified(doc)
                      ).length;

                      const isLatestEmployer =
                        Boolean(latestEmployerDocumentGroupId) &&
                        employmentRecordId === latestEmployerDocumentGroupId;

                      return (
                        <section
                          key={employmentRecordId || `employer-${index}`}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h5 className="text-sm font-bold text-slate-900">
                                {companyName}
                              </h5>
                              <p className="mt-1 text-xs text-slate-500">
                                Previous Employer {index + 1}
                              </p>
                            </div>

                            {isLatestEmployer && (
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                Most Recent Employer
                              </span>
                            )}
                          </div>

                          {isLatestEmployer && (
                            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                              <p className="text-xs font-semibold text-blue-900">
                                Payslip Verification: {verifiedPayslipCount} / 3 verified
                              </p>
                              <p className="mt-1 text-xs leading-5 text-blue-800">
                                At least three payslips must be verified. HR must also
                                check that they cover the latest consecutive months.
                                Up to six payslips can be uploaded.
                              </p>
                            </div>
                          )}

                          {!isLatestEmployer && (
                            <p className="mb-3 text-xs text-slate-500">
                              Payslips for this earlier employer are optional.
                            </p>
                          )}

                          <DocumentList
                            variant="grid"
                            documents={employerDocuments}
                            onReview={
                              verificationCompleted ? undefined : handleDocumentReview
                            }
                            reviewBusyId={documentReviewBusyId}
                            reviewReasons={documentReviewReasons}
                            reviewErrors={documentReviewErrors}
                            correctionInstructions={documentCorrectionInstructions}
                            onCorrectionInstructionChange={(documentId, value) =>
                              setDocumentCorrectionInstructions((previous) => ({
                                ...previous,
                                [documentId]: value,
                              }))
                            }
                            onReasonChange={(documentId, value) =>
                              setDocumentReviewReasons((previous) => ({
                                ...previous,
                                [documentId]: value,
                              }))
                            }
                          />
                        </section>
                      );
                    })}

                    {employmentRecords.length === 0 && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        No previous employment records are available for review.
                      </p>
                    )}
                  </div>
                </div>
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Employment History Verification
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Review the candidate&and;s previous employment details separately
                      from the uploaded documents.
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      submission?.employment_verification_status === "verified"
                        ? "bg-green-100 text-green-700"
                        : submission?.employment_verification_status ===
                            "correction_required"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {submission?.employment_verification_status === "verified"
                      ? "Verified"
                      : submission?.employment_verification_status ===
                          "correction_required"
                        ? "Corrections Required"
                        : "Pending Verification"}
                  </span>
                </div>

                {submission?.employment_review_notes && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">
                      Previous HR Review Note
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">
                      {submission.employment_review_notes}
                    </p>
                  </div>
                )}

                {submission?.status === "submitted" && (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="employment-review-notes"
                          className="mb-1 block text-xs font-semibold text-slate-700"
                        >
                          Internal HR Remarks (Private)
                        </label>
                        <textarea
                          id="employment-review-notes"
                          value={employmentCorrectionNotes}
                          onChange={(event) =>
                            setEmploymentCorrectionNotes(event.target.value)
                          }
                          maxLength={2000}
                          rows={3}
                          disabled={verificationCompleted || employmentReviewBusy}
                          placeholder="Optional internal remarks for HR and CEO..."
                          className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                        <p className="mt-1 text-right text-xs text-slate-400">
                          {employmentCorrectionNotes.length}/2000
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="employment-candidate-instructions"
                          className="mb-1 block text-xs font-semibold text-slate-700"
                        >
                          Candidate Correction Instructions
                          <span className="ml-1 text-red-600">*</span>
                        </label>
                        <textarea
                          id="employment-candidate-instructions"
                          value={employmentCandidateInstructions}
                          onChange={(event) =>
                            setEmploymentCandidateInstructions(event.target.value)
                          }
                          maxLength={2000}
                          rows={3}
                          disabled={verificationCompleted || employmentReviewBusy}
                          placeholder="Explain exactly what the candidate needs to correct..."
                          className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                        <p className="mt-1 text-right text-xs text-slate-400">
                          {employmentCandidateInstructions.length}/2000
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          These instructions will be visible to the candidate when HR requests corrections.
                        </p>
                      </div>
                    </div>

                    {employmentReviewError && (
                      <p className="text-sm text-red-600">
                        {employmentReviewError}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={verificationCompleted || employmentReviewBusy}
                        onClick={() => handleEmploymentReview("verify")}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {employmentReviewBusy ? "Saving..." : "Verify Employment"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          verificationCompleted ||
                          employmentReviewBusy ||
                          !!employmentCandidateInstructions.trim()
                        }
                        onClick={() =>
                          handleEmploymentReview("correction_required")
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <AlertCircle className="h-4 w-4" />
                        Request Corrections
                      </button>
                    </div>
                  </div>
                )}

                {submission?.status !== "submitted" && (
                  <p className="mt-3 text-xs text-slate-500">
                    Employment verification is available after the candidate submits
                    onboarding.
                  </p>
                )}
              </section>
            </div>
          );

        case "emergency":
        return (
          <div className="space-y-5">
            <Section
              title="Emergency contacts"
              data={{
                contacts: Array.isArray(emergency)
                  ? emergency
                  : [],
              }}
            />
            {renderSectionVerification("emergency", "Emergency Contacts")}
          </div>
        );

      case "documents":
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900">
              All uploaded documents
            </h4>
            <DocumentList
              documents={documents}
              variant="grid"
              onReview={verificationCompleted ? undefined : handleDocumentReview}
              reviewBusyId={documentReviewBusyId}
              reviewReasons={documentReviewReasons}
              reviewErrors={documentReviewErrors}
              correctionInstructions={documentCorrectionInstructions}
              onCorrectionInstructionChange={(documentId, value) =>
                setDocumentCorrectionInstructions((previous) => ({
                  ...previous,
                  [documentId]: value,
                }))
              }
              onReasonChange={(documentId, value) =>
                setDocumentReviewReasons((previous) => ({
                  ...previous,
                  [documentId]: value,
                }))
              }
            />
          </div>
        );

      default:
        return null;
    }
  };

  const verifiedDocuments = documents.filter((document) =>
    ["verified", "approved", "accepted"].includes(
      document.verification_status.toLowerCase()
    )
  ).length;

  const pendingDocuments = documents.filter((document) =>
    ["pending", "uploaded", "submitted"].includes(
      document.verification_status.toLowerCase()
    )
  ).length;

  const rejectedDocuments = documents.filter((document) =>
    ["rejected", "correction_required"].includes(
      document.verification_status.toLowerCase()
    )
  ).length;

  const requiredSections = [
    {
      key: "personal",
      title: "Personal details",
      exists: isObject(personal),
      status: sectionVerificationConfig.personal.status,
      reviewedAt: sectionVerificationConfig.personal.reviewedAt,
    },
    {
      key: "address",
      title: "Address details",
      exists: isObject(address),
      status: sectionVerificationConfig.address.status,
      reviewedAt: sectionVerificationConfig.address.reviewedAt,
    },
    {
      key: "bank",
      title: "Bank details",
      exists: isObject(bank),
      status: sectionVerificationConfig.bank.status,
      reviewedAt: sectionVerificationConfig.bank.reviewedAt,
    },
    {
      key: "identity",
      title: "Identity details",
      exists: isObject(identity),
      status: sectionVerificationConfig.identity.status,
      reviewedAt: sectionVerificationConfig.identity.reviewedAt,
    },
    {
      key: "education",
      title: "Education details",
      exists: isObject(education),
      status: sectionVerificationConfig.education.status,
      reviewedAt: sectionVerificationConfig.education.reviewedAt,
    },
    {
      key: "emergency",
      title: "Emergency contacts",
      exists: Array.isArray(emergency) && emergency.length > 0,
      status: sectionVerificationConfig.emergency.status,
      reviewedAt: sectionVerificationConfig.emergency.reviewedAt,
    },
    ...(!isFresher
      ? [
          {
            key: "employment",
            title: "Employment verification",
            exists: isObject(employment),
            status: submission?.employment_verification_status ?? "pending",
            reviewedAt: submission?.employment_verified_at ?? null,
          },
        ]
      : []),

      {
        key: "accepted_offer",
        title: "Accepted offer",
        exists: true,
        status: acceptedOfferValid ? "verified" : "awaiting_acceptance",
        reviewedAt: null,
      },
  ];

  const latestDocuments = documents.reduce<DocumentItem[]>((latest, document) => {
    const existingIndex = latest.findIndex(
      (item) =>
        item.document_type === document.document_type &&
        item.employment_record_id === document.employment_record_id
    );

    if (existingIndex === -1) {
      latest.push(document);
      return latest;
    }

    const existing = latest[existingIndex];

    const isNewer =
      document.version > existing.version ||
      (document.version === existing.version &&
        (
          new Date(document.uploaded_at).getTime() >
            new Date(existing.uploaded_at).getTime() ||
          (new Date(document.uploaded_at).getTime() ===
            new Date(existing.uploaded_at).getTime() &&
            (
              new Date(document.created_at).getTime() >
                new Date(existing.created_at).getTime() ||
              (new Date(document.created_at).getTime() ===
                new Date(existing.created_at).getTime() &&
                document.id.localeCompare(existing.id) > 0)
            ))
        ));

    if (isNewer) {
      latest[existingIndex] = document;
    }

    return latest;
  }, []);


  const isDocumentVerified = (document: DocumentItem | undefined) =>
    Boolean(
      document &&
        ["verified", "approved", "accepted"].includes(
          document.verification_status.toLowerCase()
        ) &&
        !document.resubmission_requested_at
    );

  const getLatestDocument = (
    documentType: string,
    employmentRecordId: string | null = null
  ) =>
    latestDocuments.find(
      (document) =>
        document.document_type === documentType &&
        document.employment_record_id === employmentRecordId
    );

    const getVerifiedPayslipCount = (employmentRecordId: string) =>
    [
      "payslip_1",
      "payslip_2",
      "payslip_3",
      "payslip_4",
      "payslip_5",
      "payslip_6",
    ].filter((documentType) =>
      isDocumentVerified(
        getLatestDocument(documentType, employmentRecordId)
      )
    ).length;

  type RequiredDocumentItem = {
    key: string;
    label: string;
    documentType: string;
    employmentRecordId: string | null;
    kind?: "document" | "payslip_group";
  };

  const requiredDocumentItems: RequiredDocumentItem[] = [
    {
      key: "aadhaar_card",
      label: "Aadhaar Card",
      documentType: "aadhaar_card",
      employmentRecordId: null,
    },
    {
      key: "pan_card",
      label: "PAN Card",
      documentType: "pan_card",
      employmentRecordId: null,
    },
    {
      key: "driving_license",
      label: "Driving Licence",
      documentType: "driving_license",
      employmentRecordId: null,
    },
    {
      key: "passport_photo",
      label: "Passport-size Photo",
      documentType: "passport_photo",
      employmentRecordId: null,
    },
    {
      key: "bank_account_proof",
      label: "Bank Account Proof",
      documentType: "bank_account_proof",
      employmentRecordId: null,
    },
  ];

  const educationDetails = isObject(education) ? education : {};

  const hasEducationValues = (keys: string[]) =>
    keys.some((key) => {
      const value = educationDetails[key];
      return value !== null && value !== undefined && String(value).trim() !== "";
    });

  const hasNewEducationData = hasEducationValues([
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

  const requiredEducationTypes: string[] = ["education_10th"];

  if (hasNewEducationData) {
    const has12th = hasEducationValues([
      "twelfthInstitution",
      "twelfthBoard",
      "twelfthStream",
      "twelfthYearOfPassing",
      "twelfthResultType",
      "twelfthResult",
    ]);

    const hasDiploma = hasEducationValues([
      "diplomaInstitution",
      "diplomaAuthority",
      "diplomaCourse",
      "diplomaSpecialization",
      "diplomaYearOfPassing",
      "diplomaResultType",
      "diplomaResult",
      "diplomaResultTotal",
    ]);

    const hasGraduation = hasEducationValues([
      "graduationInstitution",
      "graduationUniversity",
      "graduationCourse",
      "graduationSpecialization",
      "graduationYearOfPassing",
      "graduationResultType",
      "graduationResult",
    ]);

    const hasPostGraduation = hasEducationValues([
      "postGraduationInstitution",
      "postGraduationUniversity",
      "postGraduationCourse",
      "postGraduationSpecialization",
      "postGraduationYearOfPassing",
      "postGraduationResultType",
      "postGraduationResult",
    ]);

    const hasOther = hasEducationValues([
      "otherQualification",
      "otherInstitution",
      "otherAuthority",
      "otherYearOfPassing",
      "otherResultType",
      "otherResult",
    ]);

    if (has12th || hasGraduation || hasPostGraduation) {
      requiredEducationTypes.push("education_12th");
    }

    if (hasDiploma) {
      requiredEducationTypes.push("education_diploma");
    }

    if (hasGraduation || hasPostGraduation) {
      requiredEducationTypes.push("education_graduation");
    }

    if (hasPostGraduation) {
      requiredEducationTypes.push("education_post_graduation");
    }

    if (hasOther) {
      requiredEducationTypes.push("education_other");
    }
  } else {
    const highestQualification = String(
      educationDetails.highestQualification ?? ""
    ).trim().toLowerCase();

    if (highestQualification) {
      const isOther =
        highestQualification === "other" ||
        highestQualification.includes("other qualification") ||
        highestQualification.includes("not listed");

      const is10thOnly =
        highestQualification.includes("10th") ||
        highestQualification.includes("secondary") ||
        highestQualification.includes("matric");

      const isPostgraduate = [
        "post graduate",
        "postgraduate",
        "master",
        "mba",
        "mca",
        "m.tech",
        "mtech",
        "m.sc",
        "msc",
        "phd",
        "doctorate",
        "post graduation",
      ].some((value) => highestQualification.includes(value));

      const isGraduation = [
        "graduation",
        "graduate",
        "bachelor",
        "degree",
        "b.tech",
        "btech",
        "b.e.",
        "be ",
        "b.com",
        "bcom",
        "b.sc",
        "bsc",
        "bca",
        "bba",
      ].some((value) => highestQualification.includes(value));

      const isDiplomaOrVocational = [
        "diploma",
        "iti",
        "vocational",
      ].some((value) => highestQualification.includes(value));

      if (isOther) {
        requiredEducationTypes.push("education_other");
      } else if (isDiplomaOrVocational) {
        // Legacy submissions stored Diploma / ITI under the old Other section.
        requiredEducationTypes.push("education_other");
      } else if (!is10thOnly) {
        requiredEducationTypes.push("education_12th");

        if (isPostgraduate) {
          requiredEducationTypes.push(
            "education_graduation",
            "education_post_graduation"
          );
        } else if (isGraduation) {
          requiredEducationTypes.push("education_graduation");
        }
      }
    }
  }

  for (const documentType of requiredEducationTypes) {
    requiredDocumentItems.push({
      key: documentType,
      label: documentLabels[documentType] || documentType,
      documentType,
      employmentRecordId: null,
    });
  }

  let employmentHistoryInvalid = false;
  let latestEmployerRecordId: string | null = null;

  if (!isFresher) {
    const employmentDetails = isObject(employment) ? employment : {};
    const employmentHistoryValue =
      employmentDetails.employmentHistory ??
      employmentDetails.employment_history;

    const employmentHistory = Array.isArray(employmentHistoryValue)
      ? employmentHistoryValue.filter(isObject)
      : [];

    if (employmentHistory.length === 0) {
      employmentHistoryInvalid = true;
    }

    const datedEmployments = employmentHistory.map((record) => {
      const endDate = String(
        record.employmentEndDate ??
          record.employment_end_date ??
          ""
      ).trim();

      return {
        record,
        employmentRecordId: String(record.id ?? "").trim(),
        endDate,
        endTimestamp: endDate ? new Date(endDate).getTime() : NaN,
      };
    });

    if (
      datedEmployments.some(
        (item) =>
          !item.employmentRecordId ||
          !item.endDate ||
          !Number.isFinite(item.endTimestamp)
      )
    ) {
      employmentHistoryInvalid = true;
    } else {
      const sortedEmployments = [...datedEmployments].sort(
        (a, b) => b.endTimestamp - a.endTimestamp
      );

      if (sortedEmployments.length === 0) {
        employmentHistoryInvalid = true;
      } else if (
        sortedEmployments.length > 1 &&
        sortedEmployments[0].endTimestamp ===
          sortedEmployments[1].endTimestamp
      ) {
        employmentHistoryInvalid = true;
      } else {
        latestEmployerRecordId =
          sortedEmployments[0]?.employmentRecordId ?? null;

        if (!latestEmployerRecordId) {
          employmentHistoryInvalid = true;
        }
      }
    }

    employmentHistory.forEach((record, index) => {
      const employmentRecordId = String(record.id ?? "").trim();

      if (!employmentRecordId) {
        return;
      }

      const companyName = String(
        record.previousCompanyName ??
          record.previous_company_name ??
          record.companyName ??
          record.company_name ??
          `Previous Employer ${index + 1}`
      );

      requiredDocumentItems.push(
        {
          key: `experience_document:${employmentRecordId}`,
          label: `Experience Letter / Certificate – ${companyName}`,
          documentType: "experience_document",
          employmentRecordId,
        },
        {
          key: `relieving_letter:${employmentRecordId}`,
          label: `Relieving Letter – ${companyName}`,
          documentType: "relieving_letter",
          employmentRecordId,
        },
        {
          key: `previous_joining_letter:${employmentRecordId}`,
          label: `Previous Company Joining Letter – ${companyName}`,
          documentType: "previous_joining_letter",
          employmentRecordId,
        },
        {
          key: `salary_hike_letter:${employmentRecordId}`,
          label: `Salary Hike / Increment Letter – ${companyName}`,
          documentType: "salary_hike_letter",
          employmentRecordId,
        }
      );
    });

    if (latestEmployerRecordId) {
      const latestEmployer = employmentHistory.find(
        (record) =>
          String(record.id ?? "").trim() === latestEmployerRecordId
      );

      const latestCompanyName = String(
        latestEmployer?.previousCompanyName ??
          latestEmployer?.previous_company_name ??
          latestEmployer?.companyName ??
          latestEmployer?.company_name ??
          "Most Recent Employer"
      );

      requiredDocumentItems.push({
        key: `payslip_group:${latestEmployerRecordId}`,
        label: `Minimum 3 verified payslips – ${latestCompanyName}`,
        documentType: "payslip_group",
        employmentRecordId: latestEmployerRecordId,
        kind: "payslip_group",
      });
    }
  }

  const isRequiredDocumentItemVerified = (
    item: RequiredDocumentItem
  ) => {
    if (item.kind === "payslip_group") {
      return (
        item.employmentRecordId !== null &&
        getVerifiedPayslipCount(item.employmentRecordId) >= 3
      );
    }

    return isDocumentVerified(
      getLatestDocument(item.documentType, item.employmentRecordId)
    );
  };

  const verifiedRequiredDocuments = requiredDocumentItems.filter(
    isRequiredDocumentItemVerified
  ).length;

  const totalRequiredDocuments = requiredDocumentItems.length;

  const requiredDocumentProgress = Math.round(
    (verifiedRequiredDocuments / Math.max(totalRequiredDocuments, 1)) * 100
  );

  const hrVerificationSections = requiredSections.filter(
    (section) => section.key !== "accepted_offer"
  );

  const verifiedSections = requiredSections.filter(
    (section) =>
      section.exists && section.status.toLowerCase() === "verified"
  ).length;

  const totalSections = requiredSections.length;

  const verifiedSectionCount = hrVerificationSections.filter(
    (section) =>
      section.exists && section.status.toLowerCase() === "verified"
  ).length;

  const totalVerificationItems =
    totalSections +
    totalRequiredDocuments +
    (employmentHistoryInvalid ? 1 : 0);

  const verifiedVerificationItems =
    verifiedSections + verifiedRequiredDocuments;

  const overallVerificationProgress = Math.floor(
    (verifiedVerificationItems / Math.max(totalVerificationItems, 1)) * 100
  );

  const joiningLetterReady =
    acceptedOfferValid &&
    onboardingStatus === "submitted" &&
    submission !== null &&
    submission.status === "submitted" &&
    !decryptionFailed &&
    !employmentHistoryInvalid &&
    requiredSections.every(
      (section) =>
        section.exists && section.status.toLowerCase() === "verified"
    ) &&
    verifiedRequiredDocuments === totalRequiredDocuments;

  const canConvertEmployee =
      canSendJoiningLetter &&
      joiningLetterReady &&
      verificationCompleted &&
      String(candidate.status ?? "").toLowerCase() ===
        "joining_letter_sent" &&
      String(candidate.joining_letter_send_status ?? "").toLowerCase() ===
        "sent" &&
      !candidate.employee_record_id &&
      !["processing", "completed"].includes(
        String(candidate.conversion_status ?? "").toLowerCase()
  );

  return (
    <div className="space-y-5">
      {/* Candidate profile header */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-bold text-indigo-700">
                {getInitials(fullName)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {fullName || "Candidate"}
                  </h2>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    <Clock className="h-3.5 w-3.5" />
                    {statusText[onboardingStatus] ||
                      statusLabel(onboardingStatus)}
                  </span>

                  {verificationCompleted && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      HR Verified
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {String(candidate.designation || "Designation not provided")}
                  {" · "}
                  {String(candidate.department || "Department not provided")}
                </p>

                <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {String(candidate.personal_email || "Email not provided")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      {String(candidate.mobile_number || "Phone not provided")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>Joining: {formatDate(candidate.joining_date)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      {String(candidate.work_location || "Location not provided")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      {String(
                        candidate.employment_type ||
                          "Employment type not provided"
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      {candidate.experience_level
                        ? label(String(candidate.experience_level))
                        : "Experience not provided"}
                    </span>
                  </div>
                </div>

                {submission && (
                  <p className="mt-3 text-xs text-slate-400">
                    Submission Version {submission.version}
                    {" · "}
                    Updated {formatDateTime(submission.updated_at)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {acceptedOfferValid && offer?.id ? (
                <a
                  href={`/api/joining/documents/${String(offer.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4" />
                  View Accepted Offer
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  Offer Not Verified
                </span>
              )}

              <button
                type="button"
                disabled={!canConvertEmployee}
                onClick={() => {
                  setConversionError("");
                  setConversionModalOpen(true);
                }}
                title={
                  canConvertEmployee
                    ? "Review and confirm employee conversion."
                    : "Complete onboarding verification and successfully send the joining letter before conversion."
                }
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
                  canConvertEmployee
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "cursor-not-allowed bg-slate-300 text-white"
                }`}
              >
                Review & Convert
                {!canConvertEmployee && <Lock className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Overall verification progress */}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Onboarding verification progress
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {verifiedVerificationItems} of {totalVerificationItems} applicable
                  verification items completed
                </p>
              </div>

              <span className="text-lg font-bold tabular-nums text-indigo-700">
                {overallVerificationProgress}%
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  verificationCompleted ? "bg-emerald-500" : "bg-indigo-600"
                }`}
                style={{
                  width: `${overallVerificationProgress}%`,
                }}
              />
            </div>

            {verificationCompleted && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                HR verification completed
                {verificationCompletedAt
                  ? ` on ${formatDateTime(verificationCompletedAt)}`
                  : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Main workspace navigation */}

      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Employee Onboarding Workspace
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Review candidate information, documents, verification, and accepted
            offer from one workspace.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {(
            [
              {
                id: "details",
                title: "Candidate Details",
                description: "Personal, education and employment information",
                icon: Briefcase,
                count: null,
              },
              {
                id: "documents",
                title: "Documents",
                description: "Uploaded documents and review status",
                icon: FileText,
                count: `${verifiedDocuments}/${documents.length}`,
              },
              {
                id: "verification",
                title: "HR Verification",
                description: "Review all applicable onboarding requirements",
                icon: ShieldCheck,
                count: `${overallVerificationProgress}%`,
              },
              {
                id: "offer",
                title: "Accepted Offer",
                description: "Accepted compensation and statutory terms",
                icon: Lock,
                count: acceptedOfferValid ? "Accepted" : "Pending",
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const selected = workspaceSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setWorkspaceSection(item.id)}
                className={`group rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-indigo-300 bg-indigo-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      selected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {item.count && (
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                        selected
                          ? "bg-white text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </div>

                <p
                  className={`mt-3 text-xs font-bold ${
                    selected ? "text-indigo-900" : "text-slate-800"
                  }`}
                >
                  {item.title}
                </p>

                <p className="mt-1 text-[10px] leading-4 text-slate-500">
                  {item.description}
                </p>

                <div
                  className={`mt-3 h-1 rounded-full ${
                    selected ? "bg-indigo-600" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected workspace content */}

      <section className="min-h-[360px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Candidate Details */}

        {workspaceSection === "details" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Candidate Details
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Submitted information from the candidate&ands;s onboarding form.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Candidate submitted
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                <Lock className="h-3 w-3" />
                Read-only
              </span>
            </div>

            {/* Candidate detail sections as selectable tiles, not tabs */}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-left text-[11px] font-semibold transition ${
                      selected
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-800">
                  {activeTabInfo?.label || "Candidate Information"}
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  {tabDescriptions[activeTab] ||
                    "Candidate onboarding information"}
                </p>
              </div>

              {renderActiveTab()}
            </div>
          </div>
        )}

        {/* Documents */}

        {workspaceSection === "documents" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Candidate Documents
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Review uploaded documents and their current verification status.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xl font-bold text-emerald-700">
                  {verifiedDocuments}
                </p>
                <p className="mt-1 text-[10px] font-medium text-emerald-700">
                  Verified
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <p className="text-xl font-bold text-amber-700">
                  {pendingDocuments}
                </p>
                <p className="mt-1 text-[10px] font-medium text-amber-700">
                  Pending
                </p>
              </div>

              <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                <p className="text-xl font-bold text-red-700">
                  {rejectedDocuments}
                </p>
                <p className="mt-1 text-[10px] font-medium text-red-700">
                  Rejected
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Uploaded documents
                </h4>
                <p className="mt-1 text-[10px] text-slate-500">
                  {documents.length} document records
                </p>
              </div>

              {verificationCompleted && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">
                  <Lock className="h-3 w-3" />
                  Review locked
                </span>
              )}
            </div>

            <div className="max-h-[600px] overflow-y-auto pr-1">
              <DocumentList
                documents={documents}
                variant="grid"
                onReview={
                  verificationCompleted ? undefined : handleDocumentReview
                }
              />
            </div>
          </div>
        )}

        {/* HR Verification */}

        {workspaceSection === "verification" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  HR Verification
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Review candidate information and required documents before
                  completing HR verification.
                </p>
              </div>

              {verificationCompleted && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed and locked
                </span>
              )}
            </div>

            {/* Verification summary */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Overall verification
                  </p>

                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {verifiedVerificationItems}
                    <span className="text-sm font-semibold text-slate-400">
                      {" "}/ {totalVerificationItems}
                    </span>
                  </p>
                </div>

                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm">
                  {overallVerificationProgress}% complete
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{
                    width: `${overallVerificationProgress}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-500">
                <span>
                  {verifiedSectionCount}/{hrVerificationSections.length} information
                  sections verified
                </span>
                <span>
                  {verifiedRequiredDocuments}/{totalRequiredDocuments} required
                  documents verified
                </span>
              </div>
            </div>

            {/* Candidate information verification */}

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-800">
                  Candidate Information Verification
                </h4>

                <span className="text-[10px] text-slate-400">
                  Applicable sections only
                </span>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
                {requiredSections.map((section) => {
                  const status = section.status.toLowerCase();

                  const sectionLabel =
                    section.key === "accepted_offer" && !acceptedOfferValid
                      ? "Awaiting Acceptance"
                      : !section.exists
                        ? "Not Submitted"
                        : status === "verified"
                          ? "Verified"
                          : status === "correction_required"
                            ? "Correction Required"
                            : "Pending Verification";

                  const statusClass =
                    section.key === "accepted_offer" && !acceptedOfferValid
                      ? "bg-amber-50 text-amber-700"
                      : !section.exists
                        ? "bg-amber-50 text-amber-700"
                        : status === "verified"
                          ? "bg-emerald-50 text-emerald-700"
                          : status === "correction_required"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700";

                  return (
                    <div
                      key={section.key}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700">
                          {section.title}
                        </p>

                        {section.reviewedAt && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Reviewed:{" "}
                            {new Date(section.reviewedAt).toLocaleDateString(
                              "en-IN"
                            )}
                          </p>
                        )}
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}
                      >
                        {status === "verified" && section.exists ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {sectionLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Required document verification */}

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-800">
                  Required Document Verification
                </h4>

                <span className="text-[10px] font-semibold text-slate-500">
                  {verifiedRequiredDocuments}/{totalRequiredDocuments} verified
                </span>
              </div>

              <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${requiredDocumentProgress}%`,
                  }}
                />
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
                {requiredDocumentItems.map((item) => {
                  const isPayslipGroup = item.kind === "payslip_group";

                  const document = isPayslipGroup
                    ? undefined
                    : getLatestDocument(item.documentType, item.employmentRecordId);

                  const verifiedPayslipCount =
                    isPayslipGroup && item.employmentRecordId
                      ? getVerifiedPayslipCount(item.employmentRecordId)
                      : 0;

                  const verified = isPayslipGroup
                    ? verifiedPayslipCount >= 3
                    : isDocumentVerified(document);

                  const documentStatus =
                    document?.verification_status?.toLowerCase() ?? "";

                  const correctionRequested = Boolean(
                    document?.resubmission_requested_at
                  );

                  const correctionRequired =
                    correctionRequested ||
                    documentStatus === "resubmission_required" ||
                    documentStatus === "rejected";

                  const documentStatusLabel = isPayslipGroup
                    ? `${verifiedPayslipCount} / 3 verified`
                    : !document
                      ? "Not Uploaded"
                      : verified
                        ? "Verified"
                        : correctionRequested
                          ? "Correction Requested"
                          : correctionRequired
                            ? "Correction Required"
                            : "Pending Review";

                  const documentStatusClass = verified
                    ? "bg-emerald-50 text-emerald-700"
                    : correctionRequired
                      ? "bg-red-50 text-red-700"
                      : isPayslipGroup && verifiedPayslipCount > 0
                        ? "bg-amber-50 text-amber-700"
                        : !document && !isPayslipGroup
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-50 text-amber-700";

                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700">
                          {item.label}
                        </p>

                        {isPayslipGroup && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            HR must verify at least three payslips for the latest employer.
                          </p>
                        )}

                        {document?.reviewed_at && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Reviewed:{" "}
                            {new Date(document.reviewed_at).toLocaleDateString("en-IN")}
                          </p>
                        )}
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${documentStatusClass}`}
                      >
                        {verified ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {documentStatusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mt-2 text-[10px] text-slate-400">
                Only applicable required documents are counted. Optional
                documents, including passport, are excluded from this progress.
              </p>
            </div>

            {/* Verification warnings */}

            {decryptionFailed && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-800">
                  Sensitive submission data could not be decrypted.
                </p>
              </div>
            )}

            {!submission && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">
                  Candidate has not submitted onboarding details yet.
                </p>
              </div>
            )}

            {/* Complete verification action */}

            <div className="border-t border-slate-100 pt-5">
              {verificationCompleted ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                    <div>
                      <p className="text-sm font-bold text-emerald-900">
                        HR Verification Completed
                      </p>

                      <p className="mt-1 text-xs leading-5 text-emerald-800">
                        Verification has been completed and the onboarding
                        review actions are now locked.
                      </p>

                      {verificationCompletedAt && (
                        <p className="mt-2 text-[11px] text-emerald-700">
                          Completed on: {formatDateTime(verificationCompletedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-indigo-950">
                        Complete HR Verification
                      </p>

                      <p className="mt-1 max-w-xl text-xs leading-5 text-indigo-800">
                        This permanently records HR verification completion and
                        locks further onboarding review actions. Make sure all
                        applicable sections and documents have been verified.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        verificationCompleting ||
                        overallVerificationProgress !== 100 ||
                        !joiningLetterReady
                      }
                      onClick={handleCompleteVerification}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {verificationCompleting ? (
                        <>
                          <Clock className="h-4 w-4" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          Complete Verification
                        </>
                      )}
                    </button>
                  </div>

                  {verificationCompletionError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                      {verificationCompletionError}
                    </p>
                  )}

                  {(!joiningLetterReady ||
                    overallVerificationProgress !== 100) && (
                    <p className="mt-3 text-[11px] text-amber-800">
                      Complete all required HR verification items before this
                      action becomes available.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Accepted Offer */}

        {workspaceSection === "offer" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Accepted Offer & Salary Structure
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Compensation and statutory terms confirmed by the candidate.
              </p>
            </div>

            {acceptedOfferValid ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-indigo-700 shadow-sm">
                      <Lock className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-indigo-950">
                        Accepted Offer · Read Only
                      </p>
                      <p className="mt-0.5 text-[11px] text-indigo-700">
                        Changes require a revised offer and fresh candidate
                        acceptance.
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-[10px] font-bold text-indigo-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Terms Locked
                  </span>
                </div>

                {/* Compensation overview */}

                <div>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Compensation Overview
                  </h4>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                      <p className="text-xs font-medium text-indigo-700">
                        Annual CTC
                      </p>
                      <p className="mt-2 text-xl font-bold tabular-nums text-indigo-950">
                        {formatCurrency(compensation.annualCtc)}
                      </p>
                      <p className="mt-1 text-[10px] text-indigo-600">
                        Accepted annual compensation
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Monthly CTC
                      </p>
                      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
                        {formatCurrency(compensation.monthlyCtc)}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Monthly compensation
                      </p>
                    </div>
                  </div>
                </div>

                {/* Salary breakdown */}

                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Salary Breakdown
                    </h4>
                    <span className="text-[10px] font-medium text-slate-400">
                      Monthly and annual values
                    </span>
                  </div>

                  <div className="grid items-start gap-3 xl:grid-cols-2">
                    <SalaryComponentCard
                      title="Earnings"
                      items={
                        Array.isArray(compensation.earnings)
                          ? compensation.earnings
                          : []
                      }
                      type="earning"
                    />

                    <SalaryComponentCard
                      title="Employee Deductions"
                      items={
                        Array.isArray(compensation.employeeDeductions)
                          ? compensation.employeeDeductions
                          : []
                      }
                      type="deduction"
                    />
                  </div>
                </div>

                {/* Estimated take-home */}

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-emerald-800">
                        Estimated Monthly Take-home
                      </p>
                      <p className="mt-1 text-[10px] text-emerald-700">
                        After applicable employee deductions
                      </p>
                    </div>

                    <p className="text-2xl font-bold tabular-nums text-emerald-900">
                      {formatCurrency(compensation.estimatedMonthlyTakeHome)}
                    </p>
                  </div>
                </div>

                {/* Statutory eligibility */}

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-800">
                      Statutory Eligibility
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      As accepted in the offer
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(statutory).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            value === true
                              ? "bg-emerald-500"
                              : value === false
                                ? "bg-slate-300"
                                : "bg-amber-400"
                          }`}
                        />

                        {label(key)}

                        <span className="text-slate-500">
                          {value === true
                            ? "Yes"
                            : value === false
                              ? "No"
                              : display(value)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {typeof compensation.takeHomeNote === "string" &&
                  compensation.takeHomeNote && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                      {compensation.takeHomeNote}
                    </p>
                  )}

                {/* Original accepted offer */}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Original Accepted Offer
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Authoritative candidate-accepted document
                    </p>
                  </div>

                  {offer?.id ? (
                    <a
                      href={`/api/joining/documents/${String(offer.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2.5 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View Original Offer
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs font-semibold text-red-600">
                      Document unavailable
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-bold text-red-800">
                      Accepted offer could not be verified
                    </p>
                    <p className="mt-1 text-xs leading-5 text-red-700">
                      The accepted offer document or compensation snapshot is
                      missing or invalid. Onboarding cannot proceed until the
                      offer record is corrected and verified.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Onboarding workflow actions */}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900">
            Onboarding Workflow
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Manage onboarding communication and the next joining steps.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            HR Verification
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            This permanently records HR verification completion and locks further
            onboarding review actions. Make sure all applicable sections and
            documents have been verified.
          </p>

          {verificationCompleted ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                HR verification completed
                {verificationCompletedAt && (
                  <span>
                    {" "}on {new Date(verificationCompletedAt).toLocaleString()}
                  </span>
                )}
              </div>

              {verificationReopeningError && (
                <p className="text-sm text-red-600">
                  {verificationReopeningError}
                </p>
              )}

              <button
                type="button"
                onClick={handleReopenVerification}
                disabled={verificationReopening}
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verificationReopening
                  ? "Reopening Verification..."
                  : "Reopen HR Verification"}
              </button>
              <p className="text-xs text-slate-500">
                Reopening unlocks HR review and allows a fresh onboarding submission. The accepted offer, joining letter, and previous submission history remain preserved.
              </p>
            </div>
          ) : (
            <>
              {verificationCompletionError && (
                <p className="mt-2 text-sm text-red-600">
                  {verificationCompletionError}
                </p>
              )}

              <button
                type="button"
                onClick={handleCompleteVerification}
                disabled={
                  verificationCompleting ||
                  overallVerificationProgress !== 100 ||
                  !joiningLetterReady
                }
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verificationCompleting
                  ? "Completing Verification..."
                  : "Complete HR Verification"}
              </button>
            </>
          )}
        </div>



        <div className="grid gap-3 md:grid-cols-2">
          {/* Onboarding link */}

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <FileText className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800">
                  Onboarding Link
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Prepare or send the onboarding link to the candidate.
                </p>
              </div>
            </div>

            <div className="mt-4">
              {acceptedOfferValid ? (
                <OnboardingLinkAction
                  candidateId={candidateId}
                  onboardingStatus={onboardingStatus}
                  hasSubmission={hasSubmission}
                  verificationCompleted={verificationCompleted}
                />
              ) : (
                <p className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-700">
                  Verify the accepted offer before preparing or sending an
                  onboarding link.
                </p>
              )}
            </div>
          </div>

          {/* Request corrections */}

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <AlertCircle className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800">
                  Candidate Corrections
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Request corrections when submitted information needs changes.
                </p>
              </div>
            </div>

            <div className="mt-4">
              {acceptedOfferValid && onboardingStatus === "submitted" ? (
                <RequestOnboardingCorrectionsAction
                  candidateId={candidateId}
                  verificationCompleted={verificationCompleted}
                />
              ) : acceptedOfferValid &&
                onboardingStatus === "correction_required" ? (
                <ResendOnboardingCorrectionLinkAction
                  candidateId={candidateId}
                  verificationCompleted={verificationCompleted}
                />
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500">
                  Correction actions are available when the candidate&ands;s
                  onboarding status allows them.
                </p>
              )}
            </div>
          </div>

          {/* Joining Letter */}

          {canSendJoiningLetter && (
            <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <FileCheck className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Joining Letter
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">
                      Generate the official joining letter after HR verification
                      is completed.
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {candidate.joining_letter_sent_at ||
                  String(candidate.joining_letter_send_status ?? "").toLowerCase() ===
                    "sent" ? (
                    <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Joining Letter Sent
                    </span>
                  ) : String(
                      candidate.joining_letter_send_status ?? ""
                    ).toLowerCase() === "sending" ? (
                    <span className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800">
                      <Clock className="h-4 w-4" />
                      Joining Letter is being sent
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!joiningLetterReady || !verificationCompleted}
                      onClick={() => {
                        setJoiningLetterError("");
                        setJoiningLetterModalOpen(true);
                      }}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition ${
                        joiningLetterReady && verificationCompleted
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      }`}
                      title={
                        joiningLetterReady && verificationCompleted
                          ? "Prepare and send the Joining Letter"
                          : "Complete HR verification first"
                      }
                    >
                      {joiningLetterReady && verificationCompleted ? (
                        <FileCheck className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      Send Joining Letter
                    </button>
                  )}
                </div>
              </div>

              {!verificationCompleted && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800">
                  Complete HR verification before generating the Joining Letter.
                  Current verification progress: {overallVerificationProgress}%.
                </p>
              )}

              {joiningLetterSuccess && (
                <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                  {joiningLetterSuccess}
                </p>
              )}

              {joiningLetterError && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {joiningLetterError}
                </p>
              )}
            </div>
          )}

          {/* Employee conversion */}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-700">
                    Employee Conversion
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Employee creation and portal access will be handled through
                    the separate secure conversion workflow.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!canConvertEmployee}
                onClick={() => {
                  setConversionError("");
                  setConversionModalOpen(true);
                }}
                title={
                  canConvertEmployee
                    ? "Review and confirm employee conversion."
                    : "Complete onboarding verification and successfully send the joining letter before conversion."
                }
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition ${
                  canConvertEmployee
                    ? "border-indigo-600 bg-white text-indigo-700 hover:bg-indigo-50"
                    : "cursor-not-allowed border-slate-200 bg-white text-slate-400"
                }`}
              >
                Review & Convert Employee
                {!canConvertEmployee && <Lock className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Current onboarding status */}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Current onboarding status
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-800">
              {statusText[onboardingStatus] || statusLabel(onboardingStatus)}
            </p>
          </div>

          {submission && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-600">
              Submission Version {submission.version}
            </span>
          )}
        </div>
      </section>

      {/* Joining Letter modal */}

      {joiningLetterModalOpen &&
        canSendJoiningLetter &&
        verificationCompleted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Send Joining Letter
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Confirm the joining details before sending the official
                    letter.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setJoiningLetterModalOpen(false)}
                  disabled={joiningLetterBusy}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Date of Joining
                  </label>

                  <input
                    type="date"
                    value={joiningLetterDate}
                    min={minJoiningDate}
                    onChange={(event) =>
                      setJoiningLetterDate(event.target.value)
                    }
                    disabled={joiningLetterBusy}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Probation Period
                  </label>

                  <select
                    value={joiningLetterProbation}
                    onChange={(event) =>
                      setJoiningLetterProbation(Number(event.target.value))
                    }
                    disabled={joiningLetterBusy}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value={0}>No probation</option>
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>

                {joiningLetterError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {joiningLetterError}
                  </p>
                )}

                <div className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  The Joining Letter will be generated using the accepted offer
                  details and the joining date and probation period selected
                  above.
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setJoiningLetterModalOpen(false)}
                  disabled={joiningLetterBusy}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSendJoiningLetter}
                  disabled={
                    joiningLetterBusy ||
                    !joiningLetterReady ||
                    !verificationCompleted ||
                    !joiningLetterDate
                  }
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {joiningLetterBusy ? "Sending..." : "Confirm & Send"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Employee Conversion modal */}
      {conversionModalOpen && canConvertEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Review & Convert Employee
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Review the final joining details before creating the employee
                  record and account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConversionModalOpen(false)}
                disabled={conversionBusy}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Actual Date of Joining
                </label>
                <input
                  type="date"
                  value={actualJoiningDate}
                  onChange={(event) =>
                    setActualJoiningDate(event.target.value)
                  }
                  disabled={conversionBusy}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  You may select an actual joining date earlier than the
                  scheduled date. Future dates are not allowed.
                </p>
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs font-semibold text-indigo-900">
                  Official Company Email
                </p>

                {officialEmailPreview ? (
                  <>
                    <p className="mt-1 break-all text-sm font-bold text-indigo-950">
                      {officialEmailPreview}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-indigo-800">
                      Generated using the name in the accepted offer and
                      checked against existing employee and Auth accounts.
                      Final availability is rechecked during conversion.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-red-700">
                    {officialEmailPreviewError ||
                      "Official email preview is currently unavailable. The conversion process will perform its own availability check."}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                Confirm only after reviewing the accepted offer, submitted
                onboarding information, HR verification and successfully sent
                Joining Letter. Accepted offer terms will not be changed.
              </div>

              {conversionError && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
                  {conversionError}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConversionModalOpen(false)}
                disabled={conversionBusy}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConvertEmployee}
                disabled={
                  conversionBusy ||
                  !actualJoiningDate ||
                  !canConvertEmployee
                }
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {conversionBusy ? "Converting..." : "Confirm & Create Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

            {conversionResult && (
        <div
          className={`mb-4 rounded-xl border p-4 ${
            conversionResult.emailSent
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              conversionResult.emailSent
                ? "text-green-800"
                : "text-amber-800"
            }`}
          >
            Employee created successfully
          </p>

          {conversionResult.emailSent ? (
            <p className="mt-1 text-xs leading-5 text-green-700">
              Credentials email was successfully accepted by the email
              service and sent to the candidate&and;s personal email address.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-amber-700">
              Employee account was created, but the credentials email
              could not be sent. HR follow-up is required.
            </p>
          )}

          {conversionResult.emailError && (
            <p className="mt-2 text-xs leading-5 text-amber-800">
              Email error: {conversionResult.emailError}
            </p>
          )}

          {!conversionResult.statusSaved && (
            <p className="mt-2 text-xs leading-5 text-red-700">
              Email status could not be saved in the candidate record.
              {conversionResult.statusError
                ? ` Details: ${conversionResult.statusError}`
                : ""}
              {" "}Check the email provider and candidate record before
              attempting any follow-up. Do not blindly resend credentials.
            </p>
          )}
        </div>
      )}


      {/* Accepted terms warning */}

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

        <div>
          <p className="text-sm font-semibold text-amber-900">
            Accepted offer terms are immutable
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-800">
            Salary, compensation components, statutory eligibility and other
            accepted offer terms are read-only throughout onboarding. Any changes
            require a revised offer and fresh candidate acceptance.
          </p>
        </div>
      </div>
    </div>
  );
}