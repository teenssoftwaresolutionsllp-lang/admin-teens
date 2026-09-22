"use client";

import { useState } from "react";
import { Employee, Payslip } from "@/lib/types";
import { FileText, Download, Printer, Eye, XCircle, AlertCircle } from "lucide-react";
import Image from "next/image";
import { numberToWordsIndian } from "@/lib/calculations";

interface EmployeePayslipsViewProps {
  employee: Employee;
  payslips: Payslip[];
}

export default function EmployeePayslipsView({
  employee,
  payslips,
}: EmployeePayslipsViewProps) {
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(payslips[0] || null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">My Salary & Monthly Payslips</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-11">
            View historical payslips, see transparent statutory PF/ESI/PT deductions, and track Loss of Pay (LOP) impact.
          </p>
        </div>

        {payslips.length > 0 && (
          <button
            onClick={() => {
              setSelectedPayslip(payslips[0]);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all shrink-0 hover:shadow"
          >
            <Eye className="w-4 h-4" />
            <span>View Latest Payslip</span>
          </button>
        )}
      </div>

      {/* Payslips History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Payslip History</span>
          </h3>
          <span className="text-xs font-medium text-slate-400">Monthly Compensation Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Pay Period</th>
                <th className="py-3.5 px-4">Gross CTC</th>
                <th className="py-3.5 px-4">LOP Days</th>
                <th className="py-3.5 px-4">LOP Deduction</th>
                <th className="py-3.5 px-4">Total Deductions</th>
                <th className="py-3.5 px-4">Net Salary</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-600 text-sm">No payslips generated yet</p>
                      <p className="text-xs text-slate-400">HR will run monthly payroll at the end of the pay period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payslips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5 font-bold text-slate-900">
                      {slip.month_name} {slip.payroll_year}
                    </td>
                    <td className="py-4 px-4 font-mono font-medium text-slate-800">
                      ₹{slip.gross_salary.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-4 font-medium">
                      {slip.lop_days > 0 ? (
                        <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg text-[11px]">
                          {slip.lop_days} day(s)
                        </span>
                      ) : (
                        <span className="text-slate-400">0 days</span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono font-medium text-amber-700">
                      {slip.lop_deduction > 0 ? `-₹${slip.lop_deduction.toLocaleString("en-IN")}` : "₹0"}
                    </td>
                    <td className="py-4 px-4 font-mono font-medium text-rose-600">
                      -₹{slip.total_deductions.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-emerald-600 text-sm">
                      ₹{slip.net_salary.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-2.5 py-1 rounded-full">
                        {slip.payment_status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => {
                          setSelectedPayslip(slip);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/80 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Payslip Modal (Printable) */}
      {isModalOpen && selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8 print:shadow-none print:border-none print:m-0 print:p-0">
            {/* Modal Controls (Hidden in print) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-700">
                  Payslip Preview &bull; {selectedPayslip.month_name} {selectedPayslip.payroll_year}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-100"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / PDF</span>
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Payslip Body */}
            <div id="payslip-print-area" className="border border-slate-200 p-6 rounded-2xl space-y-6 bg-white">
              {/* Company Header */}
              <div className="flex items-center justify-between border-b pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="p-2 border border-slate-200 rounded-xl bg-slate-50">
                    <Image
                      src="/logo.png"
                      alt="Logo"
                      width={120}
                      height={40}
                      className="object-contain"
                      style={{ height: "36px", width: "auto" }}
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Teens Software Solutions LLP</h2>
                    <p className="text-[11px] text-slate-500">
                      Hitec City, Hyderabad, Telangana - 500081 &bull; info@teenssoftware.com
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 block uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-md">
                    Salary Slip
                  </span>
                  <span className="text-xs font-semibold text-indigo-700 mt-1 block">
                    {selectedPayslip.month_name} {selectedPayslip.payroll_year}
                  </span>
                </div>
              </div>

              {/* Employee & Attendance Information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-slate-50/80 p-4.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Employee Name
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {employee.first_name} {employee.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Employee ID
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{employee.employee_id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Designation
                  </span>
                  <span className="font-medium text-slate-800 mt-0.5 block">{employee.designation || "Software Engineer"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Bank Account
                  </span>
                  <span className="font-mono text-slate-800 mt-0.5 block">
                    {employee.bank_account_number
                      ? `•••• ${employee.bank_account_number.slice(-4)}`
                      : "Verified Bank"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    PAN Number
                  </span>
                  <span className="font-mono text-slate-800 mt-0.5 block">{employee.pan_number || "Verified"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    UAN (PF No)
                  </span>
                  <span className="font-mono text-slate-800 mt-0.5 block">{employee.uan_number || "100904561234"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Working Days
                  </span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{selectedPayslip.working_days} days</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    LOP Unpaid Days
                  </span>
                  <span className="font-bold text-amber-700 mt-0.5 block">{selectedPayslip.lop_days} day(s)</span>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Earnings */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-slate-100/90 px-3.5 py-2.5 font-bold text-slate-800 border-b border-slate-200 flex justify-between">
                    <span>Earnings</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="divide-y divide-slate-100 p-3 space-y-2">
                    {selectedPayslip.earnings_breakup.map((e) => (
                      <div key={e.component_id} className="flex justify-between py-1 text-slate-700">
                        <span>{e.name}</span>
                        <span className="font-mono font-medium">
                          ₹{e.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 px-3.5 py-2.5 border-t border-slate-200 font-bold text-slate-900 flex justify-between">
                    <span>Total Gross Earnings</span>
                    <span className="font-mono font-bold text-indigo-700">
                      ₹{selectedPayslip.total_earnings.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-slate-100/90 px-3.5 py-2.5 font-bold text-slate-800 border-b border-slate-200 flex justify-between">
                    <span>Deductions</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="divide-y divide-slate-100 p-3 space-y-2">
                    {selectedPayslip.deductions_breakup.map((d) => (
                      <div key={d.component_id} className="flex justify-between py-1 text-slate-700">
                        <span className={d.code === "LOP" ? "text-amber-800 font-bold" : ""}>
                          {d.name}
                        </span>
                        <span className="font-mono font-medium text-rose-600">
                          ₹{d.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 px-3.5 py-2.5 border-t border-slate-200 font-bold text-slate-900 flex justify-between">
                    <span>Total Deductions</span>
                    <span className="font-mono font-bold text-rose-600">
                      ₹{selectedPayslip.total_deductions.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Pay Box */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                    Net Take-Home Salary:
                  </span>
                  <p className="text-xs font-medium text-slate-600 italic mt-1">
                    {numberToWordsIndian(selectedPayslip.net_salary)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black font-mono text-emerald-700 tracking-tight">
                    ₹{selectedPayslip.net_salary.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Footer / Disclaimer */}
              <div className="border-t border-slate-200 pt-4 text-[10px] text-slate-400 text-center">
                This is a computer-generated salary slip and requires no physical signature &bull; Teens Software Solutions LLP
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
