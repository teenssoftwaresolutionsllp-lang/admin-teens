import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import ApprovalsHub from "@/components/admin/ApprovalsHub";
import { redirect } from "next/navigation";
import type { ResignationRequest, Employee } from "@/lib/types";

export default async function ApprovalsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Only HR and CEO can access the approvals page.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = String(profile?.role ?? "").toLowerCase();

  if (role !== "hr" && role !== "ceo") {
    redirect("/dashboard");
  }

  const [
    profileRequests,
    leaveRequests,
    regularizations,
  ] = await Promise.all([
    DataStore.getProfileChangeRequests(),
    DataStore.getLeaveRequests(),
    DataStore.getAttendanceRegularizations(),
  ]);

  // Load resignation requests.
  const admin = await createAdminClient();

  const { data: resignationRows, error: resignationError } =
    await admin
      .from("resignation_requests")
      .select("*")
      .order("created_at", { ascending: false });

  if (resignationError) {
    console.error(
      "Failed to load resignation requests:",
      resignationError
    );
    throw new Error("Failed to load resignation requests.");
  }

  const rows = resignationRows ?? [];

  const employeeIds = [
    ...new Set(
      rows
        .map((request) => request.employee_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let employees: Employee[] = [];

  if (employeeIds.length > 0) {
    const { data: employeeRows, error: employeeError } =
      await admin
        .from("employees")
        .select(`
          *,
          department:departments (
            id,
            name
          )
        `)
        .in("id", employeeIds);

    if (employeeError) {
      console.error(
        "Failed to load resignation employees:",
        employeeError
      );
      throw new Error(
        "Failed to load resignation employee details."
      );
    }

    employees = (employeeRows ?? []) as Employee[];
  }



  const { data: revertRows, error: revertError } = await admin
    .from("resignation_revert_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (revertError) {
    console.error("Failed to load resignation reversal requests:", revertError);
    throw new Error("Failed to load resignation reversal requests.");
  }

  const revertRequests = revertRows ?? [];


  // Include the employee's saved notice fields at the top level
  // as well as under request.employee.
  
  const initialResignationRequests = rows.map((request) => {
    const employee = employees.find(
      (item) => item.id === request.employee_id
    );

    return {
      ...request,
      employee,
      notice_period_days:
        employee?.notice_period_days ??
        request.notice_period_days ??
        null,
      planned_last_working_date:
        employee?.planned_last_working_date ??
        request.planned_last_working_date ??
        null,
      revert_requests: revertRequests.filter(
        (revert) => revert.resignation_request_id === request.id
      ),
    };
  }) as ResignationRequest[];


  return (
    <ApprovalsHub
      initialProfileRequests={profileRequests}
      initialLeaveRequests={leaveRequests}
      initialRegularizations={regularizations}
      initialResignationRequests={initialResignationRequests}
    />
  );
}
