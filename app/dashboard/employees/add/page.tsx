import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeForm from "@/components/EmployeeForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { Department, UserRole } from "@/lib/types";

export default async function AddEmployeePage() {
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
  const projects = await DataStore.getProjects();
  const generatedEmployeeId = await DataStore.getNextEmployeeId();

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
      {/* Breadcrumbs */}
      <nav className="flex items-center text-xs font-semibold text-slate-400 space-x-2">
        <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/dashboard/employees" className="hover:text-indigo-600 transition-colors">Employees</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 font-bold">Add New Employee</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add New Employee</h1>
        <p className="text-xs text-slate-500 mt-1">Fill in the details to add a new employee to the organization and provision portal credentials.</p>
      </div>

      <EmployeeForm mode="add" departments={departments} projects={projects} generatedEmployeeId={generatedEmployeeId} role={role} />
    </div>
  );
}

