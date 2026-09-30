
-- PostgreSQL database dump
--

\restrict VjjdAGVG44qD6K3j1yN6eno8LrhgqfhycbZca4b8G9CpdvAI3dfOmFtGNXpmQfP

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    attendance_date date NOT NULL,
    check_in_time timestamp with time zone,
    check_out_time timestamp with time zone,
    total_hours numeric(4,2),
    status text DEFAULT 'present'::text,
    is_late boolean DEFAULT false,
    is_regularized boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_logs_status_check CHECK ((status = ANY (ARRAY['present'::text, 'half_day'::text, 'absent'::text, 'on_leave'::text, 'holiday'::text, 'weekend'::text])))
);


--
-- Name: attendance_regularizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_regularizations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    attendance_date date NOT NULL,
    proposed_check_in time without time zone NOT NULL,
    proposed_check_out time without time zone NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_regularizations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    document_type text NOT NULL,
    document_name text NOT NULL,
    document_url text NOT NULL,
    cloudinary_public_id text,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_leave_balances (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    leave_type_id uuid,
    year integer NOT NULL,
    allocated_days numeric(4,1) NOT NULL,
    used_days numeric(4,1) DEFAULT 0,
    balance_days numeric(4,1) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    employee_id text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    date_of_birth date,
    gender text,
    blood_group text,
    marital_status text,
    address text,
    city text,
    state text,
    pincode text,
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relation text,
    department_id uuid,
    project_id uuid,
    designation text,
    employment_type text,
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
    esi_number text,
    profile_photo_url text,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    exit_reason text,
    exit_document_url text,
    exit_document_name text,
    exit_date date,
    esi_healthcare_eligible boolean DEFAULT false,
    pf_eligible boolean DEFAULT false,
    pt_eligible boolean DEFAULT false,
    pt_number text,
    tds_eligible boolean DEFAULT false,
    client_type text,
    company_name text,
    temporary_login_expires_at timestamp with time zone,
    probation_duration integer DEFAULT 6,
    permanent_address text,
    permanent_city text,
    permanent_state text,
    permanent_pincode text,
    temporary_address text,
    temporary_city text,
    temporary_state text,
    temporary_pincode text,
    esi_eligible boolean DEFAULT false,
    uan_number text,
    CONSTRAINT employees_employment_type_check CHECK ((employment_type = ANY (ARRAY['full-time'::text, 'part-time'::text, 'contract'::text, 'intern'::text]))),
    CONSTRAINT employees_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
    CONSTRAINT employees_marital_status_check CHECK ((marital_status = ANY (ARRAY['single'::text, 'married'::text, 'divorced'::text, 'widowed'::text]))),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'terminated'::text, 'resigned'::text, 'laid_off'::text, 'on_notice'::text])))
);


