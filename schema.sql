-- ==========================================================
-- TEENS SOFTWARE SOLUTIONS - HRMS & EMPLOYEE SELF-SERVICE
-- COMPLETE UPDATED SUPABASE SCHEMA
-- ==========================================================

-- ==========================================================
-- EXTENSIONS
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ==========================================================
-- 1. PROFILES TABLE
-- CEO, HR, EMPLOYEE
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'employee',
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
    ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (
        role IN ('ceo', 'hr', 'employee')
    );
EXCEPTION
    WHEN others THEN NULL;
END $$;


-- ==========================================================
-- 2. DEPARTMENTS
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.departments (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);


-- ==========================================================
-- 3. HOLIDAY CALENDARS
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.holiday_calendars (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    country_code text NOT NULL,
    country_name text NOT NULL,
    timezone text NOT NULL DEFAULT 'Asia/Kolkata',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.holidays (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    calendar_id uuid
        REFERENCES public.holiday_calendars(id)
        ON DELETE CASCADE,

    holiday_date date NOT NULL,
    title text NOT NULL,
    is_optional boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),

    UNIQUE(calendar_id, holiday_date)
);


-- ==========================================================
-- 4. PROJECTS & SHIFTS
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    name text NOT NULL,

    client_country text NOT NULL DEFAULT 'India',

    timezone text NOT NULL DEFAULT 'Asia/Kolkata',

    calendar_id uuid
        REFERENCES public.holiday_calendars(id),

    shift_start_time time NOT NULL DEFAULT '09:00:00',

    shift_end_time time NOT NULL DEFAULT '18:00:00',

    grace_period_minutes int DEFAULT 30,

    half_day_cutoff_minutes int DEFAULT 150,

    created_at timestamptz DEFAULT now()
);


-- ==========================================================
-- 5. EMPLOYEES
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.employees (

    -- Primary key
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Supabase Auth user
    user_id uuid
        REFERENCES auth.users(id)
        ON DELETE SET NULL
        UNIQUE,

    -- Business/display ID
    -- Example: TN5000, TN5001
    employee_id text UNIQUE NOT NULL,


    -- ======================================================
    -- PERSONAL INFORMATION
    -- ======================================================

    first_name text NOT NULL,
    last_name text NOT NULL,

    email text UNIQUE NOT NULL,

    phone text,

    date_of_birth date,

    gender text CHECK (
        gender IN (
            'male',
            'female',
            'other'
        )
    ),

    blood_group text,

    marital_status text CHECK (
        marital_status IN (
            'single',
            'married',
            'divorced',
            'widowed'
        )
    ),

    permanent_address text,
    permanent_city text,
    permanent_state text,
    permanent_pincode text,
    temporary_address text,
    temporary_city text,
    temporary_state text,
    temporary_pincode text,

    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relation text,


    -- ======================================================
    -- EMPLOYMENT INFORMATION
    -- ======================================================

    department_id uuid
        REFERENCES public.departments(id),

    project_id uuid
        REFERENCES public.projects(id),

    designation text,

    employment_type text CHECK (
        employment_type IN (
            'full-time',
            'part-time',
            'contract',
            'intern'
        )
    ),

    joining_date date,

    -- Probation duration in months
    probation_duration integer DEFAULT 6,

    probation_end_date date,

    confirmation_date date,

    reporting_manager text,

    work_location text,


    -- ======================================================
    -- SALARY
    -- ======================================================

    salary numeric(12,2) DEFAULT 50000.00,


    -- ======================================================
    -- CLIENT / PROJECT
    -- ======================================================

    client_type text,

    company_name text,


    -- ======================================================
    -- BANK & IDENTITY
    -- ======================================================

    bank_name text,

    bank_account_number text,

    ifsc_code text,

    pan_number text,

    aadhar_number text,

    -- ======================================================
    -- PROFILE
    -- ======================================================

    profile_photo_url text,


    -- ======================================================
    -- EMPLOYEE STATUS
    -- ======================================================

    status text DEFAULT 'active',


    -- ======================================================
    -- STATUTORY
    -- ======================================================

    esi_healthcare_eligible boolean DEFAULT false,
    esi_number text,
    pf_eligible boolean DEFAULT false,
    uan_number text,
    pt_eligible boolean DEFAULT false,
    pt_number text,
    tds_eligible boolean DEFAULT false,

    -- ======================================================
    -- EMPLOYEE EXIT INFORMATION
    -- ======================================================

    exit_reason text,

    exit_document_url text,

    exit_document_name text,

    exit_date date,


    -- ======================================================
    -- TEMPORARY LOGIN
    --
    -- Used for:
    -- pending
    -- probation
    -- resigned
    -- laid_off
    --
    -- HR can decide how many days the employee can
    -- continue logging in after exit.
    --
    -- Maximum allowed: 45 days.
    -- ======================================================

    temporary_login_days integer,

    -- Login is allowed only until this timestamp.
    -- ======================================================

    temporary_login_expires_at timestamptz,


    -- ======================================================
    -- TIMESTAMPS
    -- ======================================================

    created_at timestamptz DEFAULT now(),

    updated_at timestamptz DEFAULT now()
);


