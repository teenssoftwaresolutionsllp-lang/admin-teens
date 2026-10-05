"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  Calendar,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UploadCloud,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { UserRole } from "@/lib/types";

interface SidebarProps {
  role: UserRole;
  currentPath?: string;
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);

  // =========================
  // SIDEBAR COLLAPSE STATE
  // =========================

  useEffect(() => {
    setIsCollapsed(
      window.localStorage.getItem("sidebar-collapsed") === "true"
    );
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((previous) => {
      const next = !previous;

      window.localStorage.setItem(
        "sidebar-collapsed",
        String(next)
      );

      return next;
    });
  };

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // =========================
  // PHOTO UPLOAD
  // =========================

  const handlePhotoUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    console.log("Selected photo:", file);

    // Photo file is selected successfully.
    // Supabase Storage upload can be added here.
  };

  // =========================
  // ADMIN NAVIGATION
  // =========================

  const adminNavItems = [
    {
      name: "Overview",
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

  // =========================
  // EMPLOYEE NAVIGATION
  // =========================

  const employeeNavItems = [
    // {
    //   name: "My Dashboard",
    //   href: "/portal",
    //   icon: LayoutDashboard,
    //   roles: ["employee"],
    // },
    {
      name: "My Profile",
      href: "/portal/profile",
      icon: UserCheck,
      roles: ["employee"],
    },
    {
      name: "My Attendance",
      href: "/portal/attendance",
      icon: Clock,
      roles: ["employee"],
    },
    {
      name: "My Leaves",
      href: "/portal/leaves",
      icon: Calendar,
      roles: ["employee"],
    },
    {
      name: "My Payslips",
      href: "/portal/payslips",
      icon: FileText,
      roles: ["employee"],
    },
  ];

  // =========================
  // SELECT NAVIGATION
  // =========================

  const items =
    role === "employee"
      ? employeeNavItems
      : adminNavItems;

  const visibleItems = items.filter((item) =>
    item.roles.includes(role)
  );

  // =========================
  // ACTIVE NAVIGATION
  // =========================

  const activeItem = visibleItems
    .filter(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  // =========================
  // SIDEBAR
  // =========================

  return (
    <aside
      className={`relative flex flex-col w-full bg-slate-900 text-white flex-shrink-0 shadow-lg z-20 md:h-screen transition-[width] duration-200 ${
        isCollapsed
          ? "md:w-[72px]"
          : "md:w-64"
      }`}
    >
      {/* =========================
          HEADER
      ========================= */}

      <div
        className={`p-4 sm:p-5 flex items-center border-b border-slate-800 ${
          isCollapsed
            ? "justify-center"
            : "gap-3"
        }`}
      >
        <div className="bg-white rounded-lg p-1 shrink-0">
          <Image
            src="/logo.png"
            alt="Teens Software Solutions Logo"
            width={50}
            height={32}
            className="object-contain"
            style={{
              width: "30px",
              height: "auto",
            }}
          />
        </div>

        <div
          className={
            isCollapsed ? "hidden" : ""
          }
        >
          <span className="font-semibold text-sm sm:text-base leading-tight block">
            Teens Software
          </span>

          <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
            {role === "employee"
              ? "Employee Portal"
              : `${role.toUpperCase()} Workspace`}
          </span>
        </div>
      </div>

      {/* =========================
          SIDEBAR CONTENT
      ========================= */}

      <div className="flex-1 px-3 py-4 overflow-y-auto">

        {/* =========================
            UPLOAD PHOTO
            ABOVE MY DASHBOARD
        ========================= */}

        {role === "employee" && (
          <div className="mb-5">
            {/* Hidden file input */}
            <input
              id="sidebar-photo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            {/* Upload Photo Box */}
            <label
              htmlFor="sidebar-photo-upload"
              title={
                isCollapsed
                  ? "Upload Photo"
                  : undefined
              }
              className={`group flex items-center justify-center rounded-xl border border-indigo-500/70 bg-slate-800/80 hover:bg-slate-800 hover:border-indigo-400 cursor-pointer transition-all duration-200 ${
                isCollapsed
                  ? "mx-auto h-12 w-12"
                  : "mx-auto h-[88px] w-[88px]"
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <UploadCloud
                  className={`text-indigo-300 group-hover:text-white transition-colors ${
                    isCollapsed
                      ? "h-5 w-5"
                      : "h-7 w-7"
                  }`}
                />

                {!isCollapsed && (
                  <span className="text-[10px] font-semibold text-slate-200 group-hover:text-white">
                    Upload Photo
                  </span>
                )}
              </div>
            </label>
          </div>
        )}

        {/* =========================
            NAVIGATION
        ========================= */}

        <div className="space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              activeItem?.href === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                title={
                  isCollapsed
                    ? item.name
                    : undefined
                }
                className={`flex w-full items-center rounded-lg py-2.5 text-left transition-all duration-200 ${
                  isCollapsed
                    ? "justify-center px-2"
                    : "gap-3 px-3"
                } ${
                  isActive
                    ? "bg-indigo-600 text-white font-medium shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive
                      ? "text-white"
                      : "text-slate-400"
                  }`}
                />

                <span
                  className={
                    isCollapsed
                      ? "sr-only"
                      : "text-sm"
                  }
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* =========================
          FOOTER
      ========================= */}

      <div className="p-3 border-t border-slate-800">
        <div
          className={`flex items-center ${
            isCollapsed
              ? "flex-col gap-2"
              : "gap-2"
          }`}
        >
          {/* Collapse Button */}

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={
              isCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            title={
              isCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            className={`hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white ${
              isCollapsed
                ? ""
                : "shrink-0"
            }`}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          {/* Logout Button */}

          <button
            type="button"
            onClick={handleLogout}
            title={
              isCollapsed
                ? "Sign Out"
                : undefined
            }
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