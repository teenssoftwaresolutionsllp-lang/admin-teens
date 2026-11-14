"use client"

import { useEffect, useState } from "react"
import { usePathname,useRouter,useSearchParams } from "next/navigation"
import { exportToExcel } from "@/lib/excel/exportToExcel";
import companiesData from "@/data/companies.json"
import Link from "next/link"
import Image from "next/image"
import { Employee, Department, UserRole } from "@/lib/types"
import { useEmployeeDashboardFilter } from "@/components/dashboard/EmployeeFilterProvider";
import {
  Eye,
  UserCircle,
  Download,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Briefcase,
  User,
  ShieldCheck,
  LogOut,
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
  role = "hr",
}: EmployeeTableProps) {
  const searchParams = useSearchParams()
  const { dashboardFilter,clearDashboardFilter } = useEmployeeDashboardFilter();
  const pathname = usePathname()
  const router = useRouter()
  const sidebarStatus = searchParams.get("status") || "all"
  const sidebarNotice = searchParams.get("notice")
  const departmentFromUrl = searchParams.get("department") || ""
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
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false)


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

    // Remove the department URL filter as well.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("department");

    const queryString = params.toString();

    router.replace(
      queryString ? `${pathname}?${queryString}` : pathname
    );

    setCurrentPage(1);
    clearDashboardFilter();
  }

  useEffect(() => {
    if (dashboardFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter(dashboardFilter.status);
      setDeptFilter(dashboardFilter.departmentId ?? "unassigned");
      setCurrentPage(1);
      return;
    }

    setStatusFilter(sidebarStatus);

    // Restore the normal All Employees view when no sidebar
    // status filter or dashboard department selection is active.
    if (sidebarStatus === "all") {
      setDeptFilter("all");
    }

    setCurrentPage(1);
  }, [dashboardFilter, sidebarStatus]);

  useEffect(() => {
    // Dashboard department selection takes priority over URL filters.
    if (dashboardFilter) return;

    if (!departmentFromUrl) {
      if (sidebarStatus === "all") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDeptFilter("all");
      }
      return;
    }

    // Preserve support for older URL-based department filters.
    const matchedDepartment = departments.find(
      (department) =>
        normalize(department.name) === normalize(departmentFromUrl)
    );

    setDeptFilter(matchedDepartment?.id || "all");
  }, [dashboardFilter, departmentFromUrl, departments, sidebarStatus]);

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
    (role !== "hr" && projectFilter !== "all") ||
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
    (dashboardFilter?.joiningDateFrom != null ||
      dashboardFilter?.joiningDateTo != null) ||
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

  // Download one employee's details as excel.
  const handleDownloadEmployee = async (emp: Employee) => {
    try {
      const experienceLevel =
        (emp as EmployeeFilterRecord).experience_level === "fresher"
          ? "Fresher"
          : (emp as EmployeeFilterRecord).experience_level
            ? "Experienced"
            : "N/A";

      const employeeData: Record<string, unknown> = {
        employee_id: emp.employee_id || "N/A",
        first_name: emp.first_name || "N/A",
        last_name: emp.last_name || "N/A",
        email: emp.email || "N/A",
        phone: emp.phone || "N/A",
        date_of_birth: formatDate(emp.date_of_birth),
        gender: emp.gender || "N/A",
        blood_group: emp.blood_group || "N/A",
        marital_status: emp.marital_status || "N/A",

        department: getDepartmentName(emp),
        designation: emp.designation || "N/A",
        employment_type: emp.employment_type || "N/A",
        experience_level: experienceLevel,
        total_experience: formatTotalExperience(emp),
        joining_date: formatDate(emp.joining_date),
        probation_end_date: formatDate(emp.probation_end_date),
        confirmation_date: formatDate(emp.confirmation_date),
        reporting_manager: emp.reporting_manager || "N/A",
        work_location: emp.work_location || "N/A",
        client_type: emp.client_type || "N/A",
        company: emp.company_name || "N/A",
        ctc: emp.salary || "N/A",
        esi_number: emp.esi_number || "N/A",
        status: getEmployeeStatusLabel(emp),

        bank_name: emp.bank_name || "N/A",
        bank_account_number: emp.bank_account_number || "N/A",
        ifsc_code: emp.ifsc_code || "N/A",
        pan_number: emp.pan_number || "N/A",
        aadhar_number: emp.aadhar_number || "N/A",

        permanent_address: emp.permanent_address || "N/A",
        permanent_city: emp.permanent_city || "N/A",
        permanent_state: emp.permanent_state || "N/A",
        permanent_pincode: emp.permanent_pincode || "N/A",
        temporary_address: emp.temporary_address || "N/A",
        temporary_city: emp.temporary_city || "N/A",
        temporary_state: emp.temporary_state || "N/A",
        temporary_pincode: emp.temporary_pincode || "N/A",

        emergency_contact_name: emp.emergency_contact_name || "N/A",
        emergency_contact_phone: emp.emergency_contact_phone || "N/A",
        emergency_contact_relation: emp.emergency_contact_relation || "N/A",
      };

      const columns = [
        { header: "Employee ID", key: "employee_id", width: 18 },
        { header: "First Name", key: "first_name", width: 18 },
        { header: "Last Name", key: "last_name", width: 18 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 18 },
        { header: "Date of Birth", key: "date_of_birth", width: 18 },
        { header: "Gender", key: "gender", width: 14 },
        { header: "Blood Group", key: "blood_group", width: 14 },
        { header: "Marital Status", key: "marital_status", width: 18 },
        { header: "Department", key: "department", width: 22 },
        ...(role !== "hr" ? [{ header: "Project", key: "project", width: 22 }] : []),
        { header: "Designation", key: "designation", width: 22 },
        { header: "Employment Type", key: "employment_type", width: 18 },
        { header: "Experience Level", key: "experience_level", width: 18 },
        { header: "Total Experience", key: "total_experience", width: 20 },
        { header: "Joining Date", key: "joining_date", width: 18 },
        { header: "Probation End Date", key: "probation_end_date", width: 20 },
        { header: "Confirmation Date", key: "confirmation_date", width: 20 },
        { header: "Reporting Manager", key: "reporting_manager", width: 22 },
        { header: "Work Location", key: "work_location", width: 20 },
        { header: "Client Type", key: "client_type", width: 18 },
        { header: "Company", key: "company", width: 25 },
        { header: "CTC", key: "ctc", width: 18 },
        { header: "ESI Number", key: "esi_number", width: 20 },
        { header: "Status", key: "status", width: 18 },
        { header: "Bank Name", key: "bank_name", width: 22 },
        { header: "Bank Account Number", key: "bank_account_number", width: 24 },
        { header: "IFSC Code", key: "ifsc_code", width: 18 },
        { header: "PAN Number", key: "pan_number", width: 18 },
        { header: "Aadhaar Number", key: "aadhar_number", width: 20 },
        { header: "Permanent Address", key: "permanent_address", width: 35 },
        { header: "Permanent City", key: "permanent_city", width: 18 },
        { header: "Permanent State", key: "permanent_state", width: 18 },
        { header: "Permanent Pincode", key: "permanent_pincode", width: 18 },
        { header: "Temporary Address", key: "temporary_address", width: 35 },
        { header: "Temporary City", key: "temporary_city", width: 18 },
        { header: "Temporary State", key: "temporary_state", width: 18 },
        { header: "Temporary Pincode", key: "temporary_pincode", width: 18 },
        { header: "Emergency Contact Name", key: "emergency_contact_name", width: 25 },
        { header: "Emergency Contact Phone", key: "emergency_contact_phone", width: 24 },
        { header: "Emergency Contact Relation", key: "emergency_contact_relation", width: 25 },
      ];

      await exportToExcel({
        fileName: `${emp.employee_id || `${emp.first_name}-${emp.last_name}`}-Employee.xlsx`,
        sheetName: "Employee Details",
        title: "EMPLOYEE DETAILS",
        columns,
        rows: [employeeData],
      });
    } catch (error) {
      console.error("Failed to generate employee Excel:", error);
    }
  };


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
      deptFilter === "all" ||
      (deptFilter === "unassigned"
        ? !emp.department_id
        : emp.department_id === deptFilter);

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

    // Dashboard New Joinings KPI date range.
    const dashboardJoiningFrom =
      dashboardFilter?.joiningDateFrom || "";

    const dashboardJoiningTo =
      dashboardFilter?.joiningDateTo || "";

    const matchesDashboardJoiningDate =
      (!dashboardJoiningFrom ||
        (!!dateForRange && dateForRange >= dashboardJoiningFrom)) &&
      (!dashboardJoiningTo ||
        (!!dateForRange && dateForRange <= dashboardJoiningTo));

    // Do not apply the additional filters to any other sidebar view.
    if (!isAllSubmenu) {
      return (
        matchesSearch &&
        matchesDept &&
        matchesStatus &&
        matchesType &&
        matchesCompany &&
        matchesFromDate &&
        matchesToDate && 
        matchesDashboardJoiningDate
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
      role === "hr" || projectFilter === "all" || emp.project_id === projectFilter

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
      matchesDashboardJoiningDate &&
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Download selected employees as one excel file.
  const handleDownloadSelectedEmployees = async () => {
    const employeesToDownload = filteredEmployees.filter((emp) =>
      selectedEmployees.includes(emp.id)
    );

    if (employeesToDownload.length === 0) {
      alert("Please select at least one employee.");
      return;
    }

    try {
      setIsDownloading(true);

      const rows: Record<string, unknown>[] = employeesToDownload.map((emp) => {
        const details = emp as EmployeeFilterRecord;

        return {
          employee_id: emp.employee_id || "N/A",
          first_name: emp.first_name || "N/A",
          last_name: emp.last_name || "N/A",
          email: emp.email || "N/A",
          phone: emp.phone || "N/A",
          date_of_birth: formatDate(details.date_of_birth),
          gender: emp.gender || "N/A",
          blood_group: details.blood_group || "N/A",
          marital_status: details.marital_status || "N/A",

          department: getDepartmentName(emp),
          ...(role !== "hr" ? { project: details.project?.name || details.project_id || "N/A" } : {}),
          designation: emp.designation || "N/A",
          employment_type: emp.employment_type || "N/A",
          experience_level:
            details.experience_level === "fresher"
              ? "Fresher"
              : details.experience_level
                ? "Experienced"
                : "N/A",
          total_experience: formatTotalExperience(emp),
          joining_date: formatDate(emp.joining_date),
          probation_end_date: formatDate(details.probation_end_date),
          confirmation_date: formatDate(details.confirmation_date),
          reporting_manager: emp.reporting_manager || "N/A",
          work_location: details.work_location || "N/A",
          client_type: details.client_type || "N/A",
          company: emp.company_name || "N/A",
          ctc: emp.salary ?? "N/A",
          esi_number: emp.esi_number || "N/A",
          status: getEmployeeStatusLabel(emp),

          bank_name: emp.bank_name || "N/A",
          bank_account_number: emp.bank_account_number || "N/A",
          ifsc_code: emp.ifsc_code || "N/A",
          pan_number: emp.pan_number || "N/A",
          aadhar_number: emp.aadhar_number || "N/A",

          permanent_address: emp.permanent_address || "N/A",
          permanent_city: emp.permanent_city || "N/A",
          permanent_state: emp.permanent_state || "N/A",
          permanent_pincode: emp.permanent_pincode || "N/A",
          temporary_address: emp.temporary_address || "N/A",
          temporary_city: emp.temporary_city || "N/A",
          temporary_state: emp.temporary_state || "N/A",
          temporary_pincode: emp.temporary_pincode || "N/A",

          emergency_contact_name: emp.emergency_contact_name || "N/A",
          emergency_contact_phone: emp.emergency_contact_phone || "N/A",
          emergency_contact_relation: emp.emergency_contact_relation || "N/A",
        };
      });

      const columns = [
        { header: "Employee ID", key: "employee_id", width: 18 },
        { header: "First Name", key: "first_name", width: 18 },
        { header: "Last Name", key: "last_name", width: 18 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 18 },
        { header: "Date of Birth", key: "date_of_birth", width: 18 },
        { header: "Gender", key: "gender", width: 14 },
        { header: "Blood Group", key: "blood_group", width: 14 },
        { header: "Marital Status", key: "marital_status", width: 18 },
        { header: "Department", key: "department", width: 22 },
        ...(role !== "hr" ? [{ header: "Project", key: "project", width: 22 }] : []),
        { header: "Designation", key: "designation", width: 22 },
        { header: "Employment Type", key: "employment_type", width: 18 },
        { header: "Experience Level", key: "experience_level", width: 18 },
        { header: "Total Experience", key: "total_experience", width: 20 },
        { header: "Joining Date", key: "joining_date", width: 18 },
        { header: "Probation End Date", key: "probation_end_date", width: 20 },
        { header: "Confirmation Date", key: "confirmation_date", width: 20 },
        { header: "Reporting Manager", key: "reporting_manager", width: 22 },
        { header: "Work Location", key: "work_location", width: 20 },
        { header: "Client Type", key: "client_type", width: 18 },
        { header: "Company", key: "company", width: 25 },
        { header: "CTC", key: "ctc", width: 18, numFmt: '"₹"#,##0.00' },
        { header: "ESI Number", key: "esi_number", width: 20 },
        { header: "Status", key: "status", width: 18 },
        { header: "Bank Name", key: "bank_name", width: 22 },
        { header: "Bank Account Number", key: "bank_account_number", width: 24 },
        { header: "IFSC Code", key: "ifsc_code", width: 18 },
        { header: "PAN Number", key: "pan_number", width: 18 },
        { header: "Aadhaar Number", key: "aadhar_number", width: 20 },
        { header: "Permanent Address", key: "permanent_address", width: 35 },
        { header: "Permanent City", key: "permanent_city", width: 18 },
        { header: "Permanent State", key: "permanent_state", width: 18 },
        { header: "Permanent Pincode", key: "permanent_pincode", width: 18 },
        { header: "Temporary Address", key: "temporary_address", width: 35 },
        { header: "Temporary City", key: "temporary_city", width: 18 },
        { header: "Temporary State", key: "temporary_state", width: 18 },
        { header: "Temporary Pincode", key: "temporary_pincode", width: 18 },
        { header: "Emergency Contact Name", key: "emergency_contact_name", width: 25 },
        { header: "Emergency Contact Phone", key: "emergency_contact_phone", width: 24 },
        { header: "Emergency Contact Relation", key: "emergency_contact_relation", width: 25 },
      ];

      const companyName =
        compFilter !== "all"
          ? compFilter.replace(/[^a-zA-Z0-9]/g, "-")
          : "Employees";

      await exportToExcel({
        fileName: `${companyName}-Employee-Details.xlsx`,
        sheetName: "Employee Details",
        title: "EMPLOYEE DETAILS",
        subtitle: `Selected Employees: ${employeesToDownload.length}`,
        columns,
        rows,
      });
    } catch (error) {
      console.error("Failed to generate employee Excel:", error);
      alert("Failed to generate employee Excel.");
    } finally {
      setIsDownloading(false);
    }
  };

  const employeeEmploymentFiltersCount = [
    compFilter !== "all",
    deptFilter !== "all",
    role !== "hr" && projectFilter !== "all",
    designationFilter !== "all",
    statusFilter !== (isAllSubmenu ? "all" : sidebarStatus),
    typeFilter !== "all",
    clientTypeFilter !== "all",
    noticeFilter !== "all",
    fromDate !== "" || toDate !== "",
    appointmentDateFrom !== "" || appointmentDateTo !== "",
    confirmationDateFrom !== "" || confirmationDateTo !== "",
    probationEndFrom !== "" || probationEndTo !== "",
    probationDurationMin !== "" || probationDurationMax !== "",
    experienceLevelFilter !== "all",
    experienceYearsMin !== "" || experienceYearsMax !== "",
    experienceMonthsMin !== "" || experienceMonthsMax !== "",
    noticeDaysMin !== "" || noticeDaysMax !== "",
    salaryMin !== "" || salaryMax !== "",
  ].filter(Boolean).length;

  const personalFiltersCount = [
    genderFilter !== "all",
    maritalFilter !== "all",
    bloodGroupFilter !== "all",
    locationFilter !== "all",
    dobFrom !== "" || dobTo !== "",
  ].filter(Boolean).length;

  const exitFiltersCount = [
    resignationDateFrom !== "" || resignationDateTo !== "",
    exitDateFrom !== "" || exitDateTo !== "",
  ].filter(Boolean).length;

  const statutoryFiltersCount = [
    pfFilter !== "all",
    esiFilter !== "all",
    ptFilter !== "all",
    tdsFilter !== "all",
  ].filter(Boolean).length;

  const filterTabs = [
    {
      id: "employee",
      label: "Employment Details",
      icon: Briefcase,
      count: employeeEmploymentFiltersCount,
    },
    {
      id: "personal",
      label: "Personal Details",
      icon: User,
      count: personalFiltersCount,
    },
    {
      id: "exit",
      label: "Exit Details",
      icon: LogOut,
      count: exitFiltersCount,
    },
    {
      id: "statutory",
      label: "Statutory Eligibility",
      icon: ShieldCheck,
      count: statutoryFiltersCount,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      {isAllSubmenu ? (
        <div className="w-full shrink-0">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all">
            {/* Header / Search bar */}
            <div className="border-b border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by employee name, ID, email, or phone number..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                    {filteredEmployees.length} matching
                  </span>

                  {isFilterActive && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Clear filters</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsFiltersCollapsed((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                    title={isFiltersCollapsed ? "Expand filters" : "Collapse filters"}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                    <span>{isFiltersCollapsed ? "Show Filters" : "Hide Filters"}</span>
                    {isFiltersCollapsed ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filter Chips */}
            {isFilterActive && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200/70 bg-indigo-50/30 px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Active Filters:
                </span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Search: &ldquo;{searchTerm}&rdquo;
                    <button type="button" onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {compFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Company: {compFilter}
                    <button type="button" onClick={() => setCompFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {deptFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Dept: {availableDepartments.find((d) => d.id === deptFilter)?.name || deptFilter}
                    <button type="button" onClick={() => setDeptFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {role !== "hr" && projectFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Project: {availableProjects.find((p) => p.id === projectFilter)?.name || projectFilter}
                    <button type="button" onClick={() => setProjectFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {designationFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Designation: {designationFilter}
                    <button type="button" onClick={() => setDesignationFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Status: {formatOptionLabel(statusFilter)}
                    <button type="button" onClick={() => setStatusFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {typeFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Type: {formatOptionLabel(typeFilter)}
                    <button type="button" onClick={() => setTypeFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {clientTypeFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Client: {formatOptionLabel(clientTypeFilter)}
                    <button type="button" onClick={() => setClientTypeFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {noticeFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Notice: {formatOptionLabel(noticeFilter)}
                    <button type="button" onClick={() => setNoticeFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {(fromDate || toDate) && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Joining: {fromDate || "Any"} to {toDate || "Any"}
                    <button type="button" onClick={() => { setFromDate(""); setToDate(""); }} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {(salaryMin || salaryMax) && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Salary: ₹{salaryMin || 0} - ₹{salaryMax || "Any"}
                    <button type="button" onClick={() => { setSalaryMin(""); setSalaryMax(""); }} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {experienceLevelFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Exp Level: {formatOptionLabel(experienceLevelFilter)}
                    <button type="button" onClick={() => setExperienceLevelFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {genderFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Gender: {formatOptionLabel(genderFilter)}
                    <button type="button" onClick={() => setGenderFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {locationFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Location: {locationFilter}
                    <button type="button" onClick={() => setLocationFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {maritalFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Marital: {formatOptionLabel(maritalFilter)}
                    <button type="button" onClick={() => setMaritalFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {bloodGroupFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200">
                    Blood: {bloodGroupFilter}
                    <button type="button" onClick={() => setBloodGroupFilter("all")} className="text-slate-400 hover:text-rose-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Filter Tabs and Body (Collapsible) */}
            {!isFiltersCollapsed && (
              <>
                <div className="overflow-x-auto border-b border-slate-200 bg-white">
                  <div className="flex min-w-max gap-1 px-4 pt-2">
                    {filterTabs.map((tab) => {
                      const IconComponent = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveFilterTab(tab.id)}
                          className={`inline-flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-xs font-semibold transition ${
                            activeFilterTab === tab.id
                              ? "border-indigo-600 bg-indigo-50/70 text-indigo-700"
                              : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                          }`}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                          <span>{tab.label}</span>
                          {tab.count > 0 && (
                            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                              {tab.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  {/* COMBINED: Employee & Employment Details */}
                  {activeFilterTab === "employee" && (
                    <div className="space-y-5">
                      {/* Sub-section 1: Role & Organization */}
                      <div>
                        <div className="mb-2.5 flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Role & Organization
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

                          {role !== "hr" && (
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
                          )}

                          {renderSelect("Designation", designationFilter, setDesignationFilter, availableDesignations, "All Designations")}
                          {renderSelect("Status", statusFilter, setStatusFilter, statusOptions, "All Statuses")}
                          {renderSelect("Employment Type", typeFilter, setTypeFilter, availableEmploymentTypes, "All Types")}
                          {renderSelect("Client Type", clientTypeFilter, setClientTypeFilter, clientTypeOptions, "All Client Types")}
                          {renderSelect("Notice Status", noticeFilter, setNoticeFilter, noticeStatusOptions, "All Notice Statuses")}
                        </div>
                      </div>

                      {/* Sub-section 2: Key Timeline Dates */}
                      <div className="border-t border-slate-100 pt-4">
                        <div className="mb-2.5 flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Key Timeline Dates
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {renderDateRange("Joining Date", fromDate, setFromDate, toDate, setToDate)}
                          {renderDateRange("Appointment Date", appointmentDateFrom, setAppointmentDateFrom, appointmentDateTo, setAppointmentDateTo)}
                          {renderDateRange("Confirmation Date", confirmationDateFrom, setConfirmationDateFrom, confirmationDateTo, setConfirmationDateTo)}
                          {renderDateRange("Probation End Date", probationEndFrom, setProbationEndFrom, probationEndTo, setProbationEndTo)}
                        </div>
                      </div>

                      {/* Sub-section 3: Experience & Compensation */}
                      <div className="border-t border-slate-100 pt-4">
                        <div className="mb-2.5 flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Experience & Compensation
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {renderSelect("Experience Level", experienceLevelFilter, setExperienceLevelFilter, ["fresher", "experienced"], "All Experience Levels")}
                          {renderNumberRange("Experience Years", experienceYearsMin, setExperienceYearsMin, experienceYearsMax, setExperienceYearsMax, "years")}
                          {renderNumberRange("Experience Months", experienceMonthsMin, setExperienceMonthsMin, experienceMonthsMax, setExperienceMonthsMax, "months")}
                          {renderNumberRange("Probation Duration", probationDurationMin, setProbationDurationMin, probationDurationMax, setProbationDurationMax, "months")}
                          {renderNumberRange("Notice Period Days", noticeDaysMin, setNoticeDaysMin, noticeDaysMax, setNoticeDaysMax, "days")}
                          {renderNumberRange("Salary / CTC", salaryMin, setSalaryMin, salaryMax, setSalaryMax, "₹")}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personal Details */}
                  {activeFilterTab === "personal" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {renderSelect("Gender", genderFilter, setGenderFilter, genderOptions)}
                      {renderSelect("Marital Status", maritalFilter, setMaritalFilter, maritalStatusOptions)}
                      {renderSelect("Blood Group", bloodGroupFilter, setBloodGroupFilter, bloodGroupOptions)}
                      {renderSelect("Work Location", locationFilter, setLocationFilter, locationOptions)}
                      {renderDateRange("Date of Birth", dobFrom, setDobFrom, dobTo, setDobTo)}
                    </div>
                  )}

                  {/* Exit Details */}
                  {activeFilterTab === "exit" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {renderDateRange("Resignation Date", resignationDateFrom, setResignationDateFrom, resignationDateTo, setResignationDateTo)}
                      {renderDateRange("Exit Date", exitDateFrom, setExitDateFrom, exitDateTo, setExitDateTo)}
                    </div>
                  )}

                  {/* Statutory Eligibility */}
                  {activeFilterTab === "statutory" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {renderEligibilitySelect("PF Eligibility", pfFilter, setPfFilter)}
                      {renderEligibilitySelect("ESI Healthcare Eligibility", esiFilter, setEsiFilter)}
                      {renderEligibilitySelect("PT Eligibility", ptFilter, setPtFilter)}
                      {renderEligibilitySelect("TDS Eligibility", tdsFilter, setTdsFilter)}
                    </div>
                  )}
                </div>
              </>
            )}
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
                  {isDownloading ? "Generating Excel..." : `Download Selected${selectedEmployees.length ? ` (${selectedEmployees.length})` : ""}`}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative max-h-[650px] overflow-auto">
          <table className={`w-full ${isAllSubmenu ? "min-w-[3000px]" : "min-w-[980px]"} border-collapse text-left text-xs`}>
            <thead className="sticky top-0 z-30 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm border-b border-slate-300">
              <tr>
                {isFilterActive && (
                  <th className="text-slate-900 sticky top-0 left-0 z-40 w-12 border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-2 py-3 text-center font-bold">
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && filteredEmployees.every((emp) => selectedEmployees.includes(emp.id))}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      title="Select all filtered employees"
                    />
                  </th>
                )}
                <th className={`sticky top-0 z-40 w-[300px] min-w-[300px] whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 text-left font-bold text-slate-900 ${isFilterActive ? "left-12" : "left-0"}`}>Employee</th>
                <th className={`sticky top-0 z-40 w-[150px] min-w-[150px] whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 text-left font-bold text-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] ${isFilterActive ? "left-[348px]" : "left-[300px]"}`}>Employee ID</th>
                <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Department</th>
                <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Designation</th>
                <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Joining Date</th>
                {isAllSubmenu && (
                  <>
                    {role !== "hr" && (
                      <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Project</th>
                    )}
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Shift</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Gender</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Date of Birth</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Work Location</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Client Type</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Marital Status</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Blood Group</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Salary / CTC</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Appointment Date</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Confirmation Date</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Probation Duration</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Experience Level</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Total Experience</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Probation End Date</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Notice Period (Days)</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Notice Status</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Resignation Date</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Exit Date</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">PF</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">ESI Healthcare</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">PT</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">TDS</th>
                  </>
                )}
                {showExitDetails && (
                  <>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Years Worked</th>
                    <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Last Working Date</th>
                  </>
                )}
                <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Status</th>
                <th className="sticky right-0 top-0 z-40 whitespace-nowrap border-l border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 text-right font-bold text-slate-900 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length > 0 ? (
                paginatedEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`View ${emp.first_name} ${emp.last_name}`}
                    onClick={() => router.push(`/dashboard/employees/${emp.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && event.target === event.currentTarget) {
                        router.push(`/dashboard/employees/${emp.id}`)
                      }
                    }}
                    className={`group cursor-pointer transition-colors hover:bg-indigo-50/35 ${
                      selectedEmployees.includes(emp.id)
                        ? "bg-indigo-50/40"
                        : "bg-white"
                    }`}
                  >
                    {isFilterActive && (
                      <td className={`sticky left-0 z-20 border-r border-slate-200 border-b border-slate-100 bg-white px-2 py-3 align-middle ${selectedEmployees.includes(emp.id) ? "!bg-indigo-50/40" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => handleSelectEmployee(emp.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label={`Select ${emp.first_name} ${emp.last_name}`}
                        />
                      </td>
                    )}
                    <td className={`sticky z-20 w-[300px] min-w-[300px] border-r border-slate-200 border-b border-slate-100 bg-white px-4 py-3 ${isFilterActive ? "left-12" : "left-0"} ${selectedEmployees.includes(emp.id) ? "!bg-indigo-50/40" : ""}`}>
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
                          <Link href={`/dashboard/employees/${emp.id}`} onClick={(event) => event.stopPropagation()} className="block truncate text-sm font-bold text-slate-800 transition hover:text-indigo-700">
                            {emp.first_name} {emp.last_name}
                          </Link>
                          <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400">{emp.email || "No email available"}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`sticky z-20 w-[150px] min-w-[150px] whitespace-nowrap border-r border-slate-200 border-b border-slate-100 bg-white px-4 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] ${isFilterActive ? "left-[348px]" : "left-[300px]"} ${selectedEmployees.includes(emp.id) ? "!bg-indigo-50/40" : ""}`}>
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600">{emp.employee_id || "-"}</span>
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{getDepartmentName(emp)}</span>
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{emp.designation || "-"}</td>
                    <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-500">{formatDate(emp.joining_date)}</td>
                    {isAllSubmenu && (() => {
                      const details = emp as EmployeeFilterRecord
                      const eligibility = (value?: boolean | null) => (
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${value === true ? "bg-emerald-50 text-emerald-700" : value === false ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                          {value === true ? "Eligible" : value === false ? "No" : "—"}
                        </span>
                      )
                      return (
                        <>
                          {role !== "hr" && (
                            <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-600">{details.project?.name || details.project_id || "—"}</td>
                          )}
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-600"> {details.shift_type === "night"? "Night (18:30–03:30)" : "General (09:00–18:00)"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs capitalize text-slate-600">{details.gender || "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{formatDate(details.date_of_birth)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-600">{details.work_location || "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs capitalize text-slate-600">{details.client_type || "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs capitalize text-slate-600">{details.marital_status || "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-600">{details.blood_group || "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-700">{details.salary != null ? `₹${Number(details.salary).toLocaleString("en-IN")}` : "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{formatDate(details.appointment_date)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{formatDate(details.confirmation_date)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-600">{details.probation_duration != null ? `${details.probation_duration} months` : "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs capitalize text-slate-600">{details.experience_level? details.experience_level === "fresher"? "Fresher": "Experienced": "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-600">{formatTotalExperience(emp)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{formatDate(details.probation_end_date)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-600">{details.notice_period_days ?? "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs capitalize text-slate-600">{details.notice_status?.replace(/_/g, " ") || "—"}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{formatDate(details.resignation_date)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{formatDate(details.exit_date)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">{eligibility(details.pf_eligible)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">{eligibility(details.esi_healthcare_eligible)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">{eligibility(details.pt_eligible)}</td>
                          <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">{eligibility(details.tds_eligible)}</td>
                        </>
                      )
                    })()}
                    {showExitDetails && (
                      <>
                        <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-600">{getYearsWorked(emp)}</td>
                        <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-500">{formatDate(getLastWorkingDate(emp))}</td>
                      </>
                    )}
                    <td className="border-r border-slate-200 border-b border-slate-100 px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getEmployeeStatusBadge(emp)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {getEmployeeStatusLabel(emp)}
                      </span>
                    </td>
                    <td className="sticky right-0 z-20 border-l border-slate-200 border-b border-slate-100 bg-white px-2 py-2 text-center shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/employees/${emp.id}`} onClick={(event) => event.stopPropagation()} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-100 hover:text-indigo-700" title="View employee details" aria-label={`View ${emp.first_name} ${emp.last_name}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button type="button"   onClick={(event) => {
                              event.stopPropagation()
                              handleDownloadEmployee(emp)
                            }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-100 hover:text-indigo-700" title="Download employee document" aria-label={`Download ${emp.first_name} ${emp.last_name} details`}>
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={(isFilterActive ? 1 : 0) + 7 + (isAllSubmenu ? (role === "hr" ? 22 : 23) : 0) + (showExitDetails ? 2 : 0)} className="px-6 py-16 text-center">
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