"use client";

import Link from "next/link";
import { CalendarDays, Gift, ArrowRight } from "lucide-react";

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
    <section className="relative flex h-full min-w-0 w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all">
      {/* Header */}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Upcoming Holidays
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Upcoming company and project holidays
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/projects"
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Holiday list */}
        {holidays.length > 0 ? (
          <div className="mt-3.5 space-y-3 relative z-10 max-h-[220px] overflow-y-auto pr-1">
            {holidays.slice(0, 3).map((holiday) => {
              const holidayDate = new Date(`${holiday.holiday_date}T00:00:00`);
              const dayNumber = holidayDate.getDate();
              const monthName = holidayDate.toLocaleDateString("en-IN", {
                month: "short",
              });

              return (
                <div key={holiday.id} className="flex items-start gap-3">
                  {/* Date Block */}
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-blue-100 bg-[#f0f5ff] text-blue-600 shadow-xs">
                    <span className="text-base font-extrabold leading-none">
                      {dayNumber}
                    </span>
                    <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-500">
                      {monthName}
                    </span>
                  </div>

                  {/* Holiday Title & Details */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {holiday.title}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400 font-medium">
                      {formatDate(holiday.holiday_date)}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {holiday.holiday_type === "emergency" ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/60">
                          Emergency
                        </span>
                      ) : (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100">
                          Regular
                        </span>
                      )}

                      {holiday.scope === "company" && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Company-wide
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[160px] flex-col items-center justify-center text-center mt-3">
            <Gift className="mb-2 text-slate-300" size={26} />
            <p className="text-xs font-medium text-slate-600">
              No upcoming holidays
            </p>
          </div>
        )}
      </div>

      {/* Decorative Golden Temple / celebration illustration matching screenshot */}
      <div
        className="pointer-events-none absolute -bottom-1 right-0 h-24 w-36 sm:h-28 sm:w-44 bg-[url('/calbanner.png')] bg-contain bg-no-repeat bg-right-bottom opacity-85"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-blue-50/40 via-transparent to-transparent"
        aria-hidden="true"
      />
    </section>
  );
}