-- ==========================================================
-- 5A. EMPLOYEE TABLE SAFETY UPDATES
-- ==========================================================
-- These make the migration safe when employees already exists.
-- ==========================================================

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS project_id uuid;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS probation_duration integer DEFAULT 6;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS probation_end_date date;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS confirmation_date date;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS reporting_manager text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS work_location text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS client_type text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS company_name text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS exit_reason text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS exit_document_url text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS exit_document_name text;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS exit_date date;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS temporary_login_days integer;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS temporary_login_expires_at timestamptz;


-- ==========================================================
-- 5B. EMPLOYEE FOREIGN KEY - USER
-- ==========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employees_user_id_fkey'
    ) THEN

        ALTER TABLE public.employees
        ADD CONSTRAINT employees_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;

    END IF;

EXCEPTION
    WHEN others THEN NULL;
END $$;


-- ==========================================================
-- 5C. EMPLOYEE FOREIGN KEY - PROJECT
-- ==========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employees_project_id_fkey'
    ) THEN

        ALTER TABLE public.employees
        ADD CONSTRAINT employees_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES public.projects(id);

    END IF;

EXCEPTION
    WHEN others THEN NULL;
END $$;


-- ==========================================================
-- 5D. CLIENT TYPE CONSTRAINT
-- ==========================================================

DO $$
BEGIN

    ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS employees_client_type_check;

    ALTER TABLE public.employees
    ADD CONSTRAINT employees_client_type_check
    CHECK (
        client_type IS NULL
        OR client_type IN (
            'in-house',
            'outsource'
        )
    );

EXCEPTION
    WHEN others THEN NULL;
END $$;


-- ==========================================================
-- 5E. EMPLOYEE STATUS CONSTRAINT
-- ==========================================================

DO $$
BEGIN

    ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS employees_status_check;

    ALTER TABLE public.employees
    ADD CONSTRAINT employees_status_check
    CHECK (
        status IN (
            'active',
            'pending',
            'probation',
            'inactive',
            'on_notice',
            'terminated',
            'resigned',
            'laid_off'
        )
    );

EXCEPTION
    WHEN others THEN NULL;
END $$;


-- ==========================================================
-- 5F. EMPLOYEE DEFAULTS
-- ==========================================================

ALTER TABLE public.employees
ALTER COLUMN probation_duration SET DEFAULT 6;

ALTER TABLE public.employees
ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.employees
ALTER COLUMN esi_healthcare_eligible SET DEFAULT false;

ALTER TABLE public.employees
ALTER COLUMN pf_eligible SET DEFAULT false;

ALTER TABLE public.employees
ALTER COLUMN pt_eligible SET DEFAULT false;

ALTER TABLE public.employees
ALTER COLUMN tds_eligible SET DEFAULT false;


-- ==========================================================
-- 5G. TEMPORARY LOGIN DAYS CONSTRAINT
-- ==========================================================

DO $$
BEGIN

    ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS temporary_login_days_limit;

    ALTER TABLE public.employees
    ADD CONSTRAINT temporary_login_days_limit
    CHECK (
        temporary_login_days IS NULL
        OR temporary_login_days BETWEEN 0 AND 45
    );

EXCEPTION
    WHEN others THEN NULL;
END $$;


