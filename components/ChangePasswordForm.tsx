"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function ChangePasswordForm() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword.length > 128) {
      setError("Your password cannot exceed 128 characters.");
      return;
    }

    if (newPassword === "password") {
      setError("Please choose a password that is not easily guessed.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to change your password."
        );
      }

      router.replace(data.redirectTo || "/portal");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
      <div className="bg-indigo-600 px-7 py-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
          <ShieldCheck className="h-7 w-7 text-white" />
        </div>

        <h1 className="text-xl font-bold text-white">
          Secure Your Account
        </h1>

        <p className="mt-2 text-sm text-indigo-100">
          Create a new password to access your employee workspace.
        </p>
      </div>

      <div className="p-7">
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

            <div>
              <p className="text-sm font-bold text-amber-900">
                Password change required
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Your initial password is temporary. You must create
                your own password before continuing to HRMS.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
            <p className="text-sm font-medium text-rose-700">
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              New Password
            </label>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter your new password"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition-all focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Confirm New Password
            </label>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                maxLength={128}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Re-enter your new password"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition-all focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((value) => !value)
                }
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-2 text-xs font-bold text-slate-700">
              Password requirements
            </p>

            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`h-4 w-4 ${
                    newPassword.length >= 8
                      ? "text-emerald-600"
                      : "text-slate-300"
                  }`}
                />
                At least 8 characters
              </li>

              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`h-4 w-4 ${
                    newPassword.length > 0 &&
                    newPassword === confirmPassword
                      ? "text-emerald-600"
                      : "text-slate-300"
                  }`}
                />
                Both passwords must match
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating Password...
              </>
            ) : (
              "Change Password & Continue"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-5 text-slate-400">
          Your new password is securely managed by your account
          authentication service.
        </p>
      </div>
    </div>
  );
}
