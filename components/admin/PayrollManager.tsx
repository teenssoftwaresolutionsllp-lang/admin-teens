 "use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Banknote, Settings, Play, CheckCircle2, Loader2, FileText, Eye,Building2,
  Sliders, XCircle, Printer, Users, CalendarDays, IndianRupee,BriefcaseBusiness,CircleCheck,
  TrendingDown, ShieldCheck, ChevronRight, Briefcase, CircleDollarSign,X,
  UserRound, User, Clock3, Info, Search, CreditCard, Pencil, Save
} from "lucide-react";
import Image from "next/image";
import { SalaryComponent, Payslip, Employee } from "@/lib/types";
import { numberToWordsIndian } from "@/lib/calculations";

interface PayrollManagerProps {
  initialComponents: SalaryComponent[];
  initialPayslips: Payslip[];
  employees: Employee[];
  role: "ceo" | "hr" | "employee";
}

type ActiveTab = "runner" | "components" | "slips";
type MessageState = { type: "success" | "error"; text: string } | null;

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const formatCurrency = (value: number | null | undefined) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatNumber = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function PayrollManager({
  initialComponents,
  initialPayslips,
  employees: initialEmployees,
  role,
}: PayrollManagerProps) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [employees] = useState<Employee[]>(initialEmployees);
  const [components, setComponents] = useState<SalaryComponent[]>(initialComponents);
  const [employeeComponents, setEmployeeComponents] = useState<SalaryComponent[]>([]);
  const [employeeComponentsLoading, setEmployeeComponentsLoading] = useState(false);
  const [payslips, setPayslips] = useState<Payslip[]>(initialPayslips);
  const [activeTab, setActiveTab] = useState<ActiveTab>("runner");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth === 1 ? 12 : currentMonth - 1);
  const [selectedYear, setSelectedYear] = useState(currentMonth === 1 ? currentYear - 1 : currentYear);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [running, setRunning] = useState(false);
  const [componentLoading, setComponentLoading] = useState<string | null>(null);
  const [editingComponent, setEditingComponent] = useState<SalaryComponent | null>(null);
  const [savingComponent, setSavingComponent] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [previewSlip, setPreviewSlip] = useState<Payslip | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [workingSaturdays, setWorkingSaturdays] = useState<number[]>([]);
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [calendarName, setCalendarName] = useState("Company Calendar");
  const [savingSaturday, setSavingSaturday] = useState<string | null>(null);

  const [additionalEarnings, setAdditionalEarnings] = useState<
    {
      type: "Incentive" | "Bonus" | "Compensation";
      amount: number;
    }[]>([]);
  type AdditionalEarningType = "" | "Incentive" | "Bonus" | "Compensation";
  const [additionalEarningType, setAdditionalEarningType] =  useState<AdditionalEarningType>("");
  const [additionalEarningAmount, setAdditionalEarningAmount] = useState("");

  const availableYears = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - index),
    [currentYear]
  );

  const activeEmployees = useMemo(
    () => employees.filter(employee => employee.status === "active"),
    [employees]
  );

  const selectedEmployeeData = useMemo(
    () => employees.find(employee => employee.id === selectedEmployee),
    [employees, selectedEmployee]
  );

  const loadEmployeeComponents = useCallback(async () => 
  {
    if (!selectedEmployee) {
      setEmployeeComponents([]);
      return;
    }

    setEmployeeComponentsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/payroll/employee-components?employeeId=${selectedEmployee}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load employee salary components");
      }
      setEmployeeComponents(data.components || []);
    } catch (error: any) {
      console.error("Failed to load employee salary components:", error);
      setEmployeeComponents([]);
      setMessage(error.message || "Failed to load salary components");
    } finally {
      setEmployeeComponentsLoading(false);
    }
  }, [selectedEmployee]);

  useEffect(() => {
    loadEmployeeComponents();
  }, [loadEmployeeComponents]);

  const selectedPeriod = selectedYear * 12 + selectedMonth;
  const currentPeriod = currentYear * 12 + currentMonth;
  const isFuturePeriod = selectedPeriod >= currentPeriod;

  const employeeJoiningPeriod = useMemo(() => {
    if (!selectedEmployeeData?.joining_date) return null;
    const joiningDate = String(selectedEmployeeData.joining_date).slice(0, 10);
    const [joiningYear, joiningMonth] = joiningDate.split("-").map(Number);
    if (
      !Number.isInteger(joiningYear) ||
      !Number.isInteger(joiningMonth) ||
      joiningMonth < 1 ||
      joiningMonth > 12
    ) return null;
    return joiningYear * 12 + joiningMonth;
  }, [selectedEmployeeData]);

  const formatAnnualCtc = (salaryInLakhs: number) => {
    if (salaryInLakhs >= 100) {
      return `${(salaryInLakhs / 100).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })} Crore`;
    }
    return `${salaryInLakhs.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })} Lakhs`;
  };



/* ========================================================= */
/* PAYSLIP HELPERS */
/* ========================================================= */

const formatPayslipCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value || 0);

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getPayslipEmployeeName = (employee: any) => {
  if (!employee) return "-";

  if (employee.name) return employee.name;

  return [employee.first_name, employee.middle_name, employee.last_name]
    .filter(Boolean)
    .join(" ") || "-";
};

const getPayslipEmployeeCode = (employee: any) => {
  return employee?.employee_id || employee?.code || "-";
};

const getPayslipBankName = (employee: any) => {
  return (
    employee?.bank_name ||
    employee?.bank ||
    employee?.bank_details?.bank_name ||
    "-"
  );
};

const getPayslipAccountNumber = (employee: any) => {
  return (
    employee?.bank_account_number ||
    employee?.account_number ||
    employee?.bank_account_no ||
    employee?.account_no ||
    employee?.bank_details?.account_number ||
    "-"
  );
};

const getPayslipIFSC = (employee: any) => {
  return (
    employee?.ifsc_code ||
    employee?.ifsc ||
    employee?.bank_ifsc ||
    employee?.bank_details?.ifsc_code ||
    "-"
  );
};

const getPayslipDate = (value: any) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};


/* ========================================================= */
/* AMOUNT TO WORDS */
/* ========================================================= */

const numberToWordsIndian = (num: number): string => {
  const value = Math.floor(Math.abs(Number(num) || 0));

  if (value === 0) return "Zero";

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

  const convertBelowThousand = (n: number): string => {
    let result = "";

    if (n >= 100) {
      result += `${ones[Math.floor(n / 100)]} Hundred`;
      n %= 100;

      if (n > 0) {
        result += " ";
      }
    }

    if (n >= 20) {
      result += tens[Math.floor(n / 10)];
      n %= 10;

      if (n > 0) {
        result += ` ${ones[n]}`;
      }
    } else if (n > 0) {
      result += ones[n];
    }

    return result;
  };

  let remaining = value;
  const parts: string[] = [];

  if (remaining >= 10000000) {
    const crore = Math.floor(remaining / 10000000);
    parts.push(`${convertBelowThousand(crore)} Crore`);
    remaining %= 10000000;
  }

  if (remaining >= 100000) {
    const lakh = Math.floor(remaining / 100000);
    parts.push(`${convertBelowThousand(lakh)} Lakh`);
    remaining %= 100000;
  }

  if (remaining >= 1000) {
    const thousand = Math.floor(remaining / 1000);
    parts.push(`${convertBelowThousand(thousand)} Thousand`);
    remaining %= 1000;
  }

  if (remaining > 0) {
    parts.push(convertBelowThousand(remaining));
  }

  return parts.join(" ");
};

