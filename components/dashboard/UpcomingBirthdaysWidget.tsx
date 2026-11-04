import Image from "next/image";
import Link from "next/link";
import { Cake, CalendarDays } from "lucide-react";

export interface UpcomingBirthday {
  id: string;
  name: string;
  photo?: string | null;
  designation: string;
  dateOfBirth: string;
  nextBirthday: string;
  daysUntil: number;
}

interface UpcomingBirthdaysWidgetProps {
  birthdays: UpcomingBirthday[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function UpcomingBirthdaysWidget({
  birthdays,
}: UpcomingBirthdaysWidgetProps) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-800">
            Upcoming Birthdays
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Celebrate with your team
          </p>
        </div>

        <Cake className="shrink-0 text-pink-500" size={21} />
      </div>

      {/* Birthday List */}
      {birthdays.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {birthdays.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-3"
            >
              {person.photo ? (
                <Image
                  src={person.photo}
                  alt={person.name}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-50 text-xs font-bold text-pink-600">
                  {getInitials(person.name)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {person.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {person.designation}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <div className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-700">
                  <CalendarDays size={12} className="text-pink-500" />
                  {formatDate(person.nextBirthday)}
                </div>

                <p className="mt-1 text-[10px] text-slate-400">
                  {person.daysUntil === 0
                    ? "Today 🎉"
                    : person.daysUntil === 1
                      ? "Tomorrow"
                      : `In ${person.daysUntil} days`}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[150px] flex-1 flex-col items-center justify-center text-center">
          <Cake className="mb-2 text-slate-300" size={28} />
          <p className="text-sm font-medium text-slate-600">
            No upcoming birthdays
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 shrink-0 border-t border-slate-100 pt-3">
        <Link
          href="/dashboard/employees"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View Employees
        </Link>
      </div>
    </section>
  );
}