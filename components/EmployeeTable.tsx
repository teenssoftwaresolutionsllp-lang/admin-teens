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
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
            placeholder="Search by name, email or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              className="bg-transparent focus:outline-none cursor-pointer"
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Designation</th>
                <th className="px-6 py-4 font-semibold">Joining Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        {emp.profile_photo_url ? (
                          <div className="relative h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                            <Image src={emp.profile_photo_url} alt={`${emp.first_name} ${emp.last_name}`} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 border border-indigo-100">
                            {getInitials(emp.first_name, emp.last_name)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-slate-500">
                      {emp.employee_id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                      {emp.department?.name || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                      {emp.designation || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                      {formatDate(emp.joining_date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(emp.status)}`}>
                        {emp.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/employees/${emp.id}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {role === 'ceo' && (
                          <Link
                            href={`/dashboard/employees/${emp.id}/edit`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
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
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <UserCircle className="h-10 w-10 text-slate-300 mb-3" />
                      <p className="text-base font-medium text-slate-900">No employees found</p>
                      <p className="text-sm mt-1">Adjust your filters or search query to find what you're looking for.</p>
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