-- ==========================================================
-- 6. EMPLOYEE DOCUMENTS
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.employee_documents (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    employee_id uuid
        REFERENCES public.employees(id)
        ON DELETE CASCADE,

    document_type text NOT NULL,

    document_name text NOT NULL,

    document_url text NOT NULL,

    cloudinary_public_id text,

    uploaded_at timestamptz DEFAULT now()
);


-- ==========================================================
-- 7. PROFILE CHANGE REQUESTS
-- MAKER-CHECKER WORKFLOW
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.profile_change_requests (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    employee_id uuid
        REFERENCES public.employees(id)
        ON DELETE CASCADE,

    requested_changes jsonb NOT NULL,

    previous_values jsonb,

    status text CHECK (
        status IN (
            'pending',
            'approved',
            'rejected'
        )
    ) DEFAULT 'pending',

    rejection_reason text,

    reviewed_by uuid
        REFERENCES public.profiles(id),

    reviewed_at timestamptz,

    created_at timestamptz DEFAULT now()
);


-- ==========================================================
-- 8. ATTENDANCE LOGS
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.attendance_logs (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    employee_id uuid
        REFERENCES public.employees(id)
        ON DELETE CASCADE,

    attendance_date date NOT NULL,

    check_in_time timestamptz,

    check_out_time timestamptz,

    total_hours numeric(4,2),

    status text CHECK (
        status IN (
            'present',
            'half_day',
            'absent',
            'on_leave',
            'holiday',
            'weekend'
        )
    ) DEFAULT 'present',

    is_late boolean DEFAULT false,

    is_regularized boolean DEFAULT false,

    created_at timestamptz DEFAULT now(),

    UNIQUE(employee_id, attendance_date)
);


-- ==========================================================
-- 9. ATTENDANCE REGULARIZATION
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.attendance_regularizations (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    employee_id uuid
        REFERENCES public.employees(id)
        ON DELETE CASCADE,

    attendance_date date NOT NULL,

    proposed_check_in time NOT NULL,

    proposed_check_out time NOT NULL,

    reason text NOT NULL,

    status text CHECK (
        status IN (
            'pending',
            'approved',
            'rejected'
        )
    ) DEFAULT 'pending',

    rejection_reason text,

    reviewed_by uuid
        REFERENCES public.profiles(id),

    reviewed_at timestamptz,

    created_at timestamptz DEFAULT now()
);


-- ==========================================================
-- 10. LEAVE MANAGEMENT
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.leave_types (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    name text NOT NULL,

    code text UNIQUE NOT NULL,

    annual_quota int DEFAULT 12,

    is_paid boolean DEFAULT true,

    is_active boolean DEFAULT true,

    description text,

    created_at timestamptz DEFAULT now()
);


CREATE TABLE IF NOT EXISTS public.employee_leave_balances (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    employee_id uuid
        REFERENCES public.employees(id)
        ON DELETE CASCADE,

    leave_type_id uuid
        REFERENCES public.leave_types(id)
        ON DELETE CASCADE,

    year int NOT NULL,

    allocated_days numeric(4,1) NOT NULL,

    used_days numeric(4,1) DEFAULT 0,

    balance_days numeric(4,1) NOT NULL,

    created_at timestamptz DEFAULT now(),

    UNIQUE(employee_id, leave_type_id, year)
);


CREATE TABLE IF NOT EXISTS public.leave_requests (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    employee_id uuid
        REFERENCES public.employees(id)
        ON DELETE CASCADE,

    leave_type_id uuid
        REFERENCES public.leave_types(id)
        ON DELETE CASCADE,

    start_date date NOT NULL,

    end_date date NOT NULL,

    total_days numeric(4,1) NOT NULL,

    is_half_day boolean DEFAULT false,

    reason text,

    status text CHECK (
        status IN (
            'pending',
            'approved',
            'rejected',
            'cancelled'
        )
    ) DEFAULT 'pending',

    rejection_reason text,

    reviewed_by uuid
        REFERENCES public.profiles(id),

    reviewed_at timestamptz,

    created_at timestamptz DEFAULT now()
);


