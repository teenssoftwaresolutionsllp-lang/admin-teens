"use client";

import { useState, useEffect } from "react";
import { ProfileChangeRequest, LeaveRequest, AttendanceRegularization } from "@/lib/types";
import {
  CheckSquare,
  UserCheck,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
  FileText,
} from "lucide-react";

interface ApprovalsHubProps {
  initialProfileRequests: ProfileChangeRequest[];
  initialLeaveRequests: LeaveRequest[];
  initialRegularizations: AttendanceRegularization[];
}

interface PendingDocument {
  employee: {
    id: string;
    employee_id: string;
    first_name: string | null;
    last_name: string | null;
    email?: string | null;
    profile_photo_url?: string | null;
    department?: string | null;
    designation?: string | null;
  } | null;
  id: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  profile_photo_url?: string | null;
  document_type: string;
  document_name: string;
  document_url: string;
  verification_status:| "pending" | "verified" | "approved" | "rejected" | "superseded";
  previous_document_id: string | null;
  uploaded_at?: string;
  profile_change_request_id?: string | null;
  profile_change_approved?: boolean;
  bank_name?: string | null;
  bank_account_number?: string | null;
  ifsc_code?: string | null;
  aadhaar_number?: string | null;
  pan_number?: string | null;
  passport_number?: string | null;
}

