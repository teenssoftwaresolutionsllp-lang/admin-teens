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
  EmployeeSalaryComponent,
  Payslip,
} from "./types";
import { calculateSalaryBreakdown, evaluateAttendancePunch } from "./calculations";

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
      projects: [],
      holidayCalendars: [],
      attendanceLogs,
      regularizations: [],
      leaveTypes: [],
      leaveBalances,
      leaveRequests,
      salaryComponents: [],
      payslips,
    };
  }
  return global.__hrmsCache;
}

// ==========================================
// PAYROLL WORKING DAYS
// Sunday = Holiday
// Saturday = Holiday by default
// Selected Saturdays can be made working days
// ==========================================

function getWorkingDatesInMonth(
  year: number,
  month: number,
  workingSaturdays: number[] = []
): string[] {
  const workingDates: string[] = [];

  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    // Sunday = holiday
    if (dayOfWeek === 0) {
      continue;
    }

    // Saturday = holiday unless HR has enabled it
    if (dayOfWeek === 6) {
      if (!workingSaturdays.includes(day)) {
        continue;
      }
    }

    const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    workingDates.push(dateString);
  }

  return workingDates;
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
  static async getEmployees(includeProject = true): Promise<Employee[]> {
    const cache = getCache();

    // Try DB first
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from("employees")
        .select(`*, department:departments(id, name)`)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        let projects: Project[] = [];

        if (includeProject) {
         projects = await this.getProjects();
        }
        const result = data.map((emp) => ({
          ...emp,
          project: includeProject ? projects.find((p) => p.id === emp.project_id) || projects[0] : undefined,
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
        const projects = await this.getProjects();

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

 //fast way to get monthly payroll total without fetching all payslips
  static async getMonthlyPayrollTotal(
    month: number,
    year: number
  ): Promise<number> {
    try {
      const supabase = await createAdminClient();

      const { data, error } = await supabase
        .from("payslips")
        .select("net_salary")
        .eq("payroll_month", month)
        .eq("payroll_year", year);

      if (error) {
        console.error("getMonthlyPayrollTotal error:", error);
        return 0;
      }

      return (data || []).reduce(
        (total, row) => total + Number(row.net_salary || 0),
        0
      );
    } catch (error) {
      console.error("getMonthlyPayrollTotal error:", error);
      return 0;
    }
  }

  static async getEmployeeByEmail(email: string): Promise<Employee | null> {
    const cache = getCache();

    // Check in-memory cache first
    const cached = cache.employees.find((e) => e.email?.toLowerCase() === email?.toLowerCase());
    if (cached) {
      const projects = await this.getProjects();
      return {
        ...cached,
        project: cached.project || cache.projects.find((project) => project.id === cached.project_id) || projects[0],
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

      // =========================
      // PERSONAL INFORMATION
      // =========================
      user_id: empData.user_id || null,
      first_name: empData.first_name || "New",
      last_name: empData.last_name || "Employee",
      email: empData.email || "",
      phone: empData.phone || null,
      date_of_birth: empData.date_of_birth || null,
      gender: empData.gender || null,
      blood_group: empData.blood_group || null,
      marital_status: empData.marital_status || null,

      // =========================
      // ADDRESS INFORMATION
      // =========================
      permanent_address: empData.permanent_address || null,
      permanent_city: empData.permanent_city || null,
      permanent_state: empData.permanent_state || null,
      permanent_pincode: empData.permanent_pincode || null,

      temporary_address: empData.temporary_address || null,
      temporary_city: empData.temporary_city || null,
      temporary_state: empData.temporary_state || null,
      temporary_pincode: empData.temporary_pincode || null,

      // =========================
      // EMERGENCY CONTACT
      // =========================
      // Emergency Contact 1
      emergency_contact_name: empData.emergency_contact_name || null,
      emergency_contact_phone: empData.emergency_contact_phone || null,
      emergency_contact_relation: empData.emergency_contact_relation || null,

      // Emergency Contact 2
      emergency_contact_name_2: empData.emergency_contact_name_2 || null,
      emergency_contact_phone_2: empData.emergency_contact_phone_2 || null,
      emergency_contact_relation_2: empData.emergency_contact_relation_2 || null,

      // Emergency Contact 3
      emergency_contact_name_3: empData.emergency_contact_name_3 || null,
      emergency_contact_phone_3: empData.emergency_contact_phone_3 || null,
      emergency_contact_relation_3: empData.emergency_contact_relation_3 || null,

      // =========================
      // EMPLOYMENT INFORMATION
      // =========================
      department_id: empData.department_id || null,
      designation: empData.designation || null,
      employment_type: empData.employment_type || "full-time",
      joining_date: empData.joining_date || new Date().toISOString().split("T")[0],
      probation_end_date: empData.probation_end_date || null,
      appointment_date: empData.appointment_date || null,
      confirmation_date: empData.confirmation_date || null,
      reporting_manager: empData.reporting_manager || null,
      work_location: empData.work_location || null,

      client_type: empData.client_type || null,
      company_name: empData.company_name || null,

      status: empData.status || "active",
      salary: empData.salary ?? 0,

      // =========================
      // STATUTORY INFORMATION
      // =========================
      esi_healthcare_eligible: empData.esi_healthcare_eligible?? false,
      esi_number: empData.esi_number || null,

      pf_eligible: empData.pf_eligible ?? false,
      uan_number: empData.uan_number || null,

      pt_eligible: empData.pt_eligible ?? false,
      pt_number: empData.pt_number || null,

      tds_eligible: empData.tds_eligible ?? false,

      // =========================
      // BANK & IDENTITY
      // =========================
      bank_name: empData.bank_name || null,
      bank_account_number: empData.bank_account_number || null,
      ifsc_code: empData.ifsc_code || null,
      pan_number: empData.pan_number || null,
      aadhar_number: empData.aadhar_number || null,
      passport_number: empData.passport_number || null,

      // =========================
      // ACCESSORIES
      // =========================
      accessory_type: empData.accessory_type || null,
      accessory_serial: empData.accessory_serial || null,
      peripherals: empData.peripherals || [],

      // =========================
      // PROJECT
      // =========================
      project_id: empData.project_id || null,

      // =========================
      // TIMESTAMPS
      // =========================
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

  static async updateEmployee(
    id: string,
    updates: Partial<Employee>
  ): Promise<Employee | null> {
    try {
      const supabase = await createAdminClient();

      const UUID_REGEX =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      let result;

      if (UUID_REGEX.test(id)) {
        result = await supabase
          .from("employees")
          .update(updateData)
          .eq("id", id)
          .select(`*, department:departments(id, name)`)
          .single();
      } else {
        result = await supabase
          .from("employees")
          .update(updateData)
          .eq("employee_id", id)
          .select(`*, department:departments(id, name)`)
          .single();
      }

      const { data, error } = result;

      if (error) {
        console.error("updateEmployee DB error:", error);
        throw error;
      }

      if (!data) {
        console.error("Employee update returned no data");
        return null;
      }

      this.seedEmployeeToCache(data as Employee);

      return data as Employee;
    } catch (error: any) {
      console.error("updateEmployee failed:", error);
      console.error("Message:", error?.message);
      console.error("Details:", error?.details);
      console.error("Hint:", error?.hint);
      console.error("Code:", error?.code);

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

    const temporaryLoginExpiresAt = exitType === "resigned" || exitType === "laid_off" ? new Date(
        Date.now() + 45 * 24 * 60 * 60 * 1000
      ).toISOString() : null;
    const updates = {
      status: exitType,
      exit_reason: exitReason.trim(),
      exit_document_url: exitDocumentUrl || null,
      exit_document_name: exitDocumentName || null,
      exit_date: finalexitDate,
      temporary_login_expires_at: temporaryLoginExpiresAt,
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
          temporary_login_expires_at: temporaryLoginExpiresAt,
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
      if (data && data.length > 0) {
        cache.projects = data as Project[];
        return cache.projects;
      };

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
      cache.projects = (createdProjects || []) as Project[];
      return cache.projects;
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
// PAYROLL WORKING SATURDAYS
// Uses existing public.holidays table
//
// A Saturday with title:
// "Working Saturday"
// ==========================================
// =========================================================
// GET WORKING SATURDAYS
// =========================================================

  static async getWorkingSaturdays(
    year: number,
    month: number,
    calendarId?: string | null
  ): Promise<number[]> {
    const supabase = await createAdminClient();

    const startDate =
      `${year}-${String(month).padStart(2, "0")}-01`;

    const endDate =
      `${year}-${String(month).padStart(2, "0")}-${String(
        new Date(year, month, 0).getDate()
      ).padStart(2, "0")}`;

    let query = supabase
      .from("holidays")
      .select(`
        holiday_date,
        title,
        is_working_day,
        calendar_id
      `)
      .gte("holiday_date", startDate)
      .lte("holiday_date", endDate)
      .eq("is_working_day", true);

    // ---------------------------------------------------------
    // USE EMPLOYEE PROJECT CALENDAR
    // ---------------------------------------------------------

    if (calendarId) {
      query = query.eq(
        "calendar_id",
        calendarId
      );
    } else {
      // No project calendar:
      // only use company-wide holidays / overrides
      query = query.is(
        "calendar_id",
        null
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      throw new Error(
        `Failed to load working Saturdays: ${error.message}`
      );
    }

    return (data || [])
      .map((row: any) => {
        const date =
          String(
            row.holiday_date
          ).slice(0, 10);

        return {
          day: Number(
            date.slice(8, 10)
          ),
          date,
        };
      })
      .filter((item) => {
        if (
          !Number.isInteger(
            item.day
          )
        ) {
          return false;
        }

        const date = new Date(
          `${item.date}T00:00:00`
        );

        // Only Saturdays
        return date.getDay() === 6;
      })
      .map(
        (item) => item.day
      )
      .sort(
        (a, b) => a - b
      );
  }


  // =========================================================
  // SET WORKING SATURDAY
  // =========================================================

  static async setWorkingSaturday(
    date: string,
    enabled: boolean,
    calendarId?: string | null
  ): Promise<void> {
    const supabase =
      await createAdminClient();

    const selectedDate =
      new Date(
        `${date}T00:00:00`
      );

    // ---------------------------------------------------------
    // VALIDATE DATE
    // ---------------------------------------------------------

    if (
      Number.isNaN(
        selectedDate.getTime()
      )
    ) {
      throw new Error(
        "Invalid date"
      );
    }

    // ---------------------------------------------------------
    // ONLY SATURDAY CAN BE CHANGED
    // ---------------------------------------------------------

    if (
      selectedDate.getDay() !== 6
    ) {
      throw new Error(
        "Only Saturdays can be marked as working days"
      );
    }

    // =========================================================
    // REMOVE EXISTING WORKING SATURDAY OVERRIDE
    // =========================================================

    let deleteQuery = supabase
      .from("holidays")
      .delete()
      .eq(
        "holiday_date",
        date
      )
      .ilike(
        "title",
        "Working Saturday"
      );

    if (calendarId) {
      deleteQuery =
        deleteQuery.eq(
          "calendar_id",
          calendarId
        );
    } else {
      deleteQuery =
        deleteQuery.is(
          "calendar_id",
          null
        );
    }

    const {
      error: deleteError,
    } = await deleteQuery;

    if (deleteError) {
      throw new Error(
        `Failed to update working Saturday: ${deleteError.message}`
      );
    }

    // =========================================================
    // ENABLE WORKING SATURDAY
    // =========================================================

    if (enabled) {
      const {
        error: insertError,
      } = await supabase
        .from("holidays")
        .insert({
          calendar_id:
            calendarId || null,

          holiday_date:
            date,

          title:
            "Working Saturday",

          // Optional because this is an override
          is_optional:
            true,

          // IMPORTANT:
          // Payroll treats this Saturday as working
          is_working_day:
            true,
        });

      if (insertError) {
        throw new Error(
          `Failed to mark Saturday as working: ${insertError.message}`
        );
      }
    }
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


  static async updateLeaveType(
    id: string,
    updates: Partial<LeaveType>
  ): Promise<LeaveType | null> {
    const cache = getCache();
    const supabase = await createAdminClient();

    // Update the leave type.
    const { data: updatedLeaveType, error } = await supabase
      .from("leave_types")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("updateLeaveType error:", error);
      throw new Error(error.message);
    }

    if (!updatedLeaveType) {
      return null;
    }

    // Update local leave-type cache.
    const idx = cache.leaveTypes.findIndex((lt) => lt.id === id);

    if (idx >= 0) {
      cache.leaveTypes[idx] = updatedLeaveType as LeaveType;
    } else {
      cache.leaveTypes.push(updatedLeaveType as LeaveType);
    }

    // Update employee balances only when the annual quota changes.
    if (updates.annual_quota !== undefined) {
      const year = new Date().getFullYear();
      const newQuota = Number(updates.annual_quota);

      const { data: balances, error: balanceFetchError } = await supabase
        .from("employee_leave_balances")
        .select("id, employee_id, leave_type_id, year, allocated_days, used_days")
        .eq("leave_type_id", id)
        .eq("year", year);

      if (balanceFetchError) {
        console.error(
          "Failed to fetch employee leave balances:",
          balanceFetchError
        );
        throw new Error(balanceFetchError.message);
      }

      // Update balances concurrently instead of sequentially.
      const balanceUpdates = await Promise.all(
        (balances || []).map(async (balance) => {
          const usedDays = Number(balance.used_days || 0);
          const newBalanceDays = Math.max(newQuota - usedDays, 0);

          const { error } = await supabase
            .from("employee_leave_balances")
            .update({
              allocated_days: newQuota,
              balance_days: newBalanceDays,
            })
            .eq("id", balance.id);

          if (error) {
            throw new Error(
              `Failed to update leave balance ${balance.id}: ${error.message}`
            );
          }

          return {
            ...balance,
            allocated_days: newQuota,
            balance_days: newBalanceDays,
          };
        })
      );

      // Refresh cached balances.
      const updatedById = new Map(
        balanceUpdates.map((balance) => [balance.id, balance])
      );

      cache.leaveBalances = cache.leaveBalances.map((balance) => {
        if (
          balance.leave_type_id === id &&
          balance.year === year
        ) {
          const updated = updatedById.get(balance.id);

          if (updated) {
            return {
              ...balance,
              allocated_days: updated.allocated_days,
              balance_days: updated.balance_days,
            };
          }

          // Keep cached balances consistent even if this row wasn't
          // returned by the database fetch.
          const usedDays = Number(balance.used_days || 0);

          return {
            ...balance,
            allocated_days: newQuota,
            balance_days: Math.max(newQuota - usedDays, 0),
          };
        }

        return balance;
      });
    }

    return updatedLeaveType as LeaveType;
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
        .select(`*, 
          employee:employees (
            id,
            employee_id,
            first_name,
            last_name,
            profile_photo_url
        )`)
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
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("salary_components")
      .select(`id, name, code, type, calculation_type, value, affects_lop, is_active, is_statutory, description`)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to load salary components: ${error.message}`);
    }

    return (data || []) as SalaryComponent[];
  }

  static async getEmployeeSalaryComponents(employeeId: string): Promise<EmployeeSalaryComponent[]> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("employee_salary_components")
      .select(`
        id,
        employee_id,
        salary_component_id,
        calculation_type,
        value,
        is_active,
        affects_lop,
        gratuity_5_year_taken,
        gratuity_5_year_taken_date,
        gratuity_5_year_amount,
        gratuity_10_year_taken,
        gratuity_10_year_taken_date,
        gratuity_10_year_amount,
        created_at,
        updated_at
      `)
      .eq("employee_id", employeeId)
      .eq("is_active", true);

    if (error) {
      throw new Error(
        `Failed to load employee salary components: ${error.message}`
      );
    }

    return (data || []) as EmployeeSalaryComponent[];
  }

  static async updateGratuityStatus(employeeId: string,type: "5_year" | "10_year",amount: number): Promise<EmployeeSalaryComponent> 
  {
    const supabase = await createAdminClient();

    const { data: components, error: componentError } =
      await supabase
        .from("employee_salary_components")
        .select(`
          id,
          employee_id,
          salary_component_id,
          calculation_type,
          value,
          is_active,
          gratuity_5_year_taken,
          gratuity_5_year_taken_date,
          gratuity_5_year_amount,
          gratuity_10_year_taken,
          gratuity_10_year_taken_date,
          gratuity_10_year_amount,
          created_at,
          updated_at,
          salary_components!inner (
            code
          )
        `)
        .eq("employee_id", employeeId)
        .eq("salary_components.code", "BASIC")
        .eq("is_active", true)
        .limit(1);

    if (componentError) {
      throw new Error(
        `Failed to find BASIC component: ${componentError.message}`
      );
    }

    const basicComponent = components?.[0];

    if (!basicComponent) {
      throw new Error("Basic salary component not found");
    }

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const updateData =
      type === "5_year"
        ? {
            gratuity_5_year_taken: true,
            gratuity_5_year_taken_date: today,
            gratuity_5_year_amount: amount,
          }
        : {
            gratuity_10_year_taken: true,
            gratuity_10_year_taken_date: today,
            gratuity_10_year_amount: amount,
          };

    const { data, error } = await supabase
      .from("employee_salary_components")
      .update(updateData)
      .eq("id", basicComponent.id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to update gratuity status: ${error.message}`
      );
    }

    return data as EmployeeSalaryComponent;
  }

  static async updateSalaryComponent(
    id: string,
    updates: Partial<SalaryComponent>
  ): Promise<SalaryComponent | null> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("salary_components")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update salary component: ${error.message}`);
    }

    const updated = data as SalaryComponent;
    const cache = getCache();
    const index = cache.salaryComponents.findIndex(component => component.id === id);

    if (index >= 0) {
      cache.salaryComponents[index] = updated;
    }

    return updated;
  }

  static async toggleSalaryComponent(
    id: string
  ): Promise<SalaryComponent | null> {
    const supabase = await createAdminClient();

    const { data: current, error: fetchError } = await supabase
      .from("salary_components")
      .select("is_active")
      .eq("id", id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to load salary component: ${fetchError.message}`);
    }

    const { data, error } = await supabase
      .from("salary_components")
      .update({
        is_active: !current.is_active
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to toggle salary component: ${error.message}`);
    }

    return data as SalaryComponent;
  }

  static async getPayslips(employeeId?: string,month?: number,year?: number): Promise<Payslip[]> {
    const cache = getCache();

    try {
      const supabase = await createAdminClient();

      let query = supabase
        .from("payslips")
        .select("*")
        .order("payroll_year", { ascending: false })
        .order("payroll_month", { ascending: false });

      if (employeeId) {
        const employee = await this.getEmployeeById(employeeId);

        if (!employee) {
          return [];
        }

        query = query.eq("employee_id", employee.id);
      }

      if (month) {
        query = query.eq("payroll_month", month);
      }

      if (year) {
        query = query.eq("payroll_year", year);
      }

      const { data, error } = await query;

      if (error) {
        console.error("getPayslips database error:", error);
        throw error;
      }


    const rows = data || [];

    // Fetch employee records once instead of looking up each
    // payslip's employee individually.
    const employees = await this.getEmployees();

    const employeesById = new Map(
      employees.map((employee) => [employee.id, employee])
    );

    const slips: Payslip[] = rows.map((row) => ({
      ...(row as Payslip),
      employee: employeesById.get(row.employee_id) || undefined,
    }));


      cache.payslips = slips;

      return slips;
    } catch (error) {
      console.warn(
        "getPayslips database warning, using cache:",
        error
      );

      let slips = [...cache.payslips];

      if (employeeId) {
        const employee = await this.getEmployeeById(employeeId);

        if (!employee) {
          return [];
        }

        slips = slips.filter(
          (p) => p.employee_id === employee.id
        );
      }

      if (month) {
        slips = slips.filter(
          (p) => p.payroll_month === month
        );
      }

      if (year) {
        slips = slips.filter(
          (p) => p.payroll_year === year
        );
      }

      return slips.sort(
        (a, b) =>
          b.payroll_year - a.payroll_year ||
          b.payroll_month - a.payroll_month
      );
    }
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
  employeeId,
  additionalEarnings = [],
}: {
  month: number;
  year: number;
  employeeId: string;
  additionalEarnings: { type: "Incentive" | "Bonus" | "Compensation"; amount: number }[];
}): Promise<{ generatedCount: number; payslips: Payslip[] }> {
  const cache = getCache();
  const supabase = await createAdminClient();

  // =========================================================
  // GET EMPLOYEE
  // =========================================================

  const selectedEmployee = await this.getEmployeeById(employeeId);

  if (!selectedEmployee) {
    throw new Error("Employee not found");
  }

  if (selectedEmployee.status !== "active") {
    throw new Error("Selected employee is not active");
  }

  const employees: Employee[] = [selectedEmployee];

  const employeeSalaryComponents =  await this.getEmployeeSalaryComponents(selectedEmployee.id);

  const salaryComponents = await this.getSalaryComponents();

  const activeComponents: SalaryComponent[] = employeeSalaryComponents.map((employeeComponent) => {
      const masterComponent = salaryComponents.find(
        (component) => component.id === employeeComponent.salary_component_id
      );
      if (!masterComponent) {
        return null;
      }

      return {
        ...masterComponent,
        calculation_type: employeeComponent.calculation_type as SalaryComponent["calculation_type"],
        value: Number(employeeComponent.value),
        is_active: employeeComponent.is_active === true && employeeComponent.is_active === true,
        // Employee-specific LOP configuration
        affects_lop: employeeComponent.affects_lop ?? masterComponent.affects_lop,
      };
  })
  .filter(
(component): component is SalaryComponent => component !== null);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthName = monthNames[month - 1];

  const totalDaysInMonth =
    new Date(year, month, 0).getDate();

  // =========================================================
  // PAYROLL MONTH DATES
  // =========================================================

  const monthStart =
    `${year}-${String(month).padStart(2, "0")}-01`;

  const monthEnd =
    `${year}-${String(month).padStart(2, "0")}-${String(
      totalDaysInMonth
    ).padStart(2, "0")}`;

  // =========================================================
  // GET EMPLOYEE PROJECT HOLIDAY CALENDAR
  // =========================================================

  let calendarId: string | null = null;

  if (selectedEmployee.project_id) {
    const {
      data: project,
      error: projectError,
    } = await supabase
      .from("projects")
      .select("calendar_id")
      .eq("id", selectedEmployee.project_id)
      .maybeSingle();

    if (projectError) {
      throw new Error(
        `Failed to load employee project calendar: ${projectError.message}`
      );
    }

    calendarId =
      project?.calendar_id || null;
  }

  // =========================================================
  // GET WORKING SATURDAYS
  //
  // Saturday is normally a holiday.
  // HR can mark specific Saturdays as working.
  // =========================================================

  const workingSaturdays =
    await this.getWorkingSaturdays(
      year,
      month,
      calendarId
    );

  // =========================================================
  // GET HOLIDAYS FOR EMPLOYEE'S CALENDAR
  // =========================================================

  let holidayQuery = supabase
    .from("holidays")
    .select(`
      holiday_date,
      title,
      is_optional,
      is_working_day,
      calendar_id
    `)
    .gte("holiday_date", monthStart)
    .lte("holiday_date", monthEnd);

  if (calendarId) {
    holidayQuery = holidayQuery.eq(
      "calendar_id",
      calendarId
    );
  }
  else {
    holidayQuery = holidayQuery.is(
      "calendar_id",
      null
    );
  }

  const {
    data: holidayRows,
    error: holidayError,
  } = await holidayQuery;

  if (holidayError) {
    throw new Error(
      `Failed to load holidays: ${holidayError.message}`
    );
  }

  // =========================================================
  // CREATE HOLIDAY MAP
  // =========================================================

  const holidayMap = new Map<string, any[]>();

  for (const holiday of holidayRows || []) {
    const holidayDate = String(
      holiday.holiday_date
    ).slice(0, 10);

    const existing =
      holidayMap.get(holidayDate) || [];

    existing.push(holiday);

    holidayMap.set(
      holidayDate,
      existing
    );
  }

  // =========================================================
  // GENERATE WORKING DATES
  //
  // Monday-Friday = working
  // Saturday = holiday by default
  // Working Saturday = working
  // Sunday = holiday
  // Normal holiday = holiday
  // Optional holiday = working by default
  // =========================================================

  const workingDates: string[] = [];

  for (
    let day = 1;
    day <= totalDaysInMonth;
    day++
  ) {
    const date =
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const currentDate = new Date(
      `${date}T00:00:00`
    );

    const dayOfWeek =
      currentDate.getDay();

    // -------------------------------------------------------
    // Sunday = holiday
    // -------------------------------------------------------

    if (dayOfWeek === 0) {
      continue;
    }

    const holidaysForDate =
      holidayMap.get(date) || [];

    // -------------------------------------------------------
    // Working Saturday override
    // -------------------------------------------------------

    if (
      dayOfWeek === 6 &&
      workingSaturdays.includes(day)
    ) {
      workingDates.push(date);
      continue;
    }

    // -------------------------------------------------------
    // Saturday = holiday by default
    // -------------------------------------------------------

    if (dayOfWeek === 6) {
      continue;
    }

    // -------------------------------------------------------
    // Normal company holiday
    //
    // Optional holidays remain working days unless
    // employee leave is approved separately.
    // -------------------------------------------------------

    const isHoliday =
      holidaysForDate.some(
        (holiday) =>
          holiday.is_working_day !== true &&
          holiday.is_optional !== true
      );

    if (isHoliday) {
      continue;
    }

    workingDates.push(date);
  }

  // =========================================================
  // GENERATED PAYSLIPS
  // =========================================================

  const generatedSlips: Payslip[] = [];

  // =========================================================
  // PROCESS EMPLOYEE
  // =========================================================

  for (const emp of employees) {
    if (emp.status !== "active") {
      continue;
    }

    // =======================================================
    // SALARY
    // =======================================================

    const annualCtcLakh =
      Number(emp.salary ?? 0);

    const annualCtc =
      annualCtcLakh * 100000;

    const baseSalary = Number(
      (annualCtc / 12).toFixed(2)
    );

    // =======================================================
    // EMPLOYEE JOINING DATE
    //
    // Do not count working days before employee joined.
    // =======================================================

    const joiningDate = emp.joining_date
      ? String(emp.joining_date).slice(0, 10)
      : null;

    const effectiveWorkingDates =
      joiningDate
        ? workingDates.filter(
            (date) => date >= joiningDate
          )
        : workingDates;

    const workingDays =
      effectiveWorkingDates.length;

    // =======================================================
    // ATTENDANCE
    //
    // Read directly from Supabase.
    // Do not depend on cache.attendanceLogs.
    // =======================================================

    const {
      data: attendanceRows,
      error: attendanceError,
    } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", emp.id)
      .gte("attendance_date", monthStart)
      .lte("attendance_date", monthEnd);

    if (attendanceError) {
      throw new Error(
        `Failed to load attendance for ${emp.employee_id}: ${attendanceError.message}`
      );
    }

    // =======================================================
    // MAP ATTENDANCE BY DATE
    // =======================================================

    const attendanceMap =
      new Map<string, AttendanceLog>();

    for (
      const attendance of attendanceRows || []
    ) {
      const attendanceDate =
        String(
          attendance.attendance_date
        ).slice(0, 10);

      attendanceMap.set(
        attendanceDate,
        attendance as AttendanceLog
      );
    }

    // =======================================================
    // APPROVED LEAVES
    //
    // Only load leaves that overlap this payroll month.
    // =======================================================

    const {
      data: empLeaves,
      error: leaveError,
    } = await supabase
      .from("leave_requests")
      .select(`
        *,
        leave_type:leave_types(*)
      `)
      .eq("employee_id", emp.id)
      .eq("status", "approved")
      .lte("start_date", monthEnd)
      .gte("end_date", monthStart);

    if (leaveError) {
      throw new Error(
        `Failed to load leave requests for ${emp.employee_id}: ${leaveError.message}`
      );
    }

    // =======================================================
    // CALCULATE:
    //
    // presentDays = actual attendance
    // paidLeaves  = approved paid leave
    // lopDays     = unpaid leave + absence + half-day loss
    // =======================================================

    let presentDays = 0;
    let paidLeaves = 0;
    let lopDays = 0;

    for (
      const workingDate of effectiveWorkingDates
    ) {
      // -----------------------------------------------------
      // FIND APPROVED LEAVE COVERING THIS DATE
      // -----------------------------------------------------

      const leave =
        (empLeaves || []).find(
          (request: any) => {
            const startDate =
              String(
                request.start_date
              ).slice(0, 10);

            const endDate =
              String(
                request.end_date ||
                  request.start_date
              ).slice(0, 10);

            return (
              workingDate >= startDate &&
              workingDate <= endDate
            );
          }
        );

      // -----------------------------------------------------
      // LEAVE TAKES PRIORITY OVER ATTENDANCE
      // -----------------------------------------------------

      if (leave) {
        const leaveUnit = leave.is_half_day ? 0.5 : 1;
        const isPaid = Boolean(leave.leave_type?.is_paid);
        if (isPaid) {
          paidLeaves += leaveUnit;
        } else {
          lopDays += leaveUnit;
        }
        continue;
      }

      // -----------------------------------------------------
      // NO LEAVE → CHECK ATTENDANCE
      // -----------------------------------------------------

      const attendance =
        attendanceMap.get(
          workingDate
        );

      // No attendance = absent = LOP
      if (!attendance) {
        lopDays += 1;
        continue;
      }

      const status =
        String(
          attendance.status || ""
        ).toLowerCase();

      // -----------------------------------------------------
      // FULL DAY PRESENT
      // -----------------------------------------------------

      if (status === "present") {
        presentDays += 1;
        continue;
      }

      // -----------------------------------------------------
      // HALF DAY
      // -----------------------------------------------------

      if (status === "half_day") {
        presentDays += 0.5;
        lopDays += 0.5;
        continue;
      }

      // -----------------------------------------------------
      // ABSENT / UNKNOWN STATUS
      // -----------------------------------------------------

      lopDays += 1;
    }

    // =======================================================
    // SAFETY
    // =======================================================

    presentDays = Number(Math.max(0, presentDays).toFixed(2));
    paidLeaves = Number(Math.max(0, paidLeaves).toFixed(2));
    const accountedDays = presentDays + paidLeaves + lopDays;
    const remainingLopDays = Math.max(0,workingDays - accountedDays);
    lopDays = Number((lopDays + remainingLopDays).toFixed(2));

    
    // =======================================================
    // PREVENT ACCOUNTED DAYS FROM EXCEEDING WORKING DAYS
    // =======================================================

    const totalAccountedDays =
      presentDays +
      paidLeaves +
      lopDays;

    if (totalAccountedDays >workingDays) 
    {
      const excess = totalAccountedDays - workingDays;
      lopDays = Number(Math.max(0,lopDays - excess).toFixed(2));
    }

    // =======================================================
    // SALARY BREAKDOWN
    //
    // LOP is calculated against actual working days.
    // =======================================================

    const breakdown =
      calculateSalaryBreakdown({
        grossSalary: baseSalary,
        totalDaysInMonth:workingDays,
        lopDays,
        activeComponents,
        pfEligible: emp.pf_eligible,
        esiEligible: emp.esi_healthcare_eligible,
        ptEligible: emp.pt_eligible,
      });


    // =======================================================
    // EMPLOYER CONTRIBUTIONS
    // =======================================================

    const basicComponent = activeComponents.find((component) => component.code === "BASIC");
    const basicSalary = basicComponent ? Number(((baseSalary * basicComponent.value) /100).toFixed(2)): 0;
    const employerPfComponent = activeComponents.find((component) => component.code === "EMPLOYER_PF");
    const employerPf = employerPfComponent? Number(((basicSalary * employerPfComponent.value) /100).toFixed(2)): 0;

    // Monthly gratuity provision.
    // Statutory formula: Basic × 15 / 26 per completed year.
    // Monthly provision = Basic × 15 / (26 × 12).
    const gratuityProvision = Number(((basicSalary * 15) /(26 * 12)).toFixed(2));

    // =======================================================
    // PAYSLIP DATA
    // =======================================================

    // -------------------------------------------------------
    // GET EXISTING ADDITIONAL EARNINGS
    //
    // If this employee already has a payslip for this month,
    // preserve Incentive / Bonus / Compensation.
    // -------------------------------------------------------

    const {
      data: existingPayslip,
      error: existingPayslipError,
    } = await supabase
      .from("payslips")
      .select(`
        incentive,
        bonus,
        compensation,
        earnings_breakup
      `)
      .eq("employee_id", emp.id)
      .eq("payroll_month", month)
      .eq("payroll_year", year)
      .maybeSingle();

    if (existingPayslipError) {
      throw new Error(
        `Failed to load existing payslip for ${emp.employee_id}: ${existingPayslipError.message}`
      );
    }

    // -------------------------------------------------------
    // EXISTING AMOUNTS
    // -------------------------------------------------------

    const hasNewAdditionalEarnings = additionalEarnings.length > 0;

    const existingIncentive = hasNewAdditionalEarnings ? Number(existingPayslip?.incentive || 0) : 0;

    const existingBonus = hasNewAdditionalEarnings ? Number(existingPayslip?.bonus || 0) : 0;

    const existingCompensation = hasNewAdditionalEarnings ? Number(existingPayslip?.compensation || 0) : 0;

    // -------------------------------------------------------
    // NEW AMOUNTS
    //
    // The API already prevents adding the same type twice.
    // -------------------------------------------------------

    const newIncentive = Number(
      additionalEarnings.find(
        (earning) => earning.type === "Incentive"
      )?.amount || 0
    );

    const newBonus = Number(
      additionalEarnings.find(
        (earning) => earning.type === "Bonus"
      )?.amount || 0
    );

    const newCompensation = Number(
      additionalEarnings.find(
        (earning) => earning.type === "Compensation"
      )?.amount || 0
    );

    // -------------------------------------------------------
    // FINAL AMOUNTS
    // -------------------------------------------------------

    const incentiveAmount =
      existingIncentive + newIncentive;

    const bonusAmount =
      existingBonus + newBonus;

    const compensationAmount =
      existingCompensation + newCompensation;

    const additionalEarningsTotal =
      incentiveAmount +
      bonusAmount +
      compensationAmount;

    // -------------------------------------------------------
    // EXISTING ADDITIONAL EARNING BREAKUP
    //
    // Keep previously saved Incentive / Bonus / Compensation.
    // -------------------------------------------------------

    const existingEarningsBreakup = Array.isArray(
      existingPayslip?.earnings_breakup
    )
      ? existingPayslip.earnings_breakup
      : [];

    const existingAdditionalEarningBreakup = hasNewAdditionalEarnings ?
      existingEarningsBreakup.filter(
        (earning: any) =>
          earning?.code === "INCENTIVE" ||
          earning?.code === "BONUS" ||
          earning?.code === "COMPENSATION"
      )
    : [];

    // -------------------------------------------------------
    // NEW ADDITIONAL EARNING BREAKUP
    // -------------------------------------------------------

    const newAdditionalEarningBreakup = additionalEarnings.filter
     (
        (earning) => Number(earning.amount) > 0
     )
      .map((earning) => ({
        component_id:`additional_${earning.type.toLowerCase()}`,
        name: earning.type, 
        code: earning.type.toUpperCase(),
        type: "earning" as const,
        amount: Number(earning.amount),
        }));

    // -------------------------------------------------------
    // FINAL EARNINGS BREAKUP
    //
    // Normal salary earnings
    // + previously saved additional earnings
    // + newly added additional earnings
    // -------------------------------------------------------

    const finalEarningsBreakup = [
      ...breakdown.earningsBreakdown,
      ...existingAdditionalEarningBreakup,
      ...newAdditionalEarningBreakup,
    ];

    // -------------------------------------------------------
    // FINAL TOTALS
    // -------------------------------------------------------

    const finalTotalEarnings = Number(
      (
        breakdown.totalEarnings +
        additionalEarningsTotal
      ).toFixed(2)
    );

    const finalNetSalary = Number(
      (
        breakdown.netSalary +
        additionalEarningsTotal
      ).toFixed(2)
    );

    // -------------------------------------------------------
    // PAYSLIP DATA
    // -------------------------------------------------------

    const payslipData = {
      employee_id: emp.id,

      payroll_month: month,
      payroll_year: year,
      month_name: monthName,

      // Actual working days
      working_days: workingDays,

      // Actual attendance
      present_days: presentDays,

      // Approved paid leave
      paid_leaves: paidLeaves,

      // Unpaid leave + absence
      lop_days: lopDays,

      // Normal salary + all additional earnings
      gross_salary: Number(
        (
          breakdown.grossSalary +
          additionalEarningsTotal
        ).toFixed(2)
      ),

      lop_deduction: breakdown.lopDeduction,

      total_earnings: finalTotalEarnings,

      total_deductions: breakdown.totalDeductions,

      net_salary: finalNetSalary,

      employer_pf: employerPf,

      gratuity_provision: gratuityProvision,

      earnings_breakup: finalEarningsBreakup,

      deductions_breakup: breakdown.deductionsBreakdown,

      // Additional earnings
      incentive: incentiveAmount,

      bonus: bonusAmount,

      compensation: compensationAmount,

      payment_status: "processed",
    };


    // =======================================================
    // SAVE / UPDATE PAYSLIP
    // =======================================================

    const {
      data: savedPayslip,
      error: payslipError,
    } = await supabase
      .from("payslips")
      .upsert(
        payslipData,
        {
          onConflict:
            "employee_id,payroll_month,payroll_year",
        }
      )
      .select()
      .single();

    if (payslipError) {
      throw new Error(
        `Failed to generate payslip for ${emp.employee_id}: ${payslipError.message}`
      );
    }

    // =======================================================
    // PAYSLIP OBJECT
    // =======================================================

    const payslip: Payslip = {
      ...(savedPayslip as Payslip),
      employee: emp,
    };

    // =======================================================
    // UPDATE CACHE
    // =======================================================

    const existingIdx =
      cache.payslips.findIndex(
        (p) =>
          p.employee_id === emp.id &&
          p.payroll_month === month &&
          p.payroll_year === year
      );

    if (existingIdx >= 0) {
      cache.payslips[
        existingIdx
      ] = payslip;
    } else {
      cache.payslips.unshift(
        payslip
      );
    }

    generatedSlips.push(
      payslip
    );
  }

  // =========================================================
  // RETURN
  // =========================================================

  return {
    generatedCount:
      generatedSlips.length,

    payslips:
      generatedSlips,
  };
}
}
