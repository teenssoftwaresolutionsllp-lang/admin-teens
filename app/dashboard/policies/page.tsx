import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PolicyManagement from "@/components/PolicyManagement";

export default async function Policies() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: policies, error } = await supabase
    .from("policies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load policies:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
    });
  }

  return (
    <main className="p-6 md:p-8">
      <PolicyManagement
        initialPolicies={policies || []}
      />
    </main>
  );
}