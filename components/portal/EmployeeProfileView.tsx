"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  ChangeEvent,
  FormEvent,
} from "react";

import type {
  Department,
  Employee,
  EmployeeDocument,
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
  Building,
  UserRound,
  MapPinned,
  Upload,
  Trash2,
  Download,
  Eye,
} from "lucide-react";

import ProfileProgressBar from "./ProfileProgressBar";

interface EmployeeProfileViewProps {
  employee: Employee;
  pendingRequest: ProfileChangeRequest | null;
  departments: Department[];
}

type EditFormData = {
  phone: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  marital_status: string;

  address: string;
  city: string;
  state: string;
  pincode: string;

  communication_address: string;
  communication_city: string;
  communication_state: string;
  communication_pincode: string;

  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;

  emergency_contact_2_name: string;
  emergency_contact_2_phone: string;
  emergency_contact_2_relation: string;

  emergency_contact_3_name: string;
  emergency_contact_3_phone: string;
  emergency_contact_3_relation: string;

  department_id: string;
  designation: string;
  probation_end_date: string;
  confirmation_date: string;
  reporting_manager: string;
  work_location: string;

  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
  pan_number: string;
  aadhar_number: string;
  passport_number: string;

  pf: string;
  esi: string;
  pt: string;
  tds: string;
};

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

const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

const emptyEditForm: EditFormData = {
  phone: "",
  date_of_birth: "",
  gender: "",
  blood_group: "",
  marital_status: "single",

  address: "",
  city: "",
  state: "",
  pincode: "",

  communication_address: "",
  communication_city: "",
  communication_state: "",
  communication_pincode: "",

  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relation: "",

  emergency_contact_2_name: "",
  emergency_contact_2_phone: "",
  emergency_contact_2_relation: "",

  emergency_contact_3_name: "",
  emergency_contact_3_phone: "",
  emergency_contact_3_relation: "",

  department_id: "",
  designation: "",
  probation_end_date: "",
  confirmation_date: "",
  reporting_manager: "",
  work_location: "",

  bank_name: "",
  bank_account_number: "",
  ifsc_code: "",
  pan_number: "",
  aadhar_number: "",
  passport_number: "",

  pf: "",
  esi: "",
  pt: "",
  tds: "",
};

type EditSection =
  | "all"
  | "personal"
  | "address"
  | "bank"
  | "employment"
  | "document"
  | "statutory"
  | null;

