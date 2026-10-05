"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Printer,
  Loader2,
} from "lucide-react";

type PayrollRecord = {
  id: string;
  employee_id: string | null;

  payroll_month: number;
  payroll_year: number;
  month_name: string;

  working_days: number;
  present_days: number;
  paid_leaves?: number | null;
  lop_days?: number | null;

  gross_salary: number;
  lop_deduction?: number | null;

  total_earnings: number;
  total_deductions: number;
  net_salary: number;

  earnings_breakup: Record<string, number>;
  deductions_breakup: Record<string, number>;

  payment_status?: string | null;
  created_at?: string;
};

type Employee = {
  id: string;

  employee_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;

  email?: string | null;
  phone?: string | null;

  designation?: string | null;
  department_id?: string | null;
  department?: string | null;

  joining_date?: string | null;
  date_of_joining?: string | null;

  work_location?: string | null;
  location?: string | null;

  employment_type?: string | null;

  pf_number?: string | null;
  uan_number?: string | null;
  esi_number?: string | null;

  bank_account_number?: string | null;
  account_number?: string | null;

  bank_name?: string | null;
  payment_mode?: string | null;

  grade?: string | null;
};

type YtdValues = {
  earnings: Record<string, number>;
  deductions: Record<string, number>;
};

const COMPANY_NAME = "TEENS SOFTWARE SOLUTIONS LLP";

const COMPANY_ADDRESS =
  "Hyderabad, Telangana, India";

const COMPANY_EMAIL =
  "hr@teenssoftwaresolutions.com";

function money(value: number | null | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* -------------------------------------------------------
   Indian Rupees → Words
------------------------------------------------------- */

function numberToWordsIndian(num: number): string {
  if (num === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];

    const ten = Math.floor(n / 10);
    const one = n % 10;

    return `${tens[ten]}${one ? ` ${ones[one]}` : ""}`;
  }

  function threeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;

    if (!hundred) return twoDigits(remainder);

    return `${ones[hundred]} Hundred${
      remainder ? ` ${twoDigits(remainder)}` : ""
    }`;
  }

  let result = "";

  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const remainder = num;

  if (crore) result += `${threeDigits(crore)} Crore `;

  if (lakh) result += `${threeDigits(lakh)} Lakh `;

  if (thousand) result += `${threeDigits(thousand)} Thousand `;

  if (remainder) result += `${threeDigits(remainder)}`;

  return result.trim();
}

function amountInWords(amount: number) {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = `Rupees ${numberToWordsIndian(rupees)}`;

  if (paise > 0) {
    result += ` and ${numberToWordsIndian(paise)} Paise`;
  }

  return `${result} Only`;
}

/* -------------------------------------------------------
   Component
------------------------------------------------------- */

