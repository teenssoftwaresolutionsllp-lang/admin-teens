import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default async function DashboardLayout(props: LayoutProps<"/dashboard">) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
      <div className="hidden md:block">
        <Sidebar role={profile.role} currentPath="" />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header profile={profile} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="animate-fade-in h-full">
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
}
