"use client";

import Link from "next/link";
import {
  UserPlus,
  ShieldCheck,
  ClipboardCheck,
  BarChart2,
  CalendarDays,
  Zap,
  ArrowRight,
} from "lucide-react";

export default function QuickActions() {
  const actions = [
    // {
    //   title: "Add Employee",
    //   href: "/dashboard/employees/add",
    //   icon: UserPlus,
    //   bgGradient: "from-[#eef4ff] to-[#f8faff]",
    //   borderColor: "border-blue-100/90",
    //   iconBg: "bg-blue-500",
    //   iconColor: "text-white",
    // },
    {
      title: "Manage Policies",
      href: "/dashboard/policies",
      icon: ShieldCheck,
      bgGradient: "from-[#ecfdf5] to-[#f8fcf9]",
      borderColor: "border-emerald-100/90",
      iconBg: "bg-emerald-500",
      iconColor: "text-white",
    },
    {
      title: "Approval Hub",
      href: "/dashboard/approvals",
      icon: ClipboardCheck,
      bgGradient: "from-[#f3e8ff] to-[#faf5ff]",
      borderColor: "border-purple-100/90",
      iconBg: "bg-[#8b5cf6]",
      iconColor: "text-white",
    },
    {
      title: "View Reports",
      href: "/dashboard/attendance",
      icon: BarChart2,
      bgGradient: "from-[#fff7ed] to-[#fffbf5]",
      borderColor: "border-orange-100/90",
      iconBg: "bg-orange-500",
      iconColor: "text-white",
    },
  ];

  return (
    <section className="flex h-full min-w-0 w-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Zap className="h-4 w-4 fill-blue-600 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Quick Actions
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Frequently used HR operations
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/employees"
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 4 Action Cards */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className={`group flex min-h-[96px] flex-col items-center justify-center rounded-2xl border ${action.borderColor} bg-gradient-to-b ${action.bgGradient} p-3 text-center shadow-xs transition hover:-translate-y-0.5 hover:shadow-sm`}
              >
                <div
                  className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full ${action.iconBg} ${action.iconColor} shadow-xs transition group-hover:scale-105`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="mt-2 text-xs font-semibold text-slate-800 leading-snug">
                  {action.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Stay Updated Banner */}
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-indigo-100/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/60 p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-xs">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                Stay Updated
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                Check holidays and events for your organization.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/projects"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 whitespace-nowrap self-start sm:self-auto"
          >
            View Calendar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
