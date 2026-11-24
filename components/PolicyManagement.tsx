"use client";

import { useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Archive,
  X,
  FileText,
  CalendarDays,
  ShieldCheck,
  Tag,
  AlignLeft,
  Save,
  Send,
  Loader2,
  Eye,
  Download,
  Paperclip,
} from "lucide-react";

interface Policy {
  id: string;
  title: string;
  category: string;
  description: string | null;
  effective_date: string | null;
  status: "Active" | "Inactive" | "Draft";
  document_url?: string | null;
  cloudinary_public_id?: string | null;
  cloudinary_resource_type?: string | null;
  document_name?: string | null;
  document_content_type?: string | null;
}

interface PolicyManagementProps {
  initialPolicies: Policy[];
}

interface UploadedDocument {
  cloudinary_public_id: string;
  cloudinary_resource_type: string;
  document_name: string;
  document_content_type: string;
  document_url: null;
}

const CATEGORIES = [
  "General",
  "HR",
  "Leave",
  "Attendance",
  "Payroll",
  "Benefits",
  "Performance",
  "Recruitment",
  "Training",
  "Workplace",
  "Remote Work",
  "IT",
  "Security",
  "Code of Conduct",
  "Travel",
  "Separation",
  "Grievance",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function PolicyManagement({
  initialPolicies,
}: PolicyManagementProps) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [status, setStatus] =
    useState<"Active" | "Inactive" | "Draft">("Active");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle("");
    setCategory("General");
    setDescription("");
    setEffectiveDate("");
    setStatus("Active");
    setSelectedFile(null);
    setEditingPolicy(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (policy: Policy) => {
    setEditingPolicy(policy);
    setTitle(policy.title);
    setCategory(policy.category);
    setDescription(policy.description || "");
    setEffectiveDate(policy.effective_date || "");
    setStatus(policy.status);
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setShowForm(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setShowForm(false);
    resetForm();
  };

  const uploadDocument = async (): Promise<UploadedDocument | null> => {
    if (!selectedFile) return null;

    const formData = new FormData();
    formData.append("file", selectedFile);

    const response = await fetch("/api/policies/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Document upload failed.");
    }

    return result.document as UploadedDocument;
  };

  const savePolicy = async () => {
    if (!title.trim()) {
      alert("Policy title is required.");
      return;
    }

    if (!description.trim()) {
      alert("Policy description is required.");
      return;
    }

    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE) {
        alert("Maximum document size is 10 MB.");
        return;
      }

      const extension =
        selectedFile.name.split(".").pop()?.toLowerCase();

      if (!["pdf", "doc", "docx"].includes(extension || "")) {
        alert("Only PDF, DOC and DOCX files are allowed.");
        return;
      }
    }

    try {
      setIsSaving(true);

      // Upload only when the user saves the policy.
      const uploadedDocument = await uploadDocument();

      const existingDocument =
        editingPolicy && !uploadedDocument
          ? {
              cloudinary_public_id:
                editingPolicy.cloudinary_public_id || null,
              cloudinary_resource_type:
                editingPolicy.cloudinary_resource_type || "raw",
              document_name:
                editingPolicy.document_name || null,
              document_content_type:
                editingPolicy.document_content_type || null,
              document_url:
                editingPolicy.document_url || null,
            }
          : {};

      const payload = {
        title: title.trim(),
        category,
        description: description.trim(),
        effective_date: effectiveDate || null,
        status,
        ...(uploadedDocument || existingDocument),
      };

      const response = await fetch("/api/policies", {
        method: editingPolicy ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingPolicy
            ? { id: editingPolicy.id, ...payload }
            : payload
        ),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save policy.");
      }

      if (editingPolicy) {
        setPolicies((previous) =>
          previous.map((policy) =>
            policy.id === editingPolicy.id
              ? result.policy
              : policy
          )
        );
      } else {
        setPolicies((previous) => [
          result.policy,
          ...previous,
        ]);
      }

      setShowForm(false);
      resetForm();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to save policy."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const archivePolicy = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to archive this policy? It will no longer be visible to employees, but its history and document will be preserved."
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/policies", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to archive policy.");
      }

      setPolicies((previous) =>
        previous.map((policy) =>
          policy.id === id ? result.policy : policy
        )
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to archive policy."
      );
    }
  };

  const getDocumentUrl = (policy: Policy) =>
    `/api/policies/${policy.id}/document`;

  return (
    <div className="min-h-full space-y-7">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span>HRMS</span>
              <span>/</span>
              <span>Policies</span>
            </div>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Policies
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage company policies and guidelines
            </p>
          </div>
        </div>

        {!showForm && (
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Add Policy
          </button>
        )}
      </div>

      {/* ADD / EDIT FORM */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingPolicy ? "Edit Policy" : "Add Policy"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {editingPolicy
                    ? "Update the policy details"
                    : "Create a new company policy"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={isSaving}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* TITLE */}
              <div className="md:col-span-2">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  Policy Title <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <FileText className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={200}
                    placeholder="e.g. Leave Policy, Code of Conduct"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
              </div>

              {/* CATEGORY */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  Category <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-10 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* EFFECTIVE DATE */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  Effective Date
                </label>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(event) =>
                      setEffectiveDate(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
              </div>

              {/* DESCRIPTION */}
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    Policy Description
                    <span className="text-red-500">*</span>
                  </label>

                  <span className="text-xs text-slate-400">
                    {description.length}/2000
                  </span>
                </div>

                <div className="relative">
                  <AlignLeft className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value.slice(0, 2000))
                    }
                    rows={7}
                    placeholder="Enter policy description, key points and details..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
              </div>

              {/* STATUS */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  Status <span className="text-red-500">*</span>
                </label>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value as
                        | "Active"
                        | "Inactive"
                        | "Draft"
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                >
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* STATUS INFO */}
              <div className="flex items-end">
                <div className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      status === "Active"
                        ? "bg-emerald-500"
                        : status === "Draft"
                          ? "bg-amber-500"
                          : "bg-slate-400"
                    }`}
                  />

                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {status === "Active"
                        ? "Policy is currently active"
                        : status === "Draft"
                          ? "Policy is saved as draft"
                          : "Policy is currently inactive"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      You can change the status later.
                    </p>
                  </div>
                </div>
              </div>

              {/* POLICY DOCUMENT */}
              <div className="md:col-span-2">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  Policy Document
                  <span className="font-normal text-slate-400">
                    (Optional)
                  </span>
                </label>

                {editingPolicy?.document_name && !selectedFile && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-5 w-5 shrink-0 text-indigo-600" />
                      <span className="truncate text-sm font-medium text-slate-700">
                        {editingPolicy.document_name}
                      </span>
                    </div>

                    <a
                      href={getDocumentUrl(editingPolicy)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      View current document
                    </a>
                  </div>
                )}

                <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/30">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                    <FileText className="h-6 w-6 text-indigo-600" />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {selectedFile
                      ? selectedFile.name
                      : editingPolicy?.document_name
                        ? "Replace Policy Document"
                        : "Upload Policy Document"}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Drag and drop your file here, or click to browse
                  </p>

                  <p className="mt-2 text-[11px] text-slate-400">
                    Supported formats: PDF, DOC, DOCX • Max size: 10MB
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;

                      if (file && file.size > MAX_FILE_SIZE) {
                        alert("Maximum document size is 10 MB.");
                        event.target.value = "";
                        setSelectedFile(null);
                        return;
                      }

                      setSelectedFile(file);
                    }}
                  />
                </label>

                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Remove selected file
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* FORM FOOTER */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeForm}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="button"
              onClick={savePolicy}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {selectedFile ? "Uploading & Saving..." : "Saving..."}
                </>
              ) : editingPolicy ? (
                <>
                  <Save className="h-4 w-4" />
                  Update Policy
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Add Policy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* POLICY LIST */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="font-bold text-slate-900">
              Company Policies List
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {policies.length}{" "}
              {policies.length === 1 ? "policy" : "policies"}
            </p>
          </div>

          {!showForm && (
            <button
              type="button"
              onClick={openAddForm}
              className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:flex"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Policy
            </button>
          )}
        </div>

        {policies.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
              <FileText className="h-7 w-7 text-slate-300" />
            </div>

            <h3 className="mt-5 font-bold text-slate-800">
              No policies added
            </h3>

            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Create your first company policy to start managing HR guidelines.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="group flex flex-col gap-4 px-6 py-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                      <FileText className="h-4 w-4 text-indigo-600" />
                    </div>

                    <h3 className="font-bold text-slate-900">
                      {policy.title}
                    </h3>

                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-600">
                      {policy.category}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 pl-12 text-xs text-slate-500">
                    {policy.effective_date && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Effective: {policy.effective_date}
                      </span>
                    )}

                    <span
                      className={`rounded-full px-2.5 py-1 font-bold ${
                        policy.status === "Active"
                          ? "bg-emerald-50 text-emerald-600"
                          : policy.status === "Draft"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {policy.status}
                    </span>
                  </div>

                  {policy.description && (
                    <p className="mt-2 line-clamp-2 max-w-3xl pl-12 text-sm leading-5 text-slate-500">
                      {policy.description}
                    </p>
                  )}

                  {policy.document_name && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 pl-12">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="max-w-xs truncate">
                          {policy.document_name}
                        </span>
                      </span>

                      <a
                        href={getDocumentUrl(policy)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 transition hover:text-indigo-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </a>

                      <a
                        href={getDocumentUrl(policy)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 transition hover:text-slate-900"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  )}
                </div>

                {/* ACTIONS */}
                <div className="flex shrink-0 items-center gap-1 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => openEditForm(policy)}
                    className="rounded-lg p-2.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                    title="Edit Policy"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  {policy.status !== "Inactive" && (
                    <button
                      type="button"
                      onClick={() => archivePolicy(policy.id)}
                      className="rounded-lg p-2.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-700"
                      title="Archive Policy"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
