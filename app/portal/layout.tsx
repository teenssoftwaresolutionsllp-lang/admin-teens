
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase-server";

import { redirect } from "next/navigation";
import type { Profile, UserRole } from "@/lib/types";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { EmployeeFilterProvider } from "@/components/dashboard/EmployeeFilterProvider";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // ==========================================
  // LOAD EMPLOYEE PROFILE
  // ==========================================

  const { data: dbProfile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Unable to load employee profile: ${profileError.message}`
    );
  }

  // Employee portal always uses employee navigation.
  const employeeRole: UserRole = "employee";

  const profile: Profile = {
    id: user.id,
    email: user.email || "",
    full_name:
      dbProfile?.full_name ||
      user.user_metadata?.full_name ||
      "Employee",
    role: employeeRole,
    avatar_url: dbProfile?.avatar_url ?? null,
    created_at: dbProfile?.created_at ?? user.created_at,
    updated_at: dbProfile?.updated_at ?? user.created_at,
  };

  // ==========================================
  // LOAD EMPLOYEE DETAILS
  // ==========================================

  const adminClient = await createAdminClient();

  let employeePhotoUrl: string | null = null;
  let employeeDesignation: string | null = null;

  const { data: employeeByUserId, error: userLookupError } =
    await adminClient
      .from("employees")
      .select("profile_photo_url, designation")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

  if (userLookupError) {
    throw new Error(
      `Unable to load employee details: ${userLookupError.message}`
    );
  }

  employeePhotoUrl = employeeByUserId?.profile_photo_url ?? null;
  employeeDesignation = employeeByUserId?.designation ?? null;

  // If either field is missing, try the email lookup.
  if (
    (!employeePhotoUrl || !employeeDesignation) &&
    profile.email
  ) {
    const { data: employeeByEmail, error: emailLookupError } =
      await adminClient
        .from("employees")
        .select("profile_photo_url, designation")
        .eq("email", profile.email)
        .limit(1)
        .maybeSingle();

    if (emailLookupError) {
      throw new Error(
        `Unable to load employee details by email: ${emailLookupError.message}`
      );
    }

    employeePhotoUrl =
      employeePhotoUrl ??
      employeeByEmail?.profile_photo_url ??
      null;

    employeeDesignation =
      employeeDesignation ??
      employeeByEmail?.designation ??
      null;
  }

  // ==========================================
  // EMPLOYEE PORTAL
  // ==========================================

  return (
    <EmployeeFilterProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-slate-50 md:flex-row">

        {/* SIDEBAR */}

        <div className="hidden md:block">
          <Sidebar
            role={employeeRole}
            avatarUrl={employeePhotoUrl}
            designation={employeeDesignation}
          />
        </div>

        {/* MAIN CONTENT */}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          <Header
            profile={{
              ...profile,
              role: employeeRole,
              avatar_url:
                employeePhotoUrl ?? profile.avatar_url,
            }}
          />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="animate-fade-in h-full">
              {children}
            </div>
          </main>

        </div>
      </div>
    </EmployeeFilterProvider>
  );
}
