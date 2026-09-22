import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeDetail from "@/components/EmployeeDetail";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Employee, EmployeeDocument, UserRole } from "@/lib/types";

type EmployeeDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmployeeDetailPage(props: EmployeeDetailPageProps) {
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

  // Fetch employee using DataStore (supports DB fallback + in-memory store)
  const employee = await DataStore.getEmployeeById(id);

  if (!employee) {
    notFound();
  }

  // Fetch documents
  let documents: EmployeeDocument[] = [];
  try {
    const adminClient = await createAdminClient();
    const { data } = await adminClient
      .from("employee_documents")
      .select("*")
      .eq("employee_id", employee.id)
      .order("uploaded_at", { ascending: false });
    documents = (data as EmployeeDocument[]) || [];
  } catch {
    // ignore
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <nav className="flex items-center text-xs font-semibold text-slate-400 space-x-2">
        <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/dashboard/employees" className="hover:text-indigo-600 transition-colors">Employees</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 font-bold">
          {employee.first_name} {employee.last_name}
        </span>
      </nav>

      <EmployeeDetail 
        employee={employee as Employee} 
        documents={documents} 
        role={role} 
      />
    </div>
  );
}

