"use client";

import { useMemo, useState, useEffect } from "react";

import {
  Employee,
  EmployeeLeaveBalance,
  LeaveRequest,
  LeaveType,
  Project,
} from "@/lib/types";

import {
  Calendar,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  Globe,
} from "lucide-react";

interface EmployeeLeavesViewProps {
  employee: Employee;
  project: Project;
  leaveBalances: EmployeeLeaveBalance[];
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
}

export default function EmployeeLeavesView({
  employee,
  project,
  leaveBalances: initialBalances,
  leaveRequests: initialRequests,
  leaveTypes,
}: EmployeeLeavesViewProps) {
  /* ============================================================
     STATE
  ============================================================ */

  const [balances, setBalances] =
    useState<EmployeeLeaveBalance[]>(
      initialBalances ?? []
    );

  useEffect(() => {
    setBalances(initialBalances ?? []);
  }, [initialBalances]);

  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests ?? []);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ============================================================
     TODAY
  ============================================================ */

  const today = new Date()
    .toISOString()
    .split("T")[0];

  /* ============================================================
     GET REAL LEAVE TYPE ID
     Uses database records - no fake IDs
  ============================================================ */

  const getLeaveTypeId = (
    ...names: string[]
  ) => {
    const found = leaveTypes.find((type) =>names.some((name) => type.name ?.toLowerCase().trim() === name.toLowerCase().trim())
    );

    return found?.id ?? "";
  };

  /* ============================================================
     ALLOWED LEAVE TYPES
  ============================================================ */

  const leaveTypeOptions = useMemo(() => {
    return [
      {
        label: "Sick Leave",
        id: getLeaveTypeId("Sick Leave"),
      },
      {
        label: "Casual Leave",
        id: getLeaveTypeId("Casual Leave"),
      },
      {
        label: "Earned Leave",
        id: getLeaveTypeId("Earned Leave"),
      },
      {
        label: "Loss of Pay (LOP)",
        id: getLeaveTypeId(
          "Loss of Pay",
          "LOP",
          "Loss of Pay (LOP)"
        ),
      },
    ].filter((option) => option.id);
  }, [leaveTypes]);

  /* ============================================================
     INITIAL LEAVE TYPE
  ============================================================ */

  const getDefaultLeaveTypeId = () => {
    return (
      getLeaveTypeId("Sick Leave") ||
      leaveTypeOptions[0]?.id ||
      ""
    );
  };

  /* ============================================================
     FORM
  ============================================================ */

  const [formData, setFormData] =
    useState({
      leaveTypeId: getDefaultLeaveTypeId(),
      startDate: today,
      endDate: today,
      isHalfDay: false,
      reason: "",
    });

  /* ============================================================
     SELECTED TYPE
  ============================================================ */

  const selectedType = useMemo(() => {
    return leaveTypes.find(
      (lt) =>
        lt.id ===
        formData.leaveTypeId
    );
  }, [
    leaveTypes,
    formData.leaveTypeId,
  ]);

  /* ============================================================
     CALCULATE LEAVE DAYS
  ============================================================ */

  const calculateDays = () => {
    if (
      !formData.startDate ||
      !formData.endDate
    ) {
      return 0;
    }

    if (formData.isHalfDay) {
      return 0.5;
    }

    const start = new Date(
      `${formData.startDate}T00:00:00`
    );

    const end = new Date(
      `${formData.endDate}T00:00:00`
    );

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return 0;
    }

    if (end < start) {
      return 0;
    }

    const diff =
      Math.floor(
        (end.getTime() -
          start.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    return diff;
  };

  /* ============================================================
     OPEN MODAL
  ============================================================ */

  const openLeaveModal = () => {
    setSuccessMsg(null);

    setFormData({
      leaveTypeId: getDefaultLeaveTypeId(),
      startDate: today,
      endDate: today,
      isHalfDay: false,
      reason: "",
    });

    setIsModalOpen(true);
  };

  /* ============================================================
     CLOSE MODAL
  ============================================================ */

  const closeLeaveModal = () => {
    if (submitting) {
      return;
    }

    setIsModalOpen(false);
  };

  /* ============================================================
     SUBMIT LEAVE APPLICATION
  ============================================================ */

  const handleApplySubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setSuccessMsg(null);

    /* ----------------------------------------------------------
       VALIDATE LEAVE TYPE
    ---------------------------------------------------------- */

    if (!formData.leaveTypeId) {
      alert(
        "Please select a leave type."
      );
      return;
    }

    /* ----------------------------------------------------------
       VALIDATE DATES
    ---------------------------------------------------------- */

    if (
      !formData.startDate ||
      !formData.endDate
    ) {
      alert(
        "Please select both From Date and To Date."
      );
      return;
    }

    if (
      formData.endDate <
      formData.startDate
    ) {
      alert(
        "To Date cannot be before From Date."
      );
      return;
    }

    /* ----------------------------------------------------------
       VALIDATE REASON
    ---------------------------------------------------------- */

    if (!formData.reason.trim()) {
      alert(
        "Please enter a reason for leave."
      );
      return;
    }

    const totalDays =
      calculateDays();

    if (totalDays <= 0) {
      alert(
        "Please select a valid leave duration."
      );
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(
        "/api/leaves",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            employeeId:
              employee.id,

            leaveTypeId:
              formData.leaveTypeId,

            startDate:
              formData.startDate,

            endDate:
              formData.endDate,

            totalDays,

            isHalfDay:
              formData.isHalfDay,

            reason:
              formData.reason.trim(),
          }),
        }
      );

      const data =
        await res.json();

      /* --------------------------------------------------------
         API ERROR
      -------------------------------------------------------- */

      if (!res.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            `Leave submission failed. Status: ${res.status}`
        );
      }

      /* --------------------------------------------------------
         GET CREATED REQUEST
      -------------------------------------------------------- */

      const newRequest =
        data?.leaveRequest ||
        data?.request;

      if (!newRequest) {
        throw new Error(
          "Leave was submitted, but the created request was not returned by the server."
        );
      }

      /* --------------------------------------------------------
         ADD NEW REQUEST TO TABLE
      -------------------------------------------------------- */

      setRequests((prev) => [
        newRequest,
        ...prev,
      ]);

      /* --------------------------------------------------------
         CLOSE MODAL
      -------------------------------------------------------- */

      setIsModalOpen(false);

      /* --------------------------------------------------------
         SUCCESS MESSAGE
      -------------------------------------------------------- */

      setSuccessMsg(
        "Leave application successfully submitted to HR for approval."
      );

      /* --------------------------------------------------------
         RESET FORM
      -------------------------------------------------------- */

      setFormData({
        leaveTypeId:
          getDefaultLeaveTypeId(),

        startDate: today,

        endDate: today,

        isHalfDay: false,

        reason: "",
      });
    } catch (err) {
      console.error(
        "Leave submission API error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to submit leave application."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* ========================================================
          TOP BAR
      ======================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">

        <div className="space-y-1">

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Leave Management & Balances
          </h2>

          <p className="text-xs sm:text-sm text-slate-500">
            Track allocated paid leaves, submit leave requests, and see project-specific holiday schedules.
          </p>

        </div>

        <button
          type="button"
          onClick={openLeaveModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />

          <span>
            Apply for Leave
          </span>
        </button>

      </div>

      {/* ========================================================
          SUCCESS MESSAGE
      ======================================================== */}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">

          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />

          <span>
            {successMsg}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccessMsg(null)
            }
            className="ml-auto text-emerald-500 hover:text-emerald-700"
          >
            <XCircle className="w-4 h-4" />
          </button>

        </div>
      )}

      {/* ========================================================
          LEAVE BALANCES GRID
      ======================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

        {balances.map((b) => (

          <div
            key={b.id}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-4"
          >

            <div className="flex items-center justify-between">

              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                {b.leave_type?.code ||
                  "LV"}
              </span>

              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Year {b.year}
              </span>

            </div>

            <div>

              <h3 className="text-sm font-bold text-slate-900">
                {b.leave_type?.name}
              </h3>

              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                {b.leave_type?.description ||
                  "Annual quota"}
              </p>

            </div>

            <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">

              <div>

                <span className="text-3xl font-black text-slate-900 font-mono">
                  {b.balance_days}
                </span>

                <span className="text-xs text-slate-500 font-medium ml-1.5">
                  days left
                </span>

              </div>

              <div className="text-right text-xs text-slate-500 font-medium">

                <span>
                  Used:{" "}
                  <strong className="text-slate-800">
                    {b.used_days}
                  </strong>{" "}
                  /{" "}
                </span>

                <span className="font-bold text-slate-700">
                  {b.allocated_days}
                </span>

              </div>

            </div>

          </div>

        ))}

      </div>

      {/* ========================================================
          LOP + COUNTRY HOLIDAY INFO
      ======================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* LOP */}

        <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3.5 shadow-xs">

          <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">

            <AlertTriangle className="w-5 h-5" />

          </div>

          <div className="space-y-1">

            <h4 className="font-bold text-amber-950 text-sm">
              Loss of Pay (LOP) Policy
            </h4>

            <p className="leading-relaxed text-amber-800">

              Leaves taken beyond your allocated balance or marked as Loss of Pay will directly deduct
              from your monthly salary based on the formula:{" "}

              <code className="font-mono font-bold bg-amber-100/90 text-amber-900 px-1.5 py-0.5 rounded">
                (Monthly CTC / Days in Month) × LOP Days
              </code>

              .

            </p>

          </div>

        </div>

        {/* COUNTRY CALENDAR */}

        <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50/50 rounded-2xl border border-purple-200/80 text-xs text-purple-900 flex items-start gap-3.5 shadow-xs">

          <div className="p-2 bg-purple-100 rounded-xl text-purple-700 shrink-0">

            <Globe className="w-5 h-5" />

          </div>

          <div className="space-y-1">

            <h4 className="font-bold text-purple-950 text-sm">
              Project Country Calendar (
              {project.client_country}
              )
            </h4>

            <p className="leading-relaxed text-purple-800">

              Your holidays are mapped to your active client project{" "}

              <strong className="text-purple-950">
                {project.name}
              </strong>

              . Teams assigned to US or India clients follow their
              respective client timelines and official country gazetted holidays.

            </p>

          </div>

        </div>

      </div>

      {/* ========================================================
          LEAVE APPLICATION HISTORY
      ======================================================== */}

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">

        <div className="p-5 border-b border-slate-100 flex items-center justify-between">

          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">

            <Calendar className="w-4 h-4 text-indigo-600" />

            <span>
              My Leave Applications
            </span>

          </h3>

          <span className="text-xs font-semibold text-slate-400">
            Past & Upcoming Requests
          </span>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs text-slate-600">

            <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">

              <tr>

                <th className="py-3.5 px-5">
                  Leave Type
                </th>

                <th className="py-3.5 px-5">
                  From
                </th>

                <th className="py-3.5 px-5">
                  To
                </th>

                <th className="py-3.5 px-5">
                  Duration
                </th>

                <th className="py-3.5 px-5">
                  Reason
                </th>

                <th className="py-3.5 px-5">
                  Status
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {/* ==================================================
                  EMPTY TABLE
              ================================================== */}

              {requests.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="py-10 px-5 text-center"
                  >

                    <div className="flex flex-col items-center justify-center">

                      <Calendar className="w-8 h-8 text-slate-300" />

                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        No leave requests yet
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Apply for leave to see your request here.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                /* ==================================================
                   REQUEST ROWS
                ================================================== */

                requests.map((r) => (

                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >

                    {/* Leave Type */}

                    <td className="py-3.5 px-5 font-bold text-slate-900">

                      <div className="flex items-center gap-2">

                        <div className="p-1.5 bg-indigo-50 rounded-lg">

                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />

                        </div>

                        <div>

                          <span>
                            {r.leave_type?.name ||
                              "Leave"}
                          </span>

                          {r.is_half_day && (
                            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                              Half Day
                            </p>
                          )}

                        </div>

                      </div>

                    </td>

                    {/* From */}

                    <td className="py-3.5 px-5 font-mono text-slate-700 whitespace-nowrap">
                      {r.start_date}
                    </td>

                    {/* To */}

                    <td className="py-3.5 px-5 font-mono text-slate-700 whitespace-nowrap">
                      {r.end_date}
                    </td>

                    {/* Duration */}

                    <td className="py-3.5 px-5 font-bold text-slate-800 whitespace-nowrap">

                      {r.total_days}{" "}

                      {r.total_days === 1
                        ? "day"
                        : "days"}

                      {r.is_half_day &&
                        " (Half Day)"}

                    </td>

                    {/* Reason */}

                    <td className="py-3.5 px-5 text-slate-600 max-w-xs truncate">
                      {r.reason || "-"}
                    </td>

                    {/* Status */}

                    <td className="py-3.5 px-5">

                      <span
                        className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${
                          r.status ===
                          "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status ===
                              "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status}
                      </span>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ========================================================
          APPLY LEAVE MODAL
      ======================================================== */}

      {isModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">

          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">

            {/* Modal Header */}

            <div className="flex items-center justify-between pb-3 border-b border-slate-200">

              <div>

                <h3 className="text-base font-bold text-slate-900">
                  Apply for Leave
                </h3>

                <p className="mt-1 text-[11px] text-slate-400">
                  Submit a new leave application.
                </p>

              </div>

              <button
                type="button"
                onClick={closeLeaveModal}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >

                <XCircle className="w-5 h-5" />

              </button>

            </div>

            {/* Modal Form */}

            <form
              onSubmit={
                handleApplySubmit
              }
              className="mt-4 space-y-4 text-xs"
            >

              {/* ==================================================
                  LEAVE TYPE
              ================================================== */}

              <div>

                <label
                  htmlFor="leave-type"
                  className="font-semibold text-slate-700 block mb-1"
                >
                  Leave Type
                </label>

                <select
                  id="leave-type"
                  value={
                    formData.leaveTypeId
                  }
                  onChange={(e) =>
                    setFormData(
                      (prev) => ({
                        ...prev,
                        leaveTypeId:
                          e.target.value,
                      })
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >

                  <option value="">
                    Select Leave Type
                  </option>

                  {leaveTypeOptions.map(
                    (option) => (
                      <option
                        key={option.id}
                        value={option.id}
                      >
                        {option.label}
                      </option>
                    )
                  )}

                </select>

                {selectedType &&
                  !selectedType.is_paid && (

                    <p className="text-[11px] text-amber-600 mt-1 font-medium">
                      ⚠️ Note: LOP leave directly reduces your monthly net salary.
                    </p>

                  )}

              </div>

              {/* ==================================================
                  DATE RANGE
              ================================================== */}

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label
                    htmlFor="leave-start-date"
                    className="font-semibold text-slate-700 block mb-1"
                  >
                    From Date
                  </label>

                  <input
                    id="leave-start-date"
                    type="date"
                    required
                    value={
                      formData.startDate
                    }
                    onChange={(e) =>
                      setFormData(
                        (prev) => ({
                          ...prev,
                          startDate:
                            e.target.value,
                          endDate:
                            prev.endDate <
                            e.target.value
                              ? e.target.value
                              : prev.endDate,
                        })
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />

                </div>

                <div>

                  <label
                    htmlFor="leave-end-date"
                    className="font-semibold text-slate-700 block mb-1"
                  >
                    To Date
                  </label>

                  <input
                    id="leave-end-date"
                    type="date"
                    required
                    min={
                      formData.startDate
                    }
                    value={
                      formData.endDate
                    }
                    onChange={(e) =>
                      setFormData(
                        (prev) => ({
                          ...prev,
                          endDate:
                            e.target.value,
                        })
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />

                </div>

              </div>

              {/* ==================================================
                  HALF DAY
              ================================================== */}

              <div className="flex items-center gap-2 pt-1">

                <input
                  type="checkbox"
                  id="halfDay"
                  checked={
                    formData.isHalfDay
                  }
                  onChange={(e) =>
                    setFormData(
                      (prev) => ({
                        ...prev,
                        isHalfDay:
                          e.target.checked,
                      })
                    )
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />

                <label
                  htmlFor="halfDay"
                  className="text-slate-700 font-medium"
                >
                  Applying for Half Day
                  (0.5 day)
                </label>

              </div>

              {/* ==================================================
                  REASON
              ================================================== */}

              <div>

                <label
                  htmlFor="leave-reason"
                  className="font-semibold text-slate-700 block mb-1"
                >
                  Reason for Leave
                </label>

                <textarea
                  id="leave-reason"
                  required
                  rows={3}
                  value={
                    formData.reason
                  }
                  onChange={(e) =>
                    setFormData(
                      (prev) => ({
                        ...prev,
                        reason:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="Explain the reason for leave"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />

              </div>

              {/* ==================================================
                  TOTAL DURATION
              ================================================== */}

              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between text-slate-700">

                <span className="font-medium">
                  Total Duration:
                </span>

                <span className="font-bold text-sm text-indigo-700">

                  {calculateDays()}{" "}

                  {calculateDays() ===
                  1
                    ? "day"
                    : "days"}

                </span>

              </div>

              {/* ==================================================
                  BUTTONS
              ================================================== */}

              <div className="flex items-center justify-end gap-2 pt-3 border-t">

                <button
                  type="button"
                  onClick={
                    closeLeaveModal
                  }
                  disabled={submitting}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {submitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}

                  <span>
                    {submitting
                      ? "Submitting..."
                      : "Submit Application"}
                  </span>

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}