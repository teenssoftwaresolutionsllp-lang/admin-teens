"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname,useRouter,useSearchParams } from "next/navigation"
import { exportToExcel } from "@/lib/excel/exportToExcel";
import companiesData from "@/data/companies.json"
import jobTitlesData from "@/data/employee_job_titles.json"
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
  ShieldCheck,
  GraduationCap,
  Building2,
  Calendar,
  Filter,
  RotateCcw,
  Clock,
  Building,
  UserCheck,
  Check,
} from "lucide-react"
// import { isExternal } from "util/types";

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
  shift_type?: string | null
  education_records?: Array<{
    id?: string
    qualification_type?: string | null
    qualification_name?: string | null
    institution_name?: string | null
    board?: string | null
    university?: string | null
    course?: string | null
    specialization?: string | null
    stream?: string | null
    year_of_passing?: string | number | null
  }>
  previous_employment_records?: Array<{
    id?: string
    company_name?: string | null
    designation?: string | null
    employment_start_date?: string | null
    employment_end_date?: string | null
  }>
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

const jsonJobTitles: string[] = (
  (jobTitlesData as { departments?: Array<{ titles?: string[] }> })
    ?.departments || []
).flatMap((dept) => dept.titles || [])

const designationOptions = uniqueOptions(jsonJobTitles)

