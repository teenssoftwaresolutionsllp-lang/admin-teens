import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient, createAdminClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile || (profile.role !== 'hr' && profile.role !== 'ceo')) {
      return NextResponse.json({ error: 'Only HR and CEO can view master salary components.' }, { status: 403 });
    }

    const components = await DataStore.getSalaryComponents();
    return NextResponse.json(components);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load components";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || (profile.role !== "hr" && profile.role !== "ceo")) {
      return NextResponse.json(
        { error: "Only HR and CEO can update master salary components." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      id,
      name,
      code,
      type,
      calculation_type,
      value,
      affects_lop,
      is_active,
      description
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Salary component id is required." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      updates.name = String(name).trim();
    }

    if (code !== undefined) {
      updates.code = String(code).trim().toUpperCase();
    }

    if (type !== undefined) {
      if (!["earning", "deduction"].includes(type)) {
        return NextResponse.json(
          { error: "Invalid component type." },
          { status: 400 }
        );
      }

      updates.type = type;
    }

    if (calculation_type !== undefined) {
      if (
        ![
          "fixed",
          "percentage_of_basic",
          "percentage_of_gross"
        ].includes(calculation_type)
      ) {
        return NextResponse.json(
          { error: "Invalid calculation type." },
          { status: 400 }
        );
      }

      updates.calculation_type = calculation_type;
    }

    if (value !== undefined) {
      const numericValue = Number(value);

      if (!Number.isFinite(numericValue) || numericValue < 0) {
        return NextResponse.json(
          { error: "Value must be a valid positive number." },
          { status: 400 }
        );
      }

      updates.value = numericValue;
    }

    if (affects_lop !== undefined) {
      if (typeof affects_lop !== "boolean") {
        return NextResponse.json(
          { error: "affects_lop must be a boolean." },
          { status: 400 }
        );
      }

      updates.affects_lop = affects_lop;
    }

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return NextResponse.json(
          { error: "is_active must be a boolean." },
          { status: 400 }
        );
      }

      updates.is_active = is_active;
    }

    if (description !== undefined) {
      updates.description = String(description).trim();
    }

    const adminSupabase = await createAdminClient();

    const { data, error } = await adminSupabase
      .from("salary_components")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Salary component update error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      component: data
    });
  } catch (error: unknown) {
    console.error("Salary component PATCH error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to update salary component";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}