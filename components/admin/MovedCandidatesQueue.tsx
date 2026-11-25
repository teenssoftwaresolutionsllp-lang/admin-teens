"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  X,
  UserPlus,
  Calendar,
  Briefcase,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  LayoutGrid,
  List,
  Sparkles,
  Users,
  Award,
  CalendarRange,
  History,
  Send,
} from "lucide-react";

export type MovedCandidate = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  personal_email: string | null;
  mobile_number: string | null;
  gender: string | null;
  designation: string | null;
  department: string | null;
  joining_date: string | null;
  annual_ctc: number | string | null;
  employment_type: string | null;
  work_location: string | null;
  experience_level: string | null;
  total_experience_years: number | string | null;
  total_experience_months: number | string | null;
  probation_period_months: number | string | null;
  accepted_offer_document_id: string | null;
  onboarding_status: string | null;
  onboarding_submission_id: string | null;
  onboarding_verified_at: string | null;
  onboarding_verified_by: string | null;
  conversion_status: string | null;
  employee_record_id: string | null;
  status: string | null;
  add_employee_moved_at: string | null;
  joining_letter_sent_at: string | null;
  joining_letter_send_status: string | null;
  timeline_history?: {
    offer_sent_at?: string | null;
    offer_accepted_at?: string | null;
    onboarding_submitted_at?: string | null;
    onboarding_verified_at?: string | null;
    joining_letter_sent_at?: string | null;
  };
};