const getAmountInWords = (amount: number) => {
  const roundedAmount = Math.round(Number(amount || 0));

  if (roundedAmount === 0) {
    return "Zero Rupees Only";
  }

  return `${numberToWordsIndian(roundedAmount)} Rupees Only`;
};


/* ========================================================= */
/* PAYSLIP INFO ROW */
/* ========================================================= */

function PayslipInfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-[11px] font-medium text-slate-500">
        {label}
      </label>

      <div className="flex min-h-[42px] w-full items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800">
        <span className="truncate">
          {value === null || value === undefined || value === ""
            ? "-"
            : String(value)}
        </span>
      </div>
    </div>
  );
}

/* ========================================================= */
/* PAYSLIP SUMMARY ITEM */
/* ========================================================= */

function PayslipSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-[11px] font-medium text-slate-500">
        {label}
      </label>

      <div className="flex min-h-[42px] w-full items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
        {value === null || value === undefined || value === ""
          ? "-"
          : String(value)}
      </div>
    </div>
  );
}

/* ========================================================= */
/* NORMALIZE SALARY BREAKUP */
/* ========================================================= */

const normalizePayslipBreakup = (breakup: any): any[] => {
  if (!breakup) return [];

  if (Array.isArray(breakup)) {
    return breakup;
  }

  if (typeof breakup === "object") {
    return Object.entries(breakup).map(([key, value]: [string, any]) => {
      if (value && typeof value === "object") {
        return {
          ...value,
          code: value.code || key,
          name:
            value.name ||
            value.component_name ||
            value.component ||
            key,
        };
      }

      return {
        code: key,
        name: key,
        amount: value,
      };
    });
  }

  return [];
};


/* ========================================================= */
/* BREAKUP ROW */
/* ========================================================= */

