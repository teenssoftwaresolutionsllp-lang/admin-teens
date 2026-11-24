import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify the authenticated user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Your session has expired. Please log in again." },
        { status: 401 }
      );
    }

    // Read the employee profile and mandatory-change flag.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Unable to verify your employee account." },
        { status: 500 }
      );
    }

    if (
      profile.role !== "employee" ||
      profile.must_change_password !== true
    ) {
      return NextResponse.json(
        { error: "A mandatory password change is not pending for this account." },
        { status: 403 }
      );
    }

    // Validate the requested password.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const newPassword =
      typeof body === "object" &&
      body !== null &&
      "newPassword" in body &&
      typeof body.newPassword === "string"
        ? body.newPassword
        : "";

    if (!newPassword) {
      return NextResponse.json(
        { error: "Please enter your new password." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Your new password must contain at least 8 characters." },
        { status: 400 }
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "Your password cannot exceed 128 characters." },
        { status: 400 }
      );
    }

    // Update the authenticated user's Supabase Auth password.
    const { error: passwordError } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (passwordError) {
      return NextResponse.json(
        { error: passwordError.message || "Unable to update your password." },
        { status: 400 }
      );
    }

    // Clear the mandatory-change flag only after Auth password update succeeds.
    const admin = await createAdminClient();

    const { data: updatedProfile, error: updateError } = await admin
      .from("profiles")
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .eq("role", "employee")
      .eq("must_change_password", true)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      console.error(
        "Password changed, but employee password-change flag could not be cleared:",
        updateError?.message ?? "Profile was not updated."
      );

      return NextResponse.json(
        {
          error:
            "Your password was updated, but account setup could not be completed. Please submit your new password again or contact HR.",
        },
        { status: 500 }
      );
    }

    const { data: employee } = await admin
        .from("employees")
        .select("is_reporting_manager")
        .eq("user_id", user.id)
        .maybeSingle();

    return NextResponse.json({
        success: true,
        message: "Your password has been changed successfully.",
        redirectTo: employee?.is_reporting_manager
            ? "/workspace"
            : "/portal",
    });
  } catch (error) {
    console.error("Change password API error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while changing your password." },
      { status: 500 }
    );
  }
}
