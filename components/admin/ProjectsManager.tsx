"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Project,
  HolidayCalendar,
  Employee,
} from "@/lib/types";
import {
  Globe,
  Plus,
  Calendar,
  XCircle,
  Users,
  Upload,
  FileText,
  RefreshCw,
  Trash2,
  PlusCircle,
  Save,
  CheckCircle2,
  Clock,
  Info,
  Eye,
  Download,
} from "lucide-react";

interface ProjectsManagerProps {
  initialProjects: Project[];
  calendars: HolidayCalendar[];
  employees: Employee[];
}

interface DraftHoliday {
  holiday_date: string;
  title: string;
  is_optional: boolean;
  is_working_day: boolean;
}

export default function ProjectsManager({
  initialProjects,
  calendars,
  employees,
}: ProjectsManagerProps) {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [calendarList, setCalendarList] =
    useState<HolidayCalendar[]>(calendars);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCountry, setSelectedCountry] = useState("IN");
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );
  const [selectedShift, setSelectedShift] = useState<
    "general" | "night"
  >("general");

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear + 1];

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draftHolidays, setDraftHolidays] = useState<DraftHoliday[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    client_country: "India",
    timezone: "Asia/Kolkata",
    calendar_id: calendars[0]?.id || "",
    shift_start_time: "09:00",
    shift_end_time: "18:00",
    grace_period_minutes: 30,
    half_day_cutoff_minutes: 150,
  });

  useEffect(() => {
    setCalendarList(calendars);
  }, [calendars]);

  const activeCalendar = calendarList.find(
    (calendar) =>
      calendar.country_code === selectedCountry &&
      calendar.calendar_year === selectedYear &&
      (calendar.shift_type || "general") === selectedShift
  );

  useEffect(() => {
    const extracted = activeCalendar?.extracted_holidays;

    if (Array.isArray(extracted)) {
      setDraftHolidays(
        extracted.map((item) => {
          const holiday = item as Record<string, unknown>;

          return {
            holiday_date:
              typeof holiday.holiday_date === "string"
                ? holiday.holiday_date
                : "",
            title:
              typeof holiday.title === "string"
                ? holiday.title
                : "",
            is_optional: holiday.is_optional === true,
            is_working_day: holiday.is_working_day === true,
          };
        })
      );
    } else {
      setDraftHolidays([]);
    }

    setSelectedFile(null);
    setMessage(null);
    setCalendarError(null);
  }, [
    selectedCountry,
    selectedYear,
    selectedShift,
    activeCalendar?.id,
  ]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create project");
      }

      setProjects((current) => [...current, result.project]);
      setIsModalOpen(false);

      setFormData({
        name: "",
        client_country: "India",
        timezone: "Asia/Kolkata",
        calendar_id: calendarList[0]?.id || "",
        shift_start_time: "09:00",
        shift_end_time: "18:00",
        grace_period_minutes: 30,
        half_day_cutoff_minutes: 150,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to create project"
      );
    }
  };

  const updateCalendar = (
    calendarId: string,
    updates: Partial<HolidayCalendar>
  ) => {
    setCalendarList((current) =>
      current.map((calendar) =>
        calendar.id === calendarId
          ? { ...calendar, ...updates }
          : calendar
      )
    );
  };

  const handleCalendarUpload = async () => {
    if (!activeCalendar || !selectedFile) {
      setCalendarError("Please select a PDF or image document.");
      return;
    }

    setBusyAction("upload");
    setCalendarError(null);
    setMessage(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("calendar_id", activeCalendar.id);
      uploadFormData.append("file", selectedFile);

      const response = await fetch("/api/holiday-calendars/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Document upload failed.");
      }

      updateCalendar(activeCalendar.id, {
        document_status: "uploaded",
        document_file_name: selectedFile.name,
        extracted_holidays: [],
        approved_by: null,
        approved_at: null,
        approval_remarks: null,
      });

      setDraftHolidays([]);
      setSelectedFile(null);
      setMessage("Document uploaded successfully. Extract holidays next.");

      router.refresh();
    } catch (caught) {
      setCalendarError(
        caught instanceof Error
          ? caught.message
          : "Document upload failed."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleExtract = async () => {
    if (!activeCalendar) return;

    setBusyAction("extract");
    setCalendarError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/holiday-calendars/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendar_id: activeCalendar.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Holiday extraction failed.");
      }

      const extracted = result.calendar?.extracted_holidays;

      if (!Array.isArray(extracted)) {
        throw new Error(
          "Extraction completed, but the API did not return holiday entries."
        );
      }

      const normalized: DraftHoliday[] = extracted.map(
        (item: Record<string, unknown>) => ({
          holiday_date:
            typeof item.holiday_date === "string"
              ? item.holiday_date
              : "",
          title:
            typeof item.title === "string"
              ? item.title
              : "",
          is_optional: item.is_optional === true,
          is_working_day: item.is_working_day === true,
        })
      );

      setDraftHolidays(normalized);

      updateCalendar(activeCalendar.id, {
        document_status: "extracted",
        extracted_holidays: normalized,
      });

      setMessage(
        `${normalized.length} holiday entries extracted. Please verify every entry before importing.`
      );
    } catch (caught) {
      setCalendarError(
        caught instanceof Error
          ? caught.message
          : "Holiday extraction failed."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const updateDraftHoliday = (
    index: number,
    updates: Partial<DraftHoliday>
  ) => {
    setDraftHolidays((current) =>
      current.map((holiday, i) =>
        i === index ? { ...holiday, ...updates } : holiday
      )
    );
  };

  const addDraftHoliday = () => {
    setDraftHolidays((current) => [
      ...current,
      {
        holiday_date: "",
        title: "",
        is_optional: false,
        is_working_day: false,
      },
    ]);
  };

  const removeDraftHoliday = (index: number) => {
    setDraftHolidays((current) =>
      current.filter((_, i) => i !== index)
    );
  };

  const handleSaveAndImport = async () => {
    if (!activeCalendar) return;

    if (activeCalendar.document_status !== "extracted") {
      setCalendarError("Extract the document before importing holidays.");
      return;
    }

    if (draftHolidays.length === 0) {
      setCalendarError("Add at least one holiday entry.");
      return;
    }

    const dates = new Set<string>();

    for (const holiday of draftHolidays) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday.holiday_date)) {
        setCalendarError("Every holiday must have a valid date.");
        return;
      }

      const parsed = new Date(`${holiday.holiday_date}T00:00:00Z`);

      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== holiday.holiday_date
      ) {
        setCalendarError(`Invalid date: ${holiday.holiday_date}`);
        return;
      }

      if (parsed.getUTCFullYear() !== activeCalendar.calendar_year) {
        setCalendarError(
          `Every holiday must belong to ${activeCalendar.calendar_year}.`
        );
        return;
      }

      if (!holiday.title.trim() || holiday.title.trim().length > 150) {
        setCalendarError(
          "Every holiday needs a title between 1 and 150 characters."
        );
        return;
      }

      if (dates.has(holiday.holiday_date)) {
        setCalendarError(`Duplicate date found: ${holiday.holiday_date}`);
        return;
      }

      dates.add(holiday.holiday_date);
    }

    const confirmed = window.confirm(
      `Import ${draftHolidays.length} holiday entries into ${activeCalendar.name}? Existing calendar entries will not be overwritten.`
    );

    if (!confirmed) return;

    setBusyAction("import");
    setCalendarError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/holiday-calendars/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendar_id: activeCalendar.id,
          holidays: draftHolidays,
        }),
      });

      const result = await response.json();

      if (response.status === 409 && result.conflicts) {
        const conflictText = result.conflicts
          .map(
            (conflict: {
              holiday_date: string;
              existing_title: string;
              extracted_title: string;
            }) =>
              `${conflict.holiday_date}: Existing "${conflict.existing_title}" / Extracted "${conflict.extracted_title}"`
          )
          .join("\n");

        throw new Error(
          `Some dates already exist. No entries were imported:\n${conflictText}`
        );
      }

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || result.error || "Holiday import failed."
        );
      }

      updateCalendar(activeCalendar.id, {
        document_status: "imported",
      });

      setMessage(
        `Successfully imported ${result.imported_count} holiday entries.`
      );

      setDraftHolidays([]);
      router.refresh();
    } catch (caught) {
      setCalendarError(
        caught instanceof Error
          ? caught.message
          : "Holiday import failed."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const countryName =
    selectedCountry === "IN" ? "India" : "United States";

  const shiftLabel =
    selectedShift === "general" ? "General Shift" : "Night Shift";

  const isImported =
    activeCalendar?.document_status === "imported";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Globe className="w-5 h-5" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Projects, Shifts & Country Calendars
            </h2>
          </div>

          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-11">
            Manage multi-country timelines, client shifts, and country
            holiday calendars. Employees inherit holidays and shift
            rules from their assigned project.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all shrink-0 hover:shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Create Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {projects.map((proj) => {
          const assignedCount = employees.filter(
            (employee) => employee.project_id === proj.id
          ).length;

          return (
            <div
              key={proj.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
                    {proj.client_country}
                  </span>

                  <span className="text-xs font-medium text-slate-400 font-mono">
                    {proj.timezone}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-3 tracking-tight">
                  {proj.name}
                </h3>

                <div className="mt-4 space-y-2 text-xs text-slate-600 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">
                      Shift Hours:
                    </span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {proj.shift_start_time} - {proj.shift_end_time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">
                      Grace Period:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {proj.grace_period_minutes} mins
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">
                      Holiday Schedule:
                    </span>
                    <span className="font-semibold text-indigo-700">
                      {proj.calendar?.name || "India Standard"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>
                    {assignedCount}{" "}
                    {assignedCount === 1 ? "Employee" : "Employees"} Assigned
                  </span>
                </span>

                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Active
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Country Holiday Calendars */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header and Country Tabs */}
        <div className="p-5 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-6 h-6 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Multi-Country Holiday Calendars
                </h3>
              </div>

              <p className="text-xs text-slate-500 mt-1 ml-8">
                Configure holiday calendars for different countries
              </p>
            </div>

            <div className="inline-flex items-center self-start lg:self-auto p-1 rounded-xl border border-indigo-100 bg-white">
              {[
                { code: "IN", label: "🇮🇳 India (IN)" },
                { code: "US", label: "🇺🇸 United States (US)" },
              ].map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => setSelectedCountry(country.code)}
                  className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedCountry === country.code
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {country.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selectors and Calendar Summary */}
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-5">
            {/* Left: Year, Shift and Information */}
            <div className="flex flex-col justify-between gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Select Year
                  </label>

                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />

                    <select
                      value={selectedYear}
                      onChange={(e) =>
                        setSelectedYear(Number(e.target.value))
                      }
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>

                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      ▾
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Select Shift
                  </label>

                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />

                    <select
                      value={selectedShift}
                      onChange={(e) =>
                        setSelectedShift(
                          e.target.value as "general" | "night"
                        )
                      }
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    >
                      <option value="general">General Shift</option>
                      <option value="night">Night Shift</option>
                    </select>

                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      ▾
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-indigo-50 px-4 py-3.5">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />

                <p className="text-xs leading-relaxed text-slate-700">
                  This calendar will be applied based on the selected
                  country and shift for all relevant employees.
                </p>
              </div>
            </div>

            {/* Right: Calendar Summary */}
            <div className="min-h-[180px] rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-100 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-5 overflow-hidden">
              {activeCalendar ? (
                <>
                  <div className="flex items-center justify-center shrink-0 w-32 h-28 sm:w-40 sm:h-32 rounded-2xl bg-white/70">
                    <div className="relative">
                      <Calendar className="w-24 h-24 sm:w-28 sm:h-28 text-indigo-500 stroke-[1.4]" />
                      <Globe className="absolute -right-5 -bottom-2 w-12 h-12 p-1.5 rounded-full bg-white text-blue-500 shadow-sm" />
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <h4 className="text-lg font-bold text-slate-900">
                      {countryName} Holiday Calendar ({selectedYear})
                    </h4>

                    <p className="text-sm text-slate-600 mt-1">
                      {activeCalendar.holidays?.length || 0} calendar entries
                      configured for {shiftLabel.toLowerCase()}.
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      {activeCalendar.name}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("current-calendar-entries")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full border border-indigo-300 bg-white/80 text-xs font-semibold text-indigo-700 hover:bg-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Holidays
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-32 h-28 flex items-center justify-center rounded-2xl bg-white/70 shrink-0">
                    <Calendar className="w-20 h-20 text-indigo-300 stroke-[1.3]" />
                  </div>

                  <div className="text-center sm:text-left">
                    <h4 className="text-lg font-bold text-slate-900">
                      {countryName} Holiday Calendar ({selectedYear})
                    </h4>

                    <p className="text-sm text-slate-600 mt-1">
                      Calendar Not Configured
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      No calendar exists for {countryName}, {selectedYear},
                      and {shiftLabel}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Holiday Document Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Holiday Document
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a PDF, PNG, or JPEG document (maximum 5 MB).
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {!activeCalendar ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Calendar Not Configured
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Configure a calendar for {countryName}, {selectedYear}, and{" "}
                {shiftLabel} before uploading a document.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* LEFT: Document Upload */}
                <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/20 p-5 flex flex-col items-center justify-center text-center min-h-[225px]">
                  {isImported ? (
                    <>
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                      <p className="text-sm font-semibold text-emerald-800">
                        Calendar Finalized
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        This calendar has been imported successfully.
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        Document replacement is disabled.
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-9 h-9 text-indigo-500 mb-3" />

                      <p className="text-sm font-semibold text-slate-800">
                        Drag & drop your document here
                      </p>

                      <p className="text-xs text-slate-500 my-2">or</p>

                      <input
                        id="holiday-document-upload"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                        onChange={(e) =>
                          setSelectedFile(e.target.files?.[0] || null)
                        }
                        disabled={busyAction !== null}
                        className="hidden"
                      />

                      <label
                        htmlFor="holiday-document-upload"
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold ${
                          busyAction !== null
                            ? "opacity-50 pointer-events-none"
                            : "cursor-pointer"
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        Choose File
                      </label>

                      {selectedFile && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-white border border-indigo-100 max-w-full">
                          <p className="text-xs text-indigo-700 font-semibold break-all">
                            {selectedFile.name}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* RIGHT: Uploaded Document */}
                <div className="rounded-xl border border-slate-200 overflow-hidden min-h-[225px]">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h4 className="text-sm font-bold text-slate-800">
                      Uploaded Document
                    </h4>
                  </div>

                  <div className="p-4 flex flex-col justify-between min-h-[175px]">
                    {activeCalendar.document_file_name ? (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6 text-rose-600" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 break-all">
                              {activeCalendar.document_file_name}
                            </p>

                            {activeCalendar.document_uploaded_at && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                Uploaded:{" "}
                                {new Date(
                                  activeCalendar.document_uploaded_at
                                ).toLocaleString()}
                              </p>
                            )}

                            <span
                              className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${
                                isImported
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : activeCalendar.document_status === "extracted"
                                    ? "bg-blue-50 border-blue-200 text-blue-700"
                                    : "bg-amber-50 border-amber-200 text-amber-700"
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isImported
                                ? "Imported"
                                : activeCalendar.document_status === "extracted"
                                  ? "Extracted"
                                  : "Uploaded"}
                            </span>
                          </div>
                        </div>

                        {/* View and Download: available even after import */}
                        <div className="flex flex-wrap gap-2 mt-4">
                          <a
                            href={`/api/holiday-calendars/document?calendar_id=${encodeURIComponent(
                              activeCalendar.id
                            )}&disposition=inline`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View Document
                          </a>

                          <a
                            href={`/api/holiday-calendars/document?calendar_id=${encodeURIComponent(
                              activeCalendar.id
                            )}&disposition=attachment`}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download Document
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-5">
                        <FileText className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-xs text-slate-500">
                          No document uploaded yet.
                        </p>
                      </div>
                    )}

                    {!isImported && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          type="button"
                          onClick={handleCalendarUpload}
                          disabled={!selectedFile || busyAction !== null}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg"
                        >
                          {busyAction === "upload" ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          Upload Document
                        </button>

                        {activeCalendar.document_status !== "not_uploaded" &&
                          activeCalendar.document_file_name && (
                            <button
                              type="button"
                              onClick={handleExtract}
                              disabled={busyAction !== null}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 rounded-lg"
                            >
                              {busyAction === "extract" ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                              Extract Holidays
                            </button>
                          )}
                      </div>
                    )}

                    {isImported && (
                      <div className="mt-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                        <p className="text-xs font-semibold text-emerald-800">
                          Calendar Imported Successfully
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-1">
                          The document remains available for viewing and downloading.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Feedback */}
              {calendarError && (
                <div className="mt-4 p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 whitespace-pre-wrap">
                  {calendarError}
                </div>
              )}

              {message && (
                <div className="mt-4 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-700">
                  {message}
                </div>
              )}

              {/* Extracted Holiday Editor */}
              {!isImported &&
                activeCalendar.document_status === "extracted" && (
                  <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Extracted Holiday Entries
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Verify and correct every entry before importing.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addDraftHoliday}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add Holiday
                      </button>
                    </div>

                    {draftHolidays.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-500">
                          No extracted entries. Add holiday entries manually.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {draftHolidays.map((holiday, index) => (
                          <div
                            key={index}
                            className="p-4 border border-slate-200 rounded-xl bg-white space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-500">
                                Holiday #{index + 1}
                              </span>

                              <button
                                type="button"
                                onClick={() => removeDraftHoliday(index)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                                title="Remove holiday"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                  Holiday Date
                                </label>
                                <input
                                  type="date"
                                  value={holiday.holiday_date}
                                  onChange={(e) =>
                                    updateDraftHoliday(index, {
                                      holiday_date: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                  Holiday Name
                                </label>
                                <input
                                  type="text"
                                  maxLength={150}
                                  value={holiday.title}
                                  onChange={(e) =>
                                    updateDraftHoliday(index, {
                                      title: e.target.value,
                                    })
                                  }
                                  placeholder="Enter holiday name"
                                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                              <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={holiday.is_optional}
                                  onChange={(e) =>
                                    updateDraftHoliday(index, {
                                      is_optional: e.target.checked,
                                    })
                                  }
                                  className="rounded border-slate-300"
                                />
                                Optional Holiday
                              </label>

                              <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={holiday.is_working_day}
                                  onChange={(e) =>
                                    updateDraftHoliday(index, {
                                      is_working_day: e.target.checked,
                                    })
                                  }
                                  className="rounded border-slate-300"
                                />
                                Working Day / Working Saturday
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleSaveAndImport}
                        disabled={
                          busyAction !== null || draftHolidays.length === 0
                        }
                        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm"
                      >
                        {busyAction === "import" ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save & Import Calendar
                      </button>

                      <p className="text-[10px] text-slate-500 mt-2">
                        This imports the edited entries directly. Existing
                        dates are protected from being overwritten.
                      </p>
                    </div>
                  </div>
                )}

              <p className="text-[10px] text-slate-400 mt-4">
                Uploading a replacement document clears the previous
                extracted draft. It does not delete existing calendar
                entries.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Current Calendar Entries */}
      <div
        id="current-calendar-entries"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Current Calendar Entries
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeCalendar
                  ? `${countryName} · ${selectedYear} · ${shiftLabel}`
                  : `${countryName} · ${selectedYear} · ${shiftLabel}`}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {!activeCalendar ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Calendar Not Configured
              </p>
              <p className="text-xs text-slate-500 mt-1">
                No calendar exists for {countryName}, {selectedYear}, and{" "}
                {shiftLabel}.
              </p>
            </div>
          ) : activeCalendar.holidays &&
            activeCalendar.holidays.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[650px] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-xs font-bold text-slate-700">
                    <th className="px-4 py-3 border-b border-slate-200">
                      S.No
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200">
                      Date
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200">
                      Holiday Name
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200">
                      Type
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeCalendar.holidays.map((holiday, index) => (
                    <tr
                      key={holiday.id}
                      className="text-xs text-slate-700 hover:bg-slate-50/70"
                    >
                      {/* S.No */}
                      <td className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-500">
                        {index + 1}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">
                        {new Date(
                          `${holiday.holiday_date}T00:00:00`
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      {/* Holiday Name */}
                      <td className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-900">
                        {holiday.title}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 border-b border-slate-100">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-semibold ${
                            holiday.is_working_day
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : holiday.is_optional
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {holiday.is_working_day
                            ? "Working Day"
                            : holiday.is_optional
                              ? "Optional Holiday"
                              : "Holiday"}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 border-b border-slate-100 text-slate-500">
                        {holiday.is_working_day
                          ? "Working day / working Saturday"
                          : holiday.is_optional
                            ? "Optional holiday"
                            : `${countryName} holiday`}
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">
                No calendar entries found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Create New Client Project
              </h3>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateProject}
              className="mt-4 space-y-3.5 text-xs"
            >
              {error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-semibold text-rose-700">
                  {error}
                </p>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Project Name
                </label>

                <input
                  type="text"
                  required
                  placeholder="e.g. US Telecom Billing Suite"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Client Country
                  </label>

                  <select
                    value={formData.client_country}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        client_country: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="India">India</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Holiday Calendar
                  </label>

                  <select
                    value={formData.calendar_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        calendar_id: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {calendarList.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Shift Start Time
                  </label>

                  <input
                    type="time"
                    required
                    value={formData.shift_start_time}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shift_start_time: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Shift End Time
                  </label>

                  <input
                    type="time"
                    required
                    value={formData.shift_end_time}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shift_end_time: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Grace Period (Minutes)
                </label>

                <input
                  type="number"
                  value={formData.grace_period_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      grace_period_minutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all hover:shadow"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}