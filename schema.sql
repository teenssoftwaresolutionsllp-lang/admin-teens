-- ==========================================================
-- TEENS SOFTWARE SOLUTIONS - HRMS & EMPLOYEE SELF-SERVICE SCHEMA
-- ==========================================================

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (CEO, HR, EMPLOYEE)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text NOT NULL,
    full_name text,
    role text CHECK (role IN ('ceo', 'hr', 'employee')) DEFAULT 'employee',
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- In case profiles already exists with old check constraint, update it safely:
DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('ceo', 'hr', 'employee'));
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 2. DEPARTMENTS
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- 3. HOLIDAY CALENDARS (MULTI-COUNTRY)
CREATE TABLE IF NOT EXISTS public.holiday_calendars (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    country_code text NOT NULL, -- IN, US, UK, etc.
    country_name text NOT NULL,
    timezone text NOT NULL DEFAULT 'Asia/Kolkata',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.holidays (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    calendar_id uuid REFERENCES public.holiday_calendars(id) ON DELETE CASCADE,
    holiday_date date NOT NULL,
    title text NOT NULL,
    is_optional boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(calendar_id, holiday_date)
);

-- 4. PROJECTS & SHIFTS
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    client_country text NOT NULL DEFAULT 'India',
    timezone text NOT NULL DEFAULT 'Asia/Kolkata',
    calendar_id uuid REFERENCES public.holiday_calendars(id),
    shift_start_time time NOT NULL DEFAULT '09:00:00',
    shift_end_time time NOT NULL DEFAULT '18:00:00',
    grace_period_minutes int DEFAULT 30,
    half_day_cutoff_minutes int DEFAULT 150,
    created_at timestamptz DEFAULT now()
);

-- 5. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
    employee_id text UNIQUE NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text UNIQUE NOT NULL,
    phone text,
    date_of_birth date,
    gender text CHECK (gender IN ('male', 'female', 'other')),
    blood_group text,
    marital_status text CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
    address text,
    city text,
    state text,
    pincode text,
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relation text,
    department_id uuid REFERENCES public.departments(id),
    project_id uuid REFERENCES public.projects(id),
    designation text,
    employment_type text CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'intern')),
    joining_date date,
    probation_end_date date,
    confirmation_date date,
    reporting_manager text,
    work_location text,
    salary numeric(12,2) DEFAULT 50000.00,
    bank_name text,
    bank_account_number text,
    ifsc_code text,
    pan_number text,
    aadhar_number text,
    uan_number text,
    esi_number text,
    profile_photo_url text,
    status text CHECK (status IN ('active', 'inactive', 'terminated', 'on_notice')) DEFAULT 'active',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Alter table safely if columns don't exist yet
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- 6. EMPLOYEE DOCUMENTS
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    document_type text NOT NULL,
    document_name text NOT NULL,
    document_url text NOT NULL,
    cloudinary_public_id text,
    uploaded_at timestamptz DEFAULT now()
);

