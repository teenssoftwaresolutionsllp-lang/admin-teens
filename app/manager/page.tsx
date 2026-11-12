import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ArrowLeft, ShieldCheck } from "lucide-react";

export default async function ManagerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify the authoritative application role.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/portal");
  }

  const role = String(profile.role || "").toLowerCase();

  // The manager workspace is for designated employee accounts.
  if (role !== "employee") {
    redirect(role === "hr" || role === "ceo" ? "/dashboard" : "/portal");
  }

  // Verify manager permission on every server-side page request.
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, first_name, last_name, is_reporting_manager")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    employeeError ||
    !employee ||
    employee.is_reporting_manager !== true
  ) {
    redirect("/portal");
  }

  const managerName = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Switch Workspace
        </Link>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Reporting Manager Portal
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Welcome{managerName ? `, ${managerName}` : ""}.
            You are accessing your Reporting Manager workspace.
          </p>

          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-semibold">
                Manager access verified
              </span>
            </div>
            <p className="mt-1 text-sm text-emerald-700">
              Your reporting manager permission is active.
            </p>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Team management features will appear here as they are implemented.
          </p>
        </section>
      </div>
    </main>
  );
}