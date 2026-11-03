
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";


type RevertRequest = {
  id: string;
  resignation_request_id: string;
  reason?: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  created_at: string;
};

type ResignationRequest = {
  id: string;
  employee_id: string;
  resignation_date: string;
  notice_period_days: number;
  planned_last_working_date: string;
  reason: string;
  document_url: string;
  document_name: string;
  status: "pending" | "approved" | "rejected" | "withdrawn" | "reverted";
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  revert_requests?: RevertRequest[];
};


type Props = {
  employeeId: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];
const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const DOCUMENT_TYPE = "Resignation Letter";

function getLocalDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(dateString: string) {
  if (!dateString) return "—";

  const [year, month, day] = dateString
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (!year || !month || !day) return "—";

  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ResignationForm({ employeeId }: Props) {
  const [requests, setRequests] = useState<ResignationRequest[]>([]);
  const [resignationDate, setResignationDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [revertReason, setRevertReason] = useState("");

  const [today, setToday] = useState(getLocalDateString);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const noticePeriodDays = 30;

  const plannedLastWorkingDate = resignationDate
    ? addDays(resignationDate, noticePeriodDays)
    : "";

  const loadRequests = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/resignations", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load resignation requests."
        );
      }

      setRequests(data.requests ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load requests."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  // Keep today's minimum date current while the page remains open.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentDate = getLocalDateString();
      setToday(currentDate);

      setResignationDate((previousDate) =>
        previousDate && previousDate < currentDate ? "" : previousDate
      );
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const pendingRequest = requests.some(
    (request) => request.status === "pending"
  );

  function handleDateChange(value: string) {
    setError("");
    setSuccess("");

    const currentDate = getLocalDateString();
    setToday(currentDate);

    if (value && value < currentDate) {
      setResignationDate("");
      setError(
        "Resignation date cannot be in the past. Select today or a future date."
      );
      return;
    }

    setResignationDate(value);
  }

  function handleFileChange(selectedFile: File | null) {
    setError("");
    setSuccess("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();

    if (
      !ALLOWED_TYPES.includes(selectedFile.type) ||
      !extension ||
      !ALLOWED_EXTENSIONS.includes(extension)
    ) {
      setFile(null);
      setError("Upload a valid resignation letter in PDF, JPG, JPEG, or PNG format.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("Document size must not exceed 5 MB.");
      return;
    }

    setFile(selectedFile);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const currentDate = getLocalDateString();
    setToday(currentDate);

    if (!resignationDate) {
      setError("Please select your resignation date.");
      return;
    }

    if (resignationDate < currentDate) {
      setError(
        "Resignation date cannot be in the past. Select today or a future date."
      );
      setResignationDate("");
      return;
    }

    if (!reason.trim()) {
      setError("Please enter your reason for resignation.");
      return;
    }

    if (!file) {
      setError("Please attach your resignation letter.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (
      !ALLOWED_TYPES.includes(file.type) ||
      !extension ||
      !ALLOWED_EXTENSIONS.includes(extension)
    ) {
      setError("Upload a valid resignation letter in PDF, JPG, JPEG, or PNG format.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Document size must not exceed 5 MB.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      const documentPath =
        `${employeeId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-exit-documents")
        .upload(documentPath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          `Resignation letter upload failed: ${uploadError.message}. Check the storage bucket permissions.`
        );
      }

      // Recheck the date immediately before submitting the request.
      const submissionDate = getLocalDateString();

      if (resignationDate < submissionDate) {
        throw new Error(
          "Resignation date cannot be in the past. Please select today's date or a future date."
        );
      }

      const response = await fetch("/api/resignations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_id: employeeId,
          resignation_date: resignationDate,
          reason: reason.trim(),
          document_url: documentPath,
          document_name: `Resignation Letter - ${file.name}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to submit resignation."
        );
      }

      setSuccess("Your resignation request has been submitted to HR.");
      setResignationDate("");
      setReason("");
      setFile(null);

      const input = document.getElementById(
        "resignation-document"
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await loadRequests();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }


  const handleRevertResignation = async (request: ResignationRequest) => {
    const isPending = request.status === "pending";

    const confirmed = window.confirm(
      isPending
        ? "Withdraw this pending resignation? It will be withdrawn immediately."
        : "Send a request to HR to reverse this approved resignation?"
    );

    if (!confirmed) return;

    const reasonText = isPending
      ? null
      : window.prompt(
          "Reason for requesting reversal (optional):",
          revertReason
        );

    if (!isPending && reasonText === null) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/resignations/${request.id}/revert`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: isPending ? "withdraw" : "request",
            ...(isPending ? {} : { reason: reasonText?.trim() ?? "" }),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to process the resignation request."
        );
      }

      setRevertReason(reasonText?.trim() ?? "");

      setSuccess(
        isPending
          ? "Resignation withdrawn successfully."
          : "Reversal request sent to HR successfully."
      );

      await loadRequests();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to process the resignation request."
      );
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-8">
      {/* Submit resignation */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-5 text-lg font-semibold text-gray-900">
          Submit Resignation
        </h2>

        {pendingRequest ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            You already have a pending resignation request. You can submit
            another request after HR reviews it.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="resignation-date"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Resignation Date *
                </label>

                <input
                  id="resignation-date"
                  type="date"
                  required
                  min={today}
                  value={resignationDate}
                  onChange={(event) =>
                    handleDateChange(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <p className="mt-1 text-xs text-gray-500">
                  You can select today or any future date. Past dates are
                  not allowed.
                </p>
              </div>

              <div>
                <label
                  htmlFor="planned-last-working-date"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Estimated Last Working Date
                </label>

                <input
                  id="planned-last-working-date"
                  type="text"
                  readOnly
                  value={
                    plannedLastWorkingDate
                      ? formatDate(plannedLastWorkingDate)
                      : ""
                  }
                  placeholder="Select resignation date first"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Estimated using a 30-day notice period. HR will confirm
                  the final date.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="resignation-reason"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Reason for Resignation *
              </label>

              <textarea
                id="resignation-reason"
                required
                maxLength={5000}
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain your reason for resigning..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Resignation Letter */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Resignation Letter *
              </h3>

              <p className="mb-4 mt-1 text-sm text-gray-600">
                Upload your resignation letter as a PDF or image.
              </p>

              <div>
                <label
                  htmlFor="resignation-document"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Choose Resignation Letter *
                </label>

                <input
                  id="resignation-document"
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0] ?? null)
                  }
                  className="block w-full cursor-pointer text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-indigo-100 file:px-4 file:py-2 file:font-medium file:text-indigo-700 hover:file:bg-indigo-200"
                />

                <p className="mt-2 text-xs text-gray-500">
                  PDF, JPG, JPEG, or PNG. Maximum size: 5 MB.
                </p>
              </div>
            </div>


            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
              >
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Resignation"}
            </button>
          </form>
        )}

        {pendingRequest && (error || success) && (
          <p className="mt-4 text-sm text-gray-600">
            {error || success}
          </p>
        )}
      </section>

      {/* Resignation request history */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          My Resignation Requests
        </h2>

        {loading ? (
          <p className="text-sm text-gray-500">
            Loading requests...
          </p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">
            You have not submitted any resignation requests.
          </p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const latestRevert = request.revert_requests?.[0];
              const hasPendingRevert = request.revert_requests?.some(
                (revert) => revert.status === "pending"
              );

              return (
                <article
                  key={request.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-gray-900">
                      Resignation dated {formatDate(request.resignation_date)}
                    </h3>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        request.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : request.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : request.status === "reverted" ||
                                request.status === "withdrawn"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {request.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    {request.status === "approved" && (
                      <>
                        <p>
                          Approved notice period: {request.notice_period_days} days
                        </p>
                        <p>
                          Last working date:{" "}
                          {formatDate(request.planned_last_working_date)}
                        </p>
                      </>
                    )}

                    {request.status === "pending" && (
                      <p>Notice period and last working date will be decided by HR.</p>
                    )}

                    {request.status === "reverted" && (
                      <p className="rounded-lg bg-green-50 p-3 text-green-800">
                        HR approved the reversal of this resignation.
                      </p>
                    )}

                    {request.status === "withdrawn" && (
                      <p className="rounded-lg bg-gray-50 p-3 text-gray-700">
                        This resignation was withdrawn.
                      </p>
                    )}

                    <p>Reason: {request.reason}</p>
                    <p>
                      Document: {request.document_name || "Resignation Letter attached"}
                    </p>

                    {request.rejection_reason && (
                      <p className="rounded-lg bg-red-50 p-3 text-red-800">
                        <strong>HR rejection reason:</strong>{" "}
                        {request.rejection_reason}
                      </p>
                    )}

                    {latestRevert && (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="font-medium text-gray-800">
                          Reversal request: {latestRevert.status.toUpperCase()}
                        </p>

                        {latestRevert.reason && (
                          <p className="mt-1">Your reason: {latestRevert.reason}</p>
                        )}

                        {latestRevert.status === "pending" && (
                          <p className="mt-1 text-amber-700">
                            Waiting for HR to review your reversal request.
                          </p>
                        )}

                        {latestRevert.status === "approved" && (
                          <p className="mt-1 text-green-700">
                            HR approved your reversal request.
                          </p>
                        )}

                        {latestRevert.status === "rejected" && (
                          <p className="mt-1 text-red-700">
                            <strong>HR rejection reason:</strong>{" "}
                            {latestRevert.rejection_reason ||
                              "No rejection reason provided."}
                          </p>
                        )}
                      </div>
                    )}

                    {(request.status === "pending" ||
                      (request.status === "approved" && !hasPendingRevert)) && (
                      <button
                        type="button"
                        onClick={() => handleRevertResignation(request)}
                        disabled={loading}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {request.status === "pending"
                          ? "Withdraw Resignation"
                          : latestRevert?.status === "rejected"
                            ? "Request Reversal Again"
                            : "Request Reversal"}
                      </button>
                    )}

                    {hasPendingRevert && (
                      <p className="text-sm font-medium text-amber-700">
                        Your reversal request is pending with HR. You cannot submit
                        another until it has been reviewed.
                      </p>
                    )}

                    <p className="pt-1 text-xs text-gray-400">
                      Submitted: {formatDate(request.created_at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
