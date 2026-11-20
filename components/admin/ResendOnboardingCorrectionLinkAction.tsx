"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, RefreshCw } from "lucide-react";

interface Props {
  candidateId: string;
  verificationCompleted?: boolean;
}

export default function ResendOnboardingCorrectionLinkAction({
  candidateId,
  verificationCompleted = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    if (loading || verificationCompleted) return;

    const confirmed = window.confirm(
      "Send a new secure correction link to the candidate's registered personal email? The previous unused onboarding links will be revoked."
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const response = await fetch(
        `/api/joining/${encodeURIComponent(candidateId)}/onboarding/send-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            correctionMode: true,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to send the correction link."
        );
      }

      window.alert(
        result.message || "Correction link sent successfully."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "[Onboarding Correction Link] Action failed:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-amber-700" />
        <h3 className="text-xs font-bold text-slate-900">
          Onboarding corrections
        </h3>
      </div>

      <p className="text-[11px] leading-4 text-slate-600">
        HR has requested corrections. Send the candidate a new secure
        link to update and resubmit their onboarding information.
      </p>

      {verificationCompleted ? (
        <p className="text-[11px] font-semibold leading-4 text-slate-500">
          Correction-link actions are locked because HR verification is complete.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={loading || verificationCompleted}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending correction link...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Resend Correction Link
            </>
          )}
        </button>
      )}
    </div>
  );
}