"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Employee } from "@/lib/types";
import {
  CalendarDays,
  ImagePlus,
  Megaphone,
  RefreshCw,
  Send,
  X,
  PlusCircle,
  List,
} from "lucide-react";
import Image from "next/image";

interface Department {
  id: string;
  name: string;
}

interface CompanyEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: "event" | "emergency_announcement";
  audience_scope: "company" | "departments" | "individuals";
  status: "draft" | "published";
  event_date: string | null;
  end_date: string | null;
  location: string | null;
  expires_at: string | null;
  created_at: string;
  department_ids?: string[];
  employee_ids?: string[];
  media?: EventMedia[];
}

interface EventMedia {
  id: string;
  event_id: string;
  image_url: string;
  cloudinary_public_id: string;
  alt_text: string | null;
  sort_order: number;
}

interface CompanyEventsManagerProps {
  employees: Employee[];
  departments: Department[];
}

type ManagerTab = "create" | "existing";


function getIndiaDateTimeLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export default function CompanyEventsManager({
  employees,
  departments,
}: CompanyEventsManagerProps) {
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [activeTab, setActiveTab] = useState<ManagerTab>("create");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<
    "event" | "emergency_announcement"
  >("event");
  const [audienceScope, setAudienceScope] = useState<
    "company" | "departments" | "individuals"
  >("company");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);

  const imagePreviews = useMemo(
    () =>
      selectedImages.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [selectedImages]
  );

  useEffect(() => {
    return () => {
      imagePreviews.forEach((image) => {
        URL.revokeObjectURL(image.url);
      });
    };
  }, [imagePreviews]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/company-events", {
        cache: "no-store",
      });

      const result = (await response.json()) as {
        events?: CompanyEvent[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Unable to load company events.");
      }

      setEvents(result.events ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load company events."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchEvents = async () => {
        try {
        const response = await fetch("/api/company-events", {
            cache: "no-store",
        });

        const result = (await response.json()) as {
            events?: CompanyEvent[];
            error?: string;
        };

        if (!response.ok) {
            throw new Error(result.error || "Unable to load company events.");
        }

        if (!cancelled) {
            setEvents(result.events ?? []);
        }
        } catch (err) {
        if (!cancelled) {
            setError(
            err instanceof Error
                ? err.message
                : "Unable to load company events."
            );
        }
        } finally {
        if (!cancelled) {
            setLoading(false);
        }
        }
    };

    void fetchEvents();

    return () => {
        cancelled = true;
    };
  }, []);

  const handleImageSelection = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setError("Only JPEG, PNG, and WebP images are allowed.");
        event.target.value = "";
        return;
      }

      if (file.size === 0 || file.size > 8 * 1024 * 1024) {
        setError(`"${file.name}" must be smaller than 8 MB.`);
        event.target.value = "";
        return;
      }
    }

    setError(null);

    setSelectedImages((previous) => {
      const combined = [...previous, ...files];

      if (combined.length > 10) {
        setError("You can upload a maximum of 10 images per event.");
        return previous;
      }

      return combined;
    });

    event.target.value = "";
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages((previous) =>
      previous.filter((_, imageIndex) => imageIndex !== index)
    );
  };

  const toggleSelection = (
    id: string,
    selected: string[],
    update: (value: string[]) => void
  ) => {
    update(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id]
    );
  };

  const handleEventTypeChange = (
    value: "event" | "emergency_announcement"
  ) => {
    setEventType(value);

    if (value === "event") {
      setAudienceScope("company");
      setDepartmentIds([]);
      setEmployeeIds([]);
    }
  };

  const handleAudienceChange = (
    value: "company" | "departments" | "individuals"
  ) => {
    setAudienceScope(value);
    setDepartmentIds([]);
    setEmployeeIds([]);
  };

  const resetForm = () => {
    setEditingEventId(null);
    setTitle("");
    setDescription("");
    setEventType("event");
    setAudienceScope("company");
    setEventDate("");
    setEndDate("");
    setExpiresAt("");
    setLocation("");
    setStatus("draft");
    setDepartmentIds([]);
    setEmployeeIds([]);
    setSelectedImages([]);
  };

  const toDateTimeLocal = (value: string | null) => {
    if (!value) return "";

    const date = new Date(value);
    const offset = date.getTimezoneOffset();

    return new Date(date.getTime() - offset * 60 * 1000)
      .toISOString()
      .slice(0, 16);
  };

  const handleEdit = (item: CompanyEvent) => {
    setEditingEventId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setEventType(item.event_type);
    setAudienceScope(item.audience_scope);
    setStatus(item.status);
    setEventDate(toDateTimeLocal(item.event_date));
    setEndDate(toDateTimeLocal(item.end_date));
    setExpiresAt(toDateTimeLocal(item.expires_at));
    setLocation(item.location ?? "");
    setDepartmentIds(item.department_ids ?? []);
    setEmployeeIds(item.employee_ids ?? []);
    setSelectedImages([]);
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError(null);
    setMessage(null);

    if (
      eventType === "emergency_announcement" &&
      audienceScope === "departments" &&
      departmentIds.length === 0
    ) {
      setError("Select at least one department.");
      return;
    }

    if (
      eventType === "emergency_announcement" &&
      audienceScope === "individuals" &&
      employeeIds.length === 0
    ) {
      setError("Select at least one employee.");
      return;
    }

    setSaving(true);

    const toIsoString = (value: string) =>
      value ? new Date(value).toISOString() : null;

    let savedEventId = editingEventId;
    let eventSaved = false;

    try {
      const payload = {
        ...(editingEventId ? { id: editingEventId } : {}),
        title: title.trim(),
        description: description.trim(),
        event_type: eventType,
        audience_scope: audienceScope,
        status,
        event_date: toIsoString(eventDate),
        end_date: toIsoString(endDate),
        expires_at: toIsoString(expiresAt),
        location: location.trim(),
        department_ids:
          audienceScope === "departments" ? departmentIds : [],
        employee_ids:
          audienceScope === "individuals" ? employeeIds : [],
      };

      const response = await fetch("/api/company-events", {
        method: editingEventId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        error?: string;
        event?: { id: string };
        notifications?: { sent: number; failed: number };
      };

      if (!response.ok || !result.event?.id) {
        throw new Error(
          result.error ||
            (editingEventId
              ? "Unable to update event."
              : "Unable to create event.")
        );
      }

      savedEventId = result.event.id;
      eventSaved = true;

      // Keep the event in edit mode if an image upload fails.
      setEditingEventId(savedEventId);

      const imagesToUpload = [...selectedImages];
      let uploadedCount = 0;

      for (const file of imagesToUpload) {
        const imageFormData = new FormData();

        imageFormData.append("event_id", savedEventId);
        imageFormData.append("file", file);
        imageFormData.append("alt_text", file.name);

        const uploadResponse = await fetch("/api/company-events/media", {
          method: "POST",
          body: imageFormData,
        });

        const uploadResult = (await uploadResponse.json()) as {
          error?: string;
        };

        if (!uploadResponse.ok) {
          throw new Error(
            `Event was saved, but image "${file.name}" failed to upload: ${
              uploadResult.error || "Upload failed."
            }`
          );
        }

        uploadedCount++;

        // Keep only images that have not uploaded yet.
        setSelectedImages(imagesToUpload.slice(uploadedCount));
      }

      const isAnnouncement =
        eventType === "emergency_announcement" && status === "published";

      if (isAnnouncement) {
        const sent = result.notifications?.sent ?? 0;
        const failed = result.notifications?.failed ?? 0;

        setMessage(
          `${editingEventId ? "Announcement updated." : "Announcement published."} ${
            sent
          } notification(s) sent${
            failed > 0 ? `; ${failed} failed` : ""
          }. ${uploadedCount} new image(s) uploaded.`
        );
      } else {
        setMessage(
          `${
            editingEventId
              ? "Event updated successfully."
              : status === "published"
                ? "Event published successfully."
                : "Event saved as a draft."
          } ${uploadedCount} new image(s) uploaded.`
        );
      }

      resetForm();
      await loadEvents();

      // Show the updated list after saving.
      setActiveTab("existing");
    } catch (err) {
      if (eventSaved) {
        await loadEvents();
      }

      setError(
        err instanceof Error ? err.message : "Unable to save event."
      );
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "Not scheduled";

    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const showForm = activeTab === "create" || Boolean(editingEventId);

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Company Events & Announcements
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Publish company events or send emergency announcements to selected
            employees.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      {!editingEventId && (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("create");
                setError(null);
                setMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                activeTab === "create"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              Create Event
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("existing");
                setError(null);
                setMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                activeTab === "existing"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <List className="h-4 w-4" />
              Existing Events
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  activeTab === "existing"
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {events.length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Blurred background overlay */}
      {editingEventId && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-md"
          aria-hidden="true"
        />
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className={
            editingEventId
              ? "fixed left-1/2 top-1/2 z-[70] w-[min(960px,calc(100vw-2rem))] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              : "space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          }
        >
          {/* Form Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900">
                {editingEventId
                  ? "Edit Event / Announcement"
                  : "Create New"}
              </h3>
            </div>

            {editingEventId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                aria-label="Close edit popup"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Type and Status */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Type
              </label>

              <select
                value={eventType}
                onChange={(e) =>
                  handleEventTypeChange(
                    e.target.value as "event" | "emergency_announcement"
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="event">Normal Event</option>
                <option value="emergency_announcement">
                  Emergency Announcement
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Status
              </label>

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "draft" | "published")
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="draft">Save as Draft</option>
                <option value="published">Publish Now</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Title *
            </label>

            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event or announcement title"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Description
            </label>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add event details or announcement message"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          {/* Emergency Announcement Targeting */}
          {eventType === "emergency_announcement" && (
            <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/50 p-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Target Audience
                </label>

                <select
                  value={audienceScope}
                  onChange={(e) =>
                    handleAudienceChange(
                      e.target.value as
                        | "company"
                        | "departments"
                        | "individuals"
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="company">Entire Company</option>
                  <option value="departments">Selected Departments</option>
                  <option value="individuals">Selected Employees</option>
                </select>
              </div>

              {audienceScope === "departments" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {departments.map((department) => (
                    <label
                      key={department.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={departmentIds.includes(department.id)}
                        onChange={() =>
                          toggleSelection(
                            department.id,
                            departmentIds,
                            setDepartmentIds
                          )
                        }
                      />
                      {department.name}
                    </label>
                  ))}

                  {departments.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No departments found.
                    </p>
                  )}
                </div>
              )}

              {audienceScope === "individuals" && (
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                  {employees.map((employee) => (
                    <label
                      key={employee.id}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={employeeIds.includes(employee.id)}
                        onChange={() =>
                          toggleSelection(
                            employee.id,
                            employeeIds,
                            setEmployeeIds
                          )
                        }
                      />

                      <span>
                        {employee.first_name} {employee.last_name}
                        <span className="ml-2 text-xs text-slate-400">
                          {employee.employee_id}
                        </span>
                      </span>
                    </label>
                  ))}

                  {employees.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No employees found.
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-red-700">
                Only employees in the selected audience will see this
                announcement and receive its notification.
              </p>
            </div>
          )}

          {/* Event Photos */}
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ImagePlus className="h-4 w-4 text-indigo-600" />
                Event Photos
              </label>

              <p className="mb-3 text-xs text-slate-500">
                Upload up to 10 JPEG, PNG, or WebP images. Maximum 8 MB per
                image.
              </p>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageSelection}
                disabled={saving || selectedImages.length >= 10}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {imagePreviews.map((image, index) => (
                  <div
                    key={`${image.file.name}-${index}`}
                    className="relative overflow-hidden rounded-lg border border-slate-200"
                  >
                    <Image
                      src={image.url}
                      alt={image.file.name}
                      width={300}
                      height={300}
                      className="h-28 w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => removeSelectedImage(index)}
                      disabled={saving}
                      aria-label={`Remove ${image.file.name}`}
                      className="absolute right-1 top-1 rounded-full bg-white p-1 text-red-600 shadow hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <p className="truncate px-2 py-1 text-[10px] text-slate-600">
                      {image.file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Dates and Location */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Event Start
              </label>
                <input
                    type="datetime-local"
                    min={getIndiaDateTimeLocal()}
                    value={eventDate}
                    onChange={(e) => {
                        setEventDate(e.target.value);

                        if (
                        e.target.value &&
                        endDate &&
                        endDate < e.target.value
                        ) {
                        setEndDate("");
                        }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Event End
              </label>

              <input
                type="datetime-local"
                value={endDate}
                min={eventDate || getIndiaDateTimeLocal()}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Location
              </label>

              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Event venue or meeting link"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Announcement Expiry (optional)
              </label>
              <input
                type="datetime-local"
                min={getIndiaDateTimeLocal()}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {editingEventId ? "Cancel" : "Clear"}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />

              {saving
                ? "Saving..."
                : editingEventId
                  ? status === "published"
                    ? "Save & Publish"
                    : "Save Changes"
                  : status === "published"
                    ? "Publish"
                    : "Save Draft"}
            </button>
          </div>
        </form>
      )}

      {/* Error Message */}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Success Message */}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      )}

      {/* Existing Events Tab */}
      {activeTab === "existing" && !editingEventId && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="font-bold text-slate-900">Existing Events</h3>

            <p className="mt-1 text-xs text-slate-500">
              Drafts and published events currently stored in the system.
            </p>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading events...</p>
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No events yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Create your first event or announcement.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <PlusCircle className="h-4 w-4" />
                Create Event
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  {/* Left Side: Event Details */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                          item.event_type === "emergency_announcement"
                            ? "bg-red-100 text-red-700"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {item.event_type === "emergency_announcement"
                          ? "Emergency Announcement"
                          : "Normal Event"}
                      </span>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">
                        {item.status}
                      </span>
                    </div>

                    <h4 className="font-semibold text-slate-900">
                      {item.title}
                    </h4>

                    {item.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                        {item.description}
                      </p>
                    )}

                    {item.media && item.media.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {item.media.map((image) => (
                          <a
                            key={image.id}
                            href={image.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg border border-slate-200"
                          >
                            <Image
                              src={image.image_url}
                              alt={image.alt_text || item.title}
                              width={300}
                              height={150}
                              className="h-28 w-full object-cover transition-transform hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(item.event_date)}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                  </div>

                  {/* Right Side: Action Buttons */}
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      disabled={saving}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    {item.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => {
                          handleEdit(item);
                          setStatus("published");
                        }}
                        disabled={saving}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Publish
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
