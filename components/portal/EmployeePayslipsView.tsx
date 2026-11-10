"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Employee, Payslip } from "@/lib/types";
import {
  FileText,
  Printer,
  Eye,
  XCircle,
} from "lucide-react";
import StandardPayslip, {
  type PayslipItem,
} from "@/components/payroll/StandardPayslip";
import { numberToWordsIndian } from "@/lib/calculations";

interface EmployeePayslipsViewProps {
  employee: Employee;
  payslips: EmployeePayslip[];
}

type EmployeePayslip = Omit<
  Payslip,
  | "employer_pf"
  | "employer_esi"
  | "pf_admin"
  | "gratuity_provision"
  | "employee"
>;

type SensitiveField = "account" | "pan" | "uan" | "esi";

type SalaryComponent = {
  name?: string;
  code?: string;
  type?: string;
  component_id?: string | number;
  amount?: number | string | null;
};

export default function EmployeePayslipsView({
  employee,
  payslips,
}: EmployeePayslipsViewProps) {
  const [selectedPayslip, setSelectedPayslip] =
    useState<EmployeePayslip | null>(payslips[0] || null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [visibleFields, setVisibleFields] = useState<
    Record<SensitiveField, boolean>
  >({
    account: false,
    pan: false,
    uan: false,
    esi: false,
  });

  const resetSensitiveVisibility = () => {
    setVisibleFields({
      account: false,
      pan: false,
      uan: false,
      esi: false,
    });
  };

  const toggleSensitiveField = (field: SensitiveField) => {
    setVisibleFields((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  };

  const maskValue = (
    value: string | null | undefined,
    field: SensitiveField
  ) => {
    if (!value) return "Not provided";

    if (visibleFields[field]) return String(value);

    const cleanValue = String(value);

    if (field === "account") {
      return `******${cleanValue.slice(-4)}`;
    }

    if (field === "pan") {
      if (cleanValue.length <= 4) return "********";
      return `${"*".repeat(cleanValue.length - 4)}${cleanValue.slice(-4)}`;
    }

    if (field === "uan" || field === "esi") {
      return `******${cleanValue.slice(-4)}`;
    }

    return "******";
  };

  const handlePrint = () => {
    window.print();
  };

  const openPayslip = (slip: EmployeePayslip) => {
    resetSensitiveVisibility();
    setSelectedPayslip(slip);
    setIsModalOpen(true);
  };

  const closePayslip = () => {
    setIsModalOpen(false);
    resetSensitiveVisibility();
  };

  // Normalize component names and codes.
  const normalizeComponent = (value?: string) =>
    (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // Safely convert values to numbers.
  const getAmount = (item?: SalaryComponent) => {
    const amount = Number(item?.amount ?? 0);
    return Number.isFinite(amount) ? amount : 0;
  };

  const getIdentifier = (item: SalaryComponent) =>
    `${normalizeComponent(item.name)}${normalizeComponent(item.code)}`;

  // Exclude employer-side contributions from employee payslips.
  const isEmployerOnlyComponent = (item: SalaryComponent) => {
    const identifier = getIdentifier(item);
    const type = normalizeComponent(item.type);

    return (
      identifier.includes("employerpf") ||
      identifier.includes("employeresi") ||
      identifier.includes("employercontribution") ||
      identifier.includes("pfadmin") ||
      identifier.includes("gratuityprovision") ||
      identifier.includes("employergratuity") ||
      type === "employercontribution"
    );
  };

  // Find a component using its name or code.
  // Generic type values such as "earning" and "deduction"
  // are deliberately not used as component identifiers.
  const findComponent = (
    items: SalaryComponent[],
    aliases: string[]
  ) => {
    const normalizedAliases = aliases.map(normalizeComponent);

    return items.find((item) => {
      const name = normalizeComponent(item.name);
      const code = normalizeComponent(item.code);

      return normalizedAliases.some(
        (alias) =>
          name === alias ||
          code === alias ||
          (name.length > alias.length && name.includes(alias)) ||
          (code.length > alias.length && code.includes(alias))
      );
    });
  };

  // Detect LOP using either the component name or its code.
  const isLOPComponent = (item: SalaryComponent) => {
    const name = normalizeComponent(item.name);
    const code = normalizeComponent(item.code);

    const lopAliases = [
      "lop",
      "lossofpay",
      "lossofpayment",
      "lopdeduction",
      "lossofpaydeduction",
    ];

    return lopAliases.some(
      (alias) =>
        name === alias ||
        code === alias ||
        (name.length > alias.length && name.includes(alias)) ||
        (code.length > alias.length && code.includes(alias))
    );
  };

  // Get the selected payslip's earnings and deductions.
  const allEarnings: SalaryComponent[] = (
    selectedPayslip?.earnings_breakup || []
  ).filter((item) => !isEmployerOnlyComponent(item));

  const allDeductions: SalaryComponent[] = (
    selectedPayslip?.deductions_breakup || []
  ).filter((item) => !isEmployerOnlyComponent(item));

  // --------------------------------------------------
  // STANDARD MONTHLY SALARY
  // --------------------------------------------------

  const standardSalary: PayslipItem[] = [
    {
      key: "basic",
      label: "Basic Pay",
      amount: getAmount(
        findComponent(allEarnings, [
          "basic",
          "basicpay",
          "basicsalary",
        ])
      ),
    },
    {
      key: "hra",
      label: "House Rent Allowance",
      amount: getAmount(
        findComponent(allEarnings, [
          "hra",
          "houserentallowance",
        ])
      ),
    },
    {
      key: "conveyance",
      label: "Conveyance",
      amount: getAmount(
        findComponent(allEarnings, [
          "conveyance",
          "conveyanceallowance",
        ])
      ),
    },
    {
      key: "medical",
      label: "Medical Allowance",
      amount: getAmount(
        findComponent(allEarnings, [
          "medical",
          "medicalallowance",
        ])
      ),
    },
    {
      key: "lta",
      label: "Leave Travel Allowance",
      amount: getAmount(
        findComponent(allEarnings, [
          "lta",
          "leavetravelallowance",
        ])
      ),
    },
    {
      key: "special",
      label: "Special Allowance",
      amount: getAmount(
        findComponent(allEarnings, [
          "special",
          "specialallowance",
        ])
      ),
    },
  ];

  // --------------------------------------------------
  // ADDITIONAL EARNINGS
  // --------------------------------------------------

  const arrearsItem = findComponent(allEarnings, [
    "arrears",
    "arrear",
  ]);

  const incentiveItem = findComponent(allEarnings, [
    "incentive",
    "bonus",
    "performancebonus",
  ]);

  // --------------------------------------------------
  // LOSS OF PAY CALCULATION
  // --------------------------------------------------

  const grossSalaryBeforeLOP = Number(
    selectedPayslip?.gross_salary ?? 0
  );

  const lopBreakupItem = allDeductions.find(isLOPComponent);

  const payslipLOPAmount = Number(
    selectedPayslip?.lop_deduction ?? 0
  );

  // Prefer the dedicated lop_deduction field.
  // If it is missing or zero, fall back to the LOP breakup item.
  const lopDeduction =
    Number.isFinite(payslipLOPAmount) && payslipLOPAmount > 0
      ? payslipLOPAmount
      : getAmount(lopBreakupItem);

  // Monthly earnings after deducting LOP.
  const monthlyEarningsAfterLOP = Math.max(
    0,
    grossSalaryBeforeLOP - lopDeduction
  );

  const earningsItems: PayslipItem[] = [
    {
      key: "monthly-earnings",
      label: "Monthly Earnings After LOP",
      amount: monthlyEarningsAfterLOP,
    },
    {
      key: "arrears",
      label: "Arrears",
      amount: getAmount(arrearsItem),
    },
    {
      key: "incentive",
      label: "Incentive / Bonus",
      amount: getAmount(incentiveItem),
    },
  ];

  // --------------------------------------------------
  // EMPLOYEE DEDUCTIONS
  // --------------------------------------------------

  // Remove LOP from the original list first.
  // We will add it separately using the correct LOP amount.
  const deductionItems: PayslipItem[] = allDeductions
    .filter((item) => {
      const identifier = getIdentifier(item);

      const isRemark =
        identifier.includes("remark") ||
        identifier.includes("comment");

      return !isRemark && !isLOPComponent(item);
    })
    .map((item, index) => ({
      key: `${
        item.component_id || item.code || item.name || "deduction"
      }-${index}`,
      label: item.name || item.code || "Other Deduction",
      amount: getAmount(item),
    }));

  // IMPORTANT FIX:
  // Always add LOP explicitly when an LOP amount or LOP days exist.
  // This prevents LOP from disappearing when the API does not
  // include it inside deductions_breakup.
  const lopDays = Number(selectedPayslip?.lop_days ?? 0);

  if (lopDeduction > 0 || lopDays > 0 || lopBreakupItem) {
    deductionItems.push({
      key: "loss-of-pay",
      label: "Loss of Pay (LOP)",
      amount: lopDeduction,
    });
  }

  // --------------------------------------------------
  // TOTALS
  // --------------------------------------------------

  const arrearsAmount = getAmount(arrearsItem);
  const incentiveAmount = getAmount(incentiveItem);

  const grossEarnings =
    grossSalaryBeforeLOP +
    arrearsAmount +
    incentiveAmount;

  // Total employee deductions, including LOP exactly once.
  const grossDeductions = deductionItems.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );
  // --------------------------------------------------
  // PAYSLIP MODAL
  // --------------------------------------------------

  const modal =
    isModalOpen &&
    selectedPayslip &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            id="payslip-modal-root"
            className="payslip-modal-root fixed inset-0 z-[100] box-border flex items-center justify-center overflow-hidden bg-slate-950/60 p-0 sm:p-2"
          >
            <div className="payslip-modal-panel relative flex h-[100dvh] w-full min-w-0 max-w-none flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[98dvh] sm:rounded-xl">

              {/* Modal Header */}
              <div className="payslip-no-print z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Payslip
                  </h2>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {selectedPayslip.month_name}{" "}
                    {selectedPayslip.payroll_year}
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
                    onClick={closePayslip}
                    aria-label="Close payslip"
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="payslip-modal-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 p-2 sm:p-5">
                <div
                  id="payslip-print"
                  className="mx-auto w-full min-w-0 max-w-6xl border border-slate-200 bg-white text-slate-900"
                >

                  {/* Sensitive Information Controls */}
                  <div className="payslip-no-print flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3">
                    <span className="mr-1 text-xs font-semibold text-slate-600">
                      Personal details:
                    </span>

                    {(
                      [
                        ["account", "Account Number"],
                        ["pan", "PAN"],
                        ["uan", "UAN"],
                        ["esi", "ESI"],
                      ] as [SensitiveField, string][]
                    ).map(([field, label]) => (
                      <button
                        key={field}
                        type="button"
                        onClick={() => toggleSensitiveField(field)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        {visibleFields[field] ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}

                        {visibleFields[field] ? "Hide" : "Show"}{" "}
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Shared Payslip Design */}
                  <StandardPayslip
                    employee={{
                      name: `${employee.first_name || ""} ${
                        employee.last_name || ""
                      }`.trim(),
                      employeeCode: employee.employee_id,
                      designation: employee.designation || undefined,
                      bankName: employee.bank_name || undefined,
                      bankAccountNumber: maskValue(
                        employee.bank_account_number,
                        "account"
                      ),
                      ifscCode: employee.ifsc_code || undefined,
                      pan: maskValue(employee.pan_number, "pan"),
                      uan: maskValue(employee.uan_number, "uan"),
                      esiNumber: maskValue(employee.esi_number, "esi"),
                    }}
                    month={selectedPayslip.month_name}
                    year={selectedPayslip.payroll_year}
                    standardSalary={standardSalary}
                    earnings={earningsItems}
                    deductions={deductionItems}
                    workingDays={selectedPayslip.working_days}
                    paidDays={
                      Number(selectedPayslip.present_days || 0) +
                      Number(selectedPayslip.paid_leaves || 0)
                    }
                    paidLeaves={selectedPayslip.paid_leaves}
                    lopDays={selectedPayslip.lop_days}
                    grossSalaryBeforeLOP={grossEarnings}
                    grossDeductions={grossDeductions}
                    netPay={Number(selectedPayslip.net_salary || 0)}
                    amountInWords={numberToWordsIndian(
                      Number(selectedPayslip.net_salary || 0)
                    )}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  // --------------------------------------------------
  // MAIN PAGE
  // --------------------------------------------------

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:p-7">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              My Salary &amp; Monthly Payslips
            </h2>
          </div>

          <p className="mt-1.5 pl-11 text-xs leading-relaxed text-slate-500">
            View historical payslips, see your salary deductions, and track
            Loss of Pay (LOP) impact.
          </p>
        </div>

        {payslips.length > 0 && (
          <button
            type="button"
            onClick={() => openPayslip(payslips[0])}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow"
          >
            <Eye className="h-4 w-4" />
            <span>View Latest Payslip</span>
          </button>
        )}
      </div>

      {/* Payslips History Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileText className="h-4 w-4 text-indigo-600" />
            <span>Payslip History</span>
          </h3>

          <span className="text-xs font-medium text-slate-400">
            Monthly Compensation Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              <tr>
                <th className="px-5 py-3.5">Pay Period</th>
                <th className="px-4 py-3.5">Gross CTC</th>
                <th className="px-4 py-3.5">LOP Days</th>
                <th className="px-4 py-3.5">LOP Deduction</th>
                <th className="px-4 py-3.5">Total Deductions</th>
                <th className="px-4 py-3.5">Net Salary</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {payslips.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-slate-300" />

                      <p className="text-sm font-medium text-slate-600">
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
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {slip.month_name} {slip.payroll_year}
                    </td>

                    <td className="px-4 py-4 font-mono font-medium text-slate-800">
                      ₹
                      {Number(slip.gross_salary || 0).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td className="px-4 py-4 font-medium">
                      {Number(slip.lop_days || 0) > 0 ? (
                        <span className="rounded-lg border border-amber-200/60 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                          {slip.lop_days} day(s)
                        </span>
                      ) : (
                        <span className="text-slate-400">0 days</span>
                      )}
                    </td>

                    <td className="px-4 py-4 font-mono font-medium text-amber-700">
                      {Number(slip.lop_deduction || 0) > 0
                        ? `-₹${Number(
                            slip.lop_deduction
                          ).toLocaleString("en-IN")}`
                        : "₹0"}
                    </td>

                    <td className="px-4 py-4 font-mono font-medium text-rose-600">
                      -₹
                      {Number(slip.total_deductions || 0).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td className="px-4 py-4 font-mono text-sm font-bold text-emerald-600">
                      ₹
                      {Number(slip.net_salary || 0).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        {slip.payment_status}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openPayslip(slip)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100/80 hover:text-indigo-900"
                      >
                        <Eye className="h-3.5 w-3.5" />
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

      {modal}

      {/* A4 Print Styles */}
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

          body > *:not(#payslip-modal-root) {
            display: none !important;
          }

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