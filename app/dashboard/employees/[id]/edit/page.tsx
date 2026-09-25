import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeForm from "@/components/EmployeeForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Department, Employee, UserRole } from "@/lib/types";

export default async function EditEmployeePage(props: any) {
  const params = await props.params;
  const { id } = params;

  const supabase = await createClient();
  let user = null;

  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch {
    // ignore
  }

  if (!user) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      user = session?.user || null;
    } catch {
      // ignore
    }
  }

  const role = (user?.user_metadata?.role as UserRole) || "hr";

  if (role !== "ceo" && role !== "hr") {
    redirect(`/dashboard/employees/${id}`);
  }

  const employee = await DataStore.getEmployeeById(id);

  if (!employee) {
    notFound();
  }

  const projects = await DataStore.getProjects();

  let departments: Department[] = [];
  try {
    const adminClient = await createAdminClient();
    const { data } = await adminClient
      .from("departments")
      .select("*")
      .order("name");
    departments = (data as Department[]) || [];
    if (departments.length === 0) {
      const createdAt = new Date().toISOString();
      departments = [
        { id: "d1", name: "Engineering", description: "Software development and engineering", created_at: createdAt },
        { id: "d2", name: "Design", description: "UI/UX and product design", created_at: createdAt },
        { id: "d3", name: "Marketing", description: "Marketing and communications", created_at: createdAt },
        { id: "d4", name: "Sales", description: "Sales and business development", created_at: createdAt },
        { id: "d5", name: "HR", description: "Human Resources and Operations", created_at: createdAt },
        { id: "d6", name: "Finance", description: "Finance and Accounting", created_at: createdAt },
        { id: "d7", name: "Operations", description: "Business operations", created_at: createdAt },
      ];
    }
  } catch {
    const createdAt = new Date().toISOString();
    departments = [
      { id: "d1", name: "Engineering", description: "Software development and engineering", created_at: createdAt },
      { id: "d2", name: "Design", description: "UI/UX and product design", created_at: createdAt },
      { id: "d3", name: "Marketing", description: "Marketing and communications", created_at: createdAt },
      { id: "d4", name: "Sales", description: "Sales and business development", created_at: createdAt },
      { id: "d5", name: "HR", description: "Human Resources and Operations", created_at: createdAt },
      { id: "d6", name: "Finance", description: "Finance and Accounting", created_at: createdAt },
      { id: "d7", name: "Operations", description: "Business operations", created_at: createdAt },
    ];
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav className="flex items-center text-xs font-semibold text-slate-400 space-x-2">
        <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/dashboard/employees" className="hover:text-indigo-600 transition-colors">Employees</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href={`/dashboard/employees/${id}`} className="hover:text-indigo-600 transition-colors">
          {employee.first_name} {employee.last_name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 font-bold">Edit Profile</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Employee</h1>
        <p className="text-xs text-slate-500 mt-1">Update profile details and compensation for {employee.first_name} {employee.last_name}</p>
      </div>

      <EmployeeForm 
        mode="edit" 
        employee={employee as Employee} 
        departments={departments} 
        projects={projects}
        role={role} 
      />
    </div>
  );
}

