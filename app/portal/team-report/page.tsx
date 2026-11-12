import { redirect } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Users,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { isTeamReportDesignation } from "@/lib/team-report-access";

interface TeamMemberRow {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  designation: string | null;
  status: string;
  reporting_manager: string | null;
}

interface AttendanceRow {
  employee_id: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | null;
  work_mode: string | null;
}

interface LeaveRow {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  created_at: string;
}

function getTodayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function getMemberName(member: TeamMemberRow) {
  return `${member.first_name} ${member.last_name}`.trim();
}

function getAttendanceLabel(
  attendance: AttendanceRow | undefined,
  isOnLeave: boolean
) {
  if (isOnLeave) return "On leave";
  if (!attendance) return "No log";
  if (attendance.work_mode?.toUpperCase() === "WFH") {
    return "Work from home";
  }
  return attendance.status.replaceAll("_", " ");
}

function statusClass(status: string) {
  if (status === "On leave") return "bg-violet-50 text-violet-700";
  if (status === "No log" || status === "absent") {
    return "bg-rose-50 text-rose-700";
  }
  if (status === "Work from home") return "bg-sky-50 text-sky-700";
  return "bg-emerald-50 text-emerald-700";
}

export default async function TeamReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let employee = await DataStore.getEmployeeByUserId(user.id);
  if (!employee && user.email) {
    const employees = await DataStore.getEmployees(false);
    const loginEmail = user.email.trim().toLowerCase();
    employee =
      employees.find(
        (item) => item.email?.trim().toLowerCase() === loginEmail
      ) ?? null;
  }

  if (!employee || !isTeamReportDesignation(employee.designation)) {
    redirect("/portal");
  }

  const adminClient = await createAdminClient();
  const { data: rosterData, error: rosterError } = await adminClient
    .from("employees")
    .select(
      "id, employee_id, first_name, last_name, designation, status, reporting_manager"
    )
    .eq("status", "active")
    .order("first_name");

  if (rosterError) {
    throw new Error(`Unable to load team report roster: ${rosterError.message}`);
  }

  const roster = (rosterData ?? []) as TeamMemberRow[];
  const designation = employee.designation?.trim().toLowerCase();
  const managerNames = [
    `${employee.first_name} ${employee.last_name}`.trim().toLowerCase(),
    employee.employee_id.trim().toLowerCase(),
  ];

  const team =
    (designation?.includes("manager") || designation?.includes("manger"))
      ? roster.filter(
          (member) =>
            member.id !== employee.id &&
            managerNames.includes(
              member.reporting_manager?.trim().toLowerCase() ?? ""
            )
        )
      : roster.filter((member) => member.id !== employee.id);

  const today = getTodayInIndia();
  let attendanceRows: AttendanceRow[] = [];
  let pendingLeaves: LeaveRow[] = [];
  let approvedLeavesToday: LeaveRow[] = [];

  if (team.length > 0) {
    const teamIds = team.map((member) => member.id);
    const [attendanceResult, pendingLeaveResult, approvedLeaveResult] =
      await Promise.all([
        adminClient
          .from("attendance_logs")
          .select(
            "employee_id, status, check_in_time, check_out_time, total_hours, work_mode"
          )
          .in("employee_id", teamIds)
          .eq("attendance_date", today),
        adminClient
          .from("leave_requests")
          .select(
            "id, employee_id, start_date, end_date, total_days, reason, created_at"
          )
          .in("employee_id", teamIds)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(100),
        adminClient
          .from("leave_requests")
          .select(
            "id, employee_id, start_date, end_date, total_days, reason, created_at"
          )
          .in("employee_id", teamIds)
          .eq("status", "approved")
          .lte("start_date", today)
          .gte("end_date", today),
      ]);

    if (attendanceResult.error) {
      throw new Error(
        `Unable to load team attendance: ${attendanceResult.error.message}`
      );
    }
    if (pendingLeaveResult.error) {
      throw new Error(
        `Unable to load pending team leaves: ${pendingLeaveResult.error.message}`
      );
    }
    if (approvedLeaveResult.error) {
      throw new Error(
        `Unable to load approved team leaves: ${approvedLeaveResult.error.message}`
      );
    }

    attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];
    pendingLeaves = (pendingLeaveResult.data ?? []) as LeaveRow[];
    approvedLeavesToday = (approvedLeaveResult.data ?? []) as LeaveRow[];
  }

  const membersById = new Map(team.map((member) => [member.id, member]));
  const attendanceById = new Map(
    attendanceRows.map((attendance) => [
      attendance.employee_id,
      attendance,
    ])
  );
  const onLeaveIds = new Set(
    approvedLeavesToday.map((leave) => leave.employee_id)
  );
  const presentToday = attendanceRows.filter(
    (attendance) =>
      ["present", "half_day", "late"].includes(
        attendance.status.toLowerCase()
      )
  ).length;

  const cards = [
    {
      label: "My Team",
      value: team.length,
      detail: "Active members",
      icon: Users,
      color: "text-sky-700",
      background: "bg-sky-50",
      border: "border-sky-100",
    },
    {
      label: "Pending Approvals",
      value: pendingLeaves.length,
      detail: "Leave requests",
      icon: CheckCircle2,
      color: "text-emerald-700",
      background: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      label: "Team on Leave",
      value: onLeaveIds.size,
      detail: "Today",
      icon: CalendarDays,
      color: "text-violet-700",
      background: "bg-violet-50",
      border: "border-violet-100",
    },
    {
      label: "Present Today",
      value: presentToday,
      detail: "Attendance logs",
      icon: Clock3,
      color: "text-amber-700",
      background: "bg-amber-50",
      border: "border-amber-100",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-8">
      <header>
        <p className="text-sm font-semibold text-indigo-600">
          {employee.designation} Dashboard
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          My Team Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Team attendance and leave overview for {formatDate(today)}.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm ${card.border}`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${card.background} ${card.color}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {card.label}
                </p>
                <p className="text-xl font-bold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500">{card.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      {team.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <Users className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-900">
            No team members found
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {designation === "manager"
              ? "Employees assigned to you as their reporting manager will appear here."
              : "There are no active employees to report on right now."}
          </p>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-900">Team Attendance</h2>
              <p className="mt-1 text-xs text-slate-500">
                Attendance status and hours recorded today
              </p>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Designation</th>
                    <th className="px-4 py-3">Check In</th>
                    <th className="px-4 py-3">Check Out</th>
                    <th className="px-4 py-3">Hours</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.map((member) => {
                    const attendance = attendanceById.get(member.id);
                    const onLeave = onLeaveIds.has(member.id);
                    const status = getAttendanceLabel(attendance, onLeave);
                    return (
                      <tr key={member.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-semibold text-slate-800">
                            {getMemberName(member)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {member.employee_id}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {member.designation || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatTime(attendance?.check_in_time ?? null)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatTime(attendance?.check_out_time ?? null)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {attendance?.total_hours != null
                            ? `${Number(attendance.total_hours).toFixed(1)} hrs`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(status)}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-900">
                Pending Leave Requests
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Requests submitted by your team
              </p>
            </div>
            <div className="max-h-[520px] overflow-auto">
              {pendingLeaves.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                  No pending leave requests.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pendingLeaves.map((leave) => {
                    const member = membersById.get(leave.employee_id);
                    if (!member) return null;
                    return (
                      <li key={leave.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {getMemberName(member)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(leave.start_date)} –{" "}
                              {formatDate(leave.end_date)}
                              {" · "}
                              {leave.total_days}{" "}
                              {leave.total_days === 1 ? "day" : "days"}
                            </p>
                            {leave.reason && (
                              <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                                {leave.reason}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            Pending
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
