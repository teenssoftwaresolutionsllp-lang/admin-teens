"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  RefreshCw,
  UserRound,
  Mail,
  Phone,
  BriefcaseBusiness,
  History,
  X,
  CheckCircle2,
  Clock,
  FileText,
  Award,
  Sparkles,
  Send,
  UserPlus,
  LayoutList,
  LayoutGrid,
  Filter,
  RotateCcw,
  Search,
  Building2,
  MapPin,
  IndianRupee,
  GraduationCap,
  ArrowUpDown,
} from "lucide-react";

type JoiningCandidate = {
  id: string;
  first_name: string;
  last_name: string;
  personal_email: string;
  mobile_number: string;
  gender?: string | null;
  designation: string;
  department?: string | null;
  employment_type?: string | null;
  work_location?: string | null;
  joining_date: string;
  annual_ctc: number | string;
  experience_level?: "fresher" | "experienced" | string | null;
  total_experience_years?: number | string | null;
  total_experience_months?: number | string | null;
  status: string;
  created_at: string;
  timeline_history?: {
    offer_sent_at?: string | null;
    offer_accepted_at?: string | null;
    onboarding_submitted_at?: string | null;
    onboarding_verified_at?: string | null;
    joining_letter_sent_at?: string | null;
  };
};

const statusLabels: Record<string, string> = {
  selected: "Offer Pending",
  offer_sent: "Offer Sent",
  offer_accepted: "Offer Accepted",
  offer_declined: "Offer Declined",
  joining_letter_sent: "Joining Letter Sent",
  joined: "Joined",
  cancelled: "Cancelled",
  expired: "Expired",
};