export default function PayslipPage() {
  const params = useParams();
  const router = useRouter();

  const id = params?.id as string;

  const [payroll, setPayroll] = useState<PayrollRecord | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);

  const [ytd, setYtd] = useState<YtdValues>({
    earnings: {},
    deductions: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* -------------------------------------------------------
     Load payroll
  ------------------------------------------------------- */

  useEffect(() => {
    if (!id) return;

    async function loadPayslip() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/payroll/${id}`);

        if (!response.ok) {
          throw new Error("Failed to load payroll");
        }

        const data = await response.json();

        setPayroll(data.payroll);
        setEmployee(data.employee);

        if (data.ytd) {
          setYtd(data.ytd);
        }
      } catch (err) {
        console.error(err);
        setError("Unable to load payslip.");
      } finally {
        setLoading(false);
      }
    }

    loadPayslip();
  }, [id]);

  /* -------------------------------------------------------
     Employee name
  ------------------------------------------------------- */

  const employeeName = useMemo(() => {
    if (!employee) return "-";

    return [employee.first_name, employee.last_name]
      .filter(Boolean)
      .join(" ");
  }, [employee]);

  /* -------------------------------------------------------
     Department
  ------------------------------------------------------- */

  const departmentName =
    employee?.department ||
    employee?.department_id ||
    "-";

  /* -------------------------------------------------------
     Earnings
  ------------------------------------------------------- */

  const earnings = useMemo(() => {
    if (!payroll) return [];

    return Object.entries(payroll.earnings_breakup || {})
      .map(([key, value]) => ({
        key,
        name: titleCase(key),
        amount: numberValue(value),
        ytd: numberValue(ytd.earnings[key]),
      }))
      .filter(
        (item) => item.amount !== 0 || item.ytd !== 0
      );
  }, [payroll, ytd]);

  /* -------------------------------------------------------
     Deductions
  ------------------------------------------------------- */

  const deductions = useMemo(() => {
    if (!payroll) return [];

    return Object.entries(payroll.deductions_breakup || {})
      .map(([key, value]) => ({
        key,
        name: titleCase(key),
        amount: numberValue(value),
        ytd: numberValue(ytd.deductions[key]),
      }))
      .filter(
        (item) => item.amount !== 0 || item.ytd !== 0
      );
  }, [payroll, ytd]);

  /* -------------------------------------------------------
     Print
  ------------------------------------------------------- */

  function printPayslip() {
    window.print();
  }

  /* -------------------------------------------------------
     Loading
  ------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading payslip...
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     Error
  ------------------------------------------------------- */

  if (error || !payroll) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {error || "Payslip not found"}
          </p>

          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ==================================================
          PAYSLIP MODAL OVERLAY
          Everything behind this becomes blurred.
      ================================================== */}

      <main
        className="
          fixed
          inset-0
          z-[9999]
          flex
          items-center
          justify-center
          bg-black/20
          backdrop-blur-md
          p-4
          sm:p-6
          lg:p-8

          print:static
          print:block
          print:bg-white
          print:backdrop-blur-none
          print:p-0
        "
      >
        {/* ==================================================
            CLOSE BUTTON
        ================================================== */}

        <button
          onClick={() => router.back()}
          aria-label="Close payslip"
          className="
            print:hidden
            absolute
            top-5
            right-6
            z-[10001]

            flex
            h-10
            w-10
            items-center
            justify-center

            rounded-full
            bg-white
            text-gray-700

            shadow-lg

            transition
            hover:bg-gray-100
            hover:text-black
          "
        >
          ✕
        </button>

        {/* ==================================================
            PAYSLIP
            This stays completely clear/sharp.
        ================================================== */}

        <div
          id="payslip"
          className="
            payslip-page

            relative
            z-[10000]

            w-full
            max-w-[900px]

            max-h-[calc(100vh-32px)]
            overflow-y-auto

            bg-white
            text-black

            rounded-xl
            shadow-2xl

            print:w-full
            print:max-w-none
            print:max-h-none
            print:overflow-visible
            print:rounded-none
            print:shadow-none
          "
        >
          {/* ==================================================
              COMPANY HEADER
          ================================================== */}

          <div className="px-10 pt-8 pb-5 border-b-2 border-black">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold tracking-wide">
                  {COMPANY_NAME}
                </h1>

                <p className="text-xs text-gray-600 mt-1">
                  {COMPANY_ADDRESS}
                </p>

                <p className="text-xs text-gray-600">
                  {COMPANY_EMAIL}
                </p>
              </div>

              <div className="text-right">
                <h2 className="text-xl font-bold uppercase">
                  Payslip
                </h2>

                <p className="text-sm font-medium mt-1">
                  {payroll.month_name}{" "}
                  {payroll.payroll_year}
                </p>
              </div>
            </div>
          </div>

          {/* ==================================================
              EMPLOYEE INFORMATION
          ================================================== */}

          <section className="px-10 py-5">
            <div className="border border-black">
              <div className="bg-gray-100 border-b border-black px-4 py-2">
                <h3 className="font-bold text-sm uppercase">
                  Employee Details
                </h3>
              </div>

              <div className="grid grid-cols-2">
                <InfoRow
                  label="Employee Code"
                  value={
                    employee?.employee_id ||
                    payroll.employee_id ||
                    "-"
                  }
                />

                <InfoRow
                  label="Employee Name"
                  value={employeeName}
                />

                <InfoRow
                  label="Department"
                  value={departmentName}
                />

                <InfoRow
                  label="Designation"
                  value={employee?.designation || "-"}
                />

                <InfoRow
                  label="Date of Hire"
                  value={formatDate(
                    employee?.joining_date ||
                      employee?.date_of_joining
                  )}
                />

                <InfoRow
                  label="Location"
                  value={
                    employee?.work_location ||
                    employee?.location ||
                    "-"
                  }
                />

                <InfoRow
                  label="Grade"
                  value={employee?.grade || "-"}
                />

                <InfoRow
                  label="Employment Type"
                  value={
                    employee?.employment_type || "-"
                  }
                />

                <InfoRow
                  label="PF Number"
                  value={employee?.pf_number || "-"}
                />

                <InfoRow
                  label="UAN"
                  value={employee?.uan_number || "-"}
                />

                <InfoRow
                  label="ESI Number"
                  value={employee?.esi_number || "-"}
                />

                <InfoRow
                  label="Payment Mode"
                  value={
                    employee?.payment_mode ||
                    "Bank Transfer"
                  }
                />

                <InfoRow
                  label="Bank Account"
                  value={
                    employee?.bank_account_number ||
                    employee?.account_number ||
                    "-"
                  }
                />

                <InfoRow
                  label="Bank Name"
                  value={employee?.bank_name || "-"}
                />
              </div>
            </div>
          </section>

          {/* ==================================================
              ATTENDANCE
          ================================================== */}

          <section className="px-10 pb-5">
            <div className="border border-black">
              <div className="bg-gray-100 border-b border-black px-4 py-2">
                <h3 className="font-bold text-sm uppercase">
                  Attendance & Payroll Information
                </h3>
              </div>

              <div className="grid grid-cols-5">
                <AttendanceCell
                  label="Standard Days"
                  value={payroll.working_days}
                />

                <AttendanceCell
                  label="Days Worked"
                  value={payroll.present_days}
                />

                <AttendanceCell
                  label="Paid Leave"
                  value={payroll.paid_leaves || 0}
                />

                <AttendanceCell
                  label="LWOP Days"
                  value={payroll.lop_days || 0}
                />

                <AttendanceCell
                  label="Payroll Month"
                  value={`${payroll.month_name} ${payroll.payroll_year}`}
                />
              </div>
            </div>
          </section>

          {/* ==================================================
              EARNINGS + DEDUCTIONS
          ================================================== */}

          <section className="px-10 pb-5">
            <div className="grid grid-cols-2 gap-0 border border-black">
              {/* ---------------- Earnings ---------------- */}

              <div className="border-r border-black">
                <div className="bg-gray-100 border-b border-black px-4 py-2">
                  <h3 className="font-bold text-sm uppercase">
                    Earnings
                  </h3>
                </div>

                <div className="grid grid-cols-[1fr_100px_100px] border-b border-black text-xs font-bold">
                  <div className="px-3 py-2 border-r border-black">
                    Component
                  </div>

                  <div className="px-3 py-2 border-r border-black text-right">
                    Current
                  </div>

                  <div className="px-3 py-2 text-right">
                    YTD
                  </div>
                </div>

                {earnings.length > 0 ? (
                  earnings.map((item) => (
                    <div
                      key={item.key}
                      className="
                        grid
                        grid-cols-[1fr_100px_100px]
                        border-b
                        border-gray-300
                        text-xs
                      "
                    >
                      <div className="px-3 py-2 border-r border-gray-300">
                        {item.name}
                      </div>

                      <div className="px-3 py-2 border-r border-gray-300 text-right">
                        {money(item.amount)}
                      </div>

                      <div className="px-3 py-2 text-right">
                        {money(item.ytd)}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyRow />
                )}

                <div className="grid grid-cols-[1fr_100px_100px] font-bold text-xs">
                  <div className="px-3 py-2 border-r border-black">
                    Gross Earnings
                  </div>

                  <div className="px-3 py-2 border-r border-black text-right">
                    {money(payroll.total_earnings)}
                  </div>

                  <div className="px-3 py-2 text-right">
                    {money(
                      earnings.reduce(
                        (sum, item) =>
                          sum + item.ytd,
                        0
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* ---------------- Deductions ---------------- */}

              <div>
                <div className="bg-gray-100 border-b border-black px-4 py-2">
                  <h3 className="font-bold text-sm uppercase">
                    Deductions
                  </h3>
                </div>

                <div className="grid grid-cols-[1fr_100px_100px] border-b border-black text-xs font-bold">
                  <div className="px-3 py-2 border-r border-black">
                    Component
                  </div>

                  <div className="px-3 py-2 border-r border-black text-right">
                    Current
                  </div>

                  <div className="px-3 py-2 text-right">
                    YTD
                  </div>
                </div>

                {deductions.length > 0 ? (
                  deductions.map((item) => (
                    <div
                      key={item.key}
                      className="
                        grid
                        grid-cols-[1fr_100px_100px]
                        border-b
                        border-gray-300
                        text-xs
                      "
                    >
                      <div className="px-3 py-2 border-r border-gray-300">
                        {item.name}
                      </div>

                      <div className="px-3 py-2 border-r border-gray-300 text-right">
                        {money(item.amount)}
                      </div>

                      <div className="px-3 py-2 text-right">
                        {money(item.ytd)}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyRow />
                )}

                <div className="grid grid-cols-[1fr_100px_100px] font-bold text-xs">
                  <div className="px-3 py-2 border-r border-black">
                    Gross Deductions
                  </div>

                  <div className="px-3 py-2 border-r border-black text-right">
                    {money(payroll.total_deductions)}
                  </div>

                  <div className="px-3 py-2 text-right">
                    {money(
                      deductions.reduce(
                        (sum, item) =>
                          sum + item.ytd,
                        0
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================
              LOP
          ================================================== */}

          <section className="px-10 pb-5">
            <div className="border border-black">
              <div className="grid grid-cols-3 text-sm">
                <div className="px-4 py-3 border-r border-black">
                  <span className="font-semibold">
                    LOP Days:
                  </span>{" "}
                  {payroll.lop_days || 0}
                </div>

                <div className="px-4 py-3 border-r border-black">
                  <span className="font-semibold">
                    LOP Deduction:
                  </span>{" "}
                  {money(payroll.lop_deduction)}
                </div>

                <div className="px-4 py-3">
                  <span className="font-semibold">
                    Status:
                  </span>{" "}
                  {titleCase(
                    payroll.payment_status ||
                      "processed"
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================
              NET PAY
          ================================================== */}

          <section className="px-10 pb-6">
            <div className="border-2 border-black">
              <div className="flex justify-between items-center px-5 py-4">
                <div>
                  <p className="text-xs uppercase font-semibold text-gray-600">
                    Net Pay
                  </p>

                  <p className="text-sm font-semibold mt-1">
                    {amountInWords(
                      numberValue(
                        payroll.net_salary
                      )
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase font-semibold text-gray-600">
                    Net Salary
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {money(payroll.net_salary)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================
              SUMMARY
          ================================================== */}

          <section className="px-10 pb-8">
            <div className="grid grid-cols-3 border border-black text-sm">
              <div className="px-4 py-3 border-r border-black">
                <p className="text-xs text-gray-600">
                  Total Earnings
                </p>

                <p className="font-bold mt-1">
                  {money(payroll.total_earnings)}
                </p>
              </div>

              <div className="px-4 py-3 border-r border-black">
                <p className="text-xs text-gray-600">
                  Total Deductions
                </p>

                <p className="font-bold mt-1">
                  {money(payroll.total_deductions)}
                </p>
              </div>

              <div className="px-4 py-3">
                <p className="text-xs text-gray-600">
                  Net Pay
                </p>

                <p className="font-bold mt-1">
                  {money(payroll.net_salary)}
                </p>
              </div>
            </div>
          </section>

          {/* ==================================================
              FOOTER
          ================================================== */}

          <div className="px-10 pb-8">
            <div className="border-t border-gray-300 pt-4 text-center">
              <p className="text-xs text-gray-500">
                This is a system-generated payslip and
                does not require a signature.
              </p>

              <p className="text-[10px] text-gray-400 mt-1">
                Generated on{" "}
                {new Date().toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ==================================================
          PRINT CSS
      ================================================== */}

      <style jsx global>{`
        @page {
          size: A4;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /*
            Hide everything except the payslip
            when printing.
          */
          body * {
            visibility: hidden !important;
          }

          #payslip,
          #payslip * {
            visibility: visible !important;
          }

          #payslip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;

            width: 100% !important;
            max-width: none !important;
            max-height: none !important;

            margin: 0 !important;
            padding: 0 !important;

            overflow: visible !important;

            background: white !important;

            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .payslip-page {
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;

            margin: 0 !important;

            overflow: visible !important;

            box-shadow: none !important;
          }

          /*
            Remove modal overlay effects during print.
          */
          main {
            position: static !important;
            display: block !important;

            background: white !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;

            padding: 0 !important;
            margin: 0 !important;
          }

          /*
            Keep colors when printing.
          */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
}

/* -------------------------------------------------------
   Small UI components
------------------------------------------------------- */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[130px_1fr] border-b border-r border-gray-300 text-xs min-h-[34px]">
      <div className="px-3 py-2 bg-gray-50 font-semibold border-r border-gray-300">
        {label}
      </div>

      <div className="px-3 py-2">
        {value}
      </div>
    </div>
  );
}

function AttendanceCell({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="px-3 py-3 border-r border-black last:border-r-0 text-center">
      <p className="text-[10px] text-gray-600 uppercase">
        {label}
      </p>

      <p className="font-bold text-sm mt-1">
        {value}
      </p>
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="grid grid-cols-[1fr_100px_100px] border-b border-gray-300 text-xs">
      <div className="px-3 py-2 border-r border-gray-300">
        -
      </div>

      <div className="px-3 py-2 border-r border-gray-300 text-right">
        ₹0.00
      </div>

      <div className="px-3 py-2 text-right">
        ₹0.00
      </div>
    </div>
  );
}

