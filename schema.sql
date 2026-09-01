-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text NOT NULL,
    full_name text,
    role text CHECK (role IN ('ceo', 'hr')) DEFAULT 'hr',
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
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
    designation text,
    employment_type text CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'intern')),
    joining_date date,
    probation_end_date date,
    confirmation_date date,
    reporting_manager text,
    work_location text,
    salary numeric(12,2),
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

-- Create employee_documents table
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    document_type text NOT NULL,
    document_name text NOT NULL,
    document_url text NOT NULL,
    cloudinary_public_id text,
    uploaded_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Authenticated users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read departments" ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can select employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update employees" ON public.employees FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select documents" ON public.employee_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert documents" ON public.employee_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete documents" ON public.employee_documents FOR DELETE TO authenticated USING (true);

-- Seed departments
INSERT INTO public.departments (name, description) VALUES
    ('Engineering', 'Software development and engineering'),
    ('Design', 'UI/UX and product design'),
    ('Marketing', 'Marketing and communications'),
    ('Sales', 'Sales and business development'),
    ('HR', 'Human Resources and Operations'),
    ('Finance', 'Finance and Accounting'),
    ('Operations', 'Business operations')
ON CONFLICT (name) DO NOTHING;

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'hr')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when auth.users is populated
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
