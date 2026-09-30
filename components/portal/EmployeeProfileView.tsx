"use client";

import { useState } from "react";

import {
  Department,
  Employee,
  ProfileChangeRequest,
} from "@/lib/types";

import {
  User,
  MapPin,
  CreditCard,
  Briefcase,
  FileText,
  Edit3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Phone,
  Mail,
  Building,
  UploadCloud,
  Trash2,
  Plus,
  CalendarDays,
  UserRound,
  MapPinned,
  Timer,
} from "lucide-react";

import ProfileProgressBar from "./ProfileProgressBar";

interface EmployeeProfileViewProps {
  employee: Employee;
  pendingRequest: ProfileChangeRequest | null;
  departments: Department[];
}

interface PreviousEmployment {
  id: number;
  company_name: string;
  designation: string;
  start_date: string;
  end_date: string;
  reporting_manager: string;
  work_location: string;
}

export default function EmployeeProfileView({
  employee,
  pendingRequest: initialPendingRequest,
  departments,
}: EmployeeProfileViewProps) {
  /* =========================================================
     TAB STATE
  ========================================================= */

  const [activeTab, setActiveTab] = useState<
    "personal" | "address" | "bank" | "employment" | "document"
  >("personal");

  /* =========================================================
     PROFILE EDIT STATE
  ========================================================= */

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [hasStartedProfileEditing, setHasStartedProfileEditing] =
    useState(false);

  const [pendingRequest, setPendingRequest] =
    useState<ProfileChangeRequest | null>(initialPendingRequest);

  const [loading, setLoading] = useState(false);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  /* =========================================================
     PROFILE PHOTO STATE
  ========================================================= */

  const [profilePhoto, setProfilePhoto] =
    useState<string | null>(
      employee.profile_photo_url || null
    );

  const [profilePhotoError, setProfilePhotoError] =
    useState<string | null>(null);

  /* =========================================================
     PROFILE PHOTO CHANGE
  ========================================================= */

  const handleProfilePhotoChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setProfilePhotoError(null);

    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setProfilePhotoError(
        "Please select a valid image file."
      );

      e.target.value = "";

      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setProfilePhotoError(
        "Profile photo must be less than 5MB."
      );

      e.target.value = "";

      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfilePhoto(reader.result);
      }
    };

    reader.readAsDataURL(file);

    setHasStartedProfileEditing(true);
  };

  /* =========================================================
     DOCUMENT STATE
  ========================================================= */

  const [selectedDocumentType, setSelectedDocumentType] =
    useState("");

  const [selectedDocumentFile, setSelectedDocumentFile] =
    useState<File | null>(null);

  const [documentError, setDocumentError] =
    useState<string | null>(null);

  const [documentSuccess, setDocumentSuccess] =
    useState<string | null>(null);

  /* =========================================================
     DOCUMENT TYPES
  ========================================================= */

  const documentTypes = [
    "10th Certificate",
    "12th Certificate",
    "Graduation Certificate",
    "Post-Graduation Certificate",
    "Experience Letter",
    "Relieving Letter",
    "Offer Letter",
    "Resume",
    "Aadhar Card",
    "PAN Card",
    "Passport",
    "Other",
  ];

  /* =========================================================
     EDIT FORM DATA
  ========================================================= */

  const [editFormData, setEditFormData] = useState({
    /* Personal */

    phone: employee.phone || "",

    date_of_birth: employee.date_of_birth || "",

    gender: employee.gender || "",

    blood_group: employee.blood_group || "",

    marital_status: employee.marital_status || "single",

    /* Address */

    address: employee.address || "",

    city: employee.city || "",

    state: employee.state || "",

    pincode: employee.pincode || "",

    /* Emergency */

    emergency_contact_name:
      employee.emergency_contact_name || "",

    emergency_contact_phone:
      employee.emergency_contact_phone || "",

    emergency_contact_relation:
      employee.emergency_contact_relation || "",

    /* Employment */

    department_id: employee.department_id || "",

    designation: employee.designation || "",

    probation_end_date:
      employee.probation_end_date || "",

    confirmation_date:
      employee.confirmation_date || "",

    reporting_manager:
      employee.reporting_manager || "",

    work_location:
      employee.work_location || "",

    /* Bank & KYC */

    bank_name: employee.bank_name || "",

    bank_account_number:
      employee.bank_account_number || "",

    ifsc_code: employee.ifsc_code || "",

    pan_number: employee.pan_number || "",

    aadhar_number:
      employee.aadhar_number || "",

    uan_number:
      employee.uan_number || "",
  });

  /* =========================================================
     PREVIOUS EMPLOYMENT STATE
  ========================================================= */

  const [previousEmployments, setPreviousEmployments] =
    useState<PreviousEmployment[]>([
      {
        id: Date.now(),
        company_name: "",
        designation: "",
        start_date: "",
        end_date: "",
        reporting_manager: "",
        work_location: "",
      },
    ]);

  /* =========================================================
     INPUT CHANGE
  ========================================================= */

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement |
        HTMLSelectElement |
        HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    setHasStartedProfileEditing(true);

    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* =========================================================
     ADD PREVIOUS EMPLOYMENT
  ========================================================= */

  const addPreviousEmployment = () => {
    setHasStartedProfileEditing(true);

    setPreviousEmployments((prev) => [
      ...prev,
      {
        id: Date.now(),
        company_name: "",
        designation: "",
        start_date: "",
        end_date: "",
        reporting_manager: "",
        work_location: "",
      },
    ]);
  };

  /* =========================================================
     DELETE PREVIOUS EMPLOYMENT
  ========================================================= */

  const deletePreviousEmployment = (id: number) => {
    setHasStartedProfileEditing(true);

    setPreviousEmployments((prev) =>
      prev.filter(
        (employment) => employment.id !== id
      )
    );
  };

  /* =========================================================
     PREVIOUS EMPLOYMENT INPUT CHANGE
  ========================================================= */

  const handlePreviousEmploymentChange = (
    id: number,
    field: keyof Omit<PreviousEmployment, "id">,
    value: string
  ) => {
    setHasStartedProfileEditing(true);

    setPreviousEmployments((prev) =>
      prev.map((employment) =>
        employment.id === id
          ? {
              ...employment,
              [field]: value,
            }
          : employment
      )
    );
  };

  /* =========================================================
     PROFILE FORM SUBMIT
  ========================================================= */

  const handleFormSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setLoading(true);
    setSuccessMessage(null);

    try {
      const changedFields = Object.fromEntries(
        Object.entries(editFormData).filter(
          ([key, value]) => {
            const currentValue =
              employee[key as keyof Employee] ?? "";

            return (
              String(value ?? "") !==
              String(currentValue)
            );
          }
        )
      );

      /* =====================================================
         PREVIOUS EMPLOYMENT DATA
      ===================================================== */

      const filledPreviousEmployments =
        previousEmployments.filter(
          (employment) =>
            employment.company_name ||
            employment.designation ||
            employment.start_date ||
            employment.end_date ||
            employment.reporting_manager ||
            employment.work_location
        );

      if (
        filledPreviousEmployments.length > 0
      ) {
        (
          changedFields as Record<
            string,
            unknown
          >
        ).previous_employments =
          filledPreviousEmployments;
      }

      const previousValues =
        Object.fromEntries(
          Object.keys(changedFields).map(
            (key) => [
              key,
              employee[
                key as keyof Employee
              ] ?? "",
            ]
          )
        );

      if (
        Object.keys(changedFields).length === 0
      ) {
        setSuccessMessage(
          "No profile changes were made."
        );

        setLoading(false);

        return;
      }

      const res = await fetch(
        "/api/profile-change-requests",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            employeeId: employee.id,

            requestedChanges:
              changedFields,

            previousValues,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to submit profile change request"
        );
      }

      const data = await res.json();

      setPendingRequest(
        data.request
      );

      setIsEditModalOpen(false);

      setSuccessMessage(
        "Your profile change request has been sent to HR for approval."
      );
    } catch (err) {
      console.error(
        "Submit edit error:",
        err
      );

      setSuccessMessage(
        "Unable to submit your profile change request."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     DOCUMENT FILE CHANGE
  ========================================================= */

  const handleDocumentFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setDocumentError(null);
    setDocumentSuccess(null);

    const file = e.target.files?.[0];

    if (!file) {
      setSelectedDocumentFile(null);
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setSelectedDocumentFile(null);

      setDocumentError(
        "File size must be less than 5MB."
      );

      e.target.value = "";

      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
    ];

    if (
      !allowedTypes.includes(file.type)
    ) {
      setSelectedDocumentFile(null);

      setDocumentError(
        "Only PDF, PNG and JPG files are allowed."
      );

      e.target.value = "";

      return;
    }

    setSelectedDocumentFile(file);
  };

  /* =========================================================
     DOCUMENT UPLOAD
  ========================================================= */

  const handleDocumentUpload = () => {
    setDocumentError(null);
    setDocumentSuccess(null);

    if (!selectedDocumentType) {
      setDocumentError(
        "Please select a document type."
      );

      return;
    }

    if (!selectedDocumentFile) {
      setDocumentError(
        "Please choose a file."
      );

      return;
    }

    setDocumentSuccess(
      `${selectedDocumentFile.name} is ready to upload.`
    );
  };

  /* =========================================================
     HELPER
  ========================================================= */

  const formatDate = (
    date?: string | null
  ) => {
    if (!date) {
      return "Not specified";
    }

    try {
      return new Date(
        `${date}T00:00:00`
      ).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return date;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* =====================================================
          PROFILE COMPLETION
      ===================================================== */}

      <ProfileProgressBar
        employee={employee}
        profileData={editFormData}
        showProgress={hasStartedProfileEditing}
        onCompleteProfile={() =>
          setIsEditModalOpen(true)
        }
      />

      {/* =====================================================
          SUCCESS MESSAGE
      ===================================================== */}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">

          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />

          <span>{successMessage}</span>

        </div>
      )}

      {/* =====================================================
          PENDING REQUEST
      ===================================================== */}

      {pendingRequest &&
        pendingRequest.status ===
          "pending" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">

          <div className="flex items-start gap-3">

            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />

            <div className="flex-1">

              <div className="flex items-center justify-between gap-4">

                <h4 className="text-sm font-bold text-amber-900">
                  Profile Edit Request Pending HR Approval
                </h4>

                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                  Pending Review
                </span>

              </div>

              <p className="text-xs text-amber-700 mt-1">
                You recently submitted changes
                to your profile. Once HR verifies
                and approves them, your employee
                master record and completion bar
                will automatically update.
              </p>

              <div className="mt-3 bg-white/80 p-3 rounded-lg border border-amber-200 text-xs text-slate-700 space-y-1">

                <span className="font-semibold text-slate-900 block mb-1">
                  Requested modifications:
                </span>

                {Object.entries(
                  pendingRequest.requested_changes
                )
                  .filter(
                    ([_, val]) =>
                      val !== null &&
                      val !== ""
                  )
                  .slice(0, 6)
                  .map(
                    ([key, val]) => (
                      <div
                        key={key}
                        className="flex justify-between gap-4 border-b border-slate-100 py-1 last:border-0"
                      >

                        <span className="text-slate-500 capitalize">
                          {key.replace(
                            /_/g,
                            " "
                          )}
                          :
                        </span>

                        <span className="font-medium text-slate-800 text-right">
                          {String(val)}
                        </span>

                      </div>
                    )
                  )}

              </div>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          MAIN PROFILE CARD
      ===================================================== */}

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">

        {/* ===================================================
            PROFILE HEADER
        =================================================== */}

        <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">

          <div className="flex flex-col sm:flex-row sm:items-center gap-5">

            {/* PROFILE PHOTO */}

            <div className="shrink-0">

              <label
                htmlFor="profile-photo-upload"
                className="relative w-20 h-20 rounded-2xl bg-indigo-500/20 border-2 border-indigo-400/40 flex items-center justify-center text-white shadow-inner overflow-hidden cursor-pointer group hover:border-indigo-300/70 hover:bg-indigo-500/30 transition-all"
              >

                {profilePhoto ? (
                  <>
                    <img
                      src={profilePhoto}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">

                      <UploadCloud className="w-5 h-5 text-white mb-1" />

                      <span className="text-[9px] font-semibold text-white">
                        Change Photo
                      </span>

                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5">

                    <UploadCloud className="w-7 h-7 text-indigo-200" />

                    <span className="text-[10px] font-semibold text-indigo-100">
                      Upload Photo
                    </span>

                  </div>
                )}

              </label>

              <input
                id="profile-photo-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={
                  handleProfilePhotoChange
                }
              />

              {profilePhotoError && (
                <p className="mt-2 text-[10px] text-red-300 max-w-20 leading-tight">
                  {profilePhotoError}
                </p>
              )}

            </div>

            <div className="space-y-1">

              <div className="flex flex-wrap items-center gap-2">

                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {employee.first_name}{" "}
                  {employee.last_name}
                </h2>

                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                  {employee.status ||
                    "Active"}
                </span>

              </div>

              <p className="text-indigo-200 text-sm font-medium">

                {employee.designation ||
                  "Senior Software Engineer"}

                {" "}&bull; ID:{" "}

                <span className="font-mono font-bold text-white">
                  {employee.employee_id}
                </span>

              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-300">

                <span className="inline-flex items-center gap-1.5">

                  <Mail className="w-3.5 h-3.5 text-indigo-300" />

                  {employee.email}

                </span>

                {employee.phone && (
                  <span className="inline-flex items-center gap-1.5">

                    <Phone className="w-3.5 h-3.5 text-indigo-300" />

                    {employee.phone}

                  </span>
                )}

                <span className="inline-flex items-center gap-1.5">

                  <Building className="w-3.5 h-3.5 text-indigo-300" />

                  {employee.work_location ||
                    "Hyderabad HQ"}

                </span>

              </div>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              setIsEditModalOpen(true)
            }
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all shrink-0 cursor-pointer"
          >

            <Edit3 className="w-4 h-4" />

            <span>
              Request Profile Edit
            </span>

          </button>

        </div>

        {/* ===================================================
            PROFILE TABS
        =================================================== */}

        <div className="border-b border-slate-200 flex overflow-x-auto bg-slate-50/80 px-4 pt-2 gap-2">

          {[
            {
              id: "personal",
              label: "Personal Details",
              icon: User,
            },
            {
              id: "address",
              label: "Address & Emergency",
              icon: MapPin,
            },
            {
              id: "bank",
              label: "Bank & Statutory KYC",
              icon: CreditCard,
            },
            {
              id: "employment",
              label: "Employment & Shift",
              icon: Briefcase,
            },
            {
              id: "document",
              label: "Document",
              icon: FileText,
            },
          ].map((tab) => {
            const Icon = tab.icon;

            const isActive =
              activeTab === tab.id;

            return (
              <button
                type="button"
                key={tab.id}
                onClick={() =>
                  setActiveTab(
                    tab.id as
                      | "personal"
                      | "address"
                      | "bank"
                      | "employment"
                      | "document"
                  )
                }
                className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                }`}
              >

                <Icon className="w-4 h-4" />

                <span>{tab.label}</span>

              </button>
            );
          })}

        </div>

        {/* ===================================================
            TAB CONTENT
        =================================================== */}

        <div className="p-6 sm:p-8">

          {/* =================================================
              PERSONAL DETAILS
          ================================================= */}

          {activeTab ===
            "personal" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  First Name
                </span>

                <span className="font-bold text-slate-900 text-base">
                  {employee.first_name}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Last Name
                </span>

                <span className="font-bold text-slate-900 text-base">
                  {employee.last_name}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Official Email
                </span>

                <span className="font-medium text-slate-900 font-mono text-xs">
                  {employee.email}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Phone Number
                </span>

                <span className="font-semibold text-slate-900">
                  {employee.phone ||
                    "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Date of Birth
                </span>

                <span className="font-semibold text-slate-900 font-mono">
                  {employee.date_of_birth ||
                    "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Gender
                </span>

                <span className="font-semibold text-slate-900 capitalize">
                  {employee.gender ||
                    "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Blood Group
                </span>

                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                  {employee.blood_group ||
                    "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Marital Status
                </span>

                <span className="font-semibold text-slate-900 capitalize">
                  {employee.marital_status ||
                    "Single"}
                </span>

              </div>

            </div>
          )}

          {/* =================================================
              ADDRESS & EMERGENCY
          ================================================= */}

          {activeTab ===
            "address" && (
            <div className="space-y-6">

              <div>

                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">

                  <MapPin className="w-4 h-4 text-indigo-600" />

                  <span>
                    Residential Address
                  </span>

                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">

                  <div className="sm:col-span-2 md:col-span-3 p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Street Address
                    </span>

                    <span className="font-semibold text-slate-800">
                      {employee.address ||
                        "Not specified"}
                    </span>

                  </div>

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      City
                    </span>

                    <span className="font-semibold text-slate-800">
                      {employee.city ||
                        "Not specified"}
                    </span>

                  </div>

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      State
                    </span>

                    <span className="font-semibold text-slate-800">
                      {employee.state ||
                        "Not specified"}
                    </span>

                  </div>

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Postal Pincode
                    </span>

                    <span className="font-semibold text-slate-800 font-mono">
                      {employee.pincode ||
                        "Not specified"}
                    </span>

                  </div>

                </div>

              </div>

              <div className="border-t border-slate-200/80 pt-6">

                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">

                  <Phone className="w-4 h-4 text-indigo-600" />

                  <span>
                    Emergency Contact Details
                  </span>

                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Contact Name
                    </span>

                    <span className="font-bold text-slate-900">
                      {employee.emergency_contact_name ||
                        "Not specified"}
                    </span>

                  </div>

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Contact Phone
                    </span>

                    <span className="font-semibold text-slate-900">
                      {employee.emergency_contact_phone ||
                        "Not specified"}
                    </span>

                  </div>

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Relationship
                    </span>

                    <span className="font-semibold text-indigo-700">
                      {employee.emergency_contact_relation ||
                        "Not specified"}
                    </span>

                  </div>

                </div>

              </div>

            </div>
          )}

          {/* =================================================
              BANK & STATUTORY KYC
          ================================================= */}

          {activeTab ===
            "bank" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Bank Name
                </span>

                <span className="font-bold text-slate-900">
                  {employee.bank_name ||
                    "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Account Number
                </span>

                <span className="font-mono font-bold text-slate-900 text-sm">
                  {employee.bank_account_number
                    ? `•••• •••• ${employee.bank_account_number.slice(
                        -4
                      )}`
                    : "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  IFSC Code
                </span>

                <span className="font-mono font-bold text-indigo-700">
                  {employee.ifsc_code ||
                    "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  PAN Number
                </span>

                <span className="font-mono font-bold text-slate-900">
                  {employee.pan_number ||
                    "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Aadhaar Number
                </span>

                <span className="font-mono font-bold text-slate-900">
                  {employee.aadhar_number
                    ? `•••• •••• ${employee.aadhar_number.slice(
                        -4
                      )}`
                    : "Not specified"}
                </span>

              </div>

              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  UAN (PF Number)
                </span>

                <span className="font-mono font-bold text-slate-900">
                  {employee.uan_number ||
                    "Auto-assigned by HR"}
                </span>

              </div>

            </div>
          )}

          {/* =================================================
              EMPLOYMENT & SHIFT
          ================================================= */}

          {activeTab ===
            "employment" && (
            <div className="space-y-8">

              {/* CURRENT EMPLOYMENT */}

              <section>

                <div className="flex items-center gap-3 mb-5">

                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-indigo-600" />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Current Employment
                    </h3>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Employment details assigned by HR
                    </p>
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">

                  {/* EMPLOYEE ID */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <UserRound className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Employee ID
                      </span>

                    </div>

                    <span className="font-mono font-bold text-slate-900">
                      {employee.employee_id ||
                        "Not specified"}
                    </span>

                  </div>

                  {/* DEPARTMENT */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <Building className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Department
                      </span>

                    </div>

                    <span className="font-bold text-slate-900">
                      {employee.department?.name ||
                        departments.find(
                          (department) =>
                            department.id ===
                            employee.department_id
                        )?.name ||
                        "Not assigned"}
                    </span>

                  </div>

                  {/* DESIGNATION */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <UserRound className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Designation
                      </span>

                    </div>

                    <span className="font-bold text-slate-900">
                      {employee.designation ||
                        "Not assigned"}
                    </span>

                  </div>

                  {/* EMPLOYMENT TYPE */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <Briefcase className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Employment Type
                      </span>

                    </div>

                    <span className="font-bold text-emerald-700 capitalize bg-emerald-50 px-2 py-1 rounded-md inline-block">
                      {employee.employment_type ||
                        "Not specified"}
                    </span>

                  </div>

                  {/* JOINING DATE */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <CalendarDays className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Joining Date
                      </span>

                    </div>

                    <span className="font-semibold text-slate-900">
                      {formatDate(
                        employee.joining_date
                      )}
                    </span>

                  </div>

                  {/* PROBATION END */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <CalendarDays className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Probation End Date
                      </span>

                    </div>

                    <span className="font-semibold text-slate-900">
                      {formatDate(
                        employee.probation_end_date
                      )}
                    </span>

                  </div>

                  {/* CONFIRMATION DATE */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Confirmation Date
                      </span>

                    </div>

                    <span className="font-semibold text-slate-900">
                      {formatDate(
                        employee.confirmation_date
                      )}
                    </span>

                  </div>

                  {/* REPORTING MANAGER */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <UserRound className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Reporting Manager
                      </span>

                    </div>

                    <span className="font-semibold text-slate-900">
                      {employee.reporting_manager ||
                        "Not assigned"}
                    </span>

                  </div>

                  {/* WORK LOCATION */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <MapPinned className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Work Location
                      </span>

                    </div>

                    <span className="font-semibold text-slate-900">
                      {employee.work_location ||
                        "Not assigned"}
                    </span>

                  </div>

                  {/* STATUS */}

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Employment Status
                      </span>

                    </div>

                    <span className="font-bold text-emerald-700 capitalize">
                      {employee.status ||
                        "Active"}
                    </span>

                  </div>

                </div>

              </section>

              {/* PROJECT & SHIFT */}

              <section className="border-t border-slate-200 pt-7">

                <div className="flex items-center gap-3 mb-5">

                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-indigo-600" />
                  </div>

                  <div>

                    <h3 className="text-base font-bold text-slate-900">
                      Project & Shift
                    </h3>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Project and shift schedule assigned by HR
                    </p>

                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">

                  {/* PROJECT */}

                  <div className="md:col-span-2 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100">

                    <span className="text-[11px] text-indigo-500 font-bold block uppercase tracking-wider mb-2">
                      Assigned Project
                    </span>

                    <span className="font-bold text-indigo-900 text-base">
                      {employee.project?.name ||
                        "No project assigned"}
                    </span>

                  </div>

                  {/* PROJECT ID */}

                  <div className="p-5 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-2">
                      Project ID
                    </span>

                    <span className="font-mono font-semibold text-slate-900">
                      {employee.project_id ||
                        "Not assigned"}
                    </span>

                  </div>

                  {/* SHIFT START */}

                  <div className="p-5 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <Timer className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Shift Start
                      </span>

                    </div>

                    <span className="font-mono font-bold text-slate-900 text-lg">
                      {employee.project?.shift_start_time ||
                        "Not assigned"}
                    </span>

                  </div>

                  {/* SHIFT END */}

                  <div className="p-5 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <Timer className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Shift End
                      </span>

                    </div>

                    <span className="font-mono font-bold text-slate-900 text-lg">
                      {employee.project?.shift_end_time ||
                        "Not assigned"}
                    </span>

                  </div>

                  {/* SHIFT TIME */}

                  <div className="p-5 bg-emerald-50/60 rounded-xl border border-emerald-100">

                    <div className="flex items-center gap-2 mb-2">

                      <Clock className="w-4 h-4 text-emerald-600" />

                      <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider">
                        Shift Schedule
                      </span>

                    </div>

                    <span className="font-mono font-bold text-emerald-800">
                      {employee.project?.shift_start_time ||
                        "--:--"}
                      {" - "}
                      {employee.project?.shift_end_time ||
                        "--:--"}
                    </span>

                  </div>

                  {/* TIMEZONE */}

                  <div className="p-5 bg-slate-50/70 rounded-xl border border-slate-100">

                    <div className="flex items-center gap-2 mb-2">

                      <Clock className="w-4 h-4 text-indigo-500" />

                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        Timezone
                      </span>

                    </div>

                    <span className="font-semibold text-slate-900">
                      {employee.project?.timezone ||
                        "Not assigned"}
                    </span>

                  </div>

                </div>

                {/* SHIFT INFORMATION */}

                <div className="mt-5 p-4 bg-amber-50 border border-amber-100 rounded-xl">

                  <div className="flex items-start gap-3">

                    <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />

                    <div>

                      <p className="text-xs font-bold text-amber-900">
                        Shift Information
                      </p>

                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Your attendance schedule is based on
                        the project assigned by HR. The project
                        timezone and shift timings shown above
                        are used for your attendance calculations.
                      </p>

                    </div>

                  </div>

                </div>

              </section>

            </div>
          )}

          {/* =================================================
              DOCUMENT
          ================================================= */}

          {activeTab ===
            "document" && (
            <div className="max-w-2xl">

              <div className="mb-6">

                <div className="flex items-center gap-2">

                  <FileText className="w-5 h-5 text-indigo-600" />

                  <h4 className="text-sm font-bold text-slate-900">
                    Upload Document
                  </h4>

                </div>

                <p className="text-xs text-slate-500 mt-1">
                  Select the document type and choose
                  the file you want to upload.
                </p>

              </div>

              <div className="mb-5">

                <label className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider mb-2">
                  Document Type
                </label>

                <select
                  value={selectedDocumentType}
                  onChange={(e) => {
                    setSelectedDocumentType(
                      e.target.value
                    );

                    setDocumentError(null);
                    setDocumentSuccess(null);
                  }}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >

                  <option value="">
                    Select Document
                  </option>

                  {documentTypes.map(
                    (document) => (
                      <option
                        key={document}
                        value={document}
                      >
                        {document}
                      </option>
                    )
                  )}

                </select>

              </div>

              <div>

                <label className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider mb-2">
                  Choose File
                </label>

                <label
                  htmlFor="document-file"
                  className="w-full min-h-[165px] border-2 border-dashed border-indigo-100 rounded-xl bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 transition-all cursor-pointer flex flex-col items-center justify-center text-center px-4"
                >

                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">

                    <UploadCloud className="w-6 h-6 text-indigo-600" />

                  </div>

                  <span className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold transition-colors">
                    Choose File
                  </span>

                  {selectedDocumentFile ? (
                    <span className="mt-2 text-xs font-medium text-slate-700 truncate max-w-[90%]">
                      {selectedDocumentFile.name}
                    </span>
                  ) : (
                    <span className="mt-2 text-[11px] text-slate-400">
                      Supports PDF, PNG, JPG
                      files up to 5MB
                    </span>
                  )}

                  <input
                    id="document-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={
                      handleDocumentFileChange
                    }
                  />

                </label>

              </div>

              {documentError && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {documentError}
                </div>
              )}

              {documentSuccess && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">

                  <CheckCircle2 className="w-4 h-4 shrink-0" />

                  <span>{documentSuccess}</span>

                </div>
              )}

              <div className="flex justify-end mt-5">

                <button
                  type="button"
                  onClick={
                    handleDocumentUpload
                  }
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >

                  <UploadCloud className="w-4 h-4" />

                  <span>
                    Upload File
                  </span>

                </button>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* =====================================================
          REQUEST PROFILE UPDATE MODAL
      ===================================================== */}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">

          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 my-8">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">

              <div>

                <h3 className="text-lg font-bold text-slate-900">
                  Request Profile Update
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Edits will be submitted to HR for approval
                  before updating the master record.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setIsEditModalOpen(false)
                }
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >

                <XCircle className="w-5 h-5" />

              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleFormSubmit}
              className="px-6 py-5 space-y-8 max-h-[75vh] overflow-y-auto"
            >

              {/* PERSONAL INFORMATION */}

              <section>

                <div className="mb-4 pb-3 border-b border-slate-200">

                  <h4 className="text-sm font-bold text-slate-900">
                    Personal Information
                  </h4>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Phone Number
                    </label>

                    <input
                      name="phone"
                      value={editFormData.phone}
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Date of Birth
                    </label>

                    <input
                      type="date"
                      name="date_of_birth"
                      value={
                        editFormData.date_of_birth
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Gender
                    </label>

                    <select
                      name="gender"
                      value={
                        editFormData.gender
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    >

                      <option value="">
                        Select Gender
                      </option>

                      <option value="male">
                        Male
                      </option>

                      <option value="female">
                        Female
                      </option>

                      <option value="other">
                        Other
                      </option>

                    </select>

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Blood Group
                    </label>

                    <select
                      name="blood_group"
                      value={
                        editFormData.blood_group
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    >

                      <option value="">
                        Select Blood Group
                      </option>

                      <option value="A+">
                        A+
                      </option>

                      <option value="A-">
                        A-
                      </option>

                      <option value="B+">
                        B+
                      </option>

                      <option value="B-">
                        B-
                      </option>

                      <option value="AB+">
                        AB+
                      </option>

                      <option value="AB-">
                        AB-
                      </option>

                      <option value="O+">
                        O+
                      </option>

                      <option value="O-">
                        O-
                      </option>

                    </select>

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Marital Status
                    </label>

                    <select
                      name="marital_status"
                      value={
                        editFormData.marital_status
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    >

                      <option value="single">
                        Single
                      </option>

                      <option value="married">
                        Married
                      </option>

                      <option value="divorced">
                        Divorced
                      </option>

                      <option value="widowed">
                        Widowed
                      </option>

                    </select>

                  </div>

                </div>

              </section>

              {/* ADDRESS & EMERGENCY */}

              <section>

                <div className="mb-4 pb-3 border-b border-slate-200">

                  <h4 className="text-sm font-bold text-slate-900">
                    Address & Emergency
                  </h4>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="md:col-span-2">

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Permanent Address
                    </label>

                    <textarea
                      name="address"
                      value={
                        editFormData.address
                      }
                      onChange={
                        handleInputChange
                      }
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none"
                    />

                  </div>

                  <div className="md:col-span-2">

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Temporary Address
                    </label>

                    <textarea
                      name="address"
                      value={
                        editFormData.address
                      }
                      onChange={
                        handleInputChange
                      }
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      City
                    </label>

                    <input
                      name="city"
                      value={editFormData.city}
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      State
                    </label>

                    <input
                      name="state"
                      value={editFormData.state}
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Pincode
                    </label>

                    <input
                      name="pincode"
                      value={
                        editFormData.pincode
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Emergency Contact Name
                    </label>

                    <input
                      name="emergency_contact_name"
                      value={
                        editFormData.emergency_contact_name
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Emergency Contact Phone
                    </label>

                    <input
                      name="emergency_contact_phone"
                      value={
                        editFormData.emergency_contact_phone
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Emergency Contact Relation
                    </label>

                    <input
                      name="emergency_contact_relation"
                      value={
                        editFormData.emergency_contact_relation
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                </div>

              </section>

              {/* PREVIOUS EMPLOYMENT */}

              <section>

                <div className="mb-4 pb-3 border-b border-slate-200">

                  <h4 className="text-sm font-bold text-slate-900">
                    Previous Employment
                  </h4>

                </div>

                <div className="space-y-5">

                  {previousEmployments.map(
                    (
                      employment,
                      index
                    ) => (
                      <div
                        key={employment.id}
                        className="border border-slate-200 rounded-xl p-5 bg-slate-50/50"
                      >

                        <div className="flex items-center justify-between mb-5">

                          <div className="flex items-center gap-2">

                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>

                            <h5 className="text-sm font-bold text-slate-800">
                              Previous Employment{" "}
                              {index + 1}
                            </h5>

                          </div>

                          {previousEmployments.length >
                            1 && (
                            <button
                              type="button"
                              onClick={() =>
                                deletePreviousEmployment(
                                  employment.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors cursor-pointer"
                            >

                              <Trash2 className="w-3.5 h-3.5" />

                              <span>
                                Delete
                              </span>

                            </button>
                          )}

                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                          <div>

                            <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                              Previous Company
                            </label>

                            <input
                              value={
                                employment.company_name
                              }
                              onChange={(e) =>
                                handlePreviousEmploymentChange(
                                  employment.id,
                                  "company_name",
                                  e.target.value
                                )
                              }
                              placeholder="Enter company name"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                            />

                          </div>

                          <div>

                            <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                              Previous Designation
                            </label>

                            <input
                              value={
                                employment.designation
                              }
                              onChange={(e) =>
                                handlePreviousEmploymentChange(
                                  employment.id,
                                  "designation",
                                  e.target.value
                                )
                              }
                              placeholder="Enter designation"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                            />

                          </div>

                          <div>

                            <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                              Start Date
                            </label>

                            <input
                              type="date"
                              value={
                                employment.start_date
                              }
                              onChange={(e) =>
                                handlePreviousEmploymentChange(
                                  employment.id,
                                  "start_date",
                                  e.target.value
                                )
                              }
                              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                            />

                          </div>

                          <div>

                            <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                              End Date
                            </label>

                            <input
                              type="date"
                              value={
                                employment.end_date
                              }
                              onChange={(e) =>
                                handlePreviousEmploymentChange(
                                  employment.id,
                                  "end_date",
                                  e.target.value
                                )
                              }
                              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                            />

                          </div>

                          <div>

                            <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                              Previous Reporting Manager
                            </label>

                            <input
                              value={
                                employment.reporting_manager
                              }
                              onChange={(e) =>
                                handlePreviousEmploymentChange(
                                  employment.id,
                                  "reporting_manager",
                                  e.target.value
                                )
                              }
                              placeholder="Enter reporting manager"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                            />

                          </div>

                          <div>

                            <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                              Previous Work Location
                            </label>

                            <div className="flex items-center gap-2">

                              <input
                                value={
                                  employment.work_location
                                }
                                onChange={(e) =>
                                  handlePreviousEmploymentChange(
                                    employment.id,
                                    "work_location",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter work location"
                                className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                              />

                              <button
                                type="button"
                                onClick={
                                  addPreviousEmployment
                                }
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              >

                                <Plus className="w-3.5 h-3.5" />

                                <span>
                                  Add Employment
                                </span>

                              </button>

                            </div>

                          </div>

                        </div>

                      </div>
                    )
                  )}

                </div>

              </section>

              {/* BANK DETAILS */}

              <section>

                <div className="mb-4 pb-3 border-b border-slate-200">

                  <h4 className="text-sm font-bold text-slate-900">
                    Bank Details
                  </h4>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Bank Name
                    </label>

                    <input
                      name="bank_name"
                      value={
                        editFormData.bank_name
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Bank Account Number
                    </label>

                    <input
                      name="bank_account_number"
                      value={
                        editFormData.bank_account_number
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      IFSC Code
                    </label>

                    <input
                      name="ifsc_code"
                      value={
                        editFormData.ifsc_code
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      PAN Number
                    </label>

                    <input
                      name="pan_number"
                      value={
                        editFormData.pan_number
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      Aadhaar Number
                    </label>

                    <input
                      name="aadhar_number"
                      value={
                        editFormData.aadhar_number
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                  <div>

                    <label className="block text-xs text-slate-600 font-semibold mb-1.5">
                      UAN Number
                    </label>

                    <input
                      name="uan_number"
                      value={
                        editFormData.uan_number
                      }
                      onChange={
                        handleInputChange
                      }
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />

                  </div>

                </div>

              </section>

              {/* FORM BUTTONS */}

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-200 sticky bottom-0 bg-white">

                <button
                  type="button"
                  onClick={() =>
                    setIsEditModalOpen(false)
                  }
                  className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >

                  {loading && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}

                  <span>
                    Submit to HR for Approval
                  </span>

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}