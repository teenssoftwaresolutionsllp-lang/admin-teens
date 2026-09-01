"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, UserPlus, LogOut } from "lucide-react";
import Image from "next/image";
import { UserRole } from "@/lib/types";

interface SidebarProps {
  role: UserRole;
  currentPath: string;
}

export default function Sidebar({ role, currentPath }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ceo", "hr"] },
    { name: "Employees", href: "/dashboard/employees", icon: Users, roles: ["ceo", "hr"] },
    { name: "Add Employee", href: "/dashboard/employees/new", icon: UserPlus, roles: ["hr"] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  return (
    <div className="flex flex-col h-screen w-64 bg-slate-900 text-white flex-shrink-0 shadow-lg z-20">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-white rounded-lg p-1 shrink-0">
          <Image src="/logo.png" alt="Teens Software Solutions Logo" width={50} height={32} className="object-contain" style={{ width: "30px", height: "auto" }} />
        </div>
        <span className="font-semibold text-base leading-tight">Teens Software Solutions</span>
      </div>

      <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive 
                  ? "bg-indigo-600 text-white font-medium" 
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="mb-4 px-2">
          {role === 'ceo' ? (
            <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500 ring-1 ring-inset ring-amber-500/20">
              CEO
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
              HR Manager
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5 text-slate-400" />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
}
