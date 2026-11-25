import Image from "next/image";

export type PayslipItem = {
  key: string;
  label: string;
  amount: number;
};

export type StandardPayslipProps = {
  employee: {
    name: string;
    employeeCode: string;
    designation?: string;
    department?: string;
    bankName?: string;
    bankAccountNumber?: string;
    pan?: string;
    uan?: string;
    esiNumber?: string;
    joiningDate?: string;
    ifscCode?: string;
  };

  month: string;
  year: number;

  standardSalary: PayslipItem[];
  earnings: PayslipItem[];
  deductions: PayslipItem[];

  payDate?: string;
  amountInWords?: string;

  workingDays?: number;
  paidDays?: number;
  paidLeaves?: number;
  lopDays?: number;

  grossSalaryBeforeLOP: number;
  grossDeductions: number;
  netPay: number;

  remarks?: string;
};

const money = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function StandardPayslip({
  employee,
  month,
  year,
  standardSalary,
  earnings,
  deductions,
  payDate,
  amountInWords,
  workingDays = 0,
  paidDays = 0,
  paidLeaves = 0,
  lopDays = 0,
  grossSalaryBeforeLOP,
  grossDeductions,
  netPay,
  remarks,
}: StandardPayslipProps) {

  // Hide Other Deduction and Advance from payslip display only.
  // Original payroll calculations remain unchanged.
  const visibleDeductions = deductions.filter((item) => {
    const normalizedLabel = item.label.trim().toLowerCase();

    return ![
      "other deduction",
      "advance",
    ].includes(normalizedLabel);
  });

  // Find the maximum number of rows across all three columns.
  const salaryRowCount = Math.max(
    standardSalary.length,
    earnings.length,
    visibleDeductions.length
  );

  return (
    <div
      id="standard-payslip"
      className="mx-auto w-full max-w-[850px] bg-white p-4 text-slate-900 sm:p-6"
    >
      {/* Company Header */}
      <header className="flex flex-col justify-between gap-4 border-b-2 border-slate-800 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Teens Software Solutions LLP"
            width={100}
            height={65}
            className="h-14 w-auto object-contain"
            priority
          />

          <div>
            <h1 className="text-base font-bold sm:text-lg">
              Teens Software Solutions LLP
            </h1>

            <p className="text-xs text-slate-500">
              Employee Salary Statement
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <h2 className="text-xl font-extrabold tracking-wider">
            PAYSLIP
          </h2>

          <p className="text-sm font-semibold">
            {month} {year}
          </p>
        </div>
      </header>

      {/* Employee Details */}
      <section className="mt-4">
        <h3 className="mb-2 border-b border-slate-300 pb-1 text-sm font-bold">
          Employee Details
        </h3>

        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          <p>
            <strong>Employee Name:</strong> {employee.name || "-"}
          </p>

          <p>
            <strong>Employee ID:</strong> {employee.employeeCode || "-"}
          </p>

          <p>
            <strong>Designation:</strong> {employee.designation || "-"}
          </p>

          <p>
            <strong>Department:</strong> {employee.department || "-"}
          </p>

          <p>
            <strong>Date of Joining:</strong> {employee.joiningDate || "-"}
          </p>

          <p>
            <strong>Pay Date:</strong> {payDate || "-"}
          </p>

          <p>
            <strong>Bank:</strong> {employee.bankName || "-"}
          </p>

          <p>
            <strong>Account:</strong> {employee.bankAccountNumber || "-"}
          </p>

          <p>
            <strong>IFSC Code:</strong> {employee.ifscCode || "-"}
          </p>

          <p>
            <strong>PAN:</strong> {employee.pan || "-"}
          </p>

          <p>
            <strong>UAN:</strong> {employee.uan || "-"}
          </p>

          <p>
            <strong>ESI Number:</strong> {employee.esiNumber || "-"}
          </p>
        </div>
      </section>

      {/* Attendance Summary */}
      <section className="mt-5">
        <h3 className="mb-2 border-b border-slate-300 pb-1 text-sm font-bold">
          Attendance Summary
        </h3>

        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[
            { label: "Working Days", value: workingDays },
            { label: "Paid Days", value: paidDays },
            { label: "Paid Leaves", value: paidLeaves },
            { label: "LOP Days", value: lopDays },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-slate-300 p-2"
            >
              <p className="text-lg font-bold">
                {item.value}
              </p>

              <p className="text-[10px] text-slate-500">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Excel-Style Three-Column Salary Breakdown */}
      <section className="mt-5">
        <h3 className="mb-2 border-b border-slate-300 pb-1 text-sm font-bold">
          Salary Breakdown
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="bg-slate-200">
                <th className="w-1/3 border border-slate-400 px-2 py-2 text-left font-bold">
                  Standard Monthly Salary
                </th>

                <th className="w-1/3 border border-slate-400 px-2 py-2 text-left font-bold">
                  Earnings
                </th>

                <th className="w-1/3 border border-slate-400 px-2 py-2 text-left font-bold">
                  Deductions
                </th>
              </tr>
            </thead>

            <tbody>
              {Array.from({
                length: salaryRowCount,
              }).map((_, index) => {
                const columns = [
                  standardSalary[index],
                  earnings[index],
                  visibleDeductions[index],
                ];

                return (
                  <tr
                    key={index}
                    className="hover:bg-slate-50"
                  >
                    {columns.map((item, colIndex) => (
                      <td
                        key={colIndex}
                        className="border border-slate-300 px-2 py-2 align-top"
                      >
                        {item ? (
                          <div className="flex justify-between gap-2">
                            <span className="break-words text-slate-700">
                              {item.label}
                            </span>

                            <span className="shrink-0 text-right font-mono font-medium">
                              {money(item.amount)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">
                            -
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {salaryRowCount === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="border border-slate-300 px-3 py-4 text-center text-slate-400"
                  >
                    No salary breakdown available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Salary Totals */}
      <section className="mt-5 space-y-3 border border-slate-300 p-4">
        <div className="flex justify-between gap-3 text-sm">
          <span>Gross Earnings (Before Deductions)</span>

          <strong>
            {money(grossSalaryBeforeLOP)}
          </strong>
        </div>

        <div className="flex justify-between gap-3 text-sm">
          <span>Gross Deductions</span>

          <strong>
            {money(grossDeductions)}
          </strong>
        </div>

        <div className="flex justify-between gap-3 border-t border-slate-300 pt-3 text-lg font-extrabold">
          <span>Net Pay</span>

          <span>
            {money(netPay)}
          </span>
        </div>

        {amountInWords && (
          <p className="border-t border-slate-200 pt-2 text-xs text-slate-600">
            <strong>Amount in Words:</strong> {amountInWords}
          </p>
        )}
      </section>

      {/* Remarks */}
      {remarks && (
        <section className="mt-4 border border-slate-200 p-3 text-xs">
          <strong>Remarks:</strong> {remarks}
        </section>
      )}

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500">
        This is a system-generated payslip from Teens Software Solutions LLP.
      </footer>
    </div>
  );
}
