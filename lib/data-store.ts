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

type EffectiveShift = {
  startTime: string;
  endTime: string;
  timezone: string;
  gracePeriodMinutes: number;
  halfDayCutoffMinutes: number;
};

function getEffectiveShift(employee: Employee): EffectiveShift {
  // An assigned project always takes priority.
  if (employee.project_id) {
    if (!employee.project) {
      throw new Error(
        "Employee has a project assignment, but the project could not be found."
      );
    }

    return {
      startTime: employee.project.shift_start_time,
      endTime: employee.project.shift_end_time,
      timezone: employee.project.timezone || "Asia/Kolkata",
      gracePeriodMinutes: employee.project.grace_period_minutes,
      halfDayCutoffMinutes: employee.project.half_day_cutoff_minutes,
    };
  }

    // Bench employees retain their previous project's shift settings.
  if (
    employee.retained_shift_start_time &&
    employee.retained_shift_end_time
  ) {
    return {
      startTime: employee.retained_shift_start_time,
      endTime: employee.retained_shift_end_time,
      timezone: "Asia/Kolkata",
      gracePeriodMinutes:
        employee.retained_grace_period_minutes ?? 30,
      halfDayCutoffMinutes:
        employee.retained_half_day_cutoff_minutes ?? 150,
    };
  }

  // Employee-level shifts apply only when there is no project.
  if (employee.shift_type === "night") {
    return {
      startTime: "18:30",
      endTime: "03:30",
      timezone: "Asia/Kolkata",
      gracePeriodMinutes: 30,
      halfDayCutoffMinutes: 150,
    };
  }

  return {
    startTime: "09:00",
    endTime: "18:00",
    timezone: "Asia/Kolkata",
    gracePeriodMinutes: 30,
    halfDayCutoffMinutes: 150,
  };
}

function getLocalDateTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function getLocalDateKey(date: Date, timezone: string): string {
  const parts = getLocalDateTimeParts(date, timezone);

  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// Converts a local date/time in an IANA timezone into a UTC Date.
function zonedDateTimeToUtc(
  dateKey: string,
  time: string,
  timezone: string
): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  let result = targetUtc;

  for (let i = 0; i < 4; i++) {
    const local = getLocalDateTimeParts(new Date(result), timezone);

    const representedUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute
    );

    const difference = targetUtc - representedUtc;

    result += difference;

    if (difference === 0) break;
  }

  return new Date(result);
}

