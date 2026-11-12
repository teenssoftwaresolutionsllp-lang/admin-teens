import { createClient,createAdminClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import DashboardStats from '@/components/DashboardStats';
import Link from 'next/link';
import DashboardKpiCards from '@/components/dashboard/DashboardKpiCards';
import {
  TrendingUp,
  CheckSquare,
  Clock,
  Banknote,
  Globe,
  ArrowRight,
  ShieldAlert,
  Users,
  UserPlus,
  CalendarDays,
  UserCheck,
} from 'lucide-react';

import { DataStore } from '@/lib/data-store';
import { Employee } from '@/lib/types';

import DashboardCharts from '@/components/dashboard/DashboardCharts';
import LeaveRequestsWidget from '@/components/dashboard/LeaveRequestsWidget';
import RecentJoiningsWidget from '@/components/dashboard/RecentJoiningsWidget';
import QuickActions from '@/components/dashboard/QuickActions';
import UpcomingHolidaysWidget from '@/components/dashboard/UpcomingHolidaysWidget';

function getIndiaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getDateOnly(value?: string | null) {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ attendanceDate?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const role = profile?.role || user.user_metadata?.role || 'hr';

  // Employees must use the employee portal, not the HR dashboard.
  if (role === 'employee') redirect('/portal');

  const now = new Date();
  const todayIndia = getIndiaDate(now);

  // Selected attendance date: today by default, or a valid past date.
  const params = await searchParams;
  const requestedDate = params.attendanceDate;

  const selectedAttendanceDate =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate <= todayIndia
      ? requestedDate
      : todayIndia;

  const currentMonth = Number(todayIndia.slice(5, 7)) - 1;
  const currentYear = Number(todayIndia.slice(0, 4));

  // Fetch upcoming regular and emergency holidays.
  const admin = await createAdminClient();

  const upcomingHolidaysPromise = admin
    .from("holidays")
    .select(
      "id, holiday_date, title, holiday_type, scope, reason, project_id, status, is_working_day"
    )
    .gte("holiday_date", todayIndia)
    .eq("status", "active")
    .eq("is_working_day", false)
    .order("holiday_date", { ascending: true })
    .limit(100);

  // Fetch shared and role-specific dashboard data.
  const allEmployeesPromise = DataStore.getEmployees(false);

  const todayAttendancePromise = supabase
    .from('attendance_logs')
    .select('employee_id, work_mode, status')
    .eq('attendance_date', selectedAttendanceDate);

  const profileRequestsPromise =
    role === 'hr'
      ? DataStore.getProfileChangeRequests()
      : Promise.resolve([]);

  const leaveRequestsPromise =
    role === 'hr'
      ? DataStore.getLeaveRequests()
      : Promise.resolve([]);

  const regularizationsPromise =
    role === 'hr'
      ? DataStore.getAttendanceRegularizations()
      : Promise.resolve([]);

  const projectsPromise =
    role === 'ceo'
      ? DataStore.getProjects()
      : Promise.resolve([]);

  const payrollPromise =
    role === 'ceo'
      ? DataStore.getMonthlyPayrollTotal(currentMonth + 1, currentYear)
      : Promise.resolve(0);

  const [
    allEmployees,
    profileRequests,
    leaveRequests,
    regularizations,
    projects,
    monthlyPayrollTotal,
    todayAttendanceResult,
    upcomingHolidaysResult,
  ] = await Promise.all([
    allEmployeesPromise,
    profileRequestsPromise,
    leaveRequestsPromise,
    regularizationsPromise,
    projectsPromise,
    payrollPromise,
    todayAttendancePromise,
    upcomingHolidaysPromise,
  ]);

  const activeEmployeesList = allEmployees.filter(
    (employee) => employee.status === 'active'
  );

  const totalEmployees = allEmployees.length;
  const activeEmployees = activeEmployeesList.length;

  const onNotice = allEmployees.filter(
    (employee) =>
      employee.status === 'on_notice' ||
      (employee.status === 'resigned' &&
        employee.notice_status === 'notice_period')
  ).length;

  const employeeById = new Map(
    allEmployees.map((employee) => [employee.id, employee])
  );

  // Count each active employee once in the selected date's attendance.
  const attendanceByEmployee = new Map<
    string,
    {
      employeeId: string;
      departmentId: string;
      departmentName: string;
      workMode: 'WFO' | 'WFH';
    }
  >();

  for (const attendance of todayAttendanceResult.data ?? []) {
    const employee = employeeById.get(attendance.employee_id);

    if (!employee || employee.status !== 'active') continue;

    const departmentId =
      employee.department?.id ??
      (employee as Employee & { department_id?: string }).department_id ??
      'unassigned';

    const departmentName =
      employee.department?.name ?? 'Unassigned';

    const existing = attendanceByEmployee.get(attendance.employee_id);

    attendanceByEmployee.set(attendance.employee_id, {
      employeeId: attendance.employee_id,
      departmentId,
      departmentName,
      workMode:
        existing?.workMode === 'WFH' || attendance.work_mode === 'WFH'
          ? 'WFH'
          : 'WFO',
    });
  }

  const todayAttendance = Array.from(attendanceByEmployee.values());
  const todayPresentCount = todayAttendance.length;

  // Department-wise attendance, including departments with zero attendance.
  const departmentAttendanceMap = new Map<
    string,
    {
      departmentId: string;
      departmentName: string;
      present: number;
      wfh: number;
      wfo: number;
    }
  >();

  // Add all departments represented by active employees first.
  for (const employee of activeEmployeesList) {
    const departmentId =
      employee.department?.id ??
      employee.department_id ??
      'unassigned';

    const departmentName =
      employee.department?.name ?? 'Unassigned';

    if (!departmentAttendanceMap.has(departmentId)) {
      departmentAttendanceMap.set(departmentId, {
        departmentId,
        departmentName,
        present: 0,
        wfh: 0,
        wfo: 0,
      });
    }
  }

  // Add selected date's attendance to the corresponding department.
  for (const attendance of todayAttendance) {
    const department = departmentAttendanceMap.get(
      attendance.departmentId
    );

    if (!department) continue;

    department.present += 1;

    if (attendance.workMode === 'WFH') {
      department.wfh += 1;
    } else {
      department.wfo += 1;
    }
  }

  const departmentAttendanceData = Array.from(
    departmentAttendanceMap.values()
  ).sort((a, b) =>
    a.departmentName.localeCompare(b.departmentName)
  );

  const newHires = allEmployees.filter((employee) => {
    const joiningDate = getDateOnly(employee.joining_date);
    return joiningDate?.slice(0, 7) === todayIndia.slice(0, 7);
  }).length;

  // Joining counts grouped by calendar year and month.
  const joiningCountsMap = new Map<string, number>();

  for (const employee of allEmployees) {
    const joiningDate = getDateOnly(employee.joining_date);
    if (!joiningDate) continue;

    const period = joiningDate.slice(0, 7);

    joiningCountsMap.set(
      period,
      (joiningCountsMap.get(period) || 0) + 1
    );
  }

  const joiningCounts = Array.from(
    joiningCountsMap,
    ([period, count]) => {
      const [year, month] = period.split('-').map(Number);

      return { year, month, count };
    }
  ).sort(
    (a, b) => a.year - b.year || a.month - b.month
  );

  const pendingProfileCount = profileRequests.filter(
    (request) => request.status === 'pending'
  ).length;

  const pendingLeaveCount = leaveRequests.filter(
    (request) => request.status === 'pending'
  ).length;

  console.log(
    "PENDING LEAVE TYPES:",
    leaveRequests
      .filter((request) => request.status === "pending")
      .map((request) => ({
        id: request.id,
        leaveType: request.leave_type?.name,
        leaveTypeData: request.leave_type,
      }))
  );

  // Pending leave requests grouped by leave category.
  const pendingLeaveBreakdown = {
    CL: 0,
    SL: 0,
    ML: 0,
    PL: 0,
  };

  for (const request of leaveRequests) {
    if (request.status !== 'pending') continue;

      const leaveCode = (
      request.leave_type?.code ??
      ''
    ).trim().toUpperCase();

    switch (leaveCode) {
      case 'CL':
        pendingLeaveBreakdown.CL += 1;
        break;

      case 'SL':
        pendingLeaveBreakdown.SL += 1;
        break;

      case 'ML':
        pendingLeaveBreakdown.ML += 1;
        break;

      case 'PL':
        pendingLeaveBreakdown.PL += 1;
        break;
    }
  }

  const pendingRegCount = regularizations.filter(
    (request) => request.status === 'pending'
  ).length;

  const totalPendingActions =
    pendingProfileCount + pendingLeaveCount + pendingRegCount;

  const stats = {
    totalEmployees,
    activeEmployees,
    departments: new Set(
      activeEmployeesList.map(
        (employee) => employee.department?.id ?? employee.department_id ?? 'unassigned'
      )
    ).size,
    newHires,
    onNotice,
    recentEmployees: allEmployees.slice(0, 5),
  };

  // Monthly joining trend for the current year.
  const monthlyData = Array.from({ length: 12 }, (_, monthIndex) => {
    const month = String(monthIndex + 1).padStart(2, '0');

    const employees = allEmployees.filter(
      (employee) =>
        getDateOnly(employee.joining_date)?.slice(0, 7) ===
        `${currentYear}-${month}`
    ).length;

    return {
      label: new Date(currentYear, monthIndex, 1).toLocaleDateString(
        'en-IN',
        { month: 'short' }
      ),
      employees,
    };
  });

  // Yearly joining trend for the last five calendar years.
  const yearlyData = Array.from({ length: 5 }, (_, index) => {
    const year = currentYear - 4 + index;

    return {
      label: String(year),
      employees: allEmployees.filter(
        (employee) =>
          getDateOnly(employee.joining_date)?.slice(0, 4) === String(year)
      ).length,
    };
  });


  // Probation completion counts grouped by confirmation date.
  const probationCompletionCounts = allEmployees
    .map((employee) => ({
      confirmationDate: getDateOnly(employee.confirmation_date),
    }))
    .filter(
      (employee) =>
        employee.confirmationDate &&
        employee.confirmationDate <= todayIndia
    );

  // Monthly probation completion trend for the current year.
  const probationMonthlyData = Array.from(
    { length: 12 },
    (_, monthIndex) => {
      const month = String(monthIndex + 1).padStart(2, "0");

      return {
        label: new Date(
          currentYear,
          monthIndex,
          1
        ).toLocaleDateString("en-IN", { month: "short" }),

        employees: probationCompletionCounts.filter(
          (employee) =>
            employee.confirmationDate?.slice(0, 7) ===
            `${currentYear}-${month}`
        ).length,
      };
    }
  );

  // Yearly probation completion trend for the last five calendar years.
  const probationYearlyData = Array.from(
    { length: 5 },
    (_, index) => {
      const year = currentYear - 4 + index;

      return {
        label: String(year),
        employees: probationCompletionCounts.filter(
          (employee) =>
            employee.confirmationDate?.slice(0, 4) === String(year)
        ).length,
      };
    }
  );


  // Department-wise active employee count.
  const departmentCounts = new Map<string, number>();

  for (const employee of activeEmployeesList) {
    const departmentName = employee.department?.name || 'Unassigned';
    departmentCounts.set(
      departmentName,
      (departmentCounts.get(departmentName) || 0) + 1
    );
  }

  const departmentData = Array.from(
    departmentCounts,
    ([name, employees]) => ({ name, employees })
  ).sort((a, b) => b.employees - a.employees);

  // Calculate the current Monday-Sunday week using India-local dates.
  const [todayYear, todayMonth, todayDay] = todayIndia
    .split('-')
    .map(Number);

  const todayUtc = new Date(
    Date.UTC(todayYear, todayMonth - 1, todayDay)
  );

  const dayOfWeek = todayUtc.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStartDate = new Date(
    Date.UTC(todayYear, todayMonth - 1, todayDay + mondayOffset)
  );

  const weekEndDate = new Date(
    Date.UTC(todayYear, todayMonth - 1, todayDay + mondayOffset + 6)
  );

  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);

  const weeklyLeaveRequests = leaveRequests
    .filter((request) => {
      const starts = getDateOnly(request.start_date);
      const ends = getDateOnly(request.end_date);

      return Boolean(
        starts &&
          ends &&
          starts <= weekEnd &&
          ends >= weekStart
      );
    })
    .slice(0, 6)
    .map((request) => ({
      id: request.id,
      employeeName: request.employee
        ? `${request.employee.first_name} ${request.employee.last_name}`.trim()
        : 'Employee',
      employeePhoto: request.employee?.profile_photo_url ?? null,
      leaveType: request.leave_type?.name ?? 'Leave',
      startDate: request.start_date,
      endDate: request.end_date,
      status: request.status,
    }));

  // Five most recent employee joinings.
  const recentJoinings = allEmployees
    .filter((employee) => getDateOnly(employee.joining_date))
    .sort((a, b) =>
      (getDateOnly(b.joining_date) || '').localeCompare(
        getDateOnly(a.joining_date) || ''
      )
    )
    .slice(0, 5)
    .map((employee) => ({
      id: employee.id,
      employeeId: employee.employee_id,
      name: `${employee.first_name} ${employee.last_name}`.trim(),
      photo: employee.profile_photo_url ?? null,
      designation: employee.designation || 'Not specified',
      department: employee.department?.name || 'Unassigned',
      joiningDate: employee.joining_date!,
    }));

  // =========================================================
  // UPCOMING HOLIDAYS
  // =========================================================

  if (upcomingHolidaysResult.error) {
    console.error(
      "Unable to fetch upcoming holidays:",
      upcomingHolidaysResult.error
    );
  }

  const holidayRows = upcomingHolidaysResult.data ?? [];

  const holidayMap = new Map<string, (typeof holidayRows)[number]>();

  for (const holiday of holidayRows) {
    const key =
      holiday.holiday_type === "emergency"
        ? `${holiday.holiday_date}|emergency|${holiday.scope}|${holiday.project_id || "company"}`
        : `${holiday.holiday_date}|regular|${holiday.title}`;

    if (!holidayMap.has(key)) {
      holidayMap.set(key, holiday);
    }
  }

  const todayUtcForHolidays = Date.UTC(
    Number(todayIndia.slice(0, 4)),
    Number(todayIndia.slice(5, 7)) - 1,
    Number(todayIndia.slice(8, 10))
  );

  const upcomingHolidays = Array.from(holidayMap.values())
    .map((holiday) => {
      const holidayDate = getDateOnly(holiday.holiday_date);

      if (!holidayDate) return null;

      const [year, month, day] = holidayDate.split("-").map(Number);

      const holidayUtc = Date.UTC(year, month - 1, day);

      const daysUntil = Math.round(
        (holidayUtc - todayUtcForHolidays) / 86400000
      );

      return {
        id: holiday.id,
        holiday_date: holidayDate,
        title: holiday.title,
        holiday_type: holiday.holiday_type as "regular" | "emergency",
        scope: holiday.scope as "calendar" | "company" | "project",
        reason: holiday.reason,
        project_id: holiday.project_id,
        daysUntil,
      };
    })
    .filter(
      (holiday): holiday is NonNullable<typeof holiday> =>
        holiday !== null
    )
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  const formattedToday = new Date(
    `${todayIndia}T00:00:00`
  ).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-6">
      {/* HR DASHBOARD */}
      {role === 'hr' && (
        <>
          {/* Welcome header */}
          {/* Redesigned Welcome Header */}

          {/* Design Concept 4 - Welcome Header */}
          <div className="relative isolate h-[166px] overflow-hidden rounded-[18px] border border-indigo-100/70 bg-gradient-to-r from-[#e9e8ff] via-[#f1f0ff] to-[#dfe5ff] shadow-sm">

            {/* Right-side illustration */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-[58%] bg-[url('/hr-dashboard-header-illustration.png')] bg-cover bg-center bg-no-repeat"
              aria-hidden="true"
            />

            {/* Fade illustration into the text area */}
            <div className="pointer-events-none absolute inset-y-0 left-[35%] right-0 bg-gradient-to-r from-[#e9e8ff] via-[#e9e8ff]/30 to-transparent" />

            {/* Welcome content */}
            <div className="relative z-10 flex h-full items-center px-6 sm:px-9">
              <div className="max-w-[58%]">
                <h1 className="text-[27px] font-extrabold tracking-tight text-[#101a49] sm:text-[34px]">
                  Welcome Back, {profile?.full_name || "HR"}! <span>👋</span>
                </h1>

                <p className="mt-2 text-sm font-medium text-[#172554] sm:text-[17px]">
                  Here's what's happening in your organization today.
                </p>

                <div className="mt-3 flex items-center gap-3 text-[#111b4b]">
                  <CalendarDays className="h-[21px] w-[21px] text-indigo-600" />
                  <span className="text-xs font-semibold sm:text-sm">
                    {formattedToday}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive KPI cards */}
          <DashboardKpiCards
            activeEmployees={activeEmployees}
            pendingLeaveCount={pendingLeaveCount}
            pendingLeaveBreakdown={pendingLeaveBreakdown}
            joiningCounts={joiningCounts}
            departmentAttendanceData={departmentAttendanceData}
            currentMonth={currentMonth + 1}
            currentYear={currentYear}
            selectedAttendanceDate={selectedAttendanceDate}
            todayDate={todayIndia}
          />

          {/* Charts and weekly leave requests */}
          <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-8">
              <DashboardCharts employees={allEmployees} />

            </div>

            <div className="min-w-0 xl:col-span-4 [&>section]:h-full">
              <LeaveRequestsWidget requests={weeklyLeaveRequests} />
            </div>
          </div>

          {/* Recent joinings, upcoming holidays and quick actions */}
          <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-5">
              <RecentJoiningsWidget employees={recentJoinings} />
            </div>

            <div className="min-w-0 xl:col-span-3">
              <UpcomingHolidaysWidget holidays={upcomingHolidays} />
            </div>

            <div className="min-w-0 xl:col-span-4">
              <QuickActions />
            </div>
          </div>
        </>
      )}

      {/* CEO DASHBOARD — preserve existing executive view */}
      {role === 'ceo' && (
        <>
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Executive CEO Command Center
                </h1>
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-purple-800">
                  CEO View
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Real-time organizational health, monthly payroll expenditures,
                and headcount telemetry.
              </p>
            </div>

            <Link
              href="/dashboard/payroll"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <Banknote className="h-4 w-4" />
              Review Payroll
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="space-y-3 rounded-2xl bg-gradient-to-br from-purple-900 to-indigo-950 p-6 text-white shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">
                  Monthly Payroll Spend
                </span>
                <Banknote className="h-5 w-5 text-purple-300" />
              </div>
              <span className="block font-mono text-3xl font-black">
                ₹{Number(monthlyPayrollTotal || 0).toLocaleString('en-IN')}
              </span>
              <p className="text-[11px] text-purple-200">
                Payroll total for{' '}
                {new Date(currentYear, currentMonth).toLocaleString('en-IN', {
                  month: 'long',
                })}{' '}
                {currentYear}.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Client Project Allocation
                </span>
                <Globe className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="block text-3xl font-black text-slate-900">
                {projects.length} Projects
              </span>
              <p className="text-[11px] text-slate-500">
                Client delivery projects across the organization.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Employees
                </span>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="block text-3xl font-black text-emerald-600">
                {activeEmployees}
              </span>
              <p className="text-[11px] text-slate-500">
                Currently active employees in the organization.
              </p>
            </div>
          </div>

          <DashboardStats
            stats={stats}
            role={role}
            todayAttendance={todayAttendance}
          />
        </>
      )}
    </div>
  );
}
