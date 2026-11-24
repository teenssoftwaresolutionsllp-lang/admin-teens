"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { useRouter } from "next/navigation";

export interface RecentJoining {
  id: string;
  employeeId: string;
  name: string;
  photo?: string | null;
  designation: string;
  department: string;
  joiningDate: string;
}

interface RecentJoiningsWidgetProps {
  employees: RecentJoining[];
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

export default function RecentJoiningsWidget({
  employees,
}: RecentJoiningsWidgetProps) {
  const router = useRouter();

  return (
    <section className="flex h-full min-w-0 w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Recent Joinings
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Latest employees who joined
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/employees"
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Table matching screenshot */}
        {employees.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  <th className="pb-2.5 pr-2 font-semibold">EMPLOYEE</th>
                  <th className="pb-2.5 px-2 font-semibold">DEPARTMENT</th>
                  <th className="pb-2.5 pl-2 font-semibold">DESIGNATION</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {employees.slice(0, 4).map((employee) => (
                  <tr
                    key={employee.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`View ${employee.name}`}
                    onClick={() =>
                      router.push(`/dashboard/employees/${employee.id}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/dashboard/employees/${employee.id}`);
                      }
                    }}
                    className="cursor-pointer transition hover:bg-slate-50/70"
                  >
                    {/* Employee avatar + Name + ID */}
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {employee.photo ? (
                          <Image
                            src={employee.photo}
                            alt={employee.name}
                            width={34}
                            height={34}
                            unoptimized
                            className="h-8 w-8 shrink-0 rounded-full object-cover border border-slate-100"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600 border border-blue-100/60">
                            {getInitials(employee.name)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900 leading-snug">
                            {employee.name}
                          </p>
                          <p className="text-[11px] font-medium text-slate-400">
                            {employee.employeeId || "—"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-2.5 px-2 text-xs font-medium text-slate-600 truncate">
                      {employee.department}
                    </td>

                    {/* Designation */}
                    <td className="py-2.5 pl-2 text-xs font-medium text-slate-600 truncate">
                      {employee.designation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[160px] flex-col items-center justify-center text-center mt-3">
            <Users className="mb-2 text-slate-300" size={26} />
            <p className="text-xs font-medium text-slate-600">
              No recent joinings
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