--
-- Name: holiday_calendars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holiday_calendars (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    country_code text NOT NULL,
    country_name text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    calendar_id uuid,
    holiday_date date NOT NULL,
    title text NOT NULL,
    is_optional boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    leave_type_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(4,1) NOT NULL,
    is_half_day boolean DEFAULT false,
    reason text,
    status text DEFAULT 'pending'::text,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_types (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    annual_quota integer DEFAULT 12,
    is_paid boolean DEFAULT true,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payslips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payslips (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    payroll_month integer NOT NULL,
    payroll_year integer NOT NULL,
    month_name text NOT NULL,
    working_days integer NOT NULL,
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
    payment_status text DEFAULT 'processed'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payslips_payment_status_check CHECK ((payment_status = ANY (ARRAY['draft'::text, 'processed'::text, 'paid'::text])))
);


--
-- Name: profile_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_change_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    requested_changes jsonb NOT NULL,
    previous_values jsonb,
    status text DEFAULT 'pending'::text,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profile_change_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'employee'::text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['ceo'::text, 'hr'::text, 'employee'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    client_country text DEFAULT 'India'::text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    calendar_id uuid,
    shift_start_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    shift_end_time time without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    grace_period_minutes integer DEFAULT 30,
    half_day_cutoff_minutes integer DEFAULT 150,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: salary_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_components (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    calculation_type text NOT NULL,
    value numeric(10,2) NOT NULL,
    affects_lop boolean DEFAULT true,
    is_active boolean DEFAULT true,
    is_statutory boolean DEFAULT false,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT salary_components_calculation_type_check CHECK ((calculation_type = ANY (ARRAY['fixed'::text, 'percentage_of_basic'::text, 'percentage_of_gross'::text]))),
    CONSTRAINT salary_components_type_check CHECK ((type = ANY (ARRAY['earning'::text, 'deduction'::text])))
);


--
-- Data for Name: attendance_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attendance_logs (id, employee_id, attendance_date, check_in_time, check_out_time, total_hours, status, is_late, is_regularized, created_at) FROM stdin;
b013e155-92db-4a0c-a47a-dec494fc4a13	8c3a0293-ec27-4a43-9054-c8fb0e046897	2026-09-25	2026-09-25 05:34:39.641+00	\N	\N	present	t	f	2026-09-25 05:34:40.134987+00
7f38669c-0e66-4201-9a54-4dd7918cb6e1	f8a274aa-c7bb-4362-93dc-9485421ddeee	2026-09-25	2026-09-25 05:37:14.305+00	\N	\N	present	t	f	2026-09-25 05:37:14.682414+00
bf81c909-f6c2-40fc-a42b-6d7229f42cc3	9fad7c0c-25ce-43de-8e58-6b8ddc9af3ed	2026-09-25	2026-09-25 05:37:42.018+00	\N	\N	present	t	f	2026-09-25 05:37:42.430539+00
2d7ab081-ba69-430b-b34e-1c449a5d9335	f8a274aa-c7bb-4362-93dc-9485421ddeee	2026-09-28	2026-09-28 04:40:41.359+00	\N	\N	present	t	f	2026-09-28 04:40:41.877419+00
d3814c25-ab5e-4626-a3c3-4c6fee18b7b1	8c3a0293-ec27-4a43-9054-c8fb0e046897	2026-09-29	2026-09-29 05:29:14+00	\N	\N	present	t	f	2026-09-29 05:29:14.623493+00
a9048e11-3376-45f6-9646-eeaaf9c62dbd	f8a274aa-c7bb-4362-93dc-9485421ddeee	2026-09-29	2026-09-29 05:26:00+00	2026-09-29 12:30:00+00	7.07	present	f	t	2026-09-29 05:28:45.969918+00
\.


--
-- Data for Name: attendance_regularizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attendance_regularizations (id, employee_id, attendance_date, proposed_check_in, proposed_check_out, reason, status, rejection_reason, reviewed_by, reviewed_at, created_at) FROM stdin;
3f027c2e-5caa-4275-b203-55fd151f894e	f8a274aa-c7bb-4362-93dc-9485421ddeee	2026-09-29	10:56:00	18:00:00	Forget to punch	approved	\N	061a242e-4122-42d3-afa7-682a01567c1e	2026-09-29 05:45:33.162+00	2026-09-29 05:45:15.662281+00
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, description, created_at) FROM stdin;
4ceac570-f1af-41ca-b6ee-0fc2a47122e1	Engineering	Software development and engineering	2026-09-23 04:32:29.202398+00
9be50f8b-2a17-496c-8087-cc57db07a45b	Design	UI/UX and product design	2026-09-23 04:32:29.202398+00
b05f2972-c6f3-4d1c-b1f5-306695d20444	Marketing	Marketing and communications	2026-09-23 04:32:29.202398+00
69a13ece-776b-468d-8d38-78f4f70787d4	Sales	Sales and business development	2026-09-23 04:32:29.202398+00
3b9bc885-f746-4297-906b-a47b609edc25	HR	Human Resources and Operations	2026-09-23 04:32:29.202398+00
227fc40c-0312-474d-a7b3-9a4ff71dd393	Finance	Finance and Accounting	2026-09-23 04:32:29.202398+00
60ca3082-09de-468a-b8b1-8edc17067ef7	Operations	Business operations	2026-09-23 04:32:29.202398+00
\.


--
-- Data for Name: employee_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_documents (id, employee_id, document_type, document_name, document_url, cloudinary_public_id, uploaded_at) FROM stdin;
\.


--
-- Data for Name: employee_leave_balances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_leave_balances (id, employee_id, leave_type_id, year, allocated_days, used_days, balance_days, created_at) FROM stdin;
19e9dc80-1487-47a6-869d-55e016d18512	f8a274aa-c7bb-4362-93dc-9485421ddeee	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 04:39:13.149082+00
596c5e36-88bf-41e2-9a42-8d1a7eeb037d	b2a6d845-ede3-4aae-a421-83f8e3469c41	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 06:07:12.866504+00
fbbcf327-c6ea-4e86-95a2-34b451e47906	94f89f64-1854-494d-a39b-8cdbb54433b3	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 06:50:37.441734+00
4db5c7de-38ec-4047-9272-0d5e3775212e	c0ca0e8c-4444-4758-80b1-ce9b832330e0	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 07:10:42.440713+00
769acca9-9d38-4858-80f0-2ca15c30f31a	3b99425c-0761-4e23-bdb1-262d75153353	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 07:26:25.838139+00
247e9f2d-34db-45ef-897d-633b92639958	9db13f20-4b1d-4046-a075-2954eb4d3c34	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:28.033817+00
b7049ebf-20cd-4907-803e-c7e071f84c4b	b5f0db0a-ee13-4560-8287-400bc41072d5	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:28.051737+00
d93b7f1a-4038-4101-a621-e6fb08bb6ed7	3a07b7cb-1f05-4f6d-be2f-cda1dfcedb39	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:27.821892+00
ad07c285-9524-4f0b-b58e-66a1d5863a13	0d2fcc6a-a526-40ee-835d-8e661a0c1c1a	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:27.837133+00
ffc614a2-ad9d-4cdb-87e2-44e0738ff797	683b39c8-d154-4cb2-be05-e7c65022fea9	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:27.898751+00
ef7019de-08e7-4b24-855c-1cfb57d5dd97	8c3a0293-ec27-4a43-9054-c8fb0e046897	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:27.99939+00
bf78ca95-afee-45a0-a053-9f30edd82acc	9fad7c0c-25ce-43de-8e58-6b8ddc9af3ed	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:27.98836+00
8d9e2a42-2e46-42c1-a4b9-e7e18a05b1df	35e224fb-b8b2-4e3a-9333-4b2f0636856c	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:27.913735+00
2e298d3d-53a0-4896-aa2a-caa670c666d0	a14149d1-d447-4930-a578-1391a75d511a	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:27.916438+00
3b454cb5-c212-4763-80c2-b9b98d9d46cb	6727fa5c-d66d-422b-a1d5-726e1b56fb24	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:28.016691+00
ca2ccb4c-2cda-4cdf-9544-7e42811deff1	40617767-0792-4fff-a82c-639642a7eb0e	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-28 10:56:27.879859+00
83261c44-f037-4b77-8639-941f5d573429	7c069fb5-59a2-4105-887a-688e85ded5be	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026	10.0	0.0	10.0	2026-09-29 09:30:04.160965+00
d64f9515-1c5e-4f63-a4a7-caa37abe0a22	3b99425c-0761-4e23-bdb1-262d75153353	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 07:26:25.838139+00
8feca3af-612e-49de-a85d-6a00aca2c280	9db13f20-4b1d-4046-a075-2954eb4d3c34	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:28.033817+00
9e9effc7-a686-45f8-a1cf-84beadadeecf	c0ca0e8c-4444-4758-80b1-ce9b832330e0	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 07:10:42.440713+00
87a99803-022b-4686-b9c9-5ecd22f9b7c8	a14149d1-d447-4930-a578-1391a75d511a	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:27.916438+00
a9b57a42-951a-43fe-9d44-9073c70da196	683b39c8-d154-4cb2-be05-e7c65022fea9	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:27.898751+00
a94bb4cf-566d-4293-9042-528ed67aa359	7c069fb5-59a2-4105-887a-688e85ded5be	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-29 09:30:04.160965+00
041872a3-09ca-4d9d-b67b-43ba371c7305	9fad7c0c-25ce-43de-8e58-6b8ddc9af3ed	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:27.98836+00
20313e9d-11b8-4238-bcbc-3263e6287f25	3a07b7cb-1f05-4f6d-be2f-cda1dfcedb39	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:27.821892+00
b85a0485-3967-4e5f-bfe2-a8095db1d5b9	94f89f64-1854-494d-a39b-8cdbb54433b3	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 06:50:37.441734+00
bc05ee2f-b3ad-4124-87d1-3f0a188de502	f8a274aa-c7bb-4362-93dc-9485421ddeee	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 04:39:13.149082+00
60d1f981-9480-4e9f-9732-57245ef667b5	b2a6d845-ede3-4aae-a421-83f8e3469c41	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 06:07:12.866504+00
416db9d6-06fc-46bd-94e8-2f59a6986926	b5f0db0a-ee13-4560-8287-400bc41072d5	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:28.051737+00
748c1b85-c228-46ab-978f-c9a7a83391de	0d2fcc6a-a526-40ee-835d-8e661a0c1c1a	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:27.837133+00
ca4af42d-1559-4613-9770-052dffcc9760	6727fa5c-d66d-422b-a1d5-726e1b56fb24	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:28.016691+00
da01b8c7-ac32-46d2-b6cf-bcf50b9d2873	40617767-0792-4fff-a82c-639642a7eb0e	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:27.879859+00
d2d273bf-b100-48bf-b4b2-df8067af5e2e	35e224fb-b8b2-4e3a-9333-4b2f0636856c	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:27.913735+00
813fcf49-4d8e-4f74-9002-783312c50d5b	8c3a0293-ec27-4a43-9054-c8fb0e046897	ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	2026	15.0	0.0	15.0	2026-09-28 10:56:27.99939+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, user_id, employee_id, first_name, last_name, email, phone, date_of_birth, gender, blood_group, marital_status, address, city, state, pincode, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, department_id, project_id, designation, employment_type, joining_date, probation_end_date, confirmation_date, reporting_manager, work_location, salary, bank_name, bank_account_number, ifsc_code, pan_number, aadhar_number, esi_number, profile_photo_url, status, notes, created_at, updated_at, exit_reason, exit_document_url, exit_document_name, exit_date, esi_healthcare_eligible, pf_eligible, pt_eligible, pt_number, tds_eligible, client_type, company_name, temporary_login_expires_at, probation_duration, permanent_address, permanent_city, permanent_state, permanent_pincode, temporary_address, temporary_city, temporary_state, temporary_pincode, esi_eligible, uan_number) FROM stdin;
683b39c8-d154-4cb2-be05-e7c65022fea9	c0d52025-f0c7-4cf4-9b9b-01aa461c366c	TN5003	y	Dontha	donth@gmail.com	09290649809	2026-09-18	male	B+	single	777 GLADE ROAd\nNandha nagar	boca raton		33431	bhaskar Dontha	06309487952		4ceac570-f1af-41ca-b6ee-0fc2a47122e1	\N	Frontend	full-time	2026-09-12	2026-09-19	2026-09-04	\N	ofice	50000.00	HDFC Bank	50100234567890	HDFC0001234	ABCDE1234F	1234 5678 9012	\N	\N	active	\N	2026-09-23 06:52:08.024+00	2026-09-23 07:16:27.160887+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
40617767-0792-4fff-a82c-639642a7eb0e	e1fb9d49-4218-4f66-96e1-3f003db52d8d	TN5004	Hds	Dontha	bhaskar55624@gmail.com	9290649809	2003-07-02	male	B-	single	\N	\N	\N	\N	\N	\N	\N	227fc40c-0312-474d-a7b3-9a4ff71dd393	\N	Frontend	full-time	2026-09-03	2026-09-25	2026-08-12	\N	ofice	13.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-23 08:56:48.901+00	2026-09-23 08:56:48.901+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
3a07b7cb-1f05-4f6d-be2f-cda1dfcedb39	eda2051c-b63c-4d9b-bc34-1b8d28c525dd	TN5005	Yagnesh	.D	yag@gmail.com	9290649809	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3b9bc885-f746-4297-906b-a47b609edc25	\N	Frontend	part-time	2026-09-03	2026-09-10	2026-09-01	\N	ofc	150000.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-23 11:26:32.067+00	2026-09-23 11:26:32.067+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
b5f0db0a-ee13-4560-8287-400bc41072d5	45b9208d-f89f-4a12-8746-377e64704e9f	TN5006	bhaskar	Dontha	donth55624@gmail.com	9290649809	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4ceac570-f1af-41ca-b6ee-0fc2a47122e1	\N	Frontend	full-time	2026-08-06	2026-09-04	2026-08-05	\N	ofc	1500000.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-23 12:21:17.145+00	2026-09-23 12:21:17.145+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
3b99425c-0761-4e23-bdb1-262d75153353	93929068-b90f-49fe-8c15-59b965d64ee3	TN5015	Rani	s	rani.s@teenss.com	6309487952	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4ceac570-f1af-41ca-b6ee-0fc2a47122e1	\N	Front	full-time	2026-09-10	2027-03-10	\N	\N	Onsite	34.00	\N	\N	\N	\N	\N	\N	\N	laid_off	\N	2026-09-28 07:26:24.745+00	2026-09-29 06:24:54.672462+00	No Projects	3b99425c-0761-4e23-bdb1-262d75153353/c83c6d65-e160-4a01-9207-8fda8ea0f379.html	idx.html	2026-08-27	f	f	f	\N	f	outsource	Wipro	2026-11-13 06:24:54.672462+00	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
6727fa5c-d66d-422b-a1d5-726e1b56fb24	9fcc74d0-0d3a-46ef-a840-ea60a8149d5e	TN5008	Yagnesh	Dontha	yagneshdontha@teenss.com	06309487952	2026-09-19	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9be50f8b-2a17-496c-8087-cc57db07a45b	608c6982-7547-4a6f-8717-bdf6480b7652	Frontend	full-time	2026-09-11	2027-06-11	\N	\N	ofc	123456.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-24 09:58:58.93+00	2026-09-24 09:58:58.93+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
0d2fcc6a-a526-40ee-835d-8e661a0c1c1a	a8bbfd41-dd41-4bab-97a1-420c8af08684	TN5009	bhaskar	Dontha	bhaskar.d@teenss.com	9290649809	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4ceac570-f1af-41ca-b6ee-0fc2a47122e1	cc09f5bb-9c95-432a-b75d-0ba0c7776fe7	na	contract	2026-09-10	2027-03-10	\N	\N	ofc	1234567.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-24 10:37:29.535+00	2026-09-24 10:37:29.535+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
35e224fb-b8b2-4e3a-9333-4b2f0636856c	5b942059-389e-40f8-ba72-ccaf082bedae	TN5010	bhaskar	Dontha	bhaskard@teenss.com	09290649809	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4ceac570-f1af-41ca-b6ee-0fc2a47122e1	cc09f5bb-9c95-432a-b75d-0ba0c7776fe7	Frontend	contract	2026-09-02	2026-12-02	\N	\N	ofc	1234.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-24 10:39:11.012+00	2026-09-24 10:39:11.012+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
9db13f20-4b1d-4046-a075-2954eb4d3c34	a831f0b1-7956-4444-af90-ba6599048c7e	TN5011	Yagnesh	Dontha	yagnesh.d@teenss.com	06309487952	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	227fc40c-0312-474d-a7b3-9a4ff71dd393	cc09f5bb-9c95-432a-b75d-0ba0c7776fe7	Frontend	full-time	2026-09-12	2027-03-12	\N	\N	ofc	12378.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-25 04:15:22.836+00	2026-09-25 04:15:22.836+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
8c3a0293-ec27-4a43-9054-c8fb0e046897	a87f5eb2-7f52-496e-a18f-b6e965948701	TN5007	Yagnesh	Dontha	yagnesh00d@gmail.com	06309487952	\N	\N	B+	single	49-285/B,4th Street left , afcons prestige apartment ,flat:107\nPadmanagar -1, Chintal	Hyderabad		500037	Yagnesh Dontha	06309487952		4ceac570-f1af-41ca-b6ee-0fc2a47122e1	\N	Frontend	part-time	2026-09-18	2026-09-09	2026-09-02	\N	ofc	12345.00	HDFC Bank	50100234567890	HDFC0001234	ABCDE1234F	1234 5678 9012	\N	\N	active	\N	2026-09-23 12:23:17.689+00	2026-09-25 07:17:34.894+00	\N	\N	\N	\N	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
9fad7c0c-25ce-43de-8e58-6b8ddc9af3ed	fe2cd562-5396-4eb2-bef2-152c814aa46a	TN5002	Yagnesh	Dontha	donthabhaskar55624@gmail.com	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	full-time	2026-09-23	\N	\N	\N	\N	50000.00	\N	\N	\N	\N	\N	\N	\N	terminated	\N	2026-09-23 06:45:53.216+00	2026-09-28 09:43:23.645378+00	Not coming at a time	9fad7c0c-25ce-43de-8e58-6b8ddc9af3ed/2776532e-99a0-480f-bef6-9e796ee50bcb.html	index.html	2026-09-19	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
f8a274aa-c7bb-4362-93dc-9485421ddeee	bc65a665-7121-4064-9feb-95babd69dc64	TN5000	Yagnesh	Dontha	yagnesh007d@gmail.com	06309487952	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	full-time	2026-09-23	\N	\N	\N	\N	50000.00	\N	\N	\N	\N	\N	\N	\N	resigned	\N	2026-09-23 06:31:33.192+00	2026-09-29 06:24:54.672462+00	Moved to MNC	f8a274aa-c7bb-4362-93dc-9485421ddeee/f6572849-ebf2-4113-9c40-55d0a01c3cc8.html	main.html	2026-09-17	f	f	f	\N	f	\N	\N	2026-11-13 06:24:54.672462+00	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
a14149d1-d447-4930-a578-1391a75d511a	dcab29d2-fcc4-463d-9291-42fd713fab86	TN5001	Yagnesh	Dontha	d@gmail.com	6309487952	2026-09-10	female	A-	single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	full-time	2026-09-23	\N	\N	\N	\N	50000.00	\N	\N	\N	\N	\N	\N	\N	laid_off	\N	2026-09-23 06:39:22.457+00	2026-09-29 06:24:54.672462+00	Not done the job	a14149d1-d447-4930-a578-1391a75d511a/6025f92b-c140-4027-ab8f-82c994709805.html	idx.html	2026-09-10	f	f	f	\N	f	\N	\N	2026-11-13 06:24:54.672462+00	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
94f89f64-1854-494d-a39b-8cdbb54433b3	b0284575-a9fa-4c49-b40f-64547001561e	TN5013	Rrsni	A	rrsni.a@teenss.com	6309487952	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	227fc40c-0312-474d-a7b3-9a4ff71dd393	\N	Finacla	full-time	2026-09-01	2027-03-01	\N	\N	Hybrid	18.00	\N	\N	\N	\N	\N	\N	\N	resigned	\N	2026-09-28 06:50:36.225+00	2026-09-29 06:27:29.226619+00	No Project are there.	94f89f64-1854-494d-a39b-8cdbb54433b3/77b59838-31e5-4de8-8683-5b209bf2f1a5.html	inx.html	2026-09-20	f	f	f	\N	f	\N	\N	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
c0ca0e8c-4444-4758-80b1-ce9b832330e0	0b73fc5c-f65e-44cb-8e89-92b7515e06d7	TN5014	Rsd	Dontha	Rsd.d@teenss.com	9290649809	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4ceac570-f1af-41ca-b6ee-0fc2a47122e1	\N	Front	full-time	2026-09-02	2026-12-02	\N	\N	Onsite	34.00	\N	\N	\N	\N	\N	\N	\N	laid_off	\N	2026-09-28 07:10:41.494+00	2026-09-29 06:53:17.496565+00	No salary	c0ca0e8c-4444-4758-80b1-ce9b832330e0/9e753847-e209-4a21-a473-da15be932171.html	index.html	2026-09-22	f	f	f	\N	f	\N	\N	2026-11-13 06:53:17.029+00	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
b2a6d845-ede3-4aae-a421-83f8e3469c41	d360e23b-1a0c-4592-98a0-fe3ff8b22a4a	TN5012	Raja	h	raja.h@teenss.com	09290649809	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4ceac570-f1af-41ca-b6ee-0fc2a47122e1	\N	Backend	full-time	2026-09-04	2027-03-04	\N	\N	Onsite	16.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-28 06:07:11.578+00	2026-09-29 09:27:52.387166+00	\N	\N	\N	\N	f	f	f	\N	f	outsource	Tata Consultancy Services	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
7c069fb5-59a2-4105-887a-688e85ded5be	b6127a52-9033-4d9b-bfbf-4bbba501a39a	TN5016	Ranjaa	D	ranjaa.d@teenss.com	6309487952	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4ceac570-f1af-41ca-b6ee-0fc2a47122e1	\N	UI/UX	part-time	2026-09-09	2026-12-09	\N	\N	Onsite	12.00	\N	\N	\N	\N	\N	\N	\N	active	\N	2026-09-29 09:30:03.147+00	2026-09-29 09:30:03.147+00	\N	\N	\N	\N	f	f	f	\N	f	outsource	Tech Mahindra	\N	6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
\.


--
-- Data for Name: holiday_calendars; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.holiday_calendars (id, name, country_code, country_name, timezone, created_at) FROM stdin;
a72296b2-30f8-4c03-b35e-7aceb334d163	India Standard Holidays 2026	IN	India	Asia/Kolkata	2026-09-24 07:17:37.007669+00
60d3954a-3f36-43ee-bf00-9e2c60778d5d	US Federal Holidays 2026	US	United States	America/New_York	2026-09-24 07:17:37.227328+00
\.


--
-- Data for Name: holidays; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.holidays (id, calendar_id, holiday_date, title, is_optional, created_at) FROM stdin;
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, is_half_day, reason, status, rejection_reason, reviewed_by, reviewed_at, created_at) FROM stdin;
ad976c48-7ff4-4528-8a1c-4a6eb11c3407	8c3a0293-ec27-4a43-9054-c8fb0e046897	a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	2026-08-14	2026-06-25	1.0	f	e5r6	rejected	\N	061a242e-4122-42d3-afa7-682a01567c1e	2026-09-28 10:26:34.368+00	2026-09-25 07:13:10.105158+00
\.


