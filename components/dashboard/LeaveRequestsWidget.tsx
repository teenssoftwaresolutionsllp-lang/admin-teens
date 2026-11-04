import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock3 } from "lucide-react";

export interface DashboardLeaveRequest {
  id: string;
  employeeName: string;
  employeePhoto?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
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
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
  };

  const labels = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function LeaveRequestsWidget({
  requests,
}: LeaveRequestsWidgetProps) {
  return (
    <section className="flex h-full min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Leave Requests
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            This Week
          </p>
        </div>

        <Link
          href="/dashboard/approvals"
          className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View All
        </Link>
      </div>

      {/* Request list */}
      {requests.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-0 overflow-y-auto pr-1">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 border-b border-slate-100 py-4 first:pt-2 last:border-0 last:pb-2"
            >
              {/* Employee photo */}
              {request.employeePhoto ? (
                <Image
                  src={request.employeePhoto}
                  alt={request.employeeName}
                  width={42}
                  height={42}
                  unoptimized
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                  {getInitials(request.employeeName)}
                </div>
              )}

              {/* Employee details */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {request.employeeName}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {request.leaveType}
                </p>

                <div className="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-400">
                  <CalendarDays size={12} className="shrink-0" />
                  <span className="truncate">
                    {formatDate(request.startDate)} -{" "}
                    {formatDate(request.endDate)}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="shrink-0">
                <StatusBadge status={request.status} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <Clock3 className="mb-2 text-slate-300" size={28} />
          <p className="text-sm font-medium text-slate-600">
            No leave requests this week
          </p>
          <p className="mt-1 text-xs text-slate-400">
            New requests will appear here
          </p>
        </div>
      )}
    </section>
  );
}
