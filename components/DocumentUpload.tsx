"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { EmployeeDocument } from "@/lib/types";
import { Upload, FileText, Trash2, Download, Eye, Loader2, EyeOff, Copy, Landmark } from "lucide-react";

interface DocumentUploadProps {
  employeeId?: string;
  documents: EmployeeDocument[];
  onUpload?: (doc: EmployeeDocument) => void;
  canUpload?: boolean;
}

export default function DocumentUpload({ employeeId, documents: initialDocs, onUpload, canUpload = true }: DocumentUploadProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<EmployeeDocument[]>(initialDocs);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("Resume");
  const [documentName, setDocumentName] = useState("");
  const [revealedNumbers, setRevealedNumbers] = useState<Record<string, boolean>>({});


  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      if (!employeeId) {
        setDocuments(initialDocs);
        return;
      }

      try {
        const response = await fetch(
          `/api/documents?employee_id=${encodeURIComponent(employeeId)}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          console.error(
            "Failed to load documents:",
            await response.text()
          );
          setDocuments(initialDocs);
          return;
        }

        const result = await response.json();

        if (!cancelled && Array.isArray(result.documents)) {
          setDocuments(result.documents);
        }
      } catch (error) {
        console.error("Error loading documents:", error);

        if (!cancelled) {
          setDocuments(initialDocs);
        }
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [employeeId, initialDocs]);

  const docTypes = [
    "10th Certificate",
    "12th Certificate",
    "Graduation Certificate",
    "Post-Graduation Certificate",
    "Bank Passbook",
    "Experience Letter",
    "Relieving Letter",
    "Offer Letter",
    "Resume",
    "Aadhar Card",
    "PAN Card",
    "Passport",
    "Other"
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5MB limit");
      return;
    }

    if (!employeeId) {
      setError("Employee ID is required to upload documents");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const trimmedDocumentName = documentName.trim() || file.name;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", docType);
      formData.append("document_name", trimmedDocumentName);
      formData.append("employee_id", employeeId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (!data.document) throw new Error("Document was uploaded but not saved");

      const newDoc = data.document as EmployeeDocument;
      setDocuments((prev) => {
        const exists = prev.some((doc) => doc.id === newDoc.id);
          // Existing document was replaced
        if (exists) {
          return prev.map((doc) =>doc.id === newDoc.id ? newDoc : doc);
        }

        const multipleTypes = ["Experience Letter","Other",];

        if (!multipleTypes.includes(newDoc.document_type)) {
          return [
            ...prev.filter(
              (doc) =>doc.document_type !== newDoc.document_type
            ),
            newDoc,
          ];
        }
        // Multiple-document types
        return [...prev, newDoc];
      });
      if (onUpload) onUpload(newDoc);
      setDocumentName("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      e.target.value = ""; // reset file input
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to delete file");
    }
  };

  return (
    <div className="space-y-6">
      {canUpload && (
        <div className="bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-2xl p-6 sm:p-7">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold bg-white text-slate-800 shadow-sm focus:outline-none focus:border-indigo-500"
                >
                  {docTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="document-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Custom Label <span className="font-normal text-slate-400 normal-case">(optional)</span>
                </label>
                <input
                  id="document-name"
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Defaults to filename"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold bg-white text-slate-800 shadow-sm focus:outline-none focus:border-indigo-500"
                  disabled={isUploading}
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
                {isUploading ? "Uploading Document..." : "Choose Document to Upload"}
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">Supports PDF, PNG, JPG files up to 5MB</span>
              <input type="file" name="file_upload" className="hidden" accept=".pdf,image/*" onChange={handleFileChange} disabled={isUploading} />
            </label>
          </div>
          {error && <p className="mt-3 text-xs font-bold text-rose-600 text-center">{error}</p>}
        </div>
      )}

      {/* Document List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Verified Documents ({documents.length})
          </h4>
        </div>
        {documents.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-slate-100">
            <p className="text-xs text-slate-400 font-medium">No documents uploaded yet for this employee record.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">

            {documents.map((doc, index) => (
              <div
                key={`${doc.id}-${index}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {doc.document_name}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {doc.document_type}
                      </span>

                      {[
                        {
                          label: "Aadhaar",
                          value: doc.aadhaar_number,
                          key: `${doc.id}-aadhaar`,
                        },
                        {
                          label: "PAN",
                          value: doc.pan_number,
                          key: `${doc.id}-pan`,
                        },
                        {
                          label: "Passport",
                          value: doc.passport_number,
                          key: `${doc.id}-passport`,
                        },
                      ]
                        .filter((field) => Boolean(field.value))
                        .map((field) => {
                          const value = String(field.value);
                          const isRevealed = Boolean(revealedNumbers[field.key]);

                          const maskedValue =
                            value.length > 4
                              ? `${"*".repeat(value.length - 4)}${value.slice(-4)}`
                              : "*".repeat(value.length);

                          return (
                            <span
                              key={field.key}
                              className="inline-flex max-w-full items-center gap-1 rounded-md border border-green-100 bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700"
                            >
                              <span>{field.label}:</span>

                              <span className="break-all">
                                {isRevealed ? value : maskedValue}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedNumbers((previous) => ({
                                    ...previous,
                                    [field.key]: !previous[field.key],
                                  }))
                                }
                                className="shrink-0 rounded p-1 hover:bg-green-100"
                                title={isRevealed ? "Hide number" : "Reveal number"}
                                aria-label={`${isRevealed ? "Hide" : "Reveal"} ${field.label}`}
                              >
                                {isRevealed ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(value);
                                    toast.success(`${field.label} number copied`);
                                  } catch {
                                    toast.error(
                                      "Could not copy. Check browser clipboard permissions."
                                    );
                                  }
                                }}
                                className="shrink-0 rounded p-1 hover:bg-green-100"
                                title={`Copy ${field.label}`}
                                aria-label={`Copy ${field.label}`}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}

                      {doc.document_type === "Bank Passbook" && (
                        <div className="mt-3 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80">
                          {/* Section heading */}
                          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                              <Landmark className="h-4 w-4" />
                            </div>

                            <span className="text-xs font-bold text-slate-800">
                              Bank Details
                            </span>

                            <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                              Available
                            </span>
                          </div>

                          {/* Three aligned columns */}
                          <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            {/* Bank name */}
                            <div className="min-w-0 px-4 py-3">
                              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                Bank Name
                              </p>

                              <p className="break-words text-xs font-bold text-slate-800">
                                {doc.bank_name || "Not available"}
                              </p>
                            </div>

                            {/* Account number */}
                            <div className="min-w-0 px-4 py-3">
                              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                Account Number
                              </p>

                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="min-w-0 flex-1 break-all font-mono text-xs font-bold text-slate-800">
                                  {doc.bank_account_number
                                    ? revealedNumbers[`${doc.id}-bank-account`]
                                      ? doc.bank_account_number
                                      : `•••• •••• ${doc.bank_account_number.slice(-4)}`
                                    : "Not available"}
                                </p>

                                {doc.bank_account_number && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRevealedNumbers((previous) => ({
                                          ...previous,
                                          [`${doc.id}-bank-account`]:
                                            !previous[`${doc.id}-bank-account`],
                                        }))
                                      }
                                      className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-white hover:text-indigo-600"
                                      title={
                                        revealedNumbers[`${doc.id}-bank-account`]
                                          ? "Hide account number"
                                          : "Reveal account number"
                                      }
                                      aria-label="Toggle account number visibility"
                                    >
                                      {revealedNumbers[`${doc.id}-bank-account`] ? (
                                        <EyeOff className="h-3.5 w-3.5" />
                                      ) : (
                                        <Eye className="h-3.5 w-3.5" />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(
                                            doc.bank_account_number!
                                          );
                                          toast.success("Account number copied");
                                        } catch {
                                          toast.error("Could not copy account number");
                                        }
                                      }}
                                      className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-white hover:text-indigo-600"
                                      title="Copy account number"
                                      aria-label="Copy account number"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div> 
                            {/* IFSC */}
                            <div className="min-w-0 px-4 py-3">
                              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                IFSC Code
                              </p>

                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="min-w-0 flex-1 break-all font-mono text-xs font-bold text-slate-800">
                                  {doc.ifsc_code
                                    ? revealedNumbers[`${doc.id}-ifsc`]
                                      ? doc.ifsc_code
                                      : `${"*".repeat(Math.max(0, doc.ifsc_code.length - 4))}${doc.ifsc_code.slice(-4)}`
                                    : "Not available"}
                                </p>

                                {doc.ifsc_code && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRevealedNumbers((previous) => ({
                                          ...previous,
                                          [`${doc.id}-ifsc`]: !previous[`${doc.id}-ifsc`],
                                        }))
                                      }
                                      className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-white hover:text-indigo-600"
                                      title={
                                        revealedNumbers[`${doc.id}-ifsc`]
                                          ? "Hide IFSC code"
                                          : "Reveal IFSC code"
                                      }
                                      aria-label={
                                        revealedNumbers[`${doc.id}-ifsc`]
                                          ? "Hide IFSC code"
                                          : "Reveal IFSC code"
                                      }
                                    >
                                      {revealedNumbers[`${doc.id}-ifsc`] ? (
                                        <EyeOff className="h-3.5 w-3.5" />
                                      ) : (
                                        <Eye className="h-3.5 w-3.5" />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(doc.ifsc_code!);
                                          toast.success("IFSC code copied");
                                        } catch {
                                          toast.error("Could not copy IFSC code");
                                        }
                                      }}
                                      className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-white hover:text-indigo-600"
                                      title="Copy IFSC code"
                                      aria-label="Copy IFSC code"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {doc.uploaded_at && (

                        
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="ml-1 flex shrink-0 items-center gap-1">
                  <a
                    href={`/api/documents/${doc.id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                    title="View"
                    aria-label="View document"
                  >
                    <Eye className="h-4 w-4" />
                  </a>

                  <a
                    href={doc.document_url}
                    download
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                    title="Download"
                    aria-label="Download document"
                  >
                    <Download className="h-4 w-4" />
                  </a>

                  {canUpload && (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      title="Delete"
                      aria-label="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
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
