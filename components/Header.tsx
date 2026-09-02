"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { useState } from "react";
import { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile;
}

export default function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Employees", href: "/dashboard/employees", icon: Users },
  ];

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/dashboard/employees") return "Employees";
    if (pathname === "/dashboard/employees/add" || pathname === "/dashboard/employees/new") return "Add Employee";
    if (pathname.includes("/dashboard/employees/")) return "Employee Details";
    return "Dashboard";
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
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="flex items-center gap-3 sm:border-l sm:border-slate-200 sm:pl-6">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-slate-900 leading-none mb-1.5">
              {profile.full_name || profile.email}
            </p>
            <p className="text-xs text-slate-500 capitalize leading-none">
              {profile.role === 'ceo' ? 'CEO' : 'HR Manager'}
            </p>
          </div>
          
          {profile.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt={profile.full_name || 'Avatar'} 
              className="h-9 w-9 rounded-full object-cover border border-slate-200 shadow-sm"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm">
              <span className="text-indigo-700 font-semibold text-sm">
                {getInitials(profile.full_name || profile.email)}
              </span>
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
            className="fixed inset-0 z-10 bg-slate-900/30 md:hidden"
          />
          <div className="absolute left-3 top-full z-20 mt-2 w-60 origin-top-left animate-in fade-in-0 zoom-in-95 rounded-xl border border-slate-200 bg-slate-900 text-white shadow-2xl md:hidden">
            <div className="p-3 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                      isActive ? "bg-indigo-600 text-white" : "text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium leading-none">{item.name}</span>
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-slate-200 transition-colors hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium leading-none">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
