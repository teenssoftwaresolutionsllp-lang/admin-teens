"use client"

import { Users, UserCheck, Building2, UserPlus, AlertTriangle } from 'lucide-react'
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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700'
      case 'terminated': return 'bg-red-100 text-red-700'
      case 'on_notice': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (dateStr: string | null) => {
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Total Employees</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.totalEmployees}</h3>
          </div>
        </div>

        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Active Employees</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.activeEmployees}</h3>
          </div>
        </div>

        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Departments</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.departments}</h3>
          </div>
        </div>

        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <UserPlus className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">New Hires (Month)</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.newHires}</h3>
          </div>
        </div>

        {stats.onNotice > 0 && (
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">On Notice</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats.onNotice}</h3>
            </div>
          </div>
        )}
      </div>

      {/* Recent Employees Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Employees</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Designation</th>
                <th className="px-6 py-3">Joining Date</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {stats.recentEmployees.length > 0 ? (
                stats.recentEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                      <Link href={`/dashboard/employees/${emp.id}`} className="hover:text-indigo-600">
                        {emp.first_name} {emp.last_name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {emp.department?.name || 'N/A'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {emp.designation || 'N/A'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {formatDate(emp.joining_date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(emp.status)}`}>
                        {emp.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
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
