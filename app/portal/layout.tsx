import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Profile, UserRole } from "@/lib/types";
import { DataStore } from "@/lib/data-store";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {data: { user }} = await supabase.auth.getUser();

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
    full_name: user.user_metadata?.full_name || "Balaji Marpally",
    role: (user.user_metadata?.role as UserRole) || "employee",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let avatarUrl: string | null = null; try { 
    let employee = await DataStore.getEmployeeByUserId(user.id);
    if (!employee && user.email) 
      { 
        const employees = await DataStore.getEmployees(); 
        employee = employees.find( (item) => item.email?.toLowerCase() === user.email?.toLowerCase() ) || null; 
      } 
    avatarUrl = employee?.profile_photo_url || null;
   } 
   catch (error) 
    { 
      console.error("Unable to load employee profile photo:", error); 
    }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
      <div className="hidden md:block">
        <Sidebar role="employee" avatarUrl={avatarUrl}/>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header profile={{ ...profile, role: "employee" }} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="animate-fade-in h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
