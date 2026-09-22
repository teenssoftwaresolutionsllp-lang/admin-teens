import { createAdminClient } from "./supabase-server";
import {
  Employee,
  ProfileChangeRequest,
  HolidayCalendar,
  Project,
  AttendanceLog,
  AttendanceRegularization,
  LeaveType,
  EmployeeLeaveBalance,
  LeaveRequest,
  SalaryComponent,
  Payslip,
} from "./types";
import { calculateSalaryBreakdown, evaluateAttendancePunch } from "./calculations";

// Default seed data for immediate zero-config operation
const DEFAULT_HOLIDAY_CALENDARS: HolidayCalendar[] = [
  {
    id: "cal-in-2026",
    name: "India Standard Holidays 2026",
    country_code: "IN",
    country_name: "India",
    timezone: "Asia/Kolkata",
    holidays: [
      { id: "h1", calendar_id: "cal-in-2026", holiday_date: "2026-01-26", title: "Republic Day" },
      { id: "h2", calendar_id: "cal-in-2026", holiday_date: "2026-03-25", title: "Holi" },
      { id: "h3", calendar_id: "cal-in-2026", holiday_date: "2026-08-15", title: "Independence Day" },
      { id: "h4", calendar_id: "cal-in-2026", holiday_date: "2026-10-02", title: "Gandhi Jayanti" },
      { id: "h5", calendar_id: "cal-in-2026", holiday_date: "2026-11-08", title: "Diwali" },
    ],
  },
  {
    id: "cal-us-2026",
    name: "US Federal Holidays 2026",
    country_code: "US",
    country_name: "United States",
    timezone: "America/New_York",
    holidays: [
      { id: "h6", calendar_id: "cal-us-2026", holiday_date: "2026-01-01", title: "New Year's Day" },
      { id: "h7", calendar_id: "cal-us-2026", holiday_date: "2026-07-04", title: "Independence Day" },
      { id: "h8", calendar_id: "cal-us-2026", holiday_date: "2026-09-07", title: "Labor Day" },
      { id: "h9", calendar_id: "cal-us-2026", holiday_date: "2026-11-26", title: "Thanksgiving Day" },
      { id: "h10", calendar_id: "cal-us-2026", holiday_date: "2026-12-25", title: "Christmas Day" },
    ],
  },
];

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "FinTech Enterprise Platform",
    client_country: "India",
    timezone: "Asia/Kolkata",
    calendar_id: "cal-in-2026",
    shift_start_time: "09:00",
    shift_end_time: "18:00",
    grace_period_minutes: 30,
    half_day_cutoff_minutes: 150,
  },
  {
    id: "proj-2",
    name: "US Healthcare Claims Engine",
    client_country: "United States",
    timezone: "America/New_York",
    calendar_id: "cal-us-2026",
    shift_start_time: "18:30",
    shift_end_time: "03:30",
    grace_period_minutes: 30,
    half_day_cutoff_minutes: 150,
  },
  {
    id: "proj-bench",
    name: "Internal Engineering & Bench",
    client_country: "India",
    timezone: "Asia/Kolkata",
    calendar_id: "cal-in-2026",
    shift_start_time: "09:30",
    shift_end_time: "18:30",
    grace_period_minutes: 30,
    half_day_cutoff_minutes: 150,
  },
];

const DEFAULT_LEAVE_TYPES: LeaveType[] = [
  { id: "lt-cl", name: "Casual Leave", code: "CL", annual_quota: 12, is_paid: true, is_active: true, description: "For personal emergencies and errands" },
  { id: "lt-sl", name: "Sick Leave", code: "SL", annual_quota: 10, is_paid: true, is_active: true, description: "For medical recovery with prescription" },
  { id: "lt-el", name: "Earned Leave", code: "EL", annual_quota: 15, is_paid: true, is_active: true, description: "Accrued annual vacation leave" },
  { id: "lt-lop", name: "Loss of Pay", code: "LOP", annual_quota: 0, is_paid: false, is_active: true, description: "Unpaid leave causing per-day salary deduction" },
];

