import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PayrollMasterData from "@/components/admin/PayrollMasterData";

export const dynamic = "force-dynamic";

export default async function MasterDataPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get logged-in user's role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Failed to load user profile:", profileError);
    redirect("/login");
  }

  if (!["ceo", "hr"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return <PayrollMasterData />;
}
