import { createClient } from "@/lib/supabase-server";
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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = profile?.role as UserRole;

  // Fetch employee with department
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("*, department:departments(*)")
    .eq("id", id)
    .single();

  if (empError || !employee) {
    notFound();
  }

  // Fetch documents
  const { data: documents } = await supabase
    .from("employee_documents")
    .select("*")
    .eq("employee_id", id)
    .order("uploaded_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <nav className="flex items-center text-sm text-slate-500 space-x-2">
        <Link href="/dashboard" className="hover:text-indigo-600">Dashboard</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/dashboard/employees" className="hover:text-indigo-600">Employees</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">
          {employee.first_name} {employee.last_name}
        </span>
      </nav>

      <EmployeeDetail 
        employee={employee as Employee} 
        documents={(documents as EmployeeDocument[]) || []} 
        role={role} 
      />
    </div>
  );
}
