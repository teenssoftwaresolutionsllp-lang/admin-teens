import { createClient, createAdminClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const admin = await createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || !["hr", "ceo"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Only HR and CEO can update attendance settings." },
        { status: 403 }
      );
    }

    const body = await request.json();

    // GLOBAL SETTING
    if (body.scope === "global") {
      const enabled =
        body.countApprovedLeavesTowardWeeklyMinimum;

      if (typeof enabled !== "boolean") {
        return NextResponse.json(
          { error: "Invalid global attendance setting value." },
          { status: 400 }
        );
      }

      const { error: saveError } = await admin
        .from("attendance_settings")
        .upsert(
          {
            setting_key: "global",
            employee_id: null,
            count_approved_leaves_toward_weekly_minimum: enabled,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );

      if (saveError) throw saveError;

      return NextResponse.json({
        success: true,
        scope: "global",
        settingKey: "global",
        countApprovedLeavesTowardWeeklyMinimum: enabled,
      });
    }

    // EMPLOYEE SETTING
    if (body.scope === "employee") {
      const employeeId = body.employeeId;

      if (
        typeof employeeId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          employeeId
        )
      ) {
        return NextResponse.json(
          { error: "Invalid employee ID." },
          { status: 400 }
        );
      }

      const { data: employee, error: employeeError } = await admin
        .from("employees")
        .select("id")
        .eq("id", employeeId)
        .maybeSingle();

      if (employeeError) throw employeeError;

      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found." },
          { status: 404 }
        );
      }

      const settingKey = `employee:${employeeId}`;

      // RESET EMPLOYEE OVERRIDE: restore global inheritance
      if (body.reset === true) {
        const { error: deleteError } = await admin
          .from("attendance_settings")
          .delete()
          .eq("setting_key", settingKey);

        if (deleteError) throw deleteError;

        return NextResponse.json({
          success: true,
          scope: "employee",
          reset: true,
          settingKey,
          employeeId,
          message: "Employee now uses the global setting.",
        });
      }

      const enabled =
        body.countApprovedLeavesTowardWeeklyMinimum;

      if (typeof enabled !== "boolean") {
        return NextResponse.json(
          { error: "Invalid employee attendance setting value." },
          { status: 400 }
        );
      }

      const { error: saveError } = await admin
        .from("attendance_settings")
        .upsert(
          {
            setting_key: settingKey,
            employee_id: employeeId,
            count_approved_leaves_toward_weekly_minimum: enabled,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );

      if (saveError) throw saveError;

      return NextResponse.json({
        success: true,
        scope: "employee",
        settingKey,
        employeeId,
        countApprovedLeavesTowardWeeklyMinimum: enabled,
      });
    }

    return NextResponse.json(
      { error: "Invalid setting scope." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Attendance settings update failed:", error);

    return NextResponse.json(
      { error: "Unable to update attendance settings." },
      { status: 500 }
    );
  }
}