-- ==========================================================
-- 11. PAYROLL & PAYSLIPS
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.salary_components (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    name text NOT NULL,

    code text UNIQUE NOT NULL,

    type text CHECK (
        type IN (
            'earning',
            'deduction'
        )
    ) NOT NULL,

    calculation_type text CHECK (
        calculation_type IN (
            'fixed',
            'percentage_of_basic',
            'percentage_of_gross'
        )
    ) NOT NULL,

    value numeric(10,2) NOT NULL,

    affects_lop boolean DEFAULT true,

    is_active boolean DEFAULT true,

    is_statutory boolean DEFAULT false,

    description text,

    created_at timestamptz DEFAULT now()
);


CREATE TABLE IF NOT EXISTS public.payslips (

    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

    employee_id uuid
        REFERENCES public.employees(id)
        ON DELETE CASCADE,

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

    payment_status text CHECK (
        payment_status IN (
            'draft',
            'processed',
            'paid'
        )
    ) DEFAULT 'processed',

    created_at timestamptz DEFAULT now(),

    UNIQUE(
        employee_id,
        payroll_month,
        payroll_year
    )
);


-- ==========================================================
-- 12. ROW LEVEL SECURITY
-- ==========================================================

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


-- ==========================================================
-- 12A. CORE READ POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Allow authenticated read profiles"
ON public.profiles;

CREATE POLICY "Allow authenticated read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);


DROP POLICY IF EXISTS "Allow authenticated read departments"
ON public.departments;

CREATE POLICY "Allow authenticated read departments"
ON public.departments
FOR SELECT
TO authenticated
USING (true);


DROP POLICY IF EXISTS "Allow authenticated read projects"
ON public.projects;

CREATE POLICY "Allow authenticated read projects"
ON public.projects
FOR SELECT
TO authenticated
USING (true);


DROP POLICY IF EXISTS "Allow authenticated read holiday_calendars"
ON public.holiday_calendars;

CREATE POLICY "Allow authenticated read holiday_calendars"
ON public.holiday_calendars
FOR SELECT
TO authenticated
USING (true);


DROP POLICY IF EXISTS "Allow authenticated read holidays"
ON public.holidays;

CREATE POLICY "Allow authenticated read holidays"
ON public.holidays
FOR SELECT
TO authenticated
USING (true);


DROP POLICY IF EXISTS "Allow authenticated read leave_types"
ON public.leave_types;

CREATE POLICY "Allow authenticated read leave_types"
ON public.leave_types
FOR SELECT
TO authenticated
USING (true);


DROP POLICY IF EXISTS "Allow authenticated read salary_components"
ON public.salary_components;

CREATE POLICY "Allow authenticated read salary_components"
ON public.salary_components
FOR SELECT
TO authenticated
USING (true);


-- ==========================================================
-- 12B. EMPLOYEE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Employees select policy"
ON public.employees;

CREATE POLICY "Employees select policy"
ON public.employees
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


DROP POLICY IF EXISTS "Employees update policy"
ON public.employees;

CREATE POLICY "Employees update policy"
ON public.employees
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


DROP POLICY IF EXISTS "Employees insert policy"
ON public.employees;

CREATE POLICY "Employees insert policy"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


-- ==========================================================
-- 12C. ATTENDANCE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Attendance select policy"
ON public.attendance_logs;

CREATE POLICY "Attendance select policy"
ON public.attendance_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = attendance_logs.employee_id
        AND employees.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


DROP POLICY IF EXISTS "Attendance insert policy"
ON public.attendance_logs;

CREATE POLICY "Attendance insert policy"
ON public.attendance_logs
FOR INSERT
TO authenticated
WITH CHECK (true);


DROP POLICY IF EXISTS "Attendance update policy"
ON public.attendance_logs;

CREATE POLICY "Attendance update policy"
ON public.attendance_logs
FOR UPDATE
TO authenticated
USING (true);


-- ==========================================================
-- 12D. PAYSLIP POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Payslips select policy"
ON public.payslips;

CREATE POLICY "Payslips select policy"
ON public.payslips
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = payslips.employee_id
        AND employees.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


-- ==========================================================
-- 12E. LEAVE BALANCE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Leave balances select policy"
ON public.employee_leave_balances;

CREATE POLICY "Leave balances select policy"
ON public.employee_leave_balances
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = employee_leave_balances.employee_id
        AND employees.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


-- ==========================================================
-- 12F. LEAVE REQUEST POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Leave requests select policy"
ON public.leave_requests;

