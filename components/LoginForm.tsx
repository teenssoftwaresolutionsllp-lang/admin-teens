"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, Loader2, Sparkles } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to sign in");
      }

      const data = await res.json();
      router.push(data.redirectTo || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
          <p className="text-xs font-bold text-rose-700">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Mail className="h-4 w-4 text-slate-400" />
          </div>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
            placeholder="you@teenssoftware.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-slate-400" />
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all"
            placeholder="••••••••"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-sm text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all hover:shadow"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <LogIn className="-ml-1 mr-2 h-4 w-4 text-white" />
            <span>Sign in to Workspace</span>
          </>
        )}
      </button>

      <div className="pt-5 border-t border-slate-100">
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
            1-Click Demo Profiles
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickLogin("ceo@teenssoftware.com", "Admin@123")}
            className="py-2 px-2.5 bg-slate-100/70 hover:bg-slate-200/80 text-slate-800 rounded-xl text-xs font-bold text-center border border-slate-200 transition-all shadow-2xs"
          >
            CEO Demo
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("hr@teenssoftware.com", "Admin@123")}
            className="py-2 px-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold text-center border border-indigo-200/80 transition-all shadow-2xs"
          >
            HR Demo
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("employee@teenssoftware.com", "Employee@123")}
            className="py-2 px-2.5 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold text-center border border-emerald-200/80 transition-all shadow-2xs"
          >
            Employee Demo
          </button>
        </div>
      </div>
    </form>
  );
}