function getShiftAttendanceDate(
  now: Date,
  shift: EffectiveShift
): string {
  const local = getLocalDateTimeParts(now, shift.timezone);
  const today = getLocalDateKey(now, shift.timezone);

  const [startHour, startMinute] = shift.startTime.split(":").map(Number);
  const [endHour, endMinute] = shift.endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const currentMinutes = local.hour * 60 + local.minute;

  const isOvernight = endMinutes <= startMinutes;

  // An overnight shift before its end belongs to the previous start date.
  if (isOvernight && currentMinutes < endMinutes) {
    return addDaysToDateKey(today, -1);
  }

  return today;
}


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
          project: includeProject ? projects.find((p) => p.id === emp.project_id)  || undefined : undefined,
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
      project: emp.project || cache.projects.find((p) => p.id === emp.project_id) || undefined,
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
          project: data.project_id
            ? (await this.getProjects()).find((p) => p.id === data.project_id)
            : undefined,
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
        project: cached.project_id
          ? cached.project ||
            cache.projects.find(
              (project) => project.id === cached.project_id
            )
          : undefined,
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
    const cached = cache.employees.find(
      (e) => e.email?.toLowerCase() === email?.toLowerCase()
    );

    if (cached) {
      const projects = await this.getProjects();

      return {
        ...cached,
        project: cached.project ||
          projects.find((project) => project.id === cached.project_id) ||
          undefined,
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
        const projects = await this.getProjects();
        const result: Employee = {
          ...data,
          project: data.project_id
            ? projects.find((project) => project.id === data.project_id)
            : undefined,
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
          project: cachedByUserId.project_id
            ? cachedByUserId.project ||
              cache.projects.find(
                (project) => project.id === cachedByUserId.project_id
              )
            : undefined,
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
            project: cachedByEmail.project_id
              ? cachedByEmail.project ||
                cache.projects.find(
                  (project) => project.id === cachedByEmail.project_id
                )
              : undefined,
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
        const projects = await this.getProjects();

        const result: Employee = {
          ...data,
          project: data.project_id
            ? projects.find((project) => project.id === data.project_id)
            : undefined,
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
      shift_type: empData.shift_type || "general",
      employment_type: empData.employment_type || "full-time",
      joining_date: empData.joining_date || new Date().toISOString().split("T")[0],
      probation_end_date: empData.probation_end_date || null,
      appointment_date: empData.appointment_date || null,
      confirmation_date: empData.confirmation_date || null,
      // Reporting Manager
      reporting_manager: empData.reporting_manager || null, // Preserve legacy field
      reporting_manager_id: null, // Assigned through the secured manager workflow
      is_reporting_manager: false, // HR/CEO must explicitly designate managers
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

      project: empData.project_id
        ? cache.projects.find((p) => p.id === empData.project_id)
        : undefined,
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
    try {
      const supabase = await createAdminClient();

      const { data, error } = await supabase
        .from("profile_change_requests")
        .select("*, employee:employees(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const requests = data ?? [];

      if (requests.length === 0) return [];

      const requestIds = requests
        .map((request: any) => request.id)
        .filter(Boolean);

      const { data: documents, error: documentsError } = await supabase
        .from("employee_documents")
        .select(
          "id, employee_id, profile_change_request_id, document_type, document_name, document_url, verification_status, previous_document_id, uploaded_at, profile_change_approved"
        )
        .in("profile_change_request_id", requestIds);

      if (documentsError) throw documentsError;

      const documentsByRequest = new Map<string, any[]>();

      for (const document of documents ?? []) {
        const requestId = document.profile_change_request_id;

        if (!requestId) continue;

        const current = documentsByRequest.get(requestId) ?? [];
        current.push(document);
        documentsByRequest.set(requestId, current);
      }

      return requests.map((request: any) => ({
        ...request,
        supporting_documents: documentsByRequest.get(request.id) ?? [],
      })) as ProfileChangeRequest[];
    } catch (error) {
      console.error("Failed to load profile change requests:", error);
      throw error;
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
          previous_values: previousValues ?? {},
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


  static readonly SENSITIVE_PROFILE_FIELDS = [
    "bank_name",
    "bank_account_number",
    "ifsc_code",
    "aadhar_number",
    "aadhaar_number",
    "pan_number",
    "passport_number",
  ] as const;

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
      // Use the authenticated Supabase client so auth.uid() is available
      // to the database function for its HR/CEO role check.
      const { createClient } = await import("./supabase-server");
      const supabase = await createClient();

      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("You must be logged in to review this request.");
      }

      // The database function independently verifies the reviewer role.
      const { data, error } = await supabase.rpc(
        "review_profile_change_request_atomic",
        {
          p_request_id: requestId,
          p_decision: status,
          p_review_notes: rejectionReason?.trim() || null,
        }
      );

      if (error) {
        console.error("Profile-change review RPC failed:", error);
        throw new Error(error.message || "Could not review profile-change request.");
      }

      if (!data || data.success !== true) {
        throw new Error("The database did not confirm the profile-change review.");
      }

      const reviewedAt = new Date().toISOString();

      const cachedRequest = cache.changeRequests.find(
        (item) => item.id === requestId
      );

      if (cachedRequest) {
        cachedRequest.status = status;
        cachedRequest.reviewed_by = user.id;
        cachedRequest.reviewed_at = reviewedAt;
        cachedRequest.rejection_reason =
          status === "rejected" ? rejectionReason?.trim() || null : null;
      }

      return true;
    } catch (error) {
      console.error("reviewProfileChangeRequest failed:", error);
      throw error;
    }
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
        .order("country_name", { ascending: true })
        .order("calendar_year", { ascending: true })
        .order("shift_type", { ascending: true });

      if (error) throw error;

      if (data) {
        const calendars = data as HolidayCalendar[];
        cache.holidayCalendars = calendars;
        return calendars;
      }
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
      const { data: employee, error: employeeError } =
        await supabase
          .from("employees")
          .select("id")
          .eq("employee_id", employeeId)
          .maybeSingle();

      if (employeeError) {
        throw new Error(employeeError.message);
      }

      employeeUuid = employee?.id || null;
    }

    if (!employeeUuid) {
      return [];
    }

    query = query.eq("employee_id", employeeUuid);
  }

  // Optional month filter
  if (month !== undefined && year !== undefined) {
    const startDate =
      `${year}-${String(month).padStart(2, "0")}-01`;

    const lastDay = new Date(year, month, 0).getDate();

    const endDate =
      `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    query = query
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate);
  }

  // Fetch all records in batches of 1000
  const allRecords: AttendanceLog[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await query
      .order("attendance_date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const records = (data || []) as AttendanceLog[];

    allRecords.push(...records);

    if (records.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRecords;
}


  static async getTodayAttendance(employeeId: string): Promise<AttendanceLog | null> {
    const supabase = await createAdminClient();

    const employee = await this.getEmployeeById(employeeId);
    if (!employee) return null;

    const shift = getEffectiveShift(employee);
    const attendanceDate = getShiftAttendanceDate(new Date(), shift);

    // Check the current shift's attendance date first.
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("attendance_date", attendanceDate)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (data) return data as AttendanceLog;

    // Also check the previous date for an active overnight session.
    const previousDate = addDaysToDateKey(attendanceDate, -1);

    const { data: previousLog, error: previousError } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("attendance_date", previousDate)
      .is("check_out_time", null)
      .not("check_in_time", "is", null)
      .maybeSingle();

    if (previousError) throw new Error(previousError.message);

    return previousLog as AttendanceLog | null;
  }

  static async clockIn(employeeId: string): Promise<AttendanceLog> {
    const supabase = await createAdminClient();
    const now = new Date();

    const employee = await this.getEmployeeById(employeeId);
    if (!employee) throw new Error("Employee not found");

    const shift = getEffectiveShift(employee);
    const attendanceDate = getShiftAttendanceDate(now, shift);

    const shiftStartInstant = zonedDateTimeToUtc(
      attendanceDate,
      shift.startTime,
      shift.timezone
    );

    const evaluation = evaluateAttendancePunch(
      now,
      shift.startTime,
      shift.gracePeriodMinutes,
      shift.halfDayCutoffMinutes,
      shiftStartInstant
    );

    const { data: wfhRequest, error: wfhError } = await supabase
      .from("wfh_requests")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("request_date", attendanceDate)
      .eq("status", "approved")
      .maybeSingle();

    if (wfhError) throw new Error(wfhError.message);

    const workMode = wfhRequest ? "WFH" : "WFO";

    const { data: existingLog, error: findError } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("attendance_date", attendanceDate)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (existingLog) {
      if (
        existingLog.check_out_time == null &&
        existingLog.check_in_time != null
      ) {
        throw new Error("You are already checked in. Please check out first.");
      }

      const { data, error } = await supabase
        .from("attendance_logs")
        .update({
          check_in_time: existingLog.check_in_time ?? now.toISOString(),
          session_check_in_time: now.toISOString(),
          check_out_time: null,
          total_hours: Number(existingLog.total_hours ?? 0),
          status: existingLog.status,
          is_late: existingLog.is_late || evaluation.isLate,
          work_mode: existingLog.work_mode ?? workMode,
        })
        .eq("id", existingLog.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as AttendanceLog;
    }

    const { data, error } = await supabase
      .from("attendance_logs")
      .insert({
        employee_id: employee.id,
        attendance_date: attendanceDate,
        check_in_time: now.toISOString(),
        session_check_in_time: now.toISOString(),
        check_out_time: null,
        total_hours: 0,
        status: evaluation.status,
        is_late: evaluation.isLate,
        is_regularized: false,
        work_mode: workMode,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AttendanceLog;
  }


  static async clockOut(employeeId: string): Promise<AttendanceLog> {
    const supabase = await createAdminClient();
    const now = new Date();

    const employee = await this.getEmployeeById(employeeId);
    if (!employee) throw new Error("Employee not found");

    const shift = getEffectiveShift(employee);
    const currentDate = getLocalDateKey(now, shift.timezone);
    const previousDate = addDaysToDateKey(currentDate, -1);

    // Search today and yesterday to support overnight sessions.
    const { data: logs, error: findError } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .in("attendance_date", [previousDate, currentDate])
      .is("check_out_time", null)
      .not("check_in_time", "is", null)
      .order("attendance_date", { ascending: false });

    if (findError) throw new Error(findError.message);

    const log = logs?.find(
      (entry) =>
        entry.check_out_time == null &&
        (entry.session_check_in_time != null ||
          entry.check_in_time != null)
    );

    if (!log) {
      throw new Error("You are not currently checked in.");
    }

    const sessionStartValue =
      log.session_check_in_time ?? log.check_in_time;

    if (!sessionStartValue) {
      throw new Error("Check-in time is missing.");
    }

    const sessionStart = new Date(sessionStartValue);

    if (Number.isNaN(sessionStart.getTime())) {
      throw new Error("Invalid check-in time.");
    }

    // Never count more than 9 hours for one session.
    const AUTO_CHECKOUT_HOURS = 9;
    const AUTO_CHECKOUT_MS = AUTO_CHECKOUT_HOURS * 60 * 60 * 1000;

    const autoCheckoutTime = new Date(
      sessionStart.getTime() + AUTO_CHECKOUT_MS
    );

    // If manual checkout happens after 9 hours,
    // record the exact 9-hour deadline instead.
    const effectiveCheckoutTime =
      now.getTime() >= autoCheckoutTime.getTime()
        ? autoCheckoutTime
        : now;

    const sessionHours = Math.max(
      0,
      (effectiveCheckoutTime.getTime() - sessionStart.getTime()) /
        (1000 * 60 * 60)
    );

    const previousHours = Number(log.total_hours ?? 0);

    if (!Number.isFinite(previousHours) || previousHours < 0) {
      throw new Error("Invalid existing total hours.");
    }

    const hours = Number(
      (previousHours + sessionHours).toFixed(2)
    );

    // Preserve existing half-day and regularization rules.
    let status = log.status;

    if (!log.is_regularized) {
      if (hours < 4.5 && status === "present") {
        status = "half_day";
      } else if (hours >= 4.5 && status === "half_day") {
        status = "present";
      }
    }


    let updateQuery = supabase
      .from("attendance_logs")
      .update({
        check_out_time: effectiveCheckoutTime.toISOString(),
        session_check_in_time: null,
        total_hours: hours,
        status,
      })
      .eq("id", log.id)
      .is("check_out_time", null);

    updateQuery =
      log.session_check_in_time == null
        ? updateQuery.is("session_check_in_time", null)
        : updateQuery.eq(
            "session_check_in_time",
            log.session_check_in_time
          );

    const { data: updatedLog, error: updateError } =
      await updateQuery.select().single();

    if (updateError) throw new Error(updateError.message);

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
        const { data: updatedLog, error: attendanceUpdateError } =
          await supabase
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
        const { data: newLog, error: attendanceInsertError } =
          await supabase
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
      .eq("is_active", true)
      .order("name");

    if (error) {
      throw error;
    }

    console.log(
      "ACTIVE LEAVE TYPES:",
      data?.map((type) => ({
        id: type.id,
        name: type.name,
        code: type.code,
        is_active: type.is_active,
      }))
    );

    if (data && data.length > 0) {
      cache.leaveTypes = data as LeaveType[];
      return cache.leaveTypes;
    }

    throw new Error(
      "No active leave types found. Please check the leave_types table in Supabase."
    );
  } catch (error) {
    console.error("getLeaveTypes failed:", error);

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
  if (!employee) return [];

  const supabase = await createAdminClient();
  const employeeUuid = employee.id;

  const joiningDateString = employee.joining_date
    ? String(employee.joining_date).split("T")[0]
    : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(joiningDateString)) {
    throw new Error("Employee joining date is missing or invalid.");
  }

  const joiningDate = new Date(`${joiningDateString}T00:00:00`);

  if (Number.isNaN(joiningDate.getTime())) {
    throw new Error("Employee joining date is missing or invalid.");
  }

  const joiningYear = joiningDate.getFullYear();
  const joiningMonth = joiningDate.getMonth();
  const joiningDay = joiningDate.getDate();

  if (year < joiningYear) {
    return [];
  }

  // Get active leave types.
  const leaveTypes = (await this.getLeaveTypes()).filter((type) => {
    const code = String(type.code ?? "").trim().toUpperCase();

    return (
      type.is_active &&
      ["CL", "SL", "EL", "ML", "PL"].includes(code)
    );
  });

  // Get all approved leave requests needed for yearly calculations.
  const { data: requests, error: requestError } = await supabase
    .from("leave_requests")
    .select(
      "employee_id, leave_type_id, start_date, end_date, total_days, status"
    )
    .eq("employee_id", employeeUuid)
    .eq("status", "approved")
    .gte("end_date", `${joiningYear}-01-01`)
    .lte("start_date", `${year}-12-31`);

  if (requestError) {
    throw new Error(
      `Failed to load approved leave requests: ${requestError.message}`
    );
  }

  type ApprovedLeaveRequest = {
    employee_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    total_days: number | string | null;
    status: string;
  };

  const approvedRequests =
    (requests ?? []) as ApprovedLeaveRequest[];

  // Calculate the approved leave used in a selected year.
  const getYearlyUsedDays = (
    leaveTypeId: string,
    selectedYear: number
  ): number => {
    const periodStart = new Date(
      selectedYear,
      0,
      1,
      0,
      0,
      0,
      0
    );

    const periodEnd = new Date(
      selectedYear,
      11,
      31,
      23,
      59,
      59,
      999
    );

    return approvedRequests
      .filter(
        (request) =>
          request.leave_type_id === leaveTypeId
      )
      .reduce((total, request) => {
        const start = new Date(
          `${request.start_date}T00:00:00`
        );

        const end = new Date(
          `${request.end_date}T00:00:00`
        );

        if (
          Number.isNaN(start.getTime()) ||
          Number.isNaN(end.getTime()) ||
          end < start
        ) {
          return total;
        }

        const overlapStart = Math.max(
          start.getTime(),
          periodStart.getTime()
        );

        const overlapEnd = Math.min(
          end.getTime(),
          periodEnd.getTime()
        );

        if (overlapEnd < overlapStart) {
          return total;
        }

        const totalCalendarDays =
          Math.floor(
            (end.getTime() - start.getTime()) / 86400000
          ) + 1;

        const overlappingDays =
          Math.floor(
            (overlapEnd - overlapStart) / 86400000
          ) + 1;

        const requestedDays = Number(
          request.total_days ?? 0
        );

        if (
          totalCalendarDays <= 0 ||
          requestedDays <= 0
        ) {
          return total;
        }

        return (
          total +
          (requestedDays * overlappingDays) /
            totalCalendarDays
        );
      }, 0);
  };

  // Joining-year CL accrues from the joining month.
  // Joining-year SL starts in the joining month only
  // when the employee joins on or before the 15th.
const getAnnualCredits = (
  code: string,
  selectedYear: number
): number => {
  if (selectedYear < joiningYear) return 0;

  // Full allocation for years after joining year.
  if (selectedYear > joiningYear) {
    return 12;
  }

  let joiningMonthCredits = 0;

  if (joiningDay <= 15) {
    joiningMonthCredits = 1;
  } else if (joiningDay <= 25) {
    joiningMonthCredits = code === "CL" ? 1 : 0;
  } else {
    joiningMonthCredits = 0;
  }

  // Count the months after the joining month.
  const remainingMonths = 11 - joiningMonth;

  return joiningMonthCredits + remainingMonths;
};

  const balancesToSave: Array<{
    employee_id: string;
    leave_type_id: string;
    year: number;
    allocated_days: number;
    used_days: number;
    balance_days: number;
  }> = [];

  for (const leaveType of leaveTypes) {
    const code = String(leaveType.code ?? "")
      .trim()
      .toUpperCase();

    const usedDays = getYearlyUsedDays(
      leaveType.id,
      year
    );

    let allocatedDays = 0;

    if (code === "CL") {
      // Calculate CL carry-forward year by year.
      let carryForward = 0;

      for (
        let selectedYear = joiningYear;
        selectedYear < year;
        selectedYear++
      ) {
        const previousAllocation =
          getAnnualCredits("CL", selectedYear) +
          carryForward;

        const previousUsed = getYearlyUsedDays(
          leaveType.id,
          selectedYear
        );

        const previousBalance = Math.max(
          0,
          previousAllocation - previousUsed
        );

        // Carry forward 50% of unused CL.
        carryForward = Number(
          (previousBalance * 0.5).toFixed(2)
        );
      }

      allocatedDays =
        getAnnualCredits("CL", year) +
        carryForward;
    } else if (code === "SL") {
      // SL does not carry forward.
      allocatedDays = getAnnualCredits("SL", year);
    } else if (
      code === "EL" ||
      code === "ML" ||
      code === "PL"
    ) {
      allocatedDays = Math.max(
        0,
        Number(leaveType.annual_quota ?? 0)
      );
    }

    const balanceDays = Math.max(
      0,
      allocatedDays - usedDays
    );

    balancesToSave.push({
      employee_id: employeeUuid,
      leave_type_id: leaveType.id,
      year,
      allocated_days: Number(
        allocatedDays.toFixed(2)
      ),
      used_days: Number(usedDays.toFixed(2)),
      balance_days: Number(balanceDays.toFixed(2)),
    });
  }

  // IMPORTANT:
  // Save balances in Supabase, not only in the cache.
  // The unique constraint prevents duplicate employee/year/type records.
  if (balancesToSave.length > 0) {
    const { data: savedBalances, error: saveError } =
      await supabase
        .from("employee_leave_balances")
        .upsert(balancesToSave, {
          onConflict: "employee_id,leave_type_id,year",
        })
        .select("*");

    if (saveError) {
      throw new Error(
        `Failed to initialize employee leave balances: ${saveError.message}`
      );
    }

    if (!savedBalances) {
      throw new Error(
        "Leave balances were not returned after saving."
      );
    }

    // Attach leave type information to saved records.
    const result = savedBalances.map((balance) => {
      const leaveType = leaveTypes.find(
        (type) => type.id === balance.leave_type_id
      );

      return {
        ...balance,
        leave_type: leaveType,
      } as EmployeeLeaveBalance;
    });

    // Update cache using actual database records.
    cache.leaveBalances = [
      ...cache.leaveBalances.filter(
        (balance) =>
          !(
            balance.employee_id === employeeUuid &&
            balance.year === year
          )
      ),
      ...result,
    ];

    return result;
  }

  return [];
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
        .select(`
          *,
          employee:employees (
            id,
            employee_id,
            first_name,
            last_name,
            profile_photo_url,
            department_id,
            department:departments (
              id,
              name
            )
          ),
          leave_type:leave_types (
            *
          )
        `)
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
  supportingDocumentUrl,
  leaveDuration,
  leaveDurationUnit,
  halfDayDuration = null,
}: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay?: boolean;
  reason: string;
  supportingDocumentUrl?: string;
  leaveDuration?: number;
  leaveDurationUnit?: "days";
  halfDayDuration?: "first_half" | "second_half" | null;
}): Promise<LeaveRequest> {
  const cache = getCache();
  const supabase = await createAdminClient();

  const employee = await this.getEmployeeById(employeeId);

  if (!employee) {
    throw new Error("Employee not found");
  }

  const { data: leaveType, error: leaveTypeError } =
    await supabase
      .from("leave_types")
      .select("*")
      .eq("id", leaveTypeId)
      .maybeSingle();

  if (leaveTypeError) {
    throw new Error(leaveTypeError.message);
  }

  const allowedLeaveCodes = [
    "CL",
    "SL",
    "EL",
    "LOP",
    "ML",
    "PL",
  ];

  if (
    !leaveType ||
    !leaveType.is_active ||
    !allowedLeaveCodes.includes(
      String(leaveType.code).toUpperCase()
    )
  ) {
    throw new Error("Invalid or inactive leave type");
  }

  const code = String(leaveType.code).toUpperCase();

  // Validate dates.
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (
    !datePattern.test(startDate) ||
    !datePattern.test(endDate) ||
    Number.isNaN(Date.parse(`${startDate}T00:00:00.000Z`)) ||
    Number.isNaN(Date.parse(`${endDate}T00:00:00.000Z`)) ||
    endDate < startDate
  ) {
    throw new Error("Please provide valid leave dates");
  }

  if (!reason?.trim()) {
    throw new Error("Please provide a reason for leave");
  }

  // Calculate calendar days, including weekends.
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  const totalCalendarDays =
    Math.floor(
      (end.getTime() - start.getTime()) / 86400000
    ) + 1;

  if (totalCalendarDays <= 0) {
    throw new Error("Invalid leave duration");
  }

  // Calculate working days, excluding Saturday and Sunday.
  let totalWorkingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getUTCDay();

    if (day !== 0 && day !== 6) {
      totalWorkingDays++;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  let validatedTotalDays = isHalfDay
    ? 0.5
    : totalCalendarDays;

  const duration = leaveDuration ?? null;
  const durationUnit = leaveDurationUnit ?? null;

  // =====================================================
  // MATERNITY AND PATERNITY VALIDATIONS
  // =====================================================

  if (code === "ML" || code === "PL") {
    if (isHalfDay) {
      throw new Error(
        "Half-day leave is not available for Maternity or Paternity Leave"
      );
    }

    const gender = String(
      (employee as { gender?: string }).gender ?? ""
    )
      .trim()
      .toLowerCase();

    if (
      code === "ML" &&
      !["female", "f"].includes(gender)
    ) {
      throw new Error(
        "Maternity Leave is available only for female employees"
      );
    }

    if (
      code === "PL" &&
      !["male", "m"].includes(gender)
    ) {
      throw new Error(
        "Paternity Leave is available only for male employees"
      );
    }

    if (!supportingDocumentUrl?.trim()) {
      throw new Error(
        "Please upload the supporting document before applying"
      );
    }

    if (
      duration === null ||
      !Number.isInteger(duration)
    ) {
      throw new Error("Please select a valid leave duration");
    }

    if (durationUnit !== "days") {
      throw new Error("Leave duration must be provided in days");
    }

    // Maternity: 90 or 180 calendar days.
    if (code === "ML") {
      if (![90, 180].includes(duration)) {
        throw new Error(
          "Select maternity leave for 3 months (90 days) or 6 months (180 days)"
        );
      }
    }

    // Paternity: 2, 7, 14, 21 or 28 calendar days.
    if (code === "PL") {
      if (![2, 7, 14, 21, 28].includes(duration)) {
        throw new Error(
          "Paternity Leave duration must be 2 days, 1, 2, 3, or 4 weeks"
        );
      }
    }

    // Calculate expected end date using calendar days.
    const expectedEnd = new Date(start);

    expectedEnd.setUTCDate(
      expectedEnd.getUTCDate() + duration - 1
    );

    const expectedEndString = expectedEnd
      .toISOString()
      .slice(0, 10);

    if (endDate !== expectedEndString) {
      throw new Error(
        `End date does not match the selected leave duration. Expected ${expectedEndString}`
      );
    }

    if (
      totalCalendarDays !== duration ||
      Number(totalDays) !== duration
    ) {
      throw new Error(
        `Selected leave duration must be exactly ${duration} calendar days`
      );
    }

    validatedTotalDays = duration;
  }

  // =====================================================
  // HALF-DAY VALIDATION
  // =====================================================

  if (isHalfDay && startDate !== endDate) {
    throw new Error(
      "Half-day leave must be applied for one date only"
    );
  }

  if (
    isHalfDay &&
    !["first_half", "second_half"].includes(
      String(halfDayDuration)
    )
  ) {
    throw new Error("Please select the half-day duration");
  }

  // =====================================================
  // REGULAR LEAVE CALCULATION
  //
  // CL, SL, EL = Calendar days.
  // LOP = Working days only.
  // =====================================================

  if (!["ML", "PL"].includes(code)) {
    const expectedDays =
      code === "LOP"
        ? totalWorkingDays
        : totalCalendarDays;

    if (isHalfDay) {
      validatedTotalDays = 0.5;
    } else {
      if (expectedDays <= 0) {
        throw new Error(
          "LOP cannot be applied for Saturday and Sunday because they are non-working days."
        );
      }

      if (
        Math.abs(Number(totalDays) - expectedDays) > 0.001
      ) {
        throw new Error(
          code === "LOP"
            ? `Invalid LOP duration. Expected ${expectedDays} working day(s), excluding Saturday and Sunday.`
            : `Invalid leave duration. Expected ${expectedDays} calendar day(s), including Saturday and Sunday.`
        );
      }

      validatedTotalDays = expectedDays;
    }
  }

  // =====================================================
  // CREATE LEAVE REQUEST
  // =====================================================

  const insertPayload: Record<string, unknown> = {
    employee_id: employee.id,
    leave_type_id: leaveTypeId,
    start_date: startDate,
    end_date: endDate,
    total_days: validatedTotalDays,
    is_half_day: isHalfDay,
    reason: reason.trim(),
    status: "pending",
  };

  if (isHalfDay) {
    insertPayload.leave_duration = halfDayDuration;
  }

  if (code === "ML" || code === "PL") {
    insertPayload.supporting_document_url =
      supportingDocumentUrl!.trim();

    insertPayload.leave_duration = duration;
    insertPayload.leave_duration_unit = durationUnit;
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .insert(insertPayload)
    .select("*, employee:employees(*), leave_type:leave_types(*)")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      "Leave request was not returned after insert"
    );
  }

  const createdRequest = data as LeaveRequest;

  cache.leaveRequests.unshift(createdRequest);

  return createdRequest;
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

  // 1. Fetch leave request.
  const { data: dbReq, error: requestError } =
    await supabase
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
    throw new Error(
      `Leave request has already been ${dbReq.status}`
    );
  }

  const req = dbReq as LeaveRequest;
  const reviewedAt = new Date().toISOString();

  const startDate = String(req.start_date);
  const endDate = String(req.end_date);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    throw new Error("Invalid leave request dates.");
  }

  const totalCalendarDays =
    Math.floor(
      (end.getTime() - start.getTime()) / 86400000
    ) + 1;

  if (totalCalendarDays <= 0) {
    throw new Error("Invalid leave duration.");
  }

  // 2. Process balance only when approving.
  if (status === "approved") {
    const { data: leaveType, error: leaveTypeError } =
      await supabase
        .from("leave_types")
        .select("id, name, code")
        .eq("id", req.leave_type_id)
        .maybeSingle();

    if (leaveTypeError) {
      throw new Error(leaveTypeError.message);
    }

    if (!leaveType) {
      throw new Error("Leave type not found.");
    }

    const leaveCode = String(
      leaveType.code ?? ""
    ).toUpperCase();

    const leaveName = String(
      leaveType.name ?? ""
    ).toLowerCase();

    const isLOP =
      leaveCode === "LOP" ||
      leaveName.includes("loss of pay");

    const isSpecialLeave =
      ["ML", "PL"].includes(leaveCode) ||
      leaveName.includes("maternity") ||
      leaveName.includes("paternity");

    const requestedDays = Number(
      req.total_days ?? 0
    );

    if (
      !Number.isFinite(requestedDays) ||
      requestedDays <= 0
    ) {
      throw new Error("Invalid leave duration.");
    }

    // 3. Validate duration.
    if (req.is_half_day) {
      if (
        startDate !== endDate ||
        requestedDays !== 0.5 ||
        isSpecialLeave
      ) {
        throw new Error(
          "Invalid half-day leave duration."
        );
      }
    } else if (
      requestedDays !== totalCalendarDays
    ) {
      throw new Error(
        `Invalid leave duration. Expected ${totalCalendarDays} calendar day(s), but request contains ${requestedDays}.`
      );
    }

    // 4. LOP, ML and PL do not deduct normal leave balances.
    // Their approved requests are saved without changing CL/SL balances.
    if (!isLOP && !isSpecialLeave) {
      const startYear = start.getUTCFullYear();
      const endYear = end.getUTCFullYear();

      const deductions: Array<{
        year: number;
        days: number;
        balance: Record<string, any>;
      }> = [];

      // 5. Prepare deductions for each calendar year.
      for (
        let selectedYear = startYear;
        selectedYear <= endYear;
        selectedYear++
      ) {
        const yearStart = new Date(
          Date.UTC(selectedYear, 0, 1)
        );

        const yearEnd = new Date(
          Date.UTC(selectedYear, 11, 31)
        );

        const overlapStart = Math.max(
          start.getTime(),
          yearStart.getTime()
        );

        const overlapEnd = Math.min(
          end.getTime(),
          yearEnd.getTime()
        );

        if (overlapEnd < overlapStart) {
          continue;
        }

        const overlappingCalendarDays =
          Math.floor(
            (overlapEnd - overlapStart) / 86400000
          ) + 1;

        const daysForYear = Number(
          (
            (requestedDays * overlappingCalendarDays) /
            totalCalendarDays
          ).toFixed(2)
        );

        if (daysForYear <= 0) {
          continue;
        }

        // 6. Find existing balance.
        const {
          data: initialBalance,
          error: balanceError,
        } = await supabase
          .from("employee_leave_balances")
          .select("*")
          .eq("employee_id", req.employee_id)
          .eq("leave_type_id", req.leave_type_id)
          .eq("year", selectedYear)
          .maybeSingle();

        if (balanceError) {
          throw new Error(
            `Failed to check leave balance: ${balanceError.message}`
          );
        }

        let dbBalance = initialBalance;

        // Initialize balance if missing.
        if (!dbBalance) {
          await DataStore.getLeaveBalances(
            req.employee_id,
            selectedYear
          );

          const {
            data: generatedBalance,
            error: generatedError,
          } = await supabase
            .from("employee_leave_balances")
            .select("*")
            .eq("employee_id", req.employee_id)
            .eq("leave_type_id", req.leave_type_id)
            .eq("year", selectedYear)
            .maybeSingle();

          if (generatedError) {
            throw new Error(
              `Failed to fetch initialized leave balance: ${generatedError.message}`
            );
          }

          dbBalance = generatedBalance;
        }

        if (!dbBalance) {
          throw new Error(
            `Unable to initialize leave balance for ${leaveType.name}, year ${selectedYear}.`
          );
        }

        const availableDays = Number(
          dbBalance.balance_days ?? 0
        );

        // 7. Validate normal leave balance.
        if (availableDays < daysForYear) {
          throw new Error(
            `Insufficient leave balance for ${selectedYear}. Available: ${availableDays}, Requested: ${daysForYear}`
          );
        }

        deductions.push({
          year: selectedYear,
          days: daysForYear,
          balance: dbBalance,
        });
      }

      // 8. Update normal leave balances.
      for (const deduction of deductions) {
        const currentUsedDays = Number(
          deduction.balance.used_days ?? 0
        );

        const newUsedDays = Number(
          (
            currentUsedDays + deduction.days
          ).toFixed(2)
        );

        const newBalanceDays = Number(
          (
            Number(deduction.balance.balance_days ?? 0) -
            deduction.days
          ).toFixed(2)
        );

        if (newBalanceDays < 0) {
          throw new Error(
            `Leave balance cannot become negative for ${deduction.year}.`
          );
        }

        const {
          data: updatedBalance,
          error: balanceUpdateError,
        } = await supabase
          .from("employee_leave_balances")
          .update({
            used_days: newUsedDays,
            balance_days: newBalanceDays,
          })
          .eq("id", deduction.balance.id)
          .select("*")
          .single();

        if (balanceUpdateError) {
          throw new Error(
            `Failed to update leave balance for ${deduction.year}: ${balanceUpdateError.message}`
          );
        }

        // 9. Update balance cache.
        const cacheIndex = cache.leaveBalances.findIndex(
          (balance) =>
            balance.employee_id === req.employee_id &&
            balance.leave_type_id === req.leave_type_id &&
            balance.year === deduction.year
        );

        const cacheBalance = {
          ...updatedBalance,
          leave_type: leaveType,
        } as EmployeeLeaveBalance;

        if (cacheIndex >= 0) {
          cache.leaveBalances[cacheIndex] = cacheBalance;
        } else {
          cache.leaveBalances.push(cacheBalance);
        }
      }
    }
  }

  // 10. Update leave request status.
  const {
    data: updatedRequest,
    error: updateError,
  } = await supabase
    .from("leave_requests")
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt,
      rejection_reason:
        status === "rejected"
          ? rejectionReason || null
          : null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updatedRequest) {
    throw new Error(
      "Leave request was already reviewed."
    );
  }

  // 11. Synchronize request cache.
  req.status = status;
  req.reviewed_by = reviewerId;
  req.reviewed_at = reviewedAt;
  req.rejection_reason =
    status === "rejected"
      ? rejectionReason || null
      : null;

  const cachedRequest = cache.leaveRequests.find(
    (request) => request.id === requestId
  );

  if (cachedRequest) {
    cachedRequest.status = status;
    cachedRequest.reviewed_by = reviewerId;
    cachedRequest.reviewed_at = reviewedAt;
    cachedRequest.rejection_reason =
      req.rejection_reason;
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

    const activeComponents: SalaryComponent[] = salaryComponents.map(
      (masterComponent) => {
        const employeeComponent = employeeSalaryComponents.find(
          (component) =>
            component.salary_component_id === masterComponent.id
        );

        // Employee-specific settings take priority over master settings.
        if (employeeComponent) {
          return {
            ...masterComponent,
            calculation_type:
              employeeComponent.calculation_type as SalaryComponent["calculation_type"],
            value: Number(employeeComponent.value),
            is_active: employeeComponent.is_active === true,
            affects_lop:
              employeeComponent.affects_lop ?? masterComponent.affects_lop,
          };
        }

        // Default BASIC to 50% when there is no employee-specific override.
        if (masterComponent.code === "BASIC") {
          return {
            ...masterComponent,
            value: 50,
          };
        }

        // Otherwise, use the master component configuration.
        return masterComponent;
      }
    ).filter((component) => component.is_active === true);

    // Use the employee-specific BASIC override when available.
    // Otherwise, use the new 50% default instead of the old master 47%.
    const employeeBasicOverride = employeeSalaryComponents.find((component) => {
      const master = salaryComponents.find(
        (item) => item.id === component.salary_component_id
      );
      return master?.code === "BASIC" && component.is_active === true;
    });

    const basicPercent = employeeBasicOverride
      ? Number(employeeBasicOverride.value)
      : 50;
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

    const monthStart =`${year}-${String(month).padStart(2, "0")}-01`;

    const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(totalDaysInMonth).padStart(2, "0")}`;

    const indiaToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    if (monthStart > indiaToday) {throw new Error("Payroll cannot be generated for a future month.");}

    const payrollCutoffDate = monthEnd < indiaToday ? monthEnd : indiaToday;

    // =========================================================
    // GET EMPLOYEE PROJECT HOLIDAY CALENDAR
    // =========================================================

    let calendarId: string | null = null;

    // Priority 1: Assigned project calendar.

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

      calendarId = project?.calendar_id || null;
    }

    // Priority 2: Retained project calendar for bench employees.
    else if (selectedEmployee.retained_calendar_id) {
      calendarId = selectedEmployee.retained_calendar_id;
    }

    // Priority 3: India calendar based on employee-level shift.
    else {
      const shiftType =
        selectedEmployee.shift_type === "night" ? "night" : "general";

      const {
        data: defaultCalendar,
        error: calendarError,
      } = await supabase
        .from("holiday_calendars")
        .select("id")
        .eq("country_code", "IN")
        .eq("shift_type", shiftType)
        .eq("calendar_year", year)
        .maybeSingle();

      if (calendarError) {
        throw new Error(
          `Failed to load default India holiday calendar: ${calendarError.message}`
        );
      }

      calendarId = defaultCalendar?.id || null;
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
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const currentDate = new Date( `${date}T00:00:00`);

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
    const fullMonthWorkingDays = workingDates.length;

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

      // Employee's eligible working days after joining.
      const workingDays = effectiveWorkingDates.length;

      // Prorated salary for the employee's eligible period.
      const periodBaseSalary =
        fullMonthWorkingDays > 0
          ? Number(
              (
                baseSalary *
                (workingDays / fullMonthWorkingDays)
              ).toFixed(2)
            )
          : 0;

      // Attendance only up to the payroll cutoff date.
      const attendanceWorkingDates = effectiveWorkingDates.filter(
        (date) => date <= payrollCutoffDate
      );

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
        .lte("attendance_date", payrollCutoffDate);

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
        const workingDate of attendanceWorkingDates
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
          const isLop =
            leave.leave_type?.is_paid === false ||
            String(leave.leave_type?.code || "").toUpperCase() === "LOP" ||
            String(leave.leave_type?.code || "").toUpperCase() === "UNPAID" ||
            String(leave.leave_type?.name || "").toLowerCase().includes("loss of pay") ||
            String(leave.leave_type?.name || "").toLowerCase().includes("lop") ||
            String(leave.leave_type?.name || "").toLowerCase().includes("unpaid");

          if (!isLop) {
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
        // HALF DAY (No LOP per company policy)
        // -----------------------------------------------------

        if (status === "half_day") {
          presentDays += 1;
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
      const remainingLopDays = Math.max(0, attendanceWorkingDates.length - accountedDays);
      lopDays = Number((lopDays + remainingLopDays).toFixed(2));

      
      // =======================================================
      // PREVENT ACCOUNTED DAYS FROM EXCEEDING WORKING DAYS
      // =======================================================

      const totalAccountedDays =
        presentDays +
        paidLeaves +
        lopDays;

      if (totalAccountedDays > attendanceWorkingDates.length) {
        const excess = totalAccountedDays - attendanceWorkingDates.length;
        lopDays = Number(Math.max(0,lopDays - excess).toFixed(2));
      }

      // =======================================================
      // SALARY BREAKDOWN
      //
      // LOP is calculated against actual working days.
      // =======================================================

      // =======================================================
      // BASIC SALARY AND EMPLOYER CONTRIBUTIONS
      // =======================================================

      const basicSalary = Number(
        ((periodBaseSalary * basicPercent) / 100).toFixed(2)
      );

      // Employer PF:
      // Basic >= ₹25,000 → ₹3,000
      // Otherwise → 12% of Basic
      const employerPf = Number(
        (
          basicSalary >= 25000
            ? 3000
            : basicSalary * 0.12
        ).toFixed(2)
      );

      // Employer ESI:
      // Monthly CTC <= ₹21,000 → 3.25% of CTC
      const employerEsi = Number(
        (
          periodBaseSalary <= 21000
            ? periodBaseSalary * 0.0325
            : 0
        ).toFixed(2)
      );

      // Employer PF administration charge
      const pfAdmin = 150;

      // Monthly gratuity provision
      const gratuityProvision = Number(
        ((basicSalary * 15) / (26 * 12)).toFixed(2)
      );

      // =======================================================
      // SALARY BREAKDOWN
      // =======================================================

      const breakdown = calculateSalaryBreakdown({
        grossSalary: periodBaseSalary,
        totalDaysInMonth: workingDays,
        lopDays,
        activeComponents,
        pfEligible: emp.pf_eligible === true,
        esiEligible: emp.esi_healthcare_eligible === true,
        ptEligible: emp.pt_eligible === true,
        tdsEligible: emp.tds_eligible === true,
        employerPfAmount: employerPf,
      });


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
          id,
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

      const existingIncentive = Number(existingPayslip?.incentive || 0);

      const existingBonus = Number(existingPayslip?.bonus || 0);

      const existingCompensation = Number(existingPayslip?.compensation || 0);

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
        // TDS ON ADDITIONAL EARNINGS
        // PF and ESI are NOT calculated on additional earnings.
        // -------------------------------------------------------

        const tdsComponent = activeComponents.find(
          (component) => component.code === "TDS"
        );

        const additionalTds =
          emp.tds_eligible === true &&
          breakdown.adjustedGross > 0 &&
          tdsComponent?.calculation_type === "percentage_of_gross"
            ? Number(
                (
                  (additionalEarningsTotal * Number(tdsComponent.value)) /
                  100
                ).toFixed(2)
              )
            : 0;

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

      const existingAdditionalEarningBreakup = existingEarningsBreakup.filter((earning: any) => earning?.code === "INCENTIVE" || earning?.code === "BONUS" || earning?.code === "COMPENSATION");
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

      const finalTotalDeductions = Number(
        (breakdown.totalDeductions + additionalTds).toFixed(2)
      );

      const finalNetSalary = Number(
        (
          breakdown.netSalary +
          additionalEarningsTotal -
          additionalTds
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

        total_deductions: finalTotalDeductions,
        // PF statutory amounts
        pf_eligible_amount: breakdown.pfEligibleAmount,
        pf_deducted_amount: breakdown.pfDeductedAmount,
        pf_pending_amount: breakdown.pfPendingAmount,

        // ESI statutory amounts
        esi_eligible_amount: breakdown.esiEligibleAmount,
        esi_deducted_amount: breakdown.esiDeductedAmount,
        esi_pending_amount: breakdown.esiPendingAmount,

        net_salary: finalNetSalary,

        employer_pf: employerPf,
        employer_esi: employerEsi,
        pf_admin: pfAdmin,

        gratuity_provision: gratuityProvision,

        earnings_breakup: finalEarningsBreakup,

        deductions_breakup: [
          ...breakdown.deductionsBreakdown,
          ...(additionalTds > 0
            ? [{
                component_id: "additional_tds",
                name: "TDS on Additional Earnings",
                code: "TDS",
                type: "deduction" as const,
                amount: additionalTds,
              }]
            : []),
        ],

        // Additional earnings
        incentive: incentiveAmount,

        bonus: bonusAmount,

        compensation: compensationAmount,

        payment_status: "processed",
      };


      // =======================================================
      // SAVE / UPDATE PAYSLIP
      // =======================================================

      let savedPayslip: any = null;
      let payslipError: any = null;

      if ((existingPayslip as any)?.id) {
        const res = await supabase
          .from("payslips")
          .update(payslipData)
          .eq("id", (existingPayslip as any).id)
          .select()
          .single();
        savedPayslip = res.data;
        payslipError = res.error;
      } else {
        const res = await supabase
          .from("payslips")
          .insert([payslipData])
          .select()
          .single();
        savedPayslip = res.data;
        payslipError = res.error;
      }

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
