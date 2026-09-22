"use client"

import { Users, UserCheck, Building2, UserPlus, AlertTriangle, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { UserRole, Employee } from '@/lib/types'

interface DashboardStatsProps {
  stats: {
    totalEmployees: number
    activeEmployees: number
    departments: number
    newHires: number
    onNotice: number
    recentEmployees: Employee[]
  }
  role: UserRole
}

export default function DashboardStats({ stats, role }: DashboardStatsProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'terminated':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'on_notice':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Headcount</span>
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.totalEmployees}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Across all branches & teams</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Staff</span>
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.activeEmployees}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">Currently on active payroll</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Departments</span>
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.departments}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Functional business units</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">New Hires</span>
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <UserPlus className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.newHires}</h3>
            <p className="text-xs text-blue-600 font-medium mt-1">Joined in last 30 days</p>
          </div>
        </div>

        {stats.onNotice > 0 && (
          <div className="bg-amber-50/70 p-6 rounded-2xl border border-amber-200/80 shadow-sm sm:col-span-2 lg:col-span-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900 text-base">{stats.onNotice} Employee(s) Currently on Notice Period</h4>
                <p className="text-xs text-amber-700 font-medium mt-0.5">Please initiate handover procedures and exit checklist verification.</p>
              </div>
            </div>
            <Link href="/dashboard/employees" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all">
              View Staff
            </Link>
          </div>
        )}
      </div>

      {/* Recent Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Onboarded Employees</h2>
            <p className="text-xs text-slate-500 mt-0.5">Recently added staff profiles and joining status</p>
          </div>
          <Link
            href="/dashboard/employees"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-3.5 py-2 rounded-xl transition-all"
          >
            <span>View All Staff</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
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
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>
                        <div>
                          <Link href={`/dashboard/employees/${emp.id}`} className="font-bold text-slate-900 hover:text-indigo-600 transition-colors block">
                            {emp.first_name} {emp.last_name}
                          </Link>
                          <span className="text-xs text-slate-400 font-mono">{emp.employee_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                        {emp.department?.name || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {emp.designation || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {formatDate(emp.joining_date)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(emp.status)}`}>
                        {emp.status.replace('_', ' ')}
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
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
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

