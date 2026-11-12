import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BriefcaseBusiness, Users, ArrowRight } from "lucide-react";

export default async function WorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Read the user's actual role from the database.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Workspace profile lookup failed:", profileError);
    redirect("/portal");
  }

  const role = String(
    profile?.role || user.user_metadata?.role || "employee"
  ).toLowerCase();

  // HR and CEO continue using the existing admin dashboard.
  if (role === "hr" || role === "ceo") {
    redirect("/dashboard");
  }

  if (role !== "employee") {
    redirect("/portal");
  }

  // Verify manager permission from the employee record.
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, is_reporting_manager")
    .eq("user_id", user.id)
    .maybeSingle();

  if (employeeError) {
    console.error("Workspace employee lookup failed:", employeeError);
    redirect("/portal");
  }

  // Ordinary employees cannot access the workspace selector.
  if (!employee || employee.is_reporting_manager !== true) {
    redirect("/portal");
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
            TEENS SOFTWARE SOLUTIONS
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Choose Your Workspace
          </h1>

          <p className="mt-3 text-slate-500">
            You have access to both your employee workspace and reporting
            manager workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link
            href="/portal"
            className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <BriefcaseBusiness className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-lg font-bold text-slate-900">
              Employee Portal
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Access your profile, attendance, leave requests, payslips and
              other employee services.
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-indigo-600">
              Continue as Employee
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/manager"
            className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-lg font-bold text-slate-900">
              Reporting Manager Portal
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Access your team workspace to manage direct reports and review
              team-related requests.
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-indigo-600">
              Continue as Reporting Manager
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}