const DEFAULT_SALARY_COMPONENTS: SalaryComponent[] = [
  { id: "sc-basic", name: "Basic Salary", code: "BASIC", type: "earning", calculation_type: "percentage_of_gross", value: 50, affects_lop: true, is_active: true, is_statutory: true, description: "50% of monthly CTC" },
  { id: "sc-hra", name: "House Rent Allowance (HRA)", code: "HRA", type: "earning", calculation_type: "percentage_of_basic", value: 40, affects_lop: true, is_active: true, is_statutory: true, description: "40% of Basic Pay" },
  { id: "sc-special", name: "Special Allowance", code: "SPECIAL_ALLOWANCE", type: "earning", calculation_type: "fixed", value: 0, affects_lop: true, is_active: true, is_statutory: false, description: "Balancing component of Gross Salary" },
  { id: "sc-pf", name: "Provident Fund (PF)", code: "PF", type: "deduction", calculation_type: "percentage_of_basic", value: 12, affects_lop: false, is_active: true, is_statutory: true, description: "12% of Basic Pay" },
  { id: "sc-esi", name: "Employee State Insurance (ESI)", code: "ESI", type: "deduction", calculation_type: "percentage_of_gross", value: 0.75, affects_lop: false, is_active: true, is_statutory: true, description: "0.75% of Gross if Gross <= ₹21,000" },
  { id: "sc-pt", name: "Professional Tax (PT)", code: "PT", type: "deduction", calculation_type: "fixed", value: 200, affects_lop: false, is_active: true, is_statutory: true, description: "Standard monthly statutory state tax (₹200)" },
  { id: "sc-tds", name: "Tax Deducted at Source (TDS)", code: "TDS", type: "deduction", calculation_type: "percentage_of_gross", value: 5, affects_lop: false, is_active: false, is_statutory: true, description: "Income Tax deduction" },
];

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: "TSS001",
    employee_id: "TSS001",
    user_id: null,
    first_name: "Balaji",
    last_name: "Marpally",
    email: "employee@teenssoftware.com",
    phone: "+91 9876543210",
    date_of_birth: "1995-05-14",
    gender: "male",
    blood_group: "O+",
    marital_status: "single",
    address: "Flat 402, Greenfield Heights, Hitec City",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    emergency_contact_name: "Ramesh Marpally",
    emergency_contact_phone: "+91 9876543219",
    emergency_contact_relation: "Father",
    designation: "Senior Full Stack Developer",
    employment_type: "full-time",
    status: "active",
    salary: 75000,
    joining_date: "2023-01-15",
    bank_name: "HDFC Bank",
    bank_account_number: "50100234567890",
    ifsc_code: "HDFC0001234",
    pan_number: "ABCDE1234F",
    aadhar_number: "1234 5678 9012",
    uan_number: "100904561234",
    esi_number: "31000123456780001",
    project_id: "proj-1",
    notes: "Lead developer on FinTech project",
    created_at: "2023-01-15T00:00:00.000Z",
    updated_at: "2026-09-22T00:00:00.000Z",
  },
  {
    id: "TSS002",
    employee_id: "TSS002",
    user_id: null,
    first_name: "Sneha",
    last_name: "Reddy",
    email: "sneha.reddy@teenssoftware.com",
    phone: "+91 9876543211",
    date_of_birth: "1997-08-22",
    gender: "female",
    blood_group: "B+",
    marital_status: "single",
    address: "Plot 45, Jubilee Hills",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500033",
    designation: "UI/UX Product Designer",
    employment_type: "full-time",
    status: "active",
    salary: 60000,
    joining_date: "2023-03-10",
    bank_name: "ICICI Bank",
    bank_account_number: "102030405060",
    ifsc_code: "ICIC0000102",
    pan_number: "REDDY5678K",
    aadhar_number: "9876 5432 1098",
    project_id: "proj-1",
    notes: "Product designer for Web & Mobile",
    created_at: "2023-03-10T00:00:00.000Z",
    updated_at: "2026-09-22T00:00:00.000Z",
  },
  {
    id: "TSS003",
    employee_id: "TSS003",
    user_id: null,
    first_name: "Vikram",
    last_name: "Singh",
    email: "vikram.singh@teenssoftware.com",
    phone: "+91 9876543212",
    date_of_birth: "1994-11-03",
    gender: "male",
    blood_group: "A+",
    marital_status: "married",
    address: "Flat 102, Cyber Towers Colony, Madhapur",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    designation: "QA Automation Engineer",
    employment_type: "contract",
    status: "active",
    salary: 45000,
    joining_date: "2023-06-01",
    project_id: "proj-2",
    notes: "Automation engineer for US client claims engine",
    created_at: "2023-06-01T00:00:00.000Z",
    updated_at: "2026-09-22T00:00:00.000Z",
  },
];

// Global in-memory singleton state cache
declare global {
  // eslint-disable-next-line no-var
  var __hrmsCache: {
    employees: Employee[];
    changeRequests: ProfileChangeRequest[];
    projects: Project[];
    holidayCalendars: HolidayCalendar[];
    attendanceLogs: AttendanceLog[];
    regularizations: AttendanceRegularization[];
    leaveTypes: LeaveType[];
    leaveBalances: EmployeeLeaveBalance[];
    leaveRequests: LeaveRequest[];
    salaryComponents: SalaryComponent[];
    payslips: Payslip[];
  } | undefined;
}