function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder,
  allLabel = "All",
  className = "",
  variant = "default",
}: {
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder: string
  allLabel?: string
  className?: string
  variant?: "default" | "amber" | "indigo"
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  // const [experienceLevel, setExperienceLevel] = useState("all");
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, query])

  const isSelected = Boolean(value && value !== "all")
  const displayLabel = isSelected ? value : allLabel

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          setQuery("")
        }}
        className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 text-xs font-medium text-left transition outline-none ${
          isSelected
            ? variant === "amber"
              ? "border-amber-400 bg-amber-50/50 text-amber-900 font-semibold shadow-2xs"
              : "border-indigo-400 bg-indigo-50/50 text-indigo-900 font-semibold shadow-2xs"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:border-indigo-500"
        }`}
      >
        <span className="truncate mr-1">{displayLabel}</span>
        <div className="flex items-center gap-1 shrink-0">
          {isSelected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange("all")
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-1.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange("all")
                setIsOpen(false)
              }}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition ${
                !isSelected
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{allLabel}</span>
              {!isSelected && <Check className="h-3.5 w-3.5 text-indigo-600" />}
            </button>

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No matching results
              </div>
            ) : (
              filtered.map((opt) => {
                const optSelected = value === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt)
                      setIsOpen(false)
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition ${
                      optSelected
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {optSelected && (
                      <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0 ml-2" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

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

  // Education filters
  const [eduQualificationFilter, setEduQualificationFilter] = useState("all")
  const [eduCourseFilter, setEduCourseFilter] = useState("all")
  const [eduInstitutionFilter, setEduInstitutionFilter] = useState("all")
  const [eduSpecializationFilter, setEduSpecializationFilter] = useState("all")
  const [eduYearFilter, setEduYearFilter] = useState("all")

  // Previous employment filters
  const [prevCompanyFilter, setPrevCompanyFilter] = useState("all")
  const [prevDesignationFilter, setPrevDesignationFilter] = useState("all")

  // Shift filter
  const [shiftFilter, setShiftFilter] = useState("all")

  // Horizontal Quick Date & Master Filters
  const [dateField, setDateField] = useState<string>("joining_date")
  const [datePreset, setDatePreset] = useState<string>("all")
  const [dateTypeFilter, setDateTypeFilter] = useState<string>("joining")
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false)

  // Calculated date ranges for presets
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const thisMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`
  const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().slice(0, 10)
  const thisYearStart = `${currentYear}-01-01`
  const thisYearEnd = `${currentYear}-12-31`
  const past30DaysDate = new Date()
  past30DaysDate.setDate(now.getDate() - 30)
  const past30DaysStr = past30DaysDate.toISOString().slice(0, 10)

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

  const availableDesignations = designationOptions

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

  // Education and Previous Employment options derived from employee records & catalogs
  const defaultQualifications = [
    "10th",
    "10th Standard",
    "12th",
    "12th Standard",
    "Diploma",
    "Graduation",
    "Post Graduation",
    "B.Tech",
    "B.Sc",
    "BCA",
    "MCA",
    "MBA",
  ]
  const availableEducationQualifications = uniqueOptions([
    ...defaultQualifications,
    ...employees.flatMap((employee) =>
      ((employee as EmployeeFilterRecord).education_records || []).map(
        (edu) => edu.qualification_name || edu.qualification_type || ""
      )
    ),
  ])

  const availableEducationCourses = uniqueOptions(
    employees.flatMap((employee) =>
      ((employee as EmployeeFilterRecord).education_records || []).map(
        (edu) => edu.course || edu.specialization || edu.stream || ""
      )
    ).filter(Boolean)
  )

  const availableEducationInstitutions = uniqueOptions(
    employees.flatMap((employee) =>
      ((employee as EmployeeFilterRecord).education_records || []).map(
        (edu) => edu.institution_name || edu.university || edu.board || ""
      )
    ).filter(Boolean)
  )

  const availableEducationYears = uniqueOptions(
    employees.flatMap((employee) =>
      ((employee as EmployeeFilterRecord).education_records || []).map(
        (edu) => (edu.year_of_passing ? String(edu.year_of_passing) : "")
      )
    ).filter(Boolean)
  ).sort((a, b) => Number(b) - Number(a))

  // Merge companies from employee records + companies.json (deduplicated, sorted)
  const prevCompaniesFromRecords = employees.flatMap((employee) =>
    ((employee as EmployeeFilterRecord).previous_employment_records || []).map(
      (prev) => prev.company_name || ""
    )
  ).filter(Boolean)
  const prevCompaniesFromJson = companies.map((c) => c.company_name)
  const availablePreviousCompanies = uniqueOptions([
    ...prevCompaniesFromRecords,
    ...prevCompaniesFromJson,
  ])

  const availablePreviousDesignations = designationOptions

  const shiftOptions = ["general", "night"]

  // Master Filter Definitions that can be dynamically added
  // Helper for quick date range binding
  const getQuickDateValue = (type: "from" | "to"): string => {
    switch (dateTypeFilter) {
      case "joining":
        return type === "from" ? fromDate : toDate
      case "appointment":
        return type === "from" ? appointmentDateFrom : appointmentDateTo
      case "confirmation":
        return type === "from" ? confirmationDateFrom : confirmationDateTo
      case "probation_end":
        return type === "from" ? probationEndFrom : probationEndTo
      case "resignation":
        return type === "from" ? resignationDateFrom : resignationDateTo
      case "exit":
        return type === "from" ? exitDateFrom : exitDateTo
      case "dob":
        return type === "from" ? dobFrom : dobTo
      default:
        return ""
    }
  }

  const handleQuickDateChange = (type: "from" | "to", value: string) => {
    switch (dateTypeFilter) {
      case "joining":
        if (type === "from") setFromDate(value)
        else setToDate(value)
        break
      case "appointment":
        if (type === "from") setAppointmentDateFrom(value)
        else setAppointmentDateTo(value)
        break
      case "confirmation":
        if (type === "from") setConfirmationDateFrom(value)
        else setConfirmationDateTo(value)
        break
      case "probation_end":
        if (type === "from") setProbationEndFrom(value)
        else setProbationEndTo(value)
        break
      case "resignation":
        if (type === "from") setResignationDateFrom(value)
        else setResignationDateTo(value)
        break
      case "exit":
        if (type === "from") setExitDateFrom(value)
        else setExitDateTo(value)
        break
      case "dob":
        if (type === "from") setDobFrom(value)
        else setDobTo(value)
        break
    }
  }

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

    // Reset Education & Prev Work & Shift & Master filters
    setEduQualificationFilter("all")
    setEduCourseFilter("all")
    setEduInstitutionFilter("all")
    setEduSpecializationFilter("all")
    setEduYearFilter("all")
    setPrevCompanyFilter("all")
    setPrevDesignationFilter("all")
    setShiftFilter("all")
    setDateField("joining_date")
    setDatePreset("all")

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
    exitDateFrom !== "" || exitDateTo !== "" ||
    eduQualificationFilter !== "all" ||
    eduCourseFilter !== "all" ||
    eduInstitutionFilter !== "all" ||
    eduSpecializationFilter !== "all" ||
    eduYearFilter !== "all" ||
    prevCompanyFilter !== "all" ||
    prevDesignationFilter !== "all" ||
    shiftFilter !== "all"

  const isFilterActive =
    searchTerm.trim() !== "" ||
    compFilter !== "all" ||
    deptFilter !== "all" ||
    (isAllSubmenu && statusFilter !== "all") ||
    typeFilter !== "all" ||
    datePreset !== "all" ||
    (fromDate !== "" || toDate !== "") ||
    eduQualificationFilter !== "all" ||
    prevCompanyFilter !== "all" ||
    shiftFilter !== "all" ||
    (dashboardFilter?.joiningDateFrom != null ||
      dashboardFilter?.joiningDateTo != null) ||
    additionalFiltersActive

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

  const parseExperienceDate = (value?: string | null): Date | null => {
    if (!value) return null;

    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getCompletedExperienceMonths = (
    startValue?: string | null,
    endValue?: string | null
  ): number => {
    const start = parseExperienceDate(startValue);
    const end = parseExperienceDate(endValue);

    if (!start || !end || end < start) return 0;

    let months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      end.getMonth() -
      start.getMonth();

    if (end.getDate() < start.getDate()) months--;

    return Math.max(0, months);
  };

  const formatExperienceMonths = (totalMonths: number): string => {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    return `${years} Year${years !== 1 ? "s" : ""} ${months} Month${months !== 1 ? "s" : ""}`;
  };

  const getCompletedMonths = (start: Date, end: Date): number => {
    if (end < start) return 0;

    let months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());

    if (end.getDate() < start.getDate()) months--;

    return Math.max(0, months);
  };

  const parseLocalDate = (value?: string | null): Date | null => {
    if (!value) return null;

    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatMonths = (months: number): string => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    return `${years} Year${years !== 1 ? "s" : ""} ${remainingMonths} Month${remainingMonths !== 1 ? "s" : ""}`;
  };

  const formatTotalExperience = (emp: Employee): string => {
    const details = emp as EmployeeFilterRecord;
    const joiningDate = parseLocalDate(emp.joining_date);

    if (!joiningDate) return "—";

    const today = new Date();
    const currentDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const lastWorkingDate = parseLocalDate(getLastWorkingDate(emp));
    const currentEndDate = lastWorkingDate || currentDate;

    const currentMonths = getCompletedMonths(joiningDate, currentEndDate);

    const previousRecords = details.previous_employment_records || [];

    const intervals = previousRecords
      .map((record) => {
        const start = parseLocalDate(record.employment_start_date);
        const end = parseLocalDate(record.employment_end_date) || joiningDate;

        if (!start || start >= joiningDate || end <= start) return null;

        return {
          start,
          end: end > joiningDate ? joiningDate : end,
        };
      })
      .filter(
        (interval): interval is { start: Date; end: Date } =>
          interval !== null
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Merge overlapping previous employment periods to avoid double-counting.
    const merged: { start: Date; end: Date }[] = [];

    for (const interval of intervals) {
      const last = merged[merged.length - 1];

      if (last && interval.start <= last.end) {
        if (interval.end > last.end) last.end = interval.end;
      } else {
        merged.push({ ...interval });
      }
    }

    const previousMonths = merged.reduce(
      (total, interval) =>
        total + getCompletedMonths(interval.start, interval.end),
      0
    );

    return formatMonths(currentMonths + previousMonths);
  };

  const getExperienceLevel = (emp: EmployeeFilterRecord) => {
    const experience = formatTotalExperience(emp);

    if (!experience || experience === "-") return null;

    const years = parseInt(
      experience.match(/(\d+)\s*Year/i)?.[1] || "0",
      10
    );

    const months = parseInt(
      experience.match(/(\d+)\s*Month/i)?.[1] || "0",
      10
    );

    return years >= 1 || months >= 12 ? "experienced" : "fresher";
  };

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

      const educationStr = ((emp as EmployeeFilterRecord).education_records || [])
        .map((edu) =>
          [
            edu.qualification_name || edu.qualification_type,
            edu.course || edu.specialization,
            edu.institution_name || edu.university,
            edu.year_of_passing ? `(${edu.year_of_passing})` : "",
          ]
            .filter(Boolean)
            .join(" - ")
        )
        .join("; ") || "N/A"

      const prevWorkStr = ((emp as EmployeeFilterRecord).previous_employment_records || [])
        .map((p) =>
          [
            p.designation ? `${p.designation} at ` : "",
            p.company_name,
            p.employment_start_date
              ? `(${p.employment_start_date} to ${p.employment_end_date || "Present"})`
              : "",
          ]
            .filter(Boolean)
            .join("")
        )
        .join("; ") || (emp.experience_level === "fresher" ? "Fresher (No Prior Experience)" : "N/A")

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
        education: educationStr,
        previous_work: prevWorkStr,
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
        { header: "Joining Date", key: "joining_date", width: 18 },
        { header: "Education", key: "education", width: 30 },
        { header: "Previous Work", key: "previous_work", width: 30 },
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


  console.table(
    employees.map((employee) => {
      const emp = employee as EmployeeFilterRecord

      return {
        name: `${emp.first_name || ""} ${emp.last_name || ""}`,
        experience_level: emp.experience_level,
        total_experience_years: emp.total_experience_years,
        total_experience_months: emp.total_experience_months,
      }
    })
  )


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
      (emp.phone || "").toLowerCase().includes(searchString) ||
      (emp.education_records?.some((edu) =>
        (edu.qualification_name || "").toLowerCase().includes(searchString) ||
        (edu.course || "").toLowerCase().includes(searchString) ||
        (edu.institution_name || "").toLowerCase().includes(searchString) ||
        (edu.specialization || "").toLowerCase().includes(searchString)
      ) ?? false) ||
      (emp.previous_employment_records?.some((prev) =>
        (prev.company_name || "").toLowerCase().includes(searchString) ||
        (prev.designation || "").toLowerCase().includes(searchString)
      ) ?? false)

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

    // Education matching: all active education criteria must match on the SAME record
    const hasAnyEduFilter =
      eduQualificationFilter !== "all" ||
      eduCourseFilter !== "all" ||
      eduInstitutionFilter !== "all" ||
      eduYearFilter !== "all"

    const matchesEducation =
      !hasAnyEduFilter ||
      (emp.education_records?.some((edu) => {
        const qual = normalize(edu.qualification_name || edu.qualification_type)
        const targetQual = normalize(eduQualificationFilter)
        const matchesQual =
          eduQualificationFilter === "all" ||
          qual === targetQual ||
          qual.includes(targetQual) ||
          targetQual.includes(qual)

        const course = normalize(edu.course || edu.specialization || edu.stream)
        const targetCourse = normalize(eduCourseFilter)
        const matchesCourse =
          eduCourseFilter === "all" ||
          course === targetCourse ||
          course.includes(targetCourse)

        const inst = normalize(edu.institution_name || edu.university || edu.board)
        const targetInst = normalize(eduInstitutionFilter)
        const matchesInst =
          eduInstitutionFilter === "all" ||
          inst === targetInst ||
          inst.includes(targetInst)

        const matchesYr =
          eduYearFilter === "all" ||
          String(edu.year_of_passing || "").trim() === String(eduYearFilter).trim()

        return matchesQual && matchesCourse && matchesInst && matchesYr
      }) ?? false)

    // Previous employment matching: active prev company & designation must match on the SAME record
    const hasAnyPrevFilter =
      prevCompanyFilter !== "all" || prevDesignationFilter !== "all"

    const matchesPreviousEmployment =
      !hasAnyPrevFilter ||
      (emp.previous_employment_records?.some((prev) => {
        const matchesComp =
          prevCompanyFilter === "all" ||
          normalize(prev.company_name) === normalize(prevCompanyFilter)
        const matchesDesig =
          prevDesignationFilter === "all" ||
          normalize(prev.designation) === normalize(prevDesignationFilter)
        return matchesComp && matchesDesig
      }) ?? false)

    // Shift matching
    const matchesShift =
      shiftFilter === "all" ||
      normalize(emp.shift_type) === normalize(shiftFilter)

    // Date preset & custom range filtering
    let matchesDateField = true
    if (datePreset !== "all" || Boolean(fromDate) || Boolean(toDate)) {
      let targetDate: string | null = null
      switch (dateField) {
        case "joining_date":
          targetDate = emp.joining_date ? emp.joining_date.slice(0, 10) : null
          break
        case "appointment_date":
          targetDate = emp.appointment_date ? emp.appointment_date.slice(0, 10) : null
          break
        case "confirmation_date":
          targetDate = emp.confirmation_date ? emp.confirmation_date.slice(0, 10) : null
          break
        case "probation_end_date":
          targetDate = emp.probation_end_date ? emp.probation_end_date.slice(0, 10) : null
          break
        case "resignation_date":
          targetDate = emp.resignation_date ? emp.resignation_date.slice(0, 10) : null
          break
        case "exit_date":
          targetDate = emp.exit_date ? emp.exit_date.slice(0, 10) : null
          break
        case "date_of_birth":
          targetDate = emp.date_of_birth ? emp.date_of_birth.slice(0, 10) : null
          break
        default:
          targetDate = emp.joining_date ? emp.joining_date.slice(0, 10) : null
      }

      if (!targetDate) {
        matchesDateField = false
      } else {
        if (datePreset === "this_month") {
          matchesDateField = targetDate >= thisMonthStart && targetDate <= thisMonthEnd
        } else if (datePreset === "past_30") {
          matchesDateField = targetDate >= past30DaysStr && targetDate <= todayStr
        } else if (datePreset === "this_year") {
          matchesDateField = targetDate >= thisYearStart && targetDate <= thisYearEnd
        } else {
          matchesDateField = (!fromDate || targetDate >= fromDate) && (!toDate || targetDate <= toDate)
        }
      }
    }

    // Do not apply the additional filters to any other sidebar view.
    if (!isAllSubmenu) {
      return (
        matchesSearch &&
        matchesDept &&
        matchesStatus &&
        matchesType &&
        matchesCompany &&
        matchesDateField &&
        matchesDashboardJoiningDate &&
        matchesEducation &&
        matchesPreviousEmployment &&
        matchesShift
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

    const calculatedExperienceLevel = getExperienceLevel(emp as EmployeeFilterRecord);

    const matchesExperienceLevel =
      experienceLevelFilter === "all" ||
      calculatedExperienceLevel === experienceLevelFilter;

    const experienceText = formatTotalExperience(emp);

    const experienceYears =
      experienceText === "-"
        ? null
        : (() => {
            const years = parseInt(
              experienceText.match(/(\d+)\s*Year/i)?.[1] || "0",
              10
            );

            const months = parseInt(
              experienceText.match(/(\d+)\s*Month/i)?.[1] || "0",
              10
            );

            return years + months / 12;
          })();

    const matchesExperienceYears = matchesNumericRange(
      experienceYears,
      experienceYearsMin,
      experienceYearsMax
    );

    const experienceTotalMonths =
      experienceYears === null
        ? null
        : Math.round(experienceYears * 12);

    const matchesExperienceMonths = matchesNumericRange(
      experienceTotalMonths,
      experienceMonthsMin,
      experienceMonthsMax
    );

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
      matchesDateField &&
      matchesEducation &&
      matchesPreviousEmployment &&
      matchesShift &&
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
    eduQualificationFilter,
    eduCourseFilter,
    eduInstitutionFilter,
    eduYearFilter,
    prevCompanyFilter,
    prevDesignationFilter,
    shiftFilter,
    dateField,
    datePreset,
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

        const educationStr = (details.education_records || [])
          .map((edu) =>
            [
              edu.qualification_name || edu.qualification_type,
              edu.course || edu.specialization,
              edu.institution_name || edu.university,
              edu.year_of_passing ? `(${edu.year_of_passing})` : "",
            ]
              .filter(Boolean)
              .join(" - ")
          )
          .join("; ") || "N/A";

        const prevWorkStr = (details.previous_employment_records || [])
          .map((p) =>
            [
              p.designation ? `${p.designation} at ` : "",
              p.company_name,
              p.employment_start_date
                ? `(${p.employment_start_date} to ${p.employment_end_date || "Present"})`
                : "",
            ]
              .filter(Boolean)
              .join("")
          )
          .join("; ") || (emp.experience_level === "fresher" ? "Fresher (No Prior Experience)" : "N/A");

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
          experience_level: (() => {
            const joiningDate = parseLocalDate(emp.joining_date);
              if (!joiningDate) return "N/A";

              const today = new Date();
              const currentDate = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
              );

              const lastWorkingDate = parseLocalDate(getLastWorkingDate(emp));
              const endDate = lastWorkingDate || currentDate;

              const months = getCompletedMonths(joiningDate, endDate);

              return months >= 12 ? "Experienced" : "Fresher";
            })(),
          total_experience: formatTotalExperience(emp),
          joining_date: formatDate(emp.joining_date),
          education: educationStr,
          previous_work: prevWorkStr,
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
        // { header: "Total Experience", key: "total_experience", width: 20 },
        { header: "Joining Date", key: "joining_date", width: 18 },
        { header: "Education", key: "education", width: 30 },
        { header: "Previous Work", key: "previous_work", width: 30 },
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

  return (
    <div className="flex flex-col gap-5">
      {/* Redesigned Modern Horizontal Filter Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3.5">
        {/* Tier 1: Search & Quick Summary / Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, ID, email, phone, education, or previous company..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-10 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 transition hover:bg-white focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
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

          {/* Right Stats & Reset */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              {filteredEmployees.length} of {employees.length} employees
            </span>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-2xs transition hover:bg-rose-100 hover:border-rose-300"
                title="Reset all applied filters"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: 6 Primary Horizontal Filter Dropdowns with Icon Labels */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 pt-3 border-t border-slate-100">
          {/* 1. Department */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Building className="h-3 w-3 text-slate-400" />
              Department
            </label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500"
            >
              <option value="all">All Departments</option>
              {availableDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Designation */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Briefcase className="h-3 w-3 text-slate-400" />
              Designation
            </label>
            <SearchableCombobox
              value={designationFilter}
              onChange={setDesignationFilter}
              options={availableDesignations}
              placeholder="Search designation..."
              allLabel="All Designations"
            />
          </div>

          {/* 3. Education Qualification */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 text-indigo-600">
              <GraduationCap className="h-3 w-3 text-indigo-500" />
              Education
            </label>
            <select
              value={eduQualificationFilter}
              onChange={(e) => setEduQualificationFilter(e.target.value)}
              className={`w-full rounded-xl border px-2.5 py-1.5 text-xs font-medium outline-none transition ${
                eduQualificationFilter !== "all"
                  ? "border-indigo-400 bg-indigo-50/50 text-indigo-700 font-semibold"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:border-indigo-500"
              }`}
            >
              <option value="all">All Qualifications</option>
              {availableEducationQualifications.map((qualification) => (
                <option key={qualification} value={qualification}>
                  {qualification}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Previous Work Company */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 text-amber-700">
              <Building2 className="h-3 w-3 text-amber-500" />
              Previous Company
            </label>
            <SearchableCombobox
              value={prevCompanyFilter}
              onChange={setPrevCompanyFilter}
              options={availablePreviousCompanies}
              placeholder="Search previous company..."
              allLabel="All Previous Companies"
              variant="amber"
            />
          </div>

          {/* 5. Shift Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-400" />
              Shift Type
            </label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500"
            >
              <option value="all">All Shifts</option>
              <option value="general">General (09:00–18:00)</option>
              <option value="night">Night (18:30–03:30)</option>
            </select>
          </div>

          {/* 6. Employee Status */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-slate-400" />
              Status
            </label>
            <select
              value={isAllSubmenu ? statusFilter : sidebarStatus}
              disabled={!isAllSubmenu}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatOptionLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tier 3: Horizontal Date Filter & Master Filters Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Quick Date Filter Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-600 uppercase tracking-wider text-[11px] shrink-0">
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              Date Filter:
            </div>

            {/* Target Date Field */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Field:</span>
              <select
                value={dateField}
                onChange={(e) => setDateField(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500"
              >
                <option value="joining_date">Joining Date</option>
                <option value="appointment_date">Appointment Date</option>
                <option value="confirmation_date">Confirmation Date</option>
                <option value="probation_end_date">Probation End Date</option>
                <option value="resignation_date">Resignation Date</option>
                <option value="exit_date">Exit Date</option>
                <option value="date_of_birth">Date of Birth</option>
              </select>
            </div>

            {/* Date Preset */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Period:</span>
              <select
                value={datePreset}
                onChange={(e) => {
                  const val = e.target.value
                  setDatePreset(val)
                  if (val !== "custom") {
                    setFromDate("")
                    setToDate("")
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500"
              >
                <option value="all">Any Time</option>
                <option value="this_month">This Month</option>
                <option value="past_30">Past 30 Days</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Range...</option>
              </select>
            </div>

            {/* Inline Custom Range Inputs */}
            {(datePreset === "custom" || fromDate || toDate) && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">From:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value)
                    if (datePreset !== "custom") setDatePreset("custom")
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value)
                    if (datePreset !== "custom") setDatePreset("custom")
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate("")
                      setToDate("")
                      setDatePreset("all")
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="Clear custom dates"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: More Filters Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* More Filters Toggle */}
            <button
              type="button"
              onClick={() => setIsMoreFiltersOpen(!isMoreFiltersOpen)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                isMoreFiltersOpen
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>More Filters</span>
              {isMoreFiltersOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>

        {/* Tier 5: More Filters Expandable Horizontal Shelf */}
        {isMoreFiltersOpen && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-3.5 border-t border-slate-100 bg-slate-50/50 p-3.5 rounded-xl">
            {/* Column 1: Role & Organization */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-indigo-500" />
                Role & Org
              </h4>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Company</label>
                <select
                  value={compFilter}
                  onChange={(e) => setCompFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">All Companies</option>
                  {availableCompanies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {role !== "hr" && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Project</label>
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Projects</option>
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Client Type</label>
                <select
                  value={clientTypeFilter}
                  onChange={(e) => setClientTypeFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">All Client Types</option>
                  {clientTypeOptions.map((cl) => (
                    <option key={cl} value={cl}>{formatOptionLabel(cl)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Notice Status</label>
                <select
                  value={noticeFilter}
                  onChange={(e) => setNoticeFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">All Notice Statuses</option>
                  {noticeStatusOptions.map((st) => (
                    <option key={st} value={st}>{formatOptionLabel(st)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Notice Period (Days)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    placeholder="Min"
                    value={noticeDaysMin}
                    onChange={(e) => setNoticeDaysMin(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={noticeDaysMax}
                    onChange={(e) => setNoticeDaysMax(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Education Details */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                Education Details
              </h4>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Course / Stream</label>
                <select
                  value={eduCourseFilter}
                  onChange={(e) => setEduCourseFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">All Courses</option>
                  {availableEducationCourses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Institution</label>
                <select
                  value={eduInstitutionFilter}
                  onChange={(e) => setEduInstitutionFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">All Institutions</option>
                  {availableEducationInstitutions.map((inst) => (
                    <option key={inst} value={inst}>{inst}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Passing Year</label>
                <select
                  value={eduYearFilter}
                  onChange={(e) => setEduYearFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">All Years</option>
                  {availableEducationYears.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Column 3: Experience & Compensation */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-amber-500" />
                Experience & Salary
              </h4>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Previous Company</label>
                <SearchableCombobox
                  value={prevCompanyFilter}
                  onChange={setPrevCompanyFilter}
                  options={availablePreviousCompanies}
                  placeholder="Search previous company..."
                  allLabel="All Companies"
                  variant="amber"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Previous Designation</label>
                <SearchableCombobox
                  value={prevDesignationFilter}
                  onChange={setPrevDesignationFilter}
                  options={availablePreviousDesignations}
                  placeholder="Search previous role..."
                  allLabel="All Roles"
                  variant="amber"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Experience Level
                </label>

                <select
                  value={experienceLevelFilter}
                  onChange={(e) => {
                    setExperienceLevelFilter(e.target.value)
                    setExperienceYearsMin("")
                    setExperienceYearsMax("")
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="all">All Levels</option>
                  <option value="fresher">Fresher</option>
                  <option value="experienced">Experienced</option>
                </select>
              </div>

              {/* {experienceLevelFilter === "experienced" && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[11px] font-medium text-slate-600">
                      Experience (Years)
                    </label>

                    {experienceYearsMin && (
                      <span className="text-[10px] font-semibold text-indigo-600">
                        {experienceYearsMin}
                        {experienceYearsMax ? `–${experienceYearsMax}` : "+"} yrs
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      placeholder="Min Yrs (e.g. 5)"
                      value={experienceYearsMin}
                      onChange={(e) => setExperienceYearsMin(e.target.value)}
                      min="0"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                    />

                    <input
                      type="number"
                      placeholder="Max Yrs"
                      value={experienceYearsMax}
                      onChange={(e) => setExperienceYearsMax(e.target.value)}
                      min="0"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {[
                      { label: "1+ yr", min: "1", max: "" },
                      { label: "3+ yrs", min: "3", max: "" },
                      { label: "5+ yrs", min: "5", max: "" },
                      { label: "8+ yrs", min: "8", max: "" },
                      { label: "10+ yrs", min: "10", max: "" },
                    ].map((preset) => {
                      const isSelected =
                        experienceYearsMin === preset.min &&
                        experienceYearsMax === preset.max

                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setExperienceYearsMin("")
                              setExperienceYearsMax("")
                            } else {
                              setExperienceYearsMin(preset.min)
                              setExperienceYearsMax(preset.max)
                              setExperienceLevelFilter("experienced")
                            }
                          }}
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )} */}

              {/* Experience Years Filter & Quick Preset Pills */}
              {experienceLevelFilter ==="experienced" &&(
                <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-600">
                    Experience (Years)
                  </label>
                  {experienceYearsMin && (
                    <span className="text-[10px] font-semibold text-indigo-600">
                      {experienceYearsMin}
                      {experienceYearsMax ? `–${experienceYearsMax}` : "+"} yrs
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    placeholder="Min Yrs (e.g. 5)"
                    value={experienceYearsMin}
                    onChange={(e) => {
                      setExperienceYearsMin(e.target.value)
                    }}
                    min="0"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    placeholder="Max Yrs"
                    value={experienceYearsMax}
                    onChange={(e) => {
                      setExperienceYearsMax(e.target.value)
                    }}
                    min="0"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
                {/* Quick year pills */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[
                    { label: "1+ yr", min: "1", max: "" },
                    { label: "3+ yrs", min: "3", max: "" },
                    { label: "5+ yrs", min: "5", max: "" },
                    { label: "8+ yrs", min: "8", max: "" },
                    { label: "10+ yrs", min: "10", max: "" },
                  ].map((preset) => {
                    const isSelected =
                      experienceYearsMin === preset.min &&
                      experienceYearsMax === preset.max
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setExperienceYearsMin("")
                            setExperienceYearsMax("")
                          } else {
                            setExperienceYearsMin(preset.min)
                            setExperienceYearsMax(preset.max)
                            setExperienceLevelFilter("experienced")
                          }
                        }}
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                </div>
              )}
 

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Salary / CTC (₹)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    placeholder="Min"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Column 4: Personal & Statutory */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                Personal & Statutory
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Gender</label>
                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="all">All</option>
                    {genderOptions.map((g) => (
                      <option key={g} value={g}>{formatOptionLabel(g)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Location</label>
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="all">All</option>
                    {locationOptions.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Marital</label>
                  <select
                    value={maritalFilter}
                    onChange={(e) => setMaritalFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="all">All</option>
                    {maritalStatusOptions.map((m) => (
                      <option key={m} value={m}>{formatOptionLabel(m)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Blood Group</label>
                  <select
                    value={bloodGroupFilter}
                    onChange={(e) => setBloodGroupFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="all">All</option>
                    {bloodGroupOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">PF</label>
                  <select
                    value={pfFilter}
                    onChange={(e) => setPfFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="all">All</option>
                    <option value="yes">Eligible</option>
                    <option value="no">Not</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">ESI</label>
                  <select
                    value={esiFilter}
                    onChange={(e) => setEsiFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="all">All</option>
                    <option value="yes">Eligible</option>
                    <option value="no">Not</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">PT</label>
                  <select
                    value={ptFilter}
                    onChange={(e) => setPtFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="all">All</option>
                    <option value="yes">Eligible</option>
                    <option value="no">Not</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">TDS</label>
                  <select
                    value={tdsFilter}
                    onChange={(e) => setTdsFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none"
                  >
                    <option value="all">All</option>
                    <option value="yes">Eligible</option>
                    <option value="no">Not</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tier 6: Active Filters Summary Chips Bar */}
        {isFilterActive && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
              <Filter className="h-3.5 w-3.5 text-indigo-600 mr-0.5" />
              <span className="font-semibold text-slate-700 mr-1">Active:</span>

              {searchTerm && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Search: &ldquo;{searchTerm}&rdquo;
                  <button type="button" onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {deptFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Dept: {availableDepartments.find((d) => d.id === deptFilter)?.name || deptFilter}
                  <button type="button" onClick={() => setDeptFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {designationFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Designation: {designationFilter}
                  <button type="button" onClick={() => setDesignationFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {eduQualificationFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
                  <GraduationCap className="h-3 w-3" />
                  Edu: {eduQualificationFilter}
                  <button type="button" onClick={() => setEduQualificationFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {prevCompanyFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                  <Building2 className="h-3 w-3" />
                  Prev: {prevCompanyFilter}
                  <button type="button" onClick={() => setPrevCompanyFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {shiftFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
                  Shift: {shiftFilter === "night" ? "Night" : "General"}
                  <button type="button" onClick={() => setShiftFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {datePreset !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {formatOptionLabel(dateField)}: {datePreset === "this_month" ? "This Month" : datePreset === "past_30" ? "Past 30 Days" : datePreset === "this_year" ? "This Year" : `${fromDate || "Any"} - ${toDate || "Any"}`}
                  <button type="button" onClick={() => { setDatePreset("all"); setFromDate(""); setToDate(""); }} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {statusFilter !== "all" && isAllSubmenu && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Status: {formatOptionLabel(statusFilter)}
                  <button type="button" onClick={() => setStatusFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {compFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Company: {compFilter}
                  <button type="button" onClick={() => setCompFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {locationFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Location: {locationFilter}
                  <button type="button" onClick={() => setLocationFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {prevDesignationFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                  <Briefcase className="h-3 w-3" />
                  Prev Role: {prevDesignationFilter}
                  <button type="button" onClick={() => setPrevDesignationFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {eduYearFilter !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
                  <Calendar className="h-3 w-3" />
                  Pass Year: {eduYearFilter}
                  <button type="button" onClick={() => setEduYearFilter("all")} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {(experienceYearsMin || experienceYearsMax) && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Exp: {experienceYearsMin || 0}{experienceYearsMax ? ` - ${experienceYearsMax}` : "+"} yrs
                  <button type="button" onClick={() => { setExperienceYearsMin(""); setExperienceYearsMax(""); }} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {(salaryMin || salaryMax) && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Salary: ₹{salaryMin || 0} - ₹{salaryMax || "Any"}
                  <button type="button" onClick={() => { setSalaryMin(""); setSalaryMax(""); }} className="text-slate-400 hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-700 hover:underline shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All Filters
            </button>
          </div>
        )}
      </div>

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
                <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Total Professional Experience</th>
                <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Experience Level</th>
                <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Education</th>
                <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Previous Work</th>
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
                    {/* <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Experience Level</th> */}
                    {/* <th className="sticky top-0 z-30 whitespace-nowrap border-r border-slate-300 border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-900">Total Experience</th> */}
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
                    <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-500">{formatTotalExperience(emp)}</td>
                    <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">
                      <span className="text-xs font-medium text-slate-700">
                        {formatTotalExperience(emp) !== "-"
                          ? (() => {
                              const experience = formatTotalExperience(emp);
                              const years = parseInt(experience.match(/(\d+)\s*Year/i)?.[1] || "0", 10);
                              const months = parseInt(experience.match(/(\d+)\s*Month/i)?.[1] || "0", 10);

                              return years >= 1 || months >= 12 ? "Experienced" : "Fresher";
                            })()
                          : "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">
                      {(() => {
                        const records = (emp as EmployeeFilterRecord).education_records || []
                        if (records.length === 0) {
                          return <span className="text-xs text-slate-400">—</span>
                        }
                        const primary = records[0]
                        const title = primary.qualification_name || primary.qualification_type || primary.course || "Education"
                        const sub = [primary.institution_name || primary.university, primary.year_of_passing].filter(Boolean).join(" • ")
                        const tooltip = records.map((r) => 
                          `${r.qualification_name || r.qualification_type || r.course || "Degree"}${r.institution_name ? ` at ${r.institution_name}` : ""}${r.year_of_passing ? ` (${r.year_of_passing})` : ""}`
                        ).join("\n")

                        return (
                          <div className="flex items-center gap-1.5" title={tooltip}>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                              <GraduationCap className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 max-w-[180px]">
                              <p className="truncate text-xs font-semibold text-slate-700">{title}</p>
                              {sub && <p className="truncate text-[11px] text-slate-400">{sub}</p>}
                            </div>
                            {records.length > 1 && (
                              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                +{records.length - 1}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">
                      {(() => {
                        const records = (emp as EmployeeFilterRecord).previous_employment_records || []
                        if (records.length === 0) {
                          if ((emp as EmployeeFilterRecord).experience_level === "fresher") {
                            return (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                Fresher
                              </span>
                            )
                          }
                          return <span className="text-xs text-slate-400">—</span>
                        }
                        const primary = records[0]
                        const company = primary.company_name || "Previous Company"
                        const roleTitle = primary.designation || ""
                        const tooltip = records.map((r) => 
                          `${r.designation ? `${r.designation} at ` : ""}${r.company_name || "Company"}${r.employment_start_date ? ` (${r.employment_start_date.slice(0, 4)} - ${r.employment_end_date ? r.employment_end_date.slice(0, 4) : "Present"})` : ""}`
                        ).join("\n")

                        return (
                          <div className="flex items-center gap-1.5" title={tooltip}>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                              <Building2 className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 max-w-[180px]">
                              <p className="truncate text-xs font-semibold text-slate-700">{company}</p>
                              {roleTitle && <p className="truncate text-[11px] text-slate-400">{roleTitle}</p>}
                            </div>
                            {records.length > 1 && (
                              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                +{records.length - 1}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
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
                          {/* <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3">
                            {(() => {
                              const joiningDate = parseLocalDate(emp.joining_date);
                              if (!joiningDate) return "—";

                              const today = new Date();
                              const currentDate = new Date(
                                today.getFullYear(),
                                today.getMonth(),
                                today.getDate()
                              );

                              const lastWorkingDate = parseLocalDate(getLastWorkingDate(emp));
                              const endDate = lastWorkingDate || currentDate;
                              const months = getCompletedMonths(joiningDate, endDate);

                              return months >= 12 ? "Experienced" : "Fresher";
                            })()}
                          </td> */}
                          {/* <td className="whitespace-nowrap border-r border-slate-200 border-b border-slate-100 px-4 py-3 text-xs text-slate-600">{formatTotalExperience(emp)}</td> */}
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
                  <td colSpan={(isFilterActive ? 1 : 0) + 9 + (isAllSubmenu ? (role === "hr" ? 22 : 23) : 0) + (showExitDetails ? 2 : 0)} className="px-6 py-16 text-center">
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