export default function ApprovalsHub({
  initialProfileRequests,
  initialLeaveRequests,
  initialRegularizations,
}: ApprovalsHubProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "leaves" | "attendance" | "documents">("profile");

  const [profileRequests, setProfileRequests] = useState<ProfileChangeRequest[]>(initialProfileRequests);
  const [profileStatusFilter, setProfileStatusFilter] = useState("all");
  const [profileEmployeeSearch, setProfileEmployeeSearch] = useState("");
  const [profileRequestTypeFilter, setProfileRequestTypeFilter] = useState("all");
  const [profileFromDate, setProfileFromDate] = useState("");
  const [profileToDate, setProfileToDate] = useState("");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(initialLeaveRequests);
  const [regularizations, setRegularizations] = useState<AttendanceRegularization[]>(initialRegularizations);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  //document review notes change handler

  useEffect(() => {
    let cancelled = false;

    const loadPendingDocuments = async () => {
      setDocumentsLoading(true);

      try {
        const response = await fetch("/api/documents/pending", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const responseText = await response.text();

        let result: {
          documents?: PendingDocument[];
          error?: string;
        };

        try {
          result = responseText
            ? JSON.parse(responseText)
            : {};
        } catch {
          throw new Error(
            `Pending documents API returned invalid JSON (HTTP ${response.status}).`
          );
        }

        if (!response.ok) {
          throw new Error(
            result.error ||
              `Failed to load pending documents (HTTP ${response.status}).`
          );
        }

        if (!Array.isArray(result.documents)) {
          throw new Error(
            "Pending documents API did not return a documents array."
          );
        }

        if (!cancelled) {
          setPendingDocuments(result.documents);
          setFeedback(null);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback({
            msg:
              error instanceof Error
                ? error.message
                : "Failed to load pending documents.",
            type: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      }
    };

    loadPendingDocuments();

    return () => {
      cancelled = true;
    };
  }, []);



  // Profile Request Approval/Rejection
  const handleProfileReview = async (id: string, status: "approved" | "rejected") => {
    setActionLoading(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/profile-change-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setProfileRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
        setFeedback({
          
          msg: status === "approved" ? "Profile change request approved. Sensitive fields will be applied only after the required documents are verified." : "Profile change request rejected.",
          type: "success",
        });
      } else {
        const data = await res.json().catch(() => null);
        setFeedback({ msg: data?.error || "Action failed. Please try again.", type: "error" });
      }
    } catch {
      setFeedback({ msg: "Action failed. Please try again.", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // Leave Request Approval/Rejection
  const handleLeaveReview = async (id: string, status: "approved" | "rejected") => {
    setActionLoading(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setLeaveRequests((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status } : l))
        );
        setFeedback({
          msg: `Leave request ${status}. Leave balances updated.`,
          type: "success",
        });
      }
    } catch {
      setFeedback({ msg: "Action failed.", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // Attendance Regularization Approval/Rejection
  const handleRegularizationReview = async (id: string, status: "approved" | "rejected") => {
    setActionLoading(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/attendance/regularization/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setRegularizations((prev) =>
          prev.map((reg) => (reg.id === id ? { ...reg, status } : reg))
        );
        setFeedback({
          msg: `Attendance regularization ${status}. Attendance status marked as Present.`,
          type: "success",
        });
      }
    } catch {
      setFeedback({ msg: "Action failed.", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // Document Regularization Approval/Rejection
  const handleDocumentReview = async (
    id: string,
    decision: "approve" | "reject"
  ) => {
    setActionLoading(id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/documents/${id}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          notes: reviewNotes[id]?.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Document review failed.");
      }

      setPendingDocuments((previous) =>
        previous.map((document) =>
          document.id === id
            ? {
                ...document,
                verification_status:
                  decision === "approve" ? "approved" : "rejected",
              }
            : document
        )
      );

      setReviewNotes((previous) => {
        const updated = { ...previous };
        delete updated[id];
        return updated;
      });

      setFeedback({
        msg:
          decision === "approve"
            ? "Document approved successfully."
            : "Document rejected successfully.",
        type: "success",
      });
    } catch (error) {
      setFeedback({
        msg:
          error instanceof Error
            ? error.message
            : "Document review failed.",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };


  const filteredProfileRequests = profileRequests.filter((req) => {
    const statusMatches =
      profileStatusFilter === "all" ||
      String(req.status ?? "").toLowerCase() === profileStatusFilter;

    const employee = req.employee as
      | {
          first_name?: string | null;
          last_name?: string | null;
          employee_id?: string | null;
          email?: string | null;
        }
      | undefined;

    const employeeName = [
      employee?.first_name,
      employee?.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const searchText = profileEmployeeSearch.trim().toLowerCase();

    const employeeMatches =
      !searchText ||
      employeeName.toLowerCase().includes(searchText) ||
      String(employee?.employee_id ?? "").toLowerCase().includes(searchText) ||
      String(employee?.email ?? "").toLowerCase().includes(searchText) ||
      String(req.employee_id ?? "").toLowerCase().includes(searchText);

    const changes = Object.keys(req.requested_changes ?? {}).map((key) =>
      key.toLowerCase()
    );

    const requestTypeMatches =
      profileRequestTypeFilter === "all" ||
      changes.some((key) => {
        switch (profileRequestTypeFilter) {
          case "identity":
            return /aadhaar|aadhar|pan|passport/.test(key);
          case "bank":
            return /bank|account|ifsc|passbook/.test(key);
          case "address":
            return /address|city|state|country|pincode|postal/.test(key);
          case "personal":
            return /first_name|last_name|date_of_birth|gender|blood_group|marital_status|phone|email/.test(key);
          case "employment":
            return /department|project|designation|employment|joining_date|probation|confirmation|reporting_manager|work_location|client_type|company_name|salary/.test(key);
          default:
            return true;
        }
      });

    const requestDate = req.created_at
      ? new Date(req.created_at)
      : null;

    const fromDate = profileFromDate
      ? new Date(`${profileFromDate}T00:00:00`)
      : null;

    const toDate = profileToDate
      ? new Date(`${profileToDate}T23:59:59.999`)
      : null;

    const dateMatches =
      (!fromDate || (requestDate !== null && requestDate >= fromDate)) &&
      (!toDate || (requestDate !== null && requestDate <= toDate));

    return (
      statusMatches &&
      employeeMatches &&
      requestTypeMatches &&
      dateMatches
    );
  });

    

  const pendingProfileCount = profileRequests.filter((r) => r.status === "pending").length;
  const pendingLeaveCount = leaveRequests.filter((r) => r.status === "pending").length;
  const pendingRegCount = regularizations.filter((r) => r.status === "pending").length;
  const pendingDocumentCount = pendingDocuments.length;
  const totalPending = pendingProfileCount + pendingLeaveCount + pendingRegCount + pendingDocumentCount;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">HR Approvals Hub</h2>
            {totalPending > 0 && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200/60 shadow-xs">
                {totalPending} Action Items
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-12">
            Review employee profile changes, leave applications, attendance regularizations, and identity or bank document submissions.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 border shadow-xs animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}


      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">
            Filter Profile Change Requests
          </h3>

          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {filteredProfileRequests.length} of {profileRequests.length} requests
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Status
            </label>
            <select
              value={profileStatusFilter}
              onChange={(e) => setProfileStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Employee
            </label>
            <input
              type="text"
              value={profileEmployeeSearch}
              onChange={(e) => setProfileEmployeeSearch(e.target.value)}
              placeholder="Search name, employee ID or email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Request type
            </label>
            <select
              value={profileRequestTypeFilter}
              onChange={(e) => setProfileRequestTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">All request types</option>
              <option value="identity">Aadhaar, PAN or Passport</option>
              <option value="bank">Bank details</option>
              <option value="address">Address</option>
              <option value="personal">Personal details</option>
              <option value="employment">Employment details</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              From date
            </label>
            <input
              type="date"
              value={profileFromDate}
              max={profileToDate || undefined}
              onChange={(e) => setProfileFromDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              To date
            </label>
            <input
              type="date"
              value={profileToDate}
              min={profileFromDate || undefined}
              onChange={(e) => setProfileToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setProfileStatusFilter("all");
                setProfileEmployeeSearch("");
                setProfileRequestTypeFilter("all");
                setProfileFromDate("");
                setProfileToDate("");
              }}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>


      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200/80 flex overflow-x-auto bg-slate-50/60">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2.5 px-6 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "profile"
                ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Profile Change Requests</span>
            {pendingProfileCount > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 font-bold px-2 py-0.5 rounded-full">
                {pendingProfileCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("leaves")}
            className={`flex items-center gap-2.5 px-6 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "leaves"
                ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Leave Applications</span>
            {pendingLeaveCount > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 font-bold px-2 py-0.5 rounded-full">
                {pendingLeaveCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center gap-2.5 px-6 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "attendance"
                ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Attendance Regularizations</span>
            {pendingRegCount > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 font-bold px-2 py-0.5 rounded-full">
                {pendingRegCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2.5 px-6 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "documents"
                ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Document Verification</span>

            {pendingDocumentCount > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 font-bold px-2 py-0.5 rounded-full">
                {pendingDocumentCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Profile Change Requests (Maker-Checker Diff) */}
        {activeTab === "profile" && (
          <div className="p-6">
            {profileRequests.length === 0 ? (
              <p className="text-center py-12 text-xs font-medium text-slate-400">
                No profile change requests found.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredProfileRequests.map((req) => {
                  const emp = req.employee;
                  const isPending = req.status === "pending";

                  const supportingDocuments = (
                    req as ProfileChangeRequest & {
                      supporting_documents?: PendingDocument[];
                    }
                  ).supporting_documents ?? [];

                  return (
                    <div
                      key={req.id}
                      className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                        isPending
                          ? "bg-amber-50/30 border-amber-200/80 shadow-xs"
                          : "bg-slate-50/50 border-slate-200/80"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/70 pb-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h4 className="font-bold text-slate-900 text-sm tracking-tight">
                              {emp ? `${emp.first_name} ${emp.last_name}` : "Employee"}
                            </h4>
                            <span className="text-xs text-slate-500 font-mono font-medium">
                              ({emp?.employee_id || "TSS"})
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                req.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200/60"
                                  : req.status === "rejected"
                                  ? "bg-red-100 text-red-800 border border-red-200/60"
                                  : "bg-amber-100 text-amber-900 border border-amber-200/60"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Requested on: {new Date(req.created_at).toLocaleString("en-US", {
                              timeZone: "UTC",
                            })}
                          </p>
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2.5 shrink-0">
                            <button
                              onClick={() => handleProfileReview(req.id, "rejected")}
                              disabled={actionLoading === req.id}
                              className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                            <button
                              onClick={() => handleProfileReview(req.id, "approved")}
                              disabled={actionLoading === req.id}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-all hover:shadow"
                            >
                              {actionLoading === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              <span>Approve & Apply</span>
                            </button>
                          </div>
                        )}
                      </div>
                    {/* Categorized Profile Changes */}
                    {(() => {
                      const fieldSections: Record<string, string> = {
                        // Personal Information
                        first_name: "Personal Information",
                        last_name: "Personal Information",
                        date_of_birth: "Personal Information",
                        gender: "Personal Information",
                        blood_group: "Personal Information",
                        marital_status: "Personal Information",

                        // Contact Information
                        phone: "Contact Information",
                        email: "Contact Information",
                        address: "Contact Information",
                        city: "Contact Information",
                        state: "Contact Information",
                        country: "Contact Information",
                        pincode: "Contact Information",

                        // Employment Information
                        employee_id: "Employment Information",
                        department_id: "Employment Information",
                        project_id: "Employment Information",
                        designation: "Employment Information",
                        employment_type: "Employment Information",
                        joining_date: "Employment Information",
                        probation_duration: "Employment Information",
                        probation_end_date: "Employment Information",
                        confirmation_date: "Employment Information",
                        reporting_manager: "Employment Information",
                        work_location: "Employment Information",
                        client_type: "Employment Information",
                        company_name: "Employment Information",
                        salary: "Employment Information",
                        status: "Employment Information",

                        // Bank & Identity Information
                        bank_name: "Bank & Identity Information",
                        bank_account_number: "Bank & Identity Information",
                        ifsc_code: "Bank & Identity Information",
                        pan_number: "Bank & Identity Information",
                        aadhaar_number: "Bank & Identity Information",

                        // Statutory Information
                        pf_eligible: "Statutory Information",
                        pf_number: "Statutory Information",
                        esi_eligible: "Statutory Information",
                        esi_number: "Statutory Information",
                        pt_eligible: "Statutory Information",
                        pt_number: "Statutory Information",
                        tds_eligible: "Statutory Information",

                        // Emergency Contact Information
                        emergency_contact_name: "Emergency Contact Information",
                        emergency_contact_phone: "Emergency Contact Information",
                        emergency_contact_relationship: "Emergency Contact Information",
                        emergency_contact_address: "Emergency Contact Information",

                        // Documents
                        profile_photo: "Documents",
                        aadhaar_document: "Documents",
                        pan_document: "Documents",
                        bank_document: "Documents",
                        address_proof: "Documents",
                        educational_documents: "Documents",
                        experience_documents: "Documents",
                      };

                      const sectionOrder = [
                        "Personal Information",
                        "Contact Information",
                        "Employment Information",
                        "Bank & Identity Information",
                        "Statutory Information",
                        "Emergency Contact Information",
                        "Documents",
                      ];

                      const changes = Object.entries(req.requested_changes).filter(
                        ([_, v]) => v !== null && v !== ""
                      );

                      return (
                        <div className="space-y-5">
                          {sectionOrder.map((sectionName) => {
                            const sectionFields = changes.filter(
                              ([key]) => fieldSections[key] === sectionName
                            );

                            if (sectionFields.length === 0) return null;

                            return (
                              <div
                                key={sectionName}
                                className="overflow-hidden rounded-xl border border-slate-200/80 bg-white"
                              >
                                {/* Section Heading */}
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                    {sectionName}
                                  </h5>
                                </div>

                                {/* Fields */}
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-white text-slate-500 font-bold border-b border-slate-100">
                                    <tr>
                                      <th className="py-2.5 px-4 w-1/2">
                                        Information Type
                                      </th>
                                      <th className="py-2.5 px-4 w-1/2 text-indigo-700">
                                        Employee Detail
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody className="divide-y divide-slate-100">
                                    {sectionFields.map(([key, value]) => (
                                      <tr
                                        key={key}
                                        className="hover:bg-slate-50/50 transition-colors"
                                      >
                                        <td className="py-2.5 px-4 font-semibold text-slate-800 capitalize">
                                          {key.replace(/_/g, " ")}
                                        </td>

                                        <td className="py-2.5 px-4 font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                          {String(value)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })}

                          {/* Any fields not included in the categories above */}
                          {changes.some(([key]) => !fieldSections[key]) && (
                            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                  Other Information
                                </h5>
                              </div>

                              <table className="w-full text-xs text-left">
                                <thead className="bg-white text-slate-500 font-bold border-b border-slate-100">
                                  <tr>
                                    <th className="py-2.5 px-4 w-1/2">
                                      Information Type
                                    </th>
                                    <th className="py-2.5 px-4 w-1/2 text-indigo-700">
                                      Employee Detail
                                    </th>
                                  </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                  {changes
                                    .filter(([key]) => !fieldSections[key])
                                    .map(([key, value]) => (
                                      <tr
                                        key={key}
                                        className="hover:bg-slate-50/50 transition-colors"
                                      >
                                        <td className="py-2.5 px-4 font-semibold text-slate-800 capitalize">
                                          {key.replace(/_/g, " ")}
                                        </td>

                                        <td className="py-2.5 px-4 font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                          {String(value)}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Supporting Documents */}
                    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Supporting Documents
                        </h5>

                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                          {supportingDocuments.length} document(s)
                        </span>
                      </div>

                      {supportingDocuments.length === 0 ? (
                        <p className="px-4 py-5 text-xs text-slate-500">
                          No documents are linked to this profile request.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {supportingDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600">
                                  <FileText className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <p className="break-words text-xs font-bold text-slate-900">
                                    {doc.document_name || doc.document_type}
                                  </p>

                                  <p className="mt-1 text-[11px] text-slate-500">
                                    Type: {doc.document_type}
                                  </p>

                                  <p className="mt-1 text-[11px] text-slate-500">
                                    Verification status:{" "}
                                    <span className="font-semibold capitalize">
                                      {doc.verification_status}
                                    </span>
                                  </p>

                                  <p className="mt-1 text-[11px] text-slate-500">
                                    Profile request:{" "}
                                    <span className="font-semibold">
                                      {doc.profile_change_approved
                                        ? "Approved"
                                        : req.status === "rejected"
                                          ? "Rejected"
                                          : req.status === "approved"
                                            ? "Approved — document finalization pending"
                                            : "Pending"}
                                    </span>
                                  </p>
                                </div>
                              </div>

                              <a
                                href={doc.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                              >
                                View Document
                                <ArrowRight className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Leave Applications */}
        {activeTab === "leaves" && (
          <div className="p-6">
            {leaveRequests.length === 0 ? (
              <p className="text-center py-12 text-xs font-medium text-slate-400">
                No leave applications awaiting review.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Leave Type</th>
                      <th className="py-3.5 px-4">Duration</th>
                      <th className="py-3.5 px-4">Dates</th>
                      <th className="py-3.5 px-4">Reason</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaveRequests.map((r) => {
                      console.log("Leave request:", r);
                      console.log("Employee:", r.employee);
                      const emp = r.employee;
                      const isPending = r.status === "pending";

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                                {emp?.profile_photo_url ? (
                                  <img
                                    src={emp.profile_photo_url}
                                    alt={`${emp.first_name ?? ""} ${emp.last_name ?? ""}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <>
                                    {emp?.first_name?.charAt(0)?.toUpperCase() || "U"}
                                    {emp?.last_name?.charAt(0)?.toUpperCase() || ""}
                                  </>
                                )}
                              </div>

                              <div>
                                <div className="font-bold text-slate-900">
                                  {emp ? `${emp.first_name} ${emp.last_name}` : "Unknown Employee"}
                                </div>

                                {emp?.employee_id && (
                                  <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">
                                    {emp.employee_id}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                              {r.leave_type?.name || "Casual Leave"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium">
                            {r.total_days} day(s) {r.is_half_day && "(Half Day)"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] font-medium">
                            {r.start_date} to {r.end_date}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{r.reason}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                r.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : r.status === "rejected"
                                  ? "bg-red-100 text-red-800 border border-red-200"
                                  : "bg-amber-100 text-amber-900 border border-amber-200"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleLeaveReview(r.id, "rejected")}
                                  disabled={actionLoading === r.id}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleLeaveReview(r.id, "approved")}
                                  disabled={actionLoading === r.id}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors"
                                  title="Approve"
                                >
                                  {actionLoading === r.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Processed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Attendance Regularizations */}
        {activeTab === "attendance" && (
          <div className="p-6">
            {regularizations.length === 0 ? (
              <p className="text-center py-12 text-xs font-medium text-slate-400">
                No attendance regularization requests.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Proposed Timings</th>
                      <th className="py-3.5 px-4">Explanation / Reason</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {regularizations.map((reg) => {
                      const emp = reg.employee;
                      const isPending = reg.status === "pending";

                      return (
                        <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                                {emp?.profile_photo_url ? (
                                  <img
                                    src={emp.profile_photo_url}
                                    alt={`${emp.first_name ?? ""} ${emp.last_name ?? ""}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <>
                                    {emp?.first_name?.charAt(0)?.toUpperCase() || "U"}
                                    {emp?.last_name?.charAt(0)?.toUpperCase() || ""}
                                  </>
                                )}
                              </div>

                              <div>
                                <div className="font-bold text-slate-900">
                                  {emp ? `${emp.first_name} ${emp.last_name}` : "Unknown Employee"}
                                </div>

                                {emp?.employee_id && (
                                  <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">
                                    {emp.employee_id}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800 font-mono">
                            {reg.attendance_date}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded">
                            {reg.proposed_check_in} - {reg.proposed_check_out}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-sm">{reg.reason}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                reg.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : reg.status === "rejected"
                                  ? "bg-red-100 text-red-800 border border-red-200"
                                  : "bg-amber-100 text-amber-900 border border-amber-200"
                              }`}
                            >
                              {reg.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleRegularizationReview(reg.id, "rejected")}
                                  disabled={actionLoading === reg.id}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRegularizationReview(reg.id, "approved")}
                                  disabled={actionLoading === reg.id}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors"
                                  title="Approve"
                                >
                                  {actionLoading === reg.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Processed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* Tab 4: Document Verification */}
        {activeTab === "documents" && (
          <div className="p-6">
            {documentsLoading ? (
              <div className="flex justify-center items-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading pending documents...
              </div>
            ) : pendingDocuments.length === 0 ? (
              <p className="text-center py-12 text-xs font-medium text-slate-400">
                No pending document verification requests.
              </p>
            ) : (
              <div className="space-y-4">
                {pendingDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 sm:p-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">
                            {doc.document_type}
                          </h4>
                          <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                            Pending
                          </span>
                          {doc.previous_document_id && (
                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                              Replacement document
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-xs text-slate-600 break-words">
                          {doc.document_name}
                        </p>

                        {/* Employee profile header */}
                        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-sm font-bold text-white">
                            {doc.employee?.profile_photo_url ? (
                              <img
                                src={doc.employee.profile_photo_url}
                                alt={`${doc.employee.first_name ?? ""} ${doc.employee.last_name ?? ""}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <>
                                {doc.employee?.first_name?.charAt(0)?.toUpperCase() || "U"}
                                {doc.employee?.last_name?.charAt(0)?.toUpperCase() || ""}
                              </>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {doc.employee
                                ? `${doc.employee.first_name ?? ""} ${doc.employee.last_name ?? ""}`.trim() ||
                                  "Unknown Employee"
                                : "Unknown Employee"}
                            </p>

                            <p className="mt-0.5 text-[11px] font-mono font-semibold text-indigo-700">
                              {doc.employee?.employee_id || "Employee ID unavailable"}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {[
                                doc.employee?.designation,
                                doc.employee?.department,
                              ]
                                .filter(Boolean)
                                .join(" • ") || "Department and designation unavailable"}
                            </p>
                          </div>
                        </div>

                        {doc.uploaded_at && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Uploaded:{" "}
                            {new Date(doc.uploaded_at).toLocaleString("en-IN")}
                          </p>
                        )}

                        {doc.document_type === "Bank Passbook" && (
                          <div className="mt-3 space-y-1 text-xs text-slate-700">
                            {doc.bank_name && <p>Bank: {doc.bank_name}</p>}
                            {doc.bank_account_number && (
                              <p>
                                Account number:{" "}
                                {"•".repeat(
                                  Math.max(0, doc.bank_account_number.length - 4)
                                )}
                                {doc.bank_account_number.slice(-4)}
                              </p>
                            )}
                            {doc.ifsc_code && <p>IFSC: {doc.ifsc_code
                                ? `${"*".repeat(
                                    Math.max(0, doc.ifsc_code.length - 4)
                                  )}${doc.ifsc_code.slice(-4)}`
                                : "N/A"}</p>}
                            {/* <p>
                              IFSC:{" "}
                              {doc.ifsc_code
                                ? `${"*".repeat(
                                    Math.max(0, doc.ifsc_code.length - 4)
                                  )}${doc.ifsc_code.slice(-4)}`
                                : "N/A"}
                            </p> */}
                          </div>
                        )}
                      </div>

                      <a
                        href={doc.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        View Document
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="mt-5">
                      <label
                        htmlFor={`review-notes-${doc.id}`}
                        className="mb-2 block text-xs font-semibold text-slate-700"
                      >
                        Review notes (optional)
                      </label>

                      <textarea
                        id={`review-notes-${doc.id}`}
                        value={reviewNotes[doc.id] ?? ""}
                        onChange={(event) =>
                          setReviewNotes((previous) => ({
                            ...previous,
                            [doc.id]: event.target.value,
                          }))
                        }
                        maxLength={2000}
                        rows={2}
                        placeholder="Add verification notes or explain why the document is rejected..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => handleDocumentReview(doc.id, "reject")}
                        disabled={actionLoading === doc.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {actionLoading === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Reject
                      </button>

                      <button
                        onClick={() => handleDocumentReview(doc.id, "approve")}
                        disabled={actionLoading === doc.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionLoading === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Approve Document
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
