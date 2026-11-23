
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddEmployeeButton from "@/components/manager/AddEmployeeButton";
import ManagerLeaveActions from "@/components/manager/ApprovalManagerLeave";
import ManagerNotificationBell from "@/components/manager/Notificationbell";

import {
  Home,
  FolderKanban,
  ListTodo,
  LayoutGrid,
  MessageCircle,
  CalendarDays,
  Bell,
  Users,
  Settings,
  Search,
  MoreVertical,
  Plane,
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  CalendarCheck,
  ClipboardList,
  BriefcaseBusiness,
  House,
} from "lucide-react";

function getInitials(
  firstName?: string | null,
  lastName?: string | null
) {
  return (
    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() ||
    "U"
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatTime(value?: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function statusStyle(status?: string | null) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("approved") ||
    value.includes("present") ||
    value.includes("active")
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    value.includes("pending") ||
    value.includes("requested") ||
    value.includes("late")
  ) {
    return "bg-amber-50 text-amber-700";
  }

  if (
    value.includes("rejected") ||
    value.includes("absent") ||
    value.includes("cancelled")
  ) {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-600";
}

function EmployeeAvatar({
  photoUrl,
  firstName,
  lastName,
  size = 32,
}: {
  photoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName || ""} ${lastName || ""}`.trim() || "Employee"}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{
          width: size,
          height: size,
        }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-700"
      style={{
        width: size,
        height: size,
        fontSize: size <= 32 ? 10 : 13,
      }}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
}

const sidebarItems = [
  { label: "Home", href: "/manager", icon: Home, active: true },
  {
    label: "Projects",
    href: "/manager/projects",
    icon: FolderKanban,
  },
  { label: "My Tasks", href: "/manager/tasks", icon: ListTodo },
  {
    label: "Kanban Desk",
    href: "/manager/kanban",
    icon: LayoutGrid,
  },
  {
    label: "Message",
    href: "/manager/messages",
    icon: MessageCircle,
  },
  {
    label: "Calendar",
    href: "/manager/calendar",
    icon: CalendarDays,
  },
];

export default async function ManagerPage() {
  const supabase = await createClient();

  // AUTHENTICATION
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/portal");
  }

  const role = String(profile.role || "").toLowerCase();

  if (role !== "employee") {
    redirect(
      role === "hr" || role === "ceo" ? "/dashboard" : "/portal"
    );
  }

  // ADMIN CLIENT
  const admin = await createAdminClient();

  // MANAGER DETAILS
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select(
      "id, user_id, first_name, last_name, is_reporting_manager, profile_photo_url"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    employeeError ||
    !employee ||
    employee.is_reporting_manager !== true
  ) {
    console.error("Manager employee error:", employeeError?.message);
    redirect("/portal");
  }

  const managerName = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ");

  const firstName = employee.first_name || "Manager";

  // TODAY'S DATE
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // TEAM MEMBERS
  const { data: teamMembersData, error: teamError } = await admin
    .from("employees")
    .select(
      "id, first_name, last_name, email, designation, status, project_id, profile_photo_url"
    )
    .eq("reporting_manager_id", employee.id)
    .order("first_name", { ascending: true });

  if (teamError) {
    console.error("Manager team fetch error:", teamError.message);
  }

  const teamMembers = teamMembersData || [];
  const teamIds = teamMembers.map((member) => member.id);

  // PROJECTS
  const { data: projectsData } =
    teamIds.length > 0
      ? await admin
          .from("projects")
          .select(
            "id, name, timezone, shift_start_time, shift_end_time"
          )
          .in(
            "id",
            Array.from(
              new Set(
                teamMembers
                  .map((member) => member.project_id)
                  .filter(Boolean)
              )
            )
          )
          .order("name", { ascending: true })
      : { data: [] };

  const projects = projectsData || [];

  // TODAY'S TEAM ATTENDANCE
  const { data: attendanceData } =
    teamIds.length > 0
      ? await admin
          .from("attendance_logs")
          .select(
            "id, employee_id, attendance_date, check_in_time, check_out_time, total_hours, status, is_late, work_mode"
          )
          .in("employee_id", teamIds)
          .eq("attendance_date", today)
      : { data: [] };

  const attendance = attendanceData || [];

  const presentCount = attendance.filter((item) => {
    const status = String(item.status || "").toLowerCase();

    return (
      status.includes("present") ||
      status.includes("late") ||
      Boolean(item.check_in_time)
    );
  }).length;

  const lateCount = attendance.filter(
    (item) => item.is_late === true
  ).length;

  // TEAM LEAVE REQUESTS
  const {
    data: leaveRequestsData,
    error: leaveRequestsError,
  } = teamIds.length > 0
    ? await admin
        .from("leave_requests")
        .select(
          "id, employee_id, start_date, end_date, total_days, reason, status, created_at"
        )
        .in("employee_id", teamIds)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };

  if (leaveRequestsError) {
    console.error(
      "Manager leave requests error:",
      leaveRequestsError.message
    );
  }

  const leaveRequests = leaveRequestsData || [];

  const pendingLeaves = leaveRequests.filter(
    (leave) =>
      String(leave.status || "").toLowerCase() === "pending_manager"
  );

  // TEAM WFH REQUESTS
  const {
    data: wfhRequestsData,
    error: wfhRequestsError,
  } = teamIds.length > 0
    ? await admin
        .from("wfh_requests")
        .select(
          "id, employee_id, request_date, reason, status, rejection_reason, created_at"
        )
        .in("employee_id", teamIds)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [] };

  if (wfhRequestsError) {
    console.error(
      "Manager WFH requests error:",
      wfhRequestsError.message
    );
  }

  const wfhRequests = wfhRequestsData || [];

  const pendingWFHRequests = wfhRequests.filter((request) =>
    ["pending", "pending_manager"].includes(
      String(request.status || "").toLowerCase()
    )
  );

  // MANAGER NOTIFICATIONS
  const {
    data: notificationsData,
    error: notificationsError,
  } = await admin
    .from("notifications" as any)
    .select("id, title, message, type, is_read, created_at")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (notificationsError) {
    console.error(
      "Manager notifications error:",
      notificationsError.message
    );
  }

  const notifications: any[] = notificationsData || [];

  // UNREAD NOTIFICATIONS
  const unreadNotifications = notifications.filter(
    (notification) => notification.is_read === false
  ).length;

  // STATISTICS
  const stats = [
    {
      title: "Team Members",
      value: teamMembers.length,
      subtitle: "Employees reporting to you",
      icon: Users,
      iconColor: "text-sky-600",
      iconBg: "bg-sky-50",
    },
    {
      title: "Projects",
      value: projects.length,
      subtitle: "Projects assigned to your team",
      icon: BriefcaseBusiness,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
    },
    {
      title: "Present Today",
      value: presentCount,
      subtitle: "Team attendance records",
      icon: UserCheck,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      title: "Pending Leaves",
      value: pendingLeaves.length,
      subtitle: "Waiting for your approval",
      icon: Plane,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50",
    },
  ];

  function getEmployeeName(employeeId: string) {
    const member = teamMembers.find(
      (item) => item.id === employeeId
    );

    if (!member) return "Employee";

    return [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1800px]">

        {/* SIDEBAR */}
        <aside className="sticky top-0 hidden h-screen w-[245px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-5 py-7 lg:flex">
          <Link
            href="/manager"
            className="mb-9 flex items-center justify-between px-1"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-700 text-white">
                <span className="text-lg font-bold">Z</span>
              </div>
              <span className="text-xl font-bold">Zendo</span>
            </div>
            <LayoutGrid className="h-4 w-4 text-slate-500" />
          </Link>

          <div className="mb-8 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              placeholder="Search"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <p className="mb-3 px-2 text-xs text-slate-400">Home</p>

          <nav className="space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    item.active
                      ? "bg-black font-medium text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}

                  {item.label === "Notifications" &&
                    unreadNotifications > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">
                        {unreadNotifications}
                      </span>
                    )}
                </Link>
              );
            })}
          </nav>

          <p className="mb-3 mt-9 px-2 text-xs text-slate-400">
            Others
          </p>

          <Link
            href="/manager/team"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            <Users className="h-[18px] w-[18px]" />
            Team Members
          </Link>

          <Link
            href="/settings"
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            <Settings className="h-[18px] w-[18px]" />
            Account Settings
          </Link>

          <div className="mt-auto border-t border-slate-100 pt-5">
            <Link
              href="/workspace"
              className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Switch Workspace
            </Link>

            <div className="mt-3 flex items-center gap-2 px-3 text-xs text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
              Manager access verified
            </div>
          </div>
        </aside>

        {/* MAIN DASHBOARD */}
        <section className="h-screen min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">

          {/* HEADER */}
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Overview
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Welcome back, {managerName || firstName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/manager/projects"
                className="flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-purple-800"
              >
                <FolderKanban className="h-4 w-4" />
                View Projects
              </Link>

              <AddEmployeeButton />

              <ManagerNotificationBell
                initialNotifications={notifications}
              />

              <Link
                href="/portal/profile"
                className="rounded-full"
                title={managerName}
              >
                <EmployeeAvatar
                  photoUrl={employee.profile_photo_url}
                  firstName={employee.first_name}
                  lastName={employee.last_name}
                  size={40}
                />
              </Link>
            </div>
          </header>

          {/* STATISTICS */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.title}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${stat.iconBg} ${stat.iconColor}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        {stat.title}
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {stat.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PROJECTS AND ATTENDANCE */}
          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">

            {/* PROJECTS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-3">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-bold">Project Overview</h2>
                <Link
                  href="/manager/projects"
                  className="text-xs font-medium text-purple-700 hover:underline"
                >
                  View All
                </Link>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                  <FolderKanban className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">
                    No projects found
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Projects assigned to your team will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {projects.slice(0, 4).map((project) => (
                    <div
                      key={project.id}
                      className="rounded-xl border border-slate-100 p-4 transition hover:border-purple-200 hover:shadow-sm"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-700">
                          Team Project
                        </span>
                        <MoreVertical className="h-4 w-4 text-slate-400" />
                      </div>

                      <h3 className="text-sm font-bold">
                        {project.name}
                      </h3>

                      <p className="mt-2 text-[11px] text-slate-400">
                        Project configuration
                      </p>

                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">
                            Team members
                          </span>
                          <span className="font-semibold text-slate-700">
                            {
                              teamMembers.filter(
                                (member) =>
                                  member.project_id === project.id
                              ).length
                            }
                          </span>
                        </div>

                        {project.timezone && (
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="text-slate-400">
                              Timezone
                            </span>
                            <span className="truncate font-medium text-slate-600">
                              {project.timezone}
                            </span>
                          </div>
                        )}

                        {project.shift_start_time &&
                          project.shift_end_time && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">
                                Shift
                              </span>
                              <span className="font-medium text-slate-600">
                                {project.shift_start_time} -{" "}
                                {project.shift_end_time}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ATTENDANCE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-bold">
                  Today's Attendance
                </h2>
                <span className="text-[10px] text-slate-400">
                  {formatDate(today)}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-[10px] text-emerald-700">
                    Present
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {presentCount}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-[10px] text-amber-700">
                    Late Arrivals
                  </p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">
                    {lateCount}
                  </p>
                </div>
              </div>

              {attendance.length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-xs text-slate-500">
                    No attendance records found for today.
                  </p>
                </div>
              ) : (
                <div className="max-h-[260px] space-y-3 overflow-y-auto">
                  {attendance.slice(0, 8).map((record) => {
                    const member = teamMembers.find(
                      (item) => item.id === record.employee_id
                    );

                    return (
                      <div
                        key={record.id}
                        className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <EmployeeAvatar
                            photoUrl={member?.profile_photo_url}
                            firstName={member?.first_name}
                            lastName={member?.last_name}
                            size={32}
                          />

                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-semibold">
                              {getEmployeeName(record.employee_id)}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              Check in: {formatTime(record.check_in_time)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-semibold ${statusStyle(
                              record.is_late ? "late" : record.status
                            )}`}
                          >
                            {record.is_late
                              ? "Late"
                              : record.status || "Present"}
                          </span>

                          {record.work_mode && (
                            <p className="mt-1 text-[9px] text-slate-400">
                              {record.work_mode}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* LEAVE REQUESTS AND TEAM MEMBERS */}
          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">

            {/* LEAVE REQUESTS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-3">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold">
                    Team Leave Requests
                  </h2>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Review leave requests submitted by your team
                  </p>
                </div>

                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold text-orange-700">
                  {pendingLeaves.length} Awaiting Your Review
                </span>
              </div>

              {leaveRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                  <Plane className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">
                    No leave requests
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Your team's leave requests will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map((leave) => {
                    console.log("MANAGER LEAVE DATA:", leave);
                    console.log("MANAGER LEAVE ID:", leave.id);
                    const isManagerPending =
                      String(leave.status || "").toLowerCase() ===
                      "pending_manager";

                    const isHrPending =
                      String(leave.status || "").toLowerCase() ===
                      "pending";

                    return (
                      <div
                        key={leave.id}
                        className="rounded-xl border border-slate-100 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                              <Plane className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">
                                {getEmployeeName(leave.employee_id)}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-500">
                                {formatDate(leave.start_date)} -{" "}
                                {formatDate(leave.end_date)}
                              </p>

                              <p className="mt-1 line-clamp-1 text-[10px] text-slate-400">
                                {leave.reason || "No reason provided"}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${statusStyle(
                                leave.status
                              )}`}
                            >
                              {leave.status || "Unknown"}
                            </span>

                            <p className="mt-2 text-[10px] text-slate-400">
                              {leave.total_days ?? 0} day(s)
                            </p>
                          </div>
                        </div>

                        {isManagerPending && (
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <p className="mb-2 text-[10px] font-medium text-orange-700">
                              This request is waiting for your approval.
                            </p>

                            {/* IMPORTANT: Pass leaveId, not leaveRequestId */}
                         <ManagerLeaveActions
                          leaveId={leave.id}
                        />
                          </div>
                        )}

                        {isHrPending && (
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <p className="text-[10px] font-medium text-blue-600">
                              Manager approved. Waiting for HR final approval.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TEAM MEMBERS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-bold">Team Members</h2>
                <Link
                  href="/manager/team"
                  className="text-xs font-medium text-purple-700 hover:underline"
                >
                  View All
                </Link>
              </div>

              <div className="mb-3 grid grid-cols-[1.4fr_1fr] gap-2 text-[10px] font-medium text-slate-400">
                <span>Name</span>
                <span>Designation</span>
              </div>

              {teamMembers.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-xs text-slate-500">
                    No employees assigned to you.
                  </p>
                </div>
              ) : (
                <div className="max-h-[310px] space-y-4 overflow-y-auto">
                  {teamMembers.slice(0, 8).map((member) => (
                    <div
                      key={member.id}
                      className="grid grid-cols-[1.4fr_1fr] items-center gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <EmployeeAvatar
                          photoUrl={member.profile_photo_url}
                          firstName={member.first_name}
                          lastName={member.last_name}
                          size={32}
                        />

                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-bold">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="truncate text-[8px] text-slate-400">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      <span className="truncate text-[9px] text-slate-600">
                        {member.designation || "Employee"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TEAM WFH REQUESTS */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <House className="h-5 w-5 text-purple-600" />
                  <h2 className="text-sm font-bold">
                    Team WFH Requests
                  </h2>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  Work from home requests submitted by your team
                </p>
              </div>

              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-700">
                {pendingWFHRequests.length} Pending
              </span>
            </div>

            {wfhRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                <House className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">
                  No WFH requests
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Your team's work from home requests will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {wfhRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                        <House className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">
                          {getEmployeeName(request.employee_id)}
                        </p>

                        <p className="mt-1 text-[10px] text-slate-500">
                          {formatDate(request.request_date)}
                        </p>

                        <p className="mt-1 break-words text-[10px] text-slate-400">
                          {request.reason || "No reason provided"}
                        </p>

                        {request.rejection_reason && (
                          <p className="mt-2 text-[10px] text-red-600">
                            Rejection reason: {request.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold ${statusStyle(
                        request.status
                      )}`}
                    >
                      {request.status || "Unknown"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MY TASKS - DISPLAY ONLY */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">My Tasks</h2>
                <p className="mt-1 text-[10px] text-slate-400">
                  Task management is not enabled in this workspace.
                </p>
              </div>
              <ListTodo className="h-5 w-5 text-slate-400" />
            </div>

            <div className="rounded-xl border border-dashed border-slate-200 py-7 text-center">
              <ClipboardList className="mx-auto mb-2 h-7 w-7 text-slate-300" />
              <p className="text-xs font-medium text-slate-500">
                No task information available
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                This section is kept for the existing dashboard layout.
              </p>
            </div>
          </div>

          {/* FOOTER */}
          <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-400">
            <span>© 2026 Teens Software Solutions LLP</span>

            <Link
              href="/workspace"
              className="flex items-center gap-2 hover:text-purple-700"
            >
              <ShieldCheck className="h-4 w-4" />
              Reporting Manager Workspace
            </Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
