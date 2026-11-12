import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { EmployeeFilterProvider } from "@/components/dashboard/EmployeeFilterProvider";
import { Profile, UserRole } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: dbProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile: Profile = dbProfile || {
    id: user.id,
    email: user.email || "",
    full_name:
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User",
    role: (user.user_metadata?.role as UserRole) || "hr",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (profile.role === "employee") {
    redirect("/portal");
  }

  const adminClient = await createAdminClient();
  const { data: employeeByUserId, error: employeeLookupError } =
    await adminClient
      .from("employees")
      .select("designation")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

  if (employeeLookupError) {
    throw new Error(
      `Unable to load employee designation: ${employeeLookupError.message}`
    );
  }

  let employeeDesignation = employeeByUserId?.designation ?? null;

  if (!employeeDesignation && profile.email) {
    const { data: employeeByEmail, error: employeeEmailLookupError } =
      await adminClient
        .from("employees")
        .select("designation")
        .eq("email", profile.email)
        .limit(1)
        .maybeSingle();

    if (employeeEmailLookupError) {
      throw new Error(
        `Unable to load employee designation: ${employeeEmailLookupError.message}`
      );
    }

    employeeDesignation = employeeByEmail?.designation ?? null;
  }

  return (
    <EmployeeFilterProvider>
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 md:flex-row">
        <div className="hidden md:block">
          <Sidebar role={profile.role} designation={employeeDesignation} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Header profile={profile} />

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="animate-fade-in min-h-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </EmployeeFilterProvider>
  );
}