import Link from "next/link";
import {
  UserPlus,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  ChartNoAxesCombined,
  Settings,
  ArrowUpRight,
} from "lucide-react";

const actions = [
  {
    title: "Add Employee",
    description: "Create a new employee profile",
    href: "/dashboard/employees/add",
    icon: UserPlus,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Add Joining Candidate",
    description: "Manage joining candidates",
    href: "/dashboard/joining",
    icon: BriefcaseBusiness,
    color: "bg-green-50 text-green-600",
  },
//   {
//     title: "Approve Leave",
//     description: "Review pending leave requests",
//     href: "/dashboard/approvals",
//     icon: ClipboardCheck,
//     color: "bg-orange-50 text-orange-600",
//   },
  {
    title: "Generate Payslip",
    description: "Open payroll management",
    href: "/dashboard/payroll",
    icon: FileText,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "View Reports",
    description: "View attendance and HR data",
    href: "/dashboard/attendance",
    icon: ChartNoAxesCombined,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Manage Policies",
    description: "Manage HR policies",
    href: "/dashboard/policies",
    icon: Settings,
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    title: "Approval Hub",
    description: "Review all pending HR approvals",
    href: "/dashboard/approvals",
    icon: ClipboardList,
    color: "bg-indigo-50 text-indigo-600",
  },
];

export default function QuickActions() {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 shrink-0">
        <h2 className="text-base font-semibold text-slate-800">
          Quick Actions
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Frequently used HR operations
        </p>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.title}
              href={action.href}
              className="group flex min-h-[112px] flex-col justify-between rounded-xl border border-slate-100 p-3 transition hover:border-indigo-200 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}
                >
                  <Icon size={19} />
                </div>

                <ArrowUpRight
                  size={15}
                  className="text-slate-300 transition group-hover:text-indigo-600"
                />
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-800">
                  {action.title}
                </p>

                <p className="mt-1 text-[10px] leading-4 text-slate-500">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
