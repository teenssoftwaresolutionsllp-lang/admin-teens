"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile;
}

export default function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getPageTitle = () => {
    if (pathname === "/dashboard") return profile.role === "ceo" ? "Executive CEO Overview" : "HR Operations Dashboard";
    if (pathname === "/dashboard/employees") return "Employee Directory";
    if (pathname === "/dashboard/employees/add" || pathname === "/dashboard/employees/new") return "Add New Employee";
    if (pathname.includes("/dashboard/employees/")) return "Employee Profile Details";
    if (pathname === "/dashboard/approvals") return "Approvals Hub";
    if (pathname === "/dashboard/attendance") return "Company Attendance & Shifts";
    if (pathname === "/dashboard/leaves") return "Leave Policy & Balances";
    if (pathname === "/dashboard/payroll") return "Payroll & Salary Processing";
    if (pathname === "/dashboard/projects") return "Projects & Multi-Country Calendars";
    
    // Employee ESS titles
    if (pathname === "/portal") return "Employee Self-Service Dashboard";
    if (pathname === "/portal/profile") return "My Employee Profile";
    if (pathname === "/portal/attendance") return "My Attendance & Check-In";
    if (pathname === "/portal/leaves") return "My Leaves & Holidays";
    if (pathname === "/portal/payslips") return "My Salary & Payslips";

    return "Teens Software Portal";
  };

  const getRoleBadge = (role: string) => {
    if (role === "ceo") return { label: "CEO / Executive", color: "bg-purple-100 text-purple-800" };
    if (role === "hr") return { label: "HR Administrator", color: "bg-indigo-100 text-indigo-800" };
    return { label: "Employee", color: "bg-emerald-100 text-emerald-800" };
  };

  const getInitials = (name: string) => {
    return name
      ? name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
      : "U";
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const badge = getRoleBadge(profile.role);

  return (
    <header className="relative bg-white border-b border-slate-200 h-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-0 sm:h-16 flex-shrink-0 z-20 sticky top-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Toggle navigation menu"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-3 sm:border-l sm:border-slate-200 sm:pl-5">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-slate-900 leading-none mb-1">
              {profile.full_name || profile.email}
            </p>
            <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
              {badge.label}
            </span>
          </div>

          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || "Avatar"}
              className="h-9 w-9 rounded-full object-cover border border-slate-200 shadow-sm"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm text-indigo-700 font-bold text-xs">
              {getInitials(profile.full_name || profile.email)}
            </div>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-10 bg-slate-900/40 md:hidden"
          />
          <div className="absolute left-3 top-full z-20 mt-2 w-64 origin-top-left rounded-xl border border-slate-700 bg-slate-900 text-white shadow-2xl md:hidden p-3 space-y-2">
            <div className="px-3 py-2 border-b border-slate-800 mb-2">
              <p className="text-sm font-semibold text-white">{profile.full_name || profile.email}</p>
              <p className="text-xs text-slate-400 capitalize">{profile.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-red-400 transition-colors hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </>
      )}
    </header>
  );
}
