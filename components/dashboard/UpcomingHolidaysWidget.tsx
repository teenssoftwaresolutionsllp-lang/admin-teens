
import Link from "next/link";
import { CalendarDays, Clock, Gift } from "lucide-react";

export interface UpcomingHoliday {
  id: string;
  holiday_date: string;
  title: string;
  holiday_type: "regular" | "emergency";
  scope: "calendar" | "company" | "project";
  reason?: string | null;
  project_id?: string | null;
  daysUntil: number;
}

interface UpcomingHolidaysWidgetProps {
  holidays: UpcomingHoliday[];
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function UpcomingHolidaysWidget({
  holidays,
}: UpcomingHolidaysWidgetProps) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-800">
            Upcoming Holidays
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Upcoming company and project holidays
          </p>
        </div>

        <CalendarDays className="shrink-0 text-indigo-500" size={22} />
      </div>

      {holidays.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {holidays.map((holiday) => (
            <div key={holiday.id} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <span className="text-sm font-bold leading-none">
                  {new Date(
                    `${holiday.holiday_date}T00:00:00`
                  ).getDate()}
                </span>
                <span className="mt-1 text-[9px] font-semibold uppercase">
                  {new Date(
                    `${holiday.holiday_date}T00:00:00`
                  ).toLocaleDateString("en-IN", { month: "short" })}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {holiday.title}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(holiday.holiday_date)}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {holiday.holiday_type === "emergency" ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Emergency
                    </span>
                  ) : (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      Regular
                    </span>
                  )}

                  {holiday.scope === "company" && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Company-wide
                    </span>
                  )}

                  {holiday.scope === "project" && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                      Project-specific
                    </span>
                  )}
                </div>

                {holiday.reason && (
                  <p className="mt-1 truncate text-[11px] text-slate-400">
                    {holiday.reason}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <div className="flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-500">
                  <Clock size={11} />
                  {holiday.daysUntil === 0
                    ? "Today"
                    : holiday.daysUntil === 1
                      ? "Tomorrow"
                      : `In ${holiday.daysUntil} days`}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[150px] flex-1 flex-col items-center justify-center text-center">
          <Gift className="mb-2 text-slate-300" size={28} />
          <p className="text-sm font-medium text-slate-600">
            No upcoming holidays
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Future holidays will appear here.
          </p>
        </div>
      )}

      <div className="mt-5 shrink-0 border-t border-slate-100 pt-3">
        <Link
          href="/dashboard/projects"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View Holiday Calendar
        </Link>
      </div>
    </section>
  );
}