function getCache() {
  if (!global.__hrmsCache || !Array.isArray(global.__hrmsCache.employees)) {
    const employees = DEFAULT_EMPLOYEES.map((e) => ({
      ...e,
      project: DEFAULT_PROJECTS.find((p) => p.id === e.project_id) || DEFAULT_PROJECTS[0],
    }));

    const leaveBalances: EmployeeLeaveBalance[] = [];
    for (const emp of employees) {
      for (const lt of DEFAULT_LEAVE_TYPES) {
        if (lt.code === "LOP" || !lt.is_active) continue;
        leaveBalances.push({
          id: `bal-${emp.id}-${lt.code}-2026`,
          employee_id: emp.id,
          leave_type_id: lt.id,
          year: 2026,
          allocated_days: lt.annual_quota,
          used_days: emp.id === "TSS001" && lt.code === "CL" ? 2 : 0,
          balance_days: emp.id === "TSS001" && lt.code === "CL" ? lt.annual_quota - 2 : lt.annual_quota,
          leave_type: lt,
        });
      }
    }

    const leaveRequests: LeaveRequest[] = [
      {
        id: "lr-init-1",
        employee_id: "TSS001",
        leave_type_id: "lt-cl",
        start_date: "2026-09-10",
        end_date: "2026-09-11",
        total_days: 2,
        is_half_day: false,
        reason: "Family function",
        status: "approved",
        reviewed_by: "hr@teenssoftware.com",
        reviewed_at: "2026-09-08T10:00:00.000Z",
        created_at: "2026-09-07T09:30:00.000Z",
        leave_type: DEFAULT_LEAVE_TYPES.find((lt) => lt.code === "CL"),
        employee: employees[0],
      },
    ];

    const changeRequests: ProfileChangeRequest[] = [
      {
        id: "pcr-init-1",
        employee_id: "TSS001",
        requested_changes: {
          address: "Villa 12, Palm Meadows, Gachibowli, Hyderabad",
          bank_name: "State Bank of India",
          bank_account_number: "309988776655",
          ifsc_code: "SBIN0004567",
        },
        previous_values: {
          address: employees[0].address,
          bank_name: employees[0].bank_name,
          bank_account_number: employees[0].bank_account_number,
          ifsc_code: employees[0].ifsc_code,
        },
        status: "pending",
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        employee: employees[0],
      },
    ];

    const todayStr = new Date().toISOString().split("T")[0];
    const attendanceLogs: AttendanceLog[] = [
      {
        id: "att-init-1",
        employee_id: "TSS001",
        attendance_date: todayStr,
        check_in_time: `${todayStr}T09:05:00.000Z`,
        check_out_time: null,
        total_hours: null,
        status: "present",
        is_late: false,
        is_regularized: false,
        created_at: `${todayStr}T09:05:00.000Z`,
      },
    ];

    // Precalculate payslips for TSS001, TSS002, TSS003
    const payslips: Payslip[] = [];
    const months = [
      { month: 8, year: 2026, name: "August", totalDays: 31 },
      { month: 9, year: 2026, name: "September", totalDays: 30 },
    ];

    for (const m of months) {
      for (const emp of employees) {
        const breakdown = calculateSalaryBreakdown({
          grossSalary: emp.salary || 50000,
          totalDaysInMonth: m.totalDays,
          lopDays: 0,
          activeComponents: DEFAULT_SALARY_COMPONENTS,
        });

        payslips.push({
          id: `ps-${emp.id}-${m.year}-${m.month}`,
          employee_id: emp.id,
          payroll_month: m.month,
          payroll_year: m.year,
          month_name: m.name,
          working_days: 26,
          present_days: 26,
          paid_leaves: emp.id === "TSS001" && m.month === 9 ? 2 : 0,
          lop_days: 0,
          gross_salary: breakdown.grossSalary,
          lop_deduction: breakdown.lopDeduction,
          total_earnings: breakdown.totalEarnings,
          total_deductions: breakdown.totalDeductions,
          net_salary: breakdown.netSalary,
          earnings_breakup: breakdown.earningsBreakdown,
          deductions_breakup: breakdown.deductionsBreakdown,
          payment_status: "processed",
          created_at: new Date().toISOString(),
          employee: emp,
        });
      }
    }

    global.__hrmsCache = {
      employees,
      changeRequests,
      projects: [...DEFAULT_PROJECTS],
      holidayCalendars: [...DEFAULT_HOLIDAY_CALENDARS],
      attendanceLogs,
      regularizations: [],
      leaveTypes: [...DEFAULT_LEAVE_TYPES],
      leaveBalances,
      leaveRequests,
      salaryComponents: [...DEFAULT_SALARY_COMPONENTS],
      payslips,
    };
  }
  return global.__hrmsCache;
}

