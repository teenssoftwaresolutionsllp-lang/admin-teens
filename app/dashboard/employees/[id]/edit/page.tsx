import { createClient } from "@/lib/supabase-server";
import EmployeeForm from "@/components/EmployeeForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Department, Employee, UserRole } from "@/lib/types";

export default async function EditEmployeePage(props: any) {
  const params = await props.params;
  const { id } = params;

  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = profile?.role as UserRole;

  if (role !== "ceo") {
    redirect(`/dashboard/employees/${id}`);
  }

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (empError || !employee) {
    notFound();
  }

  const { data: departments } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav className="flex items-center text-sm text-slate-500 space-x-2">
        <Link href="/dashboard" className="hover:text-indigo-600">Dashboard</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/dashboard/employees" className="hover:text-indigo-600">Employees</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/dashboard/employees/${id}`} className="hover:text-indigo-600">
          {employee.first_name} {employee.last_name}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">Edit</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Employee</h1>
        <p className="text-sm text-slate-500 mt-1">Update details for {employee.first_name} {employee.last_name}</p>
      </div>

      <EmployeeForm 
        mode="edit" 
        employee={employee as Employee} 
        departments={(departments as Department[]) || []} 
        role={role} 
      />
    </div>
  );
}
