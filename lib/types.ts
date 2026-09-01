export type UserRole = 'ceo' | 'hr';

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

export interface Employee {
  id: string;
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

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  departmentCount: number;
  newHiresThisMonth: number;
  onNoticeCount: number;
  recentEmployees: Employee[];
}