CREATE POLICY "Leave requests select policy"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = leave_requests.employee_id
        AND employees.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


DROP POLICY IF EXISTS "Leave requests insert policy"
ON public.leave_requests;

CREATE POLICY "Leave requests insert policy"
ON public.leave_requests
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = leave_requests.employee_id
        AND employees.user_id = auth.uid()
    )
);


DROP POLICY IF EXISTS "Leave requests update policy"
ON public.leave_requests;

CREATE POLICY "Leave requests update policy"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = leave_requests.employee_id
        AND employees.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


-- ==========================================================
-- 12G. EMPLOYEE DOCUMENT POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Employee documents select policy"
ON public.employee_documents;

CREATE POLICY "Employee documents select policy"
ON public.employee_documents
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = employee_documents.employee_id
        AND employees.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


-- ==========================================================
-- 12H. REGULARIZATION POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Regularization select policy"
ON public.attendance_regularizations;

CREATE POLICY "Regularization select policy"
ON public.attendance_regularizations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = attendance_regularizations.employee_id
        AND employees.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


DROP POLICY IF EXISTS "Regularization insert policy"
ON public.attendance_regularizations;

CREATE POLICY "Regularization insert policy"
ON public.attendance_regularizations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = attendance_regularizations.employee_id
        AND employees.user_id = auth.uid()
    )
);


-- ==========================================================
-- 12I. PROFILE CHANGE REQUEST POLICIES
-- ==========================================================

DROP POLICY IF EXISTS "Profile change requests select policy"
ON public.profile_change_requests;

CREATE POLICY "Profile change requests select policy"
ON public.profile_change_requests
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.employees
        WHERE employees.id = profile_change_requests.employee_id
        AND employees.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


-- ==========================================================
-- 12J. API ROLE GRANTS
-- ==========================================================

GRANT USAGE
ON SCHEMA public
TO anon, authenticated, service_role;


GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO anon, authenticated, service_role;


GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA public
TO anon, authenticated, service_role;


GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
TO anon, authenticated, service_role;


ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO anon, authenticated, service_role;


ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE
ON SEQUENCES
TO anon, authenticated, service_role;


ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE
ON FUNCTIONS
TO anon, authenticated, service_role;


-- ==========================================================
-- 13. SEED DEPARTMENTS
-- ==========================================================

INSERT INTO public.departments
(
    name,
    description
)
VALUES
    (
        'Engineering',
        'Software development and engineering'
    ),
    (
        'Design',
        'UI/UX and product design'
    ),
    (
        'Marketing',
        'Marketing and communications'
    ),
    (
        'Sales',
        'Sales and business development'
    ),
    (
        'HR',
        'Human Resources and Operations'
    ),
    (
        'Finance',
        'Finance and Accounting'
    ),
    (
        'Operations',
        'Business operations'
    )
ON CONFLICT (name) DO NOTHING;


-- ==========================================================
-- 14. SEED LEAVE TYPES
-- ==========================================================

INSERT INTO public.leave_types
(
    name,
    code,
    annual_quota,
    is_paid,
    is_active,
    description
)
VALUES
    (
        'Casual Leave',
        'CL',
        12,
        true,
        true,
        'Paid casual leave for personal work'
    ),
    (
        'Sick Leave',
        'SL',
        10,
        true,
        true,
        'Paid sick leave for medical recovery'
    ),
    (
        'Earned Leave',
        'EL',
        15,
        true,
        true,
        'Paid privilege/earned leave'
    ),
    (
        'Loss of Pay',
        'LOP',
        0,
        false,
        true,
        'Unpaid leave that triggers per-day salary deduction'
    )
ON CONFLICT (code) DO NOTHING;


-- ==========================================================
-- 15. SEED SALARY COMPONENTS
-- ==========================================================

