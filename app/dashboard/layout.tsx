import { createClient } from "@/lib/supabase-server";
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

  return (
    <EmployeeFilterProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-slate-50 md:flex-row">
        <div className="hidden md:block">
          <Sidebar role={profile.role} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header profile={profile} />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="animate-fade-in h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </EmployeeFilterProvider>
  );
}
