"use client";

import { useState } from "react";
import { LeaveType, LeaveRequest, Employee } from "@/lib/types";
import { Calendar, CheckCircle2, Sliders, User } from "lucide-react";
import Link from "next/link";

interface LeaveManagerProps {
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  employees: Employee[];
}

export default function LeaveManager({
  leaveTypes: initialLeaveTypes,
  leaveRequests,
  employees,
}: LeaveManagerProps) {
  const [types, setTypes] = useState<LeaveType[]>(initialLeaveTypes);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleTogglePaid = (id: string) => {
    setTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_paid: !t.is_paid } : t))
    );
    setSuccessMsg("Leave policy updated.");
  };

  const handleUpdateQuota = (id: string, quota: number) => {
    setTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, annual_quota: quota } : t))
    );
    setSuccessMsg("Annual quota updated.");
  };

  const pendingLeaves = leaveRequests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Leave Policies & Quotas</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-11">
            Specify leave categories, set annual quotas, designate paid vs unpaid (LOP) types, and monitor company-wide balances.
          </p>
        </div>

        {pendingLeaves.length > 0 && (
          <Link
            href="/dashboard/approvals"
            className="px-4 py-2.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all shrink-0 flex items-center gap-2 hover:shadow"
          >
            <span>{pendingLeaves.length} Pending Leave Approvals</span>
          </Link>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Leave Types Configuration Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-6 py-4.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Organization Leave Categories</span>
          </h3>
          <span className="text-xs font-medium text-slate-400">HR Customizable</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Leave Name</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Annual Quota (Days)</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Payroll LOP Impact</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.map((type) => (
                <tr key={type.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-5 font-bold text-slate-900">
                    {type.name}
                    <span className="text-[11px] text-slate-400 font-normal block mt-0.5">
                      {type.description}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded inline-block my-3">{type.code}</td>
                  <td className="py-4 px-4">
                    <input
                      type="number"
                      value={type.annual_quota}
                      onChange={(e) => handleUpdateQuota(type.id, Number(e.target.value))}
                      className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-center text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      disabled={type.code === "LOP"}
                    />
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        type.is_paid
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-900 border border-amber-200"
                      }`}
                    >
                      {type.is_paid ? "Paid Leave" : "Unpaid Leave (LOP)"}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {type.is_paid ? (
                      <span className="text-[11px] text-slate-400">No salary deduction</span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                        Deducts 1 day&apos;s salary per day
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right">
                    {type.code !== "LOP" && (
                      <button
                        onClick={() => handleTogglePaid(type.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2.5 py-1 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        Toggle {type.is_paid ? "Unpaid" : "Paid"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Balances Overview */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-6 py-4.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <span>Employee Leave Balances Overview</span>
          </h3>
          <span className="text-xs font-medium text-slate-400">Year 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Employee</th>
                <th className="py-3.5 px-4">Casual Leave (CL)</th>
                <th className="py-3.5 px-4">Sick Leave (SL)</th>
                <th className="py-3.5 px-4">Earned Leave (EL)</th>
                <th className="py-3.5 px-5">LOP Days Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-5 font-bold text-slate-900">
                    {emp.first_name} {emp.last_name}
                    <span className="text-[10px] text-slate-400 font-mono font-medium block mt-0.5">
                      {emp.employee_id}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-800 font-mono">10 / 12 remaining</td>
                  <td className="py-4 px-4 font-semibold text-slate-800 font-mono">9 / 10 remaining</td>
                  <td className="py-4 px-4 font-semibold text-slate-800 font-mono">15 / 15 remaining</td>
                  <td className="py-4 px-5 font-bold text-amber-700 font-mono">0 days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
