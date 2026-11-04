"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  LogOut,
  Menu,
  X,
  CheckCheck,
  BellRing,
  RefreshCw,
  AlertCircle,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile;
}

interface NotificationItem {
  id: number | string;
  title: string;
  message: string;
  type?: string;
  time?: string;
  created_at?: string;
  read?: boolean;
}

export default function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");

  const notificationRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const getPageTitle = () => {
    if (pathname === "/dashboard") {
      return profile.role === "ceo"
        ? "Executive CEO Overview"
        : "HR Operations Dashboard";
    }

    if (pathname === "/dashboard/employees") return "Employee Directory";

    if (
      pathname === "/dashboard/employees/add" ||
      pathname === "/dashboard/employees/new"
    ) {
      return "Add New Employee";
    }

    if (pathname.includes("/dashboard/employees/")) {
      return "Employee Profile Details";
    }

    if (pathname === "/dashboard/approvals") return "Approvals Hub";

    if (pathname === "/dashboard/attendance") {
      return "Organization Attendance & Shifts";
    }

    if (pathname === "/dashboard/leaves") {
      return "Leave Policy & Balances";
    }

    if (pathname === "/dashboard/payroll") {
      return "Payroll & Salary Processing";
    }

    if (pathname === "/dashboard/projects") return "Client & Vendors";

    if (pathname === "/portal/profile") return "My Employee Profile";

    if (pathname === "/portal/attendance") {
      return "My Attendance & Check-In";
    }

    if (pathname === "/portal/leaves") return "My Leaves & Holidays";

    if (pathname === "/portal/payslips") return "My Salary & Payslips";

    return "Teens Software Portal";
  };

  const getRoleBadge = (role: string) => {
    if (role === "ceo") {
      return {
        label: "CEO / Executive",
        color: "bg-purple-100 text-purple-800",
      };
    }

    if (role === "hr") {
      return {
        label: "HR Administrator",
        color: "bg-indigo-100 text-indigo-800",
      };
    }

    return {
      label: "Employee",
      color: "bg-emerald-100 text-emerald-800",
    };
  };

  const getInitials = (name: string) =>
    name
      ? name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .toUpperCase()
          .substring(0, 2)
      : "U";

  // Set notification title color based on its status.
  const getNotificationTitleColor = (title: string) => {
    if (/reject/i.test(title)) {
      return "text-red-600";
    }

    if (/approv/i.test(title)) {
      return "text-green-600";
    }

    if (/pending|submitted/i.test(title)) {
      return "text-amber-600";
    }

    return "text-slate-800";
  };

  // Synchronize the profile photo.
  useEffect(() => {
    const syncAvatar = () => {
      try {
        const savedAvatar = localStorage.getItem("profile-avatar-url");
        setAvatarUrl(savedAvatar || profile.avatar_url || "");
      } catch {
        setAvatarUrl(profile.avatar_url || "");
      }
    };

    syncAvatar();

    const handlePhotoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        avatarUrl?: string;
        profile_photo_url?: string;
        avatar_url?: string;
      }>;

      const updatedUrl =
        customEvent.detail?.avatarUrl ??
        customEvent.detail?.profile_photo_url ??
        customEvent.detail?.avatar_url;

      if (updatedUrl) {
        setAvatarUrl(updatedUrl);
      } else {
        syncAvatar();
      }
    };

    window.addEventListener("profile-photo-updated", handlePhotoUpdate);
    window.addEventListener("employee-profile-photo", handlePhotoUpdate);
    window.addEventListener(
      "employee-profile-photo-updated",
      handlePhotoUpdate
    );
    window.addEventListener("storage", syncAvatar);

    return () => {
      window.removeEventListener("profile-photo-updated", handlePhotoUpdate);
      window.removeEventListener(
        "employee-profile-photo",
        handlePhotoUpdate
      );
      window.removeEventListener(
        "employee-profile-photo-updated",
        handlePhotoUpdate
      );
      window.removeEventListener("storage", syncAvatar);
    };
  }, [profile.avatar_url]);

  // Fetch notifications from the API.
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    setNotificationError("");

    try {
      const response = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "Notifications API did not return JSON. Check app/api/notifications/route.ts."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Failed to load notifications. Status: ${response.status}`
        );
      }

      const items = Array.isArray(data.notifications)
        ? data.notifications
        : [];

      setNotifications(
        items.map((item: NotificationItem) => ({
          id: item.id,
          title: item.title || "Notification",
          message: item.message || "",
          type: item.type || "general",
          time: item.time,
          created_at: item.created_at,
          read: Boolean(item.read),
        }))
      );
    } catch (error) {
      console.error("Failed to fetch notifications:", error);

      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to load notifications."
      );
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  // Refresh periodically and whenever the user returns to this tab.
  useEffect(() => {
    void fetchNotifications();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    }, 60_000);

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchNotifications]);

  // Close notifications when clicking outside the popup.
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Clicking the bell fetches the latest notifications.
  const toggleNotifications = () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);

    if (nextOpen) {
      void fetchNotifications();
    }
  };

  // Mark one notification as read in the database.
  const markNotificationAsRead = async (notificationId: number | string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to mark notification as read.");
      }

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error("Mark notification as read failed:", error);
      setNotificationError(
        error instanceof Error ? error.message : "Unable to update notification."
      );
    }
  };

  const getNotificationCategoryStyle = (type?: string) => {
    const category = (type || "").toLowerCase();

    if (category.includes("leave")) return "bg-emerald-100 text-emerald-700";
    if (category.includes("attendance")) return "bg-sky-100 text-sky-700";
    if (category.includes("pay")) return "bg-violet-100 text-violet-700";
    if (category.includes("resign")) return "bg-orange-100 text-orange-700";
    if (category.includes("profile") || category.includes("document")) {
      return "bg-cyan-100 text-cyan-700";
    }

    return "bg-indigo-100 text-indigo-600";
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to mark notifications as read."
        );
      }

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          read: true,
        }))
      );
    } catch (error) {
      console.error("Mark all notifications as read failed:", error);
    }
  };


  const formatNotificationTime = (notification: NotificationItem) => {
    const value = notification.time || notification.created_at;

    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    <header className="relative sticky top-0 z-30 flex h-auto flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:h-16 sm:px-6 sm:py-0">
      {/* Page title and mobile menu */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Toggle navigation menu"
          onClick={() => setMobileMenuOpen((previous) => !previous)}
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 md:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </button>

        <h1 className="truncate text-base font-bold leading-tight tracking-tight text-slate-900 sm:text-xl">
          {getPageTitle()}
        </h1>
      </div>

      {/* Notifications and profile */}
      <div className="flex flex-shrink-0 items-center gap-3 sm:gap-5">
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
            onClick={toggleNotifications}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600"
          >
            <Bell className="h-5 w-5" />

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Notifications
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {unreadCount} unread
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Refresh notifications"
                    onClick={() => void fetchNotifications()}
                    disabled={loadingNotifications}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        loadingNotifications ? "animate-spin" : ""
                      }`}
                    />
                  </button>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      title="Mark all as read"
                      onClick={markAllAsRead}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {loadingNotifications && notifications.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading notifications...
                  </div>
                ) : notificationError && notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <AlertCircle className="mx-auto mb-2 h-7 w-7 text-amber-500" />

                    <p className="text-sm font-medium text-slate-700">
                      Unable to load notifications
                    </p>

                    <p className="mt-1 break-words text-xs text-slate-500">
                      {notificationError}
                    </p>

                    <button
                      type="button"
                      onClick={() => void fetchNotifications()}
                      className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Try again
                    </button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <BellRing className="mx-auto mb-2 h-8 w-8 text-slate-300" />

                    <p className="text-sm font-semibold text-slate-700">
                      No notifications yet
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      HR leave and attendance request updates will appear here.
                    </p>

                    {notificationError && (
                      <p className="mt-2 break-words text-xs text-amber-600">
                        {notificationError}
                      </p>
                    )}
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`border-b border-slate-100 px-4 py-3 last:border-b-0 ${
                        notification.read ? "bg-white" : "bg-indigo-50/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${getNotificationCategoryStyle(
                            notification.type
                          )}`}
                        >
                          <BellRing className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-semibold ${getNotificationTitleColor(
                              notification.title
                            )}`}
                          >
                            {notification.title}
                          </p>

                          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                            {notification.message}
                          </p>

                          {formatNotificationTime(notification) && (
                            <p className="mt-1.5 text-[11px] text-slate-400">
                              {formatNotificationTime(notification)}
                            </p>
                          )}
                        </div>

                        {!notification.read && (
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <span
                              className="mt-1.5 h-2 w-2 rounded-full bg-indigo-600"
                              title="Unread"
                            />
                            <button
                              type="button"
                              title="Mark as read"
                              aria-label={`Mark ${notification.title} as read`}
                              onClick={() => void markNotificationAsRead(notification.id)}
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-white hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              <CheckCheck className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                <p className="text-center text-[11px] text-slate-500">
                  Teens Software Portal
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User profile */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-3 sm:pl-5">
          <div className="hidden text-right md:block">
            <p className="mb-1 text-sm font-semibold leading-none text-slate-900">
              {profile.full_name || profile.email}
            </p>

            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
          </div>

          <Link
            href={
              profile.role === "employee"
                ? "/portal/profile"
                : "/dashboard"
            }
            title="View profile"
            className="flex-shrink-0 rounded-full outline-none ring-indigo-500 focus-visible:ring-2"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.full_name || "Profile photo"}
                onError={() => setAvatarUrl("")}
                className="h-9 w-9 rounded-full border border-slate-200 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-xs font-bold text-indigo-700 shadow-sm">
                {profile.full_name || profile.email ? (
                  getInitials(profile.full_name || profile.email)
                ) : (
                  <UserRound className="h-5 w-5" />
                )}
              </div>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-10 bg-slate-900/40 md:hidden"
          />

          <div className="absolute left-3 top-full z-20 mt-2 w-64 space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-3 text-white shadow-2xl md:hidden">
            <div className="mb-2 flex items-center gap-3 border-b border-slate-800 px-3 py-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile photo"
                  className="h-10 w-10 rounded-full border border-slate-600 object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {getInitials(profile.full_name || profile.email)}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {profile.full_name || profile.email}
                </p>

                <p className="text-xs capitalize text-slate-400">
                  {profile.role}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-red-400 transition-colors hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </>
      )}
    </header>
  );
}
