"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ElementType } from "react";

import {
  Award,
  Banknote,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Globe,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  UserX,
  Users,
} from "lucide-react";

import type { UserRole } from "@/lib/types";

type SidebarNavItem = {
  name: string;
  href?: string;
  icon: ElementType;
  roles: UserRole[];
  children?: SidebarNavItem[];
};

interface SidebarProps {
  role: UserRole;
  currentPath?: string;
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([
    "Employees",
    "Approval Hub",
    "Payroll",
  ]);

  useEffect(() => {
    try {
      setIsCollapsed(
        window.localStorage.getItem("sidebar-collapsed") === "true"
      );
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

  const toggleMenu = (name: string) => {
    setOpenMenus((previous) =>
      previous.includes(name)
        ? previous.filter((item) => item !== name)
        : [...previous, name]
    );
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}.`);
      }

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

  const adminNavItems: SidebarNavItem[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["ceo", "hr"],
    },
    {
      name: "Employees",
      icon: Users,
      roles: ["ceo", "hr"],
      children: [
        {
          name: "All",
          href: "/dashboard/employees",
          icon: Users,
          roles: ["ceo", "hr"],
        },
        {
          name: "Joining",
          href: "/dashboard/employees?status=joining",
          icon: UserPlus,
          roles: ["ceo", "hr"],
        },
        {
          name: "Terminated",
          href: "/dashboard/employees?status=terminated",
          icon: UserX,
          roles: ["ceo", "hr"],
        },
        {
          name: "Layoff",
          href: "/dashboard/employees?status=laid_off",
          icon: UserMinus,
          roles: ["ceo", "hr"],
        },
        {
          name: "Resignation",
          icon: CalendarClock,
          roles: ["ceo", "hr"],
          children: [
            {
              name: "On Notice",
              href: "/dashboard/employees?status=resigned&notice=notice_period",
              icon: Clock,
              roles: ["ceo", "hr"],
            },
            {
              name: "Notice Completed",
              href: "/dashboard/employees?status=resigned&notice=notice_completed",
              icon: CalendarCheck,
              roles: ["ceo", "hr"],
            },
            {
              name: "Early Released",
              href: "/dashboard/employees?status=resigned&notice=early_release",
              icon: UserMinus,
              roles: ["ceo", "hr"],
            },
          ],
        },
      ],
    },
    {
      name: "Add Employee",
      href: "/dashboard/employees/add",
      icon: UserPlus,
      roles: ["hr"],
    },
    {
      name: "Add Joining",
      href: "/dashboard/joining",
      icon: UserPlus,
      roles: ["hr"],
    },
    {
      name: "Approval Hub",
      icon: CheckSquare,
      roles: ["hr"],
      children: [
        {
          name: "Approval",
          href: "/dashboard/approvals?status=pending",
          icon: CheckSquare,
          roles: ["hr"],
        },
        {
          name: "Approval History",
          href: "/dashboard/approvals?status=history",
          icon: ListChecks,
          roles: ["hr"],
        },
      ],
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
      name: "Payroll",
      icon: Banknote,
      roles: ["ceo", "hr"],
      children: [
        {
          name: "Master Data",
          href: "/dashboard/payroll/master-data",
          icon: Database,
          roles: ["ceo", "hr"],
        },
        {
          name: "Individual Data",
          href: "/dashboard/payroll",
          icon: UserRound,
          roles: ["ceo", "hr"],
        },
      ],
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

  const employeeNavItems: SidebarNavItem[] = [
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
    {
      name: "My Resignation",
      href: "/portal/resignation",
      icon: FileText,
      roles: ["employee"],
    },
  ];

  const visibleItems = (
    role === "employee" ? employeeNavItems : adminNavItems
  ).filter((item) => item.roles.includes(role));

  const isPathActive = (href?: string): boolean => {
    if (!href) return false;

    const [path, query] = href.split("?");
    if (pathname !== path) return false;

    if (!query) {
      if (path === "/dashboard/employees" || path === "/dashboard/approvals") {
        return !searchParams.has("status");
      }

      return searchParams.toString() === "";
    }

    const expectedParams = new URLSearchParams(query);
    for (const [key, value] of expectedParams.entries()) {
      if (searchParams.get(key) !== value) return false;
    }

    return true;
  };

  const hasActiveChild = (item: SidebarNavItem): boolean =>
    (item.href ? isPathActive(item.href) : false) ||
    (item.children?.some(hasActiveChild) ?? false);

  const renderNavItem = (item: SidebarNavItem, level = 0) => {
    const children = item.children?.filter((child) =>
      child.roles.includes(role)
    ) ?? [];
    const hasChildren = children.length > 0;
    const isOpen = openMenus.includes(item.name);
    const isActive = hasActiveChild(item);
    const Icon = item.icon;

    if (hasChildren) {
      return (
        <div key={`${level}-${item.name}`}>
          <button
            type="button"
            onClick={() => {
              if (isCollapsed) {
                setIsCollapsed(false);
                return;
              }

              toggleMenu(item.name);
            }}
            title={isCollapsed ? item.name : undefined}
            aria-expanded={isOpen}
            className={`flex w-full items-center rounded-lg py-2.5 transition-all ${
              isCollapsed ? "justify-center px-2" : "gap-3 px-3"
            } ${
              isActive
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 text-slate-400" />
            <span className={isCollapsed ? "sr-only" : "flex-1 text-left text-sm"}>
              {item.name}
            </span>
            {!isCollapsed &&
              (isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              ))}
          </button>
          {!isCollapsed && isOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-2">
              {children.map((child) => renderNavItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={`${level}-${item.name}`}
        href={item.href ?? "#"}
        title={isCollapsed ? item.name : undefined}
        className={`flex w-full items-center rounded-lg py-2.5 transition-all ${
          isCollapsed ? "justify-center px-2" : "gap-3 px-3"
        } ${
          isActive
            ? "bg-indigo-600 text-white font-medium shadow-sm"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className={isCollapsed ? "sr-only" : "text-sm"}>
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <aside
      className={`relative z-20 flex h-full w-full flex-shrink-0 flex-col bg-slate-900 text-white shadow-lg transition-[width] duration-200 md:h-screen ${
        isCollapsed ? "md:w-[72px]" : "md:w-64"
      }`}
    >
      <div
        className={`flex items-center border-b border-slate-800 p-4 sm:p-5 ${
          isCollapsed ? "justify-center" : "gap-3"
        }`}
      >
        <div className="shrink-0 rounded-lg bg-white p-1">
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
          <span className="block text-sm font-semibold leading-tight sm:text-base">
            Teens Software
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {role === "employee"
              ? "Employee Portal"
              : `${role?.toUpperCase() || "USER"} Workspace`}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">{visibleItems.map((item) => renderNavItem(item))}</div>
      </div>

      <div className="border-t border-slate-800 p-3">
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
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white md:inline-flex"
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
