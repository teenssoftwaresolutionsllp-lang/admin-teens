"use client";
import { useState, useEffect } from "react";
import {
  ProfileChangeRequest,
  LeaveRequest,
  AttendanceRegularization,
} from "@/lib/types";
import {
  CheckSquare,
  UserCheck,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

interface ApprovalsHubProps {
  initialProfileRequests: ProfileChangeRequest[];
  initialLeaveRequests: LeaveRequest[];
  initialRegularizations: AttendanceRegularization[];
}

type Feedback = {
  msg: string;
  type: "success" | "error";
};

export default function ApprovalsHub({
  initialProfileRequests,
  initialLeaveRequests,
  initialRegularizations,
}: ApprovalsHubProps) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "leaves" | "attendance" | "documents"
  >("profile");

  const [profileRequests, setProfileRequests] =
    useState<ProfileChangeRequest[]>(initialProfileRequests);

  const [profileStatusFilter, setProfileStatusFilter] = useState("all");
  const [profileEmployeeSearch, setProfileEmployeeSearch] = useState("");
  const [profileRequestTypeFilter, setProfileRequestTypeFilter] = useState("all");
  const [profileFromDate, setProfileFromDate] = useState("");
  const [profileToDate, setProfileToDate] = useState("");
  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequest[]>(initialLeaveRequests);

  const [regularizations, setRegularizations] =
    useState<AttendanceRegularization[]>(initialRegularizations);

  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  // Rejection dialog state
  const [profileRejectionReason, setProfileRejectionReason] = useState("");

  const [rejectingRequest, setRejectingRequest] = useState<{
    id: string;
    type: "profile" | "attendance" | "leave";
  } | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Open rejection dialogs
  const openLeaveRejectionDialog = (id: string) => {
    setFeedback(null);
    setProfileRejectionReason("");
    setRejectingRequest({ id, type: "leave" });
  };


  // Profile Request Approval/Rejection.
  const handleProfileReview = async (
    id: string,
    status: "approved" | "rejected",
    rejectionReason?: string
  ) => {
    const reason = rejectionReason?.trim() ?? "";

    if (status === "rejected" && !reason) {
      setFeedback({
        msg: "Please provide a reason for rejecting this profile-change request.",
        type: "error",
      });
      return;
    }

    setActionLoading(id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/profile-change-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          status,
          rejectionReason: status === "rejected" ? reason : null,
          reviewNotes: status === "rejected" ? reason : null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Action failed. Please try again.");
      }

      setProfileRequests((previous) =>
        previous.map((request) =>
          request.id === id ? { ...request, status } : request
        )
      );

      setFeedback({
        msg:
          status === "approved"
            ? "Profile change request approved. Linked supporting documents and profile changes have been reviewed together."
            : "Profile change request rejected.",
        type: "success",
      });

      setRejectingRequest(null);
      setProfileRejectionReason("");
    } catch (error) {
      setFeedback({
        msg:
          error instanceof Error
            ? error.message
            : "Action failed. Please try again.",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Open the rejection dialog for a profile-change request.
  const openProfileRejectionDialog = (id: string) => {
    setFeedback(null);
    setProfileRejectionReason("");
    setRejectingRequest({ id, type: "profile" });
  };

  const openAttendanceRejectionDialog = (id: string) => {
    setFeedback(null);
    setProfileRejectionReason("");
    setRejectingRequest({ id, type: "attendance" });
  };


  const closeProfileRejectionDialog = () => {
    if (rejectingRequest && actionLoading === rejectingRequest.id) {
      return;
    }

    setRejectingRequest(null);
    setProfileRejectionReason("");
  };

  // Leave Request Approval/Rejection.

  const handleLeaveReview = async (
    id: string,
    status: "approved" | "rejected",
    rejectionReason?: string
  ) => {
    const reason = rejectionReason?.trim() ?? "";

    if (status === "rejected" && !reason) {
      setFeedback({
        msg: "Please provide a reason for rejecting this leave request.",
        type: "error",
      });
      return;
    }

    setActionLoading(id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          status,
          rejectionReason: status === "rejected" ? reason : null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Leave review failed.");
      }

      setLeaveRequests((previous) =>
        previous.map((leave) =>
          leave.id === id
            ? {
                ...leave,
                status,
                ...(status === "rejected"
                  ? { rejection_reason: reason }
                  : {}),
              }
            : leave
        )
      );

      setFeedback({
        msg:
          status === "approved"
            ? "Leave request approved. Leave balances updated."
            : "Leave request rejected successfully.",
        type: "success",
      });

      setRejectingRequest(null);
      setProfileRejectionReason("");
    } catch (error) {
      setFeedback({
        msg:
          error instanceof Error ? error.message : "Leave review failed.",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };


  // Attendance Regularization Approval/Rejection.

  const handleRegularizationReview = async (
    id: string,
    status: "approved" | "rejected",
    rejectionReason?: string
  ) => {
    const reason = rejectionReason?.trim() ?? "";

    if (status === "rejected" && !reason) {
      setFeedback({
        msg: "Please provide a reason for rejecting this attendance regularization.",
        type: "error",
      });
      return;
    }

    setActionLoading(id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/attendance/regularization/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          status,
          rejectionReason: status === "rejected" ? reason : null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error || "Attendance regularization review failed."
        );
      }

      setRegularizations((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                ...(status === "rejected"
                  ? { rejection_reason: reason }
                  : {}),
              }
            : item
        )
      );

      setFeedback({
        msg:
          status === "approved"
            ? "Attendance regularization approved."
            : "Attendance regularization rejected successfully.",
        type: "success",
      });

      setRejectingRequest(null);
      setProfileRejectionReason("");
    } catch (error) {
      setFeedback({
        msg:
          error instanceof Error
            ? error.message
            : "Attendance regularization review failed.",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };


  const filteredProfileRequests = profileRequests.filter((request) => {
    const statusMatches =
      profileStatusFilter === "all" ||
      String(request.status ?? "").toLowerCase() === profileStatusFilter;

    const employee = request.employee as
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
      String(employee?.employee_id ?? "")
        .toLowerCase()
        .includes(searchText) ||
      String(employee?.email ?? "").toLowerCase().includes(searchText) ||
      String(request.employee_id ?? "").toLowerCase().includes(searchText);

    const changes = Object.keys(request.requested_changes ?? {}).map((key) =>
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
            return /first_name|last_name|date_of_birth|gender|blood_group|marital_status|phone|email/.test(
              key
            );
          case "employment":
            return /department|project|designation|employment|joining_date|probation|confirmation|reporting_manager|work_location|client_type|company_name|salary/.test(
              key
            );
          default:
            return true;
        }
      });

    const requestDate = request.created_at
      ? new Date(request.created_at)
      : null;

    const fromDate = profileFromDate
      ? new Date(`${profileFromDate}T00:00:00`)
      : null;

    const toDate = profileToDate
      ? new Date(`${profileToDate}T23:59:59.999`)
      : null;

    const dateMatches =
      (!fromDate ||
        (requestDate !== null && requestDate >= fromDate)) &&
      (!toDate || (requestDate !== null && requestDate <= toDate));

    return (
      statusMatches &&
      employeeMatches &&
      requestTypeMatches &&
      dateMatches
    );
  });

  const pendingProfileCount = profileRequests.filter(
    (request) => request.status === "pending"
  ).length;

  const pendingLeaveCount = leaveRequests.filter(
    (request) => request.status === "pending"
  ).length;

  const pendingRegCount = regularizations.filter(
    (request) => request.status === "pending"
  ).length;

  const totalPending =
    pendingProfileCount + pendingLeaveCount + pendingRegCount;


  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:p-7">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
              <CheckSquare className="h-5 w-5" />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              HR Approvals Hub
            </h2>

            {totalPending > 0 && (
              <span className="rounded-full border border-amber-200/60 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                {totalPending} Action Items
              </span>
            )}
          </div>

          <p className="mt-1.5 pl-12 text-xs leading-relaxed text-slate-500">
            Review employee profile changes, leave applications, attendance
            regularizations, and identity or bank document submissions.
          </p>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-xl border p-4 text-xs font-semibold ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Profile request filters */}

      {activeTab === "profile" &&(
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
              onChange={(event) => setProfileStatusFilter(event.target.value)}
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
              onChange={(event) => setProfileEmployeeSearch(event.target.value)}
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
              onChange={(event) =>
                setProfileRequestTypeFilter(event.target.value)
              }
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
              onChange={(event) => setProfileFromDate(event.target.value)}
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
              onChange={(event) => setProfileToDate(event.target.value)}
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
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>
      )}


      {/* Tabs */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-slate-200/80 bg-slate-50/60">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2.5 whitespace-nowrap border-b-2 px-6 py-4 text-xs font-bold transition-all ${
              activeTab === "profile"
                ? "border-indigo-600 bg-white text-indigo-600"
                : "border-transparent text-slate-500 hover:bg-slate-100/50 hover:text-slate-900"
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Profile Change Requests</span>
            {pendingProfileCount > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                {pendingProfileCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("leaves")}
            className={`flex items-center gap-2.5 whitespace-nowrap border-b-2 px-6 py-4 text-xs font-bold transition-all ${
              activeTab === "leaves"
                ? "border-indigo-600 bg-white text-indigo-600"
                : "border-transparent text-slate-500 hover:bg-slate-100/50 hover:text-slate-900"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Leave Applications</span>
            {pendingLeaveCount > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                {pendingLeaveCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center gap-2.5 whitespace-nowrap border-b-2 px-6 py-4 text-xs font-bold transition-all ${
              activeTab === "attendance"
                ? "border-indigo-600 bg-white text-indigo-600"
                : "border-transparent text-slate-500 hover:bg-slate-100/50 hover:text-slate-900"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Attendance Regularizations</span>
            {pendingRegCount > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                {pendingRegCount}
              </span>
            )}
          </button>

        </div>

        {/* Profile Change Requests */}
        {activeTab === "profile" && (
          <div className="p-6">
            {profileRequests.length === 0 ? (
              <p className="py-12 text-center text-xs font-medium text-slate-400">
                No profile change requests found.
              </p>
            ) : filteredProfileRequests.length === 0 ? (
              <p className="py-12 text-center text-xs font-medium text-slate-400">
                No requests match your filters.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredProfileRequests.map((req) => {
                  const emp = req.employee;
                  const isPending = req.status === "pending";

                  const supportingDocuments = (
                    req as ProfileChangeRequest & {
                      supporting_documents?: Array<{
                        id: string;
                        document_type: string;
                        document_name: string;
                        document_url: string;
                        verification_status?: string;
                        profile_change_approved?: boolean;
                        review_notes?: string | null;
                        uploaded_at?: string;
                      }>;
                    }
                  ).supporting_documents ?? [];

                  const fieldSections: Record<string, string> = {
                    first_name: "Personal Information",
                    last_name: "Personal Information",
                    date_of_birth: "Personal Information",
                    gender: "Personal Information",
                    blood_group: "Personal Information",
                    marital_status: "Personal Information",

                    phone: "Contact Information",
                    email: "Contact Information",
                    address: "Contact Information",
                    city: "Contact Information",
                    state: "Contact Information",
                    country: "Contact Information",
                    pincode: "Contact Information",

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

                    bank_name: "Bank & Identity Information",
                    bank_account_number: "Bank & Identity Information",
                    ifsc_code: "Bank & Identity Information",
                    pan_number: "Bank & Identity Information",
                    aadhaar_number: "Bank & Identity Information",

                    pf_eligible: "Statutory Information",
                    pf_number: "Statutory Information",
                    esi_eligible: "Statutory Information",
                    esi_number: "Statutory Information",
                    pt_eligible: "Statutory Information",
                    pt_number: "Statutory Information",
                    tds_eligible: "Statutory Information",

                    emergency_contact_name: "Emergency Contact Information",
                    emergency_contact_phone: "Emergency Contact Information",
                    emergency_contact_relationship: "Emergency Contact Information",
                    emergency_contact_address: "Emergency Contact Information",

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

                  const changes = Object.entries(
                    req.requested_changes ?? {}
                  ).filter(([_, value]) => value !== null && value !== "");

                  const renderFields = (fields: [string, unknown][]) => (
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-white font-bold text-slate-500">
                        <tr>
                          <th className="w-1/2 px-4 py-2.5">
                            Information Type
                          </th>
                          <th className="w-1/2 px-4 py-2.5 text-indigo-700">
                            Employee Detail
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fields.map(([key, value]) => (
                          <tr key={key} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-semibold capitalize text-slate-800">
                              {key.replace(/_/g, " ")}
                            </td>
                            <td className="break-words bg-emerald-50/30 px-4 py-2.5 font-mono font-bold text-emerald-700">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );

                  return (
                    <div
                      key={req.id}
                      className={`rounded-2xl border p-5 transition-all sm:p-6 ${
                        isPending
                          ? "border-amber-200/80 bg-amber-50/30"
                          : "border-slate-200/80 bg-slate-50/50"
                      }`}
                    >
                      <div className="mb-4 flex flex-col justify-between gap-4 border-b border-slate-200/70 pb-4 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h4 className="text-sm font-bold tracking-tight text-slate-900">
                              {emp
                                ? `${emp.first_name} ${emp.last_name}`
                                : "Employee"}
                            </h4>

                            <span className="font-mono text-xs font-medium text-slate-500">
                              ({emp?.employee_id || "TSS"})
                            </span>

                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                req.status === "approved"
                                  ? "border-emerald-200/60 bg-emerald-100 text-emerald-800"
                                  : req.status === "rejected"
                                    ? "border-red-200/60 bg-red-100 text-red-800"
                                    : "border-amber-200/60 bg-amber-100 text-amber-900"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] text-slate-400">
                            Requested on:{" "}
                            {new Date(req.created_at).toLocaleString("en-US", {
                              timeZone: "UTC",
                            })}
                          </p>
                        </div>

                        {isPending && (
                          <div className="flex shrink-0 items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => openProfileRejectionDialog(req.id)}
                              disabled={actionLoading === req.id}
                              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-50 disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleProfileReview(req.id, "approved")
                              }
                              disabled={actionLoading === req.id}
                              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {actionLoading === req.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              Approve & Apply
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Categorized requested changes */}
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
                              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                  {sectionName}
                                </h5>
                              </div>
                              {renderFields(sectionFields)}
                            </div>
                          );
                        })}

                        {changes.some(([key]) => !fieldSections[key]) && (
                          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                              <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                Other Information
                              </h5>
                            </div>
                            {renderFields(
                              changes.filter(([key]) => !fieldSections[key])
                            )}
                          </div>
                        )}
                      </div>

                      {/* Supporting documents */}
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
                                className="flex flex-col justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center"
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
                                    {/* <p className="mt-1 text-[11px] text-slate-500">
                                      Verification status:{" "}
                                      <span className="font-semibold capitalize">
                                        {doc.verification_status}
                                      </span>
                                    </p> */}
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

                                    {String(
                                      doc.verification_status
                                    ).toLowerCase() === "rejected" && (
                                      <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                                        <p className="text-[11px] font-bold text-rose-800">
                                          Document rejection reason
                                        </p>
                                        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-rose-700">
                                          {doc.review_notes?.trim() ||
                                            "No rejection reason was recorded for this document."}
                                        </p>
                                      </div>
                                    )}
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

        {/* Leave Applications */}
        {activeTab === "leaves" && (
          <div className="p-6">
            {leaveRequests.length === 0 ? (
              <p className="py-12 text-center text-xs font-medium text-slate-400">
                No leave applications awaiting review.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    <tr>
                      <th className="px-4 py-3.5">Employee</th>
                      <th className="px-4 py-3.5">Leave Type</th>
                      <th className="px-4 py-3.5">Duration</th>
                      <th className="px-4 py-3.5">Dates</th>
                      <th className="px-4 py-3.5">Reason</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaveRequests.map((leave) => {
                      const emp = leave.employee;
                      const isPending = leave.status === "pending";

                      return (
                        <tr
                          key={leave.id}
                          className="transition-colors hover:bg-slate-50/80"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-xs font-bold text-white">
                                {emp?.profile_photo_url ? (
                                  <img
                                    src={emp.profile_photo_url}
                                    alt={`${emp.first_name ?? ""} ${emp.last_name ?? ""}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <>
                                    {emp?.first_name?.charAt(0)?.toUpperCase() ||
                                      "U"}
                                    {emp?.last_name?.charAt(0)?.toUpperCase() ||
                                      ""}
                                  </>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">
                                  {emp
                                    ? `${emp.first_name} ${emp.last_name}`
                                    : "Unknown Employee"}
                                </div>
                                {emp?.employee_id && (
                                  <div className="mt-0.5 font-mono text-[10px] font-medium text-slate-400">
                                    {emp.employee_id}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-700">
                              {leave.leave_type?.name || "Casual Leave"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-medium">
                            {leave.total_days} day(s){" "}
                            {leave.is_half_day && "(Half Day)"}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] font-medium">
                            {leave.start_date} to {leave.end_date}
                          </td>
                          <td className="max-w-xs px-4 py-3.5 text-slate-600">
                            <div className="max-w-xs space-y-1">
                              <p className="break-words">
                                <span className="font-semibold">Application: </span>
                                {leave.reason || "No application reason provided"}
                              </p>

                              {leave.status === "rejected" && (
                                <p className="whitespace-pre-wrap break-words text-rose-700">
                                  <span className="font-semibold">Rejection reason: </span>
                                  {leave.rejection_reason || "No rejection reason recorded"}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                leave.status === "approved"
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                                  : leave.status === "rejected"
                                    ? "border-red-200 bg-red-100 text-red-800"
                                    : "border-amber-200 bg-amber-100 text-amber-900"
                              }`}
                            >
                              {leave.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openLeaveRejectionDialog(leave.id)}
                                  disabled={actionLoading === leave.id}
                                  title="Reject"
                                  className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleLeaveReview(leave.id, "approved")
                                  }
                                  disabled={actionLoading === leave.id}
                                  title="Approve"
                                  className="rounded-lg border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  {actionLoading === leave.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">
                                Processed
                              </span>
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

        {/* Attendance Regularizations */}
        {activeTab === "attendance" && (
          <div className="p-6">
            {regularizations.length === 0 ? (
              <p className="py-12 text-center text-xs font-medium text-slate-400">
                No attendance regularization requests.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    <tr>
                      <th className="px-4 py-3.5">Employee</th>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 py-3.5">Proposed Timings</th>
                      <th className="px-4 py-3.5">Explanation / Reason</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {regularizations.map((regularization) => {
                      const emp = regularization.employee;
                      const isPending = regularization.status === "pending";

                      return (
                        <tr
                          key={regularization.id}
                          className="transition-colors hover:bg-slate-50/80"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-xs font-bold text-white">
                                {emp?.profile_photo_url ? (
                                  <img
                                    src={emp.profile_photo_url}
                                    alt={`${emp.first_name ?? ""} ${emp.last_name ?? ""}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <>
                                    {emp?.first_name?.charAt(0)?.toUpperCase() ||
                                      "U"}
                                    {emp?.last_name?.charAt(0)?.toUpperCase() ||
                                      ""}
                                  </>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">
                                  {emp
                                    ? `${emp.first_name} ${emp.last_name}`
                                    : "Unknown Employee"}
                                </div>
                                {emp?.employee_id && (
                                  <div className="mt-0.5 font-mono text-[10px] font-medium text-slate-400">
                                    {emp.employee_id}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-semibold text-slate-800">
                            {regularization.attendance_date}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-medium text-indigo-700">
                            {regularization.proposed_check_in} -{" "}
                            {regularization.proposed_check_out}
                          </td>
                          <td className="max-w-sm px-4 py-3.5 text-slate-600">
                            {regularization.reason}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                regularization.status === "approved"
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                                  : regularization.status === "rejected"
                                    ? "border-red-200 bg-red-100 text-red-800"
                                    : "border-amber-200 bg-amber-100 text-amber-900"
                              }`}
                            >
                              {regularization.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openAttendanceRejectionDialog(regularization.id)}
                                  disabled={actionLoading === regularization.id}
                                  title="Reject"
                                  className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                                 
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleRegularizationReview(
                                      regularization.id,
                                      "approved"
                                    )
                                  }
                                  disabled={actionLoading === regularization.id}
                                  title="Approve"
                                  className="rounded-lg border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  {actionLoading === regularization.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400">
                                Processed
                              </span>
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

      </div>
      {/* Shared rejection dialog: Profile Change + Attendance Regularization */}
    
      {rejectingRequest && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeProfileRejectionDialog();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="rejection-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
                <XCircle className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h3
                  id="rejection-dialog-title"
                  className="text-base font-bold text-slate-900"
                >
                  {rejectingRequest.type === "profile"
                    ? "Reject profile-change request"
                    : rejectingRequest.type === "attendance"
                      ? "Reject attendance regularization"
                      : "Reject leave request"}
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Enter a reason for rejecting this request. The reason will be
                  submitted with the review.
                </p>

                {rejectingRequest.type === "profile" &&
                  (() => {
                    const request = profileRequests.find(
                      (item) => item.id === rejectingRequest.id
                    );

                    return (
                      <p className="mt-2 text-xs font-semibold text-slate-700">
                        Employee:{" "}
                        {request?.employee
                          ? `${request.employee.first_name} ${request.employee.last_name}`
                          : request?.employee_id ?? "Unknown Employee"}
                      </p>
                    );
                  })()}

                {rejectingRequest.type === "attendance" &&
                  (() => {
                    const request = regularizations.find(
                      (item) => item.id === rejectingRequest.id
                    );

                    return (
                      <p className="mt-2 text-xs font-semibold text-slate-700">
                        Employee:{" "}
                        {request?.employee
                          ? `${request.employee.first_name} ${request.employee.last_name}`
                          : "Unknown Employee"}
                      </p>
                    );
                  })()}

                {rejectingRequest.type === "leave" &&
                  (() => {
                    const request = leaveRequests.find(
                      (item) => item.id === rejectingRequest.id
                    );

                    return (
                      <p className="mt-2 text-xs font-semibold text-slate-700">
                        Employee:{" "}
                        {request?.employee
                          ? `${request.employee.first_name} ${request.employee.last_name}`
                          : "Unknown Employee"}
                      </p>
                    );
                  })()}
              </div>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();

                const reason = profileRejectionReason.trim();

                if (!reason || !rejectingRequest) {
                  return;
                }

                if (rejectingRequest.type === "profile") {
                  void handleProfileReview(
                    rejectingRequest.id,
                    "rejected",
                    reason
                  );
                } else if (rejectingRequest.type === "attendance") {
                  void handleRegularizationReview(
                    rejectingRequest.id,
                    "rejected",
                    reason
                  );
                } else {
                  void handleLeaveReview(
                    rejectingRequest.id,
                    "rejected",
                    reason
                  );
                }
              }}
            >
              <div>
                <label
                  htmlFor="rejection-reason"
                  className="mb-2 block text-xs font-semibold text-slate-700"
                >
                  Rejection reason <span className="text-rose-600">*</span>
                </label>

                <textarea
                  id="rejection-reason"
                  autoFocus
                  required
                  maxLength={2000}
                  rows={5}
                  value={profileRejectionReason}
                  onChange={(event) =>
                    setProfileRejectionReason(event.target.value)
                  }
                  placeholder={
                    rejectingRequest.type === "profile"
                      ? "Explain why this profile-change request is being rejected..."
                      : rejectingRequest.type === "attendance"
                        ? "Explain why this attendance regularization is being rejected..."
                        : "Explain why this leave request is being rejected..."
                  }
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                />

                <p className="mt-1 text-right text-[11px] text-slate-400">
                  {profileRejectionReason.length}/2000 characters
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeProfileRejectionDialog}
                  disabled={actionLoading === rejectingRequest.id}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    !profileRejectionReason.trim() ||
                    actionLoading === rejectingRequest.id
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading === rejectingRequest.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

    </div>
  );
}
