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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Salary & Monthly Payslips</h2>
          <p className="text-xs text-slate-500 mt-1">
            View historical payslips, see transparent statutory PF/ESI/PT deductions, and track Loss of Pay (LOP) impact.
          </p>
        </div>

        {payslips.length > 0 && (
          <button
            onClick={() => {
              setSelectedPayslip(payslips[0]);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors shrink-0"
          >
            <Eye className="w-4 h-4" />
            <span>View Latest Payslip</span>
          </button>
        )}
      </div>

      {/* Payslips History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Payslip History</span>
          </h3>
          <span className="text-xs text-slate-400">Monthly Compensation Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Pay Period</th>
                <th className="py-3 px-4">Gross CTC</th>
                <th className="py-3 px-4">LOP Days</th>
                <th className="py-3 px-4">LOP Deduction</th>
                <th className="py-3 px-4">Total Deductions</th>
                <th className="py-3 px-4">Net Salary</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No payslips generated yet. HR will run monthly payroll at the end of the pay period.
                  </td>
                </tr>
              ) : (
                payslips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {slip.month_name} {slip.payroll_year}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      ₹{slip.gross_salary.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {slip.lop_days > 0 ? (
                        <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                          {slip.lop_days} day(s)
                        </span>
                      ) : (
                        <span className="text-slate-400">0 days</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-700">
                      {slip.lop_deduction > 0 ? `-₹${slip.lop_deduction.toLocaleString("en-IN")}` : "₹0"}
                    </td>
                    <td className="py-3 px-4 font-mono text-rose-600">
                      -₹{slip.total_deductions.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600 text-sm">
                      ₹{slip.net_salary.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {slip.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedPayslip(slip);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-900"
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
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8 print:shadow-none print:border-none print:m-0 print:p-0">
            {/* Modal Controls (Hidden in print) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden mb-6">
              <span className="text-xs font-semibold text-slate-500">
                Payslip Preview &bull; {selectedPayslip.month_name} {selectedPayslip.payroll_year}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Payslip Body */}
            <div id="payslip-print-area" className="border border-slate-300 p-6 rounded-xl space-y-6">
              {/* Company Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 border border-slate-200 rounded-lg">
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
                    <h2 className="text-lg font-bold text-slate-900">Teens Software Solutions LLP</h2>
                    <p className="text-[11px] text-slate-500">
                      Hitec City, Hyderabad, Telangana - 500081 &bull; info@teenssoftware.com
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900 block uppercase tracking-wide">
                    Payslip
                  </span>
                  <span className="text-xs font-medium text-indigo-700">
                    {selectedPayslip.month_name} {selectedPayslip.payroll_year}
                  </span>
                </div>
              </div>

              {/* Employee & Attendance Information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Employee Name
                  </span>
                  <span className="font-bold text-slate-900">
                    {employee.first_name} {employee.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Employee ID
                  </span>
                  <span className="font-mono font-bold text-slate-900">{employee.employee_id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Designation
                  </span>
                  <span className="font-medium text-slate-800">{employee.designation || "Engineer"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Bank Account
                  </span>
                  <span className="font-mono text-slate-800">
                    {employee.bank_account_number
                      ? `•••• ${employee.bank_account_number.slice(-4)}`
                      : "Verified"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    PAN Number
                  </span>
                  <span className="font-mono text-slate-800">{employee.pan_number || "Verified"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    UAN (PF No)
                  </span>
                  <span className="font-mono text-slate-800">{employee.uan_number || "100904561234"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Working Days
                  </span>
                  <span className="font-medium text-slate-800">{selectedPayslip.working_days} days</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    LOP Unpaid Days
                  </span>
                  <span className="font-bold text-amber-700">{selectedPayslip.lop_days} day(s)</span>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Earnings */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 p-2.5 font-bold text-slate-800 border-b border-slate-200 flex justify-between">
                    <span>Earnings</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="divide-y divide-slate-100 p-2 space-y-1.5">
                    {selectedPayslip.earnings_breakup.map((e) => (
                      <div key={e.component_id} className="flex justify-between py-1 text-slate-700">
                        <span>{e.name}</span>
                        <span className="font-mono font-medium">
                          ₹{e.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 p-2.5 border-t border-slate-200 font-bold text-slate-900 flex justify-between">
                    <span>Total Gross Earnings</span>
                    <span className="font-mono">
                      ₹{selectedPayslip.total_earnings.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 p-2.5 font-bold text-slate-800 border-b border-slate-200 flex justify-between">
                    <span>Deductions</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="divide-y divide-slate-100 p-2 space-y-1.5">
                    {selectedPayslip.deductions_breakup.map((d) => (
                      <div key={d.component_id} className="flex justify-between py-1 text-slate-700">
                        <span className={d.code === "LOP" ? "text-amber-800 font-semibold" : ""}>
                          {d.name}
                        </span>
                        <span className="font-mono font-medium text-rose-600">
                          ₹{d.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 p-2.5 border-t border-slate-200 font-bold text-slate-900 flex justify-between">
                    <span>Total Deductions</span>
                    <span className="font-mono text-rose-600">
                      ₹{selectedPayslip.total_deductions.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Pay Box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-emerald-800 block">
                    Net Take-Home Salary:
                  </span>
                  <p className="text-xs text-slate-600 italic mt-0.5">
                    {numberToWordsIndian(selectedPayslip.net_salary)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-emerald-700">
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
