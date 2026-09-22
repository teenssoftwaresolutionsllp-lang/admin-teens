"use client";

import Link from "next/link";
import { CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { calculateProfileCompletion } from "@/lib/calculations";
import { Employee } from "@/lib/types";

interface ProfileProgressBarProps {
  employee: Partial<Employee> | null;
}

export default function ProfileProgressBar({ employee }: ProfileProgressBarProps) {
  const { percentage, missingFields, isComplete, completedFieldsCount, totalFieldsCount } =
    calculateProfileCompletion(employee);

  return (
    <div
      className={`rounded-xl border p-5 transition-all shadow-sm ${
        isComplete
          ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300"
          : "bg-white border-amber-200"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isComplete ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
            )}
            <h3
              className={`text-base font-bold ${
                isComplete ? "text-emerald-900" : "text-slate-900"
              }`}
            >
              {isComplete
                ? "Profile 100% Completed & Verified"
                : "Employee Profile Completion"}
            </h3>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isComplete
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {percentage}% Complete
            </span>
          </div>

          <p className="text-xs text-slate-600 mt-1">
            {isComplete
              ? "All mandatory personal, address, emergency, and KYC identity details are fully submitted."
              : `${completedFieldsCount} of ${totalFieldsCount} key profile attributes submitted. Complete remaining info for seamless payroll & KYC compliance.`}
          </p>
        </div>

        {!isComplete && (
          <Link
            href="/portal/profile"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors shrink-0"
          >
            <span>Complete Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Progress Bar Container */}
      <div className="mt-4">
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isComplete
                ? "bg-emerald-500 shadow-sm"
                : percentage >= 70
                ? "bg-indigo-500"
                : "bg-amber-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Missing Fields chips when incomplete */}
      {!isComplete && missingFields.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500">Missing fields:</span>
          {missingFields.slice(0, 5).map((field) => (
            <span
              key={field}
              className="text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded"
            >
              {field}
            </span>
          ))}
          {missingFields.length > 5 && (
            <span className="text-[10px] text-slate-400 font-medium">
              +{missingFields.length - 5} more
            </span>
          )}
        </div>
      )}

      {isComplete && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Profile verified for direct bank transfer and statutory PF/ESI filing.</span>
        </div>
      )}
    </div>
  );
}
