"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  Search,
  Filter,
  Plus,
  ChevronDown,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Award,
  Send,
  History,
  LayoutList,
  Check,
} from "lucide-react";
import jobTitlesData from "@/data/employee_job_titles.json";

const jobTitlesList: string[] = Array.from(
  new Set(
    (
      (jobTitlesData as { departments?: Array<{ titles?: string[] }> })
        ?.departments || []
    ).flatMap((dept) => dept.titles || [])
  )
).sort((a, b) => a.localeCompare(b));

const jobTitlesDepartments: Array<{ name: string; titles: string[] }> = (
  (jobTitlesData as { departments?: Array<{ name: string; titles?: string[] }> })
    ?.departments || []
).map((dept) => ({
  name: dept.name,
  titles: Array.from(new Set(dept.titles || [])).sort((a, b) =>
    a.localeCompare(b)
  ),
}));

function SearchableDesignationSelect({
  value,
  onChange,
  required = false,
  placeholder = "Select designation / role...",
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const filteredDepartments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return jobTitlesDepartments;
    }
    return jobTitlesDepartments
      .map((dept) => {
        const matchesDept = dept.name.toLowerCase().includes(q);
        const matchedTitles = dept.titles.filter((t) =>
          t.toLowerCase().includes(q)
        );
        if (matchesDept) {
          return dept;
        }
        return {
          ...dept,
          titles: matchedTitles,
        };
      })
      .filter((dept) => dept.titles.length > 0);
  }, [query]);

  const totalMatches = useMemo(() => {
    return filteredDepartments.reduce(
      (sum, dept) => sum + dept.titles.length,
      0
    );
  }, [filteredDepartments]);

  const isSelected = Boolean(value && value.trim());

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        type="text"
        tabIndex={-1}
        value={value}
        required={required}
        readOnly
        className="sr-only"
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-left text-sm transition outline-none ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-100"
            : isSelected
              ? "border-slate-300 text-slate-900 font-medium"
              : "border-slate-200 text-slate-400 hover:border-slate-300"
        }`}
      >
        <span
          className={`truncate mr-2 ${
            isSelected ? "text-slate-900 font-medium" : "text-slate-400"
          }`}
        >
          {isSelected ? value : placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isSelected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition"
              title="Clear designation"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${
              isOpen ? "rotate-180 text-indigo-600" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full min-w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
          <div className="border-b border-slate-100 bg-slate-50/90 p-2">
            <div className="relative flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search role or designation..."
                className="w-full bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 font-normal"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-slate-400 font-medium">
              <span>
                {query
                  ? `Found ${totalMatches} matching roles`
                  : "Type to search or browse by department"}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                287 Roles
              </span>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100/60 py-1">
            {value && !jobTitlesList.includes(value) && (
              <div className="py-1">
                <div className="sticky top-0 z-5 bg-amber-50/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 backdrop-blur-xs">
                  Current Designation
                </div>
                <div className="px-1">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(value);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs bg-indigo-50 font-semibold text-indigo-700"
                  >
                    <span className="truncate">{value}</span>
                    <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                  </button>
                </div>
              </div>
            )}

            {totalMatches === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs font-semibold text-slate-600">
                  No matching roles found
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Try searching with another keyword
                </p>
              </div>
            ) : (
              filteredDepartments.map((dept) => (
                <div key={dept.name} className="py-1">
                  <div className="sticky top-0 z-5 bg-slate-50/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600/90 backdrop-blur-xs">
                    {dept.name}
                  </div>
                  <div className="px-1">
                    {dept.titles.map((title) => {
                      const optSelected = value === title;
                      return (
                        <button
                          key={title}
                          type="button"
                          onClick={() => {
                            onChange(title);
                            setIsOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                            optSelected
                              ? "bg-indigo-50 font-semibold text-indigo-700"
                              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <span className="truncate">{title}</span>
                          {optSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  timeline_history?: {
    offer_sent_at?: string | null;
    offer_accepted_at?: string | null;
    onboarding_submitted_at?: string | null;
    onboarding_verified_at?: string | null;
    joining_letter_sent_at?: string | null;
  };
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

  // These are lifecycle statuses after offer acceptance.
  // They must not become additional offer-status categories.
  joining_letter_sent: "Offer Accepted",
  joined: "Offer Accepted",

  // Preserve these separate terminal lifecycle outcomes.
  cancelled: "Cancelled",
  expired: "Expired",
};

/**
 * Returns true while the candidate is within 10 calendar days
 * after their actual joining date.
 *
 * Example:
 * Joining date: 01 November
 * Last visible date: 11 November
 * Hidden from: 12 November
 *
 * Uses India Standard Time for the current date and date-only
 * arithmetic to avoid UTC/timezone conversion errors.
 */
const shouldShowJoinedCandidate = (
  joiningDate: string | null | undefined
): boolean => {
  if (!joiningDate) return true;

  const datePart = joiningDate.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return true;
  }

  const [year, month, day] = datePart.split("-").map(Number);

  const joinedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(joinedDate.getTime()) ||
    joinedDate.getUTCFullYear() !== year ||
    joinedDate.getUTCMonth() !== month - 1 ||
    joinedDate.getUTCDate() !== day
  ) {
    return true;
  }

  joinedDate.setUTCDate(joinedDate.getUTCDate() + 10);

  const lastVisibleDate = joinedDate.toISOString().slice(0, 10);

  const todayIndia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return todayIndia <= lastVisibleDate;
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
    personal_email: "",
    mobile_number: "",
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

  // Modal state for adding candidate
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedHistoryCandidate, setSelectedHistoryCandidate] =
    useState<Candidate | null>(null);

  // Table View Mode: "standard" vs "history"
  const [tableViewMode, setTableViewMode] = useState<"standard" | "history">("standard");

  // Milestone History Filter
  const [milestoneFilter, setMilestoneFilter] = useState<
    | "all"
    | "offer_sent"
    | "offer_accepted"
    | "onboarding_completed"
    | "onboarding_verified"
    | "joining_letter_sent"
  >("all");

  // Pipeline Filter states
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState("all");
  const [pipelineDept, setPipelineDept] = useState("all");
  const [pipelineExp, setPipelineExp] = useState("all");
  const [pipelineDatePreset, setPipelineDatePreset] = useState<
    "all" | "next_7" | "next_30" | "this_month" | "next_month" | "past" | "custom"
  >("all");
  const [pipelineDateFrom, setPipelineDateFrom] = useState("");
  const [pipelineDateTo, setPipelineDateTo] = useState("");
  const [pipelineSort, setPipelineSort] = useState<
    "newest" | "joining_asc" | "joining_desc" | "name_asc" | "ctc_desc"
  >("newest");

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

  // Overall pipeline metrics
  const pipelineMetrics = useMemo(() => {
    let selected = 0;
    let offerSent = 0;
    let offerAccepted = 0;
    let offerDeclined = 0;

    let offerSentAtCount = 0;
    let offerAcceptedAtCount = 0;
    let onboardingSubmittedCount = 0;
    let onboardingVerifiedCount = 0;
    let joiningLetterSentCount = 0;

    // Exclude joined candidates after their 10-day visibility period.
    // Their original records remain in candidates and are available
    // in Timeline History View.
    const activeCandidates = candidates.filter(
      (candidate) =>
        candidate.status !== "joined" ||
        shouldShowJoinedCandidate(candidate.joining_date)
    );

    activeCandidates.forEach((candidate) => {
      if (candidate.status === "selected") {
        selected++;
      } else if (candidate.status === "offer_sent") {
        offerSent++;
      } else if (
        [
          "offer_accepted",
          "joining_letter_sent",
          "joined",
        ].includes(candidate.status)
      ) {
        offerAccepted++;
      } else if (candidate.status === "offer_declined") {
        offerDeclined++;
      }

      if (candidate.timeline_history?.offer_sent_at) {
        offerSentAtCount++;
      }

      if (candidate.timeline_history?.offer_accepted_at) {
        offerAcceptedAtCount++;
      }

      if (candidate.timeline_history?.onboarding_submitted_at) {
        onboardingSubmittedCount++;
      }

      if (candidate.timeline_history?.onboarding_verified_at) {
        onboardingVerifiedCount++;
      }

      if (candidate.timeline_history?.joining_letter_sent_at) {
        joiningLetterSentCount++;
      }
    });

    return {
      total: activeCandidates.length,
      selected,
      offerSent,
      offerAccepted,
      offerDeclined,
      offerSentAtCount,
      offerAcceptedAtCount,
      onboardingSubmittedCount,
      onboardingVerifiedCount,
      joiningLetterSentCount,
    };
  }, [candidates]);

  // Pipeline Filtered Candidates
  // Pipeline Filtered Candidates
  const filteredPipelineCandidates = useMemo(() => {
    const term = pipelineSearch.trim().toLowerCase();

    const now = new Date();

    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const currentYear = Number(todayStr.slice(0, 4));
    const currentMonth = Number(todayStr.slice(5, 7)) - 1;

    const getIndiaDateString = (date: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);

    const d7 = new Date(now);
    d7.setDate(d7.getDate() + 7);
    const in7DaysStr = getIndiaDateString(d7);

    const d30 = new Date(now);
    d30.setDate(d30.getDate() + 30);
    const in30DaysStr = getIndiaDateString(d30);

    const thisMonthStart =
      `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;

    const thisMonthEnd = getIndiaDateString(
      new Date(currentYear, currentMonth + 1, 0)
    );

    const nextMonthYear =
      currentMonth === 11 ? currentYear + 1 : currentYear;

    const nextMonthNum =
      currentMonth === 11 ? 1 : currentMonth + 2;

    const nextMonthStart =
      `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-01`;

    const nextMonthEnd = getIndiaDateString(
      new Date(nextMonthYear, nextMonthNum, 0)
    );

    return candidates
      .filter((c) => {
        // Joined candidates older than 10 days:
        // Hide only in Pipeline View.
        // Keep all records accessible in Timeline History View.
        if (
          tableViewMode === "standard" &&
          c.status === "joined" &&
          !shouldShowJoinedCandidate(c.joining_date)
        ) {
          return false;
        }

        // Search
        if (term) {
          const fullName =
            `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();

          const email = (c.personal_email || "").toLowerCase();
          const phone = (c.mobile_number || "").toLowerCase();
          const desig = (c.designation || "").toLowerCase();
          const dept = (c.department || "").toLowerCase();

          const matches =
            fullName.includes(term) ||
            email.includes(term) ||
            phone.includes(term) ||
            desig.includes(term) ||
            dept.includes(term);

          if (!matches) return false;
        }

        // Offer Status
        if (pipelineStatus !== "all") {
          if (pipelineStatus === "offer_accepted") {
            if (
              ![
                "offer_accepted",
                "joining_letter_sent",
                "joined",
              ].includes(c.status)
            ) {
              return false;
            }
          } else if (c.status !== pipelineStatus) {
            return false;
          }
        }

        // Department
        if (pipelineDept !== "all" && c.department !== pipelineDept) {
          return false;
        }

        // Experience Level
        if (pipelineExp !== "all" && c.experience_level !== pipelineExp) {
          return false;
        }

        // Milestone History Filter
        if (milestoneFilter !== "all") {
          if (
            milestoneFilter === "offer_sent" &&
            !c.timeline_history?.offer_sent_at
          ) {
            return false;
          }

          if (
            milestoneFilter === "offer_accepted" &&
            !c.timeline_history?.offer_accepted_at
          ) {
            return false;
          }

          if (
            milestoneFilter === "onboarding_completed" &&
            !c.timeline_history?.onboarding_submitted_at
          ) {
            return false;
          }

          if (
            milestoneFilter === "onboarding_verified" &&
            !c.timeline_history?.onboarding_verified_at
          ) {
            return false;
          }

          if (
            milestoneFilter === "joining_letter_sent" &&
            !c.timeline_history?.joining_letter_sent_at
          ) {
            return false;
          }
        }

        // Joining Date
        const joiningDate = (c.joining_date || "").slice(0, 10);

        if (pipelineDatePreset === "next_7") {
          if (
            !joiningDate ||
            joiningDate < todayStr ||
            joiningDate > in7DaysStr
          ) {
            return false;
          }
        } else if (pipelineDatePreset === "next_30") {
          if (
            !joiningDate ||
            joiningDate < todayStr ||
            joiningDate > in30DaysStr
          ) {
            return false;
          }
        } else if (pipelineDatePreset === "this_month") {
          if (
            !joiningDate ||
            joiningDate < thisMonthStart ||
            joiningDate > thisMonthEnd
          ) {
            return false;
          }
        } else if (pipelineDatePreset === "next_month") {
          if (
            !joiningDate ||
            joiningDate < nextMonthStart ||
            joiningDate > nextMonthEnd
          ) {
            return false;
          }
        } else if (pipelineDatePreset === "past") {
          if (!joiningDate || joiningDate >= todayStr) {
            return false;
          }
        } else if (pipelineDatePreset === "custom") {
          if (pipelineDateFrom && joiningDate < pipelineDateFrom) {
            return false;
          }

          if (pipelineDateTo && joiningDate > pipelineDateTo) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (pipelineSort === "newest") {
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        }

        if (pipelineSort === "joining_asc") {
          const dateA = a.joining_date || "9999-99-99";
          const dateB = b.joining_date || "9999-99-99";

          return dateA.localeCompare(dateB);
        }

        if (pipelineSort === "joining_desc") {
          const dateA = a.joining_date || "0000-00-00";
          const dateB = b.joining_date || "0000-00-00";

          return dateB.localeCompare(dateA);
        }

        if (pipelineSort === "name_asc") {
          const nameA =
            `${a.first_name || ""} ${a.last_name || ""}`
              .trim()
              .toLowerCase();

          const nameB =
            `${b.first_name || ""} ${b.last_name || ""}`
              .trim()
              .toLowerCase();

          return nameA.localeCompare(nameB);
        }

        if (pipelineSort === "ctc_desc") {
          const ctcA = Number(a.annual_ctc || 0);
          const ctcB = Number(b.annual_ctc || 0);

          return ctcB - ctcA;
        }

        return 0;
      });
  }, [
    candidates,
    pipelineSearch,
    pipelineStatus,
    pipelineDept,
    pipelineExp,
    pipelineDatePreset,
    pipelineDateFrom,
    pipelineDateTo,
    pipelineSort,
    milestoneFilter,
    tableViewMode,
  ]);

  const activePipelineFiltersCount = [
    pipelineSearch.trim() !== "",
    pipelineStatus !== "all",
    pipelineDept !== "all",
    pipelineExp !== "all",
    milestoneFilter !== "all",
    pipelineDatePreset !== "all" || Boolean(pipelineDateFrom) || Boolean(pipelineDateTo),
  ].filter(Boolean).length;

  const resetPipelineFilters = () => {
    setPipelineSearch("");
    setPipelineStatus("all");
    setPipelineDept("all");
    setPipelineExp("all");
    setMilestoneFilter("all");
    setPipelineDatePreset("all");
    setPipelineDateFrom("");
    setPipelineDateTo("");
    setPipelineSort("newest");
  };

  function formatCandidateCurrency(amount?: number | string | null) {
    if (!amount) return "—";
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  }

  function formatTimelineDate(dateStr?: string | null) {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  }

  function getInitials(firstName?: string | null, lastName?: string | null) {
    const f = (firstName || "").trim()[0] || "";
    const l = (lastName || "").trim()[0] || "";
    return (f + l).toUpperCase() || "EC";
  }

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
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.personal_email.trim() ||
      !form.mobile_number.trim() ||
      !form.gender ||
      !form.designation.trim() ||
      !form.department ||
      !form.employment_type ||
      !form.work_location
    ) {
      showToast(
        "error",
        "Complete all required personal and job fields, including designation."
      );
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
      setIsCreateModalOpen(false);

      showToast("success", "Candidate offer setup saved successfully.");
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
      personal_email: candidate.personal_email ?? "",
      mobile_number: candidate.mobile_number ?? "",
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
      !offerEditForm.personal_email.trim() ||
      !offerEditForm.mobile_number.trim() ||
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
        "Please complete all candidate, employment, and statutory details."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        offerEditForm.personal_email.trim()
      )
    ) {
      setOfferEditError("Enter a valid personal email address.");
      return;
    }

    if (
      offerEditForm.mobile_number.trim().length < 7 ||
      offerEditForm.mobile_number.trim().length > 20
    ) {
      setOfferEditError("Enter a valid mobile number (7 to 20 digits).");
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
          personal_email: offerEditForm.personal_email.trim(),
          mobile_number: offerEditForm.mobile_number.trim(),
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
            Offers & Pre-Onboarding
          </h1>

          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Manage selected candidates, generate offer letters, and track candidate pre-onboarding.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 shadow-indigo-100 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Candidate</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards (Clickable Filters) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total Candidates */}
        <button
          type="button"
          onClick={() => setPipelineStatus("all")}
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            pipelineStatus === "all"
              ? "border-indigo-400 bg-gradient-to-br from-indigo-100/90 via-white to-indigo-50/60 ring-2 ring-indigo-500 shadow-md"
              : "border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Total Pipeline
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {pipelineMetrics.total}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-indigo-600/80 font-medium truncate">
              Candidates in pre-onboarding
            </span>
            {pipelineStatus === "all" && (
              <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>

        {/* Offers Sent */}
        <button
          type="button"
          onClick={() =>
            setPipelineStatus(
              pipelineStatus === "offer_sent" ? "all" : "offer_sent"
            )
          }
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            pipelineStatus === "offer_sent"
              ? "border-blue-400 bg-gradient-to-br from-blue-100/90 via-white to-blue-50/60 ring-2 ring-blue-500 shadow-md"
              : "border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Offers Sent
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {pipelineMetrics.offerSent}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-blue-600/80 font-medium truncate">
              Awaiting candidate decision
            </span>
            {pipelineStatus === "offer_sent" && (
              <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>

        {/* Offers Accepted */}
        <button
          type="button"
          onClick={() =>
            setPipelineStatus(
              pipelineStatus === "offer_accepted" ? "all" : "offer_accepted"
            )
          }
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            pipelineStatus === "offer_accepted"
              ? "border-emerald-400 bg-gradient-to-br from-emerald-100/90 via-white to-emerald-50/60 ring-2 ring-emerald-500 shadow-md"
              : "border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Offers Accepted
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {pipelineMetrics.offerAccepted}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-emerald-600/80 font-medium truncate">
              Ready to move to Add Employee
            </span>
            {pipelineStatus === "offer_accepted" && (
              <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>

        {/* Offer Selected / Draft */}
        <button
          type="button"
          onClick={() =>
            setPipelineStatus(
              pipelineStatus === "selected" ? "all" : "selected"
            )
          }
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            pipelineStatus === "selected"
              ? "border-amber-400 bg-gradient-to-br from-amber-100/90 via-white to-amber-50/60 ring-2 ring-amber-500 shadow-md"
              : "border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Selected
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {pipelineMetrics.selected}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-amber-600/80 font-medium truncate">
              Draft / offer not yet generated
            </span>
            {pipelineStatus === "selected" && (
              <span className="shrink-0 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>

        {/* Offers Declined */}
        <button
          type="button"
          onClick={() =>
            setPipelineStatus(
              pipelineStatus === "offer_declined" ? "all" : "offer_declined"
            )
          }
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            pipelineStatus === "offer_declined"
              ? "border-red-400 bg-gradient-to-br from-red-100/90 via-white to-red-50/60 ring-2 ring-red-500 shadow-md"
              : "border-red-100 bg-gradient-to-br from-red-50/70 via-white to-red-50/30 hover:border-red-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Offers Declined
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs">
              <X className="h-4 w-4" />
            </div>
          </div>

          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {pipelineMetrics.offerDeclined}
          </p>

          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-red-600/80 font-medium truncate">
              Candidates who declined the offer
            </span>

            {pipelineStatus === "offer_declined" && (
              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>
      </div>

      {/* New Candidate & Offer Setup Modal */}
      {isMounted &&
        isCreateModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9990] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving) {
                setIsCreateModalOpen(false);
              }
            }}
          >
            <div className="relative my-auto max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
              {/* Modal Header */}
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2.5">
                    <UserPlus className="h-5 w-5 text-indigo-600" />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                      New Candidate & Offer Setup
                    </h2>

                    <p className="text-xs text-slate-500">
                      Add candidate and employment details. Saving a candidate does
                      not create an employee record or employee login.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={saving}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition disabled:opacity-50"
                  aria-label="Close candidate modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6">
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
                <SearchableDesignationSelect
                  value={form.designation}
                  onChange={(val) => updateField("designation", val)}
                  required
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

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                departmentsLoading ||
                departments.length === 0
              }
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {saving ? "Saving..." : "Save Candidate & Setup Offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>,
  document.body
)}

      {/* Candidate Offers Pipeline Section */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm space-y-4 p-5 sm:p-6">
        {/* Section Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Candidate Offer Pipeline
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Track candidate offer statuses, preview documents, and audit timeline history across candidates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle: Standard Pipeline vs Timeline History */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTableViewMode("standard")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  tableViewMode === "standard"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Pipeline View
              </button>
              <button
                type="button"
                onClick={() => setTableViewMode("history")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  tableViewMode === "history"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Timeline History View
              </button>
            </div>

            <button
              type="button"
              onClick={() => void loadCandidates()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 self-start sm:self-auto"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Pipeline
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 sm:p-4">
          {/* Top row: Search input + Status Tabs */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={pipelineSearch}
                onChange={(e) => setPipelineSearch(e.target.value)}
                placeholder="Search candidate name, email, phone, role..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              {pipelineSearch && (
                <button
                  type="button"
                  onClick={() => setPipelineSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {[
                { id: "all", label: "Entire Pipeline", count: pipelineMetrics.total },
                { id: "selected", label: "Selected", count: pipelineMetrics.selected },
                { id: "offer_sent", label: "Offer Sent", count: pipelineMetrics.offerSent },
                { id: "offer_accepted", label: "Offer Accepted", count: pipelineMetrics.offerAccepted },
                { id: "offer_declined", label: "Offer Declined", count: pipelineMetrics.offerDeclined },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPipelineStatus(tab.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    pipelineStatus === tab.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Second row: Dropdowns */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-1 border-t border-slate-200/60">
            {/* Department Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                value={pipelineDept}
                onChange={(e) => setPipelineDept(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Experience Level Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Experience Level
              </label>
              <select
                value={pipelineExp}
                onChange={(e) => setPipelineExp(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="all">All Levels</option>
                <option value="fresher">Fresher</option>
                <option value="experienced">Experienced</option>
              </select>
            </div>

            {/* Joining Date Period */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Joining Date Period
              </label>
              <select
                value={pipelineDatePreset}
                onChange={(e) => {
                  const val = e.target.value as typeof pipelineDatePreset;
                  setPipelineDatePreset(val);
                  if (val !== "custom") {
                    setPipelineDateFrom("");
                    setPipelineDateTo("");
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="all">Any Time</option>
                <option value="next_7">Upcoming 7 Days (Future)</option>
                <option value="next_30">Upcoming 30 Days (Future)</option>
                <option value="this_month">This Month</option>
                <option value="next_month">Upcoming Month (Future)</option>
                <option value="past">Past Dates (History)</option>
                <option value="custom">Custom Range...</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Sort By
              </label>
              <select
                value={pipelineSort}
                onChange={(e) => setPipelineSort(e.target.value as typeof pipelineSort)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="newest">Recently Added</option>
                <option value="joining_asc">Joining Date (Earliest)</option>
                <option value="joining_desc">Joining Date (Latest)</option>
                <option value="name_asc">Name (A – Z)</option>
                <option value="ctc_desc">Annual CTC (Highest)</option>
              </select>
            </div>
          </div>

          {/* Custom Date Inputs if selected */}
          {pipelineDatePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">From:</span>
                <input
                  type="date"
                  value={pipelineDateFrom}
                  onChange={(e) => setPipelineDateFrom(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">To:</span>
                <input
                  type="date"
                  value={pipelineDateTo}
                  onChange={(e) => setPipelineDateTo(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Milestone Filter Row */}
          <div className="pt-2 border-t border-slate-200/60">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                Milestone Filter:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  { id: "all", label: "All Lifecycle Stages", count: candidates.length },
                  { id: "offer_sent", label: "Offer Sent", count: pipelineMetrics.offerSentAtCount },
                  { id: "offer_accepted", label: "Offer Accepted", count: pipelineMetrics.offerAcceptedAtCount },
                  { id: "onboarding_completed", label: "Onboarding Completed", count: pipelineMetrics.onboardingSubmittedCount },
                  { id: "onboarding_verified", label: "Onboarding Verified", count: pipelineMetrics.onboardingVerifiedCount },
                  { id: "joining_letter_sent", label: "Joining Letter Sent", count: pipelineMetrics.joiningLetterSentCount },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMilestoneFilter(item.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs transition ${
                      milestoneFilter === item.id
                        ? "bg-slate-900 text-white shadow-xs font-semibold"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active filter count and reset button */}
          {activePipelineFiltersCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <Filter className="h-3.5 w-3.5 text-indigo-600" />
                <span>
                  Showing <strong>{filteredPipelineCandidates.length}</strong> of{" "}
                  <strong>{candidates.length}</strong> candidates
                </span>
              </div>

              <button
                type="button"
                onClick={resetPipelineFilters}
                className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-700 hover:underline"
              >
                <X className="h-3.5 w-3.5" />
                Reset Pipeline Filters
              </button>
            </div>
          )}
        </div>

        {/* Pipeline Table */}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 space-y-2">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
            <p>Loading candidate offer pipeline...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center space-y-3">
            <UserPlus className="mx-auto h-8 w-8 text-slate-300" />
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              No candidates in pipeline yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click the &quot;Add New Candidate&quot; button above to create candidate details and generate an offer letter.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add First Candidate
            </button>
          </div>
        ) : filteredPipelineCandidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2.5">
            <Search className="mx-auto h-7 w-7 text-slate-300" />
            <h3 className="font-bold text-slate-800 text-sm">
              No candidates match your filters
            </h3>
            <p className="text-xs text-slate-500">
              Try adjusting your search keywords, status, or date filters.
            </p>
            <button
              type="button"
              onClick={resetPipelineFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline pt-1"
            >
              Clear Filters
            </button>
          </div>
        ) : tableViewMode === "history" ? (
          /* Multi-candidate Timeline History Table */
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full min-w-[1100px] text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="min-w-[190px] whitespace-nowrap px-4 py-3.5">
                    Candidate
                  </th>
                  <th className="min-w-[140px] whitespace-nowrap px-4 py-3.5">
                    Profile Created
                  </th>
                  <th className="min-w-[150px] whitespace-nowrap px-4 py-3.5">
                    Offer Sent
                  </th>
                  <th className="min-w-[150px] whitespace-nowrap px-4 py-3.5">
                    Offer Accepted
                  </th>
                  <th className="min-w-[160px] whitespace-nowrap px-4 py-3.5">
                    Onboarding Completed
                  </th>
                  <th className="min-w-[160px] whitespace-nowrap px-4 py-3.5">
                    Onboarding Verified
                  </th>
                  <th className="min-w-[160px] whitespace-nowrap px-4 py-3.5">
                    Joining Letter Sent
                  </th>
                  <th className="min-w-[110px] whitespace-nowrap px-4 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredPipelineCandidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    {/* Candidate */}
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xs shadow-xs">
                          {getInitials(candidate.first_name, candidate.last_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {candidate.first_name} {candidate.last_name}
                          </p>
                          <p className="text-[11px] text-indigo-600 font-medium truncate">
                            {candidate.designation} · {candidate.department || "General"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Profile Created */}
                    <td className="px-4 py-3.5 align-middle">
                      <div className="text-xs text-slate-700">
                        {formatTimelineDate(candidate.created_at) || "—"}
                      </div>
                    </td>

                    {/* Offer Sent */}
                    <td className="px-4 py-3.5 align-middle">
                      {candidate.timeline_history?.offer_sent_at ? (
                        <div className="flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-xs font-medium">
                            {formatTimelineDate(candidate.timeline_history.offer_sent_at)}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          <Clock className="h-3 w-3" /> Not Sent
                        </span>
                      )}
                    </td>

                    {/* Offer Accepted */}
                    <td className="px-4 py-3.5 align-middle">
                      {candidate.timeline_history?.offer_accepted_at ? (
                        <div className="flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-xs font-medium">
                            {formatTimelineDate(candidate.timeline_history.offer_accepted_at)}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          <Clock className="h-3 w-3" /> Awaiting
                        </span>
                      )}
                    </td>

                    {/* Onboarding Completed */}
                    <td className="px-4 py-3.5 align-middle">
                      {candidate.timeline_history?.onboarding_submitted_at ? (
                        <div className="flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-xs font-medium">
                            {formatTimelineDate(candidate.timeline_history.onboarding_submitted_at)}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>

                    {/* Onboarding Verified */}
                    <td className="px-4 py-3.5 align-middle">
                      {candidate.timeline_history?.onboarding_verified_at ? (
                        <div className="flex items-center gap-1.5 text-emerald-700">
                          <Award className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-xs font-medium">
                            {formatTimelineDate(candidate.timeline_history.onboarding_verified_at)}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          <Clock className="h-3 w-3" /> Unverified
                        </span>
                      )}
                    </td>

                    {/* Joining Letter Sent */}
                    <td className="px-4 py-3.5 align-middle">
                      {candidate.timeline_history?.joining_letter_sent_at ? (
                        <div className="flex items-center gap-1.5 text-emerald-700">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-xs font-medium">
                            {formatTimelineDate(candidate.timeline_history.joining_letter_sent_at)}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          <Clock className="h-3 w-3" /> Not Sent
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 align-middle text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryCandidate(candidate)}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-indigo-600 transition"
                        title="View Detailed History"
                      >
                        <History className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Timeline</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full min-w-[1020px] text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="min-w-[190px] whitespace-nowrap px-4 py-3.5">
                    Candidate
                  </th>
                  <th className="min-w-[200px] whitespace-nowrap px-4 py-3.5">
                    Contact Details
                  </th>
                  <th className="min-w-[160px] whitespace-nowrap px-4 py-3.5">
                    Role & Dept
                  </th>
                  <th className="min-w-[130px] whitespace-nowrap px-4 py-3.5">
                    Annual CTC
                  </th>
                  <th className="min-w-[140px] whitespace-nowrap px-4 py-3.5">
                    Offer Status
                  </th>
                  <th className="min-w-[260px] whitespace-nowrap px-4 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredPipelineCandidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    {/* Candidate */}
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xs shadow-xs">
                          {getInitials(candidate.first_name, candidate.last_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {candidate.first_name} {candidate.last_name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            Added {new Date(candidate.created_at).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3.5 align-middle">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{candidate.personal_email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{candidate.mobile_number}</span>
                        </div>
                      </div>
                    </td>

                    {/* Designation & Dept */}
                    <td className="px-4 py-3.5 align-middle">
                      <p className="font-semibold text-slate-800 text-xs">
                        {candidate.designation}
                      </p>
                      <p className="text-[11px] text-indigo-600 font-medium">
                        {candidate.department || "Unassigned"}
                      </p>
                    </td>

                    {/* Annual CTC */}
                    <td className="px-4 py-3.5 align-middle">
                      <p className="font-bold text-slate-900 text-xs">
                        {formatCandidateCurrency(candidate.annual_ctc)}
                      </p>
                      <span className="inline-block text-[10px] text-slate-400 capitalize">
                        {candidate.experience_level === "fresher"
                          ? "Fresher"
                          : `${candidate.total_experience_years || 0}y ${candidate.total_experience_months || 0}m exp`}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 align-middle">
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

                    {/* Actions */}
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryCandidate(candidate)}
                          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-indigo-600 transition"
                          title="View Candidate Lifecycle History"
                        >
                          <History className="h-3.5 w-3.5 text-slate-500" />
                          <span>History</span>
                        </button>

                        {/* Offer actions */}
                        {offerDocuments[candidate.id] ? (
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewOffer(
                                offerDocuments[candidate.id]
                              )
                            }
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50"
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
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
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
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-xs transition hover:bg-indigo-50 disabled:opacity-50"
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
                            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
                          >
                            <span>Move to Add Employee</span>
                            <ArrowRight className="h-3.5 w-3.5" />
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
                      Personal email *
                      <input
                        type="email"
                        value={offerEditForm.personal_email}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            personal_email: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="candidate@example.com"
                        autoComplete="email"
                      />
                    </label>

                    <label className={labelClass}>
                      Mobile number *
                      <input
                        type="tel"
                        value={offerEditForm.mobile_number}
                        onChange={(e) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            mobile_number: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="+91 98765 43210"
                        autoComplete="tel"
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
                      <SearchableDesignationSelect
                        value={offerEditForm.designation}
                        onChange={(val) =>
                          setOfferEditForm((v) => ({
                            ...v,
                            designation: val,
                          }))
                        }
                        required
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

      {/* Candidate Lifecycle History Modal */}
      {isMounted &&
        selectedHistoryCandidate &&
        createPortal(
          <div
            className="fixed inset-0 z-[9995] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedHistoryCandidate(null);
              }
            }}
          >
            <div
              className="relative my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Candidate Lifecycle History
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedHistoryCandidate.first_name} {selectedHistoryCandidate.last_name} • {selectedHistoryCandidate.designation || "Candidate"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHistoryCandidate(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Timeline Milestones */}
              <div className="p-6 space-y-6">
                {[
                  {
                    id: "candidate_created",
                    label: "Candidate Profile Created",
                    description: "Candidate details and offer parameters registered in pipeline",
                    timestamp: selectedHistoryCandidate.created_at,
                    icon: UserPlus,
                    isDone: Boolean(selectedHistoryCandidate.created_at),
                  },
                  {
                    id: "offer_sent",
                    label: "Offer Letter Sent",
                    description: "Offer generated and dispatched to candidate's email",
                    timestamp: selectedHistoryCandidate.timeline_history?.offer_sent_at,
                    icon: Send,
                    isDone: Boolean(selectedHistoryCandidate.timeline_history?.offer_sent_at),
                  },
                  {
                    id: "offer_accepted",
                    label: "Offer Accepted",
                    description: "Candidate reviewed and officially accepted the offer",
                    timestamp: selectedHistoryCandidate.timeline_history?.offer_accepted_at,
                    icon: CheckCircle2,
                    isDone: Boolean(selectedHistoryCandidate.timeline_history?.offer_accepted_at),
                  },
                  {
                    id: "onboarding_completed",
                    label: "Onboarding Completed",
                    description: "Candidate submitted required profile, address, bank, and documents",
                    timestamp: selectedHistoryCandidate.timeline_history?.onboarding_submitted_at,
                    icon: FileText,
                    isDone: Boolean(selectedHistoryCandidate.timeline_history?.onboarding_submitted_at),
                  },
                  {
                    id: "onboarding_verified",
                    label: "Onboarding Verified",
                    description: "HR verified candidate identity, previous employment, and documents",
                    timestamp: selectedHistoryCandidate.timeline_history?.onboarding_verified_at,
                    icon: Award,
                    isDone: Boolean(selectedHistoryCandidate.timeline_history?.onboarding_verified_at),
                  },
                  {
                    id: "joining_letter_sent",
                    label: "Joining Letter Sent",
                    description: "Official joining & appointment letter dispatched to candidate",
                    timestamp: selectedHistoryCandidate.timeline_history?.joining_letter_sent_at,
                    icon: Sparkles,
                    isDone: Boolean(selectedHistoryCandidate.timeline_history?.joining_letter_sent_at),
                  },
                ].map((step, idx, arr) => (
                  <div key={step.id} className="relative flex items-start gap-4">
                    {idx < arr.length - 1 && (
                      <div
                        className={`absolute left-5 top-10 h-full w-0.5 -ml-px ${
                          step.isDone ? "bg-emerald-400" : "bg-slate-200"
                        }`}
                      />
                    )}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                        step.isDone
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600 shadow-xs"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm font-bold ${
                            step.isDone ? "text-slate-900" : "text-slate-500"
                          }`}
                        >
                          {step.label}
                        </p>
                        <span
                          className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            step.isDone
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {step.isDone ? "Completed" : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                      {step.timestamp ? (
                        <p className="mt-1 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(step.timestamp).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400 italic">Not yet recorded</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedHistoryCandidate(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                >
                  Close History
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}