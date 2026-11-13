"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent, } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw,
  UserPlus,
  Users,
  FileText,
  Eye,
  CalendarDays,
  X,
} from "lucide-react";

type Department = {
  id: string;
  name: string;
};

type JoiningDocument = {
  id: string;
  document_type: string;
  version: number;
  created_at: string;
  sent_at: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  storage_path?: string;
};

type Candidate = {
  id: string;
  first_name: string;
  last_name: string;
  personal_email: string;
  mobile_number: string;
  designation: string;
  joining_date: string | null;
  annual_ctc: number | string;
  gender?: string | null;
  experience_level?: "fresher" | "experienced" | null;
  total_experience_years?: number | null;
  total_experience_months?: number | null;
  probation_period_months?: number | null;
  department?: string | null;
  employment_type?: string | null;
  work_location?: string | null;
  status: string;
  created_at: string;
  joining_documents?: JoiningDocument[];
  employee_id?: string | null;
  employee_record_id?: string | null;
  conversion_status?: "not_started" | "processing" | "completed" | "failed";
  joining_letter_send_status?: "not_started" | "sending" | "sent" | "failed";
};

const initialForm = {
  first_name: "",
  last_name: "",
  personal_email: "",
  mobile_number: "",
  designation: "",
  annual_ctc: "",
  gender: "",
  experience_level: "fresher" as "fresher" | "experienced",
  total_experience_years: "0",
  total_experience_months: "0",
  probation_period_months: "",
  department: "",
  employment_type: "",
  work_location: "",
};

const statusLabels: Record<string, string> = {
  selected: "Selected",
  offer_sent: "Offer Sent",
  offer_accepted: "Offer Accepted",
  offer_declined: "Offer Declined",
  joining_letter_sent: "Joining Letter Sent",
  joined: "Joined",
  cancelled: "Cancelled",
  expired: "Expired",
};

const inputClass ="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const labelClass = "block text-sm font-medium text-slate-700";

function getIndiaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function generateOfficialEmail(
  firstName: string,
  lastName: string
): string {
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  const first = normalize(firstName);
  const lastInitial = normalize(lastName).charAt(0);

  if (!first || !lastInitial) return "";

  return `${first}.${lastInitial}@teenss.com`;
}

