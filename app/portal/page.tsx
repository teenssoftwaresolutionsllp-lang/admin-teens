import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import ProfileProgressBar from "@/components/portal/ProfileProgressBar";
import ClockInWidget from "@/components/portal/ClockInWidget";
import Link from "next/link";
import { Calendar, FileText, ArrowRight, Globe, AlertCircle, Briefcase } from "lucide-react";

export default async function EmployeePortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Find employee corresponding to this user
  let employee = null;
  if (user) {
    employee = await DataStore.getEmployeeByUserId(user.id);
  }

  // Fallback to sample employee if not linked yet
  if (!employee) {
    const all = await DataStore.getEmployees();
    employee = all.find((e) => e.email === user?.email) || all[0] || null;
  }

  const employeeId = employee?.id || "TSS001";
  const todayAttendance = await DataStore.getTodayAttendance(employeeId);
  const leaveBalances = await DataStore.getLeaveBalances(employeeId);
  const payslips = await DataStore.getPayslips(employeeId);
  const latestPayslip = payslips[0] || null;
  const project = employee?.project || (await DataStore.getProjects())[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {employee?.first_name || "Colleague"} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {employee?.designation || "Software Engineer"} &bull; ID:{" "}
            <span className="font-mono font-medium text-slate-700">
              {employee?.employee_id || "TSS001"}
            </span>{" "}
            &bull; {employee?.employment_type || "Full-time"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/portal/profile"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            View My Profile
          </Link>
          <Link
            href="/portal/leaves"
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            Apply Leave
          </Link>
        </div>
      </div>

      {/* 1. Dynamic Profile Completion Bar (Turns full green at 100%) */}
      <ProfileProgressBar employee={employee} />

      {/* 2. Grid: Attendance Punch + Leave Balance + Project Timezone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clock In / Out Widget */}
        <ClockInWidget
          employeeId={employeeId}
          initialLog={todayAttendance}
          project={project}
        />

        {/* Leave Balances Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Leave Balances (2026)</h3>
                  <p className="text-xs text-slate-500">Allocated by HR Policy</p>
                </div>
              </div>
              <Link
                href="/portal/leaves"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                View History
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {leaveBalances
                .filter((b) => b.leave_type?.code !== "LOP")
                .map((b) => (
                  <div
                    key={b.id}
                    className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center"
                  >
                    <span className="text-[11px] font-bold text-slate-500 block uppercase">
                      {b.leave_type?.code}
                    </span>
                    <span className="text-xl font-bold text-slate-900 block my-1">
                      {b.balance_days}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      of {b.allocated_days} days
                    </span>
                  </div>
                ))}
            </div>

            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Note on Unpaid Leaves:</strong> Any leaves beyond balance or marked as
                Loss of Pay (LOP) will automatically deduct your per-day salary in the monthly payslip.
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href="/portal/leaves"
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1"
            >
              <span>Apply for Planned or Sick Leave</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Project, Timezone & Country Calendar Widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Assigned Project & Calendar</h3>
                  <p className="text-xs text-slate-500">Timeline & Country Holidays</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                {project.client_country}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium">Active Project:</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{project.name}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Timezone: {project.timezone} &bull; Shift: {project.shift_start_time} -{" "}
                  {project.shift_end_time}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium block mb-1">
                  Upcoming Country Holiday:
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Gandhi Jayanti</span>
                  <span className="text-slate-500 text-[11px] font-mono">2026-10-02</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  (Based on {project.client_country} project holiday calendar)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-500 font-medium">
              Teams on different timelines follow assigned country holiday calendars.
            </span>
          </div>
        </div>
      </div>

      {/* 3. Latest Payslip Snapshot Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl shrink-0">
            <FileText className="w-7 h-7 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">
                Latest Payslip: {latestPayslip?.month_name || "Current Month"}{" "}
                {latestPayslip?.payroll_year || 2026}
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                {latestPayslip?.payment_status || "Processed"}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Monthly CTC: ₹{(latestPayslip?.gross_salary || employee?.salary || 75000).toLocaleString("en-IN")}{" "}
              {latestPayslip && latestPayslip.lop_days > 0 && (
                <span className="text-amber-300 font-semibold ml-1">
                  &bull; {latestPayslip.lop_days} day(s) LOP deduction (-₹
                  {latestPayslip.lop_deduction.toLocaleString("en-IN")})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Take-Home Net Salary</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">
              ₹{(latestPayslip?.net_salary || 64800).toLocaleString("en-IN")}
            </span>
          </div>

          <Link
            href="/portal/payslips"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-semibold text-xs transition-colors shrink-0 shadow-sm"
          >
            <span>View & Download</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
