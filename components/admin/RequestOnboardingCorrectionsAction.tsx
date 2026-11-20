"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";

type Props = {
  candidateId: string;
  verificationCompleted?: boolean;
};

export default function RequestOnboardingCorrectionsAction({
  candidateId,
  verificationCompleted = false,
}: Props) {
  const router = useRouter();

  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submitRequest() {
    if (loading || verificationCompleted) return;

    const trimmedInstructions = instructions.trim();

    if (!trimmedInstructions) {
      setError("Enter the corrections required from the candidate.");
      return;
    }

    if (trimmedInstructions.length > 4000) {
      setError("Instructions cannot exceed 4000 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/joining/${encodeURIComponent(candidateId)}/onboarding/request-corrections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instructions: trimmedInstructions,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error || "Unable to request corrections."
        );
      }

      setSuccess(
        "Correction request created. The original submission has been preserved."
      );
      setInstructions("");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to request corrections. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div>
        <p className="text-xs font-semibold text-amber-900">
          Request Onboarding Corrections
        </p>
        <p className="mt-1 text-xs text-amber-800">
          Explain what the candidate needs to correct or complete. The
          submitted version will remain preserved in the audit history.
        </p>
      </div>

      {verificationCompleted && (
        <p className="rounded-md border border-slate-200 bg-slate-100 p-2 text-[11px] font-semibold text-slate-600">
          Correction requests are locked because HR verification is complete.
        </p>
      )}

      <textarea
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        rows={4}
        maxLength={4000}
        disabled={loading || verificationCompleted}
        placeholder="Example: Please upload a clear PAN card image and correct the bank account holder name."
        className="w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tabular-nums text-slate-500">
          {instructions.length}/4000 characters
        </span>

        <button
          type="button"
          onClick={submitRequest}
          disabled={
            loading ||
            verificationCompleted ||
            !instructions.trim()
          }
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {loading ? "Submitting..." : "Request Corrections"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-700"
        >
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}