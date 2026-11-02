
"use client"

import { useState } from "react"
import {
  Users,
  UserCheck,
  Building2,
  UserPlus,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Home,
} from "lucide-react"
import Link from "next/link"
import { UserRole, Employee } from "@/lib/types"

interface DashboardStatsProps {
  stats: {
    totalEmployees: number
    activeEmployees: number
    departments: number
    newHires: number
    onNotice: number
    recentEmployees: Employee[]
    pendingLeaveRequests?: number
  }
  role: UserRole
  todayAttendance: {
    employeeId: string
    departmentId: string
    departmentName: string
    workMode: "WFO" | "WFH"
  }[]
}

export default function DashboardStats({
  stats,
  role,
  todayAttendance,
}: DashboardStatsProps) {
  const [selectedDepartment, setSelectedDepartment] = useState("all")

  const departments = Array.from(
    new Map(
      todayAttendance.map((item) => [
        item.departmentId,
        item.departmentName,
      ])
    ).entries()
  )

  const filteredAttendance =
    selectedDepartment === "all"
      ? todayAttendance
      : todayAttendance.filter(
          (item) => item.departmentId === selectedDepartment
        )

  const presentCount = filteredAttendance.length

  const wfoCount = filteredAttendance.filter(
    (item) => item.workMode === "WFO"
  ).length

  const wfhCount = filteredAttendance.filter(
    (item) => item.workMode === "WFH"
  ).length

  const getStatusBadge = (
    status: string,
    noticeStatus?: string | null
  ) => {
    if (status === "resigned") {
      switch (noticeStatus) {
        case "notice_period":
          return "bg-amber-50 text-amber-700 border-amber-200"
        case "notice_completed":
          return "bg-blue-50 text-blue-700 border-blue-200"
        case "early_release":
          return "bg-purple-50 text-purple-700 border-purple-200"
      }
    }

    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "terminated":
        return "bg-rose-50 text-rose-700 border-rose-200"
      case "on_notice":
        return "bg-amber-50 text-amber-700 border-amber-200"
      default:
        return "bg-slate-50 text-slate-700 border-slate-200"
    }
  }

  const getStatusLabel = (
    status: string,
    noticeStatus?: string | null
  ) => {
    if (status === "resigned") {
      switch (noticeStatus) {
        case "notice_period":
          return "On Notice"
        case "notice_completed":
          return "Notice Completed"
        case "early_release":
          return "Early Released"
      }
    }

    return status.replace(/_/g, " ")
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A"

    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const statCardClass =
    "min-w-0 min-h-[258px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md"

  const iconClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"

  return (
    <div className="space-y-5">

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

        {/* Total Headcount */}
        <div className={statCardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Headcount
            </span>

            <div className={`${iconClass} border-indigo-100 bg-indigo-50 text-indigo-600`}>
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {stats.totalEmployees}
            </h3>

            <p className="mt-1 text-xs font-medium text-slate-500">
              Across all branches &amp; teams
            </p>
          </div>
        </div>

        {/* Active Staff */}
        <div className={statCardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Staff
            </span>

            <div className={`${iconClass} border-emerald-100 bg-emerald-50 text-emerald-600`}>
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {stats.activeEmployees}
            </h3>

            <p className="mt-1 text-xs font-medium text-emerald-600">
              Currently on active payroll
            </p>
          </div>
        </div>

        {/* Departments */}
        <div className={statCardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Departments
            </span>

            <div className={`${iconClass} border-violet-100 bg-violet-50 text-violet-600`}>
              <Building2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {stats.departments}
            </h3>

            <p className="mt-1 text-xs font-medium text-slate-500">
              Functional business units
            </p>
          </div>
        </div>

        {/* New Hires */}
        <div className={statCardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              New Hires
            </span>

            <div className={`${iconClass} border-blue-100 bg-blue-50 text-blue-600`}>
              <UserPlus className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {stats.newHires}
            </h3>

            <p className="mt-1 text-xs font-medium text-blue-600">
              Joined this month
            </p>
          </div>
        </div>

        {/* Today Present */}
        <div className={statCardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Today Present
            </span>

            <div className={`${iconClass} border-violet-100 bg-violet-50 text-violet-600`}>
              <Clock className="h-5 w-5" />
            </div>
          </div>

          {/* Total present and department filter */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {presentCount}
            </h3>

            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-[126px] min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-medium text-slate-600 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              aria-label="Filter attendance by department"
            >
              <option value="all">All Departments</option>

              {departments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* WFO and WFH breakdown */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                <Building2 className="h-3.5 w-3.5" />
                WFO
              </div>

              <p className="mt-1 text-xl font-bold text-slate-900">
                {wfoCount}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <Home className="h-3.5 w-3.5" />
                WFH
              </div>

              <p className="mt-1 text-xl font-bold text-slate-900">
                {wfhCount}
              </p>
            </div>
          </div>

          <p className="mt-2 text-[11px] leading-4 text-slate-400">
            Today&apos;s work location breakdown
          </p>
        </div>
      </div>

      {/* Notice Period Alert */}
      {stats.onNotice > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div>
              <h4 className="text-base font-bold text-amber-900">
                {stats.onNotice} Employee(s) Currently on Notice Period
              </h4>

              <p className="mt-0.5 text-xs font-medium text-amber-700">
                Please initiate handover procedures and exit checklist verification.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/employees"
            className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            View Staff
          </Link>
        </div>
      )}

      {/* Recent Employees Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Recent Onboarded Employees
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Recently added staff profiles and joining status
            </p>
          </div>

          <Link
            href="/dashboard/employees"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
          >
            <span>View All Staff</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Employee</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Designation</th>
                <th className="px-6 py-3.5">Joining Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {stats.recentEmployees.length > 0 ? (
                stats.recentEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-indigo-100 shadow-sm">
                          {emp.profile_photo_url ? (
                            <img
                              src={emp.profile_photo_url}
                              alt={`${emp.first_name} ${emp.last_name}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-indigo-500 to-indigo-600 text-xs font-bold text-white">
                              {emp.first_name?.[0]}
                              {emp.last_name?.[0]}
                            </div>
                          )}
                        </div>

                        <div>
                          <Link
                            href={`/dashboard/employees/${emp.id}`}
                            className="block font-bold text-slate-900 transition-colors hover:text-indigo-600"
                          >
                            {emp.first_name} {emp.last_name}
                          </Link>

                          <span className="font-mono text-xs text-slate-400">
                            {emp.employee_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {emp.department?.name || "General"}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-800">
                      {emp.designation || "N/A"}
                    </td>

                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {formatDate(emp.joining_date)}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                          emp.status,
                          (emp as Employee & {
                            notice_status?: string | null
                          }).notice_status
                        )}`}
                      >
                        {getStatusLabel(
                          emp.status,
                          (emp as Employee & {
                            notice_status?: string | null
                          }).notice_status
                        )}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/employees/${emp.id}`}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center font-medium text-slate-400"
                  >
                    No recent employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