export class DataStore {
  /**
   * Seed an employee record into the in-memory cache (called from seed route)
   */
  static seedEmployeeToCache(emp: Employee): void {
    const cache = getCache();
    if (!cache.employees) {
      cache.employees = [];
    }
    const existingIdx = cache.employees.findIndex(
      (e) => e.employee_id === emp.employee_id || e.email === emp.email
    );
    if (existingIdx >= 0) {
      cache.employees[existingIdx] = emp;
    } else {
      cache.employees.push(emp);
    }
  }

  /**
   * Fetch all employees — in-memory cache first, then DB fallback
   */
  static async getEmployees(): Promise<Employee[]> {
    const cache = getCache();

    // Try DB first
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("employees")
        .select(`*, department:departments(id, name)`)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const result = data.map((emp) => ({
          ...emp,
          project: cache.projects.find((p) => p.id === emp.project_id) || cache.projects[0],
        }));
        // Sync DB data into cache
        for (const emp of result) {
          this.seedEmployeeToCache(emp);
        }
        return result;
      }
    } catch (err) {
      console.warn("getEmployees DB fallback:", err);
    }

    // Return from in-memory cache
    return cache.employees.map((emp) => ({
      ...emp,
      project: emp.project || cache.projects.find((p) => p.id === emp.project_id) || cache.projects[0],
    }));
  }

  static async getEmployeeById(id: string): Promise<Employee | null> {
    const cache = getCache();

    // Check in-memory cache first
    const cached = cache.employees.find((e) => e.id === id || e.employee_id === id);
    if (cached) {
      return {
        ...cached,
        project: cached.project || cache.projects.find((p) => p.id === cached.project_id) || cache.projects[0],
      };
    }

    // Try DB
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("employees")
        .select(`*, department:departments(id, name)`)
        .eq("id", id)
        .single();

      if (!error && data) {
        const result = {
          ...data,
          project: cache.projects.find((p) => p.id === data.project_id) || cache.projects[0],
        };
        this.seedEmployeeToCache(result);
        return result;
      }
    } catch (err) {
      console.warn("getEmployeeById DB fallback:", err);
    }

    // Fallback to first employee
    if (cache.employees.length > 0) {
      return {
        ...cache.employees[0],
        project: cache.employees[0].project || cache.projects.find((p) => p.id === cache.employees[0].project_id) || cache.projects[0],
      };
    }

    return null;
  }

  static async getEmployeeByEmail(email: string): Promise<Employee | null> {
    const cache = getCache();

    // Check in-memory cache first
    const cached = cache.employees.find((e) => e.email?.toLowerCase() === email?.toLowerCase());
    if (cached) {
      return {
        ...cached,
        project: cached.project || cache.projects.find((p) => p.id === cached.project_id) || cache.projects[0],
      };
    }

    // Try DB
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("employees")
        .select(`*, department:departments(id, name)`)
        .eq("email", email)
        .single();

      if (!error && data) {
        const result = {
          ...data,
          project: cache.projects.find((p) => p.id === data.project_id) || cache.projects[0],
        };
        this.seedEmployeeToCache(result);
        return result;
      }
    } catch (err) {
      // silent
    }

    return null;
  }

  static async getEmployeeByUserId(userId: string): Promise<Employee | null> {
    const cache = getCache();

    // 1. Check in-memory cache first (match by user_id)
    if (userId) {
      const cachedByUserId = cache.employees.find((e) => e.user_id === userId);
      if (cachedByUserId) {
        return {
          ...cachedByUserId,
          project: cachedByUserId.project || cache.projects.find((p) => p.id === cachedByUserId.project_id) || cache.projects[0],
        };
      }
    }

    // 2. Try DB to get profile email
    try {
      const supabase = await createAdminClient();
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
      const email = profile?.email;

      if (email) {
        const cachedByEmail = cache.employees.find((e) => e.email?.toLowerCase() === email.toLowerCase());
        if (cachedByEmail) {
          cachedByEmail.user_id = userId;
          return {
            ...cachedByEmail,
            project: cachedByEmail.project || cache.projects.find((p) => p.id === cachedByEmail.project_id) || cache.projects[0],
          };
        }
      }

      let query = supabase.from("employees").select(`*, department:departments(id, name)`);
      if (email) {
        query = query.or(`user_id.eq.${userId},email.eq.${email}`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.limit(1).single();
      if (!error && data) {
        const result = {
          ...data,
          project: cache.projects.find((p) => p.id === data.project_id) || cache.projects[0],
        };
        this.seedEmployeeToCache(result);
        return result;
      }
    } catch (err) {
      console.warn("getEmployeeByUserId DB fallback:", err);
    }

    // 3. Fallback: match default employee (Balaji Marpally - TSS001) and bind user_id
    const defaultEmp = cache.employees.find((e) => e.email === "employee@teenssoftware.com" || e.employee_id === "TSS001") || cache.employees[0];
    if (defaultEmp) {
      if (userId && !defaultEmp.user_id) {
        defaultEmp.user_id = userId;
      }
      return {
        ...defaultEmp,
        project: defaultEmp.project || cache.projects.find((p) => p.id === defaultEmp.project_id) || cache.projects[0],
      };
    }

    return null;
  }


  // ==========================================
  // PROFILE CHANGE REQUESTS (MAKER-CHECKER)
  // ==========================================
  static async getProfileChangeRequests(): Promise<ProfileChangeRequest[]> {
    const cache = getCache();
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("profile_change_requests")
        .select("*, employee:employees(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch {
      return [...cache.changeRequests].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  }

  static async createProfileChangeRequest({
    employeeId,
    requestedChanges,
    previousValues,
  }: {
    employeeId: string;
    requestedChanges: Record<string, any>;
    previousValues?: Record<string, any>;
  }): Promise<ProfileChangeRequest> {
    const cache = getCache();
    const employee = await this.getEmployeeById(employeeId);

    const newRequest: ProfileChangeRequest = {
      id: "pcr-" + Date.now(),
      employee_id: employeeId,
      requested_changes: requestedChanges,
      previous_values: previousValues,
      status: "pending",
      created_at: new Date().toISOString(),
      employee: employee || undefined,
    };

    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("profile_change_requests")
        .insert({
          employee_id: employeeId,
          requested_changes: requestedChanges,
          status: "pending",
        })
        .select()
        .single();

      if (!error && data) {
        return { ...data, employee: employee || undefined };
      }
    } catch (err) {
      console.warn("createProfileChangeRequest using cache fallback:", err);
    }

    cache.changeRequests.unshift(newRequest);
    return newRequest;
  }

  static async reviewProfileChangeRequest({
    requestId,
    status,
    reviewerId,
    rejectionReason,
  }: {
    requestId: string;
    status: "approved" | "rejected";
    reviewerId: string;
    rejectionReason?: string;
  }): Promise<boolean> {
    const cache = getCache();
    const req = cache.changeRequests.find((r) => r.id === requestId);

    if (req) {
      req.status = status;
      req.reviewed_by = reviewerId;
      req.reviewed_at = new Date().toISOString();
      if (rejectionReason) req.rejection_reason = rejectionReason;

      // If approved, update official employee record in cache
      if (status === "approved" && req.employee_id) {
        const emp = cache.employees.find((e) => e.id === req.employee_id || e.employee_id === req.employee_id);
        if (emp) {
          Object.assign(emp, req.requested_changes);
          emp.updated_at = new Date().toISOString();
        }

        try {
          const supabase = await createAdminClient();
          await supabase
            .from("employees")
            .update(req.requested_changes)
            .eq("id", req.employee_id);
        } catch (e) {
          console.warn("Direct update error:", e);
        }
      }
    }

    try {
      const supabase = await createAdminClient();
      const { data: dbReq } = await supabase
        .from("profile_change_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (dbReq) {
        await supabase
          .from("profile_change_requests")
          .update({
            status,
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
            rejection_reason: rejectionReason || null,
          })
          .eq("id", requestId);

        if (status === "approved") {
          await supabase
            .from("employees")
            .update(dbReq.requested_changes)
            .eq("id", dbReq.employee_id);
        }
      }
    } catch (e) {
      console.warn("reviewProfileChangeRequest fallback update:", e);
    }

    return true;
  }

  // ==========================================
  // PROJECTS & HOLIDAY CALENDARS
  // ==========================================
  static async getProjects(): Promise<Project[]> {
    const cache = getCache();
    return cache.projects.map((p) => ({
      ...p,
      calendar: cache.holidayCalendars.find((c) => c.id === p.calendar_id),
    }));
  }

  static async saveProject(projectData: Partial<Project>): Promise<Project> {
    const cache = getCache();
    if (projectData.id) {
      const index = cache.projects.findIndex((p) => p.id === projectData.id);
      if (index >= 0) {
        cache.projects[index] = { ...cache.projects[index], ...projectData } as Project;
        return cache.projects[index];
      }
    }

    const newProject: Project = {
      id: "proj-" + Date.now(),
      name: projectData.name || "New Project",
      client_country: projectData.client_country || "India",
      timezone: projectData.timezone || "Asia/Kolkata",
      calendar_id: projectData.calendar_id || "cal-in-2026",
      shift_start_time: projectData.shift_start_time || "09:00",
      shift_end_time: projectData.shift_end_time || "18:00",
      grace_period_minutes: projectData.grace_period_minutes || 30,
      half_day_cutoff_minutes: projectData.half_day_cutoff_minutes || 150,
    };
    cache.projects.push(newProject);
    return newProject;
  }

  static async getHolidayCalendars(): Promise<HolidayCalendar[]> {
    return getCache().holidayCalendars;
  }

  // ==========================================
  // ATTENDANCE & CHECK-IN / CHECK-OUT
  // ==========================================
  static async getAttendanceLogs(employeeId?: string, month?: number, year?: number): Promise<AttendanceLog[]> {
    const cache = getCache();
    let logs = [...cache.attendanceLogs];

    if (employeeId) {
      logs = logs.filter((l) => l.employee_id === employeeId);
    }

    if (month !== undefined && year !== undefined) {
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      logs = logs.filter((l) => l.attendance_date.startsWith(prefix));
    }

    return logs.sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
  }

  static async getTodayAttendance(employeeId: string): Promise<AttendanceLog | null> {
    const cache = getCache();
    const todayStr = new Date().toISOString().split("T")[0];
    const log = cache.attendanceLogs.find(
      (l) => l.employee_id === employeeId && l.attendance_date === todayStr
    );
    return log || null;
  }

  static async clockIn(employeeId: string): Promise<AttendanceLog> {
    const cache = getCache();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const employee = await this.getEmployeeById(employeeId);
    const project = employee?.project || cache.projects[0];

    const evaluation = evaluateAttendancePunch(
      now,
      project.shift_start_time,
      project.grace_period_minutes,
      project.half_day_cutoff_minutes
    );

    let log = cache.attendanceLogs.find(
      (l) => l.employee_id === employeeId && l.attendance_date === todayStr
    );

    if (log) {
      log.check_in_time = now.toISOString();
      log.status = evaluation.status;
      log.is_late = evaluation.isLate;
    } else {
      log = {
        id: "att-" + Date.now(),
        employee_id: employeeId,
        attendance_date: todayStr,
        check_in_time: now.toISOString(),
        check_out_time: null,
        total_hours: null,
        status: evaluation.status,
        is_late: evaluation.isLate,
        is_regularized: false,
        created_at: now.toISOString(),
      };
      cache.attendanceLogs.unshift(log);
    }

    return log;
  }

  static async clockOut(employeeId: string): Promise<AttendanceLog> {
    const cache = getCache();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let log = cache.attendanceLogs.find(
      (l) => l.employee_id === employeeId && l.attendance_date === todayStr
    );

    if (!log) {
      // Auto check-in if missed
      log = await this.clockIn(employeeId);
    }

    log.check_out_time = now.toISOString();
    if (log.check_in_time) {
      const diffMs = now.getTime() - new Date(log.check_in_time).getTime();
      const hours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
      log.total_hours = hours;

      // If worked less than 4.5 hours, flag as half-day
      if (hours < 4.5 && log.status === "present") {
        log.status = "half_day";
      }
    }

    return log;
  }

  // ==========================================
  // ATTENDANCE REGULARIZATION
  // ==========================================
  static async getAttendanceRegularizations(): Promise<AttendanceRegularization[]> {
    const cache = getCache();
    return [...cache.regularizations].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  static async createAttendanceRegularization({
    employeeId,
    attendanceDate,
    proposedCheckIn,
    proposedCheckOut,
    reason,
  }: {
    employeeId: string;
    attendanceDate: string;
    proposedCheckIn: string;
    proposedCheckOut: string;
    reason: string;
  }): Promise<AttendanceRegularization> {
    const cache = getCache();
    const employee = await this.getEmployeeById(employeeId);

    const reg: AttendanceRegularization = {
      id: "reg-" + Date.now(),
      employee_id: employeeId,
      attendance_date: attendanceDate,
      proposed_check_in: proposedCheckIn,
      proposed_check_out: proposedCheckOut,
      reason,
      status: "pending",
      created_at: new Date().toISOString(),
      employee: employee || undefined,
    };

    cache.regularizations.unshift(reg);
    return reg;
  }

  static async reviewAttendanceRegularization({
    id,
    status,
    reviewerId,
    rejectionReason,
  }: {
    id: string;
    status: "approved" | "rejected";
    reviewerId: string;
    rejectionReason?: string;
  }): Promise<boolean> {
    const cache = getCache();
    const reg = cache.regularizations.find((r) => r.id === id);
    if (!reg) return false;

    reg.status = status;
    reg.reviewed_by = reviewerId;
    reg.reviewed_at = new Date().toISOString();
    if (rejectionReason) reg.rejection_reason = rejectionReason;

    if (status === "approved") {
      let log = cache.attendanceLogs.find(
        (l) => l.employee_id === reg.employee_id && l.attendance_date === reg.attendance_date
      );

      const checkInDate = new Date(`${reg.attendance_date}T${reg.proposed_check_in}`);
      const checkOutDate = new Date(`${reg.attendance_date}T${reg.proposed_check_out}`);
      const totalHours = Number(((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60)).toFixed(2));

      if (log) {
        log.check_in_time = checkInDate.toISOString();
        log.check_out_time = checkOutDate.toISOString();
        log.total_hours = totalHours;
        log.status = "present";
        log.is_late = false;
        log.is_regularized = true;
      } else {
        log = {
          id: "att-" + Date.now(),
          employee_id: reg.employee_id,
          attendance_date: reg.attendance_date,
          check_in_time: checkInDate.toISOString(),
          check_out_time: checkOutDate.toISOString(),
          total_hours: totalHours,
          status: "present",
          is_late: false,
          is_regularized: true,
          created_at: new Date().toISOString(),
        };
        cache.attendanceLogs.unshift(log);
      }
    }

    return true;
  }

  // ==========================================
  // LEAVE MANAGEMENT
  // ==========================================
  static async getLeaveTypes(): Promise<LeaveType[]> {
    return getCache().leaveTypes;
  }

  static async updateLeaveType(id: string, updates: Partial<LeaveType>): Promise<LeaveType | null> {
    const cache = getCache();
    const idx = cache.leaveTypes.findIndex((lt) => lt.id === id);
    if (idx < 0) return null;
    cache.leaveTypes[idx] = { ...cache.leaveTypes[idx], ...updates };
    return cache.leaveTypes[idx];
  }

  static async getLeaveBalances(employeeId: string, year: number = new Date().getFullYear()): Promise<EmployeeLeaveBalance[]> {
    const cache = getCache();
    let balances = cache.leaveBalances.filter(
      (b) => b.employee_id === employeeId && b.year === year
    );

    // If balances not initialized for this employee, create them from active leave types
    if (balances.length === 0) {
      balances = cache.leaveTypes
        .filter((lt) => lt.is_active && lt.code !== "LOP")
        .map((lt) => ({
          id: `bal-${employeeId}-${lt.code}-${year}`,
          employee_id: employeeId,
          leave_type_id: lt.id,
          year,
          allocated_days: lt.annual_quota,
          used_days: 0,
          balance_days: lt.annual_quota,
          leave_type: lt,
        }));
      cache.leaveBalances.push(...balances);
    } else {
      balances = balances.map((b) => ({
        ...b,
        leave_type: cache.leaveTypes.find((lt) => lt.id === b.leave_type_id),
      }));
    }

    return balances;
  }

  static async getLeaveRequests(employeeId?: string): Promise<LeaveRequest[]> {
    const cache = getCache();
    let reqs = [...cache.leaveRequests];
    if (employeeId) {
      reqs = reqs.filter((r) => r.employee_id === employeeId);
    }
    return reqs
      .map((r) => ({
        ...r,
        leave_type: cache.leaveTypes.find((lt) => lt.id === r.leave_type_id),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  static async createLeaveRequest({
    employeeId,
    leaveTypeId,
    startDate,
    endDate,
    totalDays,
    isHalfDay = false,
    reason,
  }: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    isHalfDay?: boolean;
    reason: string;
  }): Promise<LeaveRequest> {
    const cache = getCache();
    const employee = await this.getEmployeeById(employeeId);
    const leaveType = cache.leaveTypes.find((lt) => lt.id === leaveTypeId);

    const newRequest: LeaveRequest = {
      id: "lr-" + Date.now(),
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      is_half_day: isHalfDay,
      reason,
      status: "pending",
      created_at: new Date().toISOString(),
      employee: employee || undefined,
      leave_type: leaveType,
    };

    cache.leaveRequests.unshift(newRequest);
    return newRequest;
  }

  static async reviewLeaveRequest({
    requestId,
    status,
    reviewerId,
    rejectionReason,
  }: {
    requestId: string;
    status: "approved" | "rejected";
    reviewerId: string;
    rejectionReason?: string;
  }): Promise<boolean> {
    const cache = getCache();
    const req = cache.leaveRequests.find((r) => r.id === requestId);
    if (!req) return false;

    req.status = status;
    req.reviewed_by = reviewerId;
    req.reviewed_at = new Date().toISOString();
    if (rejectionReason) req.rejection_reason = rejectionReason;

    // If approved and not LOP, deduct from balance
    if (status === "approved") {
      const year = new Date(req.start_date).getFullYear();
      const balance = cache.leaveBalances.find(
        (b) => b.employee_id === req.employee_id && b.leave_type_id === req.leave_type_id && b.year === year
      );
      if (balance) {
        balance.used_days += req.total_days;
        balance.balance_days = Math.max(0, balance.allocated_days - balance.used_days);
      }
    }

    return true;
  }

  // ==========================================
  // SALARY COMPONENTS & PAYROLL ENGINE
  // ==========================================
  static async getSalaryComponents(): Promise<SalaryComponent[]> {
    return getCache().salaryComponents;
  }

  static async updateSalaryComponent(
    id: string,
    updates: Partial<SalaryComponent>
  ): Promise<SalaryComponent | null> {
    const cache = getCache();
    const idx = cache.salaryComponents.findIndex((sc) => sc.id === id);
    if (idx < 0) return null;
    cache.salaryComponents[idx] = { ...cache.salaryComponents[idx], ...updates };
    return cache.salaryComponents[idx];
  }

  static async toggleSalaryComponent(id: string): Promise<SalaryComponent | null> {
    const cache = getCache();
    const item = cache.salaryComponents.find((sc) => sc.id === id);
    if (!item) return null;
    item.is_active = !item.is_active;
    return item;
  }

  static async getPayslips(employeeId?: string, month?: number, year?: number): Promise<Payslip[]> {
    const cache = getCache();
    let slips = [...cache.payslips];
    if (employeeId) {
      slips = slips.filter((p) => p.employee_id === employeeId);
    }
    if (month) {
      slips = slips.filter((p) => p.payroll_month === month);
    }
    if (year) {
      slips = slips.filter((p) => p.payroll_year === year);
    }
    return slips.sort((a, b) => b.payroll_year - a.payroll_year || b.payroll_month - a.payroll_month);
  }

  static async getPayslipById(id: string): Promise<Payslip | null> {
    const cache = getCache();
    const slip = cache.payslips.find((p) => p.id === id);
    if (!slip) return null;
    const employee = await this.getEmployeeById(slip.employee_id);
    return { ...slip, employee: employee || undefined };
  }

  /**
   * Run and generate monthly payroll for all active employees.
   * Calculates LOP days based on approved unpaid leaves and absent/half days.
   */
  static async generateMonthlyPayroll({
    month,
    year,
  }: {
    month: number;
    year: number;
  }): Promise<{ generatedCount: number; payslips: Payslip[] }> {
    const cache = getCache();
    const employees = await this.getEmployees();
    const activeComponents = cache.salaryComponents;

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[month - 1];
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    const generatedSlips: Payslip[] = [];

    for (const emp of employees) {
      if (emp.status !== "active") continue;
      const baseSalary = emp.salary || 50000; // default ₹50,000 if not set

      // Calculate LOP days from approved leave requests
      const empLeaves = cache.leaveRequests.filter((lr) => {
        if (lr.employee_id !== emp.id || lr.status !== "approved") return false;
        const start = new Date(lr.start_date);
        return start.getFullYear() === year && start.getMonth() + 1 === month;
      });

      let lopDays = 0;
      for (const req of empLeaves) {
        const type = cache.leaveTypes.find((lt) => lt.id === req.leave_type_id);
        if (type && !type.is_paid) {
          lopDays += req.total_days;
        }
      }

      // Also factor half-days from attendance
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      const attLogs = cache.attendanceLogs.filter(
        (a) => a.employee_id === emp.id && a.attendance_date.startsWith(prefix)
      );
      const halfDays = attLogs.filter((a) => a.status === "half_day").length;
      lopDays += halfDays * 0.5;

      const workingDays = Math.min(totalDaysInMonth, 26); // standard 26 working days
      const presentDays = Math.max(0, workingDays - lopDays);

      const breakdown = calculateSalaryBreakdown({
        grossSalary: baseSalary,
        totalDaysInMonth,
        lopDays,
        activeComponents,
      });

      // Check if payslip already exists for this month/year, replace if so
      const existingIdx = cache.payslips.findIndex(
        (p) => p.employee_id === emp.id && p.payroll_month === month && p.payroll_year === year
      );

      const payslip: Payslip = {
        id: `ps-${emp.id}-${year}-${month}`,
        employee_id: emp.id,
        payroll_month: month,
        payroll_year: year,
        month_name: monthName,
        working_days: workingDays,
        present_days: presentDays,
        paid_leaves: empLeaves.filter((l) => l.leave_type?.is_paid).reduce((acc, c) => acc + c.total_days, 0),
        lop_days: lopDays,
        gross_salary: breakdown.grossSalary,
        lop_deduction: breakdown.lopDeduction,
        total_earnings: breakdown.totalEarnings,
        total_deductions: breakdown.totalDeductions,
        net_salary: breakdown.netSalary,
        earnings_breakup: breakdown.earningsBreakdown,
        deductions_breakup: breakdown.deductionsBreakdown,
        payment_status: "processed",
        created_at: new Date().toISOString(),
        employee: emp,
      };

      if (existingIdx >= 0) {
        cache.payslips[existingIdx] = payslip;
      } else {
        cache.payslips.unshift(payslip);
      }

      generatedSlips.push(payslip);
    }

    return { generatedCount: generatedSlips.length, payslips: generatedSlips };
  }
}
