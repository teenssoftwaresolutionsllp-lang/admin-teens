
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    // Fetch the requested employee's documents.
    const { data: documents, error: documentsError } = await supabase
      .from("employee_documents")
      .select(`
        id,
        employee_id,
        document_type,
        document_name,
        document_url,
        uploaded_at,
        verification_status,
        previous_document_id,
        aadhaar_number,
        pan_number,
        passport_number
      `)
      .eq("employee_id", employeeId)
      .order("uploaded_at", { ascending: false });

    if (documentsError) {
      console.error("Failed to fetch documents:", documentsError);

      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    const normalizeType = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

    const visibleDocuments = (documents ?? []).filter((doc) => {
    const status = normalizeType(doc.verification_status);

    // Never display an old version after it has been superseded.
    if (status === "superseded") return false;

    return true;
    });

    const hasBankPassbook = visibleDocuments.some(
      (doc) => normalizeType(doc.document_type) === "bank passbook"
    );

    let bankDetails = {
      bank_name: null as string | null,
      bank_account_number: null as string | null,
      ifsc_code: null as string | null,
    };

    if (hasBankPassbook) {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("bank_name, bank_account_number, ifsc_code")
        .eq("id", employeeId)
        .maybeSingle();

      if (employeeError) {
        console.error("Failed to fetch employee bank details:", employeeError);

        return NextResponse.json(
          { error: "Failed to fetch employee bank details" },
          { status: 500 }
        );
      }

      if (employee) {
        bankDetails = {
          bank_name: employee.bank_name ?? null,
          bank_account_number: employee.bank_account_number ?? null,
          ifsc_code: employee.ifsc_code ?? null,
        };
      } else {
        console.warn(
          "No employee row found for the supplied employee UUID."
        );
      }
    }

    const result = visibleDocuments.map((doc) =>
      normalizeType(doc.document_type) === "bank passbook"
        ? { ...doc, ...bankDetails }
        : doc
    );

    return NextResponse.json(
      { documents: result },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/documents error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}