export default function JoiningCandidates() {
  const [form, setForm] = useState(initialForm);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [candidateDocuments, setCandidateDocuments] = useState<Array<{ file: File; documentType: "resume" | "experience_document" }>>([]);
  const [uploadDocumentType, setUploadDocumentType] = useState<"resume" | "experience_document">("resume");

  const [offerLoadingId, setOfferLoadingId] = useState<string | null>(null);
  const [offerDocuments, setOfferDocuments] = useState<Record<string, string>>(
    {}
  );

  const [editingOfferCandidate, setEditingOfferCandidate] =
    useState<Candidate | null>(null);
  const [offerEditForm, setOfferEditForm] = useState({
    first_name: "",
    last_name: "",
    gender: "",
    designation: "",
    department: "",
    employment_type: "",
    work_location: "",
    annual_ctc: "",
    experience_level: "fresher" as "fresher" | "experienced",
    total_experience_years: "0",
    total_experience_months: "0",
  });
  const [offerEditSaving, setOfferEditSaving] = useState(false);
  const [offerEditError, setOfferEditError] = useState("");
  const [offerEditDocuments, setOfferEditDocuments] = useState<Array<{ file: File; documentType: "resume" | "experience_document" }>>([]);
  const [offerEditUploadType, setOfferEditUploadType] = useState<"resume" | "experience_document">("resume");

  const [joiningLetterLoadingId, setJoiningLetterLoadingId] = useState<
    string | null
  >(null);

  const [joiningLetterDocuments, setJoiningLetterDocuments] = useState<
    Record<string, string>
  >({});

  const [confirmJoinedLoadingId, setConfirmJoinedLoadingId] = useState<
    string | null
  >(null);

  const [confirmJoinedCandidate, setConfirmJoinedCandidate] =
    useState<Candidate | null>(null);

  const [officialEmail, setOfficialEmail] = useState("");

  // Statutory details collected while confirming employee joining
  const [pfEligible, setPfEligible] = useState(false);
  const [uanNumber, setUanNumber] = useState("");
  const [esiEligible, setEsiEligible] = useState(false);
  const [esiNumber, setEsiNumber] = useState("");
  const [ptEligible, setPtEligible] = useState(false);
  const [ptNumber, setPtNumber] = useState("");
  const [tdsEligible, setTdsEligible] = useState(false);

  const [joiningDateCandidate, setJoiningDateCandidate] =
    useState<Candidate | null>(null);

  const [joiningDate, setJoiningDate] = useState("");
  const [probationPeriodMonths, setProbationPeriodMonths] = useState("3");

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [dialogError, setDialogError] = useState("");
  const [confirmJoinedError, setConfirmJoinedError] = useState("");

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadDepartments = useCallback(async () => {

    try {
      const response = await fetch("/api/departments", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load departments.");
      }

      setDepartments(
        Array.isArray(result.departments) ? result.departments : []
      );
    } catch (err) {
      setDepartments([]);
      showToast(
        "error",
        err instanceof Error ? err.message : "Unable to load departments."
      );
    } finally {
      setDepartmentsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDepartments();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDepartments]);

  const loadCandidates = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/joining", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load candidates.");
      }

      const loadedCandidates: Candidate[] = result.candidates ?? [];

      const nextOfferDocuments: Record<string, string> = {};
      const nextJoiningLetterDocuments: Record<string, string> = {};

      for (const candidate of loadedCandidates) {
        const documents = candidate.joining_documents ?? [];

        const latestOffer = documents
          .filter((document) => document.document_type === "offer_letter")
          .sort((a, b) => b.version - a.version)[0];

        const latestJoiningLetter = documents
          .filter((document) => document.document_type === "joining_letter")
          .sort((a, b) => b.version - a.version)[0];

        if (latestOffer) {
          nextOfferDocuments[candidate.id] = latestOffer.id;
        }

        if (latestJoiningLetter) {
          nextJoiningLetterDocuments[candidate.id] = latestJoiningLetter.id;
        }
      }

      setCandidates(loadedCandidates);
      setOfferDocuments(nextOfferDocuments);
      setJoiningLetterDocuments(nextJoiningLetterDocuments);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Unable to load candidates."
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCandidates(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCandidates]);

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);
    const years = Number(form.total_experience_years);
    const months = Number(form.total_experience_months);

    if (!Number.isInteger(years) || years < 0 || years > 50 || !Number.isInteger(months) || months < 0 || months > 11) {
      showToast("error", "Enter valid experience years and months."); return;
    }
    if (form.experience_level === "fresher" && (years !== 0 || months !== 0)) {
      showToast("error", "Fresher experience must be 0 years and 0 months."); return;
    }
    if (form.experience_level === "experienced" && years === 0 && months === 0) {
      showToast("error", "Enter the candidate's total experience."); return;
    }

    const selectedFiles = candidateDocuments.map((document) => document.file);
    const invalidFile = selectedFiles.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      return !["pdf", "doc", "docx"].includes(extension || "") || file.size > 10 * 1024 * 1024;
    });
    if (invalidFile) {
      showToast("error", `${invalidFile.name}: only PDF, DOC, or DOCX files up to 10 MB are allowed.`); return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/joining", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name, last_name: form.last_name,
          personal_email: form.personal_email, mobile_number: form.mobile_number,
          designation: form.designation, annual_ctc: Number(form.annual_ctc),
          gender: form.gender, department: form.department,
          employment_type: form.employment_type, work_location: form.work_location,
          experience_level: form.experience_level,
          total_experience_years: form.experience_level === "fresher" ? 0 : years,
          total_experience_months: form.experience_level === "fresher" ? 0 : months,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create candidate.");

      const candidateId = result.candidate?.id ?? result.id;
      if (selectedFiles.length && !candidateId) {
        await loadCandidates();
        throw new Error("Candidate was created, but its ID was not returned. Documents were not uploaded; refresh the pipeline and contact support.");
      }

      const uploadFile = async (file: File, documentType: "resume" | "experience_document") => {
        const data = new FormData(); data.append("file", file); data.append("document_type", documentType);
        const uploadResponse = await fetch(`/api/joining/${candidateId}/documents`, { method: "POST", body: data });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(`${file.name}: ${uploadResult.error || "Upload failed."}`);
      };

      const errors: string[] = [];
      for (const document of candidateDocuments) {
        try {
          await uploadFile(document.file, document.documentType);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : `${document.file.name}: upload failed.`);
        }
      }
      setCandidateDocuments([]);

      setForm(initialForm);
      await loadCandidates();
      if (errors.length) showToast("error", `Candidate created, but some documents failed to upload: ${errors.join(" | ")}`);
      else showToast("success", "Joining candidate and selected documents saved successfully.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Unable to create candidate.");
    } finally { setSaving(false); }
  }
    async function handleGenerateOffer(candidate: Candidate) {
    setToast(null);
    setOfferLoadingId(candidate.id);

    try {
      const response = await fetch(`/api/joining/${candidate.id}/offer`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to generate offer letter.");
      }

      if (result.document?.id) {
        setOfferDocuments((current) => ({
          ...current,
          [candidate.id]: result.document.id,
        }));
      }

      showToast(
        "success",
        `Offer PDF generated for ${candidate.first_name} ${candidate.last_name}.`
      );

      await loadCandidates();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Unable to generate offer letter."
      );
    } finally {
      setOfferLoadingId(null);
    }
  }

  function handleEditOffer(candidate: Candidate) {
    setOfferEditError("");
    setOfferEditDocuments([]);
    setOfferEditUploadType("resume");
    setOfferEditForm({
      first_name: candidate.first_name ?? "",
      last_name: candidate.last_name ?? "",
      gender: candidate.gender ?? "",
      designation: candidate.designation ?? "",
      department: candidate.department ?? "",
      employment_type: candidate.employment_type ?? "",
      work_location: candidate.work_location ?? "",
      annual_ctc: String( Number(candidate.annual_ctc ?? 0) / 100000),
      experience_level: candidate.experience_level ?? "fresher",
      total_experience_years: String(candidate.total_experience_years ?? 0),
      total_experience_months: String(candidate.total_experience_months ?? 0),
    });
    setEditingOfferCandidate(candidate);
  }

  function closeEditOfferDialog() {
    if (offerEditSaving) return;
    setEditingOfferCandidate(null);
    setOfferEditError("");
    setOfferEditDocuments([]);
  }

  async function handleSaveOffer() {
    const candidate = editingOfferCandidate;
    if (!candidate || offerEditSaving) return;

    const years = Number(offerEditForm.total_experience_years);
    const months = Number(offerEditForm.total_experience_months);
    const ctc = Number(offerEditForm.annual_ctc);

    if (!offerEditForm.first_name.trim() || !offerEditForm.last_name.trim() ||
        !offerEditForm.gender || !offerEditForm.designation.trim() ||
        !offerEditForm.department || !offerEditForm.employment_type ||
        !offerEditForm.work_location) {
      setOfferEditError("Please complete all employment details.");
      return;
    }
    if (!Number.isFinite(ctc) || ctc <= 0) {
      setOfferEditError("Enter a valid annual CTC.");
      return;
    }
    if (!Number.isInteger(years) || years < 0 || years > 50 ||
        !Number.isInteger(months) || months < 0 || months > 11) {
      setOfferEditError("Enter valid experience years and months.");
      return;
    }
    if (offerEditForm.experience_level === "fresher" && (years !== 0 || months !== 0)) {
      setOfferEditError("Fresher experience must be 0 years and 0 months.");
      return;
    }
    if (offerEditForm.experience_level === "experienced" && years === 0 && months === 0) {
      setOfferEditError("Enter the candidate's total experience.");
      return;
    }

    const invalidEditFile = offerEditDocuments.find(({ file }) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      return !["pdf", "doc", "docx"].includes(extension || "") || file.size > 10 * 1024 * 1024;
    });
    if (invalidEditFile) {
      setOfferEditError(`${invalidEditFile.file.name}: only PDF, DOC, or DOCX files up to 10 MB are allowed.`);
      return;
    }

    setOfferEditSaving(true);
    setOfferEditError("");
    try {
      const response = await fetch(`/api/joining/${candidate.id}/offer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...offerEditForm,
          first_name: offerEditForm.first_name.trim(),
          last_name: offerEditForm.last_name.trim(),
          annual_ctc: Math.round(ctc * 100000),
          total_experience_years: years,
          total_experience_months: months,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update offer details.");

      // Candidate details are saved before any optional document replacement.
      // This endpoint must accept multipart FormData and persist the file against
      // the candidate without deleting unrelated candidate documents.
      const documentErrors: string[] = [];
      for (const document of offerEditDocuments) {
        const documentForm = new FormData();
        documentForm.append("file", document.file);
        documentForm.append("document_type", document.documentType);
        const documentResponse = await fetch(`/api/joining/${candidate.id}/documents`, { method: "POST", body: documentForm });
        const documentResult = await documentResponse.json();
        if (!documentResponse.ok) documentErrors.push(`${document.file.name}: ${documentResult.error || "Upload failed."}`);
      }
      if (documentErrors.length) throw new Error(`Candidate details were saved, but some documents failed to upload: ${documentErrors.join(" | ")}`);

      // The candidate update is committed before the revised PDF/email is generated.
      await loadCandidates();
      const offerResponse = await fetch(`/api/joining/${candidate.id}/offer`, { method: "POST" });
      const offerResult = await offerResponse.json();
      if (!offerResponse.ok) {
        throw new Error(`Offer details were saved, but the revised offer could not be sent: ${offerResult.error || "Please retry."}`);
      }
      if (offerResult.document?.id) {
        setOfferDocuments((current) => ({ ...current, [candidate.id]: offerResult.document.id }));
      }
      setEditingOfferCandidate(null);
      setOfferEditDocuments([]);
      showToast("success", "Candidate and offer details updated; revised offer sent successfully.");
      await loadCandidates();
    } catch (error) {
      setOfferEditError(error instanceof Error ? error.message : "Unable to update offer.");
    } finally {
      setOfferEditSaving(false);
    }
  }

  function handleGenerateJoiningLetter(candidate: Candidate) {
    setToast(null);
    setDialogError("");
    setJoiningDate(getIndiaToday());

    setProbationPeriodMonths(
      candidate.probation_period_months != null
        ? String(candidate.probation_period_months)
        : "3"
    );

    setJoiningDateCandidate(candidate);
  }

  function closeJoiningDateDialog() {
    if (joiningLetterLoadingId !== null) return;

    setJoiningDateCandidate(null);
    setJoiningDate("");
    setProbationPeriodMonths("3");
    setDialogError("");
  }

  async function handleSubmitJoiningLetter() {
    if (!joiningDateCandidate) return;

    setDialogError("");

    const today = getIndiaToday();

    if (!joiningDate) {
      setDialogError("Please select a joining date.");
      return;
    }

    if (joiningDate < today) {
      setDialogError("Joining date must be today or a future date.");
      return;
    }

    const allowedProbationPeriods = [0, 3, 6, 12];
    const selectedProbation = Number(probationPeriodMonths);

    if (
      probationPeriodMonths === "" ||
      !Number.isInteger(selectedProbation) ||
      !allowedProbationPeriods.includes(selectedProbation)
    ) {
      setDialogError(
        "Please select a valid probation duration: 0, 3, 6, or 12 months."
      );
      return;
    }

    const candidate = joiningDateCandidate;

    setToast(null);
    setJoiningLetterLoadingId(candidate.id);

    try {
      const response = await fetch(
        `/api/joining/${candidate.id}/joining-letter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            joining_date: joiningDate,
            probation_period_months: selectedProbation,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to generate joining letter.");
      }

      if (result.document?.id) {
        setJoiningLetterDocuments((current) => ({
          ...current,
          [candidate.id]: result.document.id,
        }));
      }

      setJoiningDateCandidate(null);
      setJoiningDate("");
      setProbationPeriodMonths("3");
      setDialogError("");

      showToast(
        "success",
        `Joining letter sent to ${candidate.personal_email}.`
      );

      await loadCandidates();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error
          ? err.message
          : "Unable to generate joining letter."
      );
    } finally {
      setJoiningLetterLoadingId(null);
    }
  }

  // Confirm Joined
  function handleConfirmJoined(candidate: Candidate) {
    if (
      candidate.conversion_status === "completed" ||
      candidate.status === "joined"
    ) {
      showToast(
        "success",
        candidate.employee_id
          ? `This candidate is already joined. Employee ID: ${candidate.employee_id}`
          : "This candidate is already joined."
      );
      return;
    }

    setOfficialEmail(
      generateOfficialEmail(candidate.first_name, candidate.last_name)
    );

    setConfirmJoinedError("");
    setPfEligible(false);
    setUanNumber("");
    setEsiEligible(false);
    setEsiNumber("");
    setPtEligible(false);
    setPtNumber("");
    setTdsEligible(false);

    setConfirmJoinedCandidate(candidate);
  }

  function closeConfirmJoinedDialog() {
    if (confirmJoinedLoadingId !== null) return;

    setConfirmJoinedCandidate(null);
    setOfficialEmail("");
    setConfirmJoinedError("");
    setPfEligible(false);
    setUanNumber("");
    setEsiEligible(false);
    setEsiNumber("");
    setPtEligible(false);
    setPtNumber("");
    setTdsEligible(false);
  }

  async function handleConfirmJoinedSubmit() {
    const candidate = confirmJoinedCandidate;
    const email = officialEmail.trim().toLowerCase();

    if (!candidate || confirmJoinedLoadingId !== null) return;

    if (
      !email ||
      !/^[a-z0-9]+(?:[._-][a-z0-9]+)*@teenss\.com$/i.test(email)
    ) {
      setConfirmJoinedError(
        "Enter a valid official company email ending with @teenss.com."
      );
      return;
    }

    if (esiEligible && !esiNumber.trim()) {
      setConfirmJoinedError("Please enter the ESI Number.");
      return;
    }

    if (ptEligible && !ptNumber.trim()) {
      setConfirmJoinedError("Please enter the Professional Tax Number.");
      return;
    }

    setConfirmJoinedError("");
    setToast(null);
    setConfirmJoinedLoadingId(candidate.id);

    try {
      const response = await fetch(
        `/api/joining/${candidate.id}/confirm-joined`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            official_email: email,
            pf_eligible: pfEligible,
            uan_number: pfEligible ? uanNumber.trim() || null : null,
            esi_healthcare_eligible: esiEligible,
            esi_number: esiEligible ? esiNumber.trim() || null : null,
            pt_eligible: ptEligible,
            pt_number: ptEligible ? ptNumber.trim() || null : null,
            tds_eligible: tdsEligible,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setConfirmJoinedError(
          result.error || "Unable to confirm joining."
        );
        return;
      }

      setConfirmJoinedCandidate(null);
      setOfficialEmail("");
      setConfirmJoinedError("");
      setPfEligible(false);
      setUanNumber("");
      setEsiEligible(false);
      setEsiNumber("");
      setPtEligible(false);
      setPtNumber("");
      setTdsEligible(false);

      showToast(
        "success",
        result.employee?.employee_id
          ? `Joining confirmed successfully. Employee ID: ${result.employee.employee_id}`
          : "Joining confirmed successfully."
      );

      await loadCandidates();
    } catch (err) {
      setConfirmJoinedError(
        err instanceof Error
          ? err.message
          : "Unable to confirm joining."
      );
    } finally {
      setConfirmJoinedLoadingId(null);
    }
  }

  function handlePreviewOffer(documentId: string) {
    window.open(
      `/api/joining/documents/${documentId}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function handlePreviewJoiningLetter(documentId: string) {
    window.open(
      `/api/joining/documents/${documentId}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const minimumJoiningDate = getIndiaToday();
    return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 pb-6">
      {isMounted && toast && createPortal(
        <div
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
          className={`fixed right-4 top-4 z-[10000] flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-xl border p-4 shadow-xl ${
            toast.type === "success"
              ? "border-emerald-200 bg-white text-emerald-800"
              : "border-red-200 bg-white text-red-800"
          }`}
        >
          <div
            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
              toast.type === "success" ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="rounded-md p-1 opacity-70 transition hover:bg-slate-100 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>,
        document.body
      )}

      {/* Page heading */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Add Joining
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage selected candidates and prepare for their joining.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Users className="h-5 w-5 text-indigo-600" />
          <div>
            <p className="text-xs text-slate-500">Total candidates</p>
            <p className="text-lg font-bold text-slate-900">
              {candidates.length}
            </p>
          </div>
        </div>
      </div>

      {/* New candidate form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5">
            <UserPlus className="h-5 w-5 text-indigo-600" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              New Joining Candidate
            </h2>
            <p className="text-sm text-slate-500">
              Saving a candidate does not create an employee record. The
              joining date is selected when generating the joining letter.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Personal and job details
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>
                First name *
                <input
                  required
                  maxLength={100}
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  className={inputClass}
                  placeholder="First name"
                />
              </label>

              <label className={labelClass}>
                Last name / Surname *
                <input
                  required
                  maxLength={100}
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  className={inputClass}
                  placeholder="Last name"
                />
              </label>

              <label className={labelClass}>
                Personal email *
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={form.personal_email}
                  onChange={(e) =>
                    updateField("personal_email", e.target.value)
                  }
                  className={inputClass}
                  placeholder="candidate@example.com"
                />
              </label>

              <label className={labelClass}>
                Mobile number *
                <input
                  required
                  type="tel"
                  maxLength={20}
                  value={form.mobile_number}
                  onChange={(e) =>
                    updateField("mobile_number", e.target.value)
                  }
                  className={inputClass}
                  placeholder="Mobile number"
                />
              </label>

              <label className={labelClass}>
                Gender *
                <select
                  required
                  value={form.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </label>

              <label className={labelClass}>
                Designation *
                <input
                  required
                  maxLength={150}
                  value={form.designation}
                  onChange={(e) => updateField("designation", e.target.value)}
                  className={inputClass}
                  placeholder="Job title"
                />
              </label>

              <label className={labelClass}>
                Department *
                <select
                  required
                  value={form.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  className={inputClass}
                  disabled={
                    departmentsLoading ||
                    departments.length === 0 ||
                    saving
                  }
                >
                  <option value="">
                    {departmentsLoading
                      ? "Loading departments..."
                      : departments.length === 0
                        ? "No departments available"
                        : "Select department"}
                  </option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.name}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {!departmentsLoading && departments.length === 0 && (
                  <span className="mt-1 block text-xs font-normal text-red-600">
                    Departments could not be loaded. Refresh the page or
                    contact HR administrator.
                  </span>
                )}
              </label>

              <label className={labelClass}>
                Employment type *
                <select
                  required
                  value={form.employment_type}
                  onChange={(e) =>
                    updateField("employment_type", e.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select employment type</option>
                  <option value="full_time">Full-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </label>

              <label className={labelClass}>
                Work location *
                <select
                  required
                  value={form.work_location}
                  onChange={(e) =>
                    updateField("work_location", e.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select work location</option>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </label>

              <label className={labelClass}>
                Annual CTC (in lakhs) *
                <input
                  required
                  type="number"
                  min="0"
                  max="9999999"
                  step="0.01"
                  value={form.annual_ctc}
                  onChange={(e) => updateField("annual_ctc", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 14"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Enter 14 for ₹14,00,000 per year.
                </span>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Experience details</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>Experience level *
                <select required value={form.experience_level} onChange={(event) => {
                  const level = event.target.value as "fresher" | "experienced";
                  setForm((current) => ({ ...current, experience_level: level,
                    total_experience_years: level === "fresher" ? "0" : current.total_experience_years,
                    total_experience_months: level === "fresher" ? "0" : current.total_experience_months }));
                }} className={inputClass}>
                  <option value="fresher">Fresher</option><option value="experienced">Experienced</option>
                </select>
              </label>
              <div className={labelClass}>Total experience *
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <label><input type="number" min="0" max="50" step="1" required disabled={form.experience_level === "fresher"} value={form.total_experience_years} onChange={(e) => updateField("total_experience_years", e.target.value)} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Years</span></label>
                  <label><input type="number" min="0" max="11" step="1" required disabled={form.experience_level === "fresher"} value={form.total_experience_months} onChange={(e) => updateField("total_experience_months", e.target.value)} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Months</span></label>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Fresher candidates are automatically saved with 0 years and 0 months.</p>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><FileText className="h-5 w-5" /></div>
              <div><h3 className="text-sm font-semibold text-slate-800">Candidate documents</h3><p className="text-xs text-slate-500">Add resume and experience letters</p></div>
            </div>
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-slate-50 p-4 sm:p-5">
              <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="text-sm font-semibold text-slate-700">Document type
                  <select value={uploadDocumentType} onChange={(event) => setUploadDocumentType(event.target.value as "resume" | "experience_document")} className={`${inputClass} mt-1.5 bg-white`}>
                    <option value="resume">Resume</option><option value="experience_document">Experience Letter</option>
                  </select>
                </label>
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  <FileText className="h-4 w-4" />{uploadDocumentType === "resume" ? "Select Resume" : "Select Experience Letter"}
                  <input type="file" multiple={uploadDocumentType === "experience_document"} accept=".pdf,.doc,.docx" className="sr-only" onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    const additions = files.map((file) => ({ file, documentType: uploadDocumentType }));
                    setCandidateDocuments((current) => uploadDocumentType === "resume" ? [...current.filter((item) => item.documentType !== "resume"), ...additions.slice(0, 1)] : [...current, ...additions]);
                    event.target.value = "";
                  }} />
                </label>
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">PDF, DOC or DOCX · Maximum 10 MB per file</p>
              {candidateDocuments.length > 0 && (
                <div className="mx-auto mt-5 max-w-2xl space-y-3">
                  {candidateDocuments.map((document, index) => (
                    <div key={`${document.file.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FileText className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-700">{document.file.name}</p><p className="text-xs text-slate-500">{document.documentType === "resume" ? "Resume" : "Experience Letter"} · {(document.file.size / (1024 * 1024)).toFixed(2)} MB</p></div>
                      <button type="button" onClick={() => setCandidateDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${document.file.name}`}><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={
                saving ||
                departmentsLoading ||
                departments.length === 0
              }
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {saving ? "Saving..." : "Save Candidate"}
            </button>
          </div>
        </form>
      </section>

      {/* Joining pipeline */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">Joining Pipeline</h2>
            <p className="mt-1 text-sm text-slate-500">
              Candidates and their current workflow status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadCandidates()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading candidates...</p>
        ) : candidates.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No joining candidates yet. Add your first candidate above.
          </p>
        ) : (
          <div className="w-full min-w-0 overflow-x-hidden">
            <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[19%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[21%]" />
                  </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-semibold">Candidate</th>
                  <th className="px-3 py-3 font-semibold">Contact</th>
                  <th className="px-3 py-3 font-semibold">Designation</th>
                  <th className="px-3 py-3 font-semibold">Joining date</th>
                  <th className="px-3 py-3 font-semibold">Annual CTC</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-slate-50">
                    <td className="min-w-0 px-3 py-4">
                      <p className="font-semibold text-slate-900">
                        {candidate.first_name} {candidate.last_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Added{" "}
                        {new Date(candidate.created_at).toLocaleDateString(
                          "en-IN"
                        )}
                      </p>

                      {candidate.employee_id && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          Employee ID: {candidate.employee_id}
                        </p>
                      )}
                    </td>

                    <td className="min-w-0 px-3 py-4">
                      <p className="break-all text-sm text-slate-700">
                        {candidate.personal_email}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {candidate.mobile_number}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      {candidate.designation}
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      {candidate.joining_date
                        ? new Date(
                            `${candidate.joining_date}T00:00:00`
                          ).toLocaleDateString("en-IN")
                        : "Not set"}
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      ₹
                      {Number(candidate.annual_ctc).toLocaleString("en-IN")}
                    </td>

                    <td className="min-w-0 px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          candidate.status === "joined"
                            ? "bg-emerald-100 text-emerald-800"
                            : candidate.status === "joining_letter_sent"
                              ? "bg-indigo-100 text-indigo-800"
                              : candidate.status === "offer_declined" ||
                                  candidate.status === "cancelled" ||
                                  candidate.status === "expired"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusLabels[candidate.status] ?? candidate.status}
                      </span>

                      {candidate.conversion_status === "failed" &&
                        candidate.status !== "joined" && (
                          <p className="mt-1 text-xs text-red-600">
                            Employee conversion failed
                          </p>
                        )}

                      {candidate.conversion_status === "processing" && (
                        <p className="mt-1 text-xs text-amber-600">
                          Conversion in progress
                        </p>
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Offer actions are available only before acceptance. */}
                        {offerDocuments[candidate.id] ? (
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewOffer(offerDocuments[candidate.id])
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Offer
                          </button>
                        ) : candidate.status === "selected" ? (
                          <button
                            type="button"
                            onClick={() => void handleGenerateOffer(candidate)}
                            disabled={offerLoadingId === candidate.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {offerLoadingId === candidate.id
                              ? "Generating..."
                              : "Generate Offer"}
                          </button>
                        ) : null}

                        {(candidate.status === "selected" ||
                          candidate.status === "offer_sent") && (
                          <button
                            type="button"
                            onClick={() => handleEditOffer(candidate)}
                            disabled={offerLoadingId === candidate.id || offerEditSaving}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                          >
                            {candidate.status === "offer_sent"
                              ? "Edit & Resend Offer"
                              : "Edit Offer"}
                          </button>
                        )}

                        {/* Joining-letter actions begin only after offer acceptance. */}
                        {candidate.status === "offer_accepted" && (
                          joiningLetterDocuments[candidate.id] ? (
                            <button
                              type="button"
                              onClick={() =>
                                handlePreviewJoiningLetter(
                                  joiningLetterDocuments[candidate.id]
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Joining Letter
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGenerateJoiningLetter(candidate)}
                              disabled={joiningLetterLoadingId === candidate.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                            >
                              <CalendarDays className="h-3.5 w-3.5" />
                              {joiningLetterLoadingId === candidate.id
                                ? "Sending..."
                                : "Generate Joining Letter"}
                            </button>
                          )
                        )}

                        {(candidate.status === "joining_letter_sent" ||
                          candidate.status === "joined") &&
                          joiningLetterDocuments[candidate.id] && (
                            <button
                              type="button"
                              onClick={() =>
                                handlePreviewJoiningLetter(
                                  joiningLetterDocuments[candidate.id]
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Joining Letter
                            </button>
                          )}

                        {candidate.status === "joining_letter_sent" &&
                          candidate.conversion_status !== "completed" && (
                            <button
                              type="button"
                              onClick={() => handleConfirmJoined(candidate)}
                              disabled={
                                confirmJoinedLoadingId === candidate.id ||
                                candidate.conversion_status === "processing"
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {confirmJoinedLoadingId === candidate.id
                                ? "Confirming..."
                                : "Confirm Joined"}
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Offer modal */}
      {isMounted && editingOfferCandidate && createPortal(
        <div
          className="fixed inset-0 z-[9992] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditOfferDialog(); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="edit-offer-title" className="my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 id="edit-offer-title" className="text-lg font-bold text-slate-900">Edit Offer Details</h2>
                <p className="mt-1 text-sm text-slate-500">{editingOfferCandidate.first_name} {editingOfferCandidate.last_name}</p>
              </div>
              <button type="button" onClick={closeEditOfferDialog} disabled={offerEditSaving} aria-label="Close dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-6 p-6">
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Candidate and employment details</h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className={labelClass}>First name *<input value={offerEditForm.first_name} onChange={(e) => setOfferEditForm((v) => ({ ...v, first_name: e.target.value }))} className={inputClass} placeholder="First name" autoComplete="given-name" /></label>
                  <label className={labelClass}>Surname / Last name *<input value={offerEditForm.last_name} onChange={(e) => setOfferEditForm((v) => ({ ...v, last_name: e.target.value }))} className={inputClass} placeholder="Surname" autoComplete="family-name" /></label>
                  <label className={labelClass}>Gender *<select value={offerEditForm.gender} onChange={(e) => setOfferEditForm((v) => ({ ...v, gender: e.target.value }))} className={inputClass}><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
                  <label className={labelClass}>Designation *<input value={offerEditForm.designation} onChange={(e) => setOfferEditForm((v) => ({ ...v, designation: e.target.value }))} className={inputClass} placeholder="Designation" /></label>
                  <label className={labelClass}>Department *<select value={offerEditForm.department} onChange={(e) => setOfferEditForm((v) => ({ ...v, department: e.target.value }))} className={inputClass}><option value="">Select department</option>{departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}</select></label>
                  <label className={labelClass}>Employment type *<select value={offerEditForm.employment_type} onChange={(e) => setOfferEditForm((v) => ({ ...v, employment_type: e.target.value }))} className={inputClass}><option value="">Select employment type</option><option value="full_time">Full-time</option><option value="contract">Contract</option><option value="intern">Intern</option></select></label>
                  <label className={labelClass}>Work location *<select value={offerEditForm.work_location} onChange={(e) => setOfferEditForm((v) => ({ ...v, work_location: e.target.value }))} className={inputClass}><option value="">Select work location</option><option value="On-site">On-site</option><option value="Hybrid">Hybrid</option><option value="Remote">Remote</option></select></label>
                  <label className={labelClass}>Annual CTC (in lakhs) *<input type="number" min="0.01" step="0.01" value={offerEditForm.annual_ctc} onChange={(e) => setOfferEditForm((v) => ({ ...v,annual_ctc: e.target.value,}))}className={inputClass}placeholder="e.g. 14"/> <span className="mt-1 block text-xs font-normal text-slate-500"> Enter 14 for ₹14,00,000 per year. </span> </label>                
              </div>
              </div>
              <div className="border-t border-slate-100 pt-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Candidate documents</h3>
                    <p className="text-xs text-slate-500">
                      View existing documents or upload replacements
                    </p>
                  </div>
                </div>

                {/* Previously uploaded documents */}
                <div className="mb-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Previously uploaded documents
                  </h4>

                  {(["resume", "experience_document"] as const).map((type) => {
                    const document = editingOfferCandidate?.joining_documents
                      ?.filter((item) => item.document_type === type)
                      .sort((a, b) => b.version - a.version)[0];

                    const title = type === "resume" ? "Resume" : "Experience Letter";

                    return (
                      <div
                        key={type}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <FileText className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-700">{title}</p>

                          {document ? (
                            <>
                              <p className="truncate text-xs text-slate-500">
                                {document.file_name || `${title} · Version ${document.version}`}
                              </p>
                              <p className="text-xs text-slate-400">
                                Version {document.version} ·{" "}
                                {new Date(document.created_at).toLocaleDateString("en-IN")}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-slate-400">Not uploaded yet</p>
                          )}
                        </div>

                        {document && (
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `/api/joining/documents/${document.id}`,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                          >
                            View
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Upload or replace documents */}
                <div className="rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-slate-50 p-4 sm:p-5">
                  <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="text-sm font-semibold text-slate-700">
                      Document type
                      <select
                        value={offerEditUploadType}
                        onChange={(event) =>
                          setOfferEditUploadType(
                            event.target.value as "resume" | "experience_document"
                          )
                        }
                        className={`${inputClass} mt-1.5 bg-white`}
                      >
                        <option value="resume">Resume</option>
                        <option value="experience_document">Experience Letter</option>
                      </select>
                    </label>

                    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                      <FileText className="h-4 w-4" />
                      {offerEditUploadType === "resume"
                        ? "Select Resume"
                        : "Select Experience Letter"}

                      <input
                        type="file"
                        multiple={offerEditUploadType === "experience_document"}
                        accept=".pdf,.doc,.docx"
                        className="sr-only"
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          const additions = files.map((file) => ({
                            file,
                            documentType: offerEditUploadType,
                          }));

                          setOfferEditDocuments((current) =>
                            offerEditUploadType === "resume"
                              ? [
                                  ...current.filter((item) => item.documentType !== "resume"),
                                  ...additions.slice(0, 1),
                                ]
                              : [...current, ...additions]
                          );

                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <p className="mt-3 text-center text-xs text-slate-500">
                    PDF, DOC or DOCX · Maximum 10 MB per file
                  </p>

                  {offerEditDocuments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {offerEditDocuments.map((document, index) => (
                        <div
                          key={`${document.file.name}-${index}`}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <FileText className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-700">
                              {document.file.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {document.documentType === "resume"
                                ? "Resume"
                                : "Experience Letter"}{" "}
                              · {(document.file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setOfferEditDocuments((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index)
                              )
                            }
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${document.file.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Experience details</h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className={labelClass}>Experience level *<select value={offerEditForm.experience_level} onChange={(e) => { const level = e.target.value as "fresher" | "experienced"; setOfferEditForm((v) => ({ ...v, experience_level: level, total_experience_years: level === "fresher" ? "0" : v.total_experience_years, total_experience_months: level === "fresher" ? "0" : v.total_experience_months })); }} className={inputClass}><option value="fresher">Fresher</option><option value="experienced">Experienced</option></select></label>
                  <div className={labelClass}>Total experience *<div className="mt-1.5 grid grid-cols-2 gap-3"><label><input type="number" min="0" max="50" disabled={offerEditForm.experience_level === "fresher"} value={offerEditForm.total_experience_years} onChange={(e) => setOfferEditForm((v) => ({ ...v, total_experience_years: e.target.value }))} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Years</span></label><label><input type="number" min="0" max="11" disabled={offerEditForm.experience_level === "fresher"} value={offerEditForm.total_experience_months} onChange={(e) => setOfferEditForm((v) => ({ ...v, total_experience_months: e.target.value }))} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Months</span></label></div></div>
                </div>
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
                  <strong>Experience value:</strong> {offerEditForm.experience_level === "fresher" ? "Fresher (0 Years)" : `${offerEditForm.total_experience_years || 0} Years ${offerEditForm.total_experience_months || 0} Months`}
                </div>
              </div>
              {offerEditError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{offerEditError}</div>}
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button type="button" onClick={closeEditOfferDialog} disabled={offerEditSaving} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void handleSaveOffer()} disabled={offerEditSaving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><FileText className="h-4 w-4" />{offerEditSaving ? "Saving and sending..." : "Save & Resend Offer"}</button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Confirm Joined modal - rendered outside the header */}
      {isMounted &&
        confirmJoinedCandidate &&
        createPortal(
          <div
            className="fixed inset-0 z-[9990] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeConfirmJoinedDialog();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-joined-title"
              className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                <div>
                  <h2
                    id="confirm-joined-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Confirm Employee Joining
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {confirmJoinedCandidate.first_name}{" "}
                    {confirmJoinedCandidate.last_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeConfirmJoinedDialog}
                  disabled={confirmJoinedLoadingId !== null}
                  aria-label="Close dialog"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-sm font-semibold text-indigo-900">
                    Official company email
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">
                    Confirm or edit the official email address for this
                    employee.
                  </p>

                  <label className={`${labelClass} mt-3`}>
                    Official email *
                    <input
                      type="email"
                      value={officialEmail}
                      onChange={(event) =>
                        setOfficialEmail(event.target.value)
                      }
                      className={inputClass}
                      placeholder="firstname.l@teenss.com"
                    />
                  </label>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Statutory details
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Select the statutory benefits applicable to this employee.
                    Enter the relevant number when applicable.
                  </p>
                </div>

                {/* PF */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={pfEligible}
                      onChange={(event) =>
                        setPfEligible(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      PF Eligible
                    </span>
                  </label>

                  {pfEligible && (
                    <label className={`${labelClass} mt-4`}>
                      UAN Number
                      <input
                        type="text"
                        value={uanNumber}
                        onChange={(event) =>
                          setUanNumber(event.target.value)
                        }
                        className={inputClass}
                        placeholder="Enter UAN number"
                      />
                    </label>
                  )}
                </div>

                {/* ESI */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={esiEligible}
                      onChange={(event) =>
                        setEsiEligible(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      ESI / Health Care Eligible
                    </span>
                  </label>

                  {esiEligible && (
                    <label className={`${labelClass} mt-4`}>
                      ESI Number *
                      <input
                        type="text"
                        required
                        value={esiNumber}
                        onChange={(event) =>
                          setEsiNumber(event.target.value)
                        }
                        className={inputClass}
                        placeholder="Enter ESI number"
                      />
                    </label>
                  )}
                </div>

                {/* Professional Tax */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={ptEligible}
                      onChange={(event) =>
                        setPtEligible(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      Professional Tax Eligible
                    </span>
                  </label>

                  {ptEligible && (
                    <label className={`${labelClass} mt-4`}>
                      Professional Tax Number *
                      <input
                        type="text"
                        required
                        value={ptNumber}
                        onChange={(event) =>
                          setPtNumber(event.target.value)
                        }
                        className={inputClass}
                        placeholder="Enter PT number"
                      />
                    </label>
                  )}
                </div>

                {/* TDS */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={tdsEligible}
                      onChange={(event) =>
                        setTdsEligible(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      TDS Eligible
                    </span>
                  </label>
                </div>

                {confirmJoinedError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {confirmJoinedError}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={closeConfirmJoinedDialog}
                    disabled={confirmJoinedLoadingId !== null}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleConfirmJoinedSubmit()}
                    disabled={confirmJoinedLoadingId !== null}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {confirmJoinedLoadingId !== null
                      ? "Confirming..."
                      : "Confirm Employee Joined"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
              {/* Joining Date modal - rendered outside the header */}
      {isMounted &&
        joiningDateCandidate &&
        createPortal(
          <div
            className="fixed inset-0 z-[9991] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeJoiningDateDialog();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="joining-date-title"
              className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2
                    id="joining-date-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Generate Joining Letter
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {joiningDateCandidate.first_name}{" "}
                    {joiningDateCandidate.last_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeJoiningDateDialog}
                  disabled={joiningLetterLoadingId !== null}
                  aria-label="Close dialog"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <label className={labelClass}>
                    Joining date *
                    <input
                      type="date"
                      required
                      min={minimumJoiningDate}
                      value={joiningDate}
                      onChange={(event) => setJoiningDate(event.target.value)}
                      className={inputClass}
                    />
                  </label>

                  <p className="mt-1 text-xs text-slate-500">
                    Select today or a future date.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>
                    Probation period *
                    <select
                      required
                      value={probationPeriodMonths}
                      onChange={(event) =>
                        setProbationPeriodMonths(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="0">No probation</option>
                      <option value="3">3 months</option>
                      <option value="6">6 months</option>
                      <option value="12">12 months</option>
                    </select>
                  </label>
                </div>

                {dialogError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {dialogError}
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={closeJoiningDateDialog}
                    disabled={joiningLetterLoadingId !== null}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSubmitJoiningLetter()}
                    disabled={joiningLetterLoadingId !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                    {joiningLetterLoadingId !== null
                      ? "Generating..."
                      : "Generate & Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}