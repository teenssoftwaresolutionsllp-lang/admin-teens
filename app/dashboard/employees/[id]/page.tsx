
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import EmployeeDetail from "@/components/EmployeeDetail";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { Employee, EmployeeDocument, UserRole } from "@/lib/types";

type EmployeeDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmployeeDetailPage(
  props: EmployeeDetailPageProps
) {
  const { id } = await props.params;

  // 1. Authenticate the current user.
  const supabase = await createClient();

  let user = null;

  try {
    const { data, error } = await supabase.auth.getUser();

    if (!error) {
      user = data?.user ?? null;
    }
  } catch {
    // Authentication failed.
  }

  if (!user) {
    return notFound();
  }

  // 2. Use the database role, never user_metadata.
  const adminClient = await createAdminClient();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !["ceo", "hr", "employee"].includes(profile.role)
  ) {
    return notFound();
  }

  const role = profile.role as UserRole;

  // 3. Employees can only access their own employee record.
  if (role === "employee") {
    const { data: currentEmployee, error: currentEmployeeError } =
      await adminClient
        .from("employees")
        .select("id, employee_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (
      currentEmployeeError ||
      !currentEmployee ||
      (id !== currentEmployee.id &&
        id !== currentEmployee.employee_id)
    ) {
      return notFound();
    }
  }

  // 4. Only after authorization, fetch the requested employee.
  const employee = await DataStore.getEmployeeById(id);

  if (!employee) {
    return notFound();
  }

  // Fetch the assigned Reporting Manager's name.
  let reportingManagerName = "Not Assigned";

  if (employee.reporting_manager_id) {
    const { data: manager, error: managerError } = await adminClient
      .from("employees")
      .select("first_name, last_name, employee_id")
      .eq("id", employee.reporting_manager_id)
      .maybeSingle();

    if (managerError) {
      console.error("Failed to fetch reporting manager:", managerError);
    } else if (manager) {
      reportingManagerName =
        `${manager.first_name ?? ""} ${manager.last_name ?? ""}`.trim() ||
        manager.employee_id ||
        "Not Assigned";
    }
  }

  const employeeWithManager = {
    ...employee,
    assigned_reporting_manager_name: reportingManagerName,
  };

  // 5. Fetch documents for the authorized employee.
  let documents: EmployeeDocument[] = [];

  try {
    const { data: fetchedDocuments, error: documentsError } =
      await adminClient
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employee.id)
        .order("uploaded_at", { ascending: false });

    if (documentsError) {
      throw documentsError;
    }

    const documentList = fetchedDocuments ?? [];

    const hasBankPassbook = documentList.some(
      (doc) =>
        doc.document_type?.trim().toLowerCase() === "bank passbook"
    );

    let bankDetails = {
      bank_name: null as string | null,
      bank_account_number: null as string | null,
      ifsc_code: null as string | null,
    };

    if (hasBankPassbook) {
      const { data: bankEmployee, error: bankError } =
        await adminClient
          .from("employees")
          .select("bank_name, bank_account_number, ifsc_code")
          .eq("id", employee.id)
          .maybeSingle();

      if (bankError) {
        throw bankError;
      }

      bankDetails = {
        bank_name: bankEmployee?.bank_name ?? null,
        bank_account_number:
          bankEmployee?.bank_account_number ?? null,
        ifsc_code: bankEmployee?.ifsc_code ?? null,
      };
    }

    documents = documentList.map((doc) => {
      const isBankPassbook =
        doc.document_type?.trim().toLowerCase() === "bank passbook";

      return {
        ...doc,
        ...(isBankPassbook ? bankDetails : {}),
      };
    }) as EmployeeDocument[];
  } catch (error) {
    console.error("Failed to load employee documents:", error);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
        <Link
          href="/dashboard"
          className="transition-colors hover:text-indigo-600"
        >
          Dashboard
        </Link>

        <ChevronRight className="h-3.5 w-3.5" />

        <Link
          href="/dashboard/employees"
          className="transition-colors hover:text-indigo-600"
        >
          Employees
        </Link>

        <ChevronRight className="h-3.5 w-3.5" />

        <span className="font-bold text-slate-900">
          {employee.first_name} {employee.last_name}
        </span>
      </nav>

      <EmployeeDetail
        employee={employeeWithManager as Employee}
        documents={documents}
        role={role}
      />
    </div>
  );
}
