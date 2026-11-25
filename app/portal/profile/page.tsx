
import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeProfileView from "@/components/portal/EmployeeProfileView";
import { redirect } from "next/navigation";

export default async function EmployeeProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const employee =
    (await DataStore.getEmployeeByUserId(user.id)) ??
    (user.email
      ? await DataStore.getEmployeeByEmail(user.email)
      : null);

  if (!employee) {
    return (
      <div className="p-8 text-center text-slate-500">
        Employee record not found.
      </div>
    );
  }

  const [changeRequests, departmentResult, educationResult] =
    await Promise.all([
      DataStore.getProfileChangeRequests(),
      supabase.from("departments").select("*").order("name"),
      supabase
        .from("employee_education")
        .select("*")
        .eq("employee_id", employee.id)
        .order("year_of_passing", { ascending: true }),
    ]);

  if (educationResult.error) {
    console.error(
      "Failed to load employee portal education:",
      educationResult.error
    );
  }

  const pendingRequest =
    changeRequests.find(
      (request) =>
        request.employee_id === employee.id &&
        request.status === "pending"
    ) || null;

  return (
    <EmployeeProfileView
      employee={employee}
      pendingRequest={pendingRequest}
      departments={departmentResult.data || []}
      educationRecords={educationResult.data || []}
    />
  );
}
