"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  Employee,
  EmployeeLeaveBalance,
  LeaveRequest,
  LeaveType,
  Project,
} from "@/lib/types";
import {
  Calendar,
  CalendarDays,
  Baby,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Eye,
  HeartPulse,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  FileUp,
  X,
} from "lucide-react";

interface EmployeeLeavesViewProps {
  employee: Employee;
  project: Project;
  leaveBalances: EmployeeLeaveBalance[];
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
  mode?: "apply" | "my-leaves";
}

type LeaveOption = {
  label: string;
  id: string;
  code: string;
  special: boolean;
};

const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export default function EmployeeLeavesView({
  employee,
  project,
  leaveBalances: initialBalances,
  leaveRequests: initialRequests,
  leaveTypes,
  mode = "my-leaves",
}: EmployeeLeavesViewProps) {
  const [balances] = useState<EmployeeLeaveBalance[]>(
    initialBalances ?? []
  );

  const [requests, setRequests] = useState<LeaveRequest[]>(
    initialRequests ?? []
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
  });

  const pageSize = 10;

  const [supportingDocument, setSupportingDocument] =
    useState<File | null>(null);

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => {
        const status = String(request.status).toLowerCase();

        const appliedMonth = String(
          request.created_at || request.start_date || ""
        ).slice(0, 7);

        return (
          (statusFilter === "all" || status === statusFilter) &&
          (!monthFilter || appliedMonth === monthFilter)
        );
      }),
    [requests, statusFilter, monthFilter]
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRequests.length / pageSize)
  );

  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const formatLeaveDate = (value?: string | null) => {
    if (!value) return "--";

    const date = new Date(`${value.slice(0, 10)}T00:00:00`);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  const getLocalToday = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today = getLocalToday();

  const employeeRecord = employee as unknown as Record<string, unknown>;

  const rawJoiningDate =
    employeeRecord.joining_date ??
    employeeRecord.joiningDate ??
    employeeRecord.date_of_joining ??
    employeeRecord.dateOfJoining ??
    employeeRecord.join_date ??
    employeeRecord.joinDate;

  const joiningDate =
    rawJoiningDate instanceof Date
      ? [
          rawJoiningDate.getFullYear(),
          String(rawJoiningDate.getMonth() + 1).padStart(2, "0"),
          String(rawJoiningDate.getDate()).padStart(2, "0"),
        ].join("-")
      : typeof rawJoiningDate === "string"
        ? rawJoiningDate.slice(0, 10)
        : "";

  const defaultLeaveDate =
    joiningDate && joiningDate > today ? joiningDate : today;

  const employeeGender = String(employee.gender ?? "")
    .trim()
    .toLowerCase();

  const isFemale = ["female", "f"].includes(employeeGender);
  const isMale = ["male", "m"].includes(employeeGender);

  const visibleBalances = useMemo(() => {
    const specialCode = isFemale ? "ML" : isMale ? "PL" : null;

    const order = ["CL", "SL", "EL", specialCode].filter(
      (code): code is string => Boolean(code)
    );

    return balances
      .filter((balance) =>
        order.includes(
          String(balance.leave_type?.code ?? "").toUpperCase()
        )
      )
      .sort(
        (left, right) =>
          order.indexOf(
            String(left.leave_type?.code ?? "").toUpperCase()
          ) -
          order.indexOf(
            String(right.leave_type?.code ?? "").toUpperCase()
          )
      );
  }, [balances, isFemale, isMale]);

  const genderLoading = false;

  const getLeaveTypeId = useCallback(
    (...namesOrCodes: string[]) => {
      const found = leaveTypes.find((type) => {
        const typeName = type.name?.trim().toLowerCase();
        const typeCode = type.code?.trim().toLowerCase();

        return namesOrCodes.some((value) => {
          const searchValue = value.trim().toLowerCase();

          return (
            typeName === searchValue ||
            typeCode === searchValue ||
            typeName?.includes(searchValue)
          );
        });
      });

      return found?.id ?? "";
    },
    [leaveTypes]
  );

  const leaveTypeOptions = useMemo<LeaveOption[]>(() => {
    const options: LeaveOption[] = [
      {
        label: "Casual Leave (CL)",
        id: getLeaveTypeId("CL", "Casual Leave"),
        code: "CL",
        special: false,
      },
      {
        label: "Sick Leave (SL)",
        id: getLeaveTypeId("SL", "Sick Leave"),
        code: "SL",
        special: false,
      },
      {
        label: "Earned Leave (EL)",
        id: getLeaveTypeId("EL", "Earned Leave"),
        code: "EL",
        special: false,
      },
      {
        label: "Loss of Pay (LOP)",
        id: getLeaveTypeId("LOP", "Loss of Pay"),
        code: "LOP",
        special: false,
      },
    ];

    if (isFemale) {
      options.push({
        label: "Maternity Leave (ML)",
        id: getLeaveTypeId("ML", "Maternity Leave"),
        code: "ML",
        special: true,
      });
    }

    if (isMale) {
      options.push({
        label: "Paternity Leave (PL)",
        id: getLeaveTypeId("PL", "Paternity Leave"),
        code: "PL",
        special: true,
      });
    }

    return options.filter((option) => Boolean(option.id));
  }, [getLeaveTypeId, isFemale, isMale]);

  const getDefaultLeaveTypeId = useCallback(
    () =>
      getLeaveTypeId("SL", "Sick Leave") ||
      leaveTypeOptions[0]?.id ||
      "",
    [getLeaveTypeId, leaveTypeOptions]
  );

  const [formData, setFormData] = useState({
    leaveTypeId: "",
    startDate: defaultLeaveDate,
    endDate: defaultLeaveDate,
    isHalfDay: false,
    leaveDuration: "" as "" | "first_half" | "second_half",
    reason: "",
    specialLeaveDuration: "",
  });

  const [previousLeaveTypeOptions, setPreviousLeaveTypeOptions] =
    useState(leaveTypeOptions);

  if (previousLeaveTypeOptions !== leaveTypeOptions) {
    setPreviousLeaveTypeOptions(leaveTypeOptions);

    setFormData((previous) => {
      const selectedOptionExists = leaveTypeOptions.some(
        (option) => option.id === previous.leaveTypeId
      );

      if (selectedOptionExists) {
        return previous;
      }

      return {
        ...previous,
        leaveTypeId: getDefaultLeaveTypeId(),
        specialLeaveDuration: "",
        isHalfDay: false,
        leaveDuration: "",
        endDate: previous.startDate,
      };
    });
  }

  const selectedType = useMemo(
    () => leaveTypes.find((type) => type.id === formData.leaveTypeId),
    [leaveTypes, formData.leaveTypeId]
  );

  const selectedLeaveOption = leaveTypeOptions.find(
    (option) => option.id === formData.leaveTypeId
  );

  const selectedLeaveCode =
    selectedLeaveOption?.code?.toUpperCase() ||
    selectedType?.code?.toUpperCase() ||
    "";

  const isMaternityLeave = selectedLeaveCode === "ML";
  const isPaternityLeave = selectedLeaveCode === "PL";
  const isSpecialLeave = isMaternityLeave || isPaternityLeave;
  const isLOP = selectedLeaveCode === "LOP";

  // ML: 90 or 180 calendar days.
  // PL: 2, 7, 14, 21 or 28 calendar days.
  const getSpecialDurationOptions = () => {
    if (isMaternityLeave) {
      return [
        { label: "3 Months (90 Days)", value: "90" },
        { label: "6 Months (180 Days)", value: "180" },
      ];
    }

    if (isPaternityLeave) {
      return [
        { label: "2 Days", value: "2" },
        { label: "1 Week (7 Days)", value: "7" },
        { label: "2 Weeks (14 Days)", value: "14" },
        { label: "3 Weeks (21 Days)", value: "21" },
        { label: "4 Weeks (28 Days)", value: "28" },
      ];
    }

    return [];
  };

  const calculateEndDate = (startDate: string, duration: number) => {
    if (!startDate || duration <= 0) return startDate;

    const date = new Date(`${startDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) return startDate;

    date.setDate(date.getDate() + duration - 1);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Leave day calculation:
  // CL, SL, EL, ML, PL = calendar days.
  // LOP = weekdays only (Saturday and Sunday excluded).
  // Half-day = 0.5.
  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;

    if (formData.isHalfDay) return 0.5;

    const start = new Date(`${formData.startDate}T00:00:00`);
    const end = new Date(`${formData.endDate}T00:00:00`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return 0;
    }

    let totalDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const day = current.getDay();

      if (isLOP) {
        // LOP excludes Saturday and Sunday.
        if (day !== 0 && day !== 6) {
          totalDays++;
        }
      } else {
        // All other leave types include weekends.
        totalDays++;
      }

      current.setDate(current.getDate() + 1);
    }

    return totalDays;
  };


  const closeLeaveModal = () => {
    if (submitting) return;

    setIsModalOpen(false);
    setAlertMessage(null);
    setSupportingDocument(null);
  };

  const handleLeaveTypeChange = (leaveTypeId: string) => {
    setAlertMessage(null);
    setSupportingDocument(null);

    setFormData((previous) => {
      const selectedOption = leaveTypeOptions.find(
        (option) => option.id === leaveTypeId
      );

      const special = Boolean(selectedOption?.special);

      return {
        ...previous,
        leaveTypeId,
        endDate: special
          ? previous.startDate
          : previous.endDate < previous.startDate
            ? previous.startDate
            : previous.endDate,
        isHalfDay: special ? false : previous.isHalfDay,
        leaveDuration: special ? "" : previous.leaveDuration,
        specialLeaveDuration: "",
      };
    });
  };

  const handleStartDateChange = (startDate: string) => {
    setFormData((previous) => {
      const duration = Number(previous.specialLeaveDuration);

      return {
        ...previous,
        startDate,
        endDate:
          isSpecialLeave && duration > 0
            ? calculateEndDate(startDate, duration)
            : previous.endDate < startDate
              ? startDate
              : previous.endDate,
      };
    });
  };

  const handleSpecialDurationChange = (durationValue: string) => {
    setFormData((previous) => {
      const duration = Number(durationValue);

      return {
        ...previous,
        specialLeaveDuration: durationValue,
        endDate:
          duration > 0
            ? calculateEndDate(previous.startDate, duration)
            : previous.startDate,
      };
    });
  };

  // Supporting document upload for all leave types.
  const handleDocumentChange = (file: File | null) => {
    setAlertMessage(null);

    if (!file) {
      setSupportingDocument(null);
      return;
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      setAlertMessage(
        "Please upload a PDF, JPG, JPEG or PNG document."
      );

      setSupportingDocument(null);
      return;
    }

    if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
      setAlertMessage(
        "The supporting document must be smaller than 5 MB."
      );

      setSupportingDocument(null);
      return;
    }

    setSupportingDocument(file);
  };

  const handleApplySubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setSuccessMsg(null);
    setAlertMessage(null);

    if (genderLoading) {
      setAlertMessage("Please wait while employee details are loading.");
      return;
    }

    if (!formData.leaveTypeId) {
      setAlertMessage("Please select a leave type.");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setAlertMessage("Please select both From Date and To Date.");
      return;
    }

    if (formData.endDate < formData.startDate) {
      setAlertMessage("To Date cannot be before From Date.");
      return;
    }

    if (
      joiningDate &&
      (formData.startDate < joiningDate ||
        formData.endDate < joiningDate)
    ) {
      setAlertMessage(
        `You cannot apply for leave before your joining date (${joiningDate}). Please select dates on or after your joining date.`
      );

      return;
    }

    if (formData.isHalfDay) {
      if (!formData.leaveDuration) {
        setAlertMessage("Please select First Half or Second Half.");
        return;
      }

      if (formData.startDate !== formData.endDate) {
        setAlertMessage("Half-day leave must be for a single date.");
        return;
      }
    }

    if (!formData.reason.trim()) {
      setAlertMessage("Please enter a reason for leave.");
      return;
    }

    if (isMaternityLeave && !isFemale) {
      setAlertMessage(
        "Maternity Leave is available only for female employees."
      );
      return;
    }

    if (isPaternityLeave && !isMale) {
      setAlertMessage(
        "Paternity Leave is available only for male employees."
      );
      return;
    }

    // Validate ML and PL durations.
    if (isSpecialLeave) {
      if (!formData.specialLeaveDuration) {
        setAlertMessage(
          `Please select the duration for ${
            isMaternityLeave ? "Maternity Leave" : "Paternity Leave"
          }.`
        );
        return;
      }

      const selectedDuration = Number(
        formData.specialLeaveDuration
      );

      const allowedDurations = isMaternityLeave
        ? [90, 180]
        : [2, 7, 14, 21, 28];

      if (!allowedDurations.includes(selectedDuration)) {
        setAlertMessage(
          isMaternityLeave
            ? "Select maternity leave for 3 months (90 days) or 6 months (180 days)."
            : "Please select a valid paternity leave duration."
        );
        return;
      }

      const expectedEndDate = calculateEndDate(
        formData.startDate,
        selectedDuration
      );

      if (formData.endDate !== expectedEndDate) {
        setAlertMessage(
          "The leave end date does not match the selected duration. Please select the duration again."
        );
        return;
      }
    }

    if (isSpecialLeave && formData.isHalfDay) {
      setAlertMessage(
        "Maternity Leave and Paternity Leave cannot be applied as half-day leave."
      );
      return;
    }

    if (isSpecialLeave && !supportingDocument) {
      setAlertMessage(
        "Please upload a supporting document for maternity or paternity leave."
      );
      return;
    }

    const totalDays = calculateDays();

    if (totalDays <= 0) {
      setAlertMessage(
        isLOP
          ? "LOP cannot be applied for Saturday and Sunday only."
          : "Please select a valid leave duration."
      );
      return;
    }

    if (
      isSpecialLeave &&
      totalDays !== Number(formData.specialLeaveDuration)
    ) {
      setAlertMessage(
        "The total leave days do not match the selected leave duration."
      );
      return;
    }

    try {
      setSubmitting(true);

      const requestBody = new FormData();

      requestBody.append("employeeId", employee.id);
      requestBody.append("leaveTypeId", formData.leaveTypeId);
      requestBody.append("startDate", formData.startDate);
      requestBody.append("endDate", formData.endDate);
      requestBody.append("totalDays", String(totalDays));
      requestBody.append("isHalfDay", String(formData.isHalfDay));

      requestBody.append(
        "leaveDuration",
        formData.isHalfDay ? formData.leaveDuration : ""
      );

      requestBody.append("reason", formData.reason.trim());

      if (isMaternityLeave) {
        requestBody.append(
          "maternityDays",
          formData.specialLeaveDuration
        );
      }

      if (isPaternityLeave) {
        requestBody.append(
          "specialLeaveDuration",
          formData.specialLeaveDuration
        );
      }

      if (supportingDocument) {
        requestBody.append(
          "supportingDocument",
          supportingDocument
        );
      }

      const res = await fetch("/api/leaves", {
        method: "POST",
        body: requestBody,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            `Leave submission failed. Status: ${res.status}`
        );
      }

      const newRequest = data?.leaveRequest || data?.request;

      if (!newRequest) {
        throw new Error(
          "Leave was submitted, but the created request was not returned by the server."
        );
      }

      setRequests((previous) => [newRequest, ...previous]);

      setIsModalOpen(false);
      setCurrentPage(1);
      setSupportingDocument(null);

      setSuccessMsg(
        "Leave application successfully submitted to HR for approval."
      );

      setFormData({
        leaveTypeId: getDefaultLeaveTypeId(),
        startDate: defaultLeaveDate,
        endDate: defaultLeaveDate,
        isHalfDay: false,
        leaveDuration: "",
        reason: "",
        specialLeaveDuration: "",
      });
    } catch (error) {
      console.error("Leave submission API error:", error);

      setAlertMessage(
        error instanceof Error
          ? error.message
          : "Failed to submit leave application."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "apply") {
    return (
      <div className="mx-auto max-w-5xl space-y-5 pb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Apply Leave
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Submit a new leave request to your manager.
            </p>
          </div>

          <nav
            aria-label="Leave pages"
            className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1"
          >
            <Link
              href="/portal/leaves?view=apply"
              aria-current="page"
              className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Apply Leave
            </Link>

            <Link
              href="/portal/leaves"
              className="rounded-md px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              My Leaves
            </Link>
          </nav>
        </div>

        {alertMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

            <p className="flex-1">{alertMessage}</p>

            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              className="font-semibold text-amber-800 hover:text-amber-950"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid items-start gap-5">
          <section className="max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 pb-3 pt-4">
              <div>
                <h1 className="text-base font-bold text-slate-900">
                  Apply for Leave
                </h1>
                <p className="mt-1 text-[10px] text-slate-500">
                  Submit a new leave application.
                </p>
              </div>

              <Link
                href="/portal/leaves"
                aria-label="Close leave application"
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </Link>
            </div>

            <div className="px-5 py-4">
              <form
                onSubmit={handleApplySubmit}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="leave-type"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Leave Type
                  </label>

                  <select
                    id="leave-type"
                    value={formData.leaveTypeId}
                    onChange={(event) =>
                      handleLeaveTypeChange(event.target.value)
                    }
                    disabled={genderLoading}
                    required
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                  >
                    <option value="">
                      {genderLoading
                        ? "Loading leave types..."
                        : "Select leave type"}
                    </option>

                    {leaveTypeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {!genderLoading && !isFemale && !isMale && (
                    <p className="mt-1.5 text-[10px] text-amber-700">
                      Contact HR to update your profile if you need
                      maternity or paternity leave options.
                    </p>
                  )}
                </div>

                {isSpecialLeave && (
                  <div>
                    <label
                      htmlFor="special-leave-duration"
                      className="mb-1 block text-xs font-medium text-slate-700"
                    >
                      {isMaternityLeave
                        ? "Maternity Leave Duration"
                        : "Paternity Leave Duration"}
                    </label>

                    <select
                      id="special-leave-duration"
                      value={formData.specialLeaveDuration}
                      onChange={(event) =>
                        handleSpecialDurationChange(event.target.value)
                      }
                      required
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select duration</option>

                      {getSpecialDurationOptions().map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="leave-start-date"
                      className="mb-1 block text-xs font-medium text-slate-700"
                    >
                      From Date
                    </label>

                    <input
                      id="leave-start-date"
                      type="date"
                      required
                      min={joiningDate || undefined}
                      value={formData.startDate}
                      onChange={(event) =>
                        handleStartDateChange(event.target.value)
                      }
                      className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="leave-end-date"
                      className="mb-1 block text-xs font-medium text-slate-700"
                    >
                      To Date
                    </label>

                    <input
                      id="leave-end-date"
                      type="date"
                      required
                      min={formData.startDate || joiningDate || undefined}
                      value={formData.endDate}
                      readOnly={isSpecialLeave}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          endDate: event.target.value,
                        }))
                      }
                      className={`h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                        isSpecialLeave ? "bg-slate-100" : "bg-white"
                      }`}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.isHalfDay}
                    disabled={isSpecialLeave}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        isHalfDay: event.target.checked,
                        leaveDuration: event.target.checked
                          ? previous.leaveDuration
                          : "",
                      }))
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />

                  Applying for Half Day (0.5 day)
                </label>

                {formData.isHalfDay && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Select Half-Day Leave
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ["first_half", "First Half"],
                          ["second_half", "Second Half"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setFormData((previous) => ({
                              ...previous,
                              leaveDuration: value,
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                            formData.leaveDuration === value
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-300 text-slate-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="supporting-document"
                    className="mb-1 flex items-center gap-2 text-xs font-medium text-indigo-900"
                  >
                    <FileUp className="h-3.5 w-3.5 text-indigo-600" />

                    Supporting Document{" "}
                    {isSpecialLeave ? "(Required)" : "(Optional)"}
                  </label>

                  <input
                    id="supporting-document"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required={isSpecialLeave && !supportingDocument}
                    disabled={submitting}
                    onChange={(event) =>
                      handleDocumentChange(
                        event.target.files?.[0] || null
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs file:mr-2 file:border-0 file:bg-transparent file:p-0 file:text-xs"
                  />

                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Upload a PDF, JPG, JPEG or PNG. Maximum size: 5 MB.
                    {isSpecialLeave
                      ? " Required for maternity and paternity leave."
                      : " Optional."}
                  </p>

                  {supportingDocument && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <span className="truncate">
                        {supportingDocument.name}
                      </span>

                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setSupportingDocument(null)}
                        className="shrink-0 font-semibold text-rose-700 hover:text-rose-900"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="leave-reason"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Reason for Leave
                  </label>

                  <textarea
                    id="leave-reason"
                    required
                    rows={3}
                    maxLength={500}
                    value={formData.reason}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Explain the reason for leave"
                    className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3 text-xs">
                  <span className="font-semibold text-slate-700">
                    Total Duration:
                  </span>

                  <span className="font-bold text-indigo-700">
                    {calculateDays()}{" "}
                    {calculateDays() === 1 ? "day" : "days"}
                    {!formData.isHalfDay && (
                      <span className="ml-1 font-normal text-slate-500">
                        ({isLOP ? "Working Days" : "Calendar Days"})
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex justify-end border-t border-slate-900 pt-3">
                  <button
                    type="submit"
                    disabled={submitting || genderLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {submitting
                      ? "Submitting..."
                      : "Submit Application"}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className="hidden">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Leave Balance
              </h2>

              <div className="mt-3 divide-y divide-slate-100">
                {balances.length === 0 ? (
                  <p className="py-4 text-sm text-slate-500">
                    No leave balances are available.
                  </p>
                ) : (
                  balances.map((balance) => (
                    <div
                      key={balance.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-blue-600" />

                        <span className="truncate text-sm font-medium text-slate-700">
                          {balance.leave_type?.name || "Leave"}
                        </span>
                      </div>

                      <span className="whitespace-nowrap text-sm font-semibold text-slate-900">
                        {balance.balance_days} / {balance.allocated_days} days
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
              <h2 className="text-sm font-bold text-slate-900">
                Important Notes
              </h2>

              <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-5 text-slate-600">
                <li>
                  Your request will be sent to your manager for approval.
                </li>
                <li>
                  You will be notified when it is approved or rejected.
                </li>
                <li>
                  Please provide a valid reason for your leave.
                </li>
              </ul>

              <p className="mt-4 border-t border-blue-100 pt-3 text-xs text-slate-500">
                Project calendar: {project.name} ({project.client_country})
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  Recent Leave Requests
                </h2>

                <Link
                  href="/portal/leaves"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  View All
                </Link>
              </div>

              {requests.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No leave requests yet.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {requests.slice(0, 4).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {request.leave_type?.name || "Leave"}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {request.start_date} · {request.total_days} days
                        </p>
                      </div>

                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold capitalize text-amber-800">
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      {alertMessage && (
        <div className="fixed left-0 right-0 top-20 z-[9999] flex justify-center px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-alert-title"
            className="flex w-full max-w-lg items-start gap-3 rounded-xl border border-amber-300 bg-white p-4 shadow-2xl"
          >
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />

            <div className="flex-1">
              <h3
                id="leave-alert-title"
                className="font-semibold text-slate-900"
              >
                Leave Application
              </h3>

              <p className="mt-1 text-sm leading-5 text-slate-600">
                {alertMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              className="rounded-md px-3 py-1 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My Leaves
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            View and track all your leave requests.
          </p>
        </div>

        <nav aria-label="Breadcrumb">
          <Link
            href="/portal"
            className="text-xs text-slate-500 transition hover:text-blue-600"
          >
            Home
          </Link>
        </nav>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />

          <span>{successMsg}</span>

          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="ml-auto text-emerald-500 hover:text-emerald-700"
            aria-label="Close success message"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleBalances.map((balance) => {
          const code = String(
            balance.leave_type?.code ?? ""
          ).toUpperCase();

          const remainingDays = Number(balance.balance_days) || 0;
          const usedDays = Number(balance.used_days) || 0;
          const allocatedDays = Number(balance.allocated_days) || 0;

          const themes: Record<
            string,
            { card: string; icon: string; badge: string }
          > = {
            CL: {
              card: "border-emerald-100 bg-emerald-50/50",
              icon: "bg-emerald-100 text-emerald-600",
              badge: "text-emerald-700",
            },
            SL: {
              card: "border-violet-100 bg-violet-50/50",
              icon: "bg-violet-100 text-violet-600",
              badge: "text-violet-700",
            },
            EL: {
              card: "border-orange-100 bg-orange-50/50",
              icon: "bg-orange-100 text-orange-600",
              badge: "text-orange-700",
            },
            ML: {
              card: "border-sky-100 bg-sky-50/50",
              icon: "bg-sky-100 text-sky-600",
              badge: "text-sky-700",
            },
            PL: {
              card: "border-sky-100 bg-sky-50/50",
              icon: "bg-sky-100 text-sky-600",
              badge: "text-sky-700",
            },
          };

          const theme = themes[code] ?? themes.CL;

          const Icon =
            code === "SL"
              ? HeartPulse
              : code === "EL"
                ? BriefcaseBusiness
                : code === "PL"
                  ? Baby
                  : CalendarDays;

          return (
            <section
              key={balance.id}
              className={`rounded-xl border p-3 sm:p-4 ${theme.card}`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`rounded-lg p-2 ${theme.icon}`}>
                  {code === "ML" ? (
                    <Image
                      src="/maternity-leave-icon.png"
                      alt=""
                      width={24}
                      height={30}
                      className="h-6 w-6 object-contain"
                    />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>

                <div className="min-w-0">
                  <p
                    className={`truncate text-[10px] font-semibold ${theme.badge}`}
                  >
                    {balance.leave_type?.name}
                  </p>

                  <p className="mt-1 text-lg font-bold leading-5 text-slate-900">
                    {remainingDays}
                  </p>

                  <p className="mt-0.5 text-[9px] text-slate-500">
                    days remaining
                  </p>

                  <p className="mt-1 text-[9px] text-slate-500">
                    {usedDays} used of {allocatedDays} days
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3">
          <div className="flex flex-wrap gap-1">
            {[
              { key: "all", label: "All Requests" },
              { key: "pending", label: "Pending" },
              { key: "approved", label: "Approved" },
              { key: "rejected", label: "Rejected" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(key);
                  setCurrentPage(1);
                }}
                aria-pressed={statusFilter === key}
                className={`rounded-md px-3 py-2 text-[10px] font-semibold transition ${
                  statusFilter === key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />

            <input
              type="month"
              value={monthFilter}
              aria-label="Filter leave requests by month applied"
              onChange={(event) => {
                setMonthFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700 outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[10px] text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Leave Type</th>
                <th className="px-3 py-2.5">From Date</th>
                <th className="px-3 py-2.5">To Date</th>
                <th className="px-3 py-2.5">Days</th>
                <th className="px-3 py-2.5">Reason</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Applied On</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <Calendar className="mx-auto h-8 w-8 text-slate-300" />

                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      No leave requests found
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      Adjust the filters or apply for leave to see requests here.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((request, index) => {
                  const status = String(request.status).toLowerCase();

                  const leaveCode = String(
                    request.leave_type?.code ?? ""
                  ).toUpperCase();

                  const leaveIcon =
                    leaveCode === "SL"
                      ? HeartPulse
                      : leaveCode === "EL"
                        ? BriefcaseBusiness
                        : leaveCode === "PL"
                          ? Baby
                          : CalendarDays;

                  const LeaveIcon = leaveIcon;

                  return (
                    <tr
                      key={request.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-3 py-2.5 text-slate-400">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>

                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="rounded-md bg-blue-50 p-1 text-blue-700">
                            {leaveCode === "ML" ? (
                              <Image
                                src="/maternity-leave-icon.png"
                                alt=""
                                width={20}
                                height={25}
                                className="h-5 w-5 object-contain"
                              />
                            ) : (
                              <LeaveIcon className="h-3 w-3" />
                            )}
                          </span>

                          {request.leave_type?.name || "Leave"}

                          {request.is_half_day && (
                            <span className="text-[10px] font-medium text-slate-400">
                              {request.leave_duration === "first_half"
                                ? "First Half"
                                : request.leave_duration === "second_half"
                                  ? "Second Half"
                                  : "Half Day"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        {formatLeaveDate(request.start_date)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        {formatLeaveDate(request.end_date)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">
                        {request.total_days}
                        {request.is_half_day ? " (½)" : ""}
                      </td>

                      <td
                        className="max-w-36 truncate px-3 py-2.5"
                        title={request.reason || ""}
                      >
                        {request.reason || "--"}
                      </td>

                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded-md px-2 py-1 text-[9px] font-semibold capitalize ${
                            status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : status === "cancelled"
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        {formatLeaveDate(request.created_at)}
                      </td>

                      <td className="px-3 py-2.5">
                        <details className="relative">
                          <summary
                            aria-label={`View details for ${
                              request.leave_type?.name || "leave"
                            } request`}
                            className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </summary>

                          <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-3 text-[10px] font-normal text-slate-600 shadow-lg">
                            <p className="font-semibold text-slate-800">
                              {request.reason || "No reason provided"}
                            </p>

                            {request.rejection_reason && (
                              <p className="mt-2 border-t border-slate-100 pt-2">
                                HR note: {request.rejection_reason}
                              </p>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[9px] text-slate-500">
            Showing{" "}
            {filteredRequests.length === 0
              ? 0
              : (currentPage - 1) * pageSize + 1}{" "}
            to{" "}
            {Math.min(
              currentPage * pageSize,
              filteredRequests.length
            )}{" "}
            of {filteredRequests.length} entries
          </p>

          <nav
            aria-label="Leave request pages"
            className="flex items-center gap-1"
          >
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {Array.from(
              { length: pageCount },
              (_, index) => index + 1
            ).map((page) => (
              <button
                key={page}
                type="button"
                aria-current={
                  currentPage === page ? "page" : undefined
                }
                onClick={() => setCurrentPage(page)}
                className={`min-w-7 rounded-md px-2 py-1.5 text-[10px] font-semibold ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage === pageCount}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(pageCount, page + 1)
                )
              }
              className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </nav>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5 text-[10px] text-slate-600">
          <span className="mt-0.5 rounded-full bg-blue-100 p-1 text-blue-600">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>

          <p>
            You can apply for leave from the{" "}
            <Link
              href="/portal/leaves?view=apply"
              className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
            >
              Apply Leave
            </Link>{" "}
            page. All leave requests are subject to manager approval.
          </p>
        </div>

        <Link
          href="/portal/leaves?view=apply"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Apply Leave
        </Link>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
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
                aria-label="Close leave application"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleApplySubmit}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label
                  htmlFor="leave-type"
                  className="mb-1 block font-semibold text-slate-700"
                >
                  Leave Type
                </label>

                <select
                  id="leave-type"
                  value={formData.leaveTypeId}
                  onChange={(e) =>
                    handleLeaveTypeChange(e.target.value)
                  }
                  disabled={genderLoading}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                  required
                >
                  <option value="">
                    {genderLoading
                      ? "Loading leave types..."
                      : "Select Leave Type"}
                  </option>

                  {leaveTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {!genderLoading && !isFemale && !isMale && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    Your gender could not be identified. Please contact
                    HR to update your employee profile if you need ML or
                    PL options.
                  </p>
                )}
              </div>

              {isSpecialLeave && (
                <div>
                  <label
                    htmlFor="special-leave-duration"
                    className="mb-1 block font-semibold text-slate-700"
                  >
                    {isMaternityLeave
                      ? "Maternity Leave Duration"
                      : "Paternity Leave Duration"}
                  </label>

                  <select
                    id="special-leave-duration"
                    value={formData.specialLeaveDuration}
                    onChange={(e) =>
                      handleSpecialDurationChange(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select Duration</option>

                    {getSpecialDurationOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-[11px] text-slate-500">
                    The To Date will be calculated automatically based
                    on the selected duration.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="leave-start-date"
                    className="mb-1 block font-semibold text-slate-700"
                  >
                    From Date
                  </label>

                  <input
                    id="leave-start-date"
                    type="date"
                    required
                    min={joiningDate || undefined}
                    value={formData.startDate}
                    onChange={(e) =>
                      handleStartDateChange(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="leave-end-date"
                    className="mb-1 block font-semibold text-slate-700"
                  >
                    To Date
                  </label>

                  <input
                    id="leave-end-date"
                    type="date"
                    required
                    min={formData.startDate || joiningDate || undefined}
                    value={formData.endDate}
                    readOnly={isSpecialLeave}
                    onChange={(e) =>
                      setFormData((previous) => ({
                        ...previous,
                        endDate: e.target.value,
                      }))
                    }
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isSpecialLeave ? "bg-slate-100" : "bg-white"
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={formData.isHalfDay}
                  disabled={isSpecialLeave}
                  onChange={(e) =>
                    setFormData((previous) => ({
                      ...previous,
                      isHalfDay: e.target.checked,
                      leaveDuration: e.target.checked
                        ? previous.leaveDuration
                        : "",
                    }))
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />

                <label
                  htmlFor="halfDay"
                  className={`font-medium text-slate-700 ${
                    isSpecialLeave ? "opacity-50" : ""
                  }`}
                >
                  Applying for Half Day (0.5 day)
                </label>
              </div>

              {formData.isHalfDay && (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700">
                    Select Half-Day Leave
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["first_half", "First Half"],
                        ["second_half", "Second Half"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setFormData((previous) => ({
                            ...previous,
                            leaveDuration: value,
                          }))
                        }
                        className={`rounded-lg border px-3 py-2 font-semibold ${
                          formData.leaveDuration === value
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-slate-300 text-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-500">
                    First Half Leave: You work the second half of your shift.
                    Second Half Leave: You work the first half of your shift.
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="supporting-document"
                  className="mb-1 flex items-center gap-2 font-semibold text-slate-700"
                >
                  <FileUp className="h-4 w-4 text-indigo-600" />

                  Supporting Document{" "}
                  {isSpecialLeave ? "(Required)" : "(Optional)"}
                </label>

                <input
                  id="supporting-document"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  required={isSpecialLeave && !supportingDocument}
                  disabled={submitting}
                  onChange={(e) =>
                    handleDocumentChange(e.target.files?.[0] || null)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />

                <p className="mt-1 text-[11px] text-slate-500">
                  Upload a PDF, JPG, JPEG or PNG. Maximum size: 5 MB.
                  {isSpecialLeave
                    ? " Required for maternity and paternity leave."
                    : " Optional."}
                </p>

                {supportingDocument && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                    <span className="break-all text-xs font-medium text-emerald-700">
                      Selected: {supportingDocument.name}
                    </span>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setSupportingDocument(null)}
                      className="shrink-0 font-semibold text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="leave-reason"
                  className="mb-1 block font-semibold text-slate-700"
                >
                  Reason for Leave
                </label>

                <textarea
                  id="leave-reason"
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData((previous) => ({
                      ...previous,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Explain the reason for leave"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-slate-700">
                <span className="font-medium">Total Duration:</span>

                <span className="text-sm font-bold text-indigo-700">
                  {calculateDays()}{" "}
                  {calculateDays() === 1 ? "day" : "days"}
                  {!formData.isHalfDay && (
                    <span className="ml-1 text-[10px] font-normal text-slate-500">
                      ({isLOP ? "Working Days" : "Calendar Days"})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={closeLeaveModal}
                  disabled={submitting}
                  className="rounded px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || genderLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
