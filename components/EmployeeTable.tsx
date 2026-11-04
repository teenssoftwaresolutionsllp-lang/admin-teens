"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import companiesData from "@/data/companies.json"
import Link from "next/link"
import Image from "next/image"
import { Employee, Department, UserRole } from "@/lib/types"
import {
  Eye,
  UserCircle,
  Download,
} from "lucide-react"

const companies = companiesData.companies

interface EmployeeTableProps {
  employees: Employee[]
  departments: Department[]
  role: UserRole
}

type EmployeeFilterRecord = Employee & {
  client_type?: string | null
  marital_status?: string | null
  blood_group?: string | null
  work_location?: string | null
  notice_status?: string | null
  date_of_birth?: string | null
  planned_last_working_date?: string | null
  resignation_date?: string | null
  probation_duration?: number | null
  probation_end_date?: string | null
  confirmation_date?: string | null
  appointment_date?: string | null
  pf_eligible?: boolean | null
  esi_eligible?: boolean | null
  esi_healthcare_eligible?: boolean | null
  pt_eligible?: boolean | null
  tds_eligible?: boolean | null
  project_id?: string | null
  project?: { id?: string; name?: string } | null
  exit_date?: string | null
  notice_period_days?: number | null
  experience_level?: "fresher" | "experienced" | null
  total_experience_years?: number | null
  total_experience_months?: number | null
}

const companyOptions = [
  "Flipkart",
  "HCLTech",
  "Mphasis",
  "Tata Consultancy Services",
  "Tech Mahindra",
  "Tiger Analytics",
  "Wingify",
  "Wipro",
]


const designationOptions = [
  "Account",
  "Back",
  "Backend",
  "Cloud",
  "cwehih",
  "Database",
  "Developer",
  "Digital",
  "Finacla",
  "Front",
  "Frontend",
  "frontendDeveloper",
  "jh",
  "Operations",
  "QA",
  "qs",
  "sa",
  "Sales",
  "Senior Full Stack Developer",
  "stock market",
  "UI",
  "UI/UX",
]

const employmentTypeOptions = [
  "full-time",
  "part-time",
  "contract",
  "intern",
]

const statusOptions = [
  "active",
  "on_notice",
  "resigned",
  "terminated",
  "laid_off",
]

const genderOptions = ["male", "female", "other"]

const locationOptions = ["On-site", "Hybrid", "Remote"];

const clientTypeOptions = ["in-house", "outsource"]

const maritalStatusOptions = [
  "single",
  "married",
  "divorced",
  "widowed",
]

const bloodGroupOptions = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
]

const noticeStatusOptions = [
  "notice_period",
  "notice_completed",
  "early_release",
]

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

const uniqueOptions = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )

const formatOptionLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function EmployeeTable({
  employees,
  departments,
  role,
}: EmployeeTableProps) {
  const searchParams = useSearchParams()
  const sidebarStatus = searchParams.get("status") || "all"
  const sidebarNotice = searchParams.get("notice")
  const isAllSubmenu = sidebarStatus === "all"

  // Existing filters
  const [searchTerm, setSearchTerm] = useState("")
  const [compFilter, setCompFilter] = useState("all")
  const [deptFilter, setDeptFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [activeFilterTab, setActiveFilterTab] = useState("employee")


  // Additional filters - All view only
  const [designationFilter, setDesignationFilter] = useState("all")
  const [experienceLevelFilter, setExperienceLevelFilter] = useState("all")
  const [experienceYearsMin, setExperienceYearsMin] = useState("")
  const [experienceYearsMax, setExperienceYearsMax] = useState("")
  const [experienceMonthsMin, setExperienceMonthsMin] = useState("")
  const [experienceMonthsMax, setExperienceMonthsMax] = useState("")
  const [genderFilter, setGenderFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [clientTypeFilter, setClientTypeFilter] = useState("all")
  const [maritalFilter, setMaritalFilter] = useState("all")
  const [bloodGroupFilter, setBloodGroupFilter] = useState("all")
  const [noticeFilter, setNoticeFilter] = useState("all")
  const [dobFrom, setDobFrom] = useState("")
  const [dobTo, setDobTo] = useState("")
  const [salaryMin, setSalaryMin] = useState("")
  const [salaryMax, setSalaryMax] = useState("")
  const [pfFilter, setPfFilter] = useState("all")
  const [esiFilter, setEsiFilter] = useState("all")
  const [ptFilter, setPtFilter] = useState("all")
  const [tdsFilter, setTdsFilter] = useState("all")
  const [projectFilter, setProjectFilter] = useState("all")
  const [appointmentDateFrom, setAppointmentDateFrom] = useState("")
  const [appointmentDateTo, setAppointmentDateTo] = useState("")
  const [confirmationDateFrom, setConfirmationDateFrom] = useState("")
  const [confirmationDateTo, setConfirmationDateTo] = useState("")
  const [probationEndFrom, setProbationEndFrom] = useState("")
  const [probationEndTo, setProbationEndTo] = useState("")
  const [probationDurationMin, setProbationDurationMin] = useState("")
  const [probationDurationMax, setProbationDurationMax] = useState("")
  const [noticeDaysMin, setNoticeDaysMin] = useState("")
  const [noticeDaysMax, setNoticeDaysMax] = useState("")
  const [resignationDateFrom, setResignationDateFrom] = useState("")
  const [resignationDateTo, setResignationDateTo] = useState("")
  const [exitDateFrom, setExitDateFrom] = useState("")
  const [exitDateTo, setExitDateTo] = useState("")

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
  }

  const showExitDetails = [
    "terminated",
    "laid_off",
    "resigned",
    "notice_period",
    "notice_completed",
    "early_release",
  ].includes(sidebarStatus)

  // Keep the additional filter options available even if there are
  // currently no employees with those values.
  const availableCompanies = uniqueOptions([
    ...companyOptions,
    ...companies.map((company) => company.company_name),
    ...employees.map((employee) => employee.company_name || ""),
  ])

  const availableDesignations = uniqueOptions([
    ...designationOptions,
    ...employees.map((employee) => employee.designation || ""),
  ])

  const availableEmploymentTypes = uniqueOptions([
    ...employmentTypeOptions,
    ...employees.map((employee) => employee.employment_type || ""),
  ])

  const availableDepartments = departments
  const availableProjects = Array.from(
    new Map(
      employees
        .filter((employee) => employee.project_id)
        .map((employee) => {
          const emp = employee as EmployeeFilterRecord
          return [
            emp.project_id as string,
            {
              id: emp.project_id as string,
              name: emp.project?.name || emp.project_id as string,
            },
          ] as const
        })
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const handleClearFilters = () => {
    setSearchTerm("")
    setCompFilter("all")
    setDeptFilter("all")
    setStatusFilter(isAllSubmenu ? "all" : sidebarStatus)
    setTypeFilter("all")
    setFromDate("")
    setToDate("")
    setSelectedEmployees([])

    // Reset additional All-view filters
    setDesignationFilter("all")
    setGenderFilter("all")
    setLocationFilter("all")
    setClientTypeFilter("all")
    setMaritalFilter("all")
    setBloodGroupFilter("all")
    setExperienceLevelFilter("all")
    setExperienceYearsMin("")
    setExperienceYearsMax("")
    setExperienceMonthsMin("")
    setExperienceMonthsMax("")
    setNoticeFilter("all")
    setDobFrom("")
    setDobTo("")
    setSalaryMin("")
    setSalaryMax("")
    setPfFilter("all")
    setEsiFilter("all")
    setPtFilter("all")
    setTdsFilter("all")
    setProjectFilter("all")
    setAppointmentDateFrom("")
    setAppointmentDateTo("")
    setConfirmationDateFrom("")
    setConfirmationDateTo("")
    setProbationEndFrom("")
    setProbationEndTo("")
    setProbationDurationMin("")
    setProbationDurationMax("")
    setNoticeDaysMin("")
    setNoticeDaysMax("")
    setResignationDateFrom("")
    setResignationDateTo("")
    setExitDateFrom("")
    setExitDateTo("")
  }

  useEffect(() => {
    const statusFromUrl = searchParams.get("status") || "all"
    setStatusFilter(statusFromUrl)
  }, [searchParams])

  const additionalFiltersActive =
    designationFilter !== "all" ||
    genderFilter !== "all" ||
    locationFilter !== "all" ||
    clientTypeFilter !== "all" ||
    maritalFilter !== "all" ||
    bloodGroupFilter !== "all" ||
    noticeFilter !== "all" ||
    dobFrom !== "" ||
    dobTo !== "" ||
    salaryMin !== "" ||
    salaryMax !== "" ||
    pfFilter !== "all" ||
    esiFilter !== "all" ||
    ptFilter !== "all" ||
    tdsFilter !== "all" ||
    projectFilter !== "all" ||
    appointmentDateFrom !== "" || appointmentDateTo !== "" ||
    experienceLevelFilter !== "all" ||
    experienceYearsMin !== "" ||
    experienceYearsMax !== "" ||
    experienceMonthsMin !== "" ||
    experienceMonthsMax !== "" ||
    confirmationDateFrom !== "" || confirmationDateTo !== "" ||
    probationEndFrom !== "" || probationEndTo !== "" ||
    probationDurationMin !== "" || probationDurationMax !== "" ||
    noticeDaysMin !== "" || noticeDaysMax !== "" ||
    resignationDateFrom !== "" || resignationDateTo !== "" ||
    exitDateFrom !== "" || exitDateTo !== ""

  const isFilterActive =
    searchTerm.trim() !== "" ||
    compFilter !== "all" ||
    deptFilter !== "all" ||
    (isAllSubmenu && statusFilter !== "all") ||
    typeFilter !== "all" ||
    (fromDate !== "" || toDate !== "") ||
    (isAllSubmenu && additionalFiltersActive)

  const getStatusBadge = (status: string) => {
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

  const getEmployeeStatusLabel = (emp: Employee): string => {
    const details = emp as EmployeeFilterRecord
    const status = normalize(emp.status)
    const noticeStatus = normalize(details.notice_status || "")

    if (status === "on_notice" || noticeStatus === "notice_period") {
      return "On Notice"
    }

    if (noticeStatus === "notice_completed") {
      return "Notice Completed"
    }

    if (noticeStatus === "early_release") {
      return "Early Released"
    }

    return formatOptionLabel(status || "unknown")
  }

  const getEmployeeStatusBadge = (emp: Employee): string => {
    const details = emp as EmployeeFilterRecord
    const status = normalize(emp.status)
    const noticeStatus = normalize(details.notice_status || "")

    if (status === "on_notice" || noticeStatus === "notice_period") {
      return "bg-amber-50 text-amber-700 border-amber-200"
    }

    if (noticeStatus === "notice_completed") {
      return "bg-blue-50 text-blue-700 border-blue-200"
    }

    if (noticeStatus === "early_release") {
      return "bg-purple-50 text-purple-700 border-purple-200"
    }

    return getStatusBadge(status)
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A"

    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTotalExperience = (emp: Employee): string => {
    const details = emp as EmployeeFilterRecord

    if (!details.experience_level) return "—"

    if (details.experience_level === "fresher") {
      return "0 Years 0 Months"
    }

    if (
      details.total_experience_years == null &&
      details.total_experience_months == null
    ) {
      return "—"
    }

    const years = details.total_experience_years ?? 0
    const months = details.total_experience_months ?? 0

    return `${years} Year${years !== 1 ? "s" : ""} ${months} Month${months !== 1 ? "s" : ""}`
  }

  const getLastWorkingDate = (emp: Employee): string | null => {
    const details = emp as EmployeeFilterRecord
    const status = normalize(emp.status)
    const noticeStatus = normalize(details.notice_status || "")

    if (
      status === "on_notice" ||
      (status === "resigned" && noticeStatus === "notice_period")
    ) {
      return details.planned_last_working_date || null
    }

    const exitStatuses = [
      "resigned",
      "resignation",
      "terminated",
      "laid_off",
    ]

    if (exitStatuses.includes(status)) {
      return details.exit_date || details.planned_last_working_date || null
    }

    return null
  }

  const getYearsWorked = (emp: Employee): string => {
    if (!emp.joining_date) return "N/A"

    const lastWorkingDate = getLastWorkingDate(emp)
    const startDate = new Date(emp.joining_date)
    const endDate = lastWorkingDate
      ? new Date(lastWorkingDate)
      : new Date()

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      return "N/A"
    }

    let years = endDate.getFullYear() - startDate.getFullYear()
    let months = endDate.getMonth() - startDate.getMonth()

    if (endDate.getDate() < startDate.getDate()) {
      months--
    }

    if (months < 0) {
      years--
      months += 12
    }

    return `${years} yr${years !== 1 ? "s" : ""} ${months} mo`
  }

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase()

  const getDepartmentName = (employee: Employee) =>
    employee.department?.name ||
    departments.find(
      (department) => department.id === employee.department_id
    )?.name ||
    "General"

  const renderSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: string[],
    allLabel?: string
  ) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={filterInputClass}
      >
        <option value="all">{allLabel || `All ${label}s`}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  )

  const renderEligibilitySelect = (
    label: string,
    value: string,
    onChange: (value: string) => void
  ) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={filterInputClass}
      >
        <option value="all">All</option>
        <option value="yes">Eligible</option>
        <option value="no">Not Eligible</option>
      </select>
    </div>
  )

  const filterInputClass =
    "w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"

  const renderDateRange = (
    label: string,
    fromValue: string,
    setFromValue: (value: string) => void,
    toValue: string,
    setToValue: (value: string) => void
  ) => (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <input aria-label={`${label} from`} type="date" value={fromValue} onChange={(event) => setFromValue(event.target.value)} className={filterInputClass} />
        <input aria-label={`${label} to`} type="date" min={fromValue || undefined} value={toValue} onChange={(event) => setToValue(event.target.value)} className={filterInputClass} />
      </div>
    </div>
  )

  const renderNumberRange = (
    label: string,
    minValue: string,
    setMinValue: (value: string) => void,
    maxValue: string,
    setMaxValue: (value: string) => void,
    suffix = ""
  ) => (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}{suffix ? ` (${suffix})` : ""}</label>
      <div className="grid grid-cols-2 gap-2">
        <input aria-label={`${label} minimum`} type="number" min="0" placeholder="Min" value={minValue} onChange={(event) => setMinValue(event.target.value)} className={filterInputClass} />
        <input aria-label={`${label} maximum`} type="number" min={minValue || "0"} placeholder="Max" value={maxValue} onChange={(event) => setMaxValue(event.target.value)} className={filterInputClass} />
      </div>
    </div>
  )

  // Download one employee's details as DOCX.
  const handleDownloadEmployee = async (emp: Employee) => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } =
        await import("docx")

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "EMPLOYEE DETAILS",
                heading: HeadingLevel.TITLE,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Personal Information",
                    bold: true,
                    size: 28,
                  }),
                ],
              }),
              new Paragraph(`Employee ID: ${emp.employee_id || "N/A"}`),
              new Paragraph(`First Name: ${emp.first_name || "N/A"}`),
              new Paragraph(`Last Name: ${emp.last_name || "N/A"}`),
              new Paragraph(`Email: ${emp.email || "N/A"}`),
              new Paragraph(`Phone: ${emp.phone || "N/A"}`),
              new Paragraph(`Date of Birth: ${formatDate(emp.date_of_birth)}`),
              new Paragraph(`Gender: ${emp.gender || "N/A"}`),
              new Paragraph(`Blood Group: ${emp.blood_group || "N/A"}`),
              new Paragraph(`Marital Status: ${emp.marital_status || "N/A"}`),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Employment Information",
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { before: 300 },
              }),
              new Paragraph(`Department: ${getDepartmentName(emp)}`),
              new Paragraph(`Designation: ${emp.designation || "N/A"}`),
              new Paragraph(`Employment Type: ${emp.employment_type || "N/A"}`),
              new Paragraph(`Experience Level: ${(emp as EmployeeFilterRecord).experience_level? (emp as EmployeeFilterRecord).experience_level === "fresher"? "Fresher": "Experienced": "N/A"}`),
              new Paragraph(`Total Experience: ${formatTotalExperience(emp)}`),
              new Paragraph(`Joining Date: ${formatDate(emp.joining_date)}`),
              new Paragraph(`Probation End Date: ${formatDate(emp.probation_end_date)}`),
              new Paragraph(`Confirmation Date: ${formatDate(emp.confirmation_date)}`),
              new Paragraph(`Reporting Manager: ${emp.reporting_manager || "N/A"}`),
              new Paragraph(`Work Location: ${emp.work_location || "N/A"}`),
              new Paragraph(`Client Type: ${emp.client_type || "N/A"}`),
              new Paragraph(`Company: ${emp.company_name || "N/A"}`),
              new Paragraph(`CTC: ₹${emp.salary || "N/A"}`),
              new Paragraph(`ESI Number: ${emp.esi_number || "N/A"}`),
              new Paragraph(`Status: ${getEmployeeStatusLabel(emp)}`),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Bank & Identity Information",
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { before: 300 },
              }),
              new Paragraph(`Bank Name: ${emp.bank_name || "N/A"}`),
              new Paragraph(`Bank Account Number: ${emp.bank_account_number || "N/A"}`),
              new Paragraph(`IFSC Code: ${emp.ifsc_code || "N/A"}`),
              new Paragraph(`PAN Number: ${emp.pan_number || "N/A"}`),
              new Paragraph(`Aadhaar Number: ${emp.aadhar_number || "N/A"}`),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Address Information",
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { before: 300 },
              }),
              new Paragraph(`Permanent Address: ${emp.permanent_address || "N/A"}`),
              new Paragraph(`Permanent City: ${emp.permanent_city || "N/A"}`),
              new Paragraph(`Permanent State: ${emp.permanent_state || "N/A"}`),
              new Paragraph(`Permanent Pincode: ${emp.permanent_pincode || "N/A"}`),
              new Paragraph(`Temporary Address: ${emp.temporary_address || "N/A"}`),
              new Paragraph(`Temporary City: ${emp.temporary_city || "N/A"}`),
              new Paragraph(`Temporary State: ${emp.temporary_state || "N/A"}`),
              new Paragraph(`Temporary Pincode: ${emp.temporary_pincode || "N/A"}`),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Emergency Contact",
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { before: 300 },
              }),
              new Paragraph(`Contact Name: ${emp.emergency_contact_name || "N/A"}`),
              new Paragraph(`Contact Phone: ${emp.emergency_contact_phone || "N/A"}`),
              new Paragraph(`Relation: ${emp.emergency_contact_relation || "N/A"}`),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")

      link.href = url
      link.download = `${emp.employee_id || `${emp.first_name}-${emp.last_name}`}-Employee.docx`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to generate employee document:", error)
    }
  }

  // All-view filters are applied only when the All submenu is selected.
  const filteredEmployees = employees.filter((employee) => {
    const emp = employee as EmployeeFilterRecord
    const searchString = searchTerm.trim().toLowerCase()

    const matchesSearch =
      !searchString ||
      `${emp.first_name || ""} ${emp.last_name || ""}`
        .toLowerCase()
        .includes(searchString) ||
      (emp.email || "").toLowerCase().includes(searchString) ||
      (emp.employee_id || "").toLowerCase().includes(searchString) ||
      (emp.phone || "").toLowerCase().includes(searchString)

    const matchesDept =
      deptFilter === "all" || emp.department_id === deptFilter

    const normalizedEmployeeStatus = normalize(emp.status)
    const employeeNoticeStatus = normalize(emp.notice_status || "")
    const effectiveStatus = isAllSubmenu ? statusFilter : sidebarStatus

    const isResignationEmployee =
      (
        normalizedEmployeeStatus === "resigned" ||
        normalizedEmployeeStatus === "on_notice"
      )

    const matchesStatus =
      effectiveStatus === "all" ||
      (effectiveStatus === "joining" &&
        normalizedEmployeeStatus === "active") ||
      (effectiveStatus === "resigned" &&
        isResignationEmployee &&
        (
          !sidebarNotice ||
          employeeNoticeStatus === normalize(sidebarNotice)
        )) ||
      (effectiveStatus === "on_notice" &&
        (
          normalizedEmployeeStatus === "on_notice" ||
          (
            normalizedEmployeeStatus === "resigned" &&
            employeeNoticeStatus === "notice_period"
          )
        )) ||
      (effectiveStatus === "notice_period" &&
        isResignationEmployee &&
        employeeNoticeStatus === "notice_period") ||
      (effectiveStatus === "notice_completed" &&
        normalizedEmployeeStatus === "resigned" &&
        employeeNoticeStatus === "notice_completed") ||
      (effectiveStatus === "early_release" &&
        normalizedEmployeeStatus === "resigned" &&
        employeeNoticeStatus === "early_release") ||
      (
        ![
          "resigned",
          "on_notice",
          "notice_period",
          "notice_completed",
          "early_release",
        ].includes(effectiveStatus) &&
        normalizedEmployeeStatus === normalize(effectiveStatus)
      )

    const matchesType =
      typeFilter === "all" ||
      normalize(emp.employment_type) === normalize(typeFilter)

    const matchesCompany =
      compFilter === "all" ||
      normalize(emp.company_name) === normalize(compFilter)

    let filterDate: string | null | undefined

    switch (effectiveStatus) {
      case "joining":
      case "active":
        filterDate = emp.joining_date
        break

      case "resigned":
        filterDate =
          employeeNoticeStatus === "notice_period"
            ? emp.planned_last_working_date
            : emp.exit_date
        break

      case "terminated":
      case "laid_off":
      case "notice_completed":
      case "early_release":
        filterDate = emp.exit_date
        break

      case "notice_period":
      case "on_notice":
        filterDate = emp.planned_last_working_date
        break

      default:
        filterDate = undefined
    }

    const normalizedDate = filterDate?.slice(0, 10)

    const dateForRange = isAllSubmenu
      ? emp.joining_date?.slice(0, 10)
      : normalizedDate

    const matchesFromDate =
      !fromDate || (!!dateForRange && dateForRange >= fromDate)

    const matchesToDate =
      !toDate || (!!dateForRange && dateForRange <= toDate)

    // Do not apply the additional filters to any other sidebar view.
    if (!isAllSubmenu) {
      return (
        matchesSearch &&
        matchesDept &&
        matchesStatus &&
        matchesType &&
        matchesCompany &&
        matchesFromDate &&
        matchesToDate
      )
    }

    const matchesDesignation =
      designationFilter === "all" ||
      normalize(emp.designation) === normalize(designationFilter)

    const matchesGender =
      genderFilter === "all" ||
      normalize(emp.gender) === normalize(genderFilter)

    const matchesLocation =
      locationFilter === "all" ||
      normalize(emp.work_location) === normalize(locationFilter)

    const matchesClientType =
      clientTypeFilter === "all" ||
      normalize(emp.client_type) === normalize(clientTypeFilter)

    const matchesMaritalStatus =
      maritalFilter === "all" ||
      normalize(emp.marital_status) === normalize(maritalFilter)

    const matchesBloodGroup =
      bloodGroupFilter === "all" ||
      normalize(emp.blood_group) === normalize(bloodGroupFilter)

    const matchesNoticeStatus =
      noticeFilter === "all" ||
      normalize(emp.notice_status) === normalize(noticeFilter)

    const matchesProject =
      projectFilter === "all" || emp.project_id === projectFilter

    const matchesDateRange = (
      value: string | null | undefined,
      from: string,
      to: string
    ) => {
      const date = value?.slice(0, 10)
      if (!from && !to) return true
      if (!date) return false
      return (!from || date >= from) && (!to || date <= to)
    }

    const matchesAppointmentDate = matchesDateRange(
      emp.appointment_date, appointmentDateFrom, appointmentDateTo
    )
    const matchesConfirmationDate = matchesDateRange(
      emp.confirmation_date, confirmationDateFrom, confirmationDateTo
    )
    const matchesProbationEndDate = matchesDateRange(
      emp.probation_end_date, probationEndFrom, probationEndTo
    )
    const matchesResignationDate = matchesDateRange(
      emp.resignation_date, resignationDateFrom, resignationDateTo
    )
    const matchesExitDate = matchesDateRange(
      emp.exit_date, exitDateFrom, exitDateTo
    )

    const matchesNumericRange = (
      value: number | null | undefined,
      min: string,
      max: string
    ) => {
      if (!min && !max) return true
      if (value == null || !Number.isFinite(Number(value))) return false
      return (!min || Number(value) >= Number(min)) &&
        (!max || Number(value) <= Number(max))
    }

    const matchesProbationDuration = matchesNumericRange(
      emp.probation_duration, probationDurationMin, probationDurationMax
    )
    const matchesNoticeDays = matchesNumericRange(
      emp.notice_period_days, noticeDaysMin, noticeDaysMax
    )

    const matchesExperienceLevel = experienceLevelFilter === "all" || normalize(emp.experience_level) === normalize(experienceLevelFilter)

    const matchesExperienceYears = matchesNumericRange(
      emp.total_experience_years,
      experienceYearsMin,
      experienceYearsMax
    )

    const matchesExperienceMonths = matchesNumericRange(
      emp.total_experience_months,
      experienceMonthsMin,
      experienceMonthsMax
    )

    const dob = emp.date_of_birth?.slice(0, 10)

    const matchesDobFrom = !dobFrom || (!!dob && dob >= dobFrom)

    const matchesDobTo = !dobTo || (!!dob && dob <= dobTo)

    const salary = emp.salary

    const matchesSalaryMin = !salaryMin || (salary != null && Number(salary) >= Number(salaryMin))

    const matchesSalaryMax = !salaryMax || (salary != null && Number(salary) <= Number(salaryMax))

    const matchesEligibility = (
      filterValue: string,
      field: boolean | null | undefined
    ) => {
      if (filterValue === "all") return true
      if (filterValue === "yes") return field === true
      if (filterValue === "no") return field === false
      return true
    }

    return (
      matchesSearch &&
      matchesDept &&
      matchesStatus &&
      matchesType &&
      matchesCompany &&
      matchesDesignation &&
      matchesGender &&
      matchesLocation &&
      matchesClientType &&
      matchesMaritalStatus &&
      matchesBloodGroup &&
      matchesNoticeStatus &&
      matchesProject &&
      matchesAppointmentDate &&
      matchesConfirmationDate &&
      matchesProbationEndDate &&
      matchesProbationDuration &&
      matchesNoticeDays &&
      matchesResignationDate &&
      matchesExitDate &&
      matchesDobFrom &&
      matchesDobTo &&
      matchesExperienceLevel &&
      matchesExperienceYears &&
      matchesExperienceMonths &&
      matchesSalaryMin &&
      matchesSalaryMax &&
      matchesEligibility(pfFilter, emp.pf_eligible) &&
      matchesEligibility(esiFilter, emp.esi_healthcare_eligible) &&
      matchesEligibility(ptFilter, emp.pt_eligible) &&
      matchesEligibility(tdsFilter, emp.tds_eligible)
    )
  })

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);

  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );


  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    compFilter,
    deptFilter,
    statusFilter,
    typeFilter,
    projectFilter,
    designationFilter,
    genderFilter,
    maritalFilter,
    bloodGroupFilter,
    locationFilter,
    clientTypeFilter,
    noticeFilter,
    fromDate,
    toDate,
    dobFrom,
    dobTo,
    experienceLevelFilter,
    experienceYearsMin,
    experienceYearsMax,
    experienceMonthsMin,
    experienceMonthsMax,
  ]);

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

  // Download selected employees as one DOCX.
  const handleDownloadSelectedEmployees = async () => {
    const employeesToDownload = filteredEmployees.filter((emp) =>
      selectedEmployees.includes(emp.id)
    )

    if (employeesToDownload.length === 0) {
      alert("Please select at least one employee.")
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
      } = await import("docx")

      const children: any[] = []

      employeesToDownload.forEach((emp, index) => {
        children.push(
          new Paragraph({
            text: "EMPLOYEE DETAILS",
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${emp.first_name || ""} ${emp.last_name || ""}`,
                bold: true,
                size: 30,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Personal Information",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph(`Employee ID: ${emp.employee_id || "N/A"}`),
          new Paragraph(`First Name: ${emp.first_name || "N/A"}`),
          new Paragraph(`Last Name: ${emp.last_name || "N/A"}`),
          new Paragraph(`Email: ${emp.email || "N/A"}`),
          new Paragraph(`Phone: ${emp.phone || "N/A"}`),
          new Paragraph(`Date of Birth: ${formatDate(emp.date_of_birth)}`),
          new Paragraph(`Gender: ${emp.gender || "N/A"}`),
          new Paragraph(`Blood Group: ${emp.blood_group || "N/A"}`),
          new Paragraph(`Marital Status: ${emp.marital_status || "N/A"}`),
          new Paragraph({
            children: [
              new TextRun({
                text: "Employment Information",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { before: 300 },
          }),
          new Paragraph(`Department: ${getDepartmentName(emp)}`),
          new Paragraph(`Designation: ${emp.designation || "N/A"}`),
          new Paragraph(`Employment Type: ${emp.employment_type || "N/A"}`),
          new Paragraph(`Experience Level: ${(emp as EmployeeFilterRecord).experience_level? (emp as EmployeeFilterRecord).experience_level === "fresher"? "Fresher": "Experienced": "N/A"}`),
          new Paragraph(`Total Experience: ${formatTotalExperience(emp)}`),
          new Paragraph(`Joining Date: ${formatDate(emp.joining_date)}`),
          new Paragraph(`Probation End Date: ${formatDate(emp.probation_end_date)}`),
          new Paragraph(`Confirmation Date: ${formatDate(emp.confirmation_date)}`),
          new Paragraph(`Reporting Manager: ${emp.reporting_manager || "N/A"}`),
          new Paragraph(`Work Location: ${emp.work_location || "N/A"}`),
          new Paragraph(`Client Type: ${emp.client_type || "N/A"}`),
          new Paragraph(`Company: ${emp.company_name || "N/A"}`),
          new Paragraph(`CTC: ₹${emp.salary || "N/A"}`),
          new Paragraph(`ESI Number: ${emp.esi_number || "N/A"}`),
          new Paragraph(`Status: ${getEmployeeStatusLabel(emp)}`),
          new Paragraph({
            children: [
              new TextRun({
                text: "Bank & Identity Information",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { before: 300 },
          }),
          new Paragraph(`Bank Name: ${emp.bank_name || "N/A"}`),
          new Paragraph(`Bank Account Number: ${emp.bank_account_number || "N/A"}`),
          new Paragraph(`IFSC Code: ${emp.ifsc_code || "N/A"}`),
          new Paragraph(`PAN Number: ${emp.pan_number || "N/A"}`),
          new Paragraph(`Aadhaar Number: ${emp.aadhar_number || "N/A"}`),
          new Paragraph({
            children: [
              new TextRun({
                text: "Address Information",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { before: 300 },
          }),
          new Paragraph(`Permanent Address: ${emp.permanent_address || "N/A"}`),
          new Paragraph(`Permanent City: ${emp.permanent_city || "N/A"}`),
          new Paragraph(`Permanent State: ${emp.permanent_state || "N/A"}`),
          new Paragraph(`Permanent Pincode: ${emp.permanent_pincode || "N/A"}`),
          new Paragraph(`Temporary Address: ${emp.temporary_address || "N/A"}`),
          new Paragraph(`Temporary City: ${emp.temporary_city || "N/A"}`),
          new Paragraph(`Temporary State: ${emp.temporary_state || "N/A"}`),
          new Paragraph(`Temporary Pincode: ${emp.temporary_pincode || "N/A"}`),
          new Paragraph({
            children: [
              new TextRun({
                text: "Emergency Contact",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { before: 300 },
          }),
          new Paragraph(`Contact Name: ${emp.emergency_contact_name || "N/A"}`),
          new Paragraph(`Contact Phone: ${emp.emergency_contact_phone || "N/A"}`),
          new Paragraph(`Relation: ${emp.emergency_contact_relation || "N/A"}`)
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
      const link = document.createElement("a")

      link.href = url

      const companyName =
        compFilter !== "all"
          ? compFilter.replace(/[^a-zA-Z0-9]/g, "-")
          : "Employees"

      link.download = `${companyName}-Employee-Details.docx`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to generate employee document:", error)
      alert("Failed to generate employee document.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      {isAllSubmenu ? (
        <div className="relative z-30 w-full shrink-0 bg-white">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Header */}
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Employee Directory Filters
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Select a category to view its filters.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    {filteredEmployees.length} matching employees
                  </span>

                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </div>

            {/* Search - Always visible */}
            <div className="border-b border-slate-200 p-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Search Employees
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, employee ID, email or phone..."
                className={filterInputClass}
              />
            </div>

            {/* Filter Category Tabs */}
            <div className="overflow-x-auto border-b border-slate-200">
              <div className="flex min-w-max gap-1 px-3 pt-3">
                {[
                  { id: "employee", label: "Employee Details" },
                  { id: "personal", label: "Personal Details" },
                  { id: "employment", label: "Employment Details" },
                  { id: "exit", label: "Exit Details" },
                  { id: "statutory", label: "Statutory Eligibility" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilterTab(tab.id)}
                    className={`rounded-t-lg border-b-2 px-4 py-3 text-xs font-semibold transition ${
                      activeFilterTab === tab.id
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Tab Filters */}
            <div className="min-h-[150px] p-4">
              {activeFilterTab === "employee" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {renderSelect("Company", compFilter, setCompFilter, availableCompanies, "All Companies")}

                  <div className="min-w-0">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Department
                    </label>
                    <select
                      value={deptFilter}
                      onChange={(event) => setDeptFilter(event.target.value)}
                      className={filterInputClass}
                    >
                      <option value="all">All Departments</option>
                      {availableDepartments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Project
                    </label>
                    <select
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                      className={filterInputClass}
                    >
                      <option value="all">All Projects</option>
                      {availableProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {renderSelect("Designation", designationFilter, setDesignationFilter, availableDesignations, "All Designations")}
                  {renderSelect("Status", statusFilter, setStatusFilter, statusOptions, "All Statuses")}
                  {renderSelect("Employment Type", typeFilter, setTypeFilter, availableEmploymentTypes, "All Types")}
                  {renderSelect("Client Type", clientTypeFilter, setClientTypeFilter, clientTypeOptions, "All Client Types")}
                  {renderSelect("Notice Status", noticeFilter, setNoticeFilter, noticeStatusOptions, "All Notice Statuses")}
                </div>
              )}

              {activeFilterTab === "personal" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {renderSelect("Gender", genderFilter, setGenderFilter, genderOptions)}
                  {renderSelect("Marital Status", maritalFilter, setMaritalFilter, maritalStatusOptions)}
                  {renderSelect("Blood Group", bloodGroupFilter, setBloodGroupFilter, bloodGroupOptions)}
                  {renderSelect("Work Location", locationFilter, setLocationFilter, locationOptions)}
                  {renderDateRange("Date of Birth", dobFrom, setDobFrom, dobTo, setDobTo)}
                </div>
              )}

              {activeFilterTab === "employment" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {renderDateRange("Joining Date", fromDate, setFromDate, toDate, setToDate)}
                  {renderDateRange("Appointment Date", appointmentDateFrom, setAppointmentDateFrom, appointmentDateTo, setAppointmentDateTo)}
                  {renderDateRange("Confirmation Date", confirmationDateFrom, setConfirmationDateFrom, confirmationDateTo, setConfirmationDateTo)}
                  {renderDateRange("Probation End Date", probationEndFrom, setProbationEndFrom, probationEndTo, setProbationEndTo)}
                  {renderNumberRange("Probation Duration", probationDurationMin, setProbationDurationMin, probationDurationMax, setProbationDurationMax, "months")}
                  {renderSelect("Experience Level", experienceLevelFilter, setExperienceLevelFilter, ["fresher", "experienced"], "All Experience Levels")}
                  {renderNumberRange("Experience Years", experienceYearsMin, setExperienceYearsMin, experienceYearsMax, setExperienceYearsMax,"years")}
                  {renderNumberRange("Experience Months",experienceMonthsMin,setExperienceMonthsMin,experienceMonthsMax,setExperienceMonthsMax,"months")}
                  {renderNumberRange("Notice Period Days", noticeDaysMin, setNoticeDaysMin, noticeDaysMax, setNoticeDaysMax, "days")}
                  {renderNumberRange("Salary", salaryMin, setSalaryMin, salaryMax, setSalaryMax, "₹")}
                </div>
              )}

              {activeFilterTab === "exit" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {renderDateRange("Resignation Date", resignationDateFrom, setResignationDateFrom, resignationDateTo, setResignationDateTo)}
                  {renderDateRange("Exit Date", exitDateFrom, setExitDateFrom, exitDateTo, setExitDateTo)}
                </div>
              )}

              {activeFilterTab === "statutory" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {renderEligibilitySelect("PF Eligibility", pfFilter, setPfFilter)}
                  {renderEligibilitySelect("ESI Healthcare Eligibility", esiFilter, setEsiFilter)}
                  {renderEligibilitySelect("PT Eligibility", ptFilter, setPtFilter)}
                  {renderEligibilitySelect("TDS Eligibility", tdsFilter, setTdsFilter)}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Keep your existing other-sidebar-views JSX exactly as it is.
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {/* Keep the existing Filter Employees section here unchanged */}
        </div>
      )}

      {/* Employee directory results */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-slate-900">Employee Directory</h3>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                {filteredEmployees.length} {filteredEmployees.length === 1 ? "employee" : "employees"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">View employee profiles, employment information and account status.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isFilterActive && (
              <>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedEmployees.length} selected
                </span>
                {selectedEmployees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedEmployees([])}
                    className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    Clear selection
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadSelectedEmployees}
                  disabled={selectedEmployees.length === 0 || isDownloading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Download className="h-4 w-4" />
                  {isDownloading ? "Generating DOCX..." : `Download Selected${selectedEmployees.length ? ` (${selectedEmployees.length})` : ""}`}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className={`w-full ${isAllSubmenu ? "min-w-[3000px]" : "min-w-[980px]"} border-separate border-spacing-0 text-left`}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50">
                {isFilterActive && (
                  <th className="w-12 border-b border-slate-200 px-5 py-3.5">
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && filteredEmployees.every((emp) => selectedEmployees.includes(emp.id))}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      title="Select all filtered employees"
                    />
                  </th>
                )}
                <th className="border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Employee</th>
                <th className="border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Employee ID</th>
                <th className="border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Department</th>
                <th className="border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Designation</th>
                <th className="border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Joining Date</th>
                {isAllSubmenu && (
                  <>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Project</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Gender</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Date of Birth</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Work Location</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Client Type</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Marital Status</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Blood Group</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Salary / CTC</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Appointment Date</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Confirmation Date</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Probation Duration</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Experience Level</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Total Experience</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Probation End Date</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Notice Period (Days)</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Notice Status</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Resignation Date</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Exit Date</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">PF</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">ESI Healthcare</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">PT</th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">TDS</th>
                  </>
                )}
                {showExitDetails && (
                  <>
                    <th className="border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Years Worked</th>
                    <th className="border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Last Working Date</th>
                  </>
                )}
                <th className="border-b border-slate-200 px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Status</th>
                <th className="border-b border-slate-200 px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length > 0 ? (
                paginatedEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className={`group transition-colors hover:bg-indigo-50/35 ${selectedEmployees.includes(emp.id) ? "bg-indigo-50/40" : "bg-white"}`}
                  >
                    {isFilterActive && (
                      <td className="border-b border-slate-100 px-5 py-4 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => handleSelectEmployee(emp.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label={`Select ${emp.first_name} ${emp.last_name}`}
                        />
                      </td>
                    )}
                    <td className="border-b border-slate-100 px-5 py-4">
                      <div className="flex min-w-[220px] items-center gap-3">
                        {emp.profile_photo_url ? (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 ring-2 ring-white">
                            <Image src={emp.profile_photo_url} alt={`${emp.first_name} ${emp.last_name}`} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white ring-2 ring-indigo-100">
                            {getInitials(emp.first_name, emp.last_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link href={`/dashboard/employees/${emp.id}`} className="block truncate text-sm font-bold text-slate-800 transition hover:text-indigo-700">
                            {emp.first_name} {emp.last_name}
                          </Link>
                          <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400">{emp.email || "No email available"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600">{emp.employee_id || "-"}</span>
                    </td>
                    <td className="border-b border-slate-100 px-5 py-4">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{getDepartmentName(emp)}</span>
                    </td>
                    <td className="border-b border-slate-100 px-5 py-4 text-sm font-medium text-slate-700">{emp.designation || "-"}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs font-medium text-slate-500">{formatDate(emp.joining_date)}</td>
                    {isAllSubmenu && (() => {
                      const details = emp as EmployeeFilterRecord
                      const eligibility = (value?: boolean | null) => (
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${value === true ? "bg-emerald-50 text-emerald-700" : value === false ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                          {value === true ? "Eligible" : value === false ? "No" : "—"}
                        </span>
                      )
                      return (
                        <>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-600">{details.project?.name || details.project_id || "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs capitalize text-slate-600">{details.gender || "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-500">{formatDate(details.date_of_birth)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-600">{details.work_location || "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs capitalize text-slate-600">{details.client_type || "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs capitalize text-slate-600">{details.marital_status || "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-600">{details.blood_group || "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs font-semibold text-slate-700">{details.salary != null ? `₹${Number(details.salary).toLocaleString("en-IN")}` : "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-500">{formatDate(details.appointment_date)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-500">{formatDate(details.confirmation_date)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-600">{details.probation_duration != null ? `${details.probation_duration} months` : "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs capitalize text-slate-600">{details.experience_level? details.experience_level === "fresher"? "Fresher": "Experienced": "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-600">{formatTotalExperience(emp)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-500">{formatDate(details.probation_end_date)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-600">{details.notice_period_days ?? "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs capitalize text-slate-600">{details.notice_status?.replace(/_/g, " ") || "—"}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-500">{formatDate(details.resignation_date)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs text-slate-500">{formatDate(details.exit_date)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4">{eligibility(details.pf_eligible)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4">{eligibility(details.esi_healthcare_eligible)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4">{eligibility(details.pt_eligible)}</td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4">{eligibility(details.tds_eligible)}</td>
                        </>
                      )
                    })()}
                    {showExitDetails && (
                      <>
                        <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs font-medium text-slate-600">{getYearsWorked(emp)}</td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs font-medium text-slate-500">{formatDate(getLastWorkingDate(emp))}</td>
                      </>
                    )}
                    <td className="border-b border-slate-100 px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getEmployeeStatusBadge(emp)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {getEmployeeStatusLabel(emp)}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/employees/${emp.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-100 hover:text-indigo-700" title="View employee details" aria-label={`View ${emp.first_name} ${emp.last_name}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button type="button" onClick={() => handleDownloadEmployee(emp)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-100 hover:text-indigo-700" title="Download employee document" aria-label={`Download ${emp.first_name} ${emp.last_name} details`}>
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={(isFilterActive ? 1 : 0) + 7 + (isAllSubmenu ? 23 : 0) + (showExitDetails ? 2 : 0)} className="px-6 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><UserCircle className="h-6 w-6" /></div>
                      <p className="text-sm font-bold text-slate-800">No employees found</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">No employees match the current filters. Try adjusting your search or clearing the filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">

          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {filteredEmployees.length === 0
                ? 0
                : (currentPage - 1) * ITEMS_PER_PAGE + 1}
            </span>
            {" "}to{" "}
            <span className="font-semibold text-slate-700">
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)}
            </span>
            {" "}of{" "}
            <span className="font-semibold text-slate-700">
              {filteredEmployees.length}
            </span>
            {" "}employees
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-xs font-semibold text-slate-600">
              Page {currentPage} of {Math.max(totalPages, 1)}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage >= totalPages || totalPages === 0}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