interface MovedCandidatesQueueProps {
  candidates: MovedCandidate[];
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "Not specified";
  const dateOnly = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateStr;
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount?: number | string | null) {
  if (!amount) return "—";
  const num = Number(amount);
  if (isNaN(num)) return String(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatTimestamp(dateStr?: string | null) {
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

function getTodayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function MovedCandidatesQueue({
  candidates,
}: MovedCandidatesQueueProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedDesignation, setSelectedDesignation] = useState("all");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState("all");
  const [selectedExperienceLevel, setSelectedExperienceLevel] = useState("all");
  const [selectedOnboardingStatus, setSelectedOnboardingStatus] = useState("all");
  const [selectedHistoryCandidate, setSelectedHistoryCandidate] = useState<MovedCandidate | null>(null);

  // Date filters
  const [joiningDatePreset, setJoiningDatePreset] = useState<
    "all" | "next_7" | "next_30" | "this_month" | "next_month" | "past" | "custom"
  >("all");
  const [joiningDateFrom, setJoiningDateFrom] = useState("");
  const [joiningDateTo, setJoiningDateTo] = useState("");

  const [movedDatePreset, setMovedDatePreset] = useState<
    "all" | "today" | "this_week" | "this_month" | "last_30" | "custom"
  >("all");
  const [movedDateFrom, setMovedDateFrom] = useState("");
  const [movedDateTo, setMovedDateTo] = useState("");

  const [sortBy, setSortBy] = useState<
    "newest" | "joining_asc" | "joining_desc" | "name_asc" | "ctc_desc"
  >("newest");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Filter options derived from data
  const departments = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      if (c.department) set.add(c.department);
    });
    return Array.from(set).sort();
  }, [candidates]);

  const designations = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      if (c.designation) set.add(c.designation);
    });
    return Array.from(set).sort();
  }, [candidates]);

  const employmentTypes = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      if (c.employment_type) set.add(c.employment_type);
    });
    return Array.from(set).sort();
  }, [candidates]);

  // Overall metric counts
  const metrics = useMemo(() => {
    const total = candidates.length;
    let verified = 0;
    let inProgress = 0;
    let notStarted = 0;
    let letterSent = 0;

    candidates.forEach((c) => {
      const status = c.onboarding_status || "not_started";
      if (status === "verified" || c.onboarding_verified_at) {
        verified++;
      } else if (status === "in_progress" || status === "submitted") {
        inProgress++;
      } else {
        notStarted++;
      }

      if (c.joining_letter_sent_at || c.status === "joining_letter_sent") {
        letterSent++;
      }
    });

    return { total, verified, inProgress, notStarted, letterSent };
  }, [candidates]);

  // Filtered and sorted candidate list
  const filteredCandidates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const todayStr = getTodayStr();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Calculate dates for presets
    const d7 = new Date();
    d7.setDate(d7.getDate() + 7);
    const in7DaysStr = d7.toISOString().slice(0, 10);

    const d30 = new Date();
    d30.setDate(d30.getDate() + 30);
    const in30DaysStr = d30.toISOString().slice(0, 10);

    const thisMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0)
      .toISOString()
      .slice(0, 10);

    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonthNum = currentMonth === 11 ? 1 : currentMonth + 2;
    const nextMonthStart = `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-01`;
    const nextMonthEnd = new Date(nextMonthYear, nextMonthNum, 0)
      .toISOString()
      .slice(0, 10);

    // Moved date calculations
    // const todayDateStart = `${todayStr}T00:00:00`;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = monthAgo.toISOString();

    return candidates
      .filter((c) => {
        // Search filter
        if (term) {
          const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
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

        // Department filter
        if (selectedDepartment !== "all" && c.department !== selectedDepartment) {
          return false;
        }

        // Designation filter
        if (selectedDesignation !== "all" && c.designation !== selectedDesignation) {
          return false;
        }

        // Employment type filter
        if (selectedEmploymentType !== "all" && c.employment_type !== selectedEmploymentType) {
          return false;
        }

        // Experience level filter
        if (selectedExperienceLevel !== "all" && c.experience_level !== selectedExperienceLevel) {
          return false;
        }

        // Onboarding status filter
        if (selectedOnboardingStatus !== "all") {
          const currentStatus = c.onboarding_status || "not_started";
          if (selectedOnboardingStatus === "verified") {
            if (currentStatus !== "verified" && !c.onboarding_verified_at) return false;
          } else if (selectedOnboardingStatus === "in_progress") {
            if (currentStatus !== "in_progress" && currentStatus !== "submitted") return false;
          } else if (selectedOnboardingStatus === "submitted") {
            if (currentStatus !== "submitted") return false;
          } else if (selectedOnboardingStatus === "not_started") {
            if (currentStatus !== "not_started" && currentStatus !== "") return false;
          }
        }

        // Joining Date filter
        const joiningDate = (c.joining_date || "").slice(0, 10);
        if (joiningDatePreset === "next_7") {
          if (!joiningDate || joiningDate < todayStr || joiningDate > in7DaysStr) return false;
        } else if (joiningDatePreset === "next_30") {
          if (!joiningDate || joiningDate < todayStr || joiningDate > in30DaysStr) return false;
        } else if (joiningDatePreset === "this_month") {
          if (!joiningDate || joiningDate < thisMonthStart || joiningDate > thisMonthEnd) return false;
        } else if (joiningDatePreset === "next_month") {
          if (!joiningDate || joiningDate < nextMonthStart || joiningDate > nextMonthEnd) return false;
        } else if (joiningDatePreset === "past") {
          if (!joiningDate || joiningDate >= todayStr) return false;
        } else if (joiningDatePreset === "custom") {
          if (joiningDateFrom && joiningDate < joiningDateFrom) return false;
          if (joiningDateTo && joiningDate > joiningDateTo) return false;
        }

        // Moved Date filter
        const movedAt = c.add_employee_moved_at || "";
        if (movedDatePreset === "today") {
          if (!movedAt || movedAt.slice(0, 10) !== todayStr) return false;
        } else if (movedDatePreset === "this_week") {
          if (!movedAt || movedAt < weekAgoStr) return false;
        } else if (movedDatePreset === "this_month") {
          if (!movedAt || movedAt.slice(0, 7) !== todayStr.slice(0, 7)) return false;
        } else if (movedDatePreset === "last_30") {
          if (!movedAt || movedAt < monthAgoStr) return false;
        } else if (movedDatePreset === "custom") {
          const movedDateOnly = movedAt.slice(0, 10);
          if (movedDateFrom && movedDateOnly < movedDateFrom) return false;
          if (movedDateTo && movedDateOnly > movedDateTo) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          const timeA = a.add_employee_moved_at ? new Date(a.add_employee_moved_at).getTime() : 0;
          const timeB = b.add_employee_moved_at ? new Date(b.add_employee_moved_at).getTime() : 0;
          return timeB - timeA;
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
          const ctcA = Number(a.annual_ctc || 0);
          const ctcB = Number(b.annual_ctc || 0);
          return ctcB - ctcA;
        }
        return 0;
      });
  }, [
    candidates,
    searchTerm,
    selectedDepartment,
    selectedDesignation,
    selectedEmploymentType,
    selectedExperienceLevel,
    selectedOnboardingStatus,
    joiningDatePreset,
    joiningDateFrom,
    joiningDateTo,
    movedDatePreset,
    movedDateFrom,
    movedDateTo,
    sortBy,
  ]);

  const activeFiltersCount = [
    selectedDepartment !== "all",
    selectedDesignation !== "all",
    selectedEmploymentType !== "all",
    selectedExperienceLevel !== "all",
    selectedOnboardingStatus !== "all",
    joiningDatePreset !== "all" || Boolean(joiningDateFrom) || Boolean(joiningDateTo),
    movedDatePreset !== "all" || Boolean(movedDateFrom) || Boolean(movedDateTo),
    Boolean(searchTerm.trim()),
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedDepartment("all");
    setSelectedDesignation("all");
    setSelectedEmploymentType("all");
    setSelectedExperienceLevel("all");
    setSelectedOnboardingStatus("all");
    setJoiningDatePreset("all");
    setJoiningDateFrom("");
    setJoiningDateTo("");
    setMovedDatePreset("all");
    setMovedDateFrom("");
    setMovedDateTo("");
    setSortBy("newest");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Metric Cards (Clickable Filters) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Moved */}
        <button
          type="button"
          onClick={() => setSelectedOnboardingStatus("all")}
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            selectedOnboardingStatus === "all"
              ? "border-indigo-400 bg-gradient-to-br from-indigo-100/90 via-white to-indigo-50/60 ring-2 ring-indigo-500 shadow-md"
              : "border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Total In Queue
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {metrics.total}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-indigo-600/80 font-medium truncate">
              Accepted offer & moved to Add Emp
            </span>
            {selectedOnboardingStatus === "all" && (
              <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>

        {/* Verified / Ready */}
        <button
          type="button"
          onClick={() =>
            setSelectedOnboardingStatus(
              selectedOnboardingStatus === "verified" ? "all" : "verified"
            )
          }
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            selectedOnboardingStatus === "verified"
              ? "border-emerald-400 bg-gradient-to-br from-emerald-100/90 via-white to-emerald-50/60 ring-2 ring-emerald-500 shadow-md"
              : "border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Onboarding Verified
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {metrics.verified}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-emerald-600/80 font-medium truncate">
              Ready for final employee creation
            </span>
            {selectedOnboardingStatus === "verified" && (
              <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>

        {/* Onboarding In Progress */}
        <button
          type="button"
          onClick={() =>
            setSelectedOnboardingStatus(
              selectedOnboardingStatus === "in_progress" ? "all" : "in_progress"
            )
          }
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            selectedOnboardingStatus === "in_progress"
              ? "border-amber-400 bg-gradient-to-br from-amber-100/90 via-white to-amber-50/60 ring-2 ring-amber-500 shadow-md"
              : "border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              In Progress / Review
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {metrics.inProgress}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-amber-600/80 font-medium truncate">
              Awaiting candidate or HR review
            </span>
            {selectedOnboardingStatus === "in_progress" && (
              <span className="shrink-0 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>

        {/* Pending Onboarding */}
        <button
          type="button"
          onClick={() =>
            setSelectedOnboardingStatus(
              selectedOnboardingStatus === "not_started" ? "all" : "not_started"
            )
          }
          className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
            selectedOnboardingStatus === "not_started"
              ? "border-slate-400 bg-gradient-to-br from-slate-200/90 via-white to-slate-100/60 ring-2 ring-slate-600 shadow-md"
              : "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50/50 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Awaiting Onboarding
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-600 text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {metrics.notStarted}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium truncate">
              Onboarding link not yet completed
            </span>
            {selectedOnboardingStatus === "not_started" && (
              <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white">
                Active
              </span>
            )}
          </div>
        </button>
      </div>

      {/* 2. Search & Filters Panel */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        {/* Top filter row: Search bar + Quick Status pills + View Mode */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search input */}
          <div className="relative flex-1 min-w-0 max-w-lg">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, phone, designation..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick status tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: "all", label: "All Statuses", count: candidates.length },
              { id: "verified", label: "Verified", count: metrics.verified },
              { id: "in_progress", label: "In Progress", count: metrics.inProgress },
              { id: "not_started", label: "Not Started", count: metrics.notStarted },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedOnboardingStatus(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                  selectedOnboardingStatus === tab.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 p-1 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-1.5 transition ${
                viewMode === "grid"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-lg p-1.5 transition ${
                viewMode === "table"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Detailed Dropdowns Row: Department, Designation, Type, Experience, Sort */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 pt-1 border-t border-slate-100">
          {/* Department */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Designation */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Designation
            </label>
            <select
              value={selectedDesignation}
              onChange={(e) => setSelectedDesignation(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Designations ({designations.length})</option>
              {designations.map((desig) => (
                <option key={desig} value={desig}>
                  {desig}
                </option>
              ))}
            </select>
          </div>

          {/* Employment Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Employment Type
            </label>
            <select
              value={selectedEmploymentType}
              onChange={(e) => setSelectedEmploymentType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Types</option>
              {employmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Experience Level */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Experience Level
            </label>
            <select
              value={selectedExperienceLevel}
              onChange={(e) => setSelectedExperienceLevel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="all">All Experience Levels</option>
              <option value="fresher">Fresher</option>
              <option value="experienced">Experienced</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
            >
              <option value="newest">Recently Moved</option>
              <option value="joining_asc">Joining Date (Earliest)</option>
              <option value="joining_desc">Joining Date (Latest)</option>
              <option value="name_asc">Name (A – Z)</option>
              <option value="ctc_desc">Annual CTC (Highest)</option>
            </select>
          </div>
        </div>

        {/* Date Filters Section */}
        <div className="rounded-xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/40 via-white to-slate-50/50 p-3 sm:p-3.5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <CalendarRange className="h-4 w-4 text-indigo-600" />
            <span>Date Filters</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Joining Date Preset */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Joining Date Period
              </label>
              <select
                value={joiningDatePreset}
                onChange={(e) => {
                  const val = e.target.value as typeof joiningDatePreset;
                  setJoiningDatePreset(val);
                  if (val !== "custom") {
                    setJoiningDateFrom("");
                    setJoiningDateTo("");
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="all">All Joining Dates</option>
                <option value="next_7">Joining in Next 7 Days</option>
                <option value="next_30">Joining in Next 30 Days</option>
                <option value="this_month">Joining This Month</option>
                <option value="next_month">Joining Next Month</option>
                <option value="past">Past Joining Dates</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>

            {/* Custom Joining Date Range */}
            {joiningDatePreset === "custom" && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Joining From
                  </label>
                  <input
                    type="date"
                    value={joiningDateFrom}
                    onChange={(e) => setJoiningDateFrom(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Joining To
                  </label>
                  <input
                    type="date"
                    value={joiningDateTo}
                    onChange={(e) => setJoiningDateTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Moved to Add Emp Date Preset */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Moved to Add Emp Date
              </label>
              <select
                value={movedDatePreset}
                onChange={(e) => {
                  const val = e.target.value as typeof movedDatePreset;
                  setMovedDatePreset(val);
                  if (val !== "custom") {
                    setMovedDateFrom("");
                    setMovedDateTo("");
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="all">All Moved Dates</option>
                <option value="today">Moved Today</option>
                <option value="this_week">Moved This Week</option>
                <option value="this_month">Moved This Month</option>
                <option value="last_30">Moved in Last 30 Days</option>
                <option value="custom">Custom Moved Range...</option>
              </select>
            </div>

            {/* Custom Moved Date Range */}
            {movedDatePreset === "custom" && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Moved From
                  </label>
                  <input
                    type="date"
                    value={movedDateFrom}
                    onChange={(e) => setMovedDateFrom(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Moved To
                  </label>
                  <input
                    type="date"
                    value={movedDateTo}
                    onChange={(e) => setMovedDateTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter chips & clear button */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-600">
              <Filter className="h-3.5 w-3.5 text-indigo-600" />
              <span>
                Showing <strong>{filteredCandidates.length}</strong> of{" "}
                <strong>{candidates.length}</strong> candidates
              </span>

              {/* Chips */}
              {joiningDatePreset !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-100">
                  <Calendar className="h-3 w-3" />
                  Joining: {joiningDatePreset.replace("_", " ")}
                </span>
              )}
              {movedDatePreset !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-100">
                  <Clock className="h-3 w-3" />
                  Moved: {movedDatePreset.replace("_", " ")}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
            >
              <X className="h-3.5 w-3.5" />
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* 3. Candidates List: Grid or Table */}
      {filteredCandidates.length > 0 ? (
        viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCandidates.map((candidate) => {
              const fullName = [candidate.first_name, candidate.last_name]
                .filter(Boolean)
                .join(" ") || "Unnamed Candidate";

              const isVerified =
                candidate.onboarding_status === "verified" ||
                Boolean(candidate.onboarding_verified_at);

              const isInProgress =
                candidate.onboarding_status === "in_progress" ||
                candidate.onboarding_status === "submitted";

              const targetUrl = `/dashboard/employees/add?candidateId=${encodeURIComponent(
                candidate.id
              )}`;

              return (
                <div
                  key={candidate.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  {/* Top: Avatar, Name, Department & Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm shadow-xs">
                          {getInitials(candidate.first_name, candidate.last_name)}
                        </div>

                        <div className="min-w-0">
                          <Link
                            href={targetUrl}
                            className="block font-bold text-slate-900 truncate hover:text-indigo-600 transition"
                          >
                            {fullName}
                          </Link>
                          <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                            {candidate.designation || "Designation pending"}
                          </p>
                        </div>
                      </div>

                      {/* Onboarding status badge */}
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 shrink-0">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </span>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200 shrink-0">
                          <Clock className="h-3 w-3" />
                          In Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200 shrink-0">
                          Not Started
                        </span>
                      )}
                    </div>

                    {/* Department, Employment Type & Experience Tags */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {candidate.department && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50/80 px-2.5 py-1 font-semibold text-indigo-700 border border-indigo-100">
                          <Building2 className="h-3 w-3" />
                          {candidate.department}
                        </span>
                      )}

                      {candidate.employment_type && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700">
                          <Briefcase className="h-3 w-3 text-slate-400" />
                          {candidate.employment_type}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700">
                        <Award className="h-3 w-3 text-slate-400" />
                        {candidate.experience_level === "fresher"
                          ? "Fresher"
                          : `${candidate.total_experience_years || 0}y ${
                              candidate.total_experience_months || 0
                            }m`}
                      </span>
                    </div>

                    {/* Contact & Offer Details */}
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      {candidate.personal_email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{candidate.personal_email}</span>
                        </div>
                      )}

                      {candidate.mobile_number && (
                        <div className="flex items-center gap-2 truncate">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{candidate.mobile_number}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="font-medium">Joining:</span>
                          <span className="font-semibold text-slate-900">
                            {formatDate(candidate.joining_date)}
                          </span>
                        </div>

                        {candidate.annual_ctc ? (
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-slate-900">
                              {formatCurrency(candidate.annual_ctc)}
                            </span>
                            <span className="text-[10px] text-slate-400 block -mt-0.5">
                              / year
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Button */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryCandidate(candidate)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-indigo-600"
                      title="View Candidate Lifecycle History"
                    >
                      <History className="h-3.5 w-3.5 text-slate-500" />
                      <span>History</span>
                    </button>
                    <Link
                      href={targetUrl}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 group-hover:shadow-sm"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Open & Add</span>
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 pl-5 pr-3">Candidate</th>
                    <th className="py-3.5 px-3">Role & Dept</th>
                    <th className="py-3.5 px-3">Contact</th>
                    <th className="py-3.5 px-3">Joining Date</th>
                    <th className="py-3.5 px-3">Annual CTC</th>
                    <th className="py-3.5 px-3">Onboarding</th>
                    <th className="py-3.5 pl-3 pr-5 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredCandidates.map((candidate) => {
                    const fullName = [candidate.first_name, candidate.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unnamed Candidate";

                    const isVerified =
                      candidate.onboarding_status === "verified" ||
                      Boolean(candidate.onboarding_verified_at);

                    const isInProgress =
                      candidate.onboarding_status === "in_progress" ||
                      candidate.onboarding_status === "submitted";

                    const targetUrl = `/dashboard/employees/add?candidateId=${encodeURIComponent(
                      candidate.id
                    )}`;

                    return (
                      <tr
                        key={candidate.id}
                        className="transition hover:bg-indigo-50/40"
                      >
                        {/* Candidate Name & Initials */}
                        <td className="py-3.5 pl-5 pr-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xs shadow-xs">
                              {getInitials(candidate.first_name, candidate.last_name)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={targetUrl}
                                className="font-bold text-slate-900 hover:text-indigo-600 truncate block"
                              >
                                {fullName}
                              </Link>
                              <span className="text-[11px] text-slate-400 capitalize">
                                {candidate.experience_level === "fresher"
                                  ? "Fresher"
                                  : `${candidate.total_experience_years || 0}y ${
                                      candidate.total_experience_months || 0
                                    }m`}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role & Dept */}
                        <td className="py-3.5 px-3">
                          <p className="font-semibold text-slate-800 truncate">
                            {candidate.designation || "Not specified"}
                          </p>
                          <p className="text-[11px] text-indigo-600 font-medium">
                            {candidate.department || "Unassigned"}
                          </p>
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-3">
                          <p className="text-slate-700 truncate">{candidate.personal_email || "—"}</p>
                          <p className="text-[11px] text-slate-400">{candidate.mobile_number || "—"}</p>
                        </td>

                        {/* Joining Date */}
                        <td className="py-3.5 px-3 whitespace-nowrap font-medium text-slate-800">
                          {formatDate(candidate.joining_date)}
                        </td>

                        {/* Annual CTC */}
                        <td className="py-3.5 px-3 whitespace-nowrap font-semibold text-slate-900">
                          {formatCurrency(candidate.annual_ctc)}
                        </td>

                        {/* Onboarding Status */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          ) : isInProgress ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                              <Clock className="h-3 w-3" />
                              In Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                              Not Started
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedHistoryCandidate(candidate)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-indigo-600 transition"
                              title="View Candidate Lifecycle History"
                            >
                              <History className="h-3.5 w-3.5 text-slate-500" />
                              <span>History</span>
                            </button>
                            <Link
                              href={targetUrl}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
                            >
                              <span>Add Employee</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Empty Filter State */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No candidates match your filters
          </h3>
          <p className="mx-auto max-w-sm text-xs text-slate-500">
            Try adjusting your search query, department, date filters, or onboarding status to find candidates.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
          >
            Clear All Filters
          </button>
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
                  id: "moved_to_add_emp",
                  label: "Moved to Add Employee",
                  description: "Offer accepted and handed off to final employee creation queue",
                  timestamp: selectedHistoryCandidate.add_employee_moved_at,
                  icon: UserPlus,
                  isDone: Boolean(selectedHistoryCandidate.add_employee_moved_at),
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
                        <span>{formatTimestamp(step.timestamp)}</span>
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
