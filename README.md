# Teens Software Solutions - Enterprise HRMS & Employee Self-Service (ESS) Portal

Comprehensive Human Resource Management System (HRMS) and Employee Self-Service (ESS) SaaS application built for **Teens Software Solutions LLP**.

---

## 🌟 Quick Demo Credentials

All test accounts are pre-configured and seeded for immediate testing:

| Role | Email | Password | Assigned Name / Details | Portal / View |
| :--- | :--- | :--- | :--- | :--- |
| **CEO** | `ceo@teenssoftware.com` | `Admin@123` | **Sri Ramulu Darapureddy** | `/dashboard` (Executive Telemetry & Financials) |
| **HR Admin** | `hr@teenssoftware.com` | `Admin@123` | **Chaitanya Deepthi** | `/dashboard` (Employee Ops & Approvals Hub) |
| **Employee** | `employee@teenssoftware.com` | `Employee@123` | **Balaji Marpally (TSS001)** | `/portal` (Employee Self-Service) |

> 💡 **Quick Login Buttons:** On the `/login` screen, click any of the 1-click demo login buttons (**CEO Quick Login**, **HR Quick Login**, **Employee Quick Login**) to authenticate instantly without typing.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Database Seeding Command
To seed or re-seed default accounts, sample attendance logs, leave balances, pending approvals, and payslips:
```bash
# PowerShell / Terminal
curl -X POST http://localhost:3000/api/seed
```
*Or via PowerShell:*
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/seed" -Method POST
```

---

## 🧪 Comprehensive Feature Testing Guide

### 1. Employee Self-Service (ESS) Testing (`/portal`)
Log in as `employee@teenssoftware.com` (`Employee@123`):

#### A. Dynamic Profile Completion Progress Bar
- Navigate to `/portal` or `/portal/profile`.
- **Weighted Completion Metric:**
  - Core Personal Info: **20%**
  - Contact & Emergency Details: **20%**
  - Employment & Designation: **20%**
  - Bank Account & IFSC: **20%**
  - Statutory IDs (PAN, Aadhar, UAN, ESI): **20%**
- **Visual Feedback:** Shows dynamic percentage with missing field checklist; turns **full solid green (100%)** when all sections are complete.

#### B. Maker-Checker Profile Change Requests
- Navigate to `/portal/profile`.
- Click **Request Profile Edit**.
- Edit sensitive fields (e.g., Address, Bank Account, IFSC).
- Submit request: Status turns to `Pending HR Review`.
- Log in as HR (`hr@teenssoftware.com`), navigate to `/dashboard/approvals`, and approve the request.
- Log back in as Employee: The official record reflects the approved changes immediately.

#### C. Shift Attendance, Clock In/Out & Grace Period Logic
- Navigate to `/portal/attendance`.
- **Clock In / Out:** Live punch widget evaluates shift time against assigned project schedule.
- **Grace Period & Half-Day Rules:**
  - Clock in within 30-min grace period $\rightarrow$ marked **Present**.
  - Clock in after grace period $\rightarrow$ marked **Late Mark**.
  - Clock in >150 mins late or working <4.5 hrs $\rightarrow$ marked **Half Day**.
- **Attendance Regularization:** Submit regularization requests with custom reasons for missed punches.

#### D. Leave Management & Automatic Loss of Pay (LOP)
- Navigate to `/portal/leaves`.
- View live balances for **Casual Leave (CL: 12 days)**, **Sick Leave (SL: 10 days)**, **Earned Leave (EL: 15 days)**.
- Apply for leave with date range and reason.
- **LOP Policy:** Unpaid leaves (LOP) or leaves exceeding quotas automatically trigger per-day salary deduction in the monthly payroll engine.

#### E. Printable Indian Payslip & Salary Breakdown
- Navigate to `/portal/payslips`.
- View generated payslips with complete earnings and deductions breakdown.
- Click **View / Print Payslip** to open a clean printable salary slip including:
  - Gross Salary, Net Take-Home Salary, and LOP Deductions
  - Statutory Deductions: PF (12% of Basic), ESI (0.75%), PT (₹200), TDS
  - Net Pay written in Indian Currency Words (e.g., *Rupees Sixty-Four Thousand Eight Hundred Only*)

---

### 2. HR Admin Operations Testing (`/dashboard`)
Log in as `hr@teenssoftware.com` (`Admin@123`):

#### A. Central Approvals Hub (`/dashboard/approvals`)
- **3 Dedicated Maker-Checker Queues:**
  1. **Profile Change Requests:** Approve/reject employee data change submissions with rejection comments.
  2. **Leave Applications:** Review employee leave requests with auto-deduction from balance upon approval.
  3. **Attendance Regularizations:** Review punch regularization requests; approving automatically regularizes attendance logs.

#### B. Company-Wide Attendance Tracker (`/dashboard/attendance`)
- Filter attendance records by employee, date, and status.
- Monitor late marks, half-days, and regularized entries.

#### C. Leave Quota & Policy Configuration (`/dashboard/leaves`)
- Configure annual quotas for CL, SL, EL, and LOP.
- Toggle leave types active/inactive.
- View company-wide employee leave balances in real time.

#### D. Customizable Salary Components & Payroll Engine (`/dashboard/payroll`)
- **HR-Customizable Components:** Toggle statutory & discretionary earnings/deductions (Basic, HRA, Special Allowance, PF, ESI, PT, TDS).
- **Run Monthly Payroll:** Generates payroll for all active employees for any selected month/year.
- Auto-calculates LOP deductions based on approved unpaid leaves and half-days.

#### E. Projects, Shifts & Multi-Country Holiday Calendars (`/dashboard/projects`)
- Create and assign projects with country-specific timezones (India `Asia/Kolkata`, US `America/New_York`).
- Shift start/end times, grace periods (30 mins), and half-day cutoffs (150 mins).
- Country holiday calendars (India Republic Day, Independence Day, Diwali vs. US Memorial Day, Labor Day, Thanksgiving).

---

### 3. CEO Executive Telemetry Testing (`/dashboard`)
Log in as `ceo@teenssoftware.com` (`Admin@123`):

- **Executive Command Center:**
  - Live **Monthly Payroll Expenditure** telemetry.
  - Multi-country **Client Project Allocations**.
  - Workforce **Punctuality & Attendance Rates**.
  - Read-only audit access across all employee payrolls and headcount distribution.

---

## 🧮 Calculation Formulas

### 1. Profile Completion Percentage
$$\text{Percentage} = \sum (\text{Section Weight if Complete})$$
Where each of the 5 sections (Personal, Contact, Employment, Bank, Statutory) contributes 20%.

### 2. Loss of Pay (LOP) Per-Day Salary Deduction
$$\text{Per-Day Salary} = \frac{\text{Monthly Gross Salary}}{\text{Total Days in Month}}$$
$$\text{LOP Deduction} = \text{Per-Day Salary} \times \text{LOP Days}$$

### 3. Indian Statutory Salary Breakup
- **Basic Pay:** $50\%$ of Gross Salary
- **HRA:** $40\%$ of Basic Pay
- **Special Allowance:** Balancing amount ($\text{Gross} - \text{Basic} - \text{HRA}$)
- **PF (Provident Fund):** $12\%$ of Basic Pay
- **ESI:** $0.75\%$ of Gross (applicable if Gross $\le ₹21,000$)
- **PT (Professional Tax):** Standard statutory $₹200/\text{month}$
- **Net Salary:** $\text{Total Earnings} - \text{Total Deductions} - \text{LOP Deduction}$

---

## 📁 Repository Architecture

```
admin-teens/
├── app/
│   ├── api/
│   │   ├── auth/login/          # Role-based login API
│   │   ├── attendance/punch/    # Live clock-in / clock-out API
│   │   ├── attendance/regularization/ # Attendance regularizations
│   │   ├── employees/           # Employee CRUD & auth user provisioning
│   │   ├── leaves/              # Leave request & review APIs
│   │   ├── payroll/components/  # Salary component configuration API
│   │   ├── payroll/run/         # Monthly payroll generator API
│   │   ├── profile-change-requests/ # Maker-checker profile change APIs
│   │   └── seed/                # Full database & HRMS seed route
│   ├── dashboard/               # HR & CEO Admin Views
│   │   ├── approvals/           # HR Maker-Checker Approvals Hub
│   │   ├── attendance/          # Company Attendance Monitor
│   │   ├── employees/           # Employee Directory & Add Form
│   │   ├── leaves/              # Leave Type Quota Configurator
│   │   ├── payroll/             # Payroll Engine & Salary Components
│   │   ├── projects/            # Project & Holiday Calendar Manager
│   │   └── page.tsx             # Executive Dashboard
│   └── portal/                  # Employee Self-Service (ESS)
│       ├── attendance/          # Employee Attendance & Regularization
│       ├── leaves/              # Employee Leave Balances & Applications
│       ├── payslips/            # Employee Payslips & Printable Slips
│       ├── profile/             # Employee Profile View & Request Edit
│       └── page.tsx             # Employee Overview & Live Clock-in
├── components/
│   ├── admin/                   # Admin management components
│   ├── portal/                  # ESS portal components
│   ├── EmployeeForm.tsx         # Employee creation & credentials form
│   ├── Header.tsx               # Header with dynamic role badges
│   ├── LoginForm.tsx            # Login with 1-click demo login buttons
│   └── Sidebar.tsx              # Adaptive role-based navigation sidebar
├── lib/
│   ├── calculations.ts          # Profile completion, attendance & payroll formulas
│   ├── data-store.ts            # Resilient DataStore with in-memory cache & Supabase sync
│   ├── supabase-server.ts       # Supabase SSR & admin clients
│   └── types.ts                 # Full TypeScript interfaces
└── schema.sql                   # Complete PostgreSQL DDL with RLS policies
```
