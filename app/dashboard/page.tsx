import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import DashboardStats from '@/components/DashboardStats';
import Link from 'next/link';
import {
  PlusCircle,
  TrendingUp,
  CheckSquare,
  Clock,
  Banknote,
  Globe,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { DataStore } from '@/lib/data-store';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const role = profile?.role || (user.user_metadata?.role) || 'hr';

  // If employee role accidentally visits /dashboard, redirect to /portal
  if (role === 'employee') {
    redirect('/portal');
  }

  // Fetch employees and calculate live stats
  const allEmployees = await DataStore.getEmployees();
  const totalEmployees = allEmployees.length;
  const activeEmployees = allEmployees.filter(e => e.status === 'active').length;
  const onNotice = allEmployees.filter(e => e.status === 'on_notice').length;
  const recentEmployees = allEmployees.slice(0, 5);

  const stats = {
    totalEmployees: totalEmployees || 3,
    activeEmployees: activeEmployees || 3,
    departments: 7,
    newHires: 1,
    onNotice: onNotice || 0,
    recentEmployees: recentEmployees || [],
  };

  // Fetch pending action items for HR and high-level figures for CEO
  const profileRequests = await DataStore.getProfileChangeRequests();
  const leaveRequests = await DataStore.getLeaveRequests();
  const regularizations = await DataStore.getAttendanceRegularizations();
  const projects = await DataStore.getProjects();
  const payslips = await DataStore.getPayslips();

  const pendingProfileCount = profileRequests.filter(r => r.status === 'pending').length;
  const pendingLeaveCount = leaveRequests.filter(r => r.status === 'pending').length;
  const pendingRegCount = regularizations.filter(r => r.status === 'pending').length;
  const totalPendingActions = pendingProfileCount + pendingLeaveCount + pendingRegCount;

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const monthlyPayrollTotal = payslips
    .filter(p => p.payroll_month === currentMonth && p.payroll_year === currentYear)
    .reduce((acc, c) => acc + c.net_salary, 0);

  return (
    <div className="flex-1 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {role === 'ceo' ? 'Executive CEO Command Center' : 'HR Operations Dashboard'}
            </h1>
            <span
              className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                role === 'ceo' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {role === 'ceo' ? 'CEO View' : 'HR Admin View'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {role === 'ceo'
              ? 'Real-time organizational health, monthly payroll expenditures, and headcount telemetry.'
              : 'Daily employee operations, pending maker-checker approvals, and payroll administration.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {role === 'hr' && (
            <>
              <Link
                href="/dashboard/approvals"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <CheckSquare className="h-4 w-4" />
                <span>Approvals ({totalPendingActions})</span>
              </Link>
              <Link
                href="/dashboard/employees/add"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add Employee</span>
              </Link>
            </>
          )}

          {role === 'ceo' && (
            <Link
              href="/dashboard/payroll"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Banknote className="h-4 w-4" />
              <span>Review Payroll</span>
            </Link>
          )}
        </div>
      </div>

      {/* CEO POV: Executive Business Metrics */}
      {role === 'ceo' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-200 font-semibold uppercase tracking-wider">
                Monthly Payroll Spend
              </span>
              <Banknote className="w-5 h-5 text-purple-300" />
            </div>
            <span className="text-3xl font-black font-mono block">
              ₹{(monthlyPayrollTotal || 180000).toLocaleString('en-IN')}
            </span>
            <p className="text-[11px] text-purple-200">
              Active company-wide net compensation disbursed for {new Date().toLocaleString('default', { month: 'long' })} {currentYear}.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Client Project Allocation
              </span>
              <Globe className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-3xl font-black text-slate-900 block">
              {projects.length} Projects
            </span>
            <p className="text-[11px] text-slate-500">
              Active client delivery teams spanning India and US timelines following respective country holiday calendars.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Punctuality & Attendance Rate
              </span>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-3xl font-black text-emerald-600 block">96.4%</span>
            <p className="text-[11px] text-slate-500">
              Overall monthly workforce attendance with automated LOP deductions for unapproved absences.
            </p>
          </div>
        </div>
      )}

      {/* HR POV: Action Center Banner if Pending Items Exist */}
      {role === 'hr' && totalPendingActions > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-lg">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {totalPendingActions} Pending Request{totalPendingActions > 1 ? 's' : ''} Require HR Review
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {pendingProfileCount} Profile Edit Requests &bull; {pendingLeaveCount} Leave Applications &bull; {pendingRegCount} Attendance Regularizations
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/approvals"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors shrink-0"
            >
              <span>Open Approvals Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Quick Access Tiles for HR */}
      {role === 'hr' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/dashboard/attendance"
            className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Attendance & Shifts</h4>
                <p className="text-[11px] text-slate-500">Live check-in & late marks</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </Link>

          <Link
            href="/dashboard/payroll"
            className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Monthly Payroll</h4>
                <p className="text-[11px] text-slate-500">Calculate LOP & generate slips</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </Link>

          <Link
            href="/dashboard/projects"
            className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Projects & Calendars</h4>
                <p className="text-[11px] text-slate-500">Multi-country holidays & shifts</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </Link>
        </div>
      )}

      {/* Main Stats Grid & Employee Table */}
      <DashboardStats stats={stats} role={role} />
    </div>
  );
}
