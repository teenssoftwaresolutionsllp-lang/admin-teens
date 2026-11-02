import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

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

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Recent Joinings
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Latest employees who joined
          </p>
        </div>

        <Link
          href="/dashboard/employees"
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View All <ArrowRight size={14} />
        </Link>
      </div>

      {employees.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-3 font-medium">Employee</th>
                <th className="pb-3 pr-3 font-medium">Department</th>
                <th className="pb-3 pr-3 font-medium">Designation</th>
                <th className="pb-3 font-medium">Joining Date</th>
              </tr>
            </thead>

            <tbody>
              {employees.map((employee) => (
                <tr
                  key={employee.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      {employee.photo ? (
                        <Image
                          src={employee.photo}
                          alt={employee.name}
                          width={36}
                          height={36}
                          unoptimized
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600">
                          {getInitials(employee.name)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="whitespace-nowrap text-xs font-semibold text-slate-800">
                          {employee.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {employee.employeeId}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {employee.department}
                  </td>

                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {employee.designation}
                  </td>

                  <td className="whitespace-nowrap py-3 text-xs text-slate-600">
                    {formatDate(employee.joiningDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
          <Users className="mb-2 text-slate-300" size={28} />
          <p className="text-sm font-medium text-slate-600">
            No recent joinings
          </p>
        </div>
      )}
    </section>
  );
}