export default function EmployeeProfileView({
  employee,
  pendingRequest: initialPendingRequest,
  departments,
}: EmployeeProfileViewProps) {
  const employeeData =
    employee as Employee & Record<string, any>;

  const employeeFullName =
    employeeData.full_name ||
    [employeeData.first_name, employeeData.last_name]
      .filter(Boolean)
      .join(" ") ||
    employeeData.name ||
    "Employee";

  const departmentName = () => {
    const department = departments.find(
      (item) =>
        String(item?.id ?? "") ===
        String(employeeData.department_id ?? "")
    );

    return (
      department?.name ||
      employeeData.department_name ||
      "Not specified"
    );
  };

  const [activeTab, setActiveTab] = useState<
    | "personal"
    | "address"
    | "bank"
    | "employment"
    | "document"
    | "statutory"
  >("personal");

  const [isEditModalOpen, setIsEditModalOpen] =
    useState(false);

  const [editSection, setEditSection] =
    useState<EditSection>(null);

  const [pendingRequest, setPendingRequest] =
    useState<ProfileChangeRequest | null>(
      initialPendingRequest
    );

  const [loading, setLoading] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [editFormData, setEditFormData] =
    useState<EditFormData>({
      ...emptyEditForm,
    });

  /* ============================================================
     PROFILE PHOTO

     Database photo is the primary source.

     Sidebar sends:
       "profile-photo-updated"

     Sidebar also stores:
       "profile-avatar-url"

     The event updates the image immediately.
     localStorage is only used when database photo is unavailable.
  ============================================================ */

  const [profilePhotoUrl, setProfilePhotoUrl] =
    useState<string | null>(
      employeeData.profile_photo_url || null
    );

  /* ============================================================
     DOCUMENT STATE
  ============================================================ */

  const [documents, setDocuments] =
    useState<EmployeeDocument[]>([]);

  const [isUploading, setIsUploading] =
    useState(false);

  const [documentError, setDocumentError] =
    useState<string | null>(null);

  const [docType, setDocType] =
    useState<string>("Resume");

  const [documentName, setDocumentName] =
    useState("");

  const documentFileInputRef =
    useRef<HTMLInputElement | null>(null);

  /* ============================================================
     OPEN PROFILE EDIT
  ============================================================ */

  const openEditSection = (
    section: EditSection
  ) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setEditSection(section);
    setIsEditModalOpen(true);
  };

  /* ============================================================
     CLOSE PROFILE EDIT
  ============================================================ */

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditSection(null);
    setLoading(false);
  };

  /* ============================================================
     RESET EDIT FORM WHEN EMPLOYEE CHANGES
  ============================================================ */

  useEffect(() => {
    const data =
      employee as Employee & Record<string, any>;

    setEditFormData({
      phone: data.phone || "",

      date_of_birth:
        data.date_of_birth || "",

      gender:
        data.gender || "",

      blood_group:
        data.blood_group || "",

      marital_status:
        data.marital_status || "single",

      address:
        data.permanent_address || "",

      city:
        data.permanent_city || "",

      state:
        data.permanent_state || "",

      pincode:
        data.permanent_pincode || "",

      communication_address:
        data.communication_address || "",

      communication_city:
        data.communication_city || "",

      communication_state:
        data.communication_state || "",

      communication_pincode:
        data.communication_pincode || "",

      emergency_contact_name:
        data.emergency_contact_name || "",

      emergency_contact_phone:
        data.emergency_contact_phone || "",

      emergency_contact_relation:
        data.emergency_contact_relation || "",

      emergency_contact_2_name:
        data.emergency_contact_2_name || "",

      emergency_contact_2_phone:
        data.emergency_contact_2_phone || "",

      emergency_contact_2_relation:
        data.emergency_contact_2_relation || "",

      emergency_contact_3_name:
        data.emergency_contact_3_name || "",

      emergency_contact_3_phone:
        data.emergency_contact_3_phone || "",

      emergency_contact_3_relation:
        data.emergency_contact_3_relation || "",

      department_id:
        data.department_id || "",

      designation:
        data.designation || "",

      probation_end_date:
        data.probation_end_date || "",

      confirmation_date:
        data.confirmation_date || "",

      reporting_manager:
        data.reporting_manager || "",

      work_location:
        data.work_location || "",

      bank_name:
        data.bank_name || "",

      bank_account_number:
        data.bank_account_number || "",

      ifsc_code:
        data.ifsc_code || "",

      pan_number:
        data.pan_number || "",

      aadhar_number:
        data.aadhar_number || "",

      passport_number:
        data.passport_number || "",

      pf:
        data.pf || "",

      esi:
        data.esi || "",

      pt:
        data.pt || "",

      tds:
        data.tds || "",
    });

    setPendingRequest(
      initialPendingRequest
    );
  }, [
    employee,
    initialPendingRequest,
  ]);

  /* ============================================================
     CORRECTED PROFILE PHOTO SYNC

     IMPORTANT:
     - DB photo is preferred.
     - localStorage is fallback only.
     - Sidebar event always updates immediately.
     - Event listener is removed on unmount.
  ============================================================ */

  useEffect(() => {
    const databasePhoto =
      employeeData.profile_photo_url || null;

    /* ----------------------------------------------------------
       1. FIRST USE DATABASE PHOTO
    ---------------------------------------------------------- */

    setProfilePhotoUrl(databasePhoto);

    /* ----------------------------------------------------------
       2. USE LOCAL STORAGE ONLY IF DB HAS NO PHOTO

       This prevents an old localStorage photo from replacing
       a valid database photo.
    ---------------------------------------------------------- */

    if (!databasePhoto) {
      try {
        const savedPhoto =
          window.localStorage.getItem(
            "profile-avatar-url"
          );

        if (savedPhoto) {
          setProfilePhotoUrl(savedPhoto);
        }
      } catch (error) {
        console.error(
          "Unable to restore profile photo:",
          error
        );
      }
    }

    /* ----------------------------------------------------------
       3. LISTEN FOR SIDEBAR PHOTO UPLOAD
    ---------------------------------------------------------- */

    const handlePhotoUpdate = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent<{
          avatarUrl?: string | null;
        }>;

      const newAvatarUrl =
        customEvent.detail?.avatarUrl || null;

      if (!newAvatarUrl) {
        return;
      }

      /* Immediately update Employee Profile image */
      setProfilePhotoUrl(
        newAvatarUrl
      );

      /* Keep Sidebar/Profile synchronized */
      try {
        window.localStorage.setItem(
          "profile-avatar-url",
          newAvatarUrl
        );
      } catch (error) {
        console.error(
          "Unable to save profile photo:",
          error
        );
      }
    };

    window.addEventListener(
      "profile-photo-updated",
      handlePhotoUpdate
    );

    /* ----------------------------------------------------------
       4. CLEANUP
    ---------------------------------------------------------- */

    return () => {
      window.removeEventListener(
        "profile-photo-updated",
        handlePhotoUpdate
      );
    };
  }, [
    employeeData.profile_photo_url,
  ]);

  /* ============================================================
     LOAD EMPLOYEE DOCUMENTS
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    const loadDocuments = async () => {
      if (!employeeData.id) {
        return;
      }

      try {
        const response =
          await fetch(
            `/api/documents?employee_id=${encodeURIComponent(
              String(employeeData.id)
            )}`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        if (cancelled) {
          return;
        }

        const loadedDocuments =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.documents
              )
            ? data.documents
            : [];

        setDocuments(
          loadedDocuments as EmployeeDocument[]
        );
      } catch (error) {
        console.error(
          "Failed to load employee documents:",
          error
        );
      }
    };

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [employeeData.id]);

  /* ============================================================
     INPUT CHANGE
  ============================================================ */

  const handleInputChange = (
    e: ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement |
      HTMLSelectElement
    >
  ) => {
    const {
      name,
      value,
    } = e.target;

    setEditFormData(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };

  /* ============================================================
     DOCUMENT UPLOAD
  ============================================================ */

  const handleFileChange = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.size >
      MAX_DOCUMENT_SIZE
    ) {
      setDocumentError(
        "File size exceeds 5MB limit"
      );

      e.target.value = "";
      return;
    }

    if (!employeeData.id) {
      setDocumentError(
        "Employee ID is required to upload documents"
      );

      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setDocumentError(null);

    try {
      const trimmedDocumentName =
        documentName.trim() ||
        file.name;

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "document_type",
        docType
      );

      formData.append(
        "document_name",
        trimmedDocumentName
      );

      formData.append(
        "employee_id",
        String(employeeData.id)
      );

      const response =
        await fetch(
          "/api/upload",
          {
            method: "POST",
            body: formData,
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      let data: any;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        data =
          await response.json();
      } else {
        const text =
          await response.text();

        throw new Error(
          text ||
            "Upload failed"
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Upload failed"
        );
      }

      if (!data?.document) {
        throw new Error(
          "Document was uploaded but not saved"
        );
      }

      const newDocument =
        data.document as EmployeeDocument;

      setDocuments(
        (previous) => [
          ...previous,
          newDocument,
        ]
      );

      setDocumentName("");
      setDocumentError(null);
    } catch (error: any) {
      console.error(
        "Document upload error:",
        error
      );

      setDocumentError(
        error?.message ||
          "Failed to upload file"
      );
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  /* ============================================================
     DELETE DOCUMENT
  ============================================================ */

  const handleDelete = async (
    id: string
  ) => {
    try {
      setDocumentError(null);

      const response =
        await fetch(
          `/api/documents/${id}`,
          {
            method: "DELETE",
          }
        );

      if (!response.ok) {
        const contentType =
          response.headers.get(
            "content-type"
          ) || "";

        let message =
          "Delete failed";

        if (
          contentType.includes(
            "application/json"
          )
        ) {
          const data =
            await response.json();

          message =
            data?.error ||
            message;
        }

        throw new Error(
          message
        );
      }

      setDocuments(
        (previous) =>
          previous.filter(
            (document) =>
              document.id !== id
          )
      );
    } catch (error: any) {
      console.error(
        "Document delete error:",
        error
      );

      setDocumentError(
        error?.message ||
          "Failed to delete file"
      );
    }
  };

  /* ============================================================
     PROFILE CHANGE REQUEST
  ============================================================ */

  const handleFormSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const changedFields: Record<
        string,
        unknown
      > = {};

      const previousValues: Record<
        string,
        unknown
      > = {};

      const comparisons: Record<
        string,
        unknown
      > = {
        phone:
          editFormData.phone,

        date_of_birth:
          editFormData.date_of_birth,

        gender:
          editFormData.gender,

        blood_group:
          editFormData.blood_group,

        marital_status:
          editFormData.marital_status,

        permanent_address:
          editFormData.address,

        permanent_city:
          editFormData.city,

        permanent_state:
          editFormData.state,

        permanent_pincode:
          editFormData.pincode,

        communication_address:
          editFormData.communication_address,

        communication_city:
          editFormData.communication_city,

        communication_state:
          editFormData.communication_state,

        communication_pincode:
          editFormData.communication_pincode,

        emergency_contact_name:
          editFormData.emergency_contact_name,

        emergency_contact_phone:
          editFormData.emergency_contact_phone,

        emergency_contact_relation:
          editFormData.emergency_contact_relation,

        emergency_contact_2_name:
          editFormData.emergency_contact_2_name,

        emergency_contact_2_phone:
          editFormData.emergency_contact_2_phone,

        emergency_contact_2_relation:
          editFormData.emergency_contact_2_relation,

        emergency_contact_3_name:
          editFormData.emergency_contact_3_name,

        emergency_contact_3_phone:
          editFormData.emergency_contact_3_phone,

        emergency_contact_3_relation:
          editFormData.emergency_contact_3_relation,

        department_id:
          editFormData.department_id,

        designation:
          editFormData.designation,

        probation_end_date:
          editFormData.probation_end_date,

        confirmation_date:
          editFormData.confirmation_date,

        reporting_manager:
          editFormData.reporting_manager,

        work_location:
          editFormData.work_location,

        bank_name:
          editFormData.bank_name,

        bank_account_number:
          editFormData.bank_account_number,

        ifsc_code:
          editFormData.ifsc_code,

        pan_number:
          editFormData.pan_number,

        aadhar_number:
          editFormData.aadhar_number,

        passport_number:
          editFormData.passport_number,

        pf:
          editFormData.pf,

        esi:
          editFormData.esi,

        pt:
          editFormData.pt,

        tds:
          editFormData.tds,
      };

      const fieldMap: Record<
        string,
        string
      > = {
        phone: "phone",

        date_of_birth:
          "date_of_birth",

        gender:
          "gender",

        blood_group:
          "blood_group",

        marital_status:
          "marital_status",

        permanent_address:
          "permanent_address",

        permanent_city:
          "permanent_city",

        permanent_state:
          "permanent_state",

        permanent_pincode:
          "permanent_pincode",

        communication_address:
          "communication_address",

        communication_city:
          "communication_city",

        communication_state:
          "communication_state",

        communication_pincode:
          "communication_pincode",

        emergency_contact_name:
          "emergency_contact_name",

        emergency_contact_phone:
          "emergency_contact_phone",

        emergency_contact_relation:
          "emergency_contact_relation",

        emergency_contact_2_name:
          "emergency_contact_2_name",

        emergency_contact_2_phone:
          "emergency_contact_2_phone",

        emergency_contact_2_relation:
          "emergency_contact_2_relation",

        emergency_contact_3_name:
          "emergency_contact_3_name",

        emergency_contact_3_phone:
          "emergency_contact_3_phone",

        emergency_contact_3_relation:
          "emergency_contact_3_relation",

        department_id:
          "department_id",

        designation:
          "designation",

        probation_end_date:
          "probation_end_date",

        confirmation_date:
          "confirmation_date",

        reporting_manager:
          "reporting_manager",

        work_location:
          "work_location",

        bank_name:
          "bank_name",

        bank_account_number:
          "bank_account_number",

        ifsc_code:
          "ifsc_code",

        pan_number:
          "pan_number",

        aadhar_number:
          "aadhar_number",

        passport_number:
          "passport_number",

        pf: "pf",

        esi: "esi",

        pt: "pt",

        tds: "tds",
      };

      const sectionFields: Record<
        Exclude<
          EditSection,
          null | "all" | "document"
        >,
        string[]
      > = {
        personal: [
          "phone",
          "date_of_birth",
          "gender",
          "blood_group",
          "marital_status",
        ],

        address: [
          "permanent_address",
          "permanent_city",
          "permanent_state",
          "permanent_pincode",

          "communication_address",
          "communication_city",
          "communication_state",
          "communication_pincode",

          "emergency_contact_name",
          "emergency_contact_phone",
          "emergency_contact_relation",

          "emergency_contact_2_name",
          "emergency_contact_2_phone",
          "emergency_contact_2_relation",

          "emergency_contact_3_name",
          "emergency_contact_3_phone",
          "emergency_contact_3_relation",
        ],

        bank: [
          "bank_name",
          "bank_account_number",
          "ifsc_code",
          "pan_number",
          "aadhar_number",
          "passport_number",
        ],

        employment: [
          "department_id",
          "designation",
          "probation_end_date",
          "confirmation_date",
          "reporting_manager",
          "work_location",
        ],

        statutory: [
          "pf",
          "esi",
          "pt",
          "tds",
        ],
      };

      Object.entries(
        comparisons
      ).forEach(
        ([field, newValue]) => {
          if (
            editSection &&
            editSection !== "all" &&
            editSection !== "document"
          ) {
            const allowedFields =
              sectionFields[
                editSection
              ];

            if (
              !allowedFields.includes(
                field
              )
            ) {
              return;
            }
          }

          const employeeField =
            fieldMap[field];

          if (!employeeField) {
            return;
          }

          const oldValue =
            employeeData[
              employeeField
            ] ?? "";

          const oldNormalized =
            String(
              oldValue ?? ""
            ).trim();

          const newNormalized =
            String(
              newValue ?? ""
            ).trim();

          if (
            oldNormalized !==
            newNormalized
          ) {
            changedFields[field] =
              newValue;

            previousValues[field] =
              oldValue;
          }
        }
      );

      if (
        Object.keys(
          changedFields
        ).length === 0
      ) {
        setErrorMessage(
          "No changes found."
        );

        return;
      }

      const response =
        await fetch(
          "/api/profile-change-requests",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              employeeId:
                employeeData.id,

              requestedChanges:
                changedFields,

              previousValues:
                previousValues,
            }),
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      let data: any = null;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        data =
          await response.json();
      } else {
        const text =
          await response.text();

        throw new Error(
          text ||
            "Server returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to submit profile change request."
        );
      }

      setPendingRequest(
        data?.request || data
      );

      setSuccessMessage(
        "Profile change request submitted successfully. HR can now review your changes."
      );

      closeEditModal();
    } catch (error: unknown) {
      console.error(
        "Profile change request error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to submit profile change request."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     DATE
  ============================================================ */

  const formatDate = (
    value?: string | null
  ) => {
    if (!value) {
      return "Not specified";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  /* ============================================================
     MODAL TITLE
  ============================================================ */

  const getEditTitle = () => {
    switch (editSection) {
      case "personal":
        return "Request Personal Information Edit";

      case "address":
        return "Request Address & Emergency Edit";

      case "bank":
        return "Request Bank & Identity Edit";

      case "employment":
        return "Request Employment Edit";

      case "statutory":
        return "Request Statutory Edit";

      case "document":
        return "Documents";

      default:
        return "Request Profile Edit";
    }
  };

  /* ============================================================
     TABS
  ============================================================ */

  const tabs = [
    {
      id: "personal" as const,
      label: "Personal",
      icon: User,
    },

    {
      id: "address" as const,
      label: "Address & Emergency",
      icon: MapPin,
    },

    {
      id: "bank" as const,
      label: "Bank & Identity",
      icon: CreditCard,
    },

    {
      id: "employment" as const,
      label: "Employment",
      icon: Briefcase,
    },

    {
      id: "document" as const,
      label: "Documents",
      icon: FileText,
    },

    {
      id: "statutory" as const,
      label: "Statutory",
      icon: CreditCard,
    },
  ];

  return (
    <div className="w-full space-y-6">

      {/* ============================================================
          PROFILE HEADER
      ============================================================ */}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="p-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

            <div className="flex items-center gap-5">

              <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center overflow-hidden">

                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    alt={employeeFullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserRound className="w-10 h-10 text-indigo-600" />
                )}

              </div>

              <div>

                <h2 className="text-2xl font-bold text-slate-900">
                  {employeeFullName}
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {employeeData.employee_id ||
                    employeeData.id ||
                    "Not specified"}
                </p>

                <div className="flex flex-wrap items-center gap-3 mt-3">

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">

                    <Briefcase className="w-3.5 h-3.5" />

                    {employeeData.designation ||
                      "Not specified"}

                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">

                    <Building className="w-3.5 h-3.5" />

                    {departmentName()}

                  </span>

                </div>

              </div>

            </div>

            <div>

              <button
                type="button"
                onClick={() =>
                  openEditSection("all")
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
              >

                <Edit3 className="w-4 h-4" />

                Request Profile Edit

              </button>

            </div>

          </div>

        </div>

        <div className="px-6 pb-6">

          <ProfileProgressBar
            employee={employee}
          />

        </div>

      </div>

      {/* ============================================================
          SUCCESS
      ============================================================ */}

      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">

          <CheckCircle2 className="w-5 h-5" />

          <span className="text-sm font-medium">
            {successMessage}
          </span>

        </div>
      )}

      {/* ============================================================
          ERROR
      ============================================================ */}

      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">

          <XCircle className="w-5 h-5" />

          <span className="text-sm font-medium">
            {errorMessage}
          </span>

        </div>
      )}

      {/* ============================================================
          PENDING PROFILE REQUEST
      ============================================================ */}

      {pendingRequest && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">

          <Clock className="w-5 h-5 text-amber-600 mt-0.5" />

          <div>

            <p className="font-semibold text-amber-800">
              Profile change request pending
            </p>

            <p className="text-sm text-amber-700 mt-1">
              Your requested changes are waiting for HR approval.
            </p>

          </div>

        </div>
      )}

      {/* ============================================================
          MAIN TABS
      ============================================================ */}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="border-b border-slate-200 overflow-x-auto">

          <div className="flex min-w-max">

            {tabs.map((tab) => {
              const Icon =
                tab.icon;

              const active =
                activeTab ===
                tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      tab.id
                    )
                  }
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition ${
                    active
                      ? "text-indigo-600 border-indigo-600"
                      : "text-slate-500 border-transparent hover:text-slate-800"
                  }`}
                >

                  <Icon className="w-4 h-4" />

                  {tab.label}

                </button>
              );
            })}

          </div>

        </div>

        <div className="p-6">

          {/* ========================================================
              PERSONAL
          ======================================================== */}

          {activeTab === "personal" && (
            <div className="space-y-8">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Personal Information
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Basic personal information of the employee.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditSection(
                      "personal"
                    )
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition-colors shrink-0"
                >

                  <Edit3 className="w-4 h-4" />

                  Edit

                </button>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">

                {[
                  [
                    "Full Name",
                    employeeFullName,
                  ],

                  [
                    "Employee ID",
                    employeeData.employee_id ||
                      employeeData.id ||
                      "Not specified",
                  ],

                  [
                    "Email",
                    employeeData.email ||
                      "Not specified",
                  ],

                  [
                    "Phone",
                    employeeData.phone ||
                      "Not specified",
                  ],

                  [
                    "Date of Birth",
                    formatDate(
                      employeeData.date_of_birth
                    ),
                  ],

                  [
                    "Gender",
                    employeeData.gender ||
                      "Not specified",
                  ],

                  [
                    "Blood Group",
                    employeeData.blood_group ||
                      "Not specified",
                  ],

                  [
                    "Marital Status",
                    employeeData.marital_status ||
                      "Not specified",
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="p-4 bg-slate-50/70 rounded-xl border border-slate-100"
                    >

                      <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                        {label}
                      </span>

                      <span className="font-semibold text-slate-800 break-all capitalize">
                        {value}
                      </span>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

          {/* ========================================================
              ADDRESS
          ======================================================== */}

          {activeTab === "address" && (
            <div className="space-y-8">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Address & Emergency
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Address and emergency contact information.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditSection(
                      "address"
                    )
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition-colors shrink-0"
                >

                  <Edit3 className="w-4 h-4" />

                  Edit

                </button>

              </div>

              <div>

                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">

                  <MapPin className="w-4 h-4 text-indigo-600" />

                  Permanent Address

                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">

                  <div className="sm:col-span-2 md:col-span-3 p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Street Address
                    </span>

                    <span className="font-semibold text-slate-800">
                      {employeeData.permanent_address ||
                        "Not specified"}
                    </span>

                  </div>

                  {[
                    [
                      "City",
                      employeeData.permanent_city,
                    ],

                    [
                      "State",
                      employeeData.permanent_state,
                    ],

                    [
                      "Pincode",
                      employeeData.permanent_pincode,
                    ],
                  ].map(
                    ([label, value]) => (
                      <div
                        key={label}
                        className="p-4 bg-slate-50/70 rounded-xl border border-slate-100"
                      >

                        <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                          {label}
                        </span>

                        <span className="font-semibold text-slate-800">
                          {value ||
                            "Not specified"}
                        </span>

                      </div>
                    )
                  )}

                </div>

              </div>

              <div>

                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">

                  <MapPinned className="w-4 h-4 text-indigo-600" />

                  Communication Address

                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">

                  <div className="sm:col-span-2 md:col-span-3 p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Street Address
                    </span>

                    <span className="font-semibold text-slate-800">
                      {employeeData.communication_address ||
                        "Not specified"}
                    </span>

                  </div>

                  {[
                    [
                      "City",
                      employeeData.communication_city,
                    ],

                    [
                      "State",
                      employeeData.communication_state,
                    ],

                    [
                      "Pincode",
                      employeeData.communication_pincode,
                    ],
                  ].map(
                    ([label, value]) => (
                      <div
                        key={label}
                        className="p-4 bg-slate-50/70 rounded-xl border border-slate-100"
                      >

                        <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                          {label}
                        </span>

                        <span className="font-semibold text-slate-800">
                          {value ||
                            "Not specified"}
                        </span>

                      </div>
                    )
                  )}

                </div>

              </div>

              <div>

                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">

                  <Phone className="w-4 h-4 text-indigo-600" />

                  Emergency Contacts

                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">

                  {[
                    {
                      title:
                        "Emergency Contact 1",

                      name:
                        employeeData.emergency_contact_name,

                      phone:
                        employeeData.emergency_contact_phone,

                      relation:
                        employeeData.emergency_contact_relation,
                    },

                    {
                      title:
                        "Emergency Contact 2",

                      name:
                        employeeData.emergency_contact_2_name,

                      phone:
                        employeeData.emergency_contact_2_phone,

                      relation:
                        employeeData.emergency_contact_2_relation,
                    },

                    {
                      title:
                        "Emergency Contact 3",

                      name:
                        employeeData.emergency_contact_3_name,

                      phone:
                        employeeData.emergency_contact_3_phone,

                      relation:
                        employeeData.emergency_contact_3_relation,
                    },
                  ].map(
                    (contact) => (
                      <div
                        key={
                          contact.title
                        }
                        className="p-5 bg-slate-50/70 rounded-xl border border-slate-100"
                      >

                        <div className="flex items-center justify-between mb-4">

                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                            {
                              contact.title
                            }
                          </span>

                          <Phone className="w-4 h-4 text-slate-400" />

                        </div>

                        <div className="space-y-4">

                          <div>

                            <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                              Name
                            </span>

                            <span className="font-semibold text-slate-800">
                              {contact.name ||
                                "Not specified"}
                            </span>

                          </div>

                          <div>

                            <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                              Phone
                            </span>

                            <span className="font-semibold text-slate-800">
                              {contact.phone ||
                                "Not specified"}
                            </span>

                          </div>

                          <div>

                            <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                              Relationship
                            </span>

                            <span className="font-semibold text-slate-800">
                              {contact.relation ||
                                "Not specified"}
                            </span>

                          </div>

                        </div>

                      </div>
                    )
                  )}

                </div>

              </div>

            </div>
          )}

          {/* ========================================================
              BANK
          ======================================================== */}

          {activeTab === "bank" && (
            <div className="space-y-8">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Bank & Identity Details
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Bank account and identification information.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditSection(
                      "bank"
                    )
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition-colors shrink-0"
                >

                  <Edit3 className="w-4 h-4" />

                  Edit

                </button>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">

                {[
                  [
                    "Bank Name",
                    employeeData.bank_name,
                  ],

                  [
                    "Account Number",
                    employeeData.bank_account_number,
                  ],

                  [
                    "IFSC Code",
                    employeeData.ifsc_code,
                  ],

                  [
                    "PAN Number",
                    employeeData.pan_number,
                  ],

                  [
                    "Aadhaar Number",
                    employeeData.aadhar_number,
                  ],

                  [
                    "Passport Number",
                    employeeData.passport_number,
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="p-4 bg-slate-50/70 rounded-xl border border-slate-100"
                    >

                      <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                        {label}
                      </span>

                      <span className="font-semibold text-slate-800 font-mono break-all">
                        {value ||
                          "Not specified"}
                      </span>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

          {/* ========================================================
              EMPLOYMENT
          ======================================================== */}

          {activeTab === "employment" && (
            <div className="space-y-8">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Employment Information
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Current employment and reporting information.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditSection(
                      "employment"
                    )
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition-colors shrink-0"
                >

                  <Edit3 className="w-4 h-4" />

                  Edit

                </button>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">

                {[
                  [
                    "Department",
                    departmentName(),
                  ],

                  [
                    "Designation",
                    employeeData.designation,
                  ],

                  [
                    "Work Location",
                    employeeData.work_location,
                  ],

                  [
                    "Reporting Manager",
                    employeeData.reporting_manager,
                  ],

                  [
                    "Probation End Date",
                    formatDate(
                      employeeData.probation_end_date
                    ),
                  ],

                  [
                    "Confirmation Date",
                    formatDate(
                      employeeData.confirmation_date
                    ),
                  ],

                  [
                    "Joining Date",
                    formatDate(
                      employeeData.joining_date
                    ),
                  ],

                  [
                    "Employment Type",
                    employeeData.employment_type,
                  ],

                  [
                    "Employment Status",
                    employeeData.status,
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="p-4 bg-slate-50/70 rounded-xl border border-slate-100"
                    >

                      <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                        {label}
                      </span>

                      <span className="font-semibold text-slate-800 capitalize">
                        {value ||
                          "Not specified"}
                      </span>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

          {/* ========================================================
              DOCUMENTS
          ======================================================== */}

          {activeTab === "document" && (
            <div className="space-y-6">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Documents
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Upload and manage employee documents.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditSection(
                      "document"
                    )
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition-colors shrink-0"
                >

                  <Edit3 className="w-4 h-4" />

                  Edit

                </button>

              </div>

              <div className="bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-2xl p-6 sm:p-7">

                <div className="max-w-xl mx-auto space-y-4">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <div>

                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Document Type
                      </label>

                      <select
                        value={docType}
                        onChange={(e) => {
                          setDocType(
                            e.target.value
                          );

                          setDocumentError(
                            null
                          );
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold bg-white text-slate-800 shadow-sm focus:outline-none focus:border-indigo-500"
                        disabled={
                          isUploading
                        }
                      >

                        {documentTypes.map(
                          (type) => (
                            <option
                              key={type}
                              value={type}
                            >
                              {type}
                            </option>
                          )
                        )}

                      </select>

                    </div>

                    <div>

                      <label
                        htmlFor="document-name"
                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                      >
                        Custom Label{" "}

                        <span className="font-normal text-slate-400 normal-case">
                          (optional)
                        </span>

                      </label>

                      <input
                        id="document-name"
                        type="text"
                        value={
                          documentName
                        }
                        onChange={(e) =>
                          setDocumentName(
                            e.target.value
                          )
                        }
                        placeholder="Defaults to filename"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold bg-white text-slate-800 shadow-sm focus:outline-none focus:border-indigo-500"
                        disabled={
                          isUploading
                        }
                      />

                    </div>

                  </div>

                  <label className="flex flex-col items-center justify-center w-full py-8 px-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">

                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">

                      {isUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6" />
                      )}

                    </div>

                    <span className="text-sm font-bold text-slate-800">

                      {isUploading
                        ? "Uploading Document..."
                        : "Choose Document to Upload"}

                    </span>

                    <span className="text-xs text-slate-400 mt-1 font-medium">
                      Supports PDF, PNG, JPG files up to 5MB
                    </span>

                    <input
                      ref={
                        documentFileInputRef
                      }
                      type="file"
                      name="file_upload"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={
                        handleFileChange
                      }
                      disabled={
                        isUploading
                      }
                    />

                  </label>

                </div>

                {documentError && (
                  <p className="mt-3 text-xs font-bold text-rose-600 text-center">
                    {documentError}
                  </p>
                )}

              </div>

              <div className="space-y-3">

                <div className="flex items-center justify-between">

                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Verified Documents (
                    {documents.length}
                    )
                  </h4>

                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-slate-100">

                    <p className="text-xs text-slate-400 font-medium">
                      No documents uploaded yet for this employee record.
                    </p>

                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                    {documents.map(
                      (doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all"
                        >

                          <div className="flex items-center gap-3 min-w-0">

                            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">

                              <FileText className="w-5 h-5" />

                            </div>

                            <div className="min-w-0">

                              <p className="text-xs font-bold text-slate-900 truncate">
                                {
                                  doc.document_name
                                }
                              </p>

                              <div className="flex items-center gap-2 mt-1">

                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                                  {
                                    doc.document_type
                                  }
                                </span>

                                <span className="text-[10px] text-slate-400 font-mono">
                                  {[
                                    "Aadhar Card",
                                    "Aadhaar Card",
                                  ].includes(
                                    doc.document_type
                                  )
                                    ? employeeData.aadhar_number ||
                                      "Not specified"
                                    : new Date(
                                        doc.uploaded_at
                                      ).toLocaleDateString()}
                                </span>

                              </div>

                            </div>

                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-3">

                            <a
                              href={
                                doc.document_url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              title="View"
                            >

                              <Eye className="w-4 h-4" />

                            </a>

                            <a
                              href={
                                doc.document_url
                              }
                              download
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              title="Download"
                            >

                              <Download className="w-4 h-4" />

                            </a>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  doc.id
                                )
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Delete"
                            >

                              <Trash2 className="w-4 h-4" />

                            </button>

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>

            </div>
          )}

          {/* ========================================================
              STATUTORY
          ======================================================== */}

          {activeTab === "statutory" && (
            <div className="space-y-8">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Statutory Details
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    PF, ESI, Professional Tax and TDS information.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditSection(
                      "statutory"
                    )
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition-colors shrink-0"
                >

                  <Edit3 className="w-4 h-4" />

                  Edit

                </button>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 text-sm">

                {[
                  [
                    "PF",
                    employeeData.pf,
                  ],

                  [
                    "ESI",
                    employeeData.esi,
                  ],

                  [
                    "PT",
                    employeeData.pt,
                  ],

                  [
                    "TDS",
                    employeeData.tds,
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="p-4 bg-slate-50/70 rounded-xl border border-slate-100"
                    >

                      <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                        {label}
                      </span>

                      <span className="font-semibold text-slate-800 break-all">
                        {value ||
                          "Not specified"}
                      </span>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

        </div>

      </div>

      {/* ============================================================
          EDIT PROFILE MODAL
      ============================================================ */}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">

            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">

              <div>

                <h2 className="text-lg font-bold text-slate-900">
                  {getEditTitle()}
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  Submit your changes for HR approval.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeEditModal
                }
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >

                <XCircle className="w-5 h-5" />

              </button>

            </div>

            {editSection ===
            "document" ? (
              <div className="p-6 space-y-6">

                <div className="bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-2xl p-6">

                  <div className="max-w-xl mx-auto space-y-4">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                      <div>

                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Document Type
                        </label>

                        <select
                          value={
                            docType
                          }
                          onChange={(e) => {
                            setDocType(
                              e.target.value
                            );

                            setDocumentError(
                              null
                            );
                          }}
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold bg-white text-slate-800 shadow-sm focus:outline-none focus:border-indigo-500"
                          disabled={
                            isUploading
                          }
                        >

                          {documentTypes.map(
                            (type) => (
                              <option
                                key={type}
                                value={type}
                              >
                                {type}
                              </option>
                            )
                          )}

                        </select>

                      </div>

                      <div>

                        <label
                          htmlFor="document-name-modal"
                          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                        >
                          Custom Label{" "}

                          <span className="font-normal text-slate-400 normal-case">
                            (optional)
                          </span>

                        </label>

                        <input
                          id="document-name-modal"
                          type="text"
                          value={
                            documentName
                          }
                          onChange={(e) =>
                            setDocumentName(
                              e.target.value
                            )
                          }
                          placeholder="Defaults to filename"
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold bg-white text-slate-800 shadow-sm focus:outline-none focus:border-indigo-500"
                          disabled={
                            isUploading
                          }
                        />

                      </div>

                    </div>

                    <label className="flex flex-col items-center justify-center w-full py-8 px-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">

                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">

                        {isUploading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <Upload className="w-6 h-6" />
                        )}

                      </div>

                      <span className="text-sm font-bold text-slate-800">

                        {isUploading
                          ? "Uploading Document..."
                          : "Choose Document to Upload"}

                      </span>

                      <span className="text-xs text-slate-400 mt-1 font-medium">
                        Supports PDF, PNG, JPG files up to 5MB
                      </span>

                      <input
                        ref={
                          documentFileInputRef
                        }
                        type="file"
                        name="file_upload_modal"
                        className="hidden"
                        accept=".pdf,image/*"
                        onChange={
                          handleFileChange
                        }
                        disabled={
                          isUploading
                        }
                      />

                    </label>

                  </div>

                  {documentError && (
                    <p className="mt-3 text-xs font-bold text-rose-600 text-center">
                      {documentError}
                    </p>
                  )}

                </div>

                <div className="flex justify-end">

                  <button
                    type="button"
                    onClick={
                      closeEditModal
                    }
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>

                </div>

              </div>
            ) : (
              <form
                onSubmit={
                  handleFormSubmit
                }
                className="p-6 space-y-8"
              >

                {/* PERSONAL */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "personal") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                      Personal Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <input
                        name="phone"
                        value={
                          editFormData.phone
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Phone"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        type="date"
                        name="date_of_birth"
                        value={
                          editFormData.date_of_birth
                        }
                        onChange={
                          handleInputChange
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <select
                        name="gender"
                        value={
                          editFormData.gender
                        }
                        onChange={
                          handleInputChange
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
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

                      <input
                        name="blood_group"
                        value={
                          editFormData.blood_group
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Blood Group"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <select
                        name="marital_status"
                        value={
                          editFormData.marital_status
                        }
                        onChange={
                          handleInputChange
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
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

                  </section>
                )}

                {/* ADDRESS */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "address") && (
                  <>
                    <section>

                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">

                        <MapPin className="w-4 h-4 text-indigo-600" />

                        Permanent Address

                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <textarea
                          name="address"
                          value={
                            editFormData.address
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Permanent Street Address"
                          rows={3}
                          className="md:col-span-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none resize-none focus:border-indigo-500"
                        />

                        <input
                          name="city"
                          value={
                            editFormData.city
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="City"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                        />

                        <input
                          name="state"
                          value={
                            editFormData.state
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="State"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                        />

                        <input
                          name="pincode"
                          value={
                            editFormData.pincode
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Pincode"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                        />

                      </div>

                    </section>

                    <section>

                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">

                        <MapPinned className="w-4 h-4 text-indigo-600" />

                        Communication Address

                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <textarea
                          name="communication_address"
                          value={
                            editFormData.communication_address
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Communication Street Address"
                          rows={3}
                          className="md:col-span-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none resize-none focus:border-indigo-500"
                        />

                        <input
                          name="communication_city"
                          value={
                            editFormData.communication_city
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="City"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                        />

                        <input
                          name="communication_state"
                          value={
                            editFormData.communication_state
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="State"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                        />

                        <input
                          name="communication_pincode"
                          value={
                            editFormData.communication_pincode
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Pincode"
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                        />

                      </div>

                    </section>

                    {[
                      {
                        title:
                          "Emergency Contact 1",

                        name:
                          "emergency_contact_name",

                        phone:
                          "emergency_contact_phone",

                        relation:
                          "emergency_contact_relation",
                      },

                      {
                        title:
                          "Emergency Contact 2",

                        name:
                          "emergency_contact_2_name",

                        phone:
                          "emergency_contact_2_phone",

                        relation:
                          "emergency_contact_2_relation",
                      },

                      {
                        title:
                          "Emergency Contact 3",

                        name:
                          "emergency_contact_3_name",

                        phone:
                          "emergency_contact_3_phone",

                        relation:
                          "emergency_contact_3_relation",
                      },
                    ].map(
                      (contact) => (
                        <section
                          key={
                            contact.title
                          }
                        >

                          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">

                            <Phone className="w-4 h-4 text-indigo-600" />

                            {
                              contact.title
                            }

                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            <input
                              name={
                                contact.name
                              }
                              value={
                                editFormData[
                                  contact.name as keyof EditFormData
                                ] as string
                              }
                              onChange={
                                handleInputChange
                              }
                              placeholder="Contact Name"
                              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                            />

                            <input
                              name={
                                contact.phone
                              }
                              value={
                                editFormData[
                                  contact.phone as keyof EditFormData
                                ] as string
                              }
                              onChange={
                                handleInputChange
                              }
                              placeholder="Contact Phone"
                              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                            />

                            <input
                              name={
                                contact.relation
                              }
                              value={
                                editFormData[
                                  contact.relation as keyof EditFormData
                                ] as string
                              }
                              onChange={
                                handleInputChange
                              }
                              placeholder="Relationship"
                              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                            />

                          </div>

                        </section>
                      )
                    )}

                  </>
                )}

                {/* BANK */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "bank") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                      Bank & Identity
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <input
                        name="bank_name"
                        value={
                          editFormData.bank_name
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Bank Name"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="bank_account_number"
                        value={
                          editFormData.bank_account_number
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Bank Account Number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="ifsc_code"
                        value={
                          editFormData.ifsc_code
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="IFSC Code"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="pan_number"
                        value={
                          editFormData.pan_number
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="PAN Number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="aadhar_number"
                        value={
                          editFormData.aadhar_number
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Aadhaar Number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="passport_number"
                        value={
                          editFormData.passport_number
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Passport Number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                    </div>

                  </section>
                )}

                {/* STATUTORY */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "statutory") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                      Statutory
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <input
                        name="pf"
                        value={
                          editFormData.pf
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="PF"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="esi"
                        value={
                          editFormData.esi
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="ESI"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="pt"
                        value={
                          editFormData.pt
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="PT"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="tds"
                        value={
                          editFormData.tds
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="TDS"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                    </div>

                  </section>
                )}

                {/* EMPLOYMENT */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "employment") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                      Employment
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <select
                        name="department_id"
                        value={
                          editFormData.department_id
                        }
                        onChange={
                          handleInputChange
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      >

                        <option value="">
                          Select Department
                        </option>

                        {departments.map(
                          (department) => (
                            <option
                              key={
                                department.id
                              }
                              value={
                                department.id
                              }
                            >
                              {
                                department.name
                              }
                            </option>
                          )
                        )}

                      </select>

                      <input
                        name="designation"
                        value={
                          editFormData.designation
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Designation"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="probation_end_date"
                        type="date"
                        value={
                          editFormData.probation_end_date
                        }
                        onChange={
                          handleInputChange
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="confirmation_date"
                        type="date"
                        value={
                          editFormData.confirmation_date
                        }
                        onChange={
                          handleInputChange
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="reporting_manager"
                        value={
                          editFormData.reporting_manager
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Reporting Manager"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                      <input
                        name="work_location"
                        value={
                          editFormData.work_location
                        }
                        onChange={
                          handleInputChange
                        }
                        placeholder="Work Location"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />

                    </div>

                  </section>
                )}

                {/* ACTIONS */}

                <div className="sticky bottom-0 bg-white border-t border-slate-200 pt-5 flex justify-end gap-3">

                  <button
                    type="button"
                    onClick={
                      closeEditModal
                    }
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >

                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Submit Request
                      </>
                    )}

                  </button>

                </div>

              </form>
            )}

          </div>

        </div>
      )}

    </div>
  );
}