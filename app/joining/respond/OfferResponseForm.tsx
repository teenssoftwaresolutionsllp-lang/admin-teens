"use client";

import { useEffect, useState } from "react";

type OfferAction = "accept_offer" | "decline_offer";

type Props = {
  token: string;
  action: OfferAction;
};

export default function OfferResponseForm({
  token,
  action,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [valid, setValid] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);

  const accepting = action === "accept_offer";

  useEffect(() => {
    let cancelled = false;

    async function validateLink() {
      try {
        const query = new URLSearchParams({ token, action });

        const response = await fetch(
          `/api/joining/respond?${query.toString()}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.valid) {
          setMessage(
            result.error ||
              "This link is invalid, expired, or already used."
          );
          return;
        }

        setFirstName(result.firstName);
        setValid(true);
      } catch {
        if (!cancelled) {
          setMessage("Unable to validate the link. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void validateLink();

    return () => {
      cancelled = true;
    };
  }, [token, action]);

  async function submitDecision() {
    if (submitting || completed) return;

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/joining/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, action }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setValid(false);
        setMessage(
          result.error ||
            "Your decision could not be recorded. Please contact HR."
        );
        return;
      }

      setCompleted(true);
      setValid(false);
      setMessage(result.message || "Your response has been recorded.");
    } catch {
      setMessage(
        "Unable to submit your decision. Please try again or contact HR."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="mb-6">
          <p className="text-sm font-semibold text-indigo-600">
            TEENS SOFTWARE SOLUTIONS LLP
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Offer {accepting ? "Acceptance" : "Decline"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {loading
              ? "Validating your offer link..."
              : completed
                ? "Your response has been recorded."
                : valid
                  ? `Hello ${firstName}, please confirm that you want to ${
                      accepting ? "accept" : "decline"
                    } the offer.`
                  : "We could not verify this offer link."}
          </p>
        </div>

        {loading && (
          <p role="status" className="text-sm text-slate-500">
            Please wait...
          </p>
        )}

        {!loading && valid && !completed && (
          <>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              {accepting
                ? "By confirming, you accept the offer described in your offer letter."
                : "By confirming, you decline the offer described in your offer letter."}
            </div>

            <button
              type="button"
              onClick={() => void submitDecision()}
              disabled={submitting}
              className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Submitting..."
                : accepting
                  ? "Confirm Acceptance"
                  : "Confirm Decline"}
            </button>
          </>
        )}

        {message && (
          <p
            role="status"
            className={`mt-5 rounded-lg p-3 text-sm ${
              completed
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {message}
          </p>
        )}

        {completed && (
          <p className="mt-4 text-sm text-slate-600">
            Thank you. You may close this page now.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          If you need assistance, contact your HR team.
        </p>
      </section>
    </main>
  );
}