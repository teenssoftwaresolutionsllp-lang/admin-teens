"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile;
}

export default function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  
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

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 flex-shrink-0 z-10 sticky top-0">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-6">
        <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
          <div className="text-right hidden sm:block">
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
    </header>
  );
}
