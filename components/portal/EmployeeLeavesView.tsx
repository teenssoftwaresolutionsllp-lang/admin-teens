"use client";

import { useState } from "react";
import { Employee, EmployeeLeaveBalance, LeaveRequest, LeaveType, Project } from "@/lib/types";
import { Calendar, Plus, CheckCircle2, AlertTriangle, Loader2, XCircle, Globe } from "lucide-react";

interface EmployeeLeavesViewProps {
  employee: Employee;
  project: Project;
  leaveBalances: EmployeeLeaveBalance[];
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
}

export default function EmployeeLeavesView({
  employee,
  project,
  leaveBalances: initialBalances,
  leaveRequests: initialRequests,
  leaveTypes,
}: EmployeeLeavesViewProps) {
  const [balances] = useState<EmployeeLeaveBalance[]>(initialBalances);
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    leaveTypeId: leaveTypes[0]?.id || "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    isHalfDay: false,
    reason: "",
  });

  const selectedType = leaveTypes.find((lt) => lt.id === formData.leaveTypeId);

  const calculateDays = () => {
    if (formData.isHalfDay) return 0.5;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);

    const totalDays = calculateDays();

    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          leaveTypeId: formData.leaveTypeId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          totalDays,
          isHalfDay: formData.isHalfDay,
          reason: formData.reason,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRequests([data.leaveRequest, ...requests]);
        setIsModalOpen(false);
        setSuccessMsg("Leave application successfully submitted to HR for approval.");
        setFormData({
          leaveTypeId: leaveTypes[0]?.id || "",
          startDate: new Date().toISOString().split("T")[0],
          endDate: new Date().toISOString().split("T")[0],
          isHalfDay: false,
          reason: "",
        });
      }
    } catch (err) {
      console.error("Apply leave error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Leave Management & Balance</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track allocated paid leaves, submit leave requests, and see project-specific holiday schedules.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map((b) => (
          <div
            key={b.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                {b.leave_type?.code || "LV"}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Year 2026</span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 mt-3">{b.leave_type?.name}</h3>

            <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
              <div>
                <span className="text-2xl font-extrabold text-slate-900">{b.balance_days}</span>
                <span className="text-xs text-slate-400 ml-1">remaining</span>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <span>Used: {b.used_days} / </span>
                <span className="font-semibold text-slate-700">{b.allocated_days}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* LOP and Country Holiday Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 mb-0.5">Loss of Pay (LOP) Policy</h4>
            <p>
              Leaves taken beyond your allocated balance or marked as Loss of Pay will directly deduct
              from your monthly salary based on the formula:{" "}
              <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">
                (Monthly CTC / Total Days) × LOP Days
              </code>
              .
            </p>
          </div>
        </div>

        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-800 flex items-start gap-3">
          <Globe className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-purple-900 mb-0.5">
              Project Country Calendar ({project.client_country})
            </h4>
            <p>
              Your holidays are mapped to your active project{" "}
              <strong>{project.name}</strong>. Teams assigned to US or India clients follow their
              respective client timelines and gazetted holiday calendars.
            </p>
          </div>
        </div>
      </div>

      {/* Leave Application History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>My Leave Applications</span>
          </h3>
          <span className="text-xs text-slate-400">Past & Upcoming Requests</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">From</th>
                <th className="py-3 px-4">To</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">
                    No leave requests found. Apply above whenever needed.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {r.leave_type?.name || "Leave"}
                    </td>
                    <td className="py-3 px-4 font-mono">{r.start_date}</td>
                    <td className="py-3 px-4 font-mono">{r.end_date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {r.total_days} {r.total_days === 1 ? "day" : "days"} {r.is_half_day && "(Half Day)"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{r.reason}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          r.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Apply for Leave</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Leave Type</label>
                <select
                  value={formData.leaveTypeId}
                  onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.code}) - {lt.is_paid ? "Paid Leave" : "Unpaid (LOP Deduction)"}
                    </option>
                  ))}
                </select>
                {selectedType && !selectedType.is_paid && (
                  <p className="text-[11px] text-amber-600 mt-1 font-medium">
                    ⚠️ Note: LOP leave directly reduces your monthly net salary.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={formData.isHalfDay}
                  onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="halfDay" className="text-slate-700 font-medium">
                  Applying for Half Day (0.5 day)
                </label>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason for Leave</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Explain the reason for leave"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between text-slate-700">
                <span className="font-medium">Total Duration:</span>
                <span className="font-bold text-sm text-indigo-700">
                  {calculateDays()} {calculateDays() === 1 ? "day" : "days"}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Application</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
