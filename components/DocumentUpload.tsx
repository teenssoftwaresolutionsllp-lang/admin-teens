"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeeDocument } from "@/lib/types";
import { Upload, FileText, Trash2, Download, Eye, Loader2 } from "lucide-react";

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
    // Implement delete logic against your API
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
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50">
          <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-full max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {docTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="w-full max-w-xs">
            <label htmlFor="document-name" className="block text-sm font-medium text-slate-700 mb-1">
              Document Name <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="document-name"
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Defaults to the file name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              disabled={isUploading}
            />
          </div>

            <label className="flex flex-col items-center justify-center w-full max-w-xs h-32 px-4 transition bg-white border-2 border-slate-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-400 focus:outline-none">
              <span className="flex items-center space-x-2">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-slate-500" />
                )}
                <span className="font-medium text-slate-600">
                  {isUploading ? "Uploading..." : "Click to upload"}
                </span>
              </span>
              <span className="text-xs text-slate-500 mt-2">PDF, PNG, JPG up to 5MB</span>
              <input type="file" name="file_upload" className="hidden" accept=".pdf,image/*" onChange={handleFileChange} disabled={isUploading} />
            </label>
          </div>
          {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
        </div>
      )}

      {/* Document List */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-900">Uploaded Documents ({documents.length})</h4>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{doc.document_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {doc.document_type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={doc.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-slate-400 hover:text-indigo-600 transition"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  <a
                    href={doc.document_url}
                    download
                    className="p-2 text-slate-400 hover:text-indigo-600 transition"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-slate-400 hover:text-red-600 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
