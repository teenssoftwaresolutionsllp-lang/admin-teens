"use client"

import { useEffect,useState } from 'react'
import { useSearchParams } from "next/navigation";
import companiesData from '@/data/companies.json'
import Link from 'next/link'
import Image from 'next/image'
import { Employee, Department, UserRole } from '@/lib/types'
import {Search, Filter, Eye, UserCircle, Download, CalendarDays, Building2, BriefcaseBusiness, ShieldCheck, RotateCcw, UsersRound, ChevronDown,} from "lucide-react";

const companies = companiesData.companies

interface EmployeeTableProps {
  employees: Employee[]
  departments: Department[]
  role: UserRole
}

export default function EmployeeTable({
  employees,
  departments,
  role,
}: EmployeeTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [compFilter, setCompFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const searchParams = useSearchParams();
  const sidebarStatus = searchParams.get("status") || "all";
  const isAllSubmenu = sidebarStatus === "all";
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const statusLabels: Record<string, string> = {
    all: "All Status",
    joining: "Joining",
    active: "Active",
    terminated: "Terminated",
    laid_off: "Layoff",
    notice_period: "Notice Period",
    notice_completed: "Notice Completed",
    early_release: "Early Release",
    resigned: "Resigned",
    on_notice: "On Notice",
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setCompFilter("all");
    setDeptFilter("all");
    setStatusFilter(isAllSubmenu ? "all" : sidebarStatus);
    setTypeFilter("all");
    setFromDate("");
    setToDate("");
    setSelectedEmployees([]);
  };

  // Hide date filters for All Status.
  const showDateFilters = !isAllSubmenu;

  const showExitDetails = [
    "terminated",
    "laid_off",
    "resigned",
    "notice_period",
    "notice_completed",
    "early_release",
  ].includes(sidebarStatus);

  useEffect(() => {
    const statusFromUrl = searchParams.get("status") || "all";
    setStatusFilter(statusFromUrl);
  }, [searchParams]);

  const isFilterActive =
    searchTerm.trim() !== '' ||
    compFilter !== 'all' ||
    deptFilter !== 'all' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    (showDateFilters && (fromDate !== '' || toDate !== ''))

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
      year: 'numeric',
    })
  }

  const getLastWorkingDate = (emp: Employee): string | null => {
  const status = String(emp.status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const exitStatuses = [
    "resigned",
    "resignation",
    "terminated",
    "laid_off",
  ];

  if (exitStatuses.includes(status)) {
    return emp.exit_date || emp.planned_last_working_date || null;
  }

  return null;
};

  const getYearsWorked = (emp: Employee): string => {
    if (!emp.joining_date) return "N/A";

    const lastWorkingDate = getLastWorkingDate(emp);
    const startDate = new Date(emp.joining_date);
    const endDate = lastWorkingDate
      ? new Date(lastWorkingDate)
      : new Date();

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      return "N/A";
    }

    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();

    if (endDate.getDate() < startDate.getDate()) {
      months--;
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} yr${years !== 1 ? "s" : ""} ${months} mo`;
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()

  const getDepartmentName = (employee: Employee) =>
    employee.department?.name ||
    departments.find((department) => department.id === employee.department_id)?.name ||
    'General'

  // Download one employee's details as DOCX.
  const handleDownloadEmployee = async (emp: Employee) => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } =
        await import('docx')

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: 'EMPLOYEE DETAILS',
                heading: HeadingLevel.TITLE,
              }),

              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Personal Information',
                    bold: true,
                    size: 28,
                  }),
                ],
              }),

              new Paragraph(`Employee ID: ${emp.employee_id || 'N/A'}`),
              new Paragraph(`First Name: ${emp.first_name || 'N/A'}`),
              new Paragraph(`Last Name: ${emp.last_name || 'N/A'}`),
              new Paragraph(`Email: ${emp.email || 'N/A'}`),
              new Paragraph(`Phone: ${emp.phone || 'N/A'}`),
              new Paragraph(`Date of Birth: ${formatDate(emp.date_of_birth)}`),
              new Paragraph(`Gender: ${emp.gender || 'N/A'}`),
              new Paragraph(`Blood Group: ${emp.blood_group || 'N/A'}`),
              new Paragraph(`Marital Status: ${emp.marital_status || 'N/A'}`),

              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Employment Information',
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { before: 300 },
              }),

              new Paragraph(`Department: ${emp.department?.name || 'General'}`),
              new Paragraph(`Designation: ${emp.designation || 'N/A'}`),
              new Paragraph(`Employment Type: ${emp.employment_type || 'N/A'}`),
              new Paragraph(`Joining Date: ${formatDate(emp.joining_date)}`),
              new Paragraph(`Probation End Date: ${formatDate(emp.probation_end_date)}`),
              new Paragraph(`Confirmation Date: ${formatDate(emp.confirmation_date)}`),
              new Paragraph(`Reporting Manager: ${emp.reporting_manager || 'N/A'}`),
              new Paragraph(`Work Location: ${emp.work_location || 'N/A'}`),
              new Paragraph(`CTC: ₹${emp.salary || 'N/A'}`),
              new Paragraph(`ESI Number: ${emp.esi_number || 'N/A'}`),
              new Paragraph(`Status: ${emp.status || 'N/A'}`),

              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Bank & Identity Information',
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { before: 300 },
              }),

              new Paragraph(`Bank Name: ${emp.bank_name || 'N/A'}`),
              new Paragraph(`Bank Account Number: ${emp.bank_account_number || 'N/A'}`),
              new Paragraph(`IFSC Code: ${emp.ifsc_code || 'N/A'}`),
              new Paragraph(`PAN Number: ${emp.pan_number || 'N/A'}`),
              new Paragraph(`Aadhaar Number: ${emp.aadhar_number || 'N/A'}`),

              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Address Information',
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { before: 300 },
              }),

              new Paragraph(`Permanent Address: ${emp.permanent_address || 'N/A'}`),
              new Paragraph(`Permanent City: ${emp.permanent_city || 'N/A'}`),
              new Paragraph(`Permanent State: ${emp.permanent_state || 'N/A'}`),
              new Paragraph(`Permanent Pincode: ${emp.permanent_pincode || 'N/A'}`),
              new Paragraph(`Temporary Address: ${emp.temporary_address || 'N/A'}`),
              new Paragraph(`Temporary City: ${emp.temporary_city || 'N/A'}`),
              new Paragraph(`Temporary State: ${emp.temporary_state || 'N/A'}`),
              new Paragraph(`Temporary Pincode: ${emp.temporary_pincode || 'N/A'}`),

              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Emergency Contact',
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { before: 300 },
              }),

              new Paragraph(`Contact Name: ${emp.emergency_contact_name || 'N/A'}`),
              new Paragraph(`Contact Phone: ${emp.emergency_contact_phone || 'N/A'}`),
              new Paragraph(`Relation: ${emp.emergency_contact_relation || 'N/A'}`),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `${
        emp.employee_id || `${emp.first_name}-${emp.last_name}`
      }-Employee.docx`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to generate employee document:', error)
    }
  }

  // Filter employees using the selected status and its corresponding date field.
  const filteredEmployees = employees.filter((emp) => {
    const searchString = searchTerm.toLowerCase()

    const matchesSearch =
      `${emp.first_name} ${emp.last_name}`
        .toLowerCase()
        .includes(searchString) ||
      (emp.email && emp.email.toLowerCase().includes(searchString)) ||
      (emp.employee_id && emp.employee_id.toLowerCase().includes(searchString))

    const matchesDept = deptFilter === 'all' || emp.department_id === deptFilter

    const normalizedEmployeeStatus = String(emp.status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    const effectiveStatus = isAllSubmenu ? statusFilter : sidebarStatus;
    const matchesStatus =
      effectiveStatus === "all" ||
      (effectiveStatus === "joining" &&
        normalizedEmployeeStatus === "active") ||
      (effectiveStatus === "notice_period" &&
        normalizedEmployeeStatus === "on_notice") ||
      (effectiveStatus === "notice_completed" &&
        normalizedEmployeeStatus === "resigned") ||
      (effectiveStatus === "early_release" &&
        normalizedEmployeeStatus === "resigned") ||
      normalizedEmployeeStatus === effectiveStatus;

    const matchesType = typeFilter === 'all' || emp.employment_type === typeFilter

    const matchesCompany = compFilter === 'all' || emp.company_name === compFilter

    let filterDate: string | null | undefined

    switch (effectiveStatus) {
      case "joining":
      case "active":
        filterDate = emp.joining_date;
        break;

      case "terminated":
      case "laid_off":
      case "resigned":
      case "notice_completed":
      case "early_release":
        filterDate = emp.exit_date;
        break;

      case "notice_period":
        filterDate = emp.planned_last_working_date;
        break;

      default:
        filterDate = undefined;
    }

    const normalizedDate = filterDate?.slice(0, 10)

    const matchesFromDate =
      !showDateFilters ||
      !fromDate ||
      (!!normalizedDate && normalizedDate >= fromDate)

    const matchesToDate =
      !showDateFilters ||
      !toDate ||
      (!!normalizedDate && normalizedDate <= toDate)

    return (
      matchesSearch &&
      matchesDept &&
      matchesStatus &&
      matchesType &&
      matchesCompany &&
      matchesFromDate &&
      matchesToDate
    )
  })

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const handleSelectAll = () => {
    const filteredIds = filteredEmployees.map((emp) => emp.id)

    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedEmployees.includes(id))

    if (allSelected) {
      setSelectedEmployees((prev) =>
        prev.filter((id) => !filteredIds.includes(id))
      )
    } else {
      setSelectedEmployees((prev) => [
        ...new Set([...prev, ...filteredIds]),
      ])
    }
  }

  // Download selected employees as one DOCX, with a page break between employees.
  const handleDownloadSelectedEmployees = async () => {
    const employeesToDownload = filteredEmployees.filter((emp) =>
      selectedEmployees.includes(emp.id)
    )

    if (employeesToDownload.length === 0) {
      alert('Please select at least one employee.')
      return
    }

    try {
      setIsDownloading(true)

      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        HeadingLevel,
        PageBreak,
      } = await import('docx')

      const children: any[] = []

      employeesToDownload.forEach((emp, index) => {
        children.push(
          new Paragraph({
            text: 'EMPLOYEE DETAILS',
            heading: HeadingLevel.TITLE,
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `${emp.first_name || ''} ${emp.last_name || ''}`,
                bold: true,
                size: 30,
              }),
            ],
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Personal Information',
                bold: true,
                size: 28,
              }),
            ],
          }),

          new Paragraph(`Employee ID: ${emp.employee_id || 'N/A'}`),
          new Paragraph(`First Name: ${emp.first_name || 'N/A'}`),
          new Paragraph(`Last Name: ${emp.last_name || 'N/A'}`),
          new Paragraph(`Email: ${emp.email || 'N/A'}`),
          new Paragraph(`Phone: ${emp.phone || 'N/A'}`),
          new Paragraph(`Date of Birth: ${formatDate(emp.date_of_birth)}`),
          new Paragraph(`Gender: ${emp.gender || 'N/A'}`),
          new Paragraph(`Blood Group: ${emp.blood_group || 'N/A'}`),
          new Paragraph(`Marital Status: ${emp.marital_status || 'N/A'}`),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Employment Information',
                bold: true,
                size: 28,
              }),
            ],
            spacing: { before: 300 },
          }),

          new Paragraph(`Department: ${getDepartmentName(emp)}`),
          new Paragraph(`Designation: ${emp.designation || 'N/A'}`),
          new Paragraph(`Employment Type: ${emp.employment_type || 'N/A'}`),
          new Paragraph(`Joining Date: ${formatDate(emp.joining_date)}`),
          new Paragraph(`Probation End Date: ${formatDate(emp.probation_end_date)}`),
          new Paragraph(`Confirmation Date: ${formatDate(emp.confirmation_date)}`),
          new Paragraph(`Reporting Manager: ${emp.reporting_manager || 'N/A'}`),
          new Paragraph(`Work Location: ${emp.work_location || 'N/A'}`),
          new Paragraph(`Client Type: ${emp.client_type || 'N/A'}`),
          new Paragraph(`Company: ${emp.company_name || 'N/A'}`),
          new Paragraph(`CTC: ₹${emp.salary || 'N/A'}`),
          new Paragraph(`ESI Number: ${emp.esi_number || 'N/A'}`),
          new Paragraph(`Status: ${emp.status || 'N/A'}`),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Bank & Identity Information',
                bold: true,
                size: 28,
              }),
            ],
            spacing: { before: 300 },
          }),

          new Paragraph(`Bank Name: ${emp.bank_name || 'N/A'}`),
          new Paragraph(`Bank Account Number: ${emp.bank_account_number || 'N/A'}`),
          new Paragraph(`IFSC Code: ${emp.ifsc_code || 'N/A'}`),
          new Paragraph(`PAN Number: ${emp.pan_number || 'N/A'}`),
          new Paragraph(`Aadhaar Number: ${emp.aadhar_number || 'N/A'}`),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Address Information',
                bold: true,
                size: 28,
              }),
            ],
            spacing: { before: 300 },
          }),

          new Paragraph(`Permanent Address: ${emp.permanent_address || 'N/A'}`),
          new Paragraph(`Permanent City: ${emp.permanent_city || 'N/A'}`),
          new Paragraph(`Permanent State: ${emp.permanent_state || 'N/A'}`),
          new Paragraph(`Permanent Pincode: ${emp.permanent_pincode || 'N/A'}`),
          new Paragraph(`Temporary Address: ${emp.temporary_address || 'N/A'}`),
          new Paragraph(`Temporary City: ${emp.temporary_city || 'N/A'}`),
          new Paragraph(`Temporary State: ${emp.temporary_state || 'N/A'}`),
          new Paragraph(`Temporary Pincode: ${emp.temporary_pincode || 'N/A'}`),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Emergency Contact',
                bold: true,
                size: 28,
              }),
            ],
            spacing: { before: 300 },
          }),

          new Paragraph(`Contact Name: ${emp.emergency_contact_name || 'N/A'}`),
          new Paragraph(`Contact Phone: ${emp.emergency_contact_phone || 'N/A'}`),
          new Paragraph(`Relation: ${emp.emergency_contact_relation || 'N/A'}`)
        )

        if (index < employeesToDownload.length - 1) {
          children.push(new Paragraph({ children: [new PageBreak()] }))
        }
      })

      const doc = new Document({
        sections: [{ children }],
      })

      const blob = await Packer.toBlob(doc)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url

      const companyName =
        compFilter !== 'all'
          ? compFilter.replace(/[^a-zA-Z0-9]/g, '-')
          : 'Employees'

      link.download = `${companyName}-Employee-Details.docx`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to generate employee document:', error)
      alert('Failed to generate employee document.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Search and filters */}
      {/* Clean search and filters */}
      {isAllSubmenu ? (
        // ALL SUBMENU — COMPACT FILTER BAR
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
            {/* Search */}
            <div className="xl:col-span-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employees..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Company */}
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Company
              </label>
              <select
                value={compFilter}
                onChange={(e) => setCompFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                <option value="all">All Companies</option>
                {companies.map((company) => (
                  <option key={company.company_name} value={company.company_name}>
                    {company.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Department
              </label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status — editable under All */}
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="resigned">Resigned</option>
                <option value="terminated">Terminated</option>
                <option value="laid_off">Laid Off</option>
                <option value="on_notice">On Notice</option>
              </select>
            </div>

            {/* Employment Type */}
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Employment Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"              >
                <option value="all">All Types</option>
                <option value="in-house">In-House</option>
                <option value="outsource">Outsource</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        // OTHER SUBMENUS — LARGE FILTER CARDS WITH DATES
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Filter Employees
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Filter employees by date, company, department, and employment type.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Search */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employees..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"              />
            </div>

            {/* From Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Company */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Company
              </label>
              <select
                value={compFilter}
                onChange={(e) => setCompFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Companies</option>
                {companies.map((company) => (
                  <option key={company.company_name} value={company.company_name}>
                    {company.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Department
              </label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status — fixed to the selected submenu */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={sidebarStatus}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value={sidebarStatus}>
                  {statusLabels[sidebarStatus] ?? sidebarStatus}
                </option>
              </select>
            </div>

            {/* Employment Type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Employment Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All Types</option>
                <option value="in-house">In-House</option>
                <option value="outsource">Outsource</option>
              </select>
            </div>
          </div>
        </div>
      )}


      {/* Employee table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        {isFilterActive && (
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">
                {selectedEmployees.length} employee
                {selectedEmployees.length !== 1 ? 's' : ''} selected
              </span>

              {selectedEmployees.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedEmployees([])}
                  className="text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownloadSelectedEmployees}
              disabled={selectedEmployees.length === 0 || isDownloading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Download className="h-4 w-4" />
              {isDownloading
                ? 'Generating DOCX...'
                : selectedEmployees.length > 0
                  ? `Download Selected (${selectedEmployees.length})`
                  : 'Download Selected'}
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                {isFilterActive && (
                  <th className="whitespace-nowrap px-6 py-4">
                    <input
                      type="checkbox"
                      checked={
                        filteredEmployees.length > 0 &&
                        filteredEmployees.every((emp) =>
                          selectedEmployees.includes(emp.id)
                        )
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      title="Select all filtered employees"
                    />
                  </th>
                )}

                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Designation</th>
                <th className="px-6 py-4">Joining Date</th>
                {showExitDetails && (
                  <>
                    <th className="px-6 py-4">Years Worked</th>
                    <th className="px-6 py-4">Last Working Date</th>
                  </>
                )}
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
                <th className="px-6 py-4">Download</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    {isFilterActive && (
                      <td className="whitespace-nowrap px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => handleSelectEmployee(emp.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        {emp.profile_photo_url ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                            <Image
                              src={emp.profile_photo_url}
                              alt={`${emp.first_name} ${emp.last_name}`}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
                            {getInitials(emp.first_name, emp.last_name)}
                          </div>
                        )}

                        <div>
                          <Link
                            href={`/dashboard/employees/${emp.id}`}
                            className="font-bold text-slate-900 transition-colors hover:text-indigo-600"
                          >
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
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {getDepartmentName(emp)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-800">
                      {emp.designation || '-'}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-500">
                      {formatDate(emp.joining_date)}
                    </td>
                    {showExitDetails && (
                      <>
                        <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-600">
                          {getYearsWorked(emp)}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-slate-500">
                          {formatDate(
                            sidebarStatus === "notice_period"
                              ? emp.planned_last_working_date
                              : getLastWorkingDate(emp)
                          )}
                        </td>
                      </>
                    )}

                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(emp.status)}`}
                      >
                        {(emp.status || 'unknown').replace('_', ' ')}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/employees/${emp.id}`}
                          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleDownloadEmployee(emp)}
                        className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        title="Download Employee Document"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={(isFilterActive ? 1 : 0) +8 +(showExitDetails ? 2 : 0)}
                    className="px-6 py-16 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <UserCircle className="h-6 w-6" />
                      </div>

                      <p className="text-base font-bold text-slate-800">
                        No employees found
                      </p>

                      <p className="mt-1 max-w-sm text-xs text-slate-400">
                        Adjust your search query or reset filter selections to view registered employees.
                      </p>
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