--
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_types (id, name, code, annual_quota, is_paid, is_active, description, created_at) FROM stdin;
a79d55e6-f410-4fff-9b5a-b5b6f0ae11c0	Sick Leave	SL	10	t	t	Paid sick leave for medical recovery	2026-09-23 04:32:29.202398+00
6e4e38e1-e5c2-4b8b-aa49-990acb663cd0	Earned Leave	EL	15	t	t	Paid privilege/earned leave	2026-09-23 04:32:29.202398+00
c3ce288a-0534-4301-9361-2e6cc6422082	Loss of Pay	LOP	0	f	t	Unpaid leave that triggers per-day salary deduction	2026-09-23 04:32:29.202398+00
ef1966d7-6e3a-40f3-a1d4-9a5c62db838e	Casual Leave	CL	15	t	t	Paid casual leave for personal work	2026-09-23 04:32:29.202398+00
\.


--
-- Data for Name: payslips; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payslips (id, employee_id, payroll_month, payroll_year, month_name, working_days, present_days, paid_leaves, lop_days, gross_salary, lop_deduction, total_earnings, total_deductions, net_salary, earnings_breakup, deductions_breakup, payment_status, created_at) FROM stdin;
\.


--
-- Data for Name: profile_change_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_change_requests (id, employee_id, requested_changes, previous_values, status, rejection_reason, reviewed_by, reviewed_at, created_at) FROM stdin;
ac3f76f8-8647-4e03-a9eb-59d87666faf6	683b39c8-d154-4cb2-be05-e7c65022fea9	{"city": "boca raton", "phone": "09290649809", "state": "", "address": "777 GLADE ROAd\\nNandha nagar", "pincode": "33431", "bank_name": "HDFC Bank", "ifsc_code": "HDFC0001234", "pan_number": "ABCDE1234F", "blood_group": "", "aadhar_number": "1234 5678 9012", "marital_status": "single", "bank_account_number": "50100234567890", "emergency_contact_name": "bhaskar Dontha", "emergency_contact_phone": "06309487952", "emergency_contact_relation": ""}	\N	approved	\N	061a242e-4122-42d3-afa7-682a01567c1e	2026-09-23 07:12:16.038+00	2026-09-23 07:11:53.578083+00
987d5ad0-530c-4563-a121-ddd11a43dcef	683b39c8-d154-4cb2-be05-e7c65022fea9	{"city": "boca raton", "phone": "09290649809", "state": "", "address": "777 GLADE ROAd\\nNandha nagar", "pincode": "33431", "bank_name": "HDFC Bank", "ifsc_code": "HDFC0001234", "pan_number": "ABCDE1234F", "blood_group": "B+", "aadhar_number": "1234 5678 9012", "marital_status": "single", "bank_account_number": "50100234567890", "emergency_contact_name": "bhaskar Dontha", "emergency_contact_phone": "06309487952", "emergency_contact_relation": ""}	\N	approved	\N	061a242e-4122-42d3-afa7-682a01567c1e	2026-09-23 07:16:26.724+00	2026-09-23 07:16:10.303196+00
733c7288-2f7b-4b16-82fd-02f7a3fb7fa2	8c3a0293-ec27-4a43-9054-c8fb0e046897	{"city": "Hyderabad", "phone": "06309487952", "state": "", "address": "49-285/B,4th Street left , afcons prestige apartment ,flat:107\\nPadmanagar -1, Chintal", "pincode": "500037", "bank_name": "HDFC Bank", "ifsc_code": "HDFC0001234", "pan_number": "ABCDE1234F", "blood_group": "A-", "aadhar_number": "1234 5678 9012", "marital_status": "single", "bank_account_number": "50100234567890", "emergency_contact_name": "Yagnesh Dontha", "emergency_contact_phone": "06309487952", "emergency_contact_relation": ""}	\N	approved	\N	061a242e-4122-42d3-afa7-682a01567c1e	2026-09-24 04:50:25.668+00	2026-09-23 13:00:49.249595+00
6b75a05a-107e-4291-912b-b70f2d0e7c7d	8c3a0293-ec27-4a43-9054-c8fb0e046897	{"blood_group": "B+"}	\N	approved	\N	061a242e-4122-42d3-afa7-682a01567c1e	2026-09-25 07:17:33.812+00	2026-09-25 04:48:17.917843+00
8ae96c34-2258-4833-97fb-02e07d8f3f9e	f8a274aa-c7bb-4362-93dc-9485421ddeee	{"city": "boca raton", "phone": "6309487952", "gender": "male", "address": "777 GLADE ROAd\\nNandha nagar", "pincode": "33431", "bank_name": "HDFC Bank", "ifsc_code": "HDFC0001235", "pan_number": "ABCDE1234F", "blood_group": "O+", "aadhar_number": "1234 5678 9012", "date_of_birth": "2003-07-03", "marital_status": "single", "bank_account_number": "50100234567890", "emergency_contact_name": "bhaskar Dontha", "emergency_contact_phone": "9290649809", "emergency_contact_relation": "Father"}	\N	pending	\N	\N	\N	2026-09-29 04:35:42.804882+00
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, email, full_name, role, avatar_url, created_at, updated_at) FROM stdin;
061a242e-4122-42d3-afa7-682a01567c1e	hr@teenssoftware.com	hr	hr	\N	2026-09-23 05:00:13.130638+00	2026-09-23 05:02:35.749512+00
2ebce8a5-6243-476b-b4a0-7ad441b3c352	yagnesh@teens.com	Yagnesh Dontha	employee	\N	2026-09-23 05:03:37.934255+00	2026-09-23 05:03:38.281457+00
fe2cd562-5396-4eb2-bef2-152c814aa46a	donthabhaskar55624@gmail.com	b Dontha	employee	\N	2026-09-23 06:22:46.211307+00	2026-09-23 06:22:46.500658+00
c0d52025-f0c7-4cf4-9b9b-01aa461c366c	donth@gmail.com	y Dontha	employee	\N	2026-09-23 06:52:07.51801+00	2026-09-23 06:52:07.943135+00
e1fb9d49-4218-4f66-96e1-3f003db52d8d	bhaskar55624@gmail.com	Hds Dontha	employee	\N	2026-09-23 08:56:48.532321+00	2026-09-23 08:56:48.781802+00
eda2051c-b63c-4d9b-bc34-1b8d28c525dd	yag@gmail.com	Yagnesh .D	employee	\N	2026-09-23 11:26:31.286814+00	2026-09-23 11:26:31.958651+00
45b9208d-f89f-4a12-8746-377e64704e9f	donth55624@gmail.com	bhaskar Dontha	employee	\N	2026-09-23 12:21:16.502122+00	2026-09-23 12:21:16.95043+00
a87f5eb2-7f52-496e-a18f-b6e965948701	yagnesh00d@gmail.com	Yagnesh Dontha	employee	\N	2026-09-23 12:23:17.004431+00	2026-09-23 12:23:17.564536+00
9fcc74d0-0d3a-46ef-a840-ea60a8149d5e	yagneshdontha@teenss.com	Yagnesh Dontha	employee	\N	2026-09-24 09:58:58.051617+00	2026-09-24 09:58:58.7765+00
a8bbfd41-dd41-4bab-97a1-420c8af08684	bhaskar.d@teenss.com	bhaskar Dontha	employee	\N	2026-09-24 10:37:28.78658+00	2026-09-24 10:37:29.360069+00
5b942059-389e-40f8-ba72-ccaf082bedae	bhaskard@teenss.com	bhaskar Dontha	employee	\N	2026-09-24 10:39:10.402592+00	2026-09-24 10:39:10.960015+00
a831f0b1-7956-4444-af90-ba6599048c7e	yagnesh.d@teenss.com	Yagnesh Dontha	employee	\N	2026-09-25 04:15:22.275554+00	2026-09-25 04:15:22.814864+00
d360e23b-1a0c-4592-98a0-fe3ff8b22a4a	raja.h@teenss.com	Raja h	employee	\N	2026-09-28 06:07:11.252753+00	2026-09-28 06:07:11.561379+00
b0284575-a9fa-4c49-b40f-64547001561e	rrsni.a@teenss.com	Rrsni A	employee	\N	2026-09-28 06:50:35.583386+00	2026-09-28 06:50:36.169117+00
0b73fc5c-f65e-44cb-8e89-92b7515e06d7	Rsd.d@teenss.com	Rsd Dontha	employee	\N	2026-09-28 07:10:41.18975+00	2026-09-28 07:10:41.462559+00
93929068-b90f-49fe-8c15-59b965d64ee3	rani.s@teenss.com	Rani s	employee	\N	2026-09-28 07:26:24.429729+00	2026-09-28 07:26:24.720142+00
b6127a52-9033-4d9b-bfbf-4bbba501a39a	ranjaa.d@teenss.com	Ranjaa D	employee	\N	2026-09-29 09:30:02.82964+00	2026-09-29 09:30:03.090396+00
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, client_country, timezone, calendar_id, shift_start_time, shift_end_time, grace_period_minutes, half_day_cutoff_minutes, created_at) FROM stdin;
cc09f5bb-9c95-432a-b75d-0ba0c7776fe7	FinTech Enterprise Platform	India	Asia/Kolkata	a72296b2-30f8-4c03-b35e-7aceb334d163	09:00:00	18:00:00	30	150	2026-09-24 07:17:37.499528+00
608c6982-7547-4a6f-8717-bdf6480b7652	US Healthcare Claims Engine	United States	America/New_York	60d3954a-3f36-43ee-bf00-9e2c60778d5d	18:30:00	03:30:00	30	150	2026-09-24 07:17:37.499528+00
7936df65-4b9b-4ad1-acbb-63217f8ed8fa	Internal Engineering & Bench	India	Asia/Kolkata	a72296b2-30f8-4c03-b35e-7aceb334d163	09:30:00	18:30:00	30	150	2026-09-24 07:17:37.499528+00
949a0be6-1c87-43d2-8ce9-52b89e1de190	WIPRO - DAT	India	Asia/Kolkata	a72296b2-30f8-4c03-b35e-7aceb334d163	09:00:00	18:00:00	30	150	2026-09-28 10:27:40.387039+00
95cb6ff7-eea2-43b3-b5dc-9eca081c6544	WIPRO - DAT	India	Asia/Kolkata	a72296b2-30f8-4c03-b35e-7aceb334d163	09:00:00	18:00:00	30	150	2026-09-28 10:27:40.697488+00
e4f9f552-1731-4e74-bfd1-b47604ecd0a5	TCS HRM	United States	Asia/Kolkata	a72296b2-30f8-4c03-b35e-7aceb334d163	09:00:00	18:00:00	30	150	2026-09-28 10:32:09.150561+00
\.