INSERT INTO public.salary_components
(
    name,
    code,
    type,
    calculation_type,
    value,
    affects_lop,
    is_active,
    is_statutory,
    description
)
VALUES
    (
        'Basic Salary',
        'BASIC',
        'earning',
        'percentage_of_gross',
        50.00,
        true,
        true,
        true,
        '50% of Gross CTC'
    ),
    (
        'House Rent Allowance (HRA)',
        'HRA',
        'earning',
        'percentage_of_basic',
        40.00,
        true,
        true,
        true,
        '40% of Basic Pay'
    ),
    (
        'Special Allowance',
        'SPECIAL_ALLOWANCE',
        'earning',
        'fixed',
        0.00,
        true,
        true,
        false,
        'Balancing allowance of Gross Salary'
    ),
    (
        'Provident Fund (PF)',
        'PF',
        'deduction',
        'percentage_of_basic',
        12.00,
        false,
        true,
        true,
        '12% of Basic Pay'
    ),
    (
        'Employee State Insurance (ESI)',
        'ESI',
        'deduction',
        'percentage_of_gross',
        0.75,
        false,
        true,
        true,
        '0.75% of Gross if Gross <= ₹21,000'
    ),
    (
        'Professional Tax (PT)',
        'PT',
        'deduction',
        'fixed',
        200.00,
        false,
        true,
        true,
        'State statutory professional tax'
    ),
    (
        'Tax Deducted at Source (TDS)',
        'TDS',
        'deduction',
        'percentage_of_gross',
        5.00,
        false,
        false,
        true,
        'Estimated income tax'
    )
ON CONFLICT (code) DO NOTHING;


-- ==========================================================
-- 16. UPDATED_AT TRIGGER
-- ==========================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN

    NEW.updated_at = now();

    RETURN NEW;

END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS update_profiles_updated_at
ON public.profiles;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


DROP TRIGGER IF EXISTS update_employees_updated_at
ON public.employees;

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ==========================================================
-- 17. NEW USER -> PROFILE TRIGGER
-- ==========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN

    INSERT INTO public.profiles
    (
        id,
        email,
        full_name,
        role
    )
    VALUES
    (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'role',
            'employee'
        )
    )

    ON CONFLICT (id)
    DO UPDATE SET

        email = EXCLUDED.email,

        full_name = EXCLUDED.full_name,

        role = EXCLUDED.role;

    RETURN NEW;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;


CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- ==========================================================
-- 18. OPTIONAL: INITIAL 45-DAY LOGIN PERIOD
-- ==========================================================
-- Use this ONLY for existing employees already in
-- pending/probation/resigned/laid_off status.
--
-- New employees should have this value assigned by
-- the application when appropriate.
-- ==========================================================

-- UPDATE public.employees
-- SET
--     temporary_login_days = 45,
--     temporary_login_expires_at = NOW() + INTERVAL '45 days'
-- WHERE LOWER(status) IN (
--     'pending',
--     'probation',
--     'resigned',
--     'laid_off'
-- )
-- AND temporary_login_expires_at IS NULL;


-- ==========================================================
-- 19. FINAL EMPLOYEE SCHEMA CHECK
-- ==========================================================

SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'employees'
ORDER BY ordinal_position;

-- ==========================================================
-- 20. EMPLOYEE EXIT DOCUMENT STORAGE
-- ==========================================================
-- Exit documents are stored in a private Supabase Storage bucket.
-- The application stores the Storage object path in
-- employees.exit_document_url.
-- ==========================================================

INSERT INTO storage.buckets (
    id,
    name,
    public
)
VALUES (
    'employee-exit-documents',
    'employee-exit-documents',
    false
)
ON CONFLICT (id) DO NOTHING;


-- ==========================================================
-- 20A. EXIT DOCUMENT STORAGE - VIEW POLICY
-- ==========================================================

DROP POLICY IF EXISTS "HR can view exit documents"
ON storage.objects;

CREATE POLICY "HR can view exit documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'employee-exit-documents'
    AND EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


-- ==========================================================
-- 20B. EXIT DOCUMENT STORAGE - UPLOAD POLICY
-- ==========================================================

DROP POLICY IF EXISTS "HR can upload exit documents"
ON storage.objects;

CREATE POLICY "HR can upload exit documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'employee-exit-documents'
    AND EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);


-- ==========================================================
-- 20C. EXIT DOCUMENT STORAGE - DELETE POLICY
-- ==========================================================

DROP POLICY IF EXISTS "HR can delete exit documents"
ON storage.objects;

CREATE POLICY "HR can delete exit documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'employee-exit-documents'
    AND EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ceo', 'hr')
    )
);