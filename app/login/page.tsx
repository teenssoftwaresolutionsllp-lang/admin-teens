import LoginForm from "@/components/LoginForm";
import Image from "next/image";

export default async function LoginPage(props: PageProps<"/login">) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.png" 
              alt="Teens Software Solutions Logo" 
              width={300}
              height={80}
              className="max-w-[300px] object-contain"
              style={{ width: "100%", height: "auto" }}
              
            />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome Back</h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to Teens Software Solutions
          </p>
        </div>
        
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <LoginForm />
        </div>
        
        <div className="text-center">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Teens Software Solutions. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
