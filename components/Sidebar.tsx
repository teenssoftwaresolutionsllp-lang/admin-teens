"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  UploadCloud,
  Award,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { UserRole } from "@/lib/types";

interface SidebarProps {
  role: UserRole;
  currentPath?: string;
  avatarUrl?: string | null;
}

interface PhotoApiResponse {
  success?: boolean;
  avatarUrl?: string | null;
  error?: string;
  message?: string;
}

export default function Sidebar({
  role,
  avatarUrl,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(
    avatarUrl || null
  );
  const [uploading, setUploading] = useState(false);

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

  // Keep the client avatar synchronized with server-provided profile data.
  useEffect(() => {
    if (avatarUrl === undefined) return;

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
  }, [avatarUrl]);

  // Fetch the persisted photo so cleared or updated photos stay in sync.
  useEffect(() => {
    if (role !== "employee") return;

    let cancelled = false;

    const loadProfilePhoto = async () => {
      try {
        const response = await fetch("/api/profile/photo", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          console.error(
            "Unable to load profile photo:",
            response.status
          );
          return;
        }

        const data: PhotoApiResponse = await response.json();

        if (cancelled) return;

        if (data.avatarUrl) {
          setProfileImage(data.avatarUrl);

          try {
            window.localStorage.setItem(
              "profile-avatar-url",
              data.avatarUrl
            );
          } catch (error) {
            console.error("Unable to save profile photo locally:", error);
          }
        } else {
          setProfileImage(null);

          try {
            window.localStorage.removeItem("profile-avatar-url");
          } catch (error) {
            console.error("Unable to clear old profile photo:", error);
          }
        }
      } catch (error) {
        console.error("Failed to load profile photo:", error);
      }
    };

    void loadProfilePhoto();

    return () => {
      cancelled = true;
    };
  }, [role]);

  // Listen to both events used by the profile-photo upload surfaces.
  useEffect(() => {
    const handlePhotoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        avatarUrl?: string | null;
      }>;

      const newAvatar = customEvent.detail?.avatarUrl;

      if (!newAvatar) return;

      setProfileImage(newAvatar);

      try {
        window.localStorage.setItem(
          "profile-avatar-url",
          newAvatar
        );
      } catch (error) {
        console.error("Unable to save updated profile photo:", error);
      }
    };

    window.addEventListener("profile-photo-updated", handlePhotoUpdate);
    window.addEventListener(
      "employee-profile-photo-updated",
      handlePhotoUpdate
    );

    return () => {
      window.removeEventListener(
        "profile-photo-updated",
        handlePhotoUpdate
      );
      window.removeEventListener(
        "employee-profile-photo-updated",
        handlePhotoUpdate
      );
    };
  }, []);

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

      setProfileImage(null);
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // PARSE UPLOAD RESPONSE SAFELY
  const parseUploadResponse = async (
    response: Response
  ): Promise<PhotoApiResponse> => {
    const responseText = await response.text();

    if (!responseText) return {};

    try {
      return JSON.parse(responseText) as PhotoApiResponse;
    } catch {
      return {
        error: responseText || "Invalid server response.",
      };
    }
  };

  // PROFILE PHOTO UPLOAD
  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
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

      // SHOW PREVIEW WHILE UPLOADING
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
        throw new Error(
          data.error ||
            data.message ||
            `Photo upload failed (${response.status}).`
        );
      }

      const newAvatarUrl =
        typeof data.avatarUrl === "string" ? data.avatarUrl : null;

      if (!newAvatarUrl) {
        throw new Error(
          "Photo uploaded, but the server did not return a photo URL."
        );
      }

      // UPDATE SIDEBAR WITH SAVED CLOUDINARY URL
      setProfileImage(newAvatarUrl);

      try {
        window.localStorage.setItem(
          "profile-avatar-url",
          newAvatarUrl
        );
      } catch (error) {
        console.error("Unable to save photo locally:", error);
      }

      // NOTIFY OTHER COMPONENTS
      window.dispatchEvent(
        new CustomEvent("profile-photo-updated", {
          detail: { avatarUrl: newAvatarUrl },
        })
      );

      window.dispatchEvent(
        new CustomEvent("employee-profile-photo-updated", {
          detail: { avatarUrl: newAvatarUrl },
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

  // ADMIN NAVIGATION
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

  // EMPLOYEE NAVIGATION
  const employeeNavItems = [
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
      (item) =>
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`)
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
              } ${uploading ? "pointer-events-none opacity-80" : ""}`}
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