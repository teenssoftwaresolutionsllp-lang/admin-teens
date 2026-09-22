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
      className={`rounded-2xl border p-6 sm:p-7 transition-all shadow-sm ${
        isComplete
          ? "bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-white border-emerald-300/80"
          : "bg-white border-slate-200/90"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg ${
                isComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {isComplete ? (
                <ShieldCheck className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
            </div>
            <h3
              className={`text-base sm:text-lg font-bold tracking-tight ${
                isComplete ? "text-emerald-950" : "text-slate-900"
              }`}
            >
              {isComplete ? "Profile 100% Complete & Verified" : "Employee Profile Completion"}
            </h3>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full shadow-xs ${
                isComplete
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-100 text-amber-800 border border-amber-300/60"
              }`}
            >
              {percentage}% Completed
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isComplete
              ? "All mandatory personal, contact, address, banking, and statutory identity details are fully submitted."
              : `${completedFieldsCount} of ${totalFieldsCount} key profile attributes submitted. Fill remaining fields for seamless payroll and compliance.`}
          </p>
        </div>

        {!isComplete && (
          <Link
            href="/portal/profile"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm hover:shadow transition-all shrink-0"
          >
            <span>Complete Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Progress Bar Container */}
      <div className="mt-5">
        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200/80 p-0.5 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isComplete
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm"
                : percentage >= 70
                ? "bg-gradient-to-r from-indigo-500 to-indigo-600"
                : "bg-gradient-to-r from-amber-500 to-amber-600"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Missing Fields chips when incomplete */}
      {!isComplete && missingFields.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Pending details:</span>
          {missingFields.slice(0, 5).map((field) => (
            <span
              key={field}
              className="text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 rounded-lg"
            >
              {field}
            </span>
          ))}
          {missingFields.length > 5 && (
            <span className="text-[11px] text-slate-400 font-medium">
              +{missingFields.length - 5} more
            </span>
          )}
        </div>
      )}

      {isComplete && (
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-100/60 border border-emerald-200/70 p-2.5 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Profile verified for direct bank transfer, PF/ESI filing, and official payslip generation.</span>
        </div>
      )}
    </div>
  );
}
