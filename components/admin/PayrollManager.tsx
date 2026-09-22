"use client";

import { useState } from "react";
import { SalaryComponent, Payslip, Employee } from "@/lib/types";
import {
  Banknote,
  Settings,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Eye,
  Sliders,
  XCircle,
  Printer,
} from "lucide-react";
import Image from "next/image";
import { numberToWordsIndian } from "@/lib/calculations";

interface PayrollManagerProps {
  initialComponents: SalaryComponent[];
  initialPayslips: Payslip[];
  employees: Employee[];
}

export default function PayrollManager({
  initialComponents,
  initialPayslips,
}: PayrollManagerProps) {
  const [components, setComponents] = useState<SalaryComponent[]>(initialComponents);
  const [payslips, setPayslips] = useState<Payslip[]>(initialPayslips);
  const [activeTab, setActiveTab] = useState<"runner" | "components" | "slips">("runner");

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [running, setRunning] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payslip preview modal
  const [previewSlip, setPreviewSlip] = useState<Payslip | null>(null);

  // Toggle Component Active/Inactive
  const handleToggleComponent = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/payroll/components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      });

      if (res.ok) {
        setComponents((prev) =>
          prev.map((c) => (c.id === id ? { ...c, is_active: !currentStatus } : c))
        );
        setSuccessMsg(
          `Salary component updated. Future payroll runs will reflect this configuration.`
        );
      }
    } catch (err) {
      console.error("Toggle component error:", err);
    }
  };

  // Run Monthly Payroll
  const handleRunPayroll = async () => {
    setRunning(true);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/payroll/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear }),
      });

      if (res.ok) {
        const data = await res.json();
        setPayslips(data.payslips);
        setSuccessMsg(
          `Successfully processed monthly payroll for ${data.generatedCount} active employees. LOP deductions applied automatically based on leave & attendance records!`
        );
        setActiveTab("slips");
      }
    } catch (err) {
      console.error("Run payroll error:", err);
    } finally {
      setRunning(false);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const totalPayrollSpend = payslips
    .filter((p) => p.payroll_month === selectedMonth && p.payroll_year === selectedYear)
    .reduce((acc, c) => acc + c.net_salary, 0);

  const totalLopDeductions = payslips
    .filter((p) => p.payroll_month === selectedMonth && p.payroll_year === selectedYear)
    .reduce((acc, c) => acc + c.lop_deduction, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payroll & Payslip Engine</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure customizable salary heads (earnings & statutory deductions), process monthly payroll with automated LOP deductions, and generate official payslips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("components")}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Customize Heads</span>
          </button>
          <button
            onClick={() => setActiveTab("runner")}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Payroll</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Net Monthly Payout ({monthNames[selectedMonth - 1]})
          </span>
          <span className="text-2xl font-black font-mono text-indigo-700 mt-1 block">
            ₹{totalPayrollSpend.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400">Total bank disbursement liability</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Automated LOP Deductions
          </span>
          <span className="text-2xl font-black font-mono text-amber-700 mt-1 block">
            ₹{totalLopDeductions.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400">Deducted for unpaid leaves & half-days</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Active Salary Heads
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {components.filter((c) => c.is_active).length} / {components.length}
          </span>
          <span className="text-[11px] text-slate-400">HR customizable components active</span>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 flex overflow-x-auto bg-slate-50/50">
          <button
            onClick={() => setActiveTab("runner")}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "runner"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Process Monthly Payroll</span>
          </button>

          <button
            onClick={() => setActiveTab("components")}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "components"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>HR Customizable Components</span>
          </button>

          <button
            onClick={() => setActiveTab("slips")}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "slips"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Generated Payslips Directory ({payslips.length})</span>
          </button>
        </div>

        {/* Tab 1: Process Monthly Payroll */}
        {activeTab === "runner" && (
          <div className="p-8 space-y-6">
            <div className="max-w-xl mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
                  <Banknote className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Run Monthly Payroll</h3>
                <p className="text-xs text-slate-500">
                  Select the pay period to compute earnings, apply LOP leave deductions, and generate official payslips.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Select Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Select Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1.5">
                <span className="font-bold block">Engine Automation Highlights:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-indigo-800 text-[11px]">
                  <li>
                    Automatically pulls approved <strong>Loss of Pay (LOP)</strong> leaves and half-days from attendance.
                  </li>
                  <li>
                    Calculates daily deduction rate:{" "}
                    <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono">
                      (Monthly Gross / Days in Month) × LOP Days
                    </code>
                    .
                  </li>
                  <li>
                    Applies only components marked <strong>Active</strong> in HR Salary Settings.
                  </li>
                  <li>
                    Stores generated payslips and makes them immediately visible in the Employee Self-Service portal.
                  </li>
                </ul>
              </div>

              <button
                onClick={handleRunPayroll}
                disabled={running}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payroll & Calculating Deductions...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>
                      Generate Payroll for {monthNames[selectedMonth - 1]} {selectedYear}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Customizable Salary Components */}
        {activeTab === "components" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configurable Salary Heads</h3>
                <p className="text-xs text-slate-500">
                  HR can toggle components ON or OFF. Formulas are pre-programmed; when active, they automatically impact payroll.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Component Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Calculation Formula</th>
                    <th className="py-3 px-4">LOP Impact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {components.map((comp) => (
                    <tr key={comp.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {comp.name}
                        {comp.is_statutory && (
                          <span className="ml-2 text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            Statutory
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{comp.code}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            comp.type === "earning"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {comp.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-800">
                        {comp.description}
                      </td>
                      <td className="py-3 px-4">
                        {comp.affects_lop ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            Yes (Pro-rated)
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            comp.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {comp.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleComponent(comp.id, comp.is_active)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                            comp.is_active
                              ? "text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100"
                              : "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {comp.is_active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Generated Payslips Directory */}
        {activeTab === "slips" && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Pay Period</th>
                    <th className="py-3 px-4">Gross CTC</th>
                    <th className="py-3 px-4">LOP Days</th>
                    <th className="py-3 px-4">LOP Deduction</th>
                    <th className="py-3 px-4">Total Deductions</th>
                    <th className="py-3 px-4">Net Salary</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payslips.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        No payslips generated yet. Click &quot;Process Monthly Payroll&quot; above.
                      </td>
                    </tr>
                  ) : (
                    payslips.map((slip) => {
                      const emp = slip.employee;
                      return (
                        <tr key={slip.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {emp ? `${emp.first_name} ${emp.last_name}` : "Employee"}
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {emp?.employee_id || "TSS"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {slip.month_name} {slip.payroll_year}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-800">
                            ₹{slip.gross_salary.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {slip.lop_days > 0 ? (
                              <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded">
                                {slip.lop_days} day(s)
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-amber-700 font-medium">
                            {slip.lop_deduction > 0 ? `-₹${slip.lop_deduction.toLocaleString("en-IN")}` : "₹0"}
                          </td>
                          <td className="py-3 px-4 font-mono text-rose-600">
                            -₹{slip.total_deductions.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-600 text-sm">
                            ₹{slip.net_salary.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setPreviewSlip(slip)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Slip</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payslip View Modal */}
      {previewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8 print:shadow-none print:border-none print:m-0 print:p-0">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden mb-6">
              <span className="text-xs font-semibold text-slate-500">
                Payslip Preview &bull; {previewSlip.month_name} {previewSlip.payroll_year}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setPreviewSlip(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="border border-slate-300 p-6 rounded-xl space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={100}
                    height={32}
                    className="object-contain"
                    style={{ height: "32px", width: "auto" }}
                  />
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Teens Software Solutions LLP</h2>
                    <p className="text-[10px] text-slate-500">Hitec City, Hyderabad - 500081</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider block">Official Payslip</span>
                  <span className="text-xs font-medium text-indigo-700">
                    {previewSlip.month_name} {previewSlip.payroll_year}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-lg border">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Employee Name</span>
                  <span className="font-bold text-slate-900">
                    {previewSlip.employee?.first_name} {previewSlip.employee?.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Employee ID</span>
                  <span className="font-mono font-bold text-slate-900">
                    {previewSlip.employee?.employee_id}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Working Days</span>
                  <span className="font-medium text-slate-800">{previewSlip.working_days} days</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">LOP Unpaid Days</span>
                  <span className="font-bold text-amber-700">{previewSlip.lop_days} day(s)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-100 p-2 font-bold flex justify-between">
                    <span>Earnings</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="p-2 space-y-1 divide-y divide-slate-100">
                    {previewSlip.earnings_breakup.map((e) => (
                      <div key={e.component_id} className="flex justify-between py-1">
                        <span>{e.name}</span>
                        <span className="font-mono">₹{e.amount.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-100 p-2 font-bold flex justify-between">
                    <span>Deductions</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="p-2 space-y-1 divide-y divide-slate-100">
                    {previewSlip.deductions_breakup.map((d) => (
                      <div key={d.component_id} className="flex justify-between py-1">
                        <span className={d.code === "LOP" ? "text-amber-800 font-semibold" : ""}>
                          {d.name}
                        </span>
                        <span className="font-mono text-rose-600">
                          ₹{d.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-800 block">Take-Home Net Pay</span>
                  <p className="text-xs text-slate-600 italic">
                    {numberToWordsIndian(previewSlip.net_salary)}
                  </p>
                </div>
                <span className="text-2xl font-black font-mono text-emerald-700">
                  ₹{previewSlip.net_salary.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
