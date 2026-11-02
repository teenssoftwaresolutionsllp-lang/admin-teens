"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

import {
  LayoutDashboard,
  Users,
  UserPlus,
  CheckSquare,
  Clock,
  CalendarDays,
  Banknote,
  Globe,
  UserCheck,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Award,
  ShieldCheck,
} from "lucide-react";

import { UserRole } from "@/lib/types";

interface SidebarProps {
  role: UserRole;
  currentPath?: string;
}

export default function Sidebar({
  role,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isCollapsed, setIsCollapsed] = useState(false);

  // SIDEBAR COLLAPSE STATE
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("sidebar-collapsed");
      setIsCollapsed(saved === "true");
    } catch (error) {
      console.error("Unable to read sidebar state:", error);
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((previous) => {
      const next = !previous;

      try {
        window.localStorage.setItem("sidebar-collapsed", String(next));
      } catch (error) {
        console.error("Unable to save sidebar state:", error);
      }

      return next;
    });
  };

  // LOGOUT
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      try {
        window.localStorage.removeItem("profile-avatar-url");
      } catch (error) {
        console.error("Unable to clear local profile photo:", error);
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // ADMIN NAVIGATION
  const adminNavItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["ceo", "hr"],
    },
    {
      name: "Employees",
      href: "/dashboard/employees",
      icon: Users,
      roles: ["ceo", "hr"],
    },
    {
      name: "Add Employee",
      href: "/dashboard/employees/add",
      icon: UserPlus,
      roles: ["hr"],
    },
    {
      name: "Approvals Hub",
      href: "/dashboard/approvals",
      icon: CheckSquare,
      roles: ["hr"],
    },
    {
      name: "Attendance & Shifts",
      href: "/dashboard/attendance",
      icon: Clock,
      roles: ["ceo", "hr"],
    },
    {
      name: "Leave Management",
      href: "/dashboard/leaves",
      icon: CalendarDays,
      roles: ["ceo", "hr"],
    },
    {
      name: "Payroll & Payslips",
      href: "/dashboard/payroll",
      icon: Banknote,
      roles: ["ceo", "hr"],
    },
    {
      name: "Projects & Calendars",
      href: "/dashboard/projects",
      icon: Globe,
      roles: ["ceo", "hr"],
    },
    {
      name: "Policies",
      href: "/dashboard/policies",
      icon: ShieldCheck,
      roles: ["ceo", "hr"],
    },
  ];

  // EMPLOYEE NAVIGATION
  const employeeNavItems = [
     {
      name: "Dashboard",
      href: "/portal",
      icon: UserCheck,
      roles: ["employee"],
    },
    {
      name: "My Profile",
      href: "/portal/profile",
      icon: UserCheck,
      roles: ["employee"],
    },
    {
      name: "Attendance",
      href: "/portal/attendance",
      icon: Clock,
      roles: ["employee"],
    },
    {
      name: "My Leaves",
      href: "/portal/leaves",
      icon: CalendarDays,
      roles: ["employee"],
    },
    {
      name: "Apply Leave",
      href: "/portal/leaves?view=apply",
      icon: CalendarDays,
      roles: ["employee"],
    },
    {
      name: "Compensations",
      href: "/portal/payslips",
      icon: FileText,
      roles: ["employee"],
    },
    {
      name: "Rewards & Recognition",
      href: "/portal/rewards",
      icon: Award,
      roles: ["employee"],
    },
    {
      name: "LMS",
      href: "/portal/lms",
      icon: UserCheck,
      roles: ["employee"],
    },
    {
      name: "Policies",
      href: "/portal/policies",
      icon: UserCheck,
      roles: ["employee"],
    },
  ];

  // SELECT NAVIGATION
  const items =
    role === "employee" ? employeeNavItems : adminNavItems;

  const visibleItems = items.filter((item) =>
    item.roles.includes(role)
  );

  // ACTIVE NAVIGATION
  const activeItem = visibleItems
    .filter(
      (item) => {
        if (item.href.startsWith("/portal/leaves")) {
          const isApplyPage = item.href.includes("view=apply");

          return (
            pathname === "/portal/leaves" &&
            (isApplyPage
              ? searchParams.get("view") === "apply"
              : searchParams.get("view") !== "apply")
          );
        }

        return (
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`)
        );
      }
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  // SIDEBAR UI
  return (
    <aside
      className={`relative flex flex-col w-full bg-slate-900 text-white flex-shrink-0 shadow-lg z-20 md:h-screen transition-[width] duration-200 ${
        isCollapsed ? "md:w-[72px]" : "md:w-64"
      }`}
    >
      {/* HEADER */}
      <div
        className={`p-4 sm:p-5 flex items-center border-b border-slate-800 ${
          isCollapsed ? "justify-center" : "gap-3"
        }`}
      >
        <div className="bg-white rounded-lg p-1 shrink-0">
          <Image
            src="/logo.png"
            alt="Teens Software Solutions Logo"
            width={50}
            height={32}
            className="object-contain"
            style={{ width: "30px", height: "auto" }}
          />
        </div>

        <div className={isCollapsed ? "hidden" : ""}>
          <span className="font-semibold text-sm sm:text-base leading-tight block">
            Teens Software
          </span>

          <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
            {role === "employee"
              ? "Employee Portal"
              : `${role?.toUpperCase() || "USER"} Workspace`}
          </span>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        {/* NAVIGATION */}
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = activeItem?.href === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`flex w-full items-center rounded-lg py-2.5 text-left transition-all duration-200 ${
                  isCollapsed ? "justify-center px-2" : "gap-3 px-3"
                } ${
                  isActive
                    ? "bg-indigo-600 text-white font-medium shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}
                />

                <span className={isCollapsed ? "sr-only" : "text-sm"}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-3 border-t border-slate-800">
        <div
          className={`flex items-center ${
            isCollapsed ? "flex-col gap-2" : "gap-2"
          }`}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            title={isCollapsed ? "Sign Out" : undefined}
            className={`flex items-center rounded-lg py-2 text-left text-slate-300 transition-colors hover:bg-slate-800 hover:text-white ${
              isCollapsed
                ? "justify-center px-2"
                : "flex-1 justify-start gap-3 px-3"
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0 text-slate-400" />

            <span
              className={
                isCollapsed
                  ? "sr-only"
                  : "text-sm font-medium leading-none"
              }
            >
              Sign Out
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}