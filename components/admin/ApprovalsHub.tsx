"use client";

import { useState } from "react";
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
} from "lucide-react";

interface ApprovalsHubProps {
  initialProfileRequests: ProfileChangeRequest[];
  initialLeaveRequests: LeaveRequest[];
  initialRegularizations: AttendanceRegularization[];
}

export default function ApprovalsHub({
  initialProfileRequests,
  initialLeaveRequests,
  initialRegularizations,
}: ApprovalsHubProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "leaves" | "attendance">("profile");

  const [profileRequests, setProfileRequests] = useState<ProfileChangeRequest[]>(initialProfileRequests);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(initialLeaveRequests);
  const [regularizations, setRegularizations] = useState<AttendanceRegularization[]>(initialRegularizations);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);

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
          msg: `Profile request ${status} successfully. Master record updated.`,
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

  const pendingProfileCount = profileRequests.filter((r) => r.status === "pending").length;
  const pendingLeaveCount = leaveRequests.filter((r) => r.status === "pending").length;
  const pendingRegCount = regularizations.filter((r) => r.status === "pending").length;
  const totalPending = pendingProfileCount + pendingLeaveCount + pendingRegCount;

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
            Review and approve employee profile change requests (Maker-Checker workflow), leave applications, and attendance regularizations.
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
                {profileRequests.map((req) => {
                  const emp = req.employee;
                  const isPending = req.status === "pending";

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
                            Requested on: {new Date(req.created_at).toLocaleString()}
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

                      {/* Diff Comparison Table */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                            <tr>
                              <th className="py-2.5 px-4 w-1/3">Field Name</th>
                              <th className="py-2.5 px-4 w-1/3 text-slate-500">Current Value</th>
                              <th className="py-2.5 px-4 w-1/3 text-indigo-700 font-bold">
                                Requested New Value
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {Object.entries(req.requested_changes)
                              .filter(([_, v]) => v !== null && v !== "")
                              .map(([k, v]) => {
                                const prev = (req.previous_values || {})[k] || (emp as any)?.[k] || "—";
                                return (
                                  <tr key={k} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-4 font-semibold text-slate-800 capitalize">
                                      {k.replace(/_/g, " ")}
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-500 font-mono">
                                      {String(prev)}
                                    </td>
                                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                      {String(v)}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
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
                      const emp = r.employee;
                      const isPending = r.status === "pending";

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {emp ? `${emp.first_name} ${emp.last_name}` : "Balaji Marpally"}
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
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {emp ? `${emp.first_name} ${emp.last_name}` : "Balaji Marpally"}
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
      </div>
    </div>
  );
}
