"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeeDocument } from "@/lib/types";
import { Upload, FileText, Trash2, Download, Eye, Loader2, Plus } from "lucide-react";

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

  useEffect(() => {
    setDocuments(initialDocs);
  }, [initialDocs]);

  const docTypes = [
    "10th Certificate",
    "12th Certificate",
    "Graduation Certificate",
    "Post-Graduation Certificate",
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
      setDocuments(prev => [...prev, newDoc]);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{doc.document_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        {doc.document_type}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <a
                    href={doc.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  <a
                    href={doc.document_url}
                    download
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

