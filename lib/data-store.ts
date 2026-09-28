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

// const DEFAULT_EMPLOYEES: Employee[] = [
//   {
//     id: "TSS001",
//     employee_id: "TSS001",
//     user_id: null,
//     first_name: "Balaji",
//     last_name: "Marpally",
//     email: "employee@teenssoftware.com",
//     phone: "+91 9876543210",
//     date_of_birth: "1995-05-14",
//     gender: "male",
//     blood_group: "O+",
//     marital_status: "single",
//     address: "Flat 402, Greenfield Heights, Hitec City",
//     city: "Hyderabad",
//     state: "Telangana",
//     pincode: "500081",
//     emergency_contact_name: "Ramesh Marpally",
//     emergency_contact_phone: "+91 9876543219",
//     emergency_contact_relation: "Father",
//     designation: "Senior Full Stack Developer",
//     employment_type: "full-time",
//     status: "active",
//     salary: 75000,
//     joining_date: "2023-01-15",
//     bank_name: "HDFC Bank",
//     bank_account_number: "50100234567890",
//     ifsc_code: "HDFC0001234",
//     pan_number: "ABCDE1234F",
//     aadhar_number: "1234 5678 9012",
//     uan_number: "100904561234",
//     esi_number: "31000123456780001",
//     project_id: "proj-1",
//     notes: "Lead developer on FinTech project",
//     created_at: "2023-01-15T00:00:00.000Z",
//     updated_at: "2026-09-22T00:00:00.000Z",
//   },
//   {
//     id: "TSS002",
//     employee_id: "TSS002",
//     user_id: null,
//     first_name: "Sneha",
//     last_name: "Reddy",
//     email: "sneha.reddy@teenssoftware.com",
//     phone: "+91 9876543211",
//     date_of_birth: "1997-08-22",
//     gender: "female",
//     blood_group: "B+",
//     marital_status: "single",
//     address: "Plot 45, Jubilee Hills",
//     city: "Hyderabad",
//     state: "Telangana",
//     pincode: "500033",
//     designation: "UI/UX Product Designer",
//     employment_type: "full-time",
//     status: "active",
//     salary: 60000,
//     joining_date: "2023-03-10",
//     bank_name: "ICICI Bank",
//     bank_account_number: "102030405060",
//     ifsc_code: "ICIC0000102",
//     pan_number: "REDDY5678K",
//     aadhar_number: "9876 5432 1098",
//     project_id: "proj-1",
//     notes: "Product designer for Web & Mobile",
//     created_at: "2023-03-10T00:00:00.000Z",
//     updated_at: "2026-09-22T00:00:00.000Z",
//   },
//   {
//     id: "TSS003",
//     employee_id: "TSS003",
//     user_id: null,
//     first_name: "Vikram",
//     last_name: "Singh",
//     email: "vikram.singh@teenssoftware.com",
//     phone: "+91 9876543212",
//     date_of_birth: "1994-11-03",
//     gender: "male",
//     blood_group: "A+",
//     marital_status: "married",
//     address: "Flat 102, Cyber Towers Colony, Madhapur",
//     city: "Hyderabad",
//     state: "Telangana",
//     pincode: "500081",
//     designation: "QA Automation Engineer",
//     employment_type: "contract",
//     status: "active",
//     salary: 45000,
//     joining_date: "2023-06-01",
//     project_id: "proj-2",
//     notes: "Automation engineer for US client claims engine",
//     created_at: "2023-06-01T00:00:00.000Z",
//     updated_at: "2026-09-22T00:00:00.000Z",
//   },
// ];

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
    const employees: Employee[] = [];

    const leaveBalances: EmployeeLeaveBalance[] = [];

    const leaveRequests: LeaveRequest[] = [];

    const changeRequests: ProfileChangeRequest[] = [];

    const todayStr = new Date().toISOString().split("T")[0];
    const attendanceLogs: AttendanceLog[] = [];

    // Precalculate payslips for TSS001, TSS002, TSS003
    const payslips: Payslip[] = [];

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

    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    try {
      const supabase = await createAdminClient();

      let query = supabase
        .from("employees")
        .select(`*, department:departments(id, name)`);

      if (UUID_REGEX.test(id)) {
        query = query.eq("id", id);
      } else {
        query = query.eq("employee_id", id);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const result: Employee = {
          ...data,
          project:
            cache.projects.find((p) => p.id === data.project_id) ||
            cache.projects[0],
        };

        this.seedEmployeeToCache(result);

        return result;
      }
    } catch (error) {
      console.warn("getEmployeeById DB fallback:", error);
    }

    const cached = cache.employees.find(
      (employee) =>
        employee.id === id || employee.employee_id === id
    );

    if (cached) {
      return {
        ...cached,
        project:
          cached.project ||
          cache.projects.find(
            (project) => project.id === cached.project_id
          ) ||
          cache.projects[0],
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

    return null;
  }

  static async createEmployee(empData: Partial<Employee>): Promise<Employee> {
    const cache = getCache();
    const id = empData.id || crypto.randomUUID();
    const employeeId = empData.employee_id || await this.getNextEmployeeId();
    const newEmp: Employee = {
      id,
      employee_id: employeeId,
      user_id: empData.user_id || null,
      first_name: empData.first_name || "New",
      last_name: empData.last_name || "Employee",
      email: empData.email || "",
      phone: empData.phone || null,
      date_of_birth: empData.date_of_birth || null,
      gender: empData.gender || null,
      blood_group: empData.blood_group || null,
      marital_status: empData.marital_status || null,
      address: empData.address || null,
      city: empData.city || null,
      state: empData.state || null,
      pincode: empData.pincode || null,
      emergency_contact_name: empData.emergency_contact_name || null,
      emergency_contact_phone: empData.emergency_contact_phone || null,
      emergency_contact_relation: empData.emergency_contact_relation || null,
      department_id: empData.department_id || null,
      designation: empData.designation || null,
      employment_type: empData.employment_type || "full-time",
      joining_date: empData.joining_date || new Date().toISOString().split("T")[0],
      probation_end_date: empData.probation_end_date || null,
      confirmation_date: empData.confirmation_date || null,
      reporting_manager: empData.reporting_manager || null,
      work_location: empData.work_location || null,
      client_type: empData.client_type || null,
      company_name: empData.company_name || null,
      status: empData.status || "active",
      salary: empData.salary || 50000,
      bank_name: empData.bank_name || null,
      bank_account_number: empData.bank_account_number || null,
      ifsc_code: empData.ifsc_code || null,
      pan_number: empData.pan_number || null,
      aadhar_number: empData.aadhar_number || null,
      esi_number: empData.esi_number || null,
      project_id: empData.project_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project: cache.projects[0],
    };

    const { project: _project, ...employeeRow } = newEmp;

    // Persist only columns that exist in the employees table.
    try {
      const supabase = await createAdminClient();
      const { project, ...employeeForDb } = newEmp;
      const { data, error } = await supabase
        .from("employees")
        .insert(employeeForDb)
        .select(`*, department:departments(id, name)`)
        .single();

      if (error) {
          console.error("========== EMPLOYEE INSERT ERROR ==========");
          console.error(error);
          console.error("Message:", error.message);
          console.error("Details:", error.details);
          console.error("Hint:", error.hint);
          console.error("Code:", error.code);
          console.error("==========================================");
          throw error;
      }

      if (!data) {
        throw new Error("Employee was not returned after insert");
      }
      
        this.seedEmployeeToCache(data);
        return data;

    } catch (e) {
      console.warn("createEmployee DB warning:", e);
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw e;
      }
    }

    this.seedEmployeeToCache(newEmp);
    await this.getLeaveBalances(newEmp.id);
    return newEmp;
  }

  static async getNextEmployeeId(): Promise<string> {
    let maxNumber = 4999;

    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("employees")
        .select("employee_id")
        .like("employee_id", "TN%");
      if (!error && data ) {
        for (const employee of data) {
          const match = /^TN(\d+)$/.exec(employee.employee_id || "")
          if (match) {
             maxNumber = Math.max(maxNumber,Number(match[1]))
          }
        }
      }
    } catch (error) {
      console.warn("getNextEmployeeId database warning:", error);
    }
    const cache = getCache();
    for (const employee of cache.employees) {
      const match = /^TN(\d+)$/.exec(employee.employee_id || "");
      if (match) {
        maxNumber = Math.max(maxNumber,Number(match[1]))
      }
    }


    return `TN${maxNumber + 1}`;
  }

  static async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    const cache = getCache();
    const existing = await this.getEmployeeById(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    this.seedEmployeeToCache(updated);

    try {
      const supabase = await createAdminClient();
      const UUID_REGEX =/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let query = supabase
      .from("employees")
      .update({
          ...updates,
          updated_at: new Date().toISOString(),
      });

      if (UUID_REGEX.test(id)) {
        query = query.eq("id", id);
      } else {
        query = query.eq("employee_id", id);
      }
      const { error } = await query;
      if(error){
        throw error;
      }


    } catch (error) {
      console.warn("updateEmployee DB warning:", error);
    }

    return updated;
  }

  static async deleteEmployee(id: string): Promise<boolean> {
  const cache = getCache();

  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  try {
    const supabase = await createAdminClient();

    let query = supabase
      .from("employees")
      .delete();

    if (UUID_REGEX.test(id)) {
      query = query.eq("id", id);
    } else {
      query = query.eq("employee_id", id);
    }

    const { error } = await query;

    if (error) {
      throw error;
    }

    // Remove from in-memory cache
    const index = cache.employees.findIndex(
      (employee) =>
        employee.id === id ||
        employee.employee_id === id
    );

    if (index !== -1) {
      cache.employees.splice(index, 1);
    }

    return true;
  } catch (error) {
    console.error("deleteEmployee DB error:", error);
    throw error;
  }
  }

  static async terminateEmployee(
    id: string,
    exitType: "resigned" | "terminated" | "laid_off",
    exitReason: string,
    exitDocumentUrl?: string | null,
    exitDocumentName?: string | null,
    exitDate?: string
  ): Promise<Employee | null> {
    const cache = getCache();

    const employee = await this.getEmployeeById(id);

    if (!employee) {
      throw new Error("Employee not found");
    }

    if ( employee.status === "resigned" || employee.status === "terminated" || employee.status === "laid_off"){
      throw new Error("Employee has already exited");
    } 

    if (!exitReason?.trim()) {
      throw new Error("Exit reason is required");
    }

    if (!exitDocumentUrl?.trim()|| !exitDocumentName?.trim()) {
      throw new Error("Supporting exit document is required");
    }

    if (!exitDate?.trim()) {
      throw new Error("Exit date is required");
    }

    const UUID_REGEX =/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const supabase = await createAdminClient();
    const finalexitDate = exitDate;
    const updatedAt = new Date().toISOString();
    const updates = {
      status: exitType,
      exit_reason: exitReason.trim(),
      exit_document_url: exitDocumentUrl || null,
      exit_document_name: exitDocumentName || null,
      exit_date: finalexitDate,
      updated_at: updatedAt,
    };

    let query = supabase
      .from("employees")
      .update(updates);

    if (UUID_REGEX.test(id)) {
      query = query.eq("id", id);
    } else {
      query = query.eq("employee_id", id);
    }

    const { data, error } = await query
      .select(`*, department:departments(id, name)`)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Employee exit update failed");
    }

    // Update cache
    const index = cache.employees.findIndex(
      (emp) =>emp.id === employee.id ||emp.employee_id === employee.employee_id);

      if (index !== -1) {
        cache.employees[index] = {
          ...cache.employees[index],
          status: exitType,
          exit_reason: exitReason.trim(),
          exit_document_url: exitDocumentUrl || null,
          exit_document_name: exitDocumentName || null,
          exit_date: finalexitDate,
          updated_at: updatedAt,
        };
      }

    return data as Employee;
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
    if (!employee) {
      throw new Error("Employee not found");
    }

    const employeeUuid = employee.id;

    const newRequest: ProfileChangeRequest = {
      id: "pcr-" + Date.now(),
      employee_id: employeeUuid,
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
          employee_id: employeeUuid,
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
    try {
      const supabase = await createAdminClient();
      const { data: dbReq, error: requestError } = await supabase
        .from("profile_change_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      if (dbReq) {
        const reviewedAt = new Date().toISOString();
        const { error: reviewError } = await supabase
          .from("profile_change_requests")
          .update({
            status,
            reviewed_by: reviewerId,
            reviewed_at: reviewedAt,
            rejection_reason: rejectionReason || null,
          })
          .eq("id", requestId);

        if (reviewError) throw reviewError;

        if (status === "approved") {
          const { error: employeeError } = await supabase
            .from("employees")
            .update(dbReq.requested_changes)
            .eq("id", dbReq.employee_id);

          if (employeeError) throw employeeError;
        }

        const cachedRequest = cache.changeRequests.find((r) => r.id === requestId);
        if (cachedRequest) {
          cachedRequest.status = status;
          cachedRequest.reviewed_by = reviewerId;
          cachedRequest.reviewed_at = reviewedAt;
          cachedRequest.rejection_reason = rejectionReason || null;
        }

        return true;
      }
    } catch (e) {
      if (!cache.changeRequests.some((r) => r.id === requestId)) {
        console.error("reviewProfileChangeRequest database update failed:", e);
        throw e;
      }
    }

    const req = cache.changeRequests.find((r) => r.id === requestId);
    if (!req) return false;

    req.status = status;
    req.reviewed_by = reviewerId;
    req.reviewed_at = new Date().toISOString();
    req.rejection_reason = rejectionReason || null;

    if (status === "approved" && req.employee_id) {
      const emp = cache.employees.find((e) => e.id === req.employee_id || e.employee_id === req.employee_id);
      if (emp) {
        Object.assign(emp, req.requested_changes);
        emp.updated_at = new Date().toISOString();
      }
    }

    return true;
  }

  // ==========================================
  // PROJECTS & HOLIDAY CALENDARS
  // ==========================================
  static async getProjects(): Promise<Project[]> {
    const cache = getCache();
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*, calendar:holiday_calendars(*)")
        .order("name");

      if (error) throw error;
      if (data && data.length > 0) return data as Project[];

      const calendarDefinitions = [
        { name: "India Standard Holidays 2026", country_code: "IN", country_name: "India", timezone: "Asia/Kolkata" },
        { name: "US Federal Holidays 2026", country_code: "US", country_name: "United States", timezone: "America/New_York" },
      ];
      const calendars: Record<string, string> = {};
      for (const definition of calendarDefinitions) {
        const { data: calendar, error: calendarError } = await supabase
          .from("holiday_calendars")
          .insert(definition)
          .select("id")
          .single();
        if (calendarError) throw calendarError;
        calendars[definition.country_code] = calendar.id;
      }

      const projectRows = [
        { name: "FinTech Enterprise Platform", client_country: "India", timezone: "Asia/Kolkata", calendar_id: calendars.IN, shift_start_time: "09:00", shift_end_time: "18:00", grace_period_minutes: 30, half_day_cutoff_minutes: 150 },
        { name: "US Healthcare Claims Engine", client_country: "United States", timezone: "America/New_York", calendar_id: calendars.US, shift_start_time: "18:30", shift_end_time: "03:30", grace_period_minutes: 30, half_day_cutoff_minutes: 150 },
        { name: "Internal Engineering & Bench", client_country: "India", timezone: "Asia/Kolkata", calendar_id: calendars.IN, shift_start_time: "09:30", shift_end_time: "18:30", grace_period_minutes: 30, half_day_cutoff_minutes: 150 },
      ];
      const { data: createdProjects, error: projectError } = await supabase
        .from("projects")
        .insert(projectRows)
        .select("*, calendar:holiday_calendars(*)");
      if (projectError) throw projectError;
      return (createdProjects || []) as Project[];
    } catch (error) {
      console.warn("getProjects database warning:", error);
      return cache.projects.map((p) => ({
        ...p,
        calendar: cache.holidayCalendars.find((c) => c.id === p.calendar_id),
      }));
    }
  }

  static async saveProject(projectData: Partial<Project>): Promise<Project> {
    const cache = getCache();
    if (projectData.id) {
      const { id, ...updates } = projectData;
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .select("*, calendar:holiday_calendars(*)")
        .single();
      if (error) throw error;
      if (data) return data as Project;
    }

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: projectData.name || "New Project",
        client_country: projectData.client_country || "India",
        timezone: projectData.timezone || "Asia/Kolkata",
        calendar_id: projectData.calendar_id || null,
        shift_start_time: projectData.shift_start_time || "09:00",
        shift_end_time: projectData.shift_end_time || "18:00",
        grace_period_minutes: projectData.grace_period_minutes ?? 30,
        half_day_cutoff_minutes: projectData.half_day_cutoff_minutes ?? 150,
      })
      .select("*, calendar:holiday_calendars(*)")
      .single();
    if (error) throw error;
    if (!data) throw new Error("Project was not returned after insert");

    const newProject = data as Project;
    cache.projects.push(newProject);
    return newProject;
  }

  static async getHolidayCalendars(): Promise<HolidayCalendar[]> {
    const cache = getCache();
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("holiday_calendars")
        .select("*, holidays(*)")
        .order("country_name");
      if (error) throw error;
      if (data && data.length > 0) return data as HolidayCalendar[];
    } catch (error) {
      console.warn("getHolidayCalendars database warning:", error);
    }
    return cache.holidayCalendars;
  }

  // ==========================================
  // ATTENDANCE & CHECK-IN / CHECK-OUT
  // ==========================================

  static async getAttendanceLogs(
  employeeId?: string,
  month?: number,
  year?: number
): Promise<AttendanceLog[]> {
  const supabase = await createAdminClient();

  let query = supabase
    .from("attendance_logs")
    .select("*");

  if (employeeId) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        employeeId
      );

    let employeeUuid: string | null = null;

    if (isUuid) {
      employeeUuid = employeeId;
    } else {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("id")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (employeeError) {
        throw new Error(employeeError.message);
      }

      employeeUuid = employee?.id || null;
    }

    // Employee not found
    if (!employeeUuid) {
      return [];
    }

    query = query.eq("employee_id", employeeUuid);
  }

  if (month !== undefined && year !== undefined) {
    const startDate = new Date(year, month - 1, 1)
      .toISOString()
      .split("T")[0];

    const endDate = new Date(year, month, 0)
      .toISOString()
      .split("T")[0];

    query = query
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate);
  }

  const { data, error } = await query.order("attendance_date", {
    ascending: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as AttendanceLog[];
}

  static async getTodayAttendance(employeeId: string): Promise<AttendanceLog | null> {
  const supabase = await createAdminClient();

  const todayStr = new Date().toISOString().split("T")[0];

  // employeeId can be TSS001 or a UUID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      employeeId
    );

  let employee: { id: string } | null = null;

  if (isUuid) {
    const { data, error } = await supabase
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    employee = data;
  } else {
    const { data, error } = await supabase
      .from("employees")
      .select("id")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    employee = data;
  }

  if (!employee) {
    return null;
  }

  // IMPORTANT:
  // attendance_logs.employee_id expects the employee UUID,
  // not TSS001/TSS002/etc.
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("attendance_date", todayStr)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AttendanceLog | null;
}

  static async clockIn(employeeId: string): Promise<AttendanceLog> {
   const supabase = await createAdminClient();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const employee = await this.getEmployeeById(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    const employeeUuid = employee.id;
    const project = employee?.project;

    if(!project){
      throw new Error("Employee project not found");
    }

    const evaluation = evaluateAttendancePunch(
      now,
      project.shift_start_time,
      project.grace_period_minutes,
      project.half_day_cutoff_minutes
    );


    const { data: existingLog, error: findError } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("employee_id", employeeUuid)
    .eq("attendance_date", todayStr)
    .maybeSingle();

    if (findError) {
      throw new Error(findError.message);
    }
    let log;

    if(existingLog){
      const { data, error } = await supabase
      .from("attendance_logs")
      .update({
        check_in_time: now.toISOString(),
        status: evaluation.status,
        is_late: evaluation.isLate,
      })
      .eq("id", existingLog.id)
      .select()
      .single();
    

    if (error) {
      throw new Error(error.message);
    }
     log = data;
  }

  else{
     const { data, error } = await supabase
      .from("attendance_logs")
      .insert({
        employee_id: employeeUuid,
        attendance_date: todayStr,
        check_in_time: now.toISOString(),
        check_out_time: null,
        total_hours: null,
        status: evaluation.status,
        is_late: evaluation.isLate,
        is_regularized: false,
      })
      .select()
      .single();
      if (error) {
        throw new Error(error.message);
      }
      log = data;
  }
    return log as AttendanceLog;
  }

  static async clockOut(employeeId: string): Promise<AttendanceLog> {
    const supabase = await createAdminClient();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const employee = await this.getEmployeeById(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    const employeeUuid = employee.id;

   const { data: log, error: findError } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("employee_id", employeeUuid)
    .eq("attendance_date", todayStr)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

    if (!log) {
      
      const newLog = await this.clockIn(employeeId);
      const checkOut = now;
      const checkIn = new Date(newLog.check_in_time!);
      const hours = Number(((checkOut.getTime() - checkIn.getTime()) /(1000 * 60 * 60)).toFixed(2))

      const status = hours < 4.5 && newLog.status === "present" ? "half_day" : newLog.status;
      const { data: updatedLog, error: updateError } = await supabase
      .from("attendance_logs")
      .update({
        check_out_time: checkOut.toISOString(),
        total_hours: hours,
        status,
      })
      .eq("id", newLog.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return updatedLog as AttendanceLog;
  }
    if (!log.check_in_time) {
      throw new Error("Check-in time is missing");
    }

    const checkOut = now;
    const checkIn = new Date(log.check_in_time);

    const hours = Number(((checkOut.getTime() - checkIn.getTime()) /(1000 * 60 * 60)).toFixed(2))

    const status = hours < 4.5 && log.status === "present" ? "half_day" :log.status

    const { data: updatedLog, error: updateError } = await supabase
    .from("attendance_logs")
    .update({
      check_out_time: checkOut.toISOString(),
      total_hours: hours,
      status,
    })
    .eq("id", log.id)
    .select()
    .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return updatedLog as AttendanceLog;
  }

  // ==========================================
  // ATTENDANCE REGULARIZATION
  // ==========================================
  static async getAttendanceRegularizations(): Promise<AttendanceRegularization[]> {
    const cache = getCache();
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("attendance_regularizations")
        .select("*, employee:employees(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn("getAttendanceRegularizations database warning:", error);
      return [...cache.regularizations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
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

    if (!employee) {
      throw new Error("Employee not found");
    }

    const employeeUuid = employee.id;

    const reg: AttendanceRegularization = {
      id: "reg-" + Date.now(),
      employee_id: employeeUuid,
      attendance_date: attendanceDate,
      proposed_check_in: proposedCheckIn,
      proposed_check_out: proposedCheckOut,
      reason,
      status: "pending",
      created_at: new Date().toISOString(),
      employee: employee || undefined,
    };

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("attendance_regularizations")
      .insert({
        employee_id: employeeUuid,
        attendance_date: attendanceDate,
        proposed_check_in: proposedCheckIn,
        proposed_check_out: proposedCheckOut,
        reason,
        status: "pending",
      })
      .select("*, employee:employees(*)")
      .single();
    if (error) throw error;
    if (!data) throw new Error("Regularization was not returned after insert");
    const createdRegularization = data as AttendanceRegularization;
    cache.regularizations.unshift(createdRegularization);
    return createdRegularization;
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
    const supabase = await createAdminClient();

    // Get regularization from DB
    const { data: dbReg, error: regError } = await supabase
      .from("attendance_regularizations")
      .select("*")
      .eq("id", id)
      .single();

    if (regError) {
      throw new Error(regError.message);
    }

    if (!dbReg) {
      return false;
    }

    if (dbReg.status !== "pending") {
       throw new Error(`Attendance regularization has already been ${dbReg.status}`);
    }

    const reg = dbReg as AttendanceRegularization;
    const reviewedAt = new Date().toISOString();

    // Only create/update attendance when approved
    if (status === "approved") {
      const checkInDate = new Date(
        `${reg.attendance_date}T${reg.proposed_check_in}`
      );

      const checkOutDate = new Date(
        `${reg.attendance_date}T${reg.proposed_check_out}`
      );

      const totalHours = Number(
        (
          (checkOutDate.getTime() - checkInDate.getTime()) /
          (1000 * 60 * 60)
        ).toFixed(2)
      );

      // Check existing attendance log in Supabase
      const { data: existingLog, error: logError } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("employee_id", reg.employee_id)
        .eq("attendance_date", reg.attendance_date)
        .maybeSingle();

      if (logError) {
        throw new Error(logError.message);
      }

      let attendanceLog: AttendanceLog;

      if (existingLog) {
        // Update existing attendance log
        const { data: updatedLog, error: attendanceUpdateError } = await supabase
          .from("attendance_logs")
          .update({
            check_in_time: checkInDate.toISOString(),
            check_out_time: checkOutDate.toISOString(),
            total_hours: totalHours,
            status: "present",
            is_late: false,
            is_regularized: true,
          })
          .eq("id", existingLog.id)
          .select()
          .single();

        if (attendanceUpdateError) {
          throw new Error(attendanceUpdateError.message);
        }

        attendanceLog = updatedLog as AttendanceLog;
      } else {
        // Create new attendance log
        const { data: newLog, error: attendanceInsertError } = await supabase
          .from("attendance_logs")
          .insert({
            employee_id: reg.employee_id,
            attendance_date: reg.attendance_date,
            check_in_time: checkInDate.toISOString(),
            check_out_time: checkOutDate.toISOString(),
            total_hours: totalHours,
            status: "present",
            is_late: false,
            is_regularized: true,
          })
          .select()
          .single();

        if (attendanceInsertError) {
          throw new Error(attendanceInsertError.message);
        }

        attendanceLog = newLog as AttendanceLog;
      }

      // Keep attendance cache in sync
      const cacheLogIndex = cache.attendanceLogs.findIndex(
        (l) =>
          l.employee_id === reg.employee_id &&
          l.attendance_date === reg.attendance_date
      );

      if (cacheLogIndex >= 0) {
        cache.attendanceLogs[cacheLogIndex] = attendanceLog;
      } else {
        cache.attendanceLogs.unshift(attendanceLog);
      }
    }
    const { error: updateError } = await supabase
    .from("attendance_regularizations")
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt,
      rejection_reason: rejectionReason || null,
    })
    .eq("id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const cachedReg = cache.regularizations.find((r) => r.id === id);

  if (cachedReg) {
    cachedReg.status = status;
    cachedReg.reviewed_by = reviewerId;
    cachedReg.reviewed_at = reviewedAt;
    cachedReg.rejection_reason = rejectionReason || null;
  }

    return true;
  }

  // ==========================================
  // LEAVE MANAGEMENT
  // ==========================================
  static async getLeaveTypes(): Promise<LeaveType[]> {
    const cache = getCache();

    try {
      const supabase = await createAdminClient();

      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .in("code", ["CL", "SL"])
        .eq("is_active", true)
        .order("name");

      if (error) {
        throw error;
      }

      // Existing DB leave types already have real UUIDs.
      if (data && data.length > 0) {
        cache.leaveTypes = data as LeaveType[];
        return cache.leaveTypes;
      }

      // No CL/SL records exist, so create them.
      const defaults = [
        {
          name: "Casual Leave",
          code: "CL",
          annual_quota: 12,
          is_paid: true,
          is_active: true,
          description: "For personal emergencies and errands",
        },
        {
          name: "Sick Leave",
          code: "SL",
          annual_quota: 10,
          is_paid: true,
          is_active: true,
          description: "For medical recovery with prescription",
        },
      ];

      const { data: created, error: insertError } = await supabase
        .from("leave_types")
        .insert(defaults)
        .select("*");

      if (insertError) {
        throw insertError;
      }

      if (!created || created.length === 0) {
        throw new Error("Leave types were not created");
      }

      // IMPORTANT:
      // Use the UUIDs generated by Supabase.
      cache.leaveTypes = created as LeaveType[];

      return cache.leaveTypes;
    } catch (error) {
      console.error("getLeaveTypes failed:", error);

      /*
      * Do NOT return DEFAULT_LEAVE_TYPES here because their IDs
      * are "lt-cl" and "lt-sl", which are not valid UUIDs.
      *
      * Returning them could cause:
      * invalid input syntax for type uuid: "lt-cl"
      */
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to load leave types"
      );
    }
  }

  static async updateLeaveType(id: string, updates: Partial<LeaveType>): Promise<LeaveType | null> {
    const cache = getCache();
    const idx = cache.leaveTypes.findIndex((lt) => lt.id === id);
    if (idx < 0) return null;
    cache.leaveTypes[idx] = { ...cache.leaveTypes[idx], ...updates };
    return cache.leaveTypes[idx];
  }

  static async getLeaveBalances(
    employeeId: string,
    year: number = new Date().getFullYear()
  ): Promise<EmployeeLeaveBalance[]> {
    const cache = getCache();

    const employee = await this.getEmployeeById(employeeId);

    if (!employee) {
      return [];
    }

    const employeeUuid = employee.id;

    const supabase = await createAdminClient();

    // Get existing balances from Supabase
    const { data: dbBalances, error } = await supabase
      .from("employee_leave_balances")
      .select("*,leave_type:leave_types(*)")
      .eq("employee_id", employeeUuid)
      .eq("year", year);

    if (error) {
      throw new Error(error.message);
    }

    let balances: EmployeeLeaveBalance[] = (dbBalances || [])
      .filter(
        (balance: any) =>
          balance.leave_type?.is_active &&
          (balance.leave_type?.code === "CL" ||
            balance.leave_type?.code === "SL")
      )
      .map((balance: any) => ({
        ...balance,
        leave_type: balance.leave_type,
      })) as EmployeeLeaveBalance[];

    const activeLeaveTypes = (await this.getLeaveTypes()).filter(
      (lt) =>
        lt.is_active &&
        (lt.code === "CL" || lt.code === "SL")
    );

    const existingBalanceTypeIds = new Set(
      balances.map((balance) => balance.leave_type_id)
    );

    const missingLeaveTypes = activeLeaveTypes.filter(
      (lt) => !existingBalanceTypeIds.has(lt.id)
    );

    const rows = missingLeaveTypes.map((lt) => ({
      employee_id: employeeUuid,
      leave_type_id: lt.id,
      year,
      allocated_days: lt.annual_quota,
      used_days: 0,
      balance_days: lt.annual_quota,
    }));

    if (rows.length > 0) {
      const { data: createdBalances, error: insertError } = await supabase
        .from("employee_leave_balances")
        .upsert(rows, {
          onConflict: "employee_id,leave_type_id,year",
        })
        .select();

      if (insertError) {
        throw new Error(insertError.message);
      }

      const createdWithLeaveTypes = (createdBalances || []).map(
        (balance: any) => ({
          ...balance,
          leave_type: activeLeaveTypes.find(
            (lt) => lt.id === balance.leave_type_id
          ),
        })
      );

      balances = [
        ...balances,
        ...createdWithLeaveTypes,
      ] as EmployeeLeaveBalance[];
    }

    // Add leave type information
    balances = balances.map((balance: any) => ({
      ...balance,
      leave_type:
        balance.leave_type ||
        activeLeaveTypes.find(
          (lt) => lt.id === balance.leave_type_id
        ),
    }));

    // Keep cache synchronized
    cache.leaveBalances = [
      ...cache.leaveBalances.filter(
        (b) =>
          !(
            b.employee_id === employeeUuid &&
            b.year === year
          )
      ),
      ...balances,
    ];

    return balances;
  }

  static async getLeaveRequests(employeeId?: string): Promise<LeaveRequest[]> {
    const cache = getCache();
    let requests = [...cache.leaveRequests];

    let employeeUuid: string | undefined;

    if (employeeId) {
      const employee = await this.getEmployeeById(employeeId);

      if (!employee) {
        return [];
      }

      employeeUuid = employee.id;

      requests = requests.filter(
        (request) => request.employee_id === employeeUuid
      );
    }

    try {
      const supabase = await createAdminClient();

      let query = supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (employeeUuid) {
        query = query.eq("employee_id", employeeUuid);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        return data as LeaveRequest[];
      }
    } catch (error) {
      console.warn("getLeaveRequests DB fallback:", error);
    }

    return requests;
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
    const supabase = await createAdminClient();

    const employee = await this.getEmployeeById(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    const employeeUuid = employee.id;

    const { data: leaveType, error: leaveTypeError } = await supabase
    .from("leave_types")
    .select("*")
    .eq("id", leaveTypeId)
    .maybeSingle();

    if (leaveTypeError) {
      throw new Error(leaveTypeError.message);
    }
    if (!leaveType ||  !leaveType.is_active ||  (leaveType.code !== "CL" && leaveType.code !== "SL")) {
      throw new Error("Only CL and SL leave types are allowed");
    }

    const newRequest: LeaveRequest = {
      id: "lr-" + Date.now(),
      employee_id: employeeUuid,
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

    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        employee_id: employeeUuid,
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        is_half_day: isHalfDay,
        reason,
        status: "pending",
      })
      .select("*, employee:employees(*), leave_type:leave_types(*)")
      .single();
    if (error) throw error;
    if (!data) throw new Error("Leave request was not returned after insert");
    const createdRequest = data as LeaveRequest;

    cache.leaveRequests.unshift(createdRequest);
    return data as LeaveRequest;
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

    const supabase = await createAdminClient();

    const { data: dbReq, error: requestError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError) {
      throw new Error(requestError.message);
    }

    if (!dbReq) {
      return false;
    }

    if (dbReq.status !== "pending") {
      throw new Error(`Leave request has already been ${dbReq.status}`)
    }

    const reviewedAt = new Date().toISOString();

    // Keep cache in sync
    const req = dbReq as LeaveRequest;

    req.status = status;
    req.reviewed_by = reviewerId;
    req.reviewed_at = reviewedAt;
    req.rejection_reason = rejectionReason || null;

    const cachedRequest = cache.leaveRequests.find(
      (r) => r.id === requestId
    );

    if (cachedRequest) {
      cachedRequest.status = status;
      cachedRequest.reviewed_by = reviewerId;
      cachedRequest.reviewed_at = reviewedAt;
      cachedRequest.rejection_reason = rejectionReason || null;
    }

    // If approved and not LOP, deduct from balance
    if (status === "approved") {
      const year = new Date(req.start_date).getFullYear();

      const { data: dbBalance, error: balanceError } = await supabase
        .from("employee_leave_balances")
        .select("*")
        .eq("employee_id", req.employee_id)
        .eq("leave_type_id", req.leave_type_id)
        .eq("year", year)
        .maybeSingle();

      if (balanceError) {
        throw new Error(balanceError.message);
      }

        if (!dbBalance) {
          throw new Error("Leave balance not found for this employee and leave type");
        }

        const availableDays = dbBalance.balance_days;
        if (availableDays < req.total_days) {
          throw new Error(`Insufficient leave balance. Available: ${availableDays}, Requested: ${req.total_days}`);
        }


        const usedDays = dbBalance.used_days + req.total_days;
        const balanceDays = dbBalance.allocated_days - usedDays;
        const { error: balanceUpdateError } = await supabase
          .from("employee_leave_balances")
          .update({
            used_days: usedDays,
            balance_days: balanceDays,
          })
          .eq("employee_id", req.employee_id)
          .eq("leave_type_id", req.leave_type_id)
          .eq("year", year);

        if (balanceUpdateError) {
          throw new Error(balanceUpdateError.message);
        }

        // Keep cache synchronized
        const cacheBalance = cache.leaveBalances.find(
          (b) =>
            b.employee_id === req.employee_id &&
            b.leave_type_id === req.leave_type_id &&
            b.year === year
        );

        if (cacheBalance) {
          cacheBalance.used_days = usedDays;
          cacheBalance.balance_days = balanceDays;
        }
    }

    const { error: updateError } = await supabase
      .from("leave_requests")
      .update({
        status,
        reviewed_by: reviewerId,
        reviewed_at: reviewedAt,
        rejection_reason: rejectionReason || null,
      })
      .eq("id", requestId);

    if (updateError) {
      throw new Error(updateError.message);
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
      const employee = await this.getEmployeeById(employeeId);
       if (!employee) {
        return [];
      }

      const employeeUuid = employee.id;

      slips = slips.filter((p) => p.employee_id === employeeUuid);
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

    // First try Supabase
    try {
      const supabase = await createAdminClient();

      const { data, error } = await supabase
        .from("payslips")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const employee = await this.getEmployeeById(data.employee_id);

        const payslip: Payslip = {
          ...(data as Payslip),
          employee: employee || undefined,
        };

        // Keep cache synchronized
        const existingIndex = cache.payslips.findIndex(
          (p) => p.id === id
        );

        if (existingIndex >= 0) {
          cache.payslips[existingIndex] = payslip;
        } else {
          cache.payslips.unshift(payslip);
        }

        return payslip;
      }
    } catch (error) {
      console.warn("getPayslipById database warning:", error);
    }

    // Fallback to cache
    const slip = cache.payslips.find((p) => p.id === id);

    if (!slip) {
      return null;
    }

    const employee = await this.getEmployeeById(slip.employee_id);

    return {
      ...slip,
      employee: employee || undefined,
    };
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
    const supabase = await createAdminClient();

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

      const baseSalary = emp.salary || 50000;

      // Calculate LOP days from approved leave requests
      const empLeaves = cache.leaveRequests.filter((lr) => {
        if (lr.employee_id !== emp.id || lr.status !== "approved") {
          return false;
        }

        const start = new Date(lr.start_date);

        return (
          start.getFullYear() === year &&
          start.getMonth() + 1 === month
        );
      });

      let lopDays = 0;

      for (const req of empLeaves) {
        const type = cache.leaveTypes.find(
          (lt) => lt.id === req.leave_type_id
        );

        if (type && !type.is_paid) {
          lopDays += req.total_days;
        }
      }

      // Also factor half-days from attendance
      const prefix = `${year}-${String(month).padStart(2, "0")}`;

      const attLogs = cache.attendanceLogs.filter(
        (a) =>
          a.employee_id === emp.id &&
          a.attendance_date.startsWith(prefix)
      );

      const halfDays = attLogs.filter(
        (a) => a.status === "half_day"
      ).length;

      lopDays += halfDays * 0.5;

      const workingDays = Math.min(totalDaysInMonth, 26);
      const presentDays = Math.max(0, workingDays - lopDays);

      const breakdown = calculateSalaryBreakdown({
        grossSalary: baseSalary,
        totalDaysInMonth,
        lopDays,
        activeComponents,
      });

      const paidLeaves = empLeaves
        .filter((l) => l.leave_type?.is_paid)
        .reduce((acc, c) => acc + c.total_days, 0);

      /*
      * Persist payslip in Supabase.
      *
      * employee_id = employees.id (UUID)
      * Do NOT use emp.employee_id (TN5000 etc.)
      */
      const payslipData = {
        employee_id: emp.id,
        payroll_month: month,
        payroll_year: year,
        month_name: monthName,
        working_days: workingDays,
        present_days: presentDays,
        paid_leaves: paidLeaves,
        lop_days: lopDays,
        gross_salary: breakdown.grossSalary,
        lop_deduction: breakdown.lopDeduction,
        total_earnings: breakdown.totalEarnings,
        total_deductions: breakdown.totalDeductions,
        net_salary: breakdown.netSalary,
        earnings_breakup: breakdown.earningsBreakdown,
        deductions_breakup: breakdown.deductionsBreakdown,
        payment_status: "processed",
      };

      /*
      * Because the database has:
      * UNIQUE(employee_id, payroll_month, payroll_year)
      *
      * upsert will replace the existing payroll for the same
      * employee/month/year instead of creating duplicates.
      */
      const { data: savedPayslip, error: payslipError } = await supabase
        .from("payslips")
        .upsert(payslipData, {
          onConflict: "employee_id,payroll_month,payroll_year",
        })
        .select()
        .single();

      if (payslipError) {
        throw new Error(
          `Failed to generate payslip for ${emp.employee_id}: ${payslipError.message}`
        );
      }

      const payslip = {
        ...(savedPayslip as Payslip),
        employee: emp,
      };

      // Keep cache synchronized
      const existingIdx = cache.payslips.findIndex(
        (p) =>
          p.employee_id === emp.id &&
          p.payroll_month === month &&
          p.payroll_year === year
      );

      if (existingIdx >= 0) {
        cache.payslips[existingIdx] = payslip;
      } else {
        cache.payslips.unshift(payslip);
      }

      generatedSlips.push(payslip);
    }

    return {
      generatedCount: generatedSlips.length,
      payslips: generatedSlips,
    };
  }
}
