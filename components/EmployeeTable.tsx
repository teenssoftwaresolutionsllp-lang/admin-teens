"use client"

import { useState } from 'react'
import { Search, Filter, Eye, Pencil, UserCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Employee, Department, UserRole } from '@/lib/types'

interface EmployeeTableProps {
  employees: Employee[]
  departments: Department[]
  role: UserRole
}

export default function EmployeeTable({ employees, departments, role }: EmployeeTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
  }

  const filteredEmployees = employees.filter((emp) => {
    const searchString = searchTerm.toLowerCase()
    const matchesSearch = 
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchString) ||
      (emp.email && emp.email.toLowerCase().includes(searchString)) ||
      (emp.employee_id && emp.employee_id.toLowerCase().includes(searchString))
    
    const matchesDept = deptFilter === 'all' || emp.department_id === deptFilter
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter
    const matchesType = typeFilter === 'all' || emp.employment_type === typeFilter

    return matchesSearch && matchesDept && matchesStatus && matchesType
  })

  return (
    <div className="space-y-5">
      {/* Filters & Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="relative max-w-md flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm font-medium placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            placeholder="Search by name, email or employee ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              className="bg-transparent focus:outline-none cursor-pointer text-xs font-semibold"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <select
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on_notice">On Notice</option>
            <option value="terminated">Terminated</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Designation</th>
                <th className="px-6 py-4">Joining Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        {emp.profile_photo_url ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                            <Image src={emp.profile_photo_url} alt={`${emp.first_name} ${emp.last_name}`} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
                            {getInitials(emp.first_name, emp.last_name)}
                          </div>
                        )}
                        <div>
                          <Link href={`/dashboard/employees/${emp.id}`} className="font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                            {emp.first_name} {emp.last_name}
                          </Link>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-semibold text-slate-600">
                      {emp.employee_id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                        {emp.department?.name || 'General'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-800">
                      {emp.designation || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-500">
                      {formatDate(emp.joining_date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(emp.status)}`}>
                        {emp.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/employees/${emp.id}`}
                          className="rounded-xl p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {role === 'ceo' && (
                          <Link
                            href={`/dashboard/employees/${emp.id}/edit`}
                            className="rounded-xl p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            title="Edit Employee"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <UserCircle className="h-6 w-6" />
                      </div>
                      <p className="text-base font-bold text-slate-800">No employees found</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">Adjust your search query or reset filter selections to view registered employees.</p>
                    </div>
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

