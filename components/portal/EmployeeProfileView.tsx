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
  LaptopMinimal,
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

  accessory_type: string;
  accessory_serial: string;

  peripherals: {
    type: string;
    serial: string;
  }[];
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

  accessory_type: "",
  accessory_serial: "",

  peripherals: [],
};

type EditSection =
  | "all"
  | "personal"
  | "address"
  | "bank"
  | "employment"
  | "document"
  | "statutory"
  | "accessory"
  | null;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const labelClass =
  "block mb-2 text-xs font-bold text-slate-700 uppercase tracking-wider";

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
    | "accessory"
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

  const [profilePhotoUrl, setProfilePhotoUrl] =
    useState<string | null>(
      employeeData.profile_photo_url || null
    );

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
    setDocumentError(null);
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
    setErrorMessage(null);
  };

  /* ============================================================
     RESET EDIT FORM
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

      accessory_type:
        data.accessory_type || "",

      accessory_serial:
        data.accessory_serial || "",

      peripherals:
        Array.isArray(data.peripherals)
          ? data.peripherals.map((item: any) => ({
              type: item?.type || "",
              serial: item?.serial || "",
            }))
          : [],
    });

    setPendingRequest(
      initialPendingRequest
    );
  }, [
    employee,
    initialPendingRequest,
  ]);

  /* ============================================================
     PROFILE PHOTO SYNC
  ============================================================ */

  useEffect(() => {
    const databasePhoto =
      employeeData.profile_photo_url || null;

    setProfilePhotoUrl(databasePhoto);

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

      setProfilePhotoUrl(
        newAvatarUrl
      );

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
     LOAD DOCUMENTS
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

    if (loading) {
      return;
    }

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

        accessory_type:
          editFormData.accessory_type,

        accessory_serial:
          editFormData.accessory_serial,

        peripherals:
          editFormData.peripherals,
      };

      const fieldMap: Record<
        string,
        string
      > = {
        phone: "phone",
        date_of_birth: "date_of_birth",
        gender: "gender",
        blood_group: "blood_group",
        marital_status: "marital_status",

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

        accessory_type:
          "accessory_type",

        accessory_serial:
          "accessory_serial",

        peripherals:
          "peripherals",
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

        accessory: [
          "accessory_type",
          "accessory_serial",
          "peripherals",
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

          let isChanged = false;

          if (
            field === "peripherals"
          ) {
            const oldPeripherals =
              Array.isArray(oldValue)
                ? oldValue.map(
                    (item: any) => ({
                      type:
                        item?.type ||
                        "",
                      serial:
                        item?.serial ||
                        "",
                    })
                  )
                : [];

            const newPeripherals =
              Array.isArray(newValue)
                ? newValue.map(
                    (item: any) => ({
                      type:
                        item?.type ||
                        "",
                      serial:
                        item?.serial ||
                        "",
                    })
                  )
                : [];

            isChanged =
              JSON.stringify(
                oldPeripherals
              ) !==
              JSON.stringify(
                newPeripherals
              );
          } else {
            const oldNormalized =
              String(
                oldValue ?? ""
              ).trim();

            const newNormalized =
              String(
                newValue ?? ""
              ).trim();

            isChanged =
              oldNormalized !==
              newNormalized;
          }

          if (isChanged) {
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

      case "accessory":
        return "Request Accessory Management Edit";

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

    {
      id: "accessory" as const,
      label: "Accessory Management",
      icon: LaptopMinimal,
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
          PENDING REQUEST
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

                      <label className={labelClass}>
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
                        className={inputClass}
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
                        className={labelClass}
                      >
                        Custom Label
                        <span className="font-normal text-slate-400 normal-case">
                          {" "}
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
                        className={inputClass}
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
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-sm transition-all"
                        >

                          <div className="flex items-center gap-3 min-w-0">

                            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">

                              <FileText className="w-5 h-5" />

                            </div>

                            <div className="min-w-0">

                              <p className="text-xs font-bold text-slate-900 truncate">
                                {doc.document_name}
                              </p>

                              <div className="flex items-center gap-2 mt-1">

                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                                  {doc.document_type}
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
                                    : doc.uploaded_at
                                    ? new Date(
                                        doc.uploaded_at
                                      ).toLocaleDateString()
                                    : "Not specified"}

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

          {/* ========================================================
              ACCESSORY MANAGEMENT
          ======================================================== */}

          {activeTab === "accessory" && (
            <div className="space-y-8">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Accessory Management
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Employee assigned main accessory and peripheral details.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditSection(
                      "accessory"
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

                  <LaptopMinimal className="w-4 h-4 text-indigo-600" />

                  Main Accessory

                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Accessory Type
                    </span>

                    <span className="font-semibold text-slate-800">
                      {employeeData.accessory_type ||
                        "No Main Accessory"}
                    </span>

                  </div>

                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">

                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Serial Number
                    </span>

                    <span className="font-semibold text-slate-800 font-mono">
                      {employeeData.accessory_serial ||
                        "Not specified"}
                    </span>

                  </div>

                </div>

              </div>

              <div>

                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
                  Peripherals
                </h4>

                {Array.isArray(
                  employeeData.peripherals
                ) &&
                employeeData.peripherals.length >
                  0 ? (

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {employeeData.peripherals.map(
                      (
                        item: any,
                        index: number
                      ) => (

                        <div
                          key={`${item?.type || "peripheral"}-${index}`}
                          className="p-4 bg-slate-50/70 rounded-xl border border-slate-100"
                        >

                          <div className="flex items-center justify-between gap-3">

                            <span className="text-sm font-bold text-slate-900">
                              {item?.type ||
                                "Other"}
                            </span>

                            <span className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md">
                              Peripheral
                            </span>

                          </div>

                          <div className="mt-3">

                            <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                              Serial Number
                            </span>

                            <span className="font-semibold text-slate-800 font-mono">
                              {item?.serial ||
                                "Not specified"}
                            </span>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                ) : (

                  <div className="p-6 bg-slate-50/70 rounded-xl border border-slate-100 text-center">

                    <p className="text-sm font-semibold text-slate-500">
                      No peripherals assigned
                    </p>

                  </div>

                )}

              </div>

            </div>
          )}

        </div>

      </div>

      {/* ============================================================
          EDIT PROFILE MODAL
          
          IMPORTANT:
          fixed + inset-0 + flex + items-center + justify-center
          makes the modal exactly center of the viewport.
      ============================================================ */}

      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditModal();
            }
          }}
        >

          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            {/* ======================================================
                MODAL HEADER
            ====================================================== */}

            <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">

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
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
                aria-label="Close modal"
              >

                <XCircle className="w-5 h-5" />

              </button>

            </div>

            {/* ======================================================
                DOCUMENT MODAL
            ====================================================== */}

            {editSection ===
            "document" ? (
              <div className="overflow-y-auto p-6 space-y-6">

                <div className="bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-2xl p-6">

                  <div className="max-w-xl mx-auto space-y-4">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      <div>

                        <label
                          className={labelClass}
                        >
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
                          className={inputClass}
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
                          className={labelClass}
                        >
                          Custom Label
                          <span className="font-normal text-slate-400 normal-case">
                            {" "}
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
                          className={inputClass}
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

              /* ======================================================
                 PROFILE EDIT FORM
              ====================================================== */

              <form
                onSubmit={
                  handleFormSubmit
                }
                className="flex-1 overflow-y-auto p-6 space-y-8"
              >

                {/* ==================================================
                    PERSONAL INFORMATION
                ================================================== */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "personal") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5">
                      Personal Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      {/* Mobile No */}

                      <div>

                        <label
                          htmlFor="phone"
                          className={labelClass}
                        >
                          Mobile No
                        </label>

                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={
                            editFormData.phone
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter mobile number"
                          className={inputClass}
                        />

                      </div>

                      {/* Date of Birth */}

                      <div>

                        <label
                          htmlFor="date_of_birth"
                          className={labelClass}
                        >
                          Date of Birth
                        </label>

                        <input
                          id="date_of_birth"
                          type="date"
                          name="date_of_birth"
                          value={
                            editFormData.date_of_birth
                          }
                          onChange={
                            handleInputChange
                          }
                          className={inputClass}
                        />

                      </div>

                      {/* Gender */}

                      <div>

                        <label
                          htmlFor="gender"
                          className={labelClass}
                        >
                          Gender
                        </label>

                        <select
                          id="gender"
                          name="gender"
                          value={
                            editFormData.gender
                          }
                          onChange={
                            handleInputChange
                          }
                          className={inputClass}
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

                      {/* Blood Group */}

                      <div>

                        <label
                          htmlFor="blood_group"
                          className={labelClass}
                        >
                          Blood Group
                        </label>

                        <input
                          id="blood_group"
                          name="blood_group"
                          value={
                            editFormData.blood_group
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter blood group"
                          className={inputClass}
                        />

                      </div>

                      {/* Marital Status */}

                      <div>

                        <label
                          htmlFor="marital_status"
                          className={labelClass}
                        >
                          Marital Status
                        </label>

                        <select
                          id="marital_status"
                          name="marital_status"
                          value={
                            editFormData.marital_status
                          }
                          onChange={
                            handleInputChange
                          }
                          className={inputClass}
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
                )}

                {/* ==================================================
                    ADDRESS
                ================================================== */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "address") && (
                  <>
                    {/* PERMANENT ADDRESS */}

                    <section>

                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">

                        <MapPin className="w-4 h-4 text-indigo-600" />

                        Permanent Address

                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        <div className="md:col-span-2">

                          <label
                            htmlFor="address"
                            className={labelClass}
                          >
                            Permanent Address
                          </label>

                          <textarea
                            id="address"
                            name="address"
                            value={
                              editFormData.address
                            }
                            onChange={
                              handleInputChange
                            }
                            placeholder="Enter permanent address"
                            rows={3}
                            className={`${inputClass} resize-none`}
                          />

                        </div>

                        <div>

                          <label
                            htmlFor="city"
                            className={labelClass}
                          >
                            City
                          </label>

                          <input
                            id="city"
                            name="city"
                            value={
                              editFormData.city
                            }
                            onChange={
                              handleInputChange
                            }
                            placeholder="Enter city"
                            className={inputClass}
                          />

                        </div>

                        <div>

                          <label
                            htmlFor="state"
                            className={labelClass}
                          >
                            State
                          </label>

                          <input
                            id="state"
                            name="state"
                            value={
                              editFormData.state
                            }
                            onChange={
                              handleInputChange
                            }
                            placeholder="Enter state"
                            className={inputClass}
                          />

                        </div>

                        <div>

                          <label
                            htmlFor="pincode"
                            className={labelClass}
                          >
                            Pincode
                          </label>

                          <input
                            id="pincode"
                            name="pincode"
                            type="text"
                            value={
                              editFormData.pincode
                            }
                            onChange={
                              handleInputChange
                            }
                            placeholder="Enter pincode"
                            className={inputClass}
                          />

                        </div>

                      </div>

                    </section>

                    {/* COMMUNICATION ADDRESS */}

                    <section>

                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">

                        <MapPinned className="w-4 h-4 text-indigo-600" />

                        Communication Address

                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        <div className="md:col-span-2">

                          <label
                            htmlFor="communication_address"
                            className={labelClass}
                          >
                            Communication Address
                          </label>

                          <textarea
                            id="communication_address"
                            name="communication_address"
                            value={
                              editFormData.communication_address
                            }
                            onChange={
                              handleInputChange
                            }
                            placeholder="Enter communication address"
                            rows={3}
                            className={`${inputClass} resize-none`}
                          />

                        </div>

                        <div>

                          <label
                            htmlFor="communication_city"
                            className={labelClass}
                          >
                            City
                          </label>

                          <input
                            id="communication_city"
                            name="communication_city"
                            value={
                              editFormData.communication_city
                            }
                            onChange={
                              handleInputChange
                            }
                            placeholder="Enter city"
                            className={inputClass}
                          />

                        </div>

                        <div>

                          <label
                            htmlFor="communication_state"
                            className={labelClass}
                          >
                            State
                          </label>

                          <input
                            id="communication_state"
                            name="communication_state"
                            value={
                              editFormData.communication_state
                            }
                            onChange={
                              handleInputChange
                            }
                            placeholder="Enter state"
                            className={inputClass}
                          />

                        </div>

                        <div>

                          <label
                            htmlFor="communication_pincode"
                            className={labelClass}
                          >
                            Pincode
                          </label>

                          <input
                            id="communication_pincode"
                            name="communication_pincode"
                            value={
                              editFormData.communication_pincode
                            }
                            onChange={
                              handleInputChange
                            }
                            placeholder="Enter pincode"
                            className={inputClass}
                          />

                        </div>

                      </div>

                    </section>

                    {/* EMERGENCY CONTACTS */}

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

                          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">

                            <Phone className="w-4 h-4 text-indigo-600" />

                            {
                              contact.title
                            }

                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                            <div>

                              <label
                                htmlFor={
                                  contact.name
                                }
                                className={labelClass}
                              >
                                Contact Name
                              </label>

                              <input
                                id={
                                  contact.name
                                }
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
                                placeholder="Enter contact name"
                                className={inputClass}
                              />

                            </div>

                            <div>

                              <label
                                htmlFor={
                                  contact.phone
                                }
                                className={labelClass}
                              >
                                Mobile No
                              </label>

                              <input
                                id={
                                  contact.phone
                                }
                                name={
                                  contact.phone
                                }
                                type="tel"
                                value={
                                  editFormData[
                                    contact.phone as keyof EditFormData
                                  ] as string
                                }
                                onChange={
                                  handleInputChange
                                }
                                placeholder="Enter mobile number"
                                className={inputClass}
                              />

                            </div>

                            <div>

                              <label
                                htmlFor={
                                  contact.relation
                                }
                                className={labelClass}
                              >
                                Relationship
                              </label>

                              <input
                                id={
                                  contact.relation
                                }
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
                                placeholder="Enter relationship"
                                className={inputClass}
                              />

                            </div>

                          </div>

                        </section>
                      )
                    )}

                  </>
                )}

                {/* ==================================================
                    BANK & IDENTITY
                ================================================== */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "bank") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5">
                      Bank & Identity
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      <div>

                        <label
                          htmlFor="bank_name"
                          className={labelClass}
                        >
                          Bank Name
                        </label>

                        <input
                          id="bank_name"
                          name="bank_name"
                          value={
                            editFormData.bank_name
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter bank name"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="bank_account_number"
                          className={labelClass}
                        >
                          Bank Account Number
                        </label>

                        <input
                          id="bank_account_number"
                          name="bank_account_number"
                          value={
                            editFormData.bank_account_number
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter account number"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="ifsc_code"
                          className={labelClass}
                        >
                          IFSC Code
                        </label>

                        <input
                          id="ifsc_code"
                          name="ifsc_code"
                          value={
                            editFormData.ifsc_code
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter IFSC code"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="pan_number"
                          className={labelClass}
                        >
                          PAN Number
                        </label>

                        <input
                          id="pan_number"
                          name="pan_number"
                          value={
                            editFormData.pan_number
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter PAN number"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="aadhar_number"
                          className={labelClass}
                        >
                          Aadhaar Number
                        </label>

                        <input
                          id="aadhar_number"
                          name="aadhar_number"
                          value={
                            editFormData.aadhar_number
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter Aadhaar number"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="passport_number"
                          className={labelClass}
                        >
                          Passport Number
                        </label>

                        <input
                          id="passport_number"
                          name="passport_number"
                          value={
                            editFormData.passport_number
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter passport number"
                          className={inputClass}
                        />

                      </div>

                    </div>

                  </section>
                )}

                {/* ==================================================
                    STATUTORY
                ================================================== */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "statutory") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5">
                      Statutory Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      <div>

                        <label
                          htmlFor="pf"
                          className={labelClass}
                        >
                          PF
                        </label>

                        <input
                          id="pf"
                          name="pf"
                          value={
                            editFormData.pf
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter PF details"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="esi"
                          className={labelClass}
                        >
                          ESI
                        </label>

                        <input
                          id="esi"
                          name="esi"
                          value={
                            editFormData.esi
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter ESI details"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="pt"
                          className={labelClass}
                        >
                          Professional Tax (PT)
                        </label>

                        <input
                          id="pt"
                          name="pt"
                          value={
                            editFormData.pt
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter PT details"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="tds"
                          className={labelClass}
                        >
                          TDS
                        </label>

                        <input
                          id="tds"
                          name="tds"
                          value={
                            editFormData.tds
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter TDS details"
                          className={inputClass}
                        />

                      </div>

                    </div>

                  </section>
                )}

                {/* ==================================================
                    ACCESSORY MANAGEMENT
                ================================================== */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "accessory") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">

                      <LaptopMinimal className="w-4 h-4 text-indigo-600" />

                      Accessory Management

                    </h3>

                    {/* MAIN ACCESSORY */}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      <div>

                        <label
                          htmlFor="accessory_type"
                          className={labelClass}
                        >
                          Accessory Type
                        </label>

                        <input
                          id="accessory_type"
                          name="accessory_type"
                          value={
                            editFormData.accessory_type
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Example: Laptop"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="accessory_serial"
                          className={labelClass}
                        >
                          Accessory Serial Number
                        </label>

                        <input
                          id="accessory_serial"
                          name="accessory_serial"
                          value={
                            editFormData.accessory_serial
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter serial number"
                          className={inputClass}
                        />

                      </div>

                    </div>

                    {/* PERIPHERALS */}

                    <div className="mt-7">

                      <div className="flex items-center justify-between mb-4">

                        <div>

                          <h4 className="text-sm font-bold text-slate-900">
                            Peripherals
                          </h4>

                          <p className="text-xs text-slate-500 mt-1">
                            Add keyboards, mouse, monitors and other assigned items.
                          </p>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setEditFormData(
                              (previous) => ({
                                ...previous,

                                peripherals: [
                                  ...previous.peripherals,
                                  {
                                    type: "",
                                    serial: "",
                                  },
                                ],
                              })
                            )
                          }
                          className="px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold"
                        >
                          + Add Peripheral
                        </button>

                      </div>

                      {editFormData.peripherals.length ===
                      0 ? (
                        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center">

                          <p className="text-sm text-slate-500 font-medium">
                            No peripherals added.
                          </p>

                        </div>
                      ) : (

                        <div className="space-y-4">

                          {editFormData.peripherals.map(
                            (
                              peripheral,
                              index
                            ) => (

                              <div
                                key={index}
                                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60"
                              >

                                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">

                                  <div>

                                    <label
                                      className={labelClass}
                                    >
                                      Peripheral Type
                                    </label>

                                    <input
                                      value={
                                        peripheral.type
                                      }
                                      onChange={(
                                        event
                                      ) => {
                                        const value =
                                          event.target.value;

                                        setEditFormData(
                                          (
                                            previous
                                          ) => {
                                            const updated =
                                              [
                                                ...previous.peripherals,
                                              ];

                                            updated[
                                              index
                                            ] = {
                                              ...updated[
                                                index
                                              ],
                                              type: value,
                                            };

                                            return {
                                              ...previous,
                                              peripherals:
                                                updated,
                                            };
                                          }
                                        );
                                      }}
                                      placeholder="Example: Mouse"
                                      className={inputClass}
                                    />

                                  </div>

                                  <div>

                                    <label
                                      className={labelClass}
                                    >
                                      Serial Number
                                    </label>

                                    <input
                                      value={
                                        peripheral.serial
                                      }
                                      onChange={(
                                        event
                                      ) => {
                                        const value =
                                          event.target.value;

                                        setEditFormData(
                                          (
                                            previous
                                          ) => {
                                            const updated =
                                              [
                                                ...previous.peripherals,
                                              ];

                                            updated[
                                              index
                                            ] = {
                                              ...updated[
                                                index
                                              ],
                                              serial:
                                                value,
                                            };

                                            return {
                                              ...previous,
                                              peripherals:
                                                updated,
                                            };
                                          }
                                        );
                                      }}
                                      placeholder="Enter serial number"
                                      className={inputClass}
                                    />

                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditFormData(
                                        (
                                          previous
                                        ) => ({
                                          ...previous,

                                          peripherals:
                                            previous.peripherals.filter(
                                              (
                                                _,
                                                itemIndex
                                              ) =>
                                                itemIndex !==
                                                index
                                            ),
                                        })
                                      )
                                    }
                                    className="h-[46px] px-4 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-sm font-bold"
                                  >
                                    Remove
                                  </button>

                                </div>

                              </div>

                            )
                          )}

                        </div>
                      )}

                    </div>

                  </section>
                )}

                {/* ==================================================
                    EMPLOYMENT
                ================================================== */}

                {(editSection ===
                  "all" ||
                  editSection ===
                    "employment") && (
                  <section>

                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5">
                      Employment Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      <div>

                        <label
                          htmlFor="department_id"
                          className={labelClass}
                        >
                          Department
                        </label>

                        <select
                          id="department_id"
                          name="department_id"
                          value={
                            editFormData.department_id
                          }
                          onChange={
                            handleInputChange
                          }
                          className={inputClass}
                        >

                          <option value="">
                            Select Department
                          </option>

                          {departments.map(
                            (
                              department
                            ) => (
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

                      </div>

                      <div>

                        <label
                          htmlFor="designation"
                          className={labelClass}
                        >
                          Designation
                        </label>

                        <input
                          id="designation"
                          name="designation"
                          value={
                            editFormData.designation
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter designation"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="probation_end_date"
                          className={labelClass}
                        >
                          Probation End Date
                        </label>

                        <input
                          id="probation_end_date"
                          name="probation_end_date"
                          type="date"
                          value={
                            editFormData.probation_end_date
                          }
                          onChange={
                            handleInputChange
                          }
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="confirmation_date"
                          className={labelClass}
                        >
                          Confirmation Date
                        </label>

                        <input
                          id="confirmation_date"
                          name="confirmation_date"
                          type="date"
                          value={
                            editFormData.confirmation_date
                          }
                          onChange={
                            handleInputChange
                          }
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="reporting_manager"
                          className={labelClass}
                        >
                          Reporting Manager
                        </label>

                        <input
                          id="reporting_manager"
                          name="reporting_manager"
                          value={
                            editFormData.reporting_manager
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter reporting manager"
                          className={inputClass}
                        />

                      </div>

                      <div>

                        <label
                          htmlFor="work_location"
                          className={labelClass}
                        >
                          Work Location
                        </label>

                        <input
                          id="work_location"
                          name="work_location"
                          value={
                            editFormData.work_location
                          }
                          onChange={
                            handleInputChange
                          }
                          placeholder="Enter work location"
                          className={inputClass}
                        />

                      </div>

                    </div>

                  </section>
                )}

                {/* ==================================================
                    ACTIONS
                ================================================== */}

                <div className="sticky bottom-0 z-10 -mx-6 px-6 py-5 bg-white/95 backdrop-blur border-t border-slate-200 flex justify-end gap-3">

                  <button
                    type="button"
                    onClick={
                      closeEditModal
                    }
                    disabled={
                      loading
                    }
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
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