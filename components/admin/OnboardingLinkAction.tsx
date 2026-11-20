"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, ShieldCheck } from "lucide-react";

interface Props {
  candidateId: string;
  onboardingStatus: string;
  hasSubmission: boolean;
  verificationCompleted?: boolean;
}

export default function OnboardingLinkAction({
  candidateId,
  onboardingStatus,
  hasSubmission,
  verificationCompleted = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const alreadySent = [
    "link_sent",
    "in_progress",
    "submitted",
    "correction_required",
    "verified",
  ].includes(onboardingStatus);

  async function handleSendLink() {
    if (loading || alreadySent || verificationCompleted) return;

    const confirmed = window.confirm(
      "Prepare the candidate's onboarding draft and send a secure onboarding link to their registered personal email?"
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      // Step 1: Prepare or reuse the onboarding draft.
      const draftResponse = await fetch(
        `/api/joining/${encodeURIComponent(candidateId)}/onboarding`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      const draftResult = await draftResponse.json();

      if (!draftResponse.ok || !draftResult.success) {
        throw new Error(
          draftResult.error || "Unable to prepare onboarding."
        );
      }

      // Step 2: Send only after the explicit HR button click.
      const sendResponse = await fetch(
        `/api/joining/${encodeURIComponent(candidateId)}/onboarding/send-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      const sendResult = await sendResponse.json();

      if (!sendResponse.ok || !sendResult.success) {
        throw new Error(
          sendResult.error || "Unable to send onboarding link."
        );
      }

      window.alert(
        sendResult.message || "Onboarding link sent successfully."
      );

      router.refresh();
    } catch (error) {
      console.error("[Onboarding Link] Action failed:", error);

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
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-indigo-600" />
        <h3 className="text-xs font-bold text-slate-900">
          Candidate onboarding link
        </h3>
      </div>

      <p className="text-[11px] leading-4 text-slate-600">
        The candidate will receive a secure, time-limited link to submit
        personal information and required documents. No employee account
        will be created at this stage.
      </p>
        {verificationCompleted ? (
        <p className="text-[11px] font-semibold leading-4 text-slate-500">
            Onboarding actions are locked because HR verification is complete.
        </p>
        ) : alreadySent ? (
            <p className="text-[11px] font-semibold leading-4 text-emerald-700">
            An onboarding link has already been sent or the candidate has
            progressed beyond that stage.
            </p>
        ) : (
            <button
            type="button"
            onClick={handleSendLink}
            disabled={loading || verificationCompleted}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
            {loading ? (
                <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing and sending...
                </>
            ) : (
                <>
                <Mail className="h-4 w-4" />
                {hasSubmission
                    ? "Send Onboarding Link"
                    : "Prepare & Send Onboarding Link"}
                </>
            )}
            </button>
        )}
    </div>
  );
}
