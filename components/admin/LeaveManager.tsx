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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Leave Policies & Quotas</h2>
          <p className="text-xs text-slate-500 mt-1">
            Specify leave categories, set annual quotas, designate paid vs unpaid (LOP) types, and monitor company-wide balances.
          </p>
        </div>

        {pendingLeaves.length > 0 && (
          <Link
            href="/dashboard/approvals"
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>{pendingLeaves.length} Pending Leave Approvals</span>
          </Link>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Leave Types Configuration Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Organization Leave Categories</span>
          </h3>
          <span className="text-xs text-slate-400">HR Customizable</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Leave Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Annual Quota (Days)</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Payroll LOP Impact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.map((type) => (
                <tr key={type.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {type.name}
                    <span className="text-[10px] text-slate-400 font-normal block">
                      {type.description}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-indigo-700">{type.code}</td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      value={type.annual_quota}
                      onChange={(e) => handleUpdateQuota(type.id, Number(e.target.value))}
                      className="w-20 px-2 py-1 border rounded font-mono text-center"
                      disabled={type.code === "LOP"}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        type.is_paid
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {type.is_paid ? "Paid Leave" : "Unpaid Leave (LOP)"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {type.is_paid ? (
                      <span className="text-[11px] text-slate-400">No salary deduction</span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700">
                        Deducts 1 day&apos;s salary per day
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {type.code !== "LOP" && (
                      <button
                        onClick={() => handleTogglePaid(type.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <span>Employee Leave Balances Overview</span>
          </h3>
          <span className="text-xs text-slate-400">Year 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Casual Leave (CL)</th>
                <th className="py-3 px-4">Sick Leave (SL)</th>
                <th className="py-3 px-4">Earned Leave (EL)</th>
                <th className="py-3 px-4">LOP Days Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {emp.first_name} {emp.last_name}
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {emp.employee_id}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">10 / 12 remaining</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">9 / 10 remaining</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">15 / 15 remaining</td>
                  <td className="py-3 px-4 font-bold text-amber-700">0 days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
