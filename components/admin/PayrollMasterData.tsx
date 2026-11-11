"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { exportToExcel } from "@/lib/excel/exportToExcel";
import { createPortal } from "react-dom";
import {
  Play,
  Download,
  RefreshCw,
  Search,
  FileSpreadsheet,
  CalendarDays,
  Pencil,
  Eye,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import StandardPayslip from "@/components/payroll/StandardPayslip";
import { numberToWordsIndian } from "@/lib/calculations";
import {MasterPayrollRow,MasterRegisterTotals} from "@/lib/payroll/master-payroll-engine";

interface Props {
  role: "ceo" | "hr" | "admin";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface ColumnDef {
  key: string;
  label: string;
  currency?: boolean;
  sticky?: boolean;
}

export const REGISTER_COLUMNS: ColumnDef[] = [
  { key: "employee_code", label: "Emp. Code", sticky: true },
  { key: "employee_name", label: "Name", sticky: true },
  { key: "joining_date", label: "DOJ" },
  { key: "ctc", label: "CTC", currency: true },
  { key: "designation", label: "Designation" },
  { key: "bank_account_number", label: "Bank Account No" },
  { key: "bank_name", label: "Bank Name" },
  { key: "pf_account_number", label: "PF A/c No." },
  { key: "uan_number", label: "PF UAN" },
  { key: "pan_number", label: "PAN" },
  { key: "basic", label: "Basic", currency: true },
  { key: "hra", label: "HRA", currency: true },
  { key: "conveyance", label: "Conveyance", currency: true },
  { key: "medical_allowance", label: "Medical Allowance", currency: true },
  { key: "leave_travel_allowance", label: "Leave Travel All", currency: true },
  { key: "employer_pf", label: "Employer PF", currency: true },
  { key: "special_allowance", label: "Special Allowance", currency: true },
  { key: "arrears", label: "Arrears", currency: true },
  { key: "working_days", label: "No. Of Days" },
  { key: "pay_days", label: "Pay Days" },
  { key: "gross_salary", label: "Gross Salary", currency: true },
  { key: "incentive", label: "Incentive", currency: true },
  { key: "loss_of_pay", label: "Loss of pay", currency: true },
  { key: "advance", label: "Advance", currency: true },
  { key: "tds", label: "TDS", currency: true },
  { key: "pt", label: "PT", currency: true },
  { key: "epf", label: "EPF", currency: true },
  { key: "esic_emp", label: "ESIC-Emp", currency: true },
  { key: "other_deduction", label: "Other Deduction", currency: true },
  { key: "esic_empr", label: "ESIC-Empr", currency: true },
  { key: "pf_admin", label: "PF Admin", currency: true },
  { key: "total_deductions", label: "Total Deduction", currency: true },
  { key: "net_payout", label: "Net Payout", currency: true },
  { key: "remarks", label: "Remarks" },
];

function formatRupee(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PayrollMasterData({ role }: Props) {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const currentPeriod = currentYear * 12 + currentMonth;

  // Default to the last completed month
  const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const defaultYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const [activeTab, setActiveTab] = useState<"register" | "components">("register");

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  const selectedPeriod = selectedYear * 12 + selectedMonth;
  const isCurrentOrFuture = selectedPeriod >= currentPeriod;

  const [rows, setRows] = useState<MasterPayrollRow[]>([]);
  const [totals, setTotals] = useState<MasterRegisterTotals | null>(null);
  const [hasSavedRun, setHasSavedRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  // Calendar overview widget state
  const [showCalendarWidget, setShowCalendarWidget] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarWorkingDays, setCalendarWorkingDays] = useState<number | null>(null);
  const [calendarName, setCalendarName] = useState<string>("Company Calendar");
  const [workingSaturdays, setWorkingSaturdays] = useState<number[]>([]);
  const [savingSaturday, setSavingSaturday] = useState<string | null>(null);

  // Salary Components state
  const [salaryComponents, setSalaryComponents] = useState<any[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [editingComponent, setEditingComponent] = useState<any | null>(null);
  const [savingComponent, setSavingComponent] = useState(false);

  // Edit adjustments modal state
  const [editingRow, setEditingRow] = useState<MasterPayrollRow | null>(null);
  const [editIncentive, setEditIncentive] = useState("0");
  const [editBonus, setEditBonus] = useState("0");
  const [editArrears, setEditArrears] = useState("0");
  const [editAdvance, setEditAdvance] = useState("0");
  const [editTds, setEditTds] = useState("0");
  const [editLopDays, setEditLopDays] = useState("0");
  const [editRemarks, setEditRemarks] = useState("");
  const [editRecoverPending, setEditRecoverPending] = useState(false);
  const [savingAdjustments, setSavingAdjustments] = useState(false);

  // Payslip preview modal state
  const [payslipModalRow, setPayslipModalRow] = useState<MasterPayrollRow | null>(null);

  // Load master register data
  const loadRegister = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/payroll/master-register?month=${selectedMonth}&year=${selectedYear}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load master register.");
      }

      setRows(data.rows || []);
      setTotals(data.totals || null);
      setHasSavedRun(Boolean(data.hasSavedRun));
    } catch (err: any) {
      console.error("Master register load error:", err);
      setError(err?.message || "Failed to load payroll master data.");
      setRows([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Load salary components
  const loadSalaryComponents = useCallback(async () => {
    setLoadingComponents(true);
    try {
      const res = await fetch("/api/payroll/components", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSalaryComponents(data);
      }
    } catch (err) {
      console.error("Failed to load components:", err);
    } finally {
      setLoadingComponents(false);
    }
  }, []);

  // Load calendar schedule
  const loadCalendarSchedule = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch(
        `/api/payroll/calendar?month=${selectedMonth}&year=${selectedYear}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setCalendarWorkingDays(data.workingDays ?? data.daysInMonth ?? null);
        setCalendarName(data.calendarName || "Company Calendar");
        setWorkingSaturdays(Array.isArray(data.workingSaturdays) ? data.workingSaturdays : []);
      }
    } catch (err) {
      console.error("Failed to load calendar schedule:", err);
    } finally {
      setCalendarLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Handle Saturday toggle
  const handleToggleWorkingSaturday = async (date: string, enabled: boolean) => {
    try {
      setSavingSaturday(date);
      const res = await fetch("/api/payroll/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, enabled }),
      });
      if (res.ok) {
        await loadCalendarSchedule();
        await loadRegister();
      }
    } catch (err) {
      console.error("Toggle Saturday error:", err);
    } finally {
      setSavingSaturday(null);
    }
  };

  useEffect(() => {
    if (activeTab === "register") {
      void loadRegister();
    } else if (activeTab === "components") {
      void loadSalaryComponents();
    }
  }, [activeTab, loadRegister, loadSalaryComponents]);

  useEffect(() => {
    if (showCalendarWidget) {
      void loadCalendarSchedule();
    }
  }, [showCalendarWidget, loadCalendarSchedule]);

  // Compute unique departments for dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.department) {
        set.add(r.department);
      }
    }
    return Array.from(set).sort();
  }, [rows]);

  // Filter rows by search and department
  const filteredRows = useMemo(() => {
    let result = rows;

    if (selectedDepartment !== "all") {
      result = result.filter((r) => r.department === selectedDepartment);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.employee_name.toLowerCase().includes(term) ||
          r.employee_code.toLowerCase().includes(term) ||
          r.designation.toLowerCase().includes(term) ||
          r.pan_number.toLowerCase().includes(term) ||
          r.bank_account_number.toLowerCase().includes(term)
      );
    }

    return result;
  }, [rows, search, selectedDepartment]);

  // Run all payroll in 1-click
  const handleRunAllPayroll = async () => {
    if (isCurrentOrFuture) {
      setError("Payroll can only be run for completed past months.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to run payroll for all ${rows.length} active employee(s) for ${MONTHS[selectedMonth - 1]} ${selectedYear}?\n\nThis will calculate exact earnings, LOP deductions, statutory EPF/ESI contributions, and deliver individual payslips to each employee's self-service portal.`
    );
    if (!confirmed) return;

    setRunningAll(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/payroll/run-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to run all payroll.");
      }

      setSuccessMessage(
        `Successfully generated and delivered payslips for ${data.count} employee(s) for ${MONTHS[selectedMonth - 1]} ${selectedYear}.`
      );

      if (data.rows) {
        setRows(data.rows);
      }
      if (data.totals) {
        setTotals(data.totals);
      }
      setHasSavedRun(true);
    } catch (err: any) {
      console.error("Run all payroll error:", err);
      setError(err?.message || "Failed to run payroll for all employees.");
    } finally {
      setRunningAll(false);
    }
  };

  // Export to Excel (CSV) matching exact format
  const handleExportCsv = async () => {
    if (!rows.length) return;

    try {
      const columns = REGISTER_COLUMNS.map((column) => ({
        header: column.label,
        key: column.key,
        width: column.key === "employee_name" ? 24 : 18,
        ...(column.currency ? { numFmt: '"₹"#,##0.00' } : {}),
      }));

      await exportToExcel({
        fileName: `Payroll_Master_Register_${MONTHS[selectedMonth - 1]}_${selectedYear}.xlsx`,
        sheetName: "Payroll Register",
        title: "TEENS SOFTWARE SOLUTIONS LLP",
        subtitle: `Payroll Master Register - ${MONTHS[selectedMonth - 1]} ${selectedYear} | Hyderabad | info@teenss.com | www.teenss.com`,
        columns,
        rows: rows.map((row) => ({ ...row })),
      });
    } catch (error) {
      console.error("Failed to export payroll Excel:", error);
    }
  };

  // Open adjustment modal
  const openEditAdjustments = (row: MasterPayrollRow) => {
    setEditingRow(row);
    setEditIncentive(String(row.incentive || 0));
    setEditBonus("0");
    setEditArrears(String(row.arrears || 0));
    setEditAdvance(String(row.advance || 0));
    setEditTds(String(row.tds || 0));
    setEditLopDays(String(row.lop_days || 0));
    setEditRemarks(row.remarks || "");
    setEditRecoverPending(
      Boolean(row.recovered_statutory && row.recovered_statutory > 0) ||
        Boolean(row.has_pending_statutory)
    );
  };

  // Save adjustments
  const handleSaveAdjustments = async () => {
    if (!editingRow) return;

    setSavingAdjustments(true);
    try {
      const totalIncentive = (Number(editIncentive) || 0) + (Number(editBonus) || 0);

      const response = await fetch("/api/payroll/master-register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: editingRow.employee_id,
          month: selectedMonth,
          year: selectedYear,
          incentive: totalIncentive,
          arrears: Number(editArrears) || 0,
          advance: Number(editAdvance) || 0,
          tds: Number(editTds) || 0,
          lopDays: Number(editLopDays) || 0,
          remarks: editRemarks,
          recoverPendingStatutory: editRecoverPending,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save adjustments.");
      }

      setRows((prev) =>
        prev.map((r) => (r.employee_id === editingRow.employee_id ? data.row : r))
      );
      if (data.totals) {
        setTotals(data.totals);
      }

      setEditingRow(null);
      setSuccessMessage(`Adjustments saved for ${editingRow.employee_name}.`);
    } catch (err: any) {
      console.error("Save adjustments error:", err);
      setError(err?.message || "Failed to update employee adjustments.");
    } finally {
      setSavingAdjustments(false);
    }
  };

  // Save component changes
  const handleSaveComponent = async () => {
    if (!editingComponent) return;
    setSavingComponent(true);
    try {
      const res = await fetch("/api/payroll/components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingComponent.id,
          name: editingComponent.name,
          value: Number(editingComponent.value),
          calculation_type: editingComponent.calculation_type,
          affects_lop: editingComponent.affects_lop,
          is_active: editingComponent.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update component.");

      setEditingComponent(null);
      await loadSalaryComponents();
      await loadRegister();
      setSuccessMessage("Salary component updated successfully.");
    } catch (err: any) {
      setError(err?.message || "Failed to update salary component.");
    } finally {
      setSavingComponent(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Title */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Payroll Master Register & Control Center
            </h1>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
              Unified
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Official company salary register matching your 34-column payroll format with live LOP attendance tracking and 1-click batch execution.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                activeTab === "register"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Master Register
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("components")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                activeTab === "components"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              Salary Components
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================
          TAB 1: PAYROLL MASTER REGISTER
      ==================================================== */}
      {activeTab === "register" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {/* Month Picker */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-9 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600"
              >
                {MONTHS.map((m, idx) => {
                  const monthNum = idx + 1;
                  const itemPeriod = selectedYear * 12 + monthNum;
                  const isBlocked = itemPeriod >= currentPeriod;

                  return (
                    <option key={m} value={monthNum} disabled={isBlocked}>
                      {m}
                      {itemPeriod === currentPeriod
                        ? " (Current / Incomplete)"
                        : itemPeriod > currentPeriod
                        ? " (Upcoming)"
                        : ""}
                    </option>
                  );
                })}
              </select>

              {/* Year Picker */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-9 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {/* Department Filter */}
              <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="h-8 border-none bg-transparent text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Departments ({rows.length})</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code, name, designation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-48 rounded border border-slate-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-indigo-600 sm:w-60"
                />
              </div>

              {/* Calendar overview toggle */}
              <button
                type="button"
                onClick={() => setShowCalendarWidget((prev) => !prev)}
                className={`inline-flex h-9 items-center gap-1.5 rounded border px-2.5 text-xs font-semibold transition ${
                  showCalendarWidget
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                title="View Calendar & Saturday Working Schedule"
              >
                <CalendarDays className="h-3.5 w-3.5 text-indigo-600" />
                <span>Calendar & Schedule</span>
                {showCalendarWidget ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunAllPayroll}
                disabled={runningAll || loading || isCurrentOrFuture}
                title={
                  isCurrentOrFuture
                    ? "Payroll can only be generated after the payroll month is completed."
                    : "Run payroll for all active employees"
                }
                className="inline-flex items-center gap-2 rounded bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running All Payroll...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    Run All Payroll
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={loading || rows.length === 0}
                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                Export to Excel 
              </button>

              <button
                type="button"
                onClick={() => void loadRegister()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Collapsible Calendar & Saturday Schedule Widget */}
          {showCalendarWidget && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 transition-all">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      {calendarName} · {MONTHS[selectedMonth - 1]} {selectedYear}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Toggle working Saturdays to adjust schedule. Master Register uses standard 30/31 days for monthly CTC.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="rounded bg-white px-3 py-1 font-semibold text-slate-700 shadow-xs border border-slate-200">
                    Month Days: {new Date(selectedYear, selectedMonth, 0).getDate()}
                  </span>
                  <span className="rounded bg-white px-3 py-1 font-semibold text-indigo-800 shadow-xs border border-indigo-200">
                    Working Days: {calendarLoading ? "..." : calendarWorkingDays ?? "—"}
                  </span>
                </div>
              </div>

              {/* Saturday Toggles */}
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Saturday Working Schedule
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {Array.from(
                    { length: new Date(selectedYear, selectedMonth, 0).getDate() },
                    (_, i) => i + 1
                  )
                    .filter((d) => new Date(selectedYear, selectedMonth - 1, d).getDay() === 6)
                    .map((day) => {
                      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const isWorking = workingSaturdays.includes(day);

                      return (
                        <label
                          key={day}
                          className={`flex items-center justify-between rounded border p-2 text-xs cursor-pointer transition ${
                            isWorking
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div>
                            <span className="font-bold">Sat, {day} {MONTHS[selectedMonth - 1].slice(0, 3)}</span>
                            <span className="block text-[10px] text-slate-500">
                              {isWorking ? "Working Day" : "Off / Holiday"}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isWorking}
                            disabled={calendarLoading || savingSaturday === dateStr}
                            onChange={(e) => handleToggleWorkingSaturday(dateStr, e.target.checked)}
                            className="h-4 w-4 rounded text-indigo-600"
                          />
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Status alerts */}
          {error && (
            <div className="flex items-start gap-2 border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-800 shadow-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2 border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 shadow-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="font-semibold">{successMessage}</p>
            </div>
          )}

          {/* Run Status Banner */}
          <div
            className={`flex flex-col items-start justify-between gap-3 border p-3 text-xs sm:flex-row sm:items-center ${
              hasSavedRun
                ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
                : "border-amber-200 bg-amber-50/60 text-amber-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {hasSavedRun ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-700" />
              )}
              <span>
                {hasSavedRun
                  ? `Saved Payroll Records Loaded for ${MONTHS[selectedMonth - 1]} ${selectedYear}.`
                  : `Live Preview for ${MONTHS[selectedMonth - 1]} ${selectedYear} (Not yet finalized). Click "Run All Payroll" to finalize and save.`}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono font-bold">
              <span>{filteredRows.length} Employee(s) Filtered</span>
            </div>
          </div>

          {/* Summary KPI Cards */}
          {totals && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="border border-slate-300 bg-white p-3 shadow-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Active Staff
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {rows.length}
                </p>
              </div>

              <div className="border border-slate-300 bg-white p-3 shadow-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Monthly CTC
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  ₹{formatRupee(totals.ctc)}
                </p>
              </div>

              <div className="border border-slate-300 bg-white p-3 shadow-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Gross Salary
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-indigo-700">
                  ₹{formatRupee(totals.gross_salary)}
                </p>
              </div>

              <div className="border border-slate-300 bg-white p-3 shadow-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Loss of Pay (LOP)
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-rose-700">
                  ₹{formatRupee(totals.loss_of_pay)}
                </p>
              </div>

              <div className="border border-slate-300 bg-white p-3 shadow-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Deductions
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-rose-600">
                  ₹{formatRupee(totals.total_deductions)}
                </p>
              </div>

              <div className="border border-slate-300 bg-white p-3 shadow-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Net Payout
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
                  ₹{formatRupee(totals.net_payout)}
                </p>
              </div>
            </div>
          )}

          {/* Master Register 34-Column Spreadsheet Table */}
          <div className="rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[650px] relative">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-30 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-800 shadow-sm border-b border-slate-300">
                  <tr>
                    <th className="sticky left-0 z-40 border-r border-slate-300 bg-slate-100 px-2 py-3 text-center">
                      #
                    </th>
                    {REGISTER_COLUMNS.map((col, idx) => (
                      <th
                        key={col.key}
                        className={`whitespace-nowrap border-r border-slate-300 px-3 py-3 ${
                          col.currency || col.key === "pay_days" || col.key === "working_days"
                            ? "text-right"
                            : ""
                        } ${
                          col.sticky
                            ? idx === 0
                              ? "sticky left-12 z-40 bg-slate-100"
                              : "sticky left-32 z-40 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                            : ""
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="sticky right-0 z-40 border-l border-slate-300 bg-slate-100 px-3 py-3 text-center shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={REGISTER_COLUMNS.length + 2} className="py-12 text-center text-slate-500">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
                        <p className="mt-2 font-medium">Loading payroll register...</p>
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={REGISTER_COLUMNS.length + 2} className="py-12 text-center text-slate-500">
                        No employees found matching the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, rowIdx) => (
                      <tr
                        key={row.employee_id}
                        className="hover:bg-indigo-50/40 transition-colors odd:bg-white even:bg-slate-50/50"
                      >
                        <td className="sticky left-0 z-20 border-r border-slate-200 bg-inherit px-2 py-2.5 text-center font-mono text-[11px] text-slate-400">
                          {rowIdx + 1}
                        </td>

                        {REGISTER_COLUMNS.map((col, colIdx) => {
                          const rawVal = (row as any)[col.key];
                          const isCurrency = col.currency;
                          let cellContent = rawVal ?? "—";

                          if (col.key === "employee_name") {
                            cellContent = (
                              <div>
                                <span className="font-semibold text-slate-900">{row.employee_name}</span>
                                {row.department && (
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {row.department}
                                  </span>
                                )}
                              </div>
                            );
                          } else if (col.key === "pay_days") {
                            cellContent = (
                              <div className="font-mono">
                                <span className="font-bold text-slate-900">{row.pay_days}</span>
                                {row.lop_days > 0 && (
                                  <span className="ml-1 text-[10px] text-rose-600 font-normal">
                                    (-{row.lop_days} LOP)
                                  </span>
                                )}
                              </div>
                            );
                          } else if (col.key === "loss_of_pay") {
                            cellContent =
                              row.loss_of_pay > 0 ? (
                                <span className="font-semibold text-rose-700 font-mono">
                                  ₹{formatRupee(row.loss_of_pay)}
                                </span>
                              ) : (
                                "0.00"
                              );
                          } else if (isCurrency) {
                            cellContent = formatRupee(rawVal);
                          }

                          return (
                            <td
                              key={col.key}
                              className={`whitespace-nowrap border-r border-slate-200 px-3 py-2.5 ${
                                isCurrency || col.key === "pay_days" || col.key === "working_days"
                                  ? "text-right font-mono"
                                  : ""
                              } ${
                                col.sticky
                                  ? colIdx === 0
                                    ? "sticky left-12 z-20 bg-white font-mono font-semibold text-slate-900"
                                    : "sticky left-32 z-20 bg-white font-semibold text-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                  : ""
                              }`}
                            >
                              {cellContent}
                            </td>
                          );
                        })}

                        {/* Row Actions */}
                        <td className="sticky right-0 z-20 border-l border-slate-200 bg-white px-2 py-2 text-center shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditAdjustments(row)}
                              title="Adjust Incentive / Bonus / Arrears / LOP / Remarks"
                              className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setPayslipModalRow(row)}
                              title="View & Print Official Payslip"
                              className="rounded border border-indigo-200 bg-indigo-50 p-1 text-indigo-700 hover:bg-indigo-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* TOTAL SUMMARY ROW */}
                {totals && filteredRows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-30 bg-slate-200 border-t-2 border-slate-400 font-bold text-slate-950">
                    <tr>
                      <td className="sticky left-0 z-40 border-r border-slate-300 bg-slate-200 px-2 py-3 text-center">
                        —
                      </td>
                      <td className="sticky left-12 z-40 border-r border-slate-300 bg-slate-200 px-3 py-3 text-center uppercase tracking-wider text-indigo-950">
                        TOTAL
                      </td>
                      <td className="sticky left-32 z-40 border-r border-slate-300 bg-slate-200 px-3 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {filteredRows.length} Staff
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-center">—</td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono text-indigo-950">
                        {formatRupee(totals.ctc)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-center">—</td>
                      <td className="border-r border-slate-300 px-3 py-3 text-center">—</td>
                      <td className="border-r border-slate-300 px-3 py-3 text-center">—</td>
                      <td className="border-r border-slate-300 px-3 py-3 text-center">—</td>
                      <td className="border-r border-slate-300 px-3 py-3 text-center">—</td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.basic)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.hra)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.conveyance)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.medical_allowance)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.leave_travel_allowance)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.employer_pf)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.special_allowance)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.arrears)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {totals.working_days}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {totals.pay_days}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono text-indigo-950">
                        {formatRupee(totals.gross_salary)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.incentive)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono text-rose-700">
                        {formatRupee(totals.loss_of_pay)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.advance)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.tds)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.pt)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.epf)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.esic_emp)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.other_deduction)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.esic_empr)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono">
                        {formatRupee(totals.pf_admin)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono text-rose-950">
                        {formatRupee(totals.total_deductions)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-right font-mono text-emerald-950">
                        {formatRupee(totals.net_payout)}
                      </td>
                      <td className="border-r border-slate-300 px-3 py-3 text-center">—</td>
                      <td className="sticky right-0 z-40 border-l border-slate-300 bg-slate-200 px-3 py-3 text-center">
                        —
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 2: SALARY COMPONENTS (Core /api/payroll/components)
      ==================================================== */}
      {activeTab === "components" && (
        <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Master Salary Components Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Configure salary heads, percentage values, and LOP calculation toggles using standard payroll routes.
              </p>
            </div>

            <button
              type="button"
              onClick={loadSalaryComponents}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingComponents ? "animate-spin" : ""}`} />
              Refresh Components
            </button>
          </div>

          {loadingComponents ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-indigo-600 mb-2" />
              Loading salary components...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    <th className="px-3 py-2.5">Salary Head</th>
                    <th className="px-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Calculation</th>
                    <th className="px-3 py-2.5 text-center">Value / %</th>
                    <th className="px-3 py-2.5 text-center">LOP Impact</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {salaryComponents.map((comp) => (
                    <tr key={comp.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        {comp.name}
                        {comp.description && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {comp.description}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-700">
                        {comp.code}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            comp.type === "earning"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {comp.type === "earning" ? "Earning" : "Deduction"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 capitalize">
                        {String(comp.calculation_type || "fixed").replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900">
                        {comp.calculation_type === "percentage_of_basic" ||
                        comp.calculation_type === "percentage_of_gross" ||
                        comp.calculation_type === "percentage_of_ctc"
                          ? `${comp.value}%`
                          : `₹${Number(comp.value || 0).toLocaleString("en-IN")}`}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                            comp.affects_lop
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {comp.affects_lop ? "Deducts LOP" : "No LOP"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            comp.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {comp.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingComponent(comp)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          EDIT COMPONENT MODAL
      ==================================================== */}
      {editingComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit Component: {editingComponent.name} ({editingComponent.code})
              </h3>
              <button
                type="button"
                onClick={() => setEditingComponent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">Value / Percentage</span>
                <input
                  type="number"
                  step="0.01"
                  value={editingComponent.value}
                  onChange={(e) =>
                    setEditingComponent({ ...editingComponent, value: e.target.value })
                  }
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">Calculation Type</span>
                <select
                  value={editingComponent.calculation_type}
                  onChange={(e) =>
                    setEditingComponent({
                      ...editingComponent,
                      calculation_type: e.target.value,
                    })
                  }
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                >
                  <option value="fixed">Fixed Amount (₹)</option>
                  <option value="percentage_of_basic">% of Basic</option>
                  <option value="percentage_of_gross">% of Gross</option>
                  <option value="percentage_of_ctc">% of CTC</option>
                </select>
              </label>

              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingComponent.affects_lop}
                    onChange={(e) =>
                      setEditingComponent({
                        ...editingComponent,
                        affects_lop: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-600"
                  />
                  <span>Affects Loss of Pay (LOP)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingComponent.is_active}
                    onChange={(e) =>
                      setEditingComponent({
                        ...editingComponent,
                        is_active: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-600"
                  />
                  <span>Is Active</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setEditingComponent(null)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveComponent}
                disabled={savingComponent}
                className="inline-flex items-center gap-1.5 rounded bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {savingComponent && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Component
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          EDIT ADJUSTMENTS MODAL
      ==================================================== */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-300 bg-white p-6 shadow-2xl">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Adjust Payroll Items: {editingRow.employee_name}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingRow.employee_code} · {MONTHS[selectedMonth - 1]} {selectedYear}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">Incentive (₹)</span>
                <input
                  type="number"
                  value={editIncentive}
                  onChange={(e) => setEditIncentive(e.target.value)}
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">Bonus (₹)</span>
                <input
                  type="number"
                  value={editBonus}
                  onChange={(e) => setEditBonus(e.target.value)}
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">Arrears / Compensation (₹)</span>
                <input
                  type="number"
                  value={editArrears}
                  onChange={(e) => setEditArrears(e.target.value)}
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">Advance Deduction (₹)</span>
                <input
                  type="number"
                  value={editAdvance}
                  onChange={(e) => setEditAdvance(e.target.value)}
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">TDS Deduction (₹)</span>
                <input
                  type="number"
                  value={editTds}
                  onChange={(e) => setEditTds(e.target.value)}
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700">LOP Days (Loss of Pay)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="31"
                  value={editLopDays}
                  onChange={(e) => setEditLopDays(e.target.value)}
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                />
                <span className="mt-1 block text-[10px] text-slate-400">
                  Deducts from Pay Days: (CTC × LOP / No. of Days)
                </span>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block font-semibold text-slate-700">Remarks</span>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Paid as F N F in Cash"
                  className="h-9 w-full rounded border border-slate-300 px-3 outline-none focus:border-indigo-600"
                />
              </label>

              {/* Pending Statutory Recovery Checkbox */}
              {(editingRow.has_pending_statutory || ((editingRow.pending_pf || 0) + (editingRow.pending_esi || 0) > 0)) && (
                <div className="sm:col-span-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editRecoverPending}
                      onChange={(e) => setEditRecoverPending(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-bold text-amber-900">
                        Collect Pending Statutory PF/ESI from Employee
                      </span>
                      <p className="mt-0.5 text-amber-800">
                        Company paid ₹{(((editingRow.pending_pf || 0) + (editingRow.pending_esi || 0))).toFixed(2)} (PF: ₹{(editingRow.pending_pf || 0).toFixed(2)}, ESI: ₹{(editingRow.pending_esi || 0).toFixed(2)}) on behalf of this employee while they were absent. Check this to deduct and recover it this month under Other Deductions.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveAdjustments}
                disabled={savingAdjustments}
                className="inline-flex items-center gap-1.5 rounded bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {savingAdjustments && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          COMPANY-BRANDED PRINTABLE PAYSLIP MODAL
      ==================================================== */}
{payslipModalRow &&
  typeof document !== "undefined" &&
  createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white p-6 shadow-2xl">
            {/* Modal Actions */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex shrink-0 items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-700" />
                <span className="font-bold text-slate-900">Official Payslip Voucher</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / Save as PDF
                </button>

                <button
                  type="button"
                  onClick={() => setPayslipModalRow(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>


            {/* Shared Standard Payslip */}
            <div id="master-payslip-print" className="mt-4 min-h-0 flex-1 overflow-y-auto bg-white print:m-0 print:p-0">
              <StandardPayslip
                employee={{
                  name: payslipModalRow.employee_name,
                  employeeCode: payslipModalRow.employee_code,
                  designation: payslipModalRow.designation,
                  department: payslipModalRow.department,
                  bankName: payslipModalRow.bank_name,
                  bankAccountNumber: payslipModalRow.bank_account_number,
                  pan: payslipModalRow.pan_number,
                  uan: payslipModalRow.uan_number,
                }}
                month={MONTHS[selectedMonth - 1]}
                year={selectedYear}
                standardSalary={[
                  { key: "basic", label: "Basic Pay", amount: payslipModalRow.basic || 0 },
                  { key: "hra", label: "House Rent Allowance", amount: payslipModalRow.hra || 0 },
                  { key: "conveyance", label: "Conveyance", amount: payslipModalRow.conveyance || 0 },
                  { key: "medical", label: "Medical Allowance", amount: payslipModalRow.medical_allowance || 0 },
                  { key: "lta", label: "Leave Travel Allowance", amount: payslipModalRow.leave_travel_allowance || 0 },
                  { key: "special", label: "Special Allowance", amount: payslipModalRow.special_allowance || 0 },
                ]}
                earnings={[
                  {
                    key: "monthly-earnings",
                    label: "Monthly Earnings After LOP",
                    amount: payslipModalRow.gross_salary || 0,
                  },
                  {
                    key: "arrears",
                    label: "Arrears",
                    amount: payslipModalRow.arrears || 0,
                  },
                  {
                    key: "incentive",
                    label: "Incentive / Bonus",
                    amount: payslipModalRow.incentive || 0,
                  },
                ]}
                deductions={[
                  { key: "pt", label: "Professional Tax", amount: payslipModalRow.pt || 0 },
                  { key: "epf", label: "Employee PF", amount: payslipModalRow.epf || 0 },
                  { key: "esi", label: "Employee ESI", amount: payslipModalRow.esic_emp || 0 },
                  { key: "tds", label: "TDS", amount: payslipModalRow.tds || 0 },
                  { key: "advance", label: "Advance", amount: payslipModalRow.advance || 0 },
                  { key: "lop", label: "Loss of Pay", amount: payslipModalRow.loss_of_pay || 0 },
                  { key: "other", label: "Other Deduction", amount: payslipModalRow.other_deduction || 0 },
                ]}
                workingDays={payslipModalRow.working_days || 0}
                paidDays={payslipModalRow.pay_days || 0}
                lopDays={payslipModalRow.lop_days || 0}
                grossSalaryBeforeLOP={
                  (payslipModalRow.gross_salary || 0) +
                  (payslipModalRow.loss_of_pay || 0)
                }
                grossDeductions={
                  Number(payslipModalRow.pt || 0) +
                  Number(payslipModalRow.epf || 0) +
                  Number(payslipModalRow.esic_emp || 0) +
                  Number(payslipModalRow.tds || 0) +
                  Number(payslipModalRow.advance || 0) +
                  Number(payslipModalRow.loss_of_pay || 0) +
                  Number(payslipModalRow.other_deduction || 0)
                }
                netPay={payslipModalRow.net_payout || 0}
                remarks={payslipModalRow.remarks || ""}
              />
            </div>

          </div>
    </div>,
      document.body
    )}
      
    </div>
  );
}
