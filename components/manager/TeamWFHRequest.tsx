"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WFHRequest = {
  id: string;
  employee_id: string;
  employeeName: string;
  request_date: string;
  reason: string;
  status: string;
  created_at: string;
};

export default function TeamWFHRequests({
  requests,
}: {
  requests: WFHRequest[];
}) {
  const router = useRouter();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<WFHRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function reviewRequest(
    requestId: string,
    status: "approved" | "rejected",
    reason = ""
  ) {
    setLoadingId(requestId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/manager/wfh/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            status,
            rejectionReason: reason,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to review request.");
      }

      setSuccess(result.message || "Request updated successfully.");
      setSelectedRequest(null);
      setRejectionReason("");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoadingId(null);
    }
  }

  function rejectRequest() {
    if (!selectedRequest) return;

    if (!rejectionReason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }

    reviewRequest(
      selectedRequest.id,
      "rejected",
      rejectionReason.trim()
    );
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <p className="font-medium text-gray-700">
            No pending WFH requests
          </p>
          <p className="mt-1 text-sm text-gray-500">
            New team WFH requests will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {item.employeeName}
                  </h3>

                  <p className="mt-1 text-sm text-gray-600">
                    WFH Date:{" "}
                    <span className="font-medium">
                      {item.request_date}
                    </span>
                  </p>

                  <p className="mt-2 text-sm text-gray-700">
                    Reason: {item.reason}
                  </p>

                  <p className="mt-2 text-xs text-gray-500">
                    Submitted:{" "}
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : "—"}
                  </p>
                </div>

                <div className="flex h-fit items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingId === item.id}
                    onClick={() =>
                      reviewRequest(item.id, "approved")
                    }
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingId === item.id
                      ? "Processing..."
                      : "Approve"}
                  </button>

                  <button
                    type="button"
                    disabled={loadingId === item.id}
                    onClick={() => {
                      setError("");
                      setSelectedRequest(item);
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Reject WFH Request
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Employee: {selectedRequest.employeeName}
            </p>

            <p className="text-sm text-gray-600">
              Date: {selectedRequest.request_date}
            </p>

            <label className="mt-4 block text-sm font-medium text-gray-700">
              Rejection reason
            </label>

            <textarea
              value={rejectionReason}
              onChange={(event) =>
                setRejectionReason(event.target.value)
              }
              rows={4}
              maxLength={1000}
              placeholder="Enter the reason for rejection..."
              className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setRejectionReason("");
                  setError("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={rejectRequest}
                disabled={
                  !rejectionReason.trim() ||
                  loadingId === selectedRequest.id
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingId === selectedRequest.id
                  ? "Rejecting..."
                  : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}