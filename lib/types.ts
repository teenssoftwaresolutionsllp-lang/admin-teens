export type UserRole = 'ceo' | 'hr' | 'employee';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Holiday {
  id: string;
  calendar_id: string;
  holiday_date: string;
  title: string;
  is_optional?: boolean;
}

export interface HolidayCalendar {
  id: string;
  name: string;
  country_code: string;
  country_name: string;
  timezone: string;
  holidays?: Holiday[];
}

export interface Project {
  id: string;
  name: string;
  client_country: string;
  timezone: string;
  calendar_id: string;
  shift_start_time: string; // "09:00"
  shift_end_time: string;   // "18:00"
  grace_period_minutes: number; // e.g. 30
  half_day_cutoff_minutes: number; // e.g. 150 (2.5 hrs after start)
  calendar?: HolidayCalendar;
}

export interface Employee {
  id: string;
  user_id?: string | null;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  blood_group: string | null;
  marital_status: 'single' | 'married' | 'divorced' | 'widowed' | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  department_id: string | null;
  project_id?: string | null;
  designation: string | null;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'intern' | null;
  joining_date: string | null;
  probation_end_date: string | null;
  confirmation_date: string | null;
  reporting_manager: string | null;
  work_location: string | null;
  salary: number | null;
  bank_name: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  pan_number: string | null;
  aadhar_number: string | null;
  uan_number: string | null;
  esi_number: string | null;
  profile_photo_url: string | null;
  status: 'active' | 'inactive' | 'terminated' | 'on_notice';
  notes: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
  project?: Project;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  document_name: string;
  document_url: string;
  cloudinary_public_id: string | null;
  uploaded_at: string;
}

export interface ProfileChangeRequest {
  id: string;
  employee_id: string;
  requested_changes: Record<string, any>;
  previous_values?: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  employee?: Employee;
}

export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'on_leave' | 'holiday' | 'weekend';

export interface AttendanceLog {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | null;
  status: AttendanceStatus;
  is_late: boolean;
  is_regularized: boolean;
  created_at: string;
}

export interface AttendanceRegularization {
  id: string;
  attendance_log_id?: string | null;
  employee_id: string;
  attendance_date: string;
  proposed_check_in: string;
  proposed_check_out: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  employee?: Employee;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string; // CL, SL, EL, LOP
  annual_quota: number;
  is_paid: boolean;
  is_active: boolean;
  description?: string;
}

export interface EmployeeLeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  allocated_days: number;
  used_days: number;
  balance_days: number;
  leave_type?: LeaveType;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day?: boolean;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  leave_type?: LeaveType;
  employee?: Employee;
}

export type SalaryComponentType = 'earning' | 'deduction';
export type CalculationType = 'fixed' | 'percentage_of_basic' | 'percentage_of_gross';

export interface SalaryComponent {
  id: string;
  name: string;
  code: string;
  type: SalaryComponentType;
  calculation_type: CalculationType;
  value: number; // e.g. 50 (for 50% of gross), or 40 (for 40% of basic), or fixed amount
  affects_lop: boolean;
  is_active: boolean;
  is_statutory: boolean;
  description: string;
}

export interface PayslipBreakupItem {
  component_id: string;
  name: string;
  code: string;
  type: SalaryComponentType;
  amount: number;
}

export interface Payslip {
  id: string;
  employee_id: string;
  payroll_month: number; // 1-12
  payroll_year: number;
  month_name: string;
  working_days: number;
  present_days: number;
  paid_leaves: number;
  lop_days: number;
  gross_salary: number;
  lop_deduction: number;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  earnings_breakup: PayslipBreakupItem[];
  deductions_breakup: PayslipBreakupItem[];
  payment_status: 'draft' | 'processed' | 'paid';
  created_at: string;
  employee?: Employee;
}

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  departmentCount: number;
  newHiresThisMonth: number;
  onNoticeCount: number;
  recentEmployees: Employee[];
}
