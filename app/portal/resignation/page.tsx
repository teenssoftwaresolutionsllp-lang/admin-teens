
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import ResignationForm from "@/components/portal/ResignationForm";
export const dynamic = "force-dynamic";

export default async function ResignationPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const admin = await createAdminClient();

  // Match the authenticated user exactly; never fall back to another employee.
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (employeeError) {
    throw new Error("Unable to load your employee record.");
  }

  if (!employee) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">My Resignation</h1>
        <p className="mt-2 text-sm text-gray-600">
          No employee record is linked to your account. Please contact HR.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-2 text-2xl font-bold">My Resignation</h1>
      <p className="mb-6 text-sm text-gray-600">
        Submit your resignation and track its approval status.
      </p>

      <ResignationForm employeeId={employee.id} />
    </div>
  );
}
