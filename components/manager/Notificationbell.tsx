
"use client";

import { useState } from "react";
import {
  Bell,
  RefreshCw,
  CheckCheck,
  X,
  Plane,
  Clock,
} from "lucide-react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type?: string;
  created_at?: string;
  time?: string;
  is_read?: boolean;
  read?: boolean;
};

type Props = {
  initialNotifications: NotificationItem[];
};

export default function ManagerNotificationBell({
  initialNotifications,
}: Props) {
  const [open, setOpen] = useState(false);

  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications || []);

  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // UNREAD COUNT
  const unreadCount = notifications.filter((item) => {
    return !(item.is_read === true || item.read === true);
  }).length;

  // REFRESH NOTIFICATIONS
  async function refreshNotifications() {
    try {
      setLoading(true);

      const response = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to load notifications"
        );
      }

      const updatedNotifications: NotificationItem[] =
        Array.isArray(data.notifications)
          ? data.notifications
          : [];

      setNotifications(updatedNotifications);
    } catch (error) {
      console.error("Notification refresh error:", error);
    } finally {
      setLoading(false);
    }
  }

  // MARK SINGLE NOTIFICATION AS READ
  async function markAsRead(id: string) {
    try {
      setUpdatingId(id);

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.error || "Unable to update notification"
        );
      }

      // Update count immediately
      setNotifications((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                is_read: true,
                read: true,
              }
            : item
        )
      );
    } catch (error) {
      console.error("Mark notification read error:", error);
    } finally {
      setUpdatingId(null);
    }
  }

  // MARK ALL NOTIFICATIONS AS READ
  async function markAllAsRead() {
    if (unreadCount === 0) return;

    try {
      setLoading(true);

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          markAllAsRead: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.error || "Unable to mark notifications as read"
        );
      }

      // Immediately make unread count zero
      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          is_read: true,
          read: true,
        }))
      );
    } catch (error) {
      console.error(
        "Mark all notifications read error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  // NOTIFICATION CLICK
  async function handleNotificationClick(
    item: NotificationItem
  ) {
    const isUnread = !(
      item.is_read === true || item.read === true
    );

    if (isUnread) {
      await markAsRead(item.id);
    }

    setOpen(false);

    document
      .getElementById("team-leave-requests")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  // FORMAT DATE
  function formatNotificationTime(value?: string) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });
  }

  return (
    <div className="relative">

      {/* BELL BUTTON */}
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open;

          setOpen(nextOpen);

          if (nextOpen) {
            refreshNotifications();
          }
        }}
        className="relative rounded-full border border-slate-200 bg-white p-2.5 transition hover:bg-slate-50"
        aria-label={`Open notifications. ${unreadCount} unread`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 text-slate-600" />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* NOTIFICATION POPUP */}
      {open && (
        <>
          {/* OUTSIDE CLICK */}
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-14 z-50 w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Notifications
                </h3>

                <p className="mt-0.5 text-[11px] text-slate-500">
                  {unreadCount} unread notifications
                </p>
              </div>

              <div className="flex items-center gap-1">

                {/* REFRESH */}
                <button
                  type="button"
                  onClick={refreshNotifications}
                  disabled={loading}
                  title="Refresh notifications"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-purple-700 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      loading ? "animate-spin" : ""
                    }`}
                  />
                </button>

                {/* MARK ALL READ */}
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={loading || unreadCount === 0}
                  title="Mark all as read"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-purple-700 disabled:opacity-40"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>

                {/* CLOSE */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="Close"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>

              </div>
            </div>

            {/* NOTIFICATION LIST */}
            <div className="max-h-[420px] overflow-y-auto">

              {loading && notifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-5 py-12 text-center">

                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Bell className="h-5 w-5" />
                  </div>

                  <p className="text-sm font-semibold text-slate-700">
                    No notifications
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    New team notifications will appear here.
                  </p>

                </div>
              ) : (
                notifications.map((item) => {
                  const isUnread = !(
                    item.is_read === true ||
                    item.read === true
                  );

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() =>
                        handleNotificationClick(item)
                      }
                      disabled={updatingId === item.id}
                      className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                        isUnread
                          ? "bg-purple-50/50"
                          : "bg-white"
                      }`}
                    >
                      {/* ICON */}
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          isUnread
                            ? "bg-purple-100 text-purple-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Plane className="h-4 w-4" />
                      </div>

                      {/* CONTENT */}
                      <div className="min-w-0 flex-1">

                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800">
                            {item.title || "Notification"}
                          </p>

                          {isUnread && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-purple-600" />
                          )}
                        </div>

                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-600">
                          {item.message}
                        </p>

                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Clock className="h-3 w-3" />

                          {formatNotificationTime(
                            item.created_at || item.time
                          )}
                        </div>

                        {isUnread && (
                          <p className="mt-2 text-[10px] font-semibold text-purple-700">
                            Click to mark as read
                          </p>
                        )}

                      </div>
                    </button>
                  );
                })
              )}

            </div>

            {/* FOOTER */}
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center">
              <p className="text-[10px] font-medium text-slate-500">
                Teens Software Portal
              </p>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
