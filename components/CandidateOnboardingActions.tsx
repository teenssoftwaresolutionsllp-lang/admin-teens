"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, AlertCircle, CheckCircle2 } from "lucide-react";

interface CandidateOnboardingActionsProps {
  candidateId: string;
  personalEmail: string | null;
  acceptedOfferVerified: boolean;
  submissionStatus: string | null;
  onboardingStatus: string;
}

export default function CandidateOnboardingActions({
  candidateId,
  personalEmail,
  acceptedOfferVerified,
  submissionStatus,
  onboardingStatus,
}: CandidateOnboardingActionsProps) {
  const router = useRouter();

  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | null
  >(null);

  const alreadySent = [
    "link_sent",
    "in_progress",
    "submitted",
    "correction_required",
    "verified",
  ].includes(onboardingStatus);

  const submissionCanBeSent =
    submissionStatus === null || submissionStatus === "draft";

  const canSend =
    acceptedOfferVerified &&
    Boolean(personalEmail?.trim()) &&
    !alreadySent &&
    submissionCanBeSent;

  async function readResponse(response: Response) {
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      throw new Error(
        result?.error || "The request could not be completed."
      );
    }

    return result;
  }

  async function handleSendOnboardingLink() {
    if (!canSend || isSending) return;

    setIsSending(true);
    setMessage("");
    setMessageType(null);

    try {
      // Step 1: Prepare or reuse the onboarding draft.
      const prepareResponse = await fetch(
        `/api/joining/${encodeURIComponent(candidateId)}/onboarding`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      await readResponse(prepareResponse);

      // Step 2: Send the secure link only after HR explicitly clicks.
      const sendResponse = await fetch(
        `/api/joining/${encodeURIComponent(candidateId)}/onboarding/send-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const sendResult = await readResponse(sendResponse);

      setMessage(
        sendResult.message || "Onboarding link sent successfully."
      );
      setMessageType("success");

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send the onboarding link."
      );
      setMessageType("error");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-3">
      {!personalEmail?.trim() && (
        <p className="text-sm text-amber-700">
          A personal email address is required before sending the link.
        </p>
      )}

      {!acceptedOfferVerified && (
        <p className="text-sm text-amber-700">
          The accepted offer must be verified before onboarding can start.
        </p>
      )}

      {submissionStatus && submissionStatus !== "draft" && (
        <p className="text-sm text-slate-500">
          The current submission is {submissionStatus}. A new onboarding
          link cannot be sent from this stage.
        </p>
      )}

      {alreadySent && (
        <p className="text-sm text-slate-500">
          An onboarding link has already been sent or the candidate has
          progressed beyond the link stage.
        </p>
      )}

      <button
        type="button"
        onClick={handleSendOnboardingLink}
        disabled={!canSend || isSending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing and sending...
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            Send Onboarding Link
          </>
        )}
      </button>

      {message && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            messageType === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {messageType === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}