"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  UserPlus,
  Users,
  FileText,
  Eye,
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
  pf_eligible?: boolean | null;
  esi_eligible?: boolean | null;
  pt_eligible?: boolean | null;
  tds_eligible?: boolean | null;
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
  department: "",
  employment_type: "",
  work_location: "",
  pf_eligible: "",
  esi_eligible: "",
  pt_eligible: "",
  tds_eligible: "",
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

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400";

const labelClass =
  "block text-xs sm:text-sm font-semibold text-slate-700";

export default function JoiningCandidates() {
  const router = useRouter();

  const [form, setForm] = useState(initialForm);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    pf_eligible: "",
    esi_eligible: "",
    pt_eligible: "",
    tds_eligible: "",
  });

  const [offerEditSaving, setOfferEditSaving] = useState(false);
  const [offerEditError, setOfferEditError] = useState("");

  const [confirmMoveCandidate, setConfirmMoveCandidate] =
    useState<Candidate | null>(null);

  const [moveLoading, setMoveLoading] = useState(false);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

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

  const loadCandidates = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const response = await fetch("/api/joining?excludeMoved=1", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load candidates.");
        }

        const loadedCandidates: Candidate[] = result.candidates ?? [];
        const nextOfferDocuments: Record<string, string> = {};

        for (const candidate of loadedCandidates) {
          const documents = candidate.joining_documents ?? [];

          const latestOffer = documents
            .filter(
              (document) => document.document_type === "offer_letter"
            )
            .sort((a, b) => b.version - a.version)[0];

          if (latestOffer) {
            nextOfferDocuments[candidate.id] = latestOffer.id;
          }
        }

        setCandidates(loadedCandidates);
        setOfferDocuments(nextOfferDocuments);
      } catch (err) {
        showToast(
          "error",
          err instanceof Error ? err.message : "Unable to load candidates."
        );
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

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

    if (
      !Number.isInteger(years) ||
      years < 0 ||
      years > 50 ||
      !Number.isInteger(months) ||
      months < 0 ||
      months > 11
    ) {
      showToast("error", "Enter valid experience years and months.");
      return;
    }

    if (
      form.experience_level === "fresher" &&
      (years !== 0 || months !== 0)
    ) {
      showToast(
        "error",
        "Fresher experience must be 0 years and 0 months."
      );
      return;
    }

    if (
      form.experience_level === "experienced" &&
      years === 0 &&
      months === 0
    ) {
      showToast("error", "Enter the candidate's total experience.");
      return;
    }

    if (
      !form.pf_eligible ||
      !form.esi_eligible ||
      !form.pt_eligible ||
      !form.tds_eligible
    ) {
      showToast(
        "error",
        "Select applicability for PF, ESI, Professional Tax, and TDS."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/joining", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          personal_email: form.personal_email,
          mobile_number: form.mobile_number,
          designation: form.designation,
          annual_ctc: Number(form.annual_ctc),
          gender: form.gender,
          department: form.department,
          employment_type: form.employment_type,
          work_location: form.work_location,
          pf_eligible: form.pf_eligible === "true",
          esi_eligible: form.esi_eligible === "true",
          pt_eligible: form.pt_eligible === "true",
          tds_eligible: form.tds_eligible === "true",
          experience_level: form.experience_level,
          total_experience_years:
            form.experience_level === "fresher" ? 0 : years,
          total_experience_months:
            form.experience_level === "fresher" ? 0 : months,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create candidate.");
      }

      setForm(initialForm);
      await loadCandidates();

      showToast("success", "Joining candidate saved successfully.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Unable to create candidate."
      );
    } finally {
      setSaving(false);
    }
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
        `Offer generated and sent for ${candidate.first_name} ${candidate.last_name}.`
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

    setOfferEditForm({
      first_name: candidate.first_name ?? "",
      last_name: candidate.last_name ?? "",
      gender: candidate.gender ?? "",
      designation: candidate.designation ?? "",
      department: candidate.department ?? "",
      employment_type: candidate.employment_type ?? "",
      work_location: candidate.work_location ?? "",
      annual_ctc: String(Number(candidate.annual_ctc ?? 0) / 100000),
      experience_level: candidate.experience_level ?? "fresher",
      total_experience_years: String(
        candidate.total_experience_years ?? 0
      ),
      total_experience_months: String(
        candidate.total_experience_months ?? 0
      ),
      pf_eligible:
        candidate.pf_eligible == null
          ? ""
          : String(candidate.pf_eligible),
      esi_eligible:
        candidate.esi_eligible == null
          ? ""
          : String(candidate.esi_eligible),
      pt_eligible:
        candidate.pt_eligible == null
          ? ""
          : String(candidate.pt_eligible),
      tds_eligible:
        candidate.tds_eligible == null
          ? ""
          : String(candidate.tds_eligible),
    });

    setEditingOfferCandidate(candidate);
  }

  function closeEditOfferDialog() {
    if (offerEditSaving) return;

    setEditingOfferCandidate(null);
    setOfferEditError("");
  }

  async function handleSaveOffer() {
    const candidate = editingOfferCandidate;

    if (!candidate || offerEditSaving) return;

    const years = Number(offerEditForm.total_experience_years);
    const months = Number(offerEditForm.total_experience_months);
    const ctc = Number(offerEditForm.annual_ctc);

    if (
      !offerEditForm.first_name.trim() ||
      !offerEditForm.last_name.trim() ||
      !offerEditForm.gender ||
      !offerEditForm.designation.trim() ||
      !offerEditForm.department ||
      !offerEditForm.employment_type ||
      !offerEditForm.work_location ||
      !offerEditForm.pf_eligible ||
      !offerEditForm.esi_eligible ||
      !offerEditForm.pt_eligible ||
      !offerEditForm.tds_eligible
    ) {
      setOfferEditError(
        "Please complete all employment and statutory applicability details."
      );
      return;
    }

    if (!Number.isFinite(ctc) || ctc <= 0) {
      setOfferEditError("Enter a valid annual CTC.");
      return;
    }

    if (
      !Number.isInteger(years) ||
      years < 0 ||
      years > 50 ||
      !Number.isInteger(months) ||
      months < 0 ||
      months > 11
    ) {
      setOfferEditError("Enter valid experience years and months.");
      return;
    }

    if (
      offerEditForm.experience_level === "fresher" &&
      (years !== 0 || months !== 0)
    ) {
      setOfferEditError(
        "Fresher experience must be 0 years and 0 months."
      );
      return;
    }

    if (
      offerEditForm.experience_level === "experienced" &&
      years === 0 &&
      months === 0
    ) {
      setOfferEditError("Enter the candidate's total experience.");
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
          pf_eligible: offerEditForm.pf_eligible === "true",
          esi_eligible: offerEditForm.esi_eligible === "true",
          pt_eligible: offerEditForm.pt_eligible === "true",
          tds_eligible: offerEditForm.tds_eligible === "true",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to update offer details."
        );
      }

      await loadCandidates();

      const offerResponse = await fetch(
        `/api/joining/${candidate.id}/offer`,
        { method: "POST" }
      );

      const offerResult = await offerResponse.json();

      if (!offerResponse.ok) {
        throw new Error(
          `Offer details were saved, but the revised offer could not be sent: ${
            offerResult.error || "Please retry."
          }`
        );
      }

      if (offerResult.document?.id) {
        setOfferDocuments((current) => ({
          ...current,
          [candidate.id]: offerResult.document.id,
        }));
      }

      setEditingOfferCandidate(null);

      showToast(
        "success",
        "Candidate and offer details updated; revised offer sent successfully."
      );

      await loadCandidates();
    } catch (error) {
      setOfferEditError(
        error instanceof Error
          ? error.message
          : "Unable to update offer."
      );
    } finally {
      setOfferEditSaving(false);
    }
  }

  function handlePreviewOffer(documentId: string) {
    window.open(
      `/api/joining/documents/${documentId}`,
      "_blank",
      "noopener,noreferrer"
    );
  }


  async function confirmMoveToAddEmployee() {
    if (!confirmMoveCandidate || moveLoading) return;

    const candidateId = confirmMoveCandidate.id;

    setMoveLoading(true);

    try {
      const response = await fetch(
        `/api/joining/${encodeURIComponent(candidateId)}/move-to-add-employee`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to move candidate to Add Employee."
        );
      }

      setConfirmMoveCandidate(null);

      showToast(
        "success",
        "Candidate moved to Add Employee successfully."
      );

      router.push("/dashboard/employees/add");
      router.refresh();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error
          ? err.message
          : "Unable to move candidate to Add Employee."
      );
    } finally {
      setMoveLoading(false);
    }
  }


  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 pb-6">
      {isMounted &&
        toast &&
        createPortal(
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
                toast.type === "success"
                  ? "bg-emerald-500"
                  : "bg-red-500"
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Add Joining Candidate
          </h1>

          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Manage joining candidates and their offer letters.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
            <Users className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">
              Total candidates
            </p>
            <p className="text-lg font-bold text-slate-900">
              {candidates.length}
            </p>
          </div>
        </div>
      </div>

      {/* New candidate form */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2.5">
            <UserPlus className="h-5 w-5 text-indigo-600" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              New Joining Candidate
            </h2>

            <p className="text-xs text-slate-500 sm:text-sm">
              Add candidate and employment details. Saving a candidate does
              not create an employee record or employee login.
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
                  onChange={(e) =>
                    updateField("first_name", e.target.value)
                  }
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
                  onChange={(e) =>
                    updateField("last_name", e.target.value)
                  }
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
                  <option value="prefer_not_to_say">
                    Prefer not to say
                  </option>
                </select>
              </label>

              <label className={labelClass}>
                Designation *
                <input
                  required
                  maxLength={150}
                  value={form.designation}
                  onChange={(e) =>
                    updateField("designation", e.target.value)
                  }
                  className={inputClass}
                  placeholder="Job title"
                />
              </label>

              <label className={labelClass}>
                Department *
                <select
                  required
                  value={form.department}
                  onChange={(e) =>
                    updateField("department", e.target.value)
                  }
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
                  onChange={(e) =>
                    updateField("annual_ctc", e.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. 14"
                />

                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Enter 14 for ₹14,00,000 per year.
                </span>
              </label>
            </div>
          </div>

          {/* Statutory applicability */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Statutory applicability *
            </h3>

            <p className="mb-4 text-xs text-slate-500">
              Confirm whether each statutory item applies to this candidate.
              These selections will be shown in the offer letter and can be
              verified again during onboarding and payroll setup.
            </p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["pf_eligible", "PF applicability"],
                  ["esi_eligible", "ESI applicability"],
                  ["pt_eligible", "Professional Tax applicability"],
                  ["tds_eligible", "TDS applicability"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className={labelClass}>
                  {label} *

                  <select
                    required
                    value={form[field]}
                    onChange={(event) =>
                      updateField(field, event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select</option>
                    <option value="true">Applicable</option>
                    <option value="false">Not applicable</option>
                  </select>
                </label>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Applicability is subject to applicable law and final HR/payroll
              verification. TDS is tax withholding.
            </p>
          </div>

          {/* Experience details - retained */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
              Experience details
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>
                Experience level *
                <select
                  required
                  value={form.experience_level}
                  onChange={(event) => {
                    const level = event.target.value as
                      | "fresher"
                      | "experienced";

                    setForm((current) => ({
                      ...current,
                      experience_level: level,
                      total_experience_years:
                        level === "fresher"
                          ? "0"
                          : current.total_experience_years,
                      total_experience_months:
                        level === "fresher"
                          ? "0"
                          : current.total_experience_months,
                    }));
                  }}
                  className={inputClass}
                >
                  <option value="fresher">Fresher</option>
                  <option value="experienced">Experienced</option>
                </select>
              </label>

              <div className={labelClass}>
                <span>Total experience *</span>

                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="1"
                      required
                      disabled={form.experience_level === "fresher"}
                      value={form.total_experience_years}
                      onChange={(e) =>
                        updateField(
                          "total_experience_years",
                          e.target.value
                        )
                      }
                      className={inputClass}
                      placeholder="Years"
                    />

                    <span className="mt-1 block text-xs font-normal text-slate-400">
                      Years
                    </span>
                  </div>

                  <div>
                    <input
                      type="number"
                      min="0"
                      max="11"
                      step="1"
                      required
                      disabled={form.experience_level === "fresher"}
                      value={form.total_experience_months}
                      onChange={(e) =>
                        updateField(
                          "total_experience_months",
                          e.target.value
                        )
                      }
                      className={inputClass}
                      placeholder="Months"
                    />

                    <span className="mt-1 block text-xs font-normal text-slate-400">
                      Months
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Fresher candidates are automatically saved with 0 years and
              0 months.
            </p>
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
            <h2 className="font-semibold text-slate-900">
              Joining Pipeline
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Candidates and their current offer status.
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
          <p className="p-6 text-sm text-slate-500">
            Loading candidates...
          </p>
        ) : candidates.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No joining candidates yet. Add your first candidate above.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1020px] text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="min-w-[180px] whitespace-nowrap px-4 py-3.5">
                    Candidate
                  </th>
                  <th className="min-w-[200px] whitespace-nowrap px-4 py-3.5">
                    Contact
                  </th>
                  <th className="min-w-[150px] whitespace-nowrap px-4 py-3.5">
                    Designation
                  </th>
                  <th className="min-w-[120px] whitespace-nowrap px-4 py-3.5">
                    Department
                  </th>
                  <th className="min-w-[120px] whitespace-nowrap px-4 py-3.5">
                    Annual CTC
                  </th>
                  <th className="min-w-[140px] whitespace-nowrap px-4 py-3.5">
                    Status
                  </th>
                  <th className="min-w-[260px] whitespace-nowrap px-4 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {candidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3.5 align-top">
                      <p className="font-bold text-slate-900">
                        {candidate.first_name} {candidate.last_name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        Added{" "}
                        {new Date(candidate.created_at).toLocaleDateString(
                          "en-IN"
                        )}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 align-top">
                      <p className="break-all text-xs font-medium text-slate-700 sm:text-sm">
                        {candidate.personal_email}
                      </p>

                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {candidate.mobile_number}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 align-top text-xs text-slate-700 sm:text-sm">
                      {candidate.designation}
                    </td>

                    <td className="px-4 py-3.5 align-top text-xs text-slate-600 sm:text-sm">
                      {candidate.department || (
                        <span className="italic text-slate-400">
                          Not set
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 align-top text-xs font-semibold text-slate-800 sm:text-sm">
                      ₹
                      {Number(candidate.annual_ctc).toLocaleString("en-IN")}
                    </td>

                    <td className="px-4 py-3.5 align-top">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          candidate.status === "joined"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                            : candidate.status === "joining_letter_sent"
                              ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200"
                              : candidate.status === "offer_accepted"
                                ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                                : candidate.status === "offer_sent"
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                                  : candidate.status === "offer_declined" ||
                                      candidate.status === "cancelled" ||
                                      candidate.status === "expired"
                                    ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                                    : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusLabels[candidate.status] ?? candidate.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 align-top">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {/* Offer actions */}
                        {offerDocuments[candidate.id] ? (
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewOffer(
                                offerDocuments[candidate.id]
                              )
                            }
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Offer
                          </button>
                        ) : candidate.status === "selected" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleGenerateOffer(candidate)
                            }
                            disabled={offerLoadingId === candidate.id}
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
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
                            disabled={
                              offerLoadingId === candidate.id ||
                              offerEditSaving
                            }
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
                          >
                            {candidate.status === "offer_sent"
                              ? "Edit & Resend Offer"
                              : "Edit Offer"}
                          </button>
                        )}

                        {candidate.status === "offer_accepted" && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmMoveCandidate(candidate)
                            }
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                          >
                            Move to Add Employee
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
      {isMounted &&
        editingOfferCandidate &&
        createPortal(
          <div
            className="fixed inset-0 z-[9992] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeEditOfferDialog();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-offer-title"
              className="my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                <div>
                  <h2
                    id="edit-offer-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Edit Offer Details
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {editingOfferCandidate.first_name}{" "}
                    {editingOfferCandidate.last_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeEditOfferDialog}
                  disabled={offerEditSaving}
                  aria-label="Close dialog"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <div>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Candidate and employment details
                  </h3>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <label className={labelClass}>
                      First name *
                      <input
                        value={offerEditForm.first_name}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            first_name: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="First name"
                        autoComplete="given-name"
                      />
                    </label>

                    <label className={labelClass}>
                      Surname / Last name *
                      <input
                        value={offerEditForm.last_name}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            last_name: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Surname"
                        autoComplete="family-name"
                      />
                    </label>

                    <label className={labelClass}>
                      Gender *
                      <select
                        value={offerEditForm.gender}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            gender: e.target.value,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="prefer_not_to_say">
                          Prefer not to say
                        </option>
                      </select>
                    </label>

                    <label className={labelClass}>
                      Designation *
                      <input
                        value={offerEditForm.designation}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            designation: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Designation"
                      />
                    </label>

                    <label className={labelClass}>
                      Department *
                      <select
                        value={offerEditForm.department}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            department: e.target.value,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="">Select department</option>
                        {departments.map((department) => (
                          <option
                            key={department.id}
                            value={department.name}
                          >
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={labelClass}>
                      Employment type *
                      <select
                        value={offerEditForm.employment_type}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            employment_type: e.target.value,
                          }))
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
                        value={offerEditForm.work_location}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            work_location: e.target.value,
                          }))
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
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={offerEditForm.annual_ctc}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            annual_ctc: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="e.g. 14"
                      />

                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        Enter 14 for ₹14,00,000 per year.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Statutory applicability */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Statutory applicability *
                  </h3>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {(
                      [
                        ["pf_eligible", "PF applicability"],
                        ["esi_eligible", "ESI applicability"],
                        ["pt_eligible", "Professional Tax applicability"],
                        ["tds_eligible", "TDS applicability"],
                      ] as const
                    ).map(([field, label]) => (
                      <label key={field} className={labelClass}>
                        {label} *

                        <select
                          required
                          value={offerEditForm[field]}
                          onChange={(event) =>
                            setOfferEditForm((current) => ({
                              ...current,
                              [field]: event.target.value,
                            }))
                          }
                          className={inputClass}
                        >
                          <option value="">Select</option>
                          <option value="true">Applicable</option>
                          <option value="false">Not applicable</option>
                        </select>
                      </label>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Applicability is subject to applicable law and final
                    HR/payroll verification. TDS is tax withholding.
                  </p>
                </div>

                {/* Experience details - retained */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Experience details
                  </h3>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <label className={labelClass}>
                      Experience level *
                      <select
                        value={offerEditForm.experience_level}
                        onChange={(e) => {
                          const level = e.target.value as
                            | "fresher"
                            | "experienced";

                          setOfferEditForm((v) => ({
                            ...v,
                            experience_level: level,
                            total_experience_years:
                              level === "fresher"
                                ? "0"
                                : v.total_experience_years,
                            total_experience_months:
                              level === "fresher"
                                ? "0"
                                : v.total_experience_months,
                          }));
                        }}
                        className={inputClass}
                      >
                        <option value="fresher">Fresher</option>
                        <option value="experienced">Experienced</option>
                      </select>
                    </label>

                    <div className={labelClass}>
                      Total experience *

                      <div className="mt-1.5 grid grid-cols-2 gap-3">
                        <label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            disabled={
                              offerEditForm.experience_level === "fresher"
                            }
                            value={offerEditForm.total_experience_years}
                            onChange={(e) =>
                              setOfferEditForm((v) => ({
                                ...v,
                                total_experience_years: e.target.value,
                              }))
                            }
                            className={inputClass}
                          />

                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            Years
                          </span>
                        </label>

                        <label>
                          <input
                            type="number"
                            min="0"
                            max="11"
                            disabled={
                              offerEditForm.experience_level === "fresher"
                            }
                            value={offerEditForm.total_experience_months}
                            onChange={(e) =>
                              setOfferEditForm((v) => ({
                                ...v,
                                total_experience_months: e.target.value,
                              }))
                            }
                            className={inputClass}
                          />

                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            Months
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
                    <strong>Experience value:</strong>{" "}
                    {offerEditForm.experience_level === "fresher"
                      ? "Fresher (0 Years)"
                      : `${offerEditForm.total_experience_years || 0} Years ${offerEditForm.total_experience_months || 0} Months`}
                  </div>
                </div>

                {offerEditError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {offerEditError}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={closeEditOfferDialog}
                    disabled={offerEditSaving}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSaveOffer()}
                    disabled={offerEditSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                    {offerEditSaving
                      ? "Saving and sending..."
                      : "Save & Resend Offer"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirm moving accepted candidate to Add Employee */}
      {isMounted &&
        confirmMoveCandidate &&
        createPortal(
          <div
            className="fixed inset-0 z-[9995] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !moveLoading) {
                setConfirmMoveCandidate(null);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-move-title"
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="confirm-move-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Move candidate to Add Employee?
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    You are moving{" "}
                    <strong>
                      {confirmMoveCandidate.first_name}{" "}
                      {confirmMoveCandidate.last_name}
                    </strong>{" "}
                    to the Add Employee page.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmMoveCandidate(null)}
                  disabled={moveLoading}
                  aria-label="Close confirmation"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Important
                </p>

                <p className="mt-1 text-sm text-amber-800">
                  This step only carries the candidate reference to the Add
                  Employee page. It does not create an employee record,
                  allocate an employee ID, create an Auth account, or grant
                  employee portal access.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmMoveCandidate(null)}
                  disabled={moveLoading}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmMoveToAddEmployee}
                  disabled={moveLoading}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {moveLoading ? "Moving Candidate..." : "Confirm & Continue"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}