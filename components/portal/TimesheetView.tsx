"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Plus,
  Save,
  Send,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/types";

type TimesheetStatus = "draft" | "submitted";
type TimesheetViewMode = "week" | "month" | "list";
type TimesheetTab = "mine" | "team";

interface TimesheetEntry {
  id: string;
  task: string;
  projectId: string;
  billable: boolean;
  hours: Record<string, number>;
  statusByWeek: Record<string, TimesheetStatus>;
}

interface TimesheetStorage {
  version: 1;
  entries: TimesheetEntry[];
  comments: Record<string, string>;
}

interface TimesheetViewProps {
  employeeId: string;
  projects: Project[];
}

const STORAGE_VERSION = 1;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function monthString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateString(date);
}

function weekStart(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  return addDays(dateString, -((date.getDay() + 6) % 7));
}

function dateLabel(dateString: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(
    "en-US",
    options
  );
}

function datesInWeek(startDate: string) {
  return Array.from({ length: 7 }, (_, index) =>
    addDays(startDate, index)
  );
}

function datesInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const totalDays = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    return `${month}-${pad(index + 1)}`;
  });
}

function hoursForDate(entry: TimesheetEntry, date: string) {
  return entry.hours[date] || 0;
}

function isTimesheetEntry(value: unknown): value is TimesheetEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<TimesheetEntry>;
  const hoursAreValid =
    Boolean(entry.hours) &&
    typeof entry.hours === "object" &&
    Object.entries(entry.hours).every(
      ([date, hours]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        typeof hours === "number" &&
        Number.isFinite(hours) &&
        hours >= 0 &&
        hours <= 24
    );
  const statusesAreValid =
    Boolean(entry.statusByWeek) &&
    typeof entry.statusByWeek === "object" &&
    Object.values(entry.statusByWeek).every(
      (status) => status === "draft" || status === "submitted"
    );

  return (
    typeof entry.id === "string" &&
    typeof entry.task === "string" &&
    typeof entry.projectId === "string" &&
    typeof entry.billable === "boolean" &&
    hoursAreValid &&
    statusesAreValid
  );
}

function isTimesheetStorage(value: unknown): value is TimesheetStorage {
  if (!value || typeof value !== "object") return false;

  const storage = value as Partial<TimesheetStorage>;
  return (
    storage.version === STORAGE_VERSION &&
    Array.isArray(storage.entries) &&
    storage.entries.every(isTimesheetEntry) &&
    Boolean(storage.comments) &&
    typeof storage.comments === "object" &&
    Object.values(storage.comments).every(
      (comment) => typeof comment === "string"
    )
  );
}

function formatHours(hours: number) {
  return `${hours.toFixed(1)} hrs`;
}

export default function TimesheetView({
  employeeId,
  projects,
}: TimesheetViewProps) {
  const today = new Date();
  const [month, setMonth] = useState(monthString(today));
  const [selectedWeek, setSelectedWeek] = useState(
    weekStart(localDateString(today))
  );
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TimesheetTab>("mine");
  const [viewMode, setViewMode] = useState<TimesheetViewMode>("week");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appliedProjectFilter, setAppliedProjectFilter] = useState("all");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState("all");
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newProjectId, setNewProjectId] = useState(projects[0]?.id || "");
  const [newEntryBillable, setNewEntryBillable] = useState(true);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [canSave, setCanSave] = useState(false);

  const storageKey = `employee-timesheet-v${STORAGE_VERSION}:${employeeId}`;
  const weekDates = useMemo(() => datesInWeek(selectedWeek), [selectedWeek]);
  const visibleDates =
    viewMode === "month" ? datesInMonth(month) : weekDates;

  useEffect(() => {
    let restored: TimesheetStorage | null = null;
    let loadError = "";

    try {
      const saved = window.localStorage.getItem(storageKey);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (!isTimesheetStorage(parsed)) {
          throw new Error("Saved timesheet data has an unsupported format.");
        }

        restored = parsed;
      }
    } catch (error) {
      console.error("Unable to load timesheet data:", error);
      loadError = "Saved timesheets could not be loaded from this browser.";
    }

    const timer = window.setTimeout(() => {
      if (restored) {
        setEntries(restored.entries);
        setComments(restored.comments);
      }
      if (loadError) setStorageError(loadError);
      else setCanSave(true);
      setHasLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoaded || !canSave) return;

    let saveError = "";
    try {
      const storage: TimesheetStorage = {
        version: STORAGE_VERSION,
        entries,
        comments,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(storage));
    } catch (error) {
      console.error("Unable to save timesheet data:", error);
      saveError = "Timesheet changes could not be saved in this browser.";
    }

    const timer = window.setTimeout(
      () => setStorageError(saveError),
      0
    );
    return () => window.clearTimeout(timer);
  }, [canSave, comments, entries, hasLoaded, storageKey]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (
        appliedProjectFilter !== "all" &&
        entry.projectId !== appliedProjectFilter
      ) {
        return false;
      }

      const dates = datesInMonth(month);
      if (
        appliedStatusFilter !== "all" &&
        !dates.some(
          (date) =>
            (entry.statusByWeek[weekStart(date)] || "draft") ===
              appliedStatusFilter
        )
      ) {
        return false;
      }

      return true;
    });
  }, [appliedProjectFilter, appliedStatusFilter, entries, month]);

  const monthlyStats = useMemo(() => {
    return filteredEntries.reduce(
      (totals, entry) => {
        for (const date of datesInMonth(month)) {
          const hours = hoursForDate(entry, date);
          if (!hours) continue;

          totals.total += hours;
          if (entry.billable) totals.billable += hours;

          const status = entry.statusByWeek[weekStart(date)] || "draft";
          if (status === "submitted") {
            totals.submitted += hours;
            totals.pending += hours;
          }
        }

        return totals;
      },
      { total: 0, submitted: 0, pending: 0, billable: 0 }
    );
  }, [filteredEntries, month]);

  const updateHours = (
    entryId: string,
    date: string,
    value: string
  ) => {
    const parsed = Number(value);
    const hours =
      value === "" || !Number.isFinite(parsed)
        ? 0
        : Math.min(Math.max(parsed, 0), 24);

    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) return entry;

        const nextHours = { ...entry.hours };
        if (hours === 0) {
          delete nextHours[date];
        } else {
          nextHours[date] = hours;
        }

        return { ...entry, hours: nextHours };
      })
    );
  };

  const addEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const task = newTask.trim();

    if (!task || !newProjectId) {
      setNotice("Enter a task name and select a project.");
      return;
    }

    const entry: TimesheetEntry = {
      id: crypto.randomUUID(),
      task,
      projectId: newProjectId,
      billable: newEntryBillable,
      hours: {},
      statusByWeek: {},
    };

    setEntries((current) => [...current, entry]);
    setProjectFilter("all");
    setAppliedProjectFilter("all");
    setStatusFilter("all");
    setAppliedStatusFilter("all");
    setNewTask("");
    setIsAddingEntry(false);
    setNotice("Time entry added. Enter your hours in the new task row.");
  };

  const removeEntry = (entryId: string) => {
    setEntries((current) =>
      current.filter((entry) => entry.id !== entryId)
    );
    setNotice("Time entry removed.");
  };

  const saveDraft = () => {
    setEntries((current) =>
      current.map((entry) => ({
        ...entry,
        statusByWeek: {
          ...entry.statusByWeek,
          [selectedWeek]: "draft",
        },
      }))
    );
    setNotice("Timesheet saved as a draft in this browser.");
  };

  const submitForApproval = () => {
    const hasHours = entries.some((entry) =>
      weekDates.some((date) => hoursForDate(entry, date) > 0)
    );

    if (!hasHours) {
      setNotice("Add hours to at least one task before submitting.");
      return;
    }

    setEntries((current) =>
      current.map((entry) => {
        const hasEntryHours = weekDates.some(
          (date) => hoursForDate(entry, date) > 0
        );

        return hasEntryHours
          ? {
              ...entry,
              statusByWeek: {
                ...entry.statusByWeek,
                [selectedWeek]: "submitted",
              },
            }
          : entry;
      })
    );
    setNotice(
      "Timesheet marked as submitted on this device. It has not been sent to HR."
    );
  };

  const movePeriod = (direction: -1 | 1) => {
    if (viewMode === "week") {
      const nextWeek = addDays(selectedWeek, direction * 7);
      setSelectedWeek(nextWeek);
      setMonth(nextWeek.slice(0, 7));
      return;
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonth = new Date(year, monthNumber - 1 + direction, 1);
    const nextMonthString = monthString(nextMonth);
    setMonth(nextMonthString);
    setSelectedWeek(weekStart(`${nextMonthString}-01`));
  };

  const periodLabel =
    viewMode === "week"
      ? `${dateLabel(weekDates[0], {
          month: "short",
          day: "numeric",
        })} – ${dateLabel(weekDates[6], {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : dateLabel(`${month}-01`, { month: "long", year: "numeric" });

  const totalsByDate = visibleDates.map((date) =>
    filteredEntries.reduce(
      (total, entry) => total + hoursForDate(entry, date),
      0
    )
  );

  const totalVisibleHours = totalsByDate.reduce(
    (total, hours) => total + hours,
    0
  );

  const visibleByPeriod = filteredEntries;

  const stats = [
    {
      label: "Total Hours",
      value: monthlyStats.total,
      icon: Clock3,
      color: "text-sky-700",
      iconBg: "bg-sky-50",
    },
    {
      label: "Submitted Hours",
      value: monthlyStats.submitted,
      icon: CheckCircle2,
      color: "text-emerald-700",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Pending Approval",
      value: monthlyStats.pending,
      icon: Timer,
      color: "text-amber-700",
      iconBg: "bg-amber-50",
    },
    {
      label: "Billable Hours",
      value: monthlyStats.billable,
      icon: CalendarDays,
      color: "text-indigo-700",
      iconBg: "bg-indigo-50",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Timesheet
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Log your work hours, tasks, and project activities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice("");
            setIsAddingEntry(true);
          }}
          disabled={projects.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          Add Time Entry
        </button>
      </header>

      {projects.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          No project is currently assigned to your account. Contact HR to add
          your project before creating time entries.
        </div>
      )}

      {storageError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {storageError}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${stat.iconBg} ${stat.color}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-0.5 text-xl font-bold text-slate-900">
                  {formatHours(stat.value)}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Period
            </span>
            <input
              type="month"
              value={month}
              onChange={(event) => {
                const nextMonth = event.target.value;
                setMonth(nextMonth);
                setSelectedWeek(weekStart(`${nextMonth}-01`));
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Project
            </span>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setAppliedProjectFilter(projectFilter);
              setAppliedStatusFilter(statusFilter);
            }}
            className="h-10 rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Apply
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-5">
            <button
              type="button"
              onClick={() => setActiveTab("mine")}
              className={`border-b-2 px-1 pb-2 pt-1 text-sm font-semibold ${
                activeTab === "mine"
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              My Timesheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("team")}
              className={`border-b-2 px-1 pb-2 pt-1 text-sm font-semibold ${
                activeTab === "team"
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Team Timesheet
            </button>
          </div>

          {activeTab === "mine" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => movePeriod(-1)}
                  aria-label="Previous period"
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[155px] text-center text-sm font-medium text-slate-700">
                  {periodLabel}
                </span>
                <button
                  type="button"
                  onClick={() => movePeriod(1)}
                  aria-label="Next period"
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 p-1">
                {(["week", "month", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      viewMode === mode
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeTab === "team" ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Team timesheets aren&apos;t available here yet
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              This view is for your personal timesheet. Team timesheets require
              an HR review workflow.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Task / Project</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Hours</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleByPeriod.flatMap((entry) => {
                  const datesWithHours = visibleDates.filter(
                    (date) => hoursForDate(entry, date) > 0
                  );
                  const datesToShow: (string | null)[] =
                    datesWithHours.length > 0 ? datesWithHours : [null];

                  return datesToShow.map((date) => (
                      <tr
                        key={`${entry.id}-${date ?? "empty"}`}
                        className="text-slate-700"
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">
                            {entry.task}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {projects.find(
                              (project) => project.id === entry.projectId
                            )?.name || "Project"}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          {date
                            ? dateLabel(date, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })
                            : "No hours entered"}
                        </td>
                        <td className="px-5 py-3 font-semibold">
                          {date ? formatHours(hoursForDate(entry, date)) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          {entry.billable ? "Billable" : "Non-billable"}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge
                            status={
                              date
                                ? entry.statusByWeek[weekStart(date)] || "draft"
                                : "draft"
                            }
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id)}
                            aria-label={`Remove ${entry.task}`}
                            className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                  ));
                })}
              </tbody>
            </table>
            {visibleByPeriod.length === 0 && (
              <EmptyTimesheet onAdd={() => setIsAddingEntry(true)} />
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className={`w-full text-sm ${
                viewMode === "week" ? "min-w-[900px]" : "min-w-[1600px]"
              }`}
            >
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="sticky left-0 z-10 min-w-[250px] border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold">
                    Task / Project
                  </th>
                  {visibleDates.map((date) => (
                    <th
                      key={date}
                      className="min-w-[88px] border-b border-slate-200 px-2 py-2 text-center"
                    >
                      <span className="block text-xs font-semibold">
                        {dateLabel(date, {
                          weekday: "short",
                        })}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                        {dateLabel(date, { month: "short", day: "numeric" })}
                      </span>
                    </th>
                  ))}
                  <th className="min-w-[105px] border-b border-l border-slate-200 bg-slate-50 px-3 py-3 text-right font-semibold">
                    Total
                  </th>
                  <th className="w-12 border-b border-slate-200" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleByPeriod.map((entry) => {
                  const entryTotal = visibleDates.reduce(
                    (total, date) => total + hoursForDate(entry, date),
                    0
                  );
                  const project = projects.find(
                    (item) => item.id === entry.projectId
                  );

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 z-[1] border-r border-slate-100 bg-white px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">
                              {entry.task}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {project?.name || "Project"} ·{" "}
                              {entry.billable ? "Billable" : "Non-billable"}
                            </p>
                          </div>
                        </div>
                      </td>
                      {visibleDates.map((date) => {
                        const isSubmitted =
                          entry.statusByWeek[weekStart(date)] === "submitted";
                        return (
                          <td key={date} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max="24"
                              step="0.25"
                              value={hoursForDate(entry, date) || ""}
                              onChange={(event) =>
                                updateHours(entry.id, date, event.target.value)
                              }
                              disabled={isSubmitted}
                              aria-label={`${entry.task}, ${dateLabel(date, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              })} hours`}
                              className="h-9 w-[72px] rounded-md border border-slate-200 bg-white px-2 text-center text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </td>
                        );
                      })}
                      <td className="border-l border-slate-100 px-3 py-3 text-right font-semibold text-slate-800">
                        {formatHours(entryTotal)}
                      </td>
                      <td className="px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          aria-label={`Remove ${entry.task}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visibleByPeriod.length > 0 && (
                  <tr className="bg-indigo-50/70 font-semibold text-slate-800">
                    <td className="sticky left-0 z-[1] border-r border-indigo-100 bg-indigo-50/70 px-4 py-3">
                      Total Hours
                    </td>
                    {totalsByDate.map((total, index) => (
                      <td key={visibleDates[index]} className="px-2 py-3 text-center">
                        {total.toFixed(1)}
                      </td>
                    ))}
                    <td className="border-l border-indigo-100 px-3 py-3 text-right">
                      {formatHours(totalVisibleHours)}
                    </td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
            {visibleByPeriod.length === 0 && (
              <EmptyTimesheet onAdd={() => setIsAddingEntry(true)} />
            )}
          </div>
        )}

        {activeTab === "mine" && (
          <div className="border-t border-slate-200 bg-slate-50/50 p-4 sm:p-5">
            <label
              htmlFor="timesheet-comments"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Comments <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <textarea
                id="timesheet-comments"
                rows={3}
                value={comments[selectedWeek] || ""}
                onChange={(event) =>
                  setComments((current) => ({
                    ...current,
                    [selectedWeek]: event.target.value,
                  }))
                }
                placeholder="Add any notes for this week..."
                className="min-h-[82px] flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row lg:pb-0.5">
                <button
                  type="button"
                  onClick={saveDraft}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Save className="h-4 w-4" />
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={submitForApproval}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Send className="h-4 w-4" />
                  Submit for Approval
                </button>
              </div>
            </div>
            {notice && (
              <p className="mt-3 text-sm text-indigo-700" role="status">
                {notice}
              </p>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Timesheets are stored in this browser only. Submission is not
              sent to HR.
            </p>
          </div>
        )}
      </section>

      {isAddingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsAddingEntry(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-timesheet-entry-title"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="add-timesheet-entry-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Add time entry
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Create a task row, then enter hours for each day.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingEntry(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={addEntry} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Task / activity
                </span>
                <input
                  autoFocus
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  maxLength={100}
                  required
                  placeholder="e.g. Feature development"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Project
                </span>
                <select
                  value={newProjectId}
                  onChange={(event) => setNewProjectId(event.target.value)}
                  required
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="" disabled>
                    Select a project
                  </option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newEntryBillable}
                  onChange={(event) =>
                    setNewEntryBillable(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Billable work
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingEntry(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!projects.length}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus className="h-4 w-4" />
                  Add Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TimesheetStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === "submitted"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {status === "submitted" ? "Submitted" : "Draft"}
    </span>
  );
}

function EmptyTimesheet({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <Timer className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-sm font-semibold text-slate-900">
        No time entries for this period
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Add a task or project activity to start filling in your timesheet.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      >
        <Plus className="h-4 w-4" />
        Add Time Entry
      </button>
    </div>
  );
}