export default function JoiningEmployeesView() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<JoiningCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters State
  const [search, setSearch] = useState("");
  const [milestoneFilter, setMilestoneFilter] = useState<
    | "all"
    | "offer_pending"
    | "offer_sent"
    | "offer_accepted"
    | "onboarding_completed"
    | "onboarding_verified"
    | "joining_letter_sent"
    | "joined"
  >("all");

  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [ctcRangeFilter, setCtcRangeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    | "newest"
    | "joining_asc"
    | "joining_desc"
    | "name_asc"
    | "ctc_desc"
    | "ctc_asc"
  >("newest");

  // Date Filter State
  const [dateField, setDateField] = useState<
    | "joining_date"
    | "created_at"
    | "offer_sent"
    | "offer_accepted"
    | "onboarding_completed"
    | "joining_letter_sent"
  >("joining_date");

  const [datePreset, setDatePreset] = useState<
    | "all"
    | "today"
    | "upcoming_7"
    | "upcoming_30"
    | "this_month"
    | "upcoming_month"
    | "past_30"
    | "past"
    | "custom"
  >("all");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // View Mode: standard table, timeline audit, or visual cards
  const [viewMode, setViewMode] = useState<"standard" | "history" | "grid">(
    "standard"
  );
  const [selectedHistoryCandidate, setSelectedHistoryCandidate] =
    useState<JoiningCandidate | null>(null);

  // Load Candidates
  const loadCandidates = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
      setError("");
    }

    try {
      const response = await fetch("/api/joining", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load joining records.");
      }

      setCandidates(result.candidates ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load joining records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCandidates = async () => {
      try {
        const response = await fetch("/api/joining", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load joining records.");
        }

        if (!cancelled) {
          setCandidates(result.candidates ?? []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load joining records."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchCandidates();

    return () => {
      cancelled = true;
    };
  }, []);

  // Unique options extracted dynamically from data
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      if (c.department && c.department.trim()) set.add(c.department.trim());
    });
    return Array.from(set).sort();
  }, [candidates]);

  // Milestone metric counts
  const milestoneCounts = useMemo(() => {
    let offerPending = 0;
    let offerSent = 0;
    let offerAccepted = 0;
    let onboardingCompleted = 0;
    let onboardingVerified = 0;
    let joiningLetterSent = 0;
    let joined = 0;

    candidates.forEach((c) => {
      if (c.status === "selected" || !c.timeline_history?.offer_sent_at) offerPending++;
      if (c.timeline_history?.offer_sent_at || c.status === "offer_sent") offerSent++;
      if (c.timeline_history?.offer_accepted_at || c.status === "offer_accepted") offerAccepted++;
      if (c.timeline_history?.onboarding_submitted_at) onboardingCompleted++;
      if (c.timeline_history?.onboarding_verified_at) onboardingVerified++;
      if (c.timeline_history?.joining_letter_sent_at || c.status === "joining_letter_sent") joiningLetterSent++;
      if (c.status === "joined") joined++;
    });

    return {
      total: candidates.length,
      offerPending,
      offerSent,
      offerAccepted,
      onboardingCompleted,
      onboardingVerified,
      joiningLetterSent,
      joined,
    };
  }, [candidates]);

  // Filter and Sort Candidates
  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const d7Future = new Date();
    d7Future.setDate(d7Future.getDate() + 7);
    const in7DaysStr = d7Future.toISOString().slice(0, 10);

    const d30Future = new Date();
    d30Future.setDate(d30Future.getDate() + 30);
    const in30DaysStr = d30Future.toISOString().slice(0, 10);

    const d30Past = new Date();
    d30Past.setDate(d30Past.getDate() - 30);
    const past30DaysStr = d30Past.toISOString().slice(0, 10);

    const thisMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().slice(0, 10);

    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonthNum = currentMonth === 11 ? 1 : currentMonth + 2;
    const nextMonthStart = `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-01`;
    const nextMonthEnd = new Date(nextMonthYear, nextMonthNum, 0).toISOString().slice(0, 10);

    return candidates
      .filter((candidate) => {
        // Search
        if (query) {
          const fullName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.toLowerCase();
          const email = (candidate.personal_email || "").toLowerCase();
          const phone = (candidate.mobile_number || "").toLowerCase();
          const desig = (candidate.designation || "").toLowerCase();
          const dept = (candidate.department || "").toLowerCase();
          const loc = (candidate.work_location || "").toLowerCase();

          const matches =
            fullName.includes(query) ||
            email.includes(query) ||
            phone.includes(query) ||
            desig.includes(query) ||
            dept.includes(query) ||
            loc.includes(query);

          if (!matches) return false;
        }

        // Milestone Filter
        if (milestoneFilter !== "all") {
          if (milestoneFilter === "offer_pending") {
            if (candidate.timeline_history?.offer_sent_at) return false;
          } else if (milestoneFilter === "offer_sent") {
            if (!candidate.timeline_history?.offer_sent_at && candidate.status !== "offer_sent") return false;
          } else if (milestoneFilter === "offer_accepted") {
            if (!candidate.timeline_history?.offer_accepted_at && candidate.status !== "offer_accepted") return false;
          } else if (milestoneFilter === "onboarding_completed") {
            if (!candidate.timeline_history?.onboarding_submitted_at) return false;
          } else if (milestoneFilter === "onboarding_verified") {
            if (!candidate.timeline_history?.onboarding_verified_at) return false;
          } else if (milestoneFilter === "joining_letter_sent") {
            if (!candidate.timeline_history?.joining_letter_sent_at && candidate.status !== "joining_letter_sent") return false;
          } else if (milestoneFilter === "joined") {
            if (candidate.status !== "joined") return false;
          }
        }

        // Department Filter
        if (departmentFilter !== "all") {
          if ((candidate.department || "").trim() !== departmentFilter) return false;
        }

        // Work Location Filter
        if (locationFilter !== "all") {
          if ((candidate.work_location || "").toLowerCase() !== locationFilter.toLowerCase()) return false;
        }

        // Employment Type Filter
        if (employmentTypeFilter !== "all") {
          if ((candidate.employment_type || "").toLowerCase() !== employmentTypeFilter.toLowerCase()) return false;
        }

        // Experience Level Filter
        if (experienceFilter !== "all") {
          if ((candidate.experience_level || "").toLowerCase() !== experienceFilter.toLowerCase()) return false;
        }

        // CTC Range Filter
        if (ctcRangeFilter !== "all") {
          const ctcLakhs = Number(candidate.annual_ctc || 0) / 100000;
          if (ctcRangeFilter === "under_5" && ctcLakhs >= 5) return false;
          if (ctcRangeFilter === "5_to_10" && (ctcLakhs < 5 || ctcLakhs > 10)) return false;
          if (ctcRangeFilter === "10_to_15" && (ctcLakhs < 10 || ctcLakhs > 15)) return false;
          if (ctcRangeFilter === "15_to_20" && (ctcLakhs < 15 || ctcLakhs > 20)) return false;
          if (ctcRangeFilter === "above_20" && ctcLakhs <= 20) return false;
        }

        // Date Filter
        if (datePreset !== "all" || Boolean(dateFrom) || Boolean(dateTo)) {
          let targetDate: string | null = null;
          if (dateField === "joining_date") targetDate = candidate.joining_date ? candidate.joining_date.slice(0, 10) : null;
          else if (dateField === "created_at") targetDate = candidate.created_at ? candidate.created_at.slice(0, 10) : null;
          else if (dateField === "offer_sent") targetDate = candidate.timeline_history?.offer_sent_at ? candidate.timeline_history.offer_sent_at.slice(0, 10) : null;
          else if (dateField === "offer_accepted") targetDate = candidate.timeline_history?.offer_accepted_at ? candidate.timeline_history.offer_accepted_at.slice(0, 10) : null;
          else if (dateField === "onboarding_completed") targetDate = candidate.timeline_history?.onboarding_submitted_at ? candidate.timeline_history.onboarding_submitted_at.slice(0, 10) : null;
          else if (dateField === "joining_letter_sent") targetDate = candidate.timeline_history?.joining_letter_sent_at ? candidate.timeline_history.joining_letter_sent_at.slice(0, 10) : null;

          if (!targetDate) return false;

          if (datePreset === "today") {
            if (targetDate !== todayStr) return false;
          } else if (datePreset === "upcoming_7") {
            if (targetDate < todayStr || targetDate > in7DaysStr) return false;
          } else if (datePreset === "upcoming_30") {
            if (targetDate < todayStr || targetDate > in30DaysStr) return false;
          } else if (datePreset === "this_month") {
            if (targetDate < thisMonthStart || targetDate > thisMonthEnd) return false;
          } else if (datePreset === "upcoming_month") {
            if (targetDate < nextMonthStart || targetDate > nextMonthEnd) return false;
          } else if (datePreset === "past_30") {
            if (targetDate < past30DaysStr || targetDate > todayStr) return false;
          } else if (datePreset === "past") {
            if (targetDate >= todayStr) return false;
          } else if (datePreset === "custom") {
            if (dateFrom && targetDate < dateFrom) return false;
            if (dateTo && targetDate > dateTo) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === "joining_asc") {
          const dateA = a.joining_date || "9999-99-99";
          const dateB = b.joining_date || "9999-99-99";
          return dateA.localeCompare(dateB);
        }
        if (sortBy === "joining_desc") {
          const dateA = a.joining_date || "0000-00-00";
          const dateB = b.joining_date || "0000-00-00";
          return dateB.localeCompare(dateA);
        }
        if (sortBy === "name_asc") {
          const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
          const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
          return nameA.localeCompare(nameB);
        }
        if (sortBy === "ctc_desc") {
          return Number(b.annual_ctc || 0) - Number(a.annual_ctc || 0);
        }
        if (sortBy === "ctc_asc") {
          return Number(a.annual_ctc || 0) - Number(b.annual_ctc || 0);
        }
        return 0;
      });
  }, [
    candidates,
    search,
    milestoneFilter,
    departmentFilter,
    locationFilter,
    employmentTypeFilter,
    experienceFilter,
    ctcRangeFilter,
    dateField,
    datePreset,
    dateFrom,
    dateTo,
    sortBy,
  ]);

  // Reset all filters
  const resetAllFilters = () => {
    setSearch("");
    setMilestoneFilter("all");
    setDepartmentFilter("all");
    setLocationFilter("all");
    setEmploymentTypeFilter("all");
    setExperienceFilter("all");
    setCtcRangeFilter("all");
    setDateField("joining_date");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("newest");
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    milestoneFilter !== "all" ||
    departmentFilter !== "all" ||
    locationFilter !== "all" ||
    employmentTypeFilter !== "all" ||
    experienceFilter !== "all" ||
    ctcRangeFilter !== "all" ||
    datePreset !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    sortBy !== "newest";

  // Helpers
  const formatDate = (date?: string | null) => {
    if (!date) return "—";
    const [year, month, day] = date.slice(0, 10).split("-");
    return `${day}-${month}-${year}`;
  };

  const formatTimelineDate = (dateStr?: string | null) => {
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
  };

  const formatCtc = (amount: number | string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const f = (firstName || "").trim()[0] || "";
    const l = (lastName || "").trim()[0] || "";
    return (f + l).toUpperCase() || "EC";
  };

  const getRelativeJoiningBadge = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr.slice(0, 10));
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return <span className="inline-block rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">Joining Today</span>;
    }
    if (diffDays > 0 && diffDays <= 7) {
      return <span className="inline-block rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">In {diffDays} days</span>;
    }
    if (diffDays > 7 && diffDays <= 30) {
      return <span className="inline-block rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">In {diffDays} days</span>;
    }
    if (diffDays < 0) {
      return <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Past Joining</span>;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Joining &amp; Onboarding Directory
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Track candidates across every lifecycle milestone from offer generation to official joining.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("standard")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === "standard"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Standard Table View"
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Directory</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("history")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === "history"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Timeline Audit History View"
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Timeline History</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === "grid"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Visual Cards View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadCandidates(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/joining")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Candidate Offers
          </button>
        </div>
      </div>

      {/* KPI Milestone Summary Cards (Clickable) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            id: "all",
            label: "Entire Pipeline",
            count: milestoneCounts.total,
            desc: "All active joiners",
            icon: UserRound,
            color: "text-indigo-600 bg-indigo-50 border-indigo-200",
            active: milestoneFilter === "all",
          },
          {
            id: "offer_sent",
            label: "Offers Sent",
            count: milestoneCounts.offerSent,
            desc: "Awaiting acceptance",
            icon: Send,
            color: "text-amber-600 bg-amber-50 border-amber-200",
            active: milestoneFilter === "offer_sent",
          },
          {
            id: "offer_accepted",
            label: "Offers Accepted",
            count: milestoneCounts.offerAccepted,
            desc: "Ready for onboarding",
            icon: CheckCircle2,
            color: "text-blue-600 bg-blue-50 border-blue-200",
            active: milestoneFilter === "offer_accepted",
          },
          {
            id: "onboarding_verified",
            label: "Onboarding Verified",
            count: milestoneCounts.onboardingVerified,
            desc: "Ready for employee creation",
            icon: Award,
            color: "text-emerald-600 bg-emerald-50 border-emerald-200",
            active: milestoneFilter === "onboarding_verified",
          },
          {
            id: "joined",
            label: "Joined & Active",
            count: milestoneCounts.joined,
            desc: "Completed onboarding",
            icon: Sparkles,
            color: "text-purple-600 bg-purple-50 border-purple-200",
            active: milestoneFilter === "joined",
          },
        ].map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setMilestoneFilter(card.id as typeof milestoneFilter)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              card.active
                ? "border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-sm"
                : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">{card.label}</span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${card.color}`}>
                <card.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              {card.count}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
              {card.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Control Panel: Search & Comprehensive Multi-Attribute Filters */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        {/* Top search & milestone filter pills */}
        <div className="space-y-3">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, designation, department, work location..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 py-2.5 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Milestone Filter Bar (Renamed "All" to "Entire Pipeline") */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              Lifecycle Stage:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {([
                { id: "all", label: "Entire Pipeline", count: milestoneCounts.total },
                { id: "offer_pending", label: "Offer Pending", count: milestoneCounts.offerPending },
                { id: "offer_sent", label: "Offer Sent", count: milestoneCounts.offerSent },
                { id: "offer_accepted", label: "Offer Accepted", count: milestoneCounts.offerAccepted },
                { id: "onboarding_completed", label: "Onboarding Completed", count: milestoneCounts.onboardingCompleted },
                { id: "onboarding_verified", label: "Onboarding Verified", count: milestoneCounts.onboardingVerified },
                { id: "joining_letter_sent", label: "Joining Letter Sent", count: milestoneCounts.joiningLetterSent },
                { id: "joined", label: "Joined", count: milestoneCounts.joined },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMilestoneFilter(tab.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    milestoneFilter === tab.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 pt-3 border-t border-slate-100">
          {/* Department */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-slate-400" />
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Departments</option>
              {departmentsList.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Work Location */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-slate-400" />
              Work Location
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Work Locations</option>
              <option value="on-site">On-site</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
            </select>
          </div>

          {/* Employment Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <BriefcaseBusiness className="h-3 w-3 text-slate-400" />
              Employment
            </label>
            <select
              value={employmentTypeFilter}
              onChange={(e) => setEmploymentTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Employment Types</option>
              <option value="full_time">Full-time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </div>

          {/* Experience Level */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <GraduationCap className="h-3 w-3 text-slate-400" />
              Experience
            </label>
            <select
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Experience Levels</option>
              <option value="fresher">Fresher</option>
              <option value="experienced">Experienced</option>
            </select>
          </div>

          {/* Salary CTC Band */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <IndianRupee className="h-3 w-3 text-slate-400" />
              Salary Band
            </label>
            <select
              value={ctcRangeFilter}
              onChange={(e) => setCtcRangeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Salary Bands</option>
              <option value="under_5">&lt; ₹5 LPA</option>
              <option value="5_to_10">₹5L – ₹10 LPA</option>
              <option value="10_to_15">₹10L – ₹15 LPA</option>
              <option value="15_to_20">₹15L – ₹20 LPA</option>
              <option value="above_20">&gt; ₹20 LPA</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-slate-400" />
              Sort Order
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="newest">Recently Added</option>
              <option value="joining_asc">Joining Date (Soonest)</option>
              <option value="joining_desc">Joining Date (Latest)</option>
              <option value="name_asc">Name (A – Z)</option>
              <option value="ctc_desc">Annual CTC (Highest)</option>
              <option value="ctc_asc">Annual CTC (Lowest)</option>
            </select>
          </div>
        </div>

        {/* Date Filter Row (Renamed "All Dates" to "Any Time", "Next" to "Upcoming") */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-600 uppercase tracking-wider text-[11px] shrink-0">
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              Date Filter:
            </div>

            {/* Target Date Field */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium">Field:</span>
              <select
                value={dateField}
                onChange={(e) => setDateField(e.target.value as typeof dateField)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="joining_date">Joining Date</option>
                <option value="created_at">Profile Created Date</option>
                <option value="offer_sent">Offer Sent Date</option>
                <option value="offer_accepted">Offer Accepted Date</option>
                <option value="onboarding_completed">Onboarding Completed Date</option>
                <option value="joining_letter_sent">Joining Letter Sent Date</option>
              </select>
            </div>

            {/* Preset Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium">Period:</span>
              <select
                value={datePreset}
                onChange={(e) => {
                  const val = e.target.value as typeof datePreset;
                  setDatePreset(val);
                  if (val !== "custom") {
                    setDateFrom("");
                    setDateTo("");
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="all">Any Time</option>
                <option value="today">Today</option>
                <option value="upcoming_7">Upcoming 7 Days (Future)</option>
                <option value="upcoming_30">Upcoming 30 Days (Future)</option>
                <option value="this_month">This Month</option>
                <option value="upcoming_month">Upcoming Month (Future)</option>
                <option value="past_30">Past 30 Days (History)</option>
                <option value="past">All Past Dates</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>

            {/* Custom Range Inputs */}
            {(datePreset === "custom" || dateFrom || dateTo) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 text-[11px] font-medium">From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    if (datePreset !== "custom") setDatePreset("custom");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
                <span className="text-slate-500 text-[11px] font-medium">To:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    if (datePreset !== "custom") setDatePreset("custom");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-600 font-medium">
              <Filter className="h-3.5 w-3.5 text-indigo-600" />
              <span>
                Showing <strong>{filteredCandidates.length}</strong> of{" "}
                <strong>{candidates.length}</strong> candidates in Entire Pipeline
              </span>
            </div>

            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-700 hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content: Tables or Grid */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 space-y-3">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-600" />
          <p className="font-semibold text-slate-700">Loading candidate records...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <UserRound className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="font-bold text-slate-900 text-base">No joining records found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Candidates registered and given offers in Pre-Onboarding will appear here automatically.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/joining")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
          >
            Go to Candidate Offers
          </button>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="font-bold text-slate-800 text-sm">No candidates match your current filters</h2>
          <p className="text-xs text-slate-500">
            Try adjusting your search terms, milestone stage, or date period presets.
          </p>
          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear All Filters
          </button>
        </div>
      ) : viewMode === "history" ? (
        /* View 1: Multi-Candidate Timeline Audit History Table */
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <table className="w-full min-w-[1150px] text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Candidate</th>
                <th className="px-4 py-3.5">Profile Created</th>
                <th className="px-4 py-3.5">Offer Sent</th>
                <th className="px-4 py-3.5">Offer Accepted</th>
                <th className="px-4 py-3.5">Onboarding Completed</th>
                <th className="px-4 py-3.5">Onboarding Verified</th>
                <th className="px-4 py-3.5">Joining Letter Sent</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3.5">
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

                  <td className="px-4 py-3.5 text-xs text-slate-700">
                    {formatTimelineDate(candidate.created_at) || "—"}
                  </td>

                  <td className="px-4 py-3.5">
                    {candidate.timeline_history?.offer_sent_at ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="text-xs">
                          {formatTimelineDate(candidate.timeline_history.offer_sent_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <Clock className="h-3 w-3" /> Not Sent
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    {candidate.timeline_history?.offer_accepted_at ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="text-xs">
                          {formatTimelineDate(candidate.timeline_history.offer_accepted_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <Clock className="h-3 w-3" /> Awaiting
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    {candidate.timeline_history?.onboarding_submitted_at ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="text-xs">
                          {formatTimelineDate(candidate.timeline_history.onboarding_submitted_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    {candidate.timeline_history?.onboarding_verified_at ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <Award className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="text-xs">
                          {formatTimelineDate(candidate.timeline_history.onboarding_verified_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <Clock className="h-3 w-3" /> Unverified
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    {candidate.timeline_history?.joining_letter_sent_at ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="text-xs">
                          {formatTimelineDate(candidate.timeline_history.joining_letter_sent_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <Clock className="h-3 w-3" /> Not Sent
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryCandidate(candidate)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-indigo-600 transition"
                      title="View Detailed Lifecycle Audit"
                    >
                      <History className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Timeline</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-500 font-medium">
            Showing {filteredCandidates.length} of {candidates.length} candidates in Entire Pipeline
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* View 2: Visual Candidate Cards Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md transition space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm shadow-xs">
                    {getInitials(candidate.first_name, candidate.last_name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">
                      {candidate.first_name} {candidate.last_name}
                    </h3>
                    <p className="text-xs text-indigo-600 font-medium truncate">
                      {candidate.designation}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    candidate.status === "joined"
                      ? "bg-emerald-100 text-emerald-800"
                      : candidate.status === "joining_letter_sent"
                      ? "bg-indigo-100 text-indigo-800"
                      : candidate.status === "offer_accepted"
                      ? "bg-blue-100 text-blue-800"
                      : candidate.status === "offer_sent"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {statusLabels[candidate.status] ?? candidate.status}
                </span>
              </div>

              {/* Department & Location */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  {candidate.department || "General"}
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  {candidate.work_location || "On-site"}
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 capitalize">
                  <BriefcaseBusiness className="h-3 w-3 text-slate-400" />
                  {candidate.employment_type?.replace("_", "-") || "Full-time"}
                </span>
              </div>

              {/* Contact */}
              <div className="space-y-1 rounded-xl bg-slate-50/70 p-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2 truncate">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{candidate.personal_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{candidate.mobile_number}</span>
                </div>
              </div>

              {/* Joining Date & Compensation */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Joining Date
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 mt-0.5">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                    {formatDate(candidate.joining_date)}
                  </div>
                  {getRelativeJoiningBadge(candidate.joining_date)}
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Annual CTC
                  </span>
                  <span className="font-extrabold text-slate-900 mt-0.5 block">
                    {formatCtc(candidate.annual_ctc)}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => setSelectedHistoryCandidate(candidate)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-2xs transition"
              >
                <History className="h-3.5 w-3.5 text-indigo-600" />
                View Lifecycle Audit Trail
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* View 3: Comprehensive Standard Table View */
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          <table className="w-full min-w-[1050px] text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Candidate</th>
                <th className="px-4 py-3.5">Contact Details</th>
                <th className="px-4 py-3.5">Role &amp; Department</th>
                <th className="px-4 py-3.5">Work Location</th>
                <th className="px-4 py-3.5">Joining Date</th>
                <th className="px-4 py-3.5">Annual CTC</th>
                <th className="px-4 py-3.5">Current Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-slate-50/70 transition">
                  {/* Candidate */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xs shadow-xs">
                        {getInitials(candidate.first_name, candidate.last_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {candidate.first_name} {candidate.last_name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                          <span>Added {formatDate(candidate.created_at)}</span>
                          {candidate.experience_level && (
                            <>
                              <span>·</span>
                              <span className="capitalize">{candidate.experience_level}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[190px]">{candidate.personal_email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{candidate.mobile_number}</span>
                      </div>
                    </div>
                  </td>

                  {/* Role & Dept */}
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900 text-xs">
                      {candidate.designation}
                    </p>
                    <p className="text-[11px] text-indigo-600 font-medium">
                      {candidate.department || "General"}
                    </p>
                  </td>

                  {/* Work Location */}
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-700">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {candidate.work_location || "On-site"}
                    </span>
                  </td>

                  {/* Joining Date */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {formatDate(candidate.joining_date)}
                    </div>
                    <div className="mt-0.5">
                      {getRelativeJoiningBadge(candidate.joining_date)}
                    </div>
                  </td>

                  {/* CTC */}
                  <td className="px-4 py-4 font-bold text-slate-900 text-xs">
                    {formatCtc(candidate.annual_ctc)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        candidate.status === "joined"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          : candidate.status === "joining_letter_sent"
                          ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200"
                          : candidate.status === "offer_accepted"
                          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                          : candidate.status === "offer_sent"
                          ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {statusLabels[candidate.status] ?? candidate.status}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryCandidate(candidate)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-indigo-600 transition"
                      title="View Lifecycle History"
                    >
                      <History className="h-3.5 w-3.5 text-indigo-600" />
                      <span>History</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-500 font-medium">
            Showing {filteredCandidates.length} of {candidates.length} candidates in Entire Pipeline
          </div>
        </div>
      )}

      {/* Candidate Lifecycle History Modal */}
      {selectedHistoryCandidate && (
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedHistoryCandidate(null)}
        >
          <div
            className="relative my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm shadow-xs">
                  {getInitials(
                    selectedHistoryCandidate.first_name,
                    selectedHistoryCandidate.last_name
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedHistoryCandidate.first_name} {selectedHistoryCandidate.last_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedHistoryCandidate.designation} · {selectedHistoryCandidate.department || "General"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHistoryCandidate(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Timeline Milestones */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {[
                {
                  id: "candidate_created",
                  label: "Candidate Profile Created",
                  description: "Candidate details and parameters registered in system",
                  timestamp: selectedHistoryCandidate.created_at,
                  icon: UserPlus,
                  isDone: Boolean(selectedHistoryCandidate.created_at),
                },
                {
                  id: "offer_sent",
                  label: "Offer Letter Sent",
                  description: "Offer generated and dispatched to candidate",
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
                  description: "Candidate submitted profile, address, bank, and documents",
                  timestamp: selectedHistoryCandidate.timeline_history?.onboarding_submitted_at,
                  icon: FileText,
                  isDone: Boolean(selectedHistoryCandidate.timeline_history?.onboarding_submitted_at),
                },
                {
                  id: "onboarding_verified",
                  label: "Onboarding Verified",
                  description: "HR verified candidate identity, employment, and documents",
                  timestamp: selectedHistoryCandidate.timeline_history?.onboarding_verified_at,
                  icon: Award,
                  isDone: Boolean(selectedHistoryCandidate.timeline_history?.onboarding_verified_at),
                },
                {
                  id: "joining_letter_sent",
                  label: "Joining Letter Sent",
                  description: "Official appointment letter dispatched to candidate",
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
        </div>
      )}
    </div>
  );
}
