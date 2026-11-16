
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  leaveId: string;
};

export default function ManagerLeaveActions({ leaveId }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState<
    "approved" | "rejected" | null
  >(null);

  const [error, setError] = useState("");

  async function handleAction(
    status: "approved" | "rejected",
    rejectionReason?: string
  ) {
    try {
      setLoading(status);
      setError("");

      const response = await fetch(
        `/api/manager/leaves/${leaveId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            status,
            rejectionReason,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to update leave request."
        );
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(null);
    }
  }

  function approveLeave() {
    if (!window.confirm("Approve this leave request?")) {
      return;
    }

    void handleAction("approved");
  }

  function rejectLeave() {
    const reason = window.prompt(
      "Enter the reason for rejecting this leave request:"
    );

    if (!reason || !reason.trim()) {
      return;
    }

    void handleAction("rejected", reason.trim());
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={approveLeave}
          disabled={loading !== null}
          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "approved" ? "Approving..." : "Approve"}
        </button>

        <button
          type="button"
          onClick={rejectLeave}
          disabled={loading !== null}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "rejected" ? "Rejecting..." : "Reject"}
        </button>
      </div>

      {error && (
        <p className="max-w-xs text-right text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
