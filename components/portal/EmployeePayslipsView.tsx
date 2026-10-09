"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Employee, Payslip } from "@/lib/types";
import { FileText, Printer, Eye, XCircle } from "lucide-react";
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
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(
    payslips[0] || null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const modal =
    isModalOpen && selectedPayslip && typeof document !== "undefined"
      ? createPortal(
          <div
            id="payslip-modal-root"
            className="payslip-modal-root fixed inset-0 z-[100] box-border flex items-center justify-center overflow-hidden bg-slate-950/60 p-0 sm:p-2"
          >
            <div className="payslip-modal-panel relative flex h-[100dvh] w-full min-w-0 max-w-none flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[98dvh] sm:rounded-xl">
              {/* Modal Header (hidden when printing) */}
              <div className="payslip-no-print z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Payslip</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {selectedPayslip.month_name} {selectedPayslip.payroll_year}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    aria-label="Close payslip"
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Payslip Content */}
              <div className="payslip-modal-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 p-2 sm:p-5">
                <div
                  id="payslip-print"
                  className="mx-auto w-full min-w-0 max-w-6xl border border-slate-200 bg-white text-slate-900"
                >
                  {/* Company Header */}
                  <div className="grid grid-cols-1 border-b border-slate-200 sm:grid-cols-2">
                    <div className="flex items-center gap-4 border-b border-slate-200 p-5 sm:border-b-0 sm:border-r sm:p-6">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
                        <Image
                          src="/logo.png"
                          alt="Teens Software Solutions LLP Logo"
                          width={120}
                          height={60}
                          className="h-auto max-h-12 w-auto object-contain"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="mb-1 text-[11px] text-slate-500">
                          Company
                        </p>
                        <h2 className="text-base font-bold tracking-tight text-slate-900">
                          Teens Software Solutions LLP
                        </h2>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Professional Payroll System
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-5 sm:p-6">
                      <div>
                        <p className="mb-2 text-[11px] text-slate-500">
                          Payslip for Month
                        </p>
                        <div className="inline-flex rounded-md border border-slate-300 px-3 py-2.5 text-sm font-medium">
                          {selectedPayslip.month_name}{" "}
                          {selectedPayslip.payroll_year}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">
                          Salary Statement
                        </p>
                        <h2 className="mt-1 text-xl font-extrabold">PAYSLIP</h2>
                        <p className="mt-1 text-xs text-slate-600">
                          {selectedPayslip.month_name}{" "}
                          {selectedPayslip.payroll_year}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Company Details */}
                  <section className="border-b border-slate-200 px-4 py-5 sm:px-7 sm:py-6">
                    <h3 className="border-b border-slate-200 pb-3 text-sm font-bold uppercase tracking-wide">
                      Company Details
                    </h3>

                    <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-[11px] text-slate-500">
                          Company Name
                        </label>
                        <div className="break-words rounded-md border border-slate-300 px-3 py-3 text-sm font-medium">
                          Teens Software Solutions LLP
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] text-slate-500">
                          Email
                        </label>
                        <div className="break-words rounded-md border border-slate-300 px-3 py-3 text-sm font-medium">
                          info@teenss.com
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-[11px] text-slate-500">
                          Company Address
                        </label>
                        <div className="break-words rounded-md border border-slate-300 px-3 py-3 text-sm font-medium">
                          Plot No. 1, 2nd Floor, Road No. 12, Banjara Hills
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] text-slate-500">
                          City
                        </label>
                        <div className="rounded-md border border-slate-300 px-3 py-3 text-sm font-medium">
                          Hyderabad, Telangana, India
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] text-slate-500">
                          Pincode
                        </label>
                        <div className="rounded-md border border-slate-300 px-3 py-3 text-sm font-medium">
                          500037
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Employee Pay Summary */}
                  <section className="border-b border-slate-200 px-4 py-5 sm:px-7 sm:py-6">
                    <h3 className="border-b border-slate-200 pb-3 text-sm font-bold uppercase tracking-wide">
                      Employee Pay Summary
                    </h3>

                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {[
                        {
                          label: "Employee Name",
                          value: `${employee.first_name} ${employee.last_name}`,
                        },
                        {
                          label: "Employee ID",
                          value: employee.employee_id,
                        },
                        {
                          label: "Designation",
                          value: employee.designation || "Software Engineer",
                        },
                        {
                          label: "Working Days",
                          value: `${selectedPayslip.working_days} days`,
                        },
                        {
                          label: "LOP Unpaid Days",
                          value: `${selectedPayslip.lop_days} day(s)`,
                        },
                      ].map((item) => (
                        <div key={item.label} className="min-w-0">
                          <label className="mb-2 block text-[11px] text-slate-500">
                            {item.label}
                          </label>
                          <div className="break-words rounded-md border border-slate-300 px-3 py-3 text-sm font-medium">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Bank & Statutory Details */}
                  <section className="border-b border-slate-200 px-4 py-5 sm:px-7 sm:py-6">
                    <h3 className="border-b border-slate-200 pb-3 text-sm font-bold uppercase tracking-wide text-slate-800">
                      Bank &amp; Statutory Details
                    </h3>

                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        {
                          label: "Bank Name",
                          value: employee.bank_name || "Not provided",
                        },
                        {
                          label: "Account Number",
                          value: employee.bank_account_number || "Not provided",
                        },
                        {
                          label: "IFSC Code",
                          value: employee.ifsc_code || "Not provided",
                        },
                        {
                          label: "PF / UAN Number",
                          value: employee.uan_number || "Not provided",
                        },
                        {
                          label: "ESI Number",
                          value: employee.esi_number || "Not provided",
                        },
                        {
                          label: "PAN Number",
                          value: employee.pan_number || "Not provided",
                        },
                      ].map((item) => (
                        <div key={item.label} className="min-w-0">
                          <label className="mb-2 block text-[11px] font-medium text-slate-500">
                            {item.label}
                          </label>

                          <div className="min-h-11 break-all rounded-md border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Earnings & Deductions */}
                  <section className="px-4 py-5 sm:px-7 sm:py-6">
                    <h3 className="mb-5 border-b border-slate-200 pb-3 text-sm font-bold uppercase tracking-wide">
                      Earnings &amp; Deductions
                    </h3>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      {/* Earnings */}
                      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200">
                        <div className="flex justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold">
                          <span>Earnings</span>
                          <span>Amount (₹)</span>
                        </div>

                        <div className="divide-y divide-slate-100 px-4">
                          {selectedPayslip.earnings_breakup.map((item) => (
                            <div
                              key={item.component_id}
                              className="flex justify-between gap-3 py-3 text-xs"
                            >
                              <span className="min-w-0 break-words text-slate-600">
                                {item.name}
                              </span>
                              <span className="shrink-0 font-medium tabular-nums">
                                ₹{item.amount.toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold">
                          <span>Total Earnings</span>
                          <span className="shrink-0 text-indigo-700">
                            ₹{selectedPayslip.total_earnings.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>

                      {/* Deductions */}
                      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200">
                        <div className="flex justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold">
                          <span>Deductions</span>
                          <span>Amount (₹)</span>
                        </div>

                        <div className="divide-y divide-slate-100 px-4">
                          {selectedPayslip.deductions_breakup.map((item) => (
                            <div
                              key={item.component_id}
                              className="flex justify-between gap-3 py-3 text-xs"
                            >
                              <span
                                className={
                                  item.code === "LOP"
                                    ? "min-w-0 break-words font-semibold text-amber-700"
                                    : "min-w-0 break-words text-slate-600"
                                }
                              >
                                {item.name}
                              </span>
                              <span className="shrink-0 font-medium tabular-nums text-rose-600">
                                ₹{item.amount.toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold">
                          <span>Total Deductions</span>
                          <span className="shrink-0 text-rose-600">
                            ₹{selectedPayslip.total_deductions.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Net Salary */}
                  <section className="mx-4 mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:mx-7 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                          Net Take-Home Salary
                        </p>
                        <p className="mt-2 break-words text-xs italic text-slate-600">
                          {numberToWordsIndian(selectedPayslip.net_salary)}
                        </p>
                      </div>

                      <p className="shrink-0 text-2xl font-extrabold tabular-nums text-emerald-700">
                        ₹{selectedPayslip.net_salary.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </section>

                  {/* Footer */}
                  <div className="border-t border-slate-200 px-4 py-4 text-center text-[10px] text-slate-400 sm:px-7">
                    This is a computer-generated salary slip and requires no
                    physical signature.
                    <br />
                    Teens Software Solutions LLP
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              My Salary &amp; Monthly Payslips
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-11">
            View historical payslips, see transparent statutory PF/ESI/PT
            deductions, and track Loss of Pay (LOP) impact.
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
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Payslip History</span>
          </h3>
          <span className="text-xs font-medium text-slate-400">
            Monthly Compensation Records
          </span>
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
                      <p className="font-medium text-slate-600 text-sm">
                        No payslips generated yet
                      </p>
                      <p className="text-xs text-slate-400">
                        HR will run monthly payroll at the end of the pay
                        period.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                payslips.map((slip) => (
                  <tr
                    key={slip.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
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
                      {slip.lop_deduction > 0
                        ? `-₹${slip.lop_deduction.toLocaleString("en-IN")}`
                        : "₹0"}
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

      {/* Payslip modal, rendered in a portal on <body> so print isn't clipped */}
      {modal}

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          /* Hide the whole app; only the modal portal stays */
          body > *:not(#payslip-modal-root) {
            display: none !important;
          }

          /* Un-fix and un-clip every modal wrapper */
          .payslip-modal-root,
          .payslip-modal-panel,
          .payslip-modal-scroll {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* Hide Print / Close header */
          .payslip-no-print {
            display: none !important;
          }

          #payslip-print {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            border: none !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }

          #payslip-print section {
            break-inside: avoid;
          }

          #payslip-print .bg-slate-50,
          #payslip-print .bg-emerald-50 {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}