"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CalendarCheck, Clock3, ArrowRight } from "lucide-react";

export interface DashboardLeaveRequest {
  id: string;
  employeeName: string;
  employeePhoto?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  status:
  | "pending"
  | "pending_manager"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";
}

interface LeaveRequestsWidgetProps {
  requests: DashboardLeaveRequest[];
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StatusBadge({
  status,
}: {
  status: DashboardLeaveRequest["status"];
}) {
    const styles = {
      pending: "bg-[#eef2ff] text-[#4f46e5] border border-indigo-100",
      pending_manager: "bg-[#fff7ed] text-[#c2410c] border border-orange-100",
      approved: "bg-[#e6f9f0] text-[#059669] border border-emerald-100",
      rejected: "bg-[#fef2f2] text-[#e11d48] border border-rose-100",
      expired: "bg-slate-100 text-slate-500 border border-slate-200",
      cancelled: "bg-slate-100 text-slate-600 border border-slate-200",
    };

    const labels = {
      pending: "Pending",
      pending_manager: "Pending Manager",
      approved: "Approved",
      rejected: "Rejected",
      expired: "Expired",
      cancelled: "Cancelled",
    };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function LeaveRequestsWidget({
  requests,
}: LeaveRequestsWidgetProps) {
  return (
    <section className="flex h-full min-w-0 w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <CalendarCheck className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Leave Requests
              </h2>
              <p className="text-xs text-slate-400 font-medium">This Week</p>
            </div>
          </div>

          <Link
            href="/dashboard/approvals"
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Request list */}
        {requests.length > 0 ? (
          <div className="mt-3 divide-y divide-slate-100 overflow-y-auto max-h-[220px] pr-1">
            {requests.slice(0, 4).map((request) => (
              <Link
                key={request.id}
                href={`/dashboard/approvals?status=${
                  request.status === "pending" ? "pending" : "history"
                }&leaveId=${encodeURIComponent(request.id)}`}
                className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50/70 rounded-xl px-1.5"
              >
                {/* Employee photo */}
                {request.employeePhoto ? (
                  <Image
                    src={request.employeePhoto}
                    alt={request.employeeName}
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 shrink-0 rounded-full object-cover border border-slate-100"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600 border border-indigo-100/60">
                    {getInitials(request.employeeName)}
                  </div>
                )}

                {/* Employee details */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs sm:text-sm font-bold text-slate-900">
                    {request.employeeName}
                  </p>

                  <p className="truncate text-xs font-medium text-slate-500">
                    {request.leaveType}
                  </p>

                  <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-400">
                    <CalendarDays size={11} className="shrink-0 text-slate-400" />
                    <span className="truncate">
                      {formatDate(request.startDate)} – {formatDate(request.endDate)}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  <StatusBadge status={request.status} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center text-center mt-3">
            <Clock3 className="mb-2 text-slate-300" size={26} />
            <p className="text-xs font-medium text-slate-600">
              No leave requests this week
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              New requests will appear here
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
