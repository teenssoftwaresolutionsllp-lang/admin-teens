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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Leave Management & Balances</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Track allocated paid leaves, submit leave requests, and see project-specific holiday schedules.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {balances.map((b) => (
          <div
            key={b.id}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                {b.leave_type?.code || "LV"}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Year 2026</span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">{b.leave_type?.name}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{b.leave_type?.description || "Annual quota"}</p>
            </div>

            <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
              <div>
                <span className="text-3xl font-black text-slate-900 font-mono">{b.balance_days}</span>
                <span className="text-xs text-slate-500 font-medium ml-1.5">days left</span>
              </div>
              <div className="text-right text-xs text-slate-500 font-medium">
                <span>Used: <strong className="text-slate-800">{b.used_days}</strong> / </span>
                <span className="font-bold text-slate-700">{b.allocated_days}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* LOP and Country Holiday Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3.5 shadow-xs">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-amber-950 text-sm">Loss of Pay (LOP) Policy</h4>
            <p className="leading-relaxed text-amber-800">
              Leaves taken beyond your allocated balance or marked as Loss of Pay will directly deduct
              from your monthly salary based on the formula:{" "}
              <code className="font-mono font-bold bg-amber-100/90 text-amber-900 px-1.5 py-0.5 rounded">
                (Monthly CTC / Days in Month) × LOP Days
              </code>
              .
            </p>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50/50 rounded-2xl border border-purple-200/80 text-xs text-purple-900 flex items-start gap-3.5 shadow-xs">
          <div className="p-2 bg-purple-100 rounded-xl text-purple-700 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-purple-950 text-sm">
              Project Country Calendar ({project.client_country})
            </h4>
            <p className="leading-relaxed text-purple-800">
              Your holidays are mapped to your active client project{" "}
              <strong className="text-purple-950">{project.name}</strong>. Teams assigned to US or India clients follow their
              respective client timelines and official country gazetted holidays.
            </p>
          </div>
        </div>
      </div>

      {/* Leave Application History */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>My Leave Applications</span>
          </h3>
          <span className="text-xs font-semibold text-slate-400">Past & Upcoming Requests</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Leave Type</th>
                <th className="py-3.5 px-5">From</th>
                <th className="py-3.5 px-5">To</th>
                <th className="py-3.5 px-5">Duration</th>
                <th className="py-3.5 px-5">Reason</th>
                <th className="py-3.5 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No leave requests found. Apply above whenever needed.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-slate-900">
                      {r.leave_type?.name || "Leave"}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-700">{r.start_date}</td>
                    <td className="py-3.5 px-5 font-mono text-slate-700">{r.end_date}</td>
                    <td className="py-3.5 px-5 font-bold text-slate-800">
                      {r.total_days} {r.total_days === 1 ? "day" : "days"} {r.is_half_day && "(Half Day)"}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 max-w-xs truncate">{r.reason}</td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${
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
