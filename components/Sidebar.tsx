"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ElementType, ChangeEvent } from "react";

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
  UploadCloud,
  Award,
  Loader2,
  ChevronDown,
  ListChecks,
  ChevronRight,
  Database,
  UserRound,
  UserX,
  UserMinus,
  CalendarClock,
  CalendarCheck,
  ShieldCheck,
} from "lucide-react";

import Image from "next/image";
import { UserRole } from "@/lib/types";

interface SidebarProps {
  role: UserRole;
  currentPath?: string;
  avatarUrl?: string | null;
}

type SidebarNavItem = {
  name: string;
  href?: string;
  icon: ElementType;
  roles: UserRole[];
  children?: SidebarNavItem[];
};

export default function Sidebar({
  role,
  avatarUrl,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([
    "Employees",
    "Approval Hub",
    "Payroll",
  ]);

  const [profileImage, setProfileImage] = useState<string | null>(
    avatarUrl || null
  );
  const [uploading, setUploading] = useState(false);

  const toggleMenu = (name: string) => {
    setOpenMenus((previous) =>
      previous.includes(name)
        ? previous.filter((item) => item !== name)
        : [...previous, name]
    );
  };

  // ============================================================
  // SIDEBAR COLLAPSE STATE
  // ============================================================

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

  // ============================================================
  // SYNC AVATAR FROM SERVER PROPS
  // ============================================================

  useEffect(() => {
    if (avatarUrl !== undefined) {
      setProfileImage(avatarUrl || null);

      try {
        if (avatarUrl) {
          window.localStorage.setItem("profile-avatar-url", avatarUrl);
        } else {
          window.localStorage.removeItem("profile-avatar-url");
        }
      } catch (error) {
        console.error("Unable to synchronize profile photo:", error);
      }
    }
  }, [avatarUrl]);

  // ============================================================
  // RESTORE AVATAR FROM LOCAL STORAGE
  // ============================================================

  useEffect(() => {
    if (avatarUrl) return;

    try {
      const savedAvatar = window.localStorage.getItem("profile-avatar-url");

      if (savedAvatar) {
        setProfileImage(savedAvatar);
      }
    } catch (error) {
      console.error("Unable to restore profile photo:", error);
    }
  }, [avatarUrl]);

  // ============================================================
  // LISTEN FOR PROFILE PHOTO UPDATES
  // ============================================================

  useEffect(() => {
    const handlePhotoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        avatarUrl?: string | null;
      }>;

      const newAvatar = customEvent.detail?.avatarUrl;

      if (!newAvatar) return;

      setProfileImage(newAvatar);

      try {
        window.localStorage.setItem("profile-avatar-url", newAvatar);
      } catch (error) {
        console.error("Unable to save updated profile photo:", error);
      }
    };

    window.addEventListener("profile-photo-updated", handlePhotoUpdate);

    return () => {
      window.removeEventListener("profile-photo-updated", handlePhotoUpdate);
    };
  }, []);

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      try {
        window.localStorage.removeItem("profile-avatar-url");
      } catch {
        // Ignore localStorage errors.
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // ============================================================
  // SAFE RESPONSE PARSER
  // ============================================================

  const parseUploadResponse = async (
    response: Response
  ): Promise<{
    success?: boolean;
    avatarUrl?: string;
    error?: string;
    message?: string;
    [key: string]: unknown;
  }> => {
    const contentType = response.headers.get("content-type") || "";
    const responseText = await response.text();

    if (!responseText) return {};

    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(responseText);
      } catch (error) {
        console.error(
          "Invalid JSON response from photo upload API:",
          error
        );

        throw new Error(
          "The photo upload server returned invalid JSON."
        );
      }
    }

    try {
      return JSON.parse(responseText);
    } catch {
      return {
        error: responseText,
        message: responseText,
      };
    }
  };

  // ============================================================
  // PHOTO UPLOAD
  // ============================================================

  const handlePhotoUpload = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      event.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("Image size must be less than 5 MB.");
      event.target.value = "";
      return;
    }

    let localPreview: string | null = null;
    const previousImage = profileImage;

    try {
      setUploading(true);

      // Immediate preview.
      localPreview = URL.createObjectURL(file);
      setProfileImage(localPreview);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await parseUploadResponse(response);

      if (!response.ok) {
        const serverMessage =
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : `Photo upload failed (${response.status})`;

        throw new Error(serverMessage);
      }

      const newAvatarUrl =
        typeof data.avatarUrl === "string" ? data.avatarUrl : null;

      if (!newAvatarUrl) {
        throw new Error(
          "Photo uploaded, but the server did not return an avatar URL."
        );
      }

      setProfileImage(newAvatarUrl);

      try {
        window.localStorage.setItem(
          "profile-avatar-url",
          newAvatarUrl
        );
      } catch (error) {
        console.error("Unable to save profile photo locally:", error);
      }

      window.dispatchEvent(
        new CustomEvent("profile-photo-updated", {
          detail: {
            avatarUrl: newAvatarUrl,
          },
        })
      );

      router.refresh();
    } catch (error) {
      console.error("Photo upload failed:", error);
      setProfileImage(previousImage || null);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to upload photo."
      );
    } finally {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }

      setUploading(false);
      event.target.value = "";
    }
  };

  // ============================================================
  // ADMIN NAVIGATION
  // ============================================================

  const adminNavItems: SidebarNavItem[] = [
    {
      name: "Overview",
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
          name: "Resign",
          icon: CalendarClock,
          roles: ["ceo", "hr"],
          children: [
            {
              name: "Notice Period",
              href: "/dashboard/employees?status=notice_period",
              icon: Clock,
              roles: ["ceo", "hr"],
            },
            {
              name: "Notice Completed",
              href: "/dashboard/employees?status=notice_completed",
              icon: CalendarCheck,
              roles: ["ceo", "hr"],
            },
            {
              name: "Early Release",
              href: "/dashboard/employees?status=early_release",
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

  // ============================================================
  // EMPLOYEE NAVIGATION
  // ============================================================

  const employeeNavItems: SidebarNavItem[] = [
    {
      name: "My Profile",
      href: "/portal/profile",
      icon: UserCheck,
      roles: ["employee"],
    },
    {
      name: "My Attendance & Leaves",
      href: "/portal/attendance",
      icon: Clock,
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

  // ============================================================
  // SELECT NAVIGATION
  // ============================================================

  const items =
    role === "employee" ? employeeNavItems : adminNavItems;

  const visibleItems = items.filter((item) =>
    item.roles.includes(role)
  );

  // ============================================================
  // ACTIVE NAVIGATION
  // ============================================================

  const isPathActive = (href?: string): boolean => {
    if (!href) return false;

    const [path, query] = href.split("?");

    if (pathname !== path) return false;

    // For paths without a query, only activate when the current
    // URL has no query parameters.
    if (!query) {
      return searchParams.toString() === "";
    }

    // Compare expected parameters without relying on their order.
    const expectedParams = new URLSearchParams(query);

    for (const [key, value] of expectedParams.entries()) {
      if (searchParams.get(key) !== value) {
        return false;
      }
    }

    return true;
  };

  // ============================================================
  // SIDEBAR
  // ============================================================

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
            style={{
              width: "30px",
              height: "auto",
            }}
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
        {/* PHOTO UPLOAD */}
        {role === "employee" && (
          <div className="mb-5">
            <input
              id="sidebar-photo-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploading}
            />

            <label
              htmlFor="sidebar-photo-upload"
              title={isCollapsed ? "Upload Photo" : undefined}
              className={`group relative flex items-center justify-center overflow-hidden rounded-xl border border-indigo-500/70 bg-slate-800/80 hover:bg-slate-800 hover:border-indigo-400 cursor-pointer transition-all duration-200 ${
                isCollapsed
                  ? "mx-auto h-12 w-12"
                  : "mx-auto h-[88px] w-[88px]"
              } ${
                uploading ? "pointer-events-none opacity-80" : ""
              }`}
            >
              {profileImage ? (
                <Image
                  src={profileImage}
                  alt="Profile"
                  fill
                  sizes="88px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5">
                  {uploading ? (
                    <Loader2 className="h-7 w-7 text-indigo-300 animate-spin" />
                  ) : (
                    <UploadCloud
                      className={`text-indigo-300 group-hover:text-white transition-colors ${
                        isCollapsed ? "h-5 w-5" : "h-7 w-7"
                      }`}
                    />
                  )}

                  {!isCollapsed && !uploading && (
                    <span className="text-[10px] font-semibold text-slate-200 group-hover:text-white">
                      Upload Photo
                    </span>
                  )}

                  {uploading && !isCollapsed && (
                    <span className="text-[10px] font-semibold text-slate-200">
                      Uploading...
                    </span>
                  )}
                </div>
              )}

              {profileImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <UploadCloud className="h-6 w-6 text-white" />
                  )}
                </div>
              )}
            </label>
          </div>
        )}

        {/* NAVIGATION */}
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const children = item.children ?? [];
            const hasChildren = children.length > 0;
            const isOpen = openMenus.includes(item.name);

            const isActive =
              (item.href ? isPathActive(item.href) : false) ||
              children.some(
                (child) =>
                  (child.href ? isPathActive(child.href) : false) ||
                  (child.children?.some((nested) =>
                    isPathActive(nested.href)
                  ) ??
                    false)
              );

            if (hasChildren) {
              return (
                <div key={item.name}>
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
                    <item.icon className="h-4 w-4 shrink-0 text-slate-400" />

                    <span
                      className={
                        isCollapsed
                          ? "sr-only"
                          : "flex-1 text-left text-sm"
                      }
                    >
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
                      {children
                        .filter((child) => child.roles.includes(role))
                        .map((child) => {
                          const nestedChildren = child.children ?? [];

                          if (nestedChildren.length > 0) {
                            const nestedOpen = openMenus.includes(child.name);
                            const nestedActive = nestedChildren.some(
                              (nested) =>
                                nested.href
                                  ? isPathActive(nested.href)
                                  : false
                            );

                            return (
                              <div key={child.name}>
                                <button
                                  type="button"
                                  onClick={() => toggleMenu(child.name)}
                                  aria-expanded={nestedOpen}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                    nestedActive
                                      ? "bg-slate-800 text-white"
                                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                  }`}
                                >
                                  <child.icon className="h-4 w-4 shrink-0" />

                                  <span className="flex-1 text-left">
                                    {child.name}
                                  </span>

                                  {nestedOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </button>

                                {nestedOpen && (
                                  <div className="ml-3 mt-1 space-y-1 border-l border-slate-700 pl-2">
                                    {nestedChildren
                                      .filter((nested) =>
                                        nested.roles.includes(role)
                                      )
                                      .map((nested) => (
                                        <Link
                                          key={nested.name}
                                          href={nested.href ?? "#"}
                                          className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors ${
                                            nested.href &&
                                            isPathActive(nested.href)
                                              ? "bg-indigo-600 text-white"
                                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                          }`}
                                        >
                                          <nested.icon className="h-3.5 w-3.5 shrink-0" />
                                          {nested.name}
                                        </Link>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <Link
                              key={child.name}
                              href={child.href ?? "#"}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                child.href && isPathActive(child.href)
                                  ? "bg-indigo-600 text-white"
                                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
                              }`}
                            >
                              <child.icon className="h-4 w-4 shrink-0" />
                              {child.name}
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
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
                <item.icon className="h-4 w-4 shrink-0" />

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
