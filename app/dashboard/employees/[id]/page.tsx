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
  const params = await props.params;
  const { id } = params;

  const supabase = await createClient();
  let user = null;

  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch {
    // Ignore authentication lookup errors.
  }

  if (!user) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      user = session?.user || null;
    } catch {
      // Ignore session lookup errors.
    }
  }

  if (!user) {
    return notFound();
  }

  const role = (user.user_metadata?.role as UserRole) || "hr";

  // Fetch employee.
  const employee = await DataStore.getEmployeeById(id);

  if (!employee) {
    notFound();
  }

  // Fetch documents and enrich Bank Passbook with employee bank details.
  let documents: EmployeeDocument[] = [];

  try {
    const adminClient = await createAdminClient();

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
      const { data: bankEmployee, error: bankError } = await adminClient
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
        employee={employee as Employee}
        documents={documents}
        role={role}
      />
    </div>
  );
}

