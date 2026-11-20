import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ChangePasswordForm from "@/components/ChangePasswordForm"

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    redirect("/login");
  }

  if (
    profile.role !== "employee" ||
    profile.must_change_password !== true
  ) {
    if (profile.role === "employee") {
      const { data: employee } = await supabase
        .from("employees")
        .select("is_reporting_manager")
        .eq("user_id", user.id)
        .maybeSingle();

      redirect(
        employee?.is_reporting_manager
          ? "/workspace"
          : "/portal"
      );
    }

    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <ChangePasswordForm />
      </div>
    </main>
  );
}