-- 7. PROFILE CHANGE REQUESTS (MAKER-CHECKER WORKFLOW)
CREATE TABLE IF NOT EXISTS public.profile_change_requests (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    requested_changes jsonb NOT NULL,
    previous_values jsonb,
    status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    rejection_reason text,
    reviewed_by uuid REFERENCES public.profiles(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 8. ATTENDANCE LOGS
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    attendance_date date NOT NULL,
    check_in_time timestamptz,
    check_out_time timestamptz,
    total_hours numeric(4,2),
    status text CHECK (status IN ('present', 'half_day', 'absent', 'on_leave', 'holiday', 'weekend')) DEFAULT 'present',
    is_late boolean DEFAULT false,
    is_regularized boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(employee_id, attendance_date)
);

-- 9. ATTENDANCE REGULARIZATION REQUESTS
CREATE TABLE IF NOT EXISTS public.attendance_regularizations (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    attendance_date date NOT NULL,
    proposed_check_in time NOT NULL,
    proposed_check_out time NOT NULL,
    reason text NOT NULL,
    status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    rejection_reason text,
    reviewed_by uuid REFERENCES public.profiles(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 10. LEAVE MANAGEMENT
CREATE TABLE IF NOT EXISTS public.leave_types (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    code text UNIQUE NOT NULL, -- CL, SL, EL, LOP
    annual_quota int DEFAULT 12,
    is_paid boolean DEFAULT true,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_leave_balances (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE CASCADE,
    year int NOT NULL,
    allocated_days numeric(4,1) NOT NULL,
    used_days numeric(4,1) DEFAULT 0,
    balance_days numeric(4,1) NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type_id uuid REFERENCES public.leave_types(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(4,1) NOT NULL,
    is_half_day boolean DEFAULT false,
    reason text,
    status text CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
    rejection_reason text,
    reviewed_by uuid REFERENCES public.profiles(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 11. PAYROLL & PAYSLIPS (FORMULA & COMPONENT DRIVEN)
CREATE TABLE IF NOT EXISTS public.salary_components (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    code text UNIQUE NOT NULL,
    type text CHECK (type IN ('earning', 'deduction')) NOT NULL,
    calculation_type text CHECK (calculation_type IN ('fixed', 'percentage_of_basic', 'percentage_of_gross')) NOT NULL,
    value numeric(10,2) NOT NULL,
    affects_lop boolean DEFAULT true,
    is_active boolean DEFAULT true,
    is_statutory boolean DEFAULT false,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payslips (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    payroll_month int NOT NULL,
    payroll_year int NOT NULL,
    month_name text NOT NULL,
    working_days int NOT NULL,
    present_days numeric(4,1) NOT NULL,
    paid_leaves numeric(4,1) DEFAULT 0,
    lop_days numeric(4,1) DEFAULT 0,
    gross_salary numeric(12,2) NOT NULL,
    lop_deduction numeric(12,2) DEFAULT 0,
    total_earnings numeric(12,2) NOT NULL,
    total_deductions numeric(12,2) NOT NULL,
    net_salary numeric(12,2) NOT NULL,
    earnings_breakup jsonb NOT NULL,
    deductions_breakup jsonb NOT NULL,
    payment_status text CHECK (payment_status IN ('draft', 'processed', 'paid')) DEFAULT 'processed',
    created_at timestamptz DEFAULT now(),
    UNIQUE(employee_id, payroll_month, payroll_year)
);

-- 12. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_regularizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read core metadata
CREATE POLICY "Allow authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read holiday_calendars" ON public.holiday_calendars FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read leave_types" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read salary_components" ON public.salary_components FOR SELECT TO authenticated USING (true);

-- Employee can view their own record, HR/CEO can view and edit all
CREATE POLICY "Employees select policy" ON public.employees FOR SELECT TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ceo', 'hr'))
);

CREATE POLICY "Employees update policy" ON public.employees FOR UPDATE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ceo', 'hr'))
);

CREATE POLICY "Employees insert policy" ON public.employees FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ceo', 'hr'))
);

-- Attendance policies
CREATE POLICY "Attendance select policy" ON public.attendance_logs FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.employees WHERE id = attendance_logs.employee_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ceo', 'hr'))
);

CREATE POLICY "Attendance insert policy" ON public.attendance_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Attendance update policy" ON public.attendance_logs FOR UPDATE TO authenticated
USING (true);

-- Payslip policies
CREATE POLICY "Payslips select policy" ON public.payslips FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.employees WHERE id = payslips.employee_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ceo', 'hr'))
);

-- 13. SEED INITIAL CORE DATA
INSERT INTO public.departments (name, description) VALUES
    ('Engineering', 'Software development and engineering'),
    ('Design', 'UI/UX and product design'),
    ('Marketing', 'Marketing and communications'),
    ('Sales', 'Sales and business development'),
    ('HR', 'Human Resources and Operations'),
    ('Finance', 'Finance and Accounting'),
    ('Operations', 'Business operations')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.leave_types (name, code, annual_quota, is_paid, is_active, description) VALUES
    ('Casual Leave', 'CL', 12, true, true, 'Paid casual leave for personal work'),
    ('Sick Leave', 'SL', 10, true, true, 'Paid sick leave for medical recovery'),
    ('Earned Leave', 'EL', 15, true, true, 'Paid privilege/earned leave'),
    ('Loss of Pay', 'LOP', 0, false, true, 'Unpaid leave that triggers per-day salary deduction')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.salary_components (name, code, type, calculation_type, value, affects_lop, is_active, is_statutory, description) VALUES
    ('Basic Salary', 'BASIC', 'earning', 'percentage_of_gross', 50.00, true, true, true, '50% of Gross CTC'),
    ('House Rent Allowance (HRA)', 'HRA', 'earning', 'percentage_of_basic', 40.00, true, true, true, '40% of Basic Pay'),
    ('Special Allowance', 'SPECIAL_ALLOWANCE', 'earning', 'fixed', 0.00, true, true, false, 'Balancing allowance of Gross Salary'),
    ('Provident Fund (PF)', 'PF', 'deduction', 'percentage_of_basic', 12.00, false, true, true, '12% of Basic Pay'),
    ('Employee State Insurance (ESI)', 'ESI', 'deduction', 'percentage_of_gross', 0.75, false, true, true, '0.75% of Gross if Gross <= ₹21,000'),
    ('Professional Tax (PT)', 'PT', 'deduction', 'fixed', 200.00, false, true, true, 'State statutory professional tax'),
    ('Tax Deducted at Source (TDS)', 'TDS', 'deduction', 'percentage_of_gross', 5.00, false, false, true, 'Estimated income tax')
ON CONFLICT (code) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
