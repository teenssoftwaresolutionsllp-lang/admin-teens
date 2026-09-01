import { createClient } from "@/lib/supabase-server";
import EmployeeForm from "@/components/EmployeeForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { Department, UserRole } from "@/lib/types";

export default async function AddEmployeePage() {
  const supabase = await createClient();

  // Get current user session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = profile?.role as UserRole;

  // Fetch departments
  const { data: departments } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-slate-500 space-x-2">
        <Link href="/dashboard" className="hover:text-indigo-600">Dashboard</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/dashboard/employees" className="hover:text-indigo-600">Employees</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">Add New Employee</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add New Employee</h1>
        <p className="text-sm text-slate-500 mt-1">Fill in the details to add a new employee to the organization.</p>
      </div>

      <EmployeeForm mode="add" departments={(departments as Department[]) || []} role={role} />
    </div>
  );
}