--
-- Data for Name: salary_components; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.salary_components (id, name, code, type, calculation_type, value, affects_lop, is_active, is_statutory, description, created_at) FROM stdin;
7401622e-2dbe-47a0-9f22-077a0eda4785	Basic Salary	BASIC	earning	percentage_of_gross	50.00	t	t	t	50% of Gross CTC	2026-09-23 04:32:29.202398+00
4210ed13-458f-49bb-af45-dd7ca875b113	House Rent Allowance (HRA)	HRA	earning	percentage_of_basic	40.00	t	t	t	40% of Basic Pay	2026-09-23 04:32:29.202398+00
de9a83ca-a3d9-4c34-a640-45853d705ef4	Special Allowance	SPECIAL_ALLOWANCE	earning	fixed	0.00	t	t	f	Balancing allowance of Gross Salary	2026-09-23 04:32:29.202398+00
42c22dc9-7a0d-42e4-8f69-461f5da796ca	Provident Fund (PF)	PF	deduction	percentage_of_basic	12.00	f	t	t	12% of Basic Pay	2026-09-23 04:32:29.202398+00
d41b82e2-d1f6-4d14-8872-bdf3efaf1137	Employee State Insurance (ESI)	ESI	deduction	percentage_of_gross	0.75	f	t	t	0.75% of Gross if Gross <= ₹21,000	2026-09-23 04:32:29.202398+00
6cae9e81-c3ca-4c72-b846-7e368f14066d	Professional Tax (PT)	PT	deduction	fixed	200.00	f	t	t	State statutory professional tax	2026-09-23 04:32:29.202398+00
887b1ed2-263c-47fb-952a-95c14e9637ba	Tax Deducted at Source (TDS)	TDS	deduction	percentage_of_gross	5.00	f	f	t	Estimated income tax	2026-09-23 04:32:29.202398+00
\.


--
-- Name: attendance_logs attendance_logs_employee_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_employee_id_attendance_date_key UNIQUE (employee_id, attendance_date);


--
-- Name: attendance_logs attendance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_pkey PRIMARY KEY (id);


--
-- Name: attendance_regularizations attendance_regularizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_id_key UNIQUE (employee_id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: employees employees_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_key UNIQUE (user_id);


--
-- Name: holiday_calendars holiday_calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holiday_calendars
    ADD CONSTRAINT holiday_calendars_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_calendar_id_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_calendar_id_holiday_date_key UNIQUE (calendar_id, holiday_date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: payslips payslips_employee_id_payroll_month_payroll_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_payroll_month_payroll_year_key UNIQUE (employee_id, payroll_month, payroll_year);


--
-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);


--
-- Name: profile_change_requests profile_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_change_requests
    ADD CONSTRAINT profile_change_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: salary_components salary_components_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_components
    ADD CONSTRAINT salary_components_code_key UNIQUE (code);


--
-- Name: salary_components salary_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_components
    ADD CONSTRAINT salary_components_pkey PRIMARY KEY (id);


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance_logs attendance_logs_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: attendance_regularizations attendance_regularizations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: attendance_regularizations attendance_regularizations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: employees employees_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: holidays holidays_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.holiday_calendars(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: payslips payslips_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: profile_change_requests profile_change_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_change_requests
    ADD CONSTRAINT profile_change_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: profile_change_requests profile_change_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_change_requests
    ADD CONSTRAINT profile_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.holiday_calendars(id);


--
-- Name: departments Allow authenticated read departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (true);


--
-- Name: holiday_calendars Allow authenticated read holiday_calendars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read holiday_calendars" ON public.holiday_calendars FOR SELECT TO authenticated USING (true);


--
-- Name: holidays Allow authenticated read holidays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read holidays" ON public.holidays FOR SELECT TO authenticated USING (true);


--
-- Name: leave_types Allow authenticated read leave_types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read leave_types" ON public.leave_types FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Allow authenticated read profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: projects Allow authenticated read projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read projects" ON public.projects FOR SELECT TO authenticated USING (true);


--
-- Name: salary_components Allow authenticated read salary_components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read salary_components" ON public.salary_components FOR SELECT TO authenticated USING (true);


--
-- Name: attendance_logs Attendance insert policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attendance insert policy" ON public.attendance_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: attendance_logs Attendance select policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attendance select policy" ON public.attendance_logs FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = attendance_logs.employee_id) AND (employees.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text])))))));


--
-- Name: attendance_logs Attendance update policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attendance update policy" ON public.attendance_logs FOR UPDATE TO authenticated USING (true);


--
-- Name: employees Employees insert policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees insert policy" ON public.employees FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text]))))));


--
-- Name: employees Employees select policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees select policy" ON public.employees FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text])))))));


--
-- Name: employees Employees update policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees update policy" ON public.employees FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text]))))));


--
-- Name: payslips Payslips select policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Payslips select policy" ON public.payslips FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = payslips.employee_id) AND (employees.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text])))))));


--
-- Name: attendance_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_regularizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_regularizations ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_leave_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: holiday_calendars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holiday_calendars ENABLE ROW LEVEL SECURITY;

--
-- Name: holidays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

--
-- Name: payslips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: salary_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict VjjdAGVG44qD6K3j1yN6eno8LrhgqfhycbZca4b8G9CpdvAI3dfOmFtGNXpmQfP

