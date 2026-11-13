import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const adminClient = await createAdminClient();

    const { data: employees, error } = await adminClient
      .from("employees")
      .select("employee_id")
      .like("employee_id", "TN%");

    if (error) {
      throw new Error(error.message);
    }

    let nextNumber = 5000;

    if (employees && employees.length > 0) {
      const numbers = employees
        .map((employee) => {
          const match = employee.employee_id?.match(/^TN(\d+)$/);
          return match ? Number(match[1]) : null;
        })
        .filter((number): number is number => number !== null);

      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    return NextResponse.json({
      employee_id: `TN${nextNumber}`,
    });
  } catch (error: unknown) {
    console.error("Error generating employee ID:", error);

    const message = error instanceof Error ? error.message : "Failed to generate employee ID";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}