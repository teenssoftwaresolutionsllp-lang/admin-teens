
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
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

    // 2. Get logged-in user's role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 403 }
      );
    }

    const role = String(profile.role ?? "")
      .trim()
      .toLowerCase();

    const isHR = ["hr", "ceo"].includes(role);

    // 3. Get employee ID from query
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    // 4. Verify employee access
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select(
        "id, user_id, email, bank_name, bank_account_number, ifsc_code"
      )
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup error:", employeeError);

      return NextResponse.json(
        { error: "Unable to verify employee." },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    const isOwner =
      String(employee.user_id ?? "") === String(user.id) ||
      (
        !!user.email &&
        String(employee.email ?? "").trim().toLowerCase() ===
          user.email.trim().toLowerCase()
      );

    if (!isHR && !isOwner) {
      return NextResponse.json(
        { error: "You are not allowed to view these documents." },
        { status: 403 }
      );
    }

    // 5. Fetch employee documents
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
        profile_change_request_id,
        profile_change_approved,
        aadhaar_number,
        pan_number,
        passport_number
      `)
      .eq("employee_id", employeeId)
      .order("uploaded_at", { ascending: false });

    if (documentsError) {
      console.error("Failed to fetch documents:", documentsError);

      return NextResponse.json(
        { error: "Failed to fetch documents." },
        { status: 500 }
      );
    }

    const normalizeType = (
      value: string | null | undefined
    ) => value?.trim().toLowerCase() ?? "";

    // 6. Hide superseded documents
    const visibleDocuments = (documents ?? []).filter((doc) => {
      const status = normalizeType(doc.verification_status);

      return status !== "superseded";
    });

    // 7. Check for bank passbook
    const hasBankPassbook = visibleDocuments.some(
      (doc) =>
        normalizeType(doc.document_type) === "bank passbook"
    );

    let bankDetails = {
      bank_name: null as string | null,
      bank_account_number: null as string | null,
      ifsc_code: null as string | null,
    };

    // 8. Include bank details when a passbook exists
    if (hasBankPassbook) {
      bankDetails = {
        bank_name: employee.bank_name ?? null,
        bank_account_number: employee.bank_account_number ?? null,
        ifsc_code: employee.ifsc_code ?? null,
      };
    }

    // 9. Attach bank details to bank passbook
    const result = visibleDocuments.map((doc) =>
      normalizeType(doc.document_type) === "bank passbook"
        ? { ...doc, ...bankDetails }
        : doc
    );

    // 10. Return documents
    return NextResponse.json(
      {
        success: true,
        documents: result,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: unknown) {
    console.error("GET /api/documents error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}
