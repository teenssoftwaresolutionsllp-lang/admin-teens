
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  leaveId: string | null | undefined;
};

type ActionStatus = "approved" | "rejected";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ManagerLeaveActions({ leaveId }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState<ActionStatus | null>(null);
  const [error, setError] = useState("");

  async function handleAction(
    status: ActionStatus,
    rejectionReason?: string
  ) {
    try {
      setLoading(status);
      setError("");

      // =========================================
      // 1. DEBUG LEAVE ID
      // =========================================

      console.log("========== MANAGER LEAVE DEBUG ==========");
      console.log("Received leaveId:", leaveId);
      console.log("Leave ID type:", typeof leaveId);
      console.log(
        "Is valid UUID:",
        typeof leaveId === "string" && UUID_REGEX.test(leaveId)
      );
      console.log("Action:", status);
      console.log("=========================================");

      // =========================================
      // 2. VALIDATE LEAVE ID
      // =========================================

      if (!leaveId || !UUID_REGEX.test(leaveId)) {
        throw new Error(
          `Invalid leave request ID: ${String(leaveId)}. Please refresh the manager page.`
        );
      }

      // =========================================
      // 3. BUILD API URL
      // =========================================

      const apiUrl = `/api/managerleaves/${encodeURIComponent(leaveId)}`;

      console.log("Manager Leave API URL:", apiUrl);

      // =========================================
      // 4. CALL API
      // =========================================

      const response = await fetch(apiUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          status,
          rejectionReason,
        }),
      });

      // =========================================
      // 5. READ API RESPONSE
      // =========================================

      const responseText = await response.text();

      console.log("API Status:", response.status);
      console.log("API Response:", responseText);

      let data: {
        success?: boolean;
        message?: string;
        error?: string;
      };

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `API did not return valid JSON. HTTP Status: ${response.status}. Check the API route and server terminal.`
        );
      }

      // =========================================
      // 6. CHECK API RESULT
      // =========================================

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error ||
            data.message ||
            `Unable to ${status === "approved" ? "approve" : "reject"} leave request.`
        );
      }

      // =========================================
      // 7. SUCCESS
      // =========================================

      alert(
        data.message ||
          `Leave request ${status} successfully.`
      );

      router.refresh();
    } catch (err) {
      console.error("Manager leave action error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(null);
    }
  }

  // =========================================
  // APPROVE LEAVE
  // =========================================

  function approveLeave() {
    if (loading !== null) return;

    if (!window.confirm("Approve this leave request?")) {
      return;
    }

    void handleAction("approved");
  }

  // =========================================
  // REJECT LEAVE
  // =========================================

  function rejectLeave() {
    if (loading !== null) return;

    const reason = window.prompt(
      "Enter the reason for rejecting this leave request:"
    );

    if (!reason || !reason.trim()) {
      return;
    }

    void handleAction("rejected", reason.trim());
  }

  // =========================================
  // UI
  // =========================================

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={approveLeave}
          disabled={loading !== null}
          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "approved"
            ? "Approving..."
            : "Approve"}
        </button>

        <button
          type="button"
          onClick={rejectLeave}
          disabled={loading !== null}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "rejected"
            ? "Rejecting..."
            : "Reject"}
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
