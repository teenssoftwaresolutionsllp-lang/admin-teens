"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  RefreshCw,
  UserRound,
  Mail,
  Phone,
  BriefcaseBusiness,
} from "lucide-react";

type JoiningCandidate = {
  id: string;
  first_name: string;
  last_name: string;
  personal_email: string;
  mobile_number: string;
  designation: string;
  joining_date: string;
  annual_ctc: number | string;
  status: string;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  selected: "Selected",
  offer_sent: "Offer Sent",
  offer_accepted: "Offer Accepted",
  offer_declined: "Offer Declined",
  joining_letter_sent: "Joining Letter Sent",
  joined: "Joined",
  cancelled: "Cancelled",
  expired: "Expired",
};

export default function JoiningEmployeesView() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<JoiningCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/joining", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load joining records.");
      }

      setCandidates(result.candidates ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load joining records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const filteredCandidates = candidates.filter((candidate) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return [
      candidate.first_name,
      candidate.last_name,
      candidate.personal_email,
      candidate.mobile_number,
      candidate.designation,
      candidate.status,
    ].some((value) => String(value ?? "").toLowerCase().includes(query));
  });

  const formatDate = (date: string) => {
    if (!date) return "—";

    const [year, month, day] = date.slice(0, 10).split("-");
    return `${day}-${month}-${year}`;
  };

  const formatCtc = (amount: number | string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Track selected candidates and their joining progress.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadCandidates()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/joining")}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Add Joining
          </button>
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name, email, phone, designation or status..."
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading joining records...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <UserRound className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <h2 className="font-semibold text-slate-900">
            No joining records found
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add a selected candidate using Add Joining to see their record here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Joining Date</th>
                <th className="px-4 py-3">Annual CTC</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">
                      {candidate.first_name} {candidate.last_name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Added {formatDate(candidate.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>{candidate.personal_email}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-slate-500">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{candidate.mobile_number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <BriefcaseBusiness className="h-4 w-4 text-slate-400" />
                      {candidate.designation}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {formatDate(candidate.joining_date)}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-medium">
                    {formatCtc(candidate.annual_ctc)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      {statusLabels[candidate.status] ?? candidate.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            Showing {filteredCandidates.length} of {candidates.length} candidates
          </div>
        </div>
      )}
    </div>
  );
}
