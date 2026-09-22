import LoginForm from "@/components/LoginForm";
import Image from "next/image";

export default async function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100/60 px-4 py-12">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200/80 inline-block">
              <Image 
                src="/logo.png" 
                alt="Teens Software Solutions Logo" 
                width={220}
                height={60}
                className="max-w-[220px] object-contain"
                style={{ width: "100%", height: "auto" }}
                priority
              />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Enterprise HRMS & Payroll</h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 font-medium">
            Sign in to access your administrative workspace or employee portal
          </p>
        </div>
        
        <div className="bg-white p-7 sm:p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/90">
          <LoginForm />
        </div>
        
        <div className="text-center">
          <p className="text-[11px] font-semibold text-slate-400">
            &copy; {new Date().getFullYear()} Teens Software Solutions LLP. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

