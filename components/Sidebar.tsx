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
    { name: "Add Employee", href: "/dashboard/employees/add", icon: UserPlus, roles: ["hr"] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className="flex flex-col w-full bg-slate-900 text-white flex-shrink-0 shadow-lg z-20 md:h-screen md:w-64">
      <div className="p-4 sm:p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-white rounded-lg p-1 shrink-0">
          <Image src="/logo.png" alt="Teens Software Solutions Logo" width={50} height={32} className="object-contain" style={{ width: "30px", height: "auto" }} />
        </div>
        <span className="font-semibold text-sm sm:text-base leading-tight">Teens Software Solutions</span>
      </div>

      <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const isEmployeeSection = item.href === "/dashboard/employees";
          const isEmployeeChild = isEmployeeSection && pathname.startsWith(`${item.href}/`)
            && !pathname.startsWith(`${item.href}/add`)
            && !pathname.startsWith(`${item.href}/new`);
          const isActive = pathname === item.href || isEmployeeChild;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-200 ${
                isActive 
                  ? "bg-indigo-600 text-white font-medium shadow-sm" 
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span className="text-sm leading-none">{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-3 sm:p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-start gap-3 rounded-lg px-3 py-3 text-left text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="text-sm font-medium leading-none">Logout</span>
        </button>
      </div>
    </aside>
  );
}
