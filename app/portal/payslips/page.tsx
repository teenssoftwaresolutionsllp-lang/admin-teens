import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeePayslipsView from "@/components/portal/EmployeePayslipsView";
import { redirect } from "next/navigation";

export default async function EmployeePayslipsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // First try the direct user_id lookup.
  let employee = await DataStore.getEmployeeByUserId(user.id);

  // Fallback only if user_id lookup fails.
  if (!employee) {
    const allEmployees = await DataStore.getEmployees();

    const userEmail = user.email?.trim().toLowerCase();

    employee =
      allEmployees.find(
        (e) => e.email?.trim().toLowerCase() === userEmail
      ) ||
      allEmployees[0] ||
      null;
  }

  if (!employee) {
    return (
      <div className="p-8 text-center text-slate-500">
        Employee not found.
      </div>
    );
  }

  // Employee is now known, so fetch only this employee's payslips.
  const payslips = await DataStore.getPayslips(employee.id);

  return (
    <EmployeePayslipsView
      employee={employee}
      payslips={payslips}
    />
  );
}