function PayslipBreakupRow({
  item,
}: {
  item: any;
}) {
  const name =
    item?.name ||
    item?.component_name ||
    item?.component ||
    item?.label ||
    item?.code ||
    "Salary Component";

  const code =
    item?.code ||
    "";

  const amount = Number(
    item?.amount ??
    item?.value ??
    0
  );

  return (
    <div className="flex min-h-[58px] items-center justify-between gap-5 border-b border-slate-100 py-3">

      {/* COMPONENT NAME */}

      <div className="min-w-0">

        <p className="text-xs font-medium text-slate-700">
          {name}
        </p>

        {code && (
          <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-slate-400">
            {code}
          </p>
        )}

      </div>


      {/* AMOUNT */}

      <div className="shrink-0">

        <span className="whitespace-nowrap text-sm font-semibold text-slate-800">
          {formatPayslipCurrency(amount)}
        </span>

      </div>

    </div>
  );
}
  const isBeforeJoiningPeriod = employeeJoiningPeriod !== null && selectedPeriod < employeeJoiningPeriod;

  const payrollPeriodValid = !isFuturePeriod && !isBeforeJoiningPeriod;

  const loadPayrollCalendar = useCallback(async () => {
    if (!selectedEmployee) {
      setWorkingSaturdays([]);
      setHolidayDates([]);
      setWorkingDays(0);
      setCalendarName("Company Calendar");
      return;
    }

    try {
      setCalendarLoading(true);
      const response = await fetch(
        `/api/payroll/calendar?employeeId=${encodeURIComponent(selectedEmployee)}&year=${selectedYear}&month=${selectedMonth}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load payroll calendar.");
      }

      setWorkingSaturdays(Array.isArray(data.workingSaturdays) ? data.workingSaturdays : []);
      setHolidayDates(Array.isArray(data.holidayDates) ? data.holidayDates : []);
      setWorkingDays(Number(data.workingDays || 0));
      setCalendarName(data.calendarName || "Company Calendar");
    } catch (error: any) {
      console.error("Payroll calendar error:", error);
      setWorkingSaturdays([]);
      setHolidayDates([]);
      setWorkingDays(0);
      setMessage({ type: "error", text: error?.message || "Failed to load payroll calendar." });
    } finally {
      setCalendarLoading(false);
    }
  }, [selectedEmployee, selectedMonth, selectedYear]);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!previewSlip) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = originalOverflow; };
  }, [previewSlip]);

  useEffect(() => {
    loadPayrollCalendar();
  }, [loadPayrollCalendar]);

  const filteredPayslips = useMemo(() => {
    return payslips.filter(slip => {
      if (slip.payroll_month !== selectedMonth || slip.payroll_year !== selectedYear) return false;
      if (!searchTerm.trim()) return true;
      const search = searchTerm.toLowerCase();
      const employee = slip.employee;
      return (
        employee?.first_name?.toLowerCase().includes(search) ||
        employee?.last_name?.toLowerCase().includes(search) ||
        employee?.employee_id?.toLowerCase().includes(search) ||
        employee?.email?.toLowerCase().includes(search)
      );
    });
  }, [payslips, selectedMonth, selectedYear, searchTerm]);

  const payrollMetrics = useMemo(() => {
    const periodSlips = payslips.filter(
      slip => slip.payroll_month === selectedMonth && slip.payroll_year === selectedYear
    );
    return {
      employeeCount: periodSlips.length,
      netPayout: periodSlips.reduce((sum, slip) => sum + Number(slip.net_salary || 0), 0),
      lopDeduction: periodSlips.reduce((sum, slip) => sum + Number(slip.lop_deduction || 0), 0),
      grossSalary: periodSlips.reduce((sum, slip) => sum + Number(slip.gross_salary || 0), 0),
      activeComponents: components.filter(component => component.is_active).length
    };
  }, [payslips, selectedMonth, selectedYear, components]);

  const handleToggleWorkingSaturday = async (date: string, enabled: boolean) => {
    try {
      setSavingSaturday(date);
      const response = await fetch("/api/payroll/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployee, date, enabled })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Failed to update working Saturday.");

      await loadPayrollCalendar();
      setMessage({
        type: "success",
        text: enabled ? `${date} marked as a working Saturday.` : `${date} changed back to a holiday.`
      });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to update working Saturday." });
    } finally {
      setSavingSaturday(null);
    }
  };


  const handleAddAdditionalEarning = () => {
    if (!additionalEarningType) {
      setMessage({
        type: "error",
        text: "Please select an earning type.",
      });

      return;
    }

    const amount = Number(additionalEarningAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage({
        type: "error",
        text: "Please enter a valid earning amount.",
      });

      return;
    }

    const alreadyAdded = additionalEarnings.some(
      (earning) => earning.type === additionalEarningType
    );

    if (alreadyAdded) {
      setMessage({
        type: "error",
        text: `${additionalEarningType} has already been added for this payroll.`,
      });

      return;
    }

    setAdditionalEarnings((previous) => [
      ...previous,
      {
        type: additionalEarningType,
        amount,
      },
    ]);

    setAdditionalEarningAmount("");

    setMessage({
      type: "success",
      text: `${additionalEarningType} added successfully.`,
    });
  };

  const handleRemoveAdditionalEarning = (type: "Incentive" | "Bonus" | "Compensation") => 
  {
    setAdditionalEarnings((previous) =>
      previous.filter((earning) => earning.type !== type)
    );
  };

  const handleRunPayroll = async () => {
    setMessage(null);

    if (!selectedEmployee) {
      setMessage({ type: "error", text: "Please select an employee before generating payroll." });
      return;
    }

    if (isFuturePeriod) {
      setMessage({
        type: "error",
        text: "Payroll can only be generated after the selected month has been completed."
      });
      return;
    }

    if (isBeforeJoiningPeriod) {
      setMessage({
        type: "error",
        text: "Payroll cannot be generated for a month before the employee's joining month."
      });
      return;
    }

    try {
      setRunning(true);
      const response = await fetch("/api/payroll/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          month: selectedMonth,
          year: selectedYear,
          additionalEarnings,
        })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Failed to generate payroll.");

      if (data.payslips?.length) {
        setPayslips(previous => {
          const generated = data.payslips as Payslip[];
          const withoutGenerated = previous.filter(
            existing => !generated.some(
              newSlip =>
                newSlip.employee_id === existing.employee_id &&
                newSlip.payroll_month === existing.payroll_month &&
                newSlip.payroll_year === existing.payroll_year
            )
          );
          return [...generated, ...withoutGenerated];
        });
      }

      setMessage({
        type: "success",
        text: `Payroll generated successfully for ${selectedEmployeeData?.first_name || "employee"}.`
      });
      setActiveTab("slips");
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Something went wrong while generating payroll."
      });
    } finally {
      setRunning(false);
    }
  };

  const handleToggleComponent = async (component: SalaryComponent) => {
    setMessage(null);
    setComponentLoading(component.id);

    try {
      if (!component.employee_component_id) {
        throw new Error("Employee salary component ID is missing.");
      }

      const response = await fetch("/api/payroll/employee-components", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: component.employee_component_id,
          is_active: !component.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update employee salary component."
        );
      }

      setEmployeeComponents((previous) =>
        previous.map((item) =>
          item.id === component.id
            ? {
                ...item,
                is_active: !component.is_active,
              }
            : item
        )
      );

      setMessage({
        type: "success",
        text: `${component.name} has been ${
          component.is_active ? "disabled" : "enabled"
        }.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Failed to update employee salary component.",
      });
    } finally {
      setComponentLoading(null);
    }
  };

  const handleSaveComponent = async () => {
    if (!editingComponent) return;
    setSavingComponent(true);
    setMessage(null);
    try {
      if (!editingComponent.employee_component_id) {
        throw new Error("Employee salary component ID is missing.");
      }
      const numericValue = Number(editingComponent.value);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        throw new Error("Value must be a valid non-negative number.");
      }
      const response = await fetch(
        "/api/payroll/employee-components",
        {
          method: "PATCH",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            id: editingComponent.employee_component_id,
            calculation_type: editingComponent.calculation_type,
            value: numericValue,
            is_active: editingComponent.is_active,
            affects_lop: editingComponent.affects_lop,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ||"Failed to update employee salary component.");
      }

      setEmployeeComponents((previous) =>
        previous.map((item) => item.id === editingComponent.id ? 
        {
            ...item,
            calculation_type:editingComponent.calculation_type,
            value: numericValue,
          }: item
        )
      );

      setEditingComponent(null);

      setMessage({
        type: "success",
        text: `${editingComponent.name} updated successfully.`,
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Failed to update employee salary component.",
      });
    } finally {
      setSavingComponent(false);
    }
  };

  const handleViewPayslip = async (slip: Payslip) => {
  try {
    const response = await fetch(`/api/payroll/${slip.id}`);

    if (!response.ok) {
      throw new Error("Failed to load payslip");
    }

    const data = await response.json();

    setPreviewSlip(data.payslip || data);
  } catch (error) {
    console.error("Failed to load payslip:", error);

    setPreviewSlip(slip);
  }
  };


  const handlePrintPayslip = () => window.print();

  const tabs = [
    { id: "runner" as ActiveTab, label: "Payroll Runner", description: "Generate monthly payroll", icon: Play },
    { id: "components" as ActiveTab, label: "Salary Components", description: "Configure salary heads", icon: Sliders },
    { id: "slips" as ActiveTab, label: "Payslips", description: "View generated payroll", icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-indigo-600">
                <Banknote className="h-4 w-4" />
                Payroll Management
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payroll</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Manage salary components, generate payroll and review employee payslips.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Current Period</p>
                <p className="text-xs font-semibold text-slate-700">{monthNames[currentMonth - 1]} {currentYear}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-5 py-4">
        {isMounted && message && createPortal(
          <div className={`fixed left-1/2 top-3 z-[9999] flex w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 items-start gap-2 rounded-lg border px-3 py-2.5 shadow-xl ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            {message.type === "success"
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div className="flex-1">
              <p className="text-xs font-semibold">{message.type === "success" ? "Success" : "Unable to continue"}</p>
              <p className="text-xs">{message.text}</p>
            </div>
            <button onClick={() => setMessage(null)} className="rounded p-1 hover:bg-black/5">
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>,
          document.body
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CircleDollarSign} label="Net Monthly Payout" value={formatCurrency(payrollMetrics.netPayout)} helper={`${payrollMetrics.employeeCount} payslip${payrollMetrics.employeeCount === 1 ? "" : "s"} generated`} />
          <MetricCard icon={TrendingDown} label="LOP Deductions" value={formatCurrency(payrollMetrics.lopDeduction)} helper="Loss of pay deduction" />
          <MetricCard icon={Users} label="Employees Processed" value={String(payrollMetrics.employeeCount)} helper={`of ${activeEmployees.length} active employees`} />
          <MetricCard icon={Settings} label="Active Salary Heads" value={String(payrollMetrics.activeComponents)} helper={`of ${activeEmployees.length} configured`} />
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              if (tab.id === "components" && role !== "hr") {
                return null;
              }
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition ${active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-white/15" : "bg-slate-100"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{tab.label}</p>
                    <p className={`text-[10px] ${active ? "text-indigo-100" : "text-slate-400"}`}>{tab.description}</p>
                  </div>
                  {active && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "runner" && (
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
                      <Play className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Run Payroll</h2>
                      <p className="text-xs text-slate-500">Generate a payslip for an employee.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Payroll Ready
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">Employee</label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={selectedEmployee}
                        onChange={event => setSelectedEmployee(event.target.value)}
                        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                      >
                        <option value="">Select an employee</option>
                        {activeEmployees.map(employee => (
                          <option key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name} — {employee.employee_id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <FieldSelect
                    label="Payroll Month"
                    icon={CalendarDays}
                    value={selectedMonth}
                    onChange={value => setSelectedMonth(Number(value))}
                  >
                    {monthNames.map((month, index) => {
                      const monthNumber = index + 1;
                      const unavailable =
                        selectedYear > currentYear ||
                        (selectedYear === currentYear && monthNumber >= currentMonth);
                      return (
                        <option key={month} value={monthNumber} disabled={unavailable}>
                          {month}{unavailable ? " — Not Completed" : ""}
                        </option>
                      );
                    })}
                  </FieldSelect>

                  <FieldSelect
                    label="Payroll Year"
                    icon={Clock3}
                    value={selectedYear}
                    onChange={value => {
                      const year = Number(value);
                      if (year === currentYear && currentMonth === 1) {
                        setSelectedYear(currentYear - 1);
                        setSelectedMonth(12);
                        return;
                      }
                      setSelectedYear(year);
                      if (year === currentYear && selectedMonth >= currentMonth) {
                        setSelectedMonth(currentMonth === 1 ? 12 : currentMonth - 1);
                      }
                    }}
                  >
                    {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                  </FieldSelect>

                  <div className="flex items-end">
                    <div className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-50 px-3">
                      <CalendarDays className="h-4 w-4 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-700">
                        {monthNames[selectedMonth - 1]} {selectedYear}
                      </span>
                    </div>
                  </div>
                </div>

                {isFuturePeriod && (
                  <WarningBox
                    color="amber"
                    title="Payroll period is not completed"
                    text="Payroll can only be generated after the selected month has been completed."
                  />
                )}

                {isBeforeJoiningPeriod && (
                  <WarningBox
                    color="red"
                    title="Payroll is before joining date"
                    text={`This employee joined on ${selectedEmployeeData?.joining_date ? new Date(`${String(selectedEmployeeData.joining_date).slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN") : "-"}. Payroll cannot be generated for an earlier month.`}
                  />
                )}

                {selectedEmployeeData && (
                  <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                          {selectedEmployeeData.first_name?.charAt(0)}
                          {selectedEmployeeData.last_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {selectedEmployeeData.first_name} {selectedEmployeeData.last_name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                            <span>{selectedEmployeeData.employee_id}</span>
                            <span>•</span>
                            <span>{selectedEmployeeData.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                        <IndianRupee className="h-4 w-4 text-indigo-600" />
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Annual CTC</p>
                          <p className="text-xs font-bold text-slate-800">{formatNumber(Number(selectedEmployeeData.salary || 0))} Lakh</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEmployeeData && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                          <CalendarDays className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{calendarName}</p>
                          <p className="text-[10px] text-slate-500">{monthNames[selectedMonth - 1]} {selectedYear}</p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-1.5">
                        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-400">Working Days</p>
                        <p className="text-xs font-bold text-slate-900">{calendarLoading ? "..." : workingDays}</p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className="mb-1.5 text-[10px] font-semibold text-slate-600">Saturday Schedule</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {Array.from(
                          { length: new Date(selectedYear, selectedMonth, 0).getDate() },
                          (_, index) => index + 1
                        )
                          .filter(day => new Date(selectedYear, selectedMonth - 1, day).getDay() === 6)
                          .map(day => {
                            const date = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const enabled = workingSaturdays.includes(day);
                            return (
                              <label key={date} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-800">Saturday {day}</p>
                                  <p className="text-[9px] text-slate-400">
                                    {enabled ? "Working Day" : holidayDates.includes(date) ? "Holiday" : "Weekly Off"}
                                  </p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  disabled={calendarLoading || savingSaturday === date || !payrollPeriodValid}
                                  onChange={event => handleToggleWorkingSaturday(date, event.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* ADDITIONAL EARNINGS */}
                {/* ========================================================= */}

                {selectedEmployeeData && (
                  <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">

                    <div className="flex items-center gap-2">

                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                        <IndianRupee className="h-4 w-4 text-indigo-600" />
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Additional Earnings
                        </p>

                        <p className="text-[10px] text-slate-500">
                          Add incentive, bonus or compensation to this month's payslip.
                        </p>
                      </div>

                    </div>


                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">

                      {/* TYPE */}

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Earning Type
                        </label>

                        <select
                          value={additionalEarningType}
                          onChange={(event) =>
                            setAdditionalEarningType(
event.target.value as AdditionalEarningType)
                          }
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                        >
                          <option value="">
                            Select earning type
                          </option>

                          <option value="Incentive">
                            Incentive
                          </option>

                          <option value="Bonus">
                            Bonus
                          </option>

                          <option value="Compensation">
                            Compensation
                          </option>
                        </select>
                      </div>


                      {/* AMOUNT */}

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                          Amount
                        </label>

                        <div className="relative">

                          <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={additionalEarningAmount}
                            onChange={(event) =>
                              setAdditionalEarningAmount(event.target.value)
                            }
                            placeholder="Enter amount"
                            disabled={!additionalEarningType}
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                          />

                        </div>

                        {/* ADD BUTTON */}
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={handleAddAdditionalEarning}
                            className="h-10 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                            disabled={!additionalEarningType || !additionalEarningAmount}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>


                    <p className="mt-2 text-[10px] text-slate-500">
                      Each earning type can be added only once for the selected employee
                      and payroll month.
                    </p>

                  </div>
                )}

                {additionalEarnings.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {additionalEarnings.map((earning) => (
                      <div
                        key={earning.type}
                        className="flex items-center justify-between rounded-lg border border-indigo-100 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {earning.type}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Additional earning
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-900">
                            ₹{Number(earning.amount).toLocaleString("en-IN")}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveAdditionalEarning(earning.type)
                            }
                            className="text-xs font-semibold text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Ready to process?</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">The generated payslip will be saved for the selected employee and period.</p>
                  </div>
                  <button
                    onClick={handleRunPayroll}
                    disabled={running || !selectedEmployee || !payrollPeriodValid}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {running ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : <><Play className="h-4 w-4" />Generate Payroll</>}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Payroll Controls</h3>
                    <p className="text-[10px] text-slate-500">Automated checks</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <ControlItem label="Active employee" enabled={Boolean(selectedEmployeeData)} />
                  <ControlItem label="Valid payroll period" enabled={payrollPeriodValid} />
                  <ControlItem label="Salary components" enabled={payrollMetrics.activeComponents > 0} />
                  <ControlItem label="Payroll calculation" enabled />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <h3 className="text-xs font-bold">Payroll Processing</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Payroll uses annual CTC, active salary components, attendance and applicable LOP deductions.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "components" && role === "hr" && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">

            {/* ========================================================= */}
            {/* SALARY COMPONENTS HEADER */}
            {/* ========================================================= */}
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Salary Components
                  </h2>

                  <p className="text-xs text-slate-500">
                    Configure salary heads used during payroll calculation.
                  </p>
                </div>
              </div>

              <div className="w-fit rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                {employeeComponents.filter((item) => item.is_active).length} active
              </div>
            </div>

            {/* ========================================================= */}
            {/* SELECTED EMPLOYEE PROFILE */}
            {/* ========================================================= */}
            {selectedEmployee &&
              (() => {
                const employee = activeEmployees.find(
                  (item) => item.id === selectedEmployee
                );

                if (!employee) return null;

                const initials =
                  `${employee.first_name?.charAt(0) || ""}${
                    employee.last_name?.charAt(0) || ""
                  }`.toUpperCase();

                const department =
                  (employee as any).department?.name ||
                  (employee as any).department_name ||
                  (employee as any).department ||
                  "—";

                const employmentType =
                  (employee as any).employment_type ||
                  (employee as any).employmentType ||
                  "—";

                return (
                  <div className="border-b border-slate-100 bg-white px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">

                      {/* ================================================= */}
                      {/* EMPLOYEE IDENTITY */}
                      {/* ================================================= */}
                      <div className="flex min-w-0 items-center gap-3">

                        {/* Profile */}
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                          {initials || "E"}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {employee.first_name} {employee.last_name}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">
                              {employee.employee_id}
                            </span>

                            {employee.designation && (
                              <span className="text-[11px] text-slate-500">
                                {employee.designation}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ================================================= */}
                      {/* EMPLOYEE DETAILS */}
                      {/* ================================================= */}
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:min-w-[600px] lg:grid-cols-3">

                        {/* Department */}
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400">
                              Department
                            </p>

                            <p className="truncate text-[11px] font-semibold text-slate-700">
                              {department}
                            </p>
                          </div>
                        </div>

                        {/* Employment */}
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50">
                            <BriefcaseBusiness className="h-3.5 w-3.5 text-slate-500" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400">
                              Employment
                            </p>

                            <p className="truncate text-[11px] font-semibold capitalize text-slate-700">
                              {employmentType}
                            </p>
                          </div>
                        </div>

                        {/* Annual CTC */}
                        <div className="flex items-start gap-2  bg-white rounded">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white">
                            <IndianRupee className="h-3.5 w-3.5 text-indigo-600" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-400">
                              Annual CTC
                            </p>

                            <p className="truncate text-[11px] font-bold text-slate-800">
                              {formatAnnualCtc(Number(activeEmployees.find((item) => item.id === selectedEmployee)?.salary || 0))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* ========================================================= */}
            {/* SALARY COMPONENT CONTENT */}
            {/* ========================================================= */}
            {!selectedEmployee ? (
              <EmptyState
                icon={Sliders}
                title="Select an employee"
                description="Select an employee from the Payroll Runner tab to view their salary components."
              />
            ) : employeeComponentsLoading ? (
              <div className="px-5 py-10 text-center text-xs text-slate-500">
                Loading salary components...
              </div>
            ) : employeeComponents.length === 0 ? (
              <EmptyState
                icon={Sliders}
                title="No salary components"
                description="Salary components will appear here once configured."
              />
            ) : (
              <div className="overflow-x-auto">

                {/* ======================================================= */}
                {/* SALARY COMPONENTS TABLE */}
                {/* ======================================================= */}
                <table className="w-full min-w-[1050px] table-fixed">

                  <colgroup>
                    <col className="w-[270px]" />
                    <col className="w-[120px]" />
                    <col className="w-[110px]" />
                    <col className="w-[140px]" />
                    <col className="w-[120px]" />
                    <col className="w-[120px]" />
                    <col className="w-[140px]" />
                    <col className="w-[220px]" />
                  </colgroup>

                  {/* ===================================================== */}
                  {/* TABLE HEADER */}
                  {/* ===================================================== */}
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      {[
                        "Salary Head",
                        "Code",
                        "Type",
                        "Calculation",
                        "Value",
                        "LOP Impact",
                        "Annual CTC",
                        "Action",
                      ].map((head) => (
                        <th
                          key={head}
                          className={`px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
                            head === "Value" ||
                            head === "LOP Impact" ||
                            head === "Annual CTC" ||
                            head === "Action"
                              ? "text-center"
                              : ""
                          }`}
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* ===================================================== */}
                  {/* TABLE BODY */}
                  {/* ===================================================== */}
                  <tbody className="divide-y divide-slate-100">

                    {employeeComponents.map((component) => (

                      <tr
                        key={component.id}
                        className="transition-colors hover:bg-slate-50/60"
                      >

                        {/* ================================================= */}
                        {/* SALARY HEAD */}
                        {/* ================================================= */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                              <Banknote className="h-4 w-4 text-slate-600" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800">
                                {component.name}
                              </p>

                              {component.description && (
                                <p className="max-w-[220px] truncate text-[10px] text-slate-400">
                                  {component.description}
                                </p>
                              )}
                            </div>

                          </div>
                        </td>

                        {/* ================================================= */}
                        {/* CODE */}
                        {/* ================================================= */}
                        <td className="px-5 py-3">
                          <span className="inline-flex max-w-[110px] truncate rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600">
                            {component.code}
                          </span>
                        </td>

                        {/* ================================================= */}
                        {/* TYPE */}
                        {/* ================================================= */}
                        <td className="px-5 py-3">
                          <span className="text-xs font-medium text-slate-600">
                            {component.type.charAt(0).toUpperCase() +
                              component.type.slice(1)}
                          </span>
                        </td>

                        {/* ================================================= */}
                        {/* CALCULATION */}
                        {/* ================================================= */}
                        <td className="px-5 py-3">
                          <span className="whitespace-nowrap text-xs text-slate-600">
                            {component.calculation_type ===
                            "percentage_of_basic"
                              ? "% of Basic"
                              : component.calculation_type ===
                                "percentage_of_gross"
                                ? "% of Gross"
                                : "Fixed"}
                          </span>
                        </td>

                        {/* ================================================= */}
                        {/* VALUE */}
                        {/* ================================================= */}
                        <td className="px-5 py-3 text-center">
                          <span className="whitespace-nowrap text-xs font-bold text-slate-800">
                            {component.calculation_type === "fixed"
                              ? formatCurrency(component.value)
                              : `${formatNumber(component.value)}%`}
                          </span>
                        </td>

                        {/* ================================================= */}
                        {/* LOP IMPACT */}
                        {/* ================================================= */}
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`inline-flex min-w-[38px] justify-center rounded-full px-2 py-1 text-[10px] font-semibold ${
                              component.affects_lop
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {component.affects_lop ? "Yes" : "No"}
                          </span>
                        </td>

                        {/* ================================================= */}
                        {/* ANNUAL CTC */}
                        {/* ================================================= */}
                        <td className="px-5 py-3 text-center">
                          <span className="whitespace-nowrap text-xs font-bold text-slate-800">
                            {formatCurrency(Number(activeEmployees.find((item) => item.id === selectedEmployee)?.salary || 0) * 100000)}
                          </span>
                        </td>

                        {/* ================================================= */}
                        {/* ACTION */}
                        {/* ================================================= */}
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() =>
                                setEditingComponent({
                                  ...component,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>

                            {/* Enable / Disable */}
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleComponent(component)
                              }
                              disabled={
                                componentLoading === component.id
                              }
                              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                                component.is_active
                                  ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  : "bg-indigo-600 text-white hover:bg-indigo-700"
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {componentLoading === component.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : component.is_active ? (
                                "Disable"
                              ) : (
                                "Enable"
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "slips" && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
                  <FileText className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Generated Payslips</h2>
                  <p className="text-xs text-slate-500">{monthNames[selectedMonth - 1]} {selectedYear}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-indigo-500 sm:w-56"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold ${showFilters ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />Period
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <div className="grid grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-2">
                  <FieldSelect
                    label="Month"
                    value={selectedMonth}
                    onChange={value => setSelectedMonth(Number(value))}
                  >
                    {monthNames.map((month, index) => {
                      const monthNumber = index + 1;
                      const unavailable =
                        selectedYear > currentYear ||
                        (selectedYear === currentYear && monthNumber >= currentMonth);
                      return (
                        <option key={month} value={monthNumber} disabled={unavailable}>
                          {month}{unavailable ? " — Not Completed" : ""}
                        </option>
                      );
                    })}
                  </FieldSelect>

                  <FieldSelect
                    label="Year"
                    value={selectedYear}
                    onChange={value => {
                      const year = Number(value);
                      if (year === currentYear && currentMonth === 1) {
                        setSelectedYear(currentYear - 1);
                        setSelectedMonth(12);
                        return;
                      }
                      setSelectedYear(year);
                      if (year === currentYear && selectedMonth >= currentMonth) {
                        setSelectedMonth(currentMonth === 1 ? 12 : currentMonth - 1);
                      }
                    }}
                  >
                    {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                  </FieldSelect>
                </div>
              </div>
            )}

            {filteredPayslips.length === 0 ? (
              <EmptyState icon={FileText} title="No payslips found" description={`There are no generated payslips for ${monthNames[selectedMonth - 1]} ${selectedYear}.`} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      {["Employee","Pay Period","Gross Salary","LOP","LOP Deduction","Deductions","Net Salary","Action"].map(head => (
                        <th key={head} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayslips.map(slip => {
                      const employee = slip.employee;
                      return (
                        <tr key={slip.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                                {employee?.first_name?.charAt(0)}{employee?.last_name?.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">{employee?.first_name} {employee?.last_name}</p>
                                <p className="text-[10px] text-slate-400">{employee?.employee_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3"><span className="text-xs font-medium text-slate-700">{slip.month_name} {slip.payroll_year}</span></td>
                          <td className="px-5 py-3 text-right text-xs font-semibold text-slate-700">{formatCurrency(slip.gross_salary)}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${Number(slip.lop_days || 0) > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                              {formatNumber(slip.lop_days)} days
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-red-600">-{formatCurrency(slip.lop_deduction)}</td>
                          <td className="px-5 py-3 text-right text-xs text-slate-600">{formatCurrency(slip.total_deductions)}</td>
                          <td className="px-5 py-3 text-right text-xs font-bold text-slate-900">{formatCurrency(slip.net_salary)}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => handleViewPayslip(slip)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              <Eye className="h-3 w-3" />View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {isMounted && previewSlip && createPortal(
        <div className="fixed inset-0 z-[9999]">
          {/* BACKDROP */}
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl"
            onClick={() => setPreviewSlip(null)}
          />

          {/* MODAL */}
          <div className="relative z-10 flex h-[100dvh] items-center justify-center p-3 sm:p-5">
            <div className="flex h-[calc(100dvh-24px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[calc(100dvh-40px)]">
              {/* ===================================================== */}
              {/* MODAL HEADER */}
              {/* ===================================================== */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Payslip
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {monthNames[selectedMonth - 1]} {selectedYear}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                  <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSlip(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  </div>
              </div>


              {/* ===================================================== */}
              {/* PAYSLIP CONTENT */}
              {/* ===================================================== */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
                <div
                  id="payslip-print"
                  className="mx-auto my-4 w-full max-w-5xl bg-white shadow-sm print:my-0 print:max-w-none print:shadow-none"
                >
                  {/* ================================================= */}
                  {/* TOP HEADER */}
                  {/* ================================================= */}

                  <div className="grid grid-cols-1 border-b border-slate-200 md:grid-cols-2">
                    {/* COMPANY */}
                    <div className="border-b border-slate-200 px-7 py-6 md:border-b-0 md:border-r">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <img
                            src="/logo.png"
                            alt="Teens Software Solutions LLP"
                            className="h-full w-full object-contain p-2"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">
                            Company
                          </p>
                          <h1 className="mt-1 text-base font-bold text-slate-900">
                            Teens Software Solutions LLP
                          </h1>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Professional Payroll System
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* PAYSLIP MONTH */}
                      <div className="px-7 py-6">

                        <div className="flex items-start justify-between gap-5">

                          <div>

                            <p className="text-xs text-slate-500">
                              Payslip for Month
                            </p>

                            <div className="mt-3 flex min-h-[42px] items-center rounded-md border border-slate-300 bg-white px-3">

                              <span className="text-sm font-semibold text-slate-800">
                                {monthNames[selectedMonth - 1]} {selectedYear}
                              </span>

                            </div>

                          </div>

                          <div className="text-right">

                            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Salary Statement
                            </p>

                            <p className="mt-1 text-xl font-bold text-slate-800">
                              PAYSLIP
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {monthNames[selectedMonth - 1]} {selectedYear}
                            </p>

                          </div>

                        </div>

                      </div>

                    </div>


                    {/* ================================================= */}
                    {/* COMPANY DETAILS */}
                    {/* ================================================= */}

                    <div className="border-b border-slate-200 px-7 py-6">

                      <div className="mb-5">

                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                          Company Details
                        </h2>

                        <div className="mt-2 h-px bg-slate-200" />

                      </div>

                      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">

                        <PayslipInfoRow
                          label="Company Name"
                          value="Teens Software Solutions LLP"
                        />

                        <PayslipInfoRow
                          label="Email"
                          value="info@teenss.com"
                        />

                        <div className="md:col-span-2">

                          <PayslipInfoRow
                            label="Company Address"
                            value="Plot No. 1, 2nd Floor, Road No. 12, Banjara Hills"
                          />

                        </div>

                        <PayslipInfoRow
                          label="City"
                          value="Hyderabad, Telangana, India"
                        />

                        <PayslipInfoRow
                          label="Pincode"
                          value="500037"
                        />

                      </div>

                    </div>


                    {/* ================================================= */}
                    {/* EMPLOYEE PAY SUMMARY */}
                    {/* ================================================= */}

                    <div className="border-b border-slate-200 px-7 py-6">

                      <div className="mb-5">

                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                          Employee Pay Summary
                        </h2>

                        <div className="mt-2 h-px bg-slate-200" />

                      </div>

                      {/* EMPLOYEE INFORMATION */}

                      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">

                        <PayslipInfoRow
                          label="Employee Name"
                          value={getPayslipEmployeeName(
                            previewSlip.employee
                          )}
                        />

                        <PayslipInfoRow
                          label="Employee ID"
                          value={getPayslipEmployeeCode(
                            previewSlip.employee
                          )}
                        />

                        <PayslipInfoRow
                          label="Date of Joining"
                          value={getPayslipDate(
                            previewSlip.employee?.joining_date
                          )}
                        />

                        <PayslipInfoRow
                          label="Designation"
                          value={
                            previewSlip.employee?.designation || "-"
                          }
                        />

                        <PayslipInfoRow
                          label="Department"
                          value={
                            typeof previewSlip.employee?.department === "object"
                              ? previewSlip.employee.department?.name || "-"
                              : previewSlip.employee?.department || "-"
                          }
                        />

                        <PayslipInfoRow
                          label="Pay Date"
                          value={getPayslipDate(
                            previewSlip.created_at
                          )}
                        />

                      </div>


                      {/* PAY SUMMARY */}

                      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">

                        <PayslipSummaryItem
                          label="Paid Days"
                          value={previewSlip.present_days ?? 0}
                        />

                        <PayslipSummaryItem
                          label="Loss of Pay Days"
                          value={previewSlip.lop_days ?? 0}
                        />

                        <PayslipSummaryItem
                          label="Paid Leave"
                          value={previewSlip.paid_leaves ?? 0}
                        />

                      </div>

                    </div>


                    {/* ================================================= */}
                    {/* BANK + STATUTORY DETAILS */}
                    {/* ================================================= */}

                    <div className="border-b border-slate-200 px-7 py-6">

                      <div className="mb-5">

                        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                          Bank Details
                        </h2>

                        <div className="mt-2 h-px bg-slate-200" />

                      </div>

                      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">

                        <PayslipInfoRow
                          label="Bank Name"
                          value={getPayslipBankName(
                            previewSlip.employee
                          )}
                        />

                        <PayslipInfoRow
                          label="Account Number"
                          value={getPayslipAccountNumber(
                            previewSlip.employee
                          )}
                        />

                        <PayslipInfoRow
                          label="IFSC Code"
                          value={getPayslipIFSC(
                            previewSlip.employee
                          )}
                        />

                        <PayslipInfoRow
                          label="PF Number"
                          value={
                            previewSlip.employee?.uan_number || "-"
                          }
                        />

                        <PayslipInfoRow
                          label="ESI Number"
                          value={
                            previewSlip.employee?.esi_number || "-"
                          }
                        />

                        <PayslipInfoRow
                          label="PAN NUMBER"
                          value={
                            previewSlip.employee?.pan_number || "-"
                          }
                        />

                      </div>

                    </div>


                  {/* ================================================= */}
                  {/* INCOME DETAILS */}
                  {/* ================================================= */}

                  <div className="border-b border-slate-200 px-7 py-6">

                    <div className="mb-5">
                      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                        Income Details
                      </h2>

                      <div className="mt-2 h-px bg-slate-200" />
                    </div>

                    {(() => {
                      const earnings = normalizePayslipBreakup(
                        previewSlip.earnings_breakup
                      );

                      const deductions = normalizePayslipBreakup(
                        previewSlip.deductions_breakup
                      );

                      return (
                        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">

                          {/* ================================================= */}
                          {/* EARNINGS */}
                          {/* ================================================= */}

                          <div>

                            {/* HEADER */}

                            <div className="mb-2 flex items-center justify-between border-b border-slate-300 pb-2">

                              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                                Earnings
                              </h3>

                              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                Amount
                              </span>

                            </div>


                            {/* EARNING ROWS */}

                            <div>

                              {earnings.length > 0 ? (
                                earnings.map(
                                  (
                                    item: any,
                                    index: number
                                  ) => (
                                    <PayslipBreakupRow
                                      key={`${item?.id || item?.code || "earning"}-${index}`}
                                      item={item}
                                    />
                                  )
                                )
                              ) : (
                                <div className="py-5 text-center text-xs text-slate-400">
                                  No earnings available
                                </div>
                              )}


                              {/* GROSS EARNINGS */}

                              <div className="mt-2 flex min-h-[52px] items-center justify-between gap-4 rounded-md bg-red-50 px-4 py-3">

                                <span className="text-xs font-bold text-red-800">
                                  Gross Earnings
                                </span>

                                <span className="whitespace-nowrap text-sm font-bold text-red-900">
                                  {formatPayslipCurrency(
                                    previewSlip.gross_salary || 0
                                  )}
                                </span>

                              </div>

                            </div>

                          </div>


                          {/* ================================================= */}
                          {/* DEDUCTIONS */}
                          {/* ================================================= */}

                          <div>

                            {/* HEADER */}

                            <div className="mb-2 flex items-center justify-between border-b border-slate-300 pb-2">

                              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                                Deductions
                              </h3>

                              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                Amount
                              </span>

                            </div>


                            {/* DEDUCTION ROWS */}

                            <div>

                              {deductions.length > 0 ? (
                                deductions.map(
                                  (
                                    item: any,
                                    index: number
                                  ) => (
                                    <PayslipBreakupRow
                                     key={`${item?.id || item?.code || "deduction"}-${index}`}
                                     item={item}
                                    />
                                  )
                                )
                              ) : (
                                <div className="py-5 text-center text-xs text-slate-400">
                                  No deductions available
                                </div>
                              )}


                              {/* TOTAL DEDUCTIONS */}

                              <div className="mt-2 flex min-h-[52px] items-center justify-between gap-4 rounded-md bg-green-50 px-4 py-3">

                                <span className="text-xs font-bold text-green-800">
                                  Total Deductions
                                </span>

                                <span className="whitespace-nowrap text-sm font-bold text-green-900">
                                  {formatPayslipCurrency(
                                    previewSlip.total_deductions || 0
                                  )}
                                </span>

                              </div>

                            </div>

                          </div>

                        </div>
                      );
                    })()}

                  </div>


                  {/* ================================================= */}
                  {/* NET PAY */}
                  {/* ================================================= */}

                  <div className="border-b border-slate-200 px-7 py-6">

                    <div className="grid grid-cols-1 gap-5 rounded-xl border border-indigo-100 bg-indigo-50 px-6 py-5 md:grid-cols-2">

                      {/* NET PAY */}

                      <div>

                        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
                          Net Pay
                        </p>

                        <p className="mt-2 text-2xl font-bold text-slate-900">
                          {formatPayslipCurrency(
                            previewSlip.net_salary || 0
                          )}
                        </p>

                      </div>


                      {/* AMOUNT IN WORDS */}

                      <div className="md:text-right">

                        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black-200">
                          Amount in Words
                        </p>

                        <p className="mt-2 text-xs font-medium leading-5 text-slate-700">
                          {getAmountInWords(
                            Number(
                              previewSlip.net_salary || 0
                            )
                          )}
                        </p>

                      </div>

                    </div>

                  </div>


                  {/* ================================================= */}
                  {/* REMARKS */}
                  {/* ================================================= */}

                  <div className="border-b border-slate-200 px-7 py-5">

                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Remarks
                    </label>

                    <p className="mt-2 text-xs text-slate-600">
                      Salary processed for{" "}
                      {monthNames[selectedMonth - 1]}{" "}
                      {selectedYear}.
                    </p>

                  </div>


                    {/* ================================================= */}
                    {/* FOOTER */}
                    {/* ================================================= */}

                    <div className="px-7 py-4 text-center">

                      <p className="text-[9px] text-slate-400">
                        This is a system-generated payslip and does not
                        require a physical signature.
                      </p>

                    </div>

                  </div>

                </div>

              </div>

            </div>
        </div>,
        document.body
      )}

      {isMounted && editingComponent && createPortal(
        <div className="fixed inset-0 z-[10000]">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => !savingComponent && setEditingComponent(null)}
          />

          <div className="relative z-10 flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Edit Salary Component
                  </h2>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Changes will be used for future payroll calculations.
                  </p>
                </div>

                <button
                  onClick={() => !savingComponent && setEditingComponent(null)}
                  disabled={savingComponent}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-5">

                {/* Salary Head - Read Only */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Salary Head
                  </p>

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {editingComponent.name}
                    </p>

                    <span className="rounded bg-white px-2 py-1 font-mono text-[10px] text-slate-500">
                      {editingComponent.code}
                    </span>
                  </div>
                </div>

                {/* LOP Applicable */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    LOP Applicable
                  </label>

                  <select
                    value={editingComponent.affects_lop ? "yes" : "no"}
                    onChange={event =>
                      setEditingComponent({
                        ...editingComponent,
                        affects_lop: event.target.value === "yes"
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {/* Calculation Type */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Calculation Type
                  </label>

                  <select
                    value={editingComponent.calculation_type}
                    onChange={event =>
                      setEditingComponent({
                        ...editingComponent,
                        calculation_type:
                          event.target.value as SalaryComponent["calculation_type"]
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage_of_basic">% of Basic</option>
                    <option value="percentage_of_gross">% of Gross</option>
                  </select>
                </div>

                {/* Value */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    {editingComponent.calculation_type === "fixed" ? "Amount" : "Percentage"}
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingComponent.value}
                    onChange={event =>setEditingComponent(
                      {
                        ...editingComponent,
                        value: Number(event.target.value)
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />

                  <p className="mt-1 text-[10px] text-slate-400">
                    {editingComponent.calculation_type === "fixed" ? "Enter the fixed salary amount.": "Enter the percentage value."}
                  </p>
                </div>

              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
                <button
                  onClick={() => setEditingComponent(null)}
                  disabled={savingComponent}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSaveComponent}
                  disabled={savingComponent}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingComponent
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Save className="h-3.5 w-3.5" />}
                  {savingComponent ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx global>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          #payslip-print, #payslip-print * { visibility: visible !important; }
          #payslip-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          #payslip-print > div {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          @page { size: A4; margin: 10mm; }
          .fixed { position: static !important; }
        }
      `}</style>
    </div>
  );
}

function FieldSelect({
  label,
  icon: Icon,
  value,
  onChange,
  children
}: {
  label: string;
  icon?: any;
  value: string | number;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />}
        <select
          value={value}
          onChange={event => onChange(event.target.value)}
          className={`h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white ${Icon ? "pl-9" : "px-3"} pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50`}
        >
          {children}
        </select>
      </div>
    </div>
  );
}

function WarningBox({
  color,
  title,
  text
}: {
  color: "amber" | "red";
  title: string;
  text: string;
}) {
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-lg border p-3 ${
      color === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
    }`}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-[10px] leading-4">{text}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper
}: {
  icon: any;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
          <Icon className="h-4 w-4 text-indigo-600" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Payroll</span>
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500">{helper}</p>
    </div>
  );
}

function ControlItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-[10px] font-medium text-slate-600">{label}</span>
      {enabled
        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        : <XCircle className="h-3.5 w-3.5 text-slate-300" />}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <h3 className="mt-3 text-xs font-bold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
    </div>
  );
}

function InfoGrid({
  items,
  border = false
}: {
  items: [string, string][];
  border?: boolean;
}) {
  return (
    <div className={border ? "border-b lg:border-b-0 lg:border-r border-slate-200" : ""}>
      {items.map(([label, value], index) => (
        <div key={label} className={`${index < items.length - 1 ? "border-b border-slate-200" : ""} p-3`}>
          <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-900 break-words">{value}</p>
        </div>
      ))}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-slate-200 px-3 py-3 last:border-r-0">
      <p className="text-[8px] font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function BreakupCard({
  title,
  totalLabel,
  total,
  data,
  tone
}: {
  title: string;
  totalLabel: string;
  total: number | null | undefined;
  data: any;
  tone: "indigo" | "rose";
}) {
  const entries: [string, number][] = Array.isArray(data)
    ? data.map((item: any) => [item.name || "-", Number(item.amount || 0)])
    : data && typeof data === "object"
      ? Object.entries(data).map(([key, value]: [string, any]) => [
          key.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase()),
          typeof value === "object" && value !== null ? Number(value.amount || 0) : Number(value || 0)
        ])
      : [];

  const header = tone === "indigo"
    ? "bg-indigo-600 text-white"
    : "bg-rose-500 text-white";

  const totalBg = tone === "indigo"
    ? "bg-indigo-50 text-indigo-700"
    : "bg-rose-50 text-rose-600";

  return (
    <div className={`overflow-hidden rounded-lg border ${tone === "indigo" ? "border-indigo-100" : "border-rose-100"}`}>
      <div className={`flex items-center justify-between px-3 py-2.5 ${header}`}>
        <div className="flex items-center gap-2">
          {tone === "indigo"
            ? <Briefcase className="h-4 w-4" />
            : <CreditCard className="h-4 w-4" />}
          <h3 className="text-xs font-bold">{title}</h3>
        </div>
        <span className="text-[8px] font-semibold uppercase">Amount</span>
      </div>

      <div className="grid grid-cols-[1fr_100px] border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[8px] font-semibold uppercase text-slate-400">
        <span>Component</span>
        <span className="text-right">Current Month</span>
      </div>

      {entries.length > 0 ? entries.map(([name, amount], index) => (
        <div key={`${name}-${index}`} className="grid grid-cols-[1fr_100px] border-b border-slate-100 px-3 py-2">
          <span className="text-[10px] text-slate-700">{name}</span>
          <span className={`text-right text-[10px] font-semibold ${tone === "rose" ? "text-rose-600" : "text-slate-900"}`}>
            {formatCurrency(amount)}
          </span>
        </div>
      )) : (
        <div className="px-3 py-6 text-center text-[10px] text-slate-400">No {title.toLowerCase()} available</div>
      )}

      <div className={`flex items-center justify-between px-3 py-3 ${totalBg}`}>
        <span className="text-[10px] font-bold">{totalLabel}</span>
        <span className="text-xs font-bold">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}