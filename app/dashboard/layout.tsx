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
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar role={profile.role} currentPath="" />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header profile={profile} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="animate-fade-in h-full">
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
}
