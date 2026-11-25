
import { Settings, User, Bell, Shield, Palette, Building2 } from "lucide-react";

const settingsSections = [
  {
    title: "General Settings",
    description: "Manage your HRMS general preferences.",
    icon: Settings,
  },
  {
    title: "Profile Settings",
    description: "Manage your account and profile information.",
    icon: User,
  },
  {
    title: "Notifications",
    description: "Manage HRMS notification preferences.",
    icon: Bell,
  },
  {
    title: "Security",
    description: "Manage password and account security.",
    icon: Shield,
  },
  {
    title: "Appearance",
    description: "Customize your dashboard appearance.",
    icon: Palette,
  },
  {
    title: "Company Settings",
    description: "Manage company information and preferences.",
    icon: Building2,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#101a49]">
          Settings
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage your HRMS account, preferences, and company configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {settingsSections.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Icon size={22} />
              </div>

              <h2 className="font-semibold text-[#101a49]">
                {item.title}
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
