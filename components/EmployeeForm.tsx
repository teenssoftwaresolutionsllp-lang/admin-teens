"use client";

import { useState , useEffect, useRef} from "react";
import { toast } from "react-hot-toast"
import { Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Department, Employee, UserRole, EmployeeDocument, Project } from "@/lib/types";
import { User, MapPin, Briefcase, CreditCard, FileText, Loader2, KeyRound, DockIcon, File } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import companiesData from "@/data/companies.json";
import { text } from "stream/consumers";

const companies = companiesData.companies;

interface EmployeeFormProps {
  employee?: Employee;
  departments: Department[];
  projects: Project[];
  generatedEmployeeId?: string;
  mode: "add" | "edit";
  role: UserRole;
}


export default function EmployeeForm({ employee, departments, projects, generatedEmployeeId, mode, role }: EmployeeFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [isEmailEditing, setIsEmailEditing] = useState(false);
  const [emailWarning, setEmailWarning] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string []>([]);

  const [companySearch, setCompanySearch] = useState(
    employee?.company_name || ""
  );

  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const companyRef = useRef<HTMLDivElement>(null);

  const filteredCompanies = companies.filter((company) =>
    company.company_name
      .toLowerCase()
      .startsWith(companySearch.toLowerCase())
  );
  
  // Basic form state
  const [formData, setFormData] = useState<Partial<Employee>>({
    employee_id: employee?.employee_id || "",
    first_name: employee?.first_name || "",
    last_name: employee?.last_name || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    date_of_birth: employee?.date_of_birth?.split("T")[0] || "",
    gender: employee?.gender || null,
    blood_group: employee?.blood_group || "",
    marital_status: employee?.marital_status || null,
    address: employee?.address || "",
    city: employee?.city || "",
    state: employee?.state || "",
    pincode: employee?.pincode || "",
    emergency_contact_name: employee?.emergency_contact_name || "",
    emergency_contact_phone: employee?.emergency_contact_phone || "",
    emergency_contact_relation: employee?.emergency_contact_relation || "",
    department_id: employee?.department_id || "",
    project_id: employee?.project_id || projects[0]?.id || "",
    designation: employee?.designation || "",
    employment_type: employee?.employment_type || null,
    joining_date: employee?.joining_date?.split("T")[0] || "",
    probation_duration: employee?.probation_duration || 6,
    probation_end_date: employee?.probation_end_date?.split("T")[0] || "",
    confirmation_date: employee?.confirmation_date?.split("T")[0] || "",
    reporting_manager: employee?.reporting_manager || "",
    work_location: employee?.work_location || "",
    status: employee?.status || "active",
    notes: employee?.notes || "",
    salary: employee?.salary || undefined,
    bank_name: employee?.bank_name || "",
    bank_account_number: employee?.bank_account_number || "",
    ifsc_code: employee?.ifsc_code || "",
    pan_number: employee?.pan_number || "",
    aadhar_number: employee?.aadhar_number || "",
    uan_number: employee?.uan_number || "",
    esi_number: employee?.esi_number || "",
    initial_password: "Employee@123",
  } as any);

  useEffect(() => {
  if (mode === "add") {
    fetch("/api/employees/next-id")
      .then((res) => res.json())
      .then((data) => {
        if (data.employee_id) {
          setFormData((prev) => ({
            ...prev,
            employee_id: data.employee_id,
          }));
        }
      })
      .catch((error) => {
        console.error("Failed to generate employee ID:", error);
      });
  }
}, [mode]);

  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value === "" ? null : value }));
  };

  const genrateEmail = (firstName: string, lastName: string)=>{
    const first = firstName.trim().toLowerCase().replace(/\s+/g, "");
    const last = lastName.trim().toLowerCase().replace(/\s+/g, "").slice(0,1);

    if(!first || !last){
      return("")
    }
    return `${first}.${last}@teenss.com`;
  }

  const calculatephrobDate = (joiningDate: string,duration :number)=>{
     if (!joiningDate || !duration) return "";
     const date = new Date(joiningDate);
     date.setMonth(date.getMonth() + duration);

     return date.toISOString().split("T")[0];
  }

  const checkDuplicateName = async (
  firstName: string,
  lastName: string
) => {
  if (!firstName.trim() || !lastName.trim() || mode !== "add") {
    setEmailWarning("");
    return;
  }

  try {
    const response = await fetch("/api/employees");
    const data = await response.json();

    const employees = data.employees || data;

    const duplicate = employees.some((employee: Employee) => {
      return (
        employee.first_name?.trim().toLowerCase() ===
          firstName.trim().toLowerCase() &&
        employee.last_name?.trim().toLowerCase() ===
          lastName.trim().toLowerCase()
      );
    });

    if (duplicate) {
      setEmailWarning(
        "An employee with this Given Name and Surname already exists. Please edit the email."
      );
      setIsEmailEditing(true);
    } else {
      setEmailWarning("");
      setIsEmailEditing(false);
    }
  } catch (error) {
    console.error("Error checking employee name:", error);
  }
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError([]);

  if (mode === "add") {
    const missingFields: string[] = [];

    // Personal Info
    if (!formData.first_name?.trim()) {
      missingFields.push("First Name");
    }

    if (!formData.last_name?.trim()) {
      missingFields.push("Last Name");
    }

    if (!formData.email?.trim()) {
      missingFields.push("Email");
    }

    if (!formData.phone?.trim() || formData.phone.trim().length < 10) {
      missingFields.push("Phone (10 digits)");
    }

    if (!formData.employee_id?.trim()) {
      missingFields.push("Employee ID");
    }


    // Employment
    if (!formData.department_id) {
      missingFields.push("Department");
    }

    if (!formData.designation?.trim()) {
      missingFields.push("Designation");
    }

    if (!formData.employment_type) {
      missingFields.push("Employment Type");
    }

    if (!formData.joining_date) {
      missingFields.push("Joining Date");
    }

    if (!formData.probation_end_date) {
      missingFields.push("Probation End Date");
    }

    if (!formData.work_location?.trim()) {
      missingFields.push("Work Location");
    }

    if (
      formData.salary === undefined ||
      formData.salary === null
    ) {
      missingFields.push("CTC Months ");
    }

    if (missingFields.length > 0) {
      setError(missingFields);
      setActiveTab(missingFields.some(field =>
        [
          "Department",
          "Designation",
          "Employment Type",
          "Joining Date",
          "Probation End Date",
          "Work Location",
          "CTC Months ",
        ].includes(field)) ? 1 : 0);
      return;
    }
  }

  setIsLoading(true);

  try {
    const url =
      mode === "add"
        ? "/api/employees"
        : `/api/employees/${employee?.id}`;

    const method = mode === "add" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to save employee");
    }

    const savedEmployee = await res.json();

    router.push(
      `/dashboard/employees/${
        mode === "add" ? savedEmployee.id : employee?.id
      }`
    );

    router.refresh();
  } catch (err: any) {
    const message = err?.message || "Failed to save employee";
    setError([message]);
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};

  const tabs = [
    { name: "Personal Info", icon: User },
    { name: "Employment", icon: Briefcase },
    { name: "Documents", icon: File},
  ]
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
      {/* Tabs Bar */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 px-3 pt-2 overflow-x-auto gap-2">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === idx;
          return (
            <button
              key={tab.name}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap ${
                isActive
                  ? "bg-white text-indigo-600 border-t-2 border-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-7">
        {error.length > 0 && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-300 text-rose-700 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                ×
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">
                  Please fill the following required fields:
                </p>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold">
                  {error.map((field, index) => (
                    <span key={`${field}-${index}`}>
                      • {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 0: Personal */}
        <div className={activeTab === 0 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Given Name *
                </label>

                <input
                  required
                  type="text"
                  name="first_name"
                  value={formData.first_name || ""}
                  onChange={(e) => {
                    const firstName = e.target.value;

                    setFormData((prev) => {
                      const lastName = prev.last_name || "";

                      return {
                        ...prev,
                        first_name: firstName,
                        email: mode === "add" && !isEmailEditing ? genrateEmail(firstName, lastName) : prev.email,
                      };
                    });
                    setEmailWarning("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                />
              </div>
            <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sur Name *
                </label>

                <input
                  required
                  type="text"
                  name="last_name"
                  value={formData.last_name || ""}
                  onChange={(e) => {
                    const lastName = e.target.value;

                    setFormData((prev) => {
                      const firstName = prev.first_name || "";

                      return {
                        ...prev,
                        last_name: lastName,
                        email: mode === "add" && !isEmailEditing ? genrateEmail(firstName, lastName) : prev.email,
                      };
                    });
                    setEmailWarning("");
                      checkDuplicateName(
                        formData.first_name || "",
                        lastName,
                      );
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Email *</label>

                {isEmailEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmailEditing(false);

                      setFormData((prev) => ({
                        ...prev,
                        email: genrateEmail(
                          prev.first_name || "",
                          prev.last_name || ""
                        ),
                      }));
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Use Generated Email
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEmailEditing(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Edit Email
                  </button>
                )}
              </div>

              <input
                required
                type="email"
                name="email"
                value={formData.email || ""}
                readOnly={!isEmailEditing}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }));
                }}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none transition-all ${
                  isEmailEditing
                    ? "border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    : "border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed"
                }`}
              />

              {emailWarning && (
                <p className="mt-1.5 text-xs font-medium text-amber-600">
                  ⚠️ {emailWarning}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input type="tel" name="phone" value={formData.phone || ""} onChange={handleChange} minLength={10} required className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>

            {mode === "add" && (
              <div className="md:col-span-2 p-5 bg-gradient-to-r from-indigo-50 via-indigo-50/70 to-blue-50 border border-indigo-200/90 rounded-2xl">
                <div className="flex items-center gap-2 mb-2 text-indigo-900">
                  <KeyRound className="h-4 w-4 text-indigo-600" />
                  <label className="text-xs font-extrabold uppercase tracking-wider">
                    Initial Employee Login Credentials
                  </label>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <input
                    type="text"
                    name="initial_password"
                    value={(formData as any).initial_password || "Employee@123"}
                    onChange={handleChange}
                    className="w-full max-w-xs rounded-xl border border-indigo-300 bg-white px-3.5 py-2 text-sm font-mono text-indigo-950 font-bold shadow-sm"
                  />
                  <span className="text-xs text-indigo-700 font-medium">
                    Employee will use their email & this temporary password to log in and finish their KYC profile.
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Date of Birth</label>
              <input type="date" name="date_of_birth" value={formData.date_of_birth || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Gender</label>
              <select name="gender" value={formData.gender || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Blood Group</label>
              <select name="blood_group" value={formData.blood_group || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option><option value="A-">A-</option>
                <option value="B+">B+</option><option value="B-">B-</option>
                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                <option value="O+">O+</option><option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Marital Status</label>
              <select name="marital_status" value={formData.marital_status || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                <option value="">Select Marital Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
          </div>
        </div>


        {/* Tab 1: Employment */}
        <div className={activeTab === 1 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Employee ID </label>
              <input required type="text" name="employee_id" value={formData.employee_id || ""} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Department</label>
              <select name="department_id" value={formData.department_id || ""} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Designation</label>
              <input type="text" name="designation" value={formData.designation || ""} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Employment Type</label>
              <select name="employment_type" value={formData.employment_type || ""} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                <option value="">Select Type</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Joining Date
              </label>

              <input
                type="date"
                name="joining_date"
                value={formData.joining_date || ""}
                required
                onChange={(e) => {
                  const joiningDate = e.target.value;

                  setFormData((prev) => ({
                    ...prev,
                    joining_date: joiningDate,
                    probation_end_date: calculatephrobDate(
                      joiningDate,
                      Number(prev.probation_duration) || 6
                    ),
                  }));
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Probation Duration
              </label>

              <select
                name="probation_duration"
                value={formData.probation_duration || 6}
                required
                onChange={(e) => {
                  const duration = Number(e.target.value);

                  setFormData((prev) => ({
                    ...prev,
                    probation_duration: duration,
                    probation_end_date: calculatephrobDate(
                      prev.joining_date || "",
                      duration
                    ),
                  }));
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={9}>9 Months</option>
                <option value={12}>12 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Probation End Date</label>
              <input type="date" name="probation_end_date" value={formData.probation_end_date || ""} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Reporting Manager</label>
              <input type="text" name="reporting_manager" value={formData.reporting_manager || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Work Location</label>
              <input type="text" name="work_location" value={formData.work_location || ""} required onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">CTC(₹)</label>
              <input type="number" name="salary" value={formData.salary || ""} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">ESI Number</label>
              <input type="text" name="esi_number" value={formData.esi_number || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>

            <div ref={companyRef} className="relative">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Company Name
              </label>

              <input
                type="text"
                name="company_name"
                value={companySearch}
                onChange={(e) => {
                  const value = e.target.value;

                  setCompanySearch(value);

                  setFormData((prev) => ({
                    ...prev,
                    company_name: value ,
                  }));

                  setShowCompanyDropdown(true);
                }}
                onFocus={() => setShowCompanyDropdown(true)}
                placeholder="Search company"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />

              {showCompanyDropdown && companySearch && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">

                  {filteredCompanies.length > 0 ? (
                    filteredCompanies.map((company, index) => (
                      <button
                        key={`${company.company_name}-${index}`}
                        type="button"
                        onClick={() => {
                          setCompanySearch(company.company_name);

                          setFormData((prev) => ({
                            ...prev,
                            company_name: company.company_name,
                          }));

                          setShowCompanyDropdown(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                      >
                        {company.company_name}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      No companies found
                    </div>
                  )}

                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Project & Work Calendar</label>
              <select name="project_id" value={formData.project_id || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                <option value="">Select Project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name} | {project.timezone} | {project.shift_start_time}-{project.shift_end_time}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1.5">
                The selected project's timezone, shift rules, and linked holiday calendar will apply to this employee.
              </p>
            </div>
            {mode === "edit" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Status</label>
                <select name="status" value={formData.status || "active"} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                  <option value="on_notice">On Notice</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* {tab 2: options to selct eligabilty of pt ,tds} */}
        <div className={activeTab === 2 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <h1>Empolyment</h1>

          </div>
        </div>




        {/* Footer Actions */}
      <div className="mt-8 flex justify-end items-center gap-3 border-t border-slate-100 pt-6">

        {/* Cancel - visible on all tabs */}
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
        >
          Cancel
        </button>

        {/* ADD MODE - TAB 1 */}
        {mode === "add" && activeTab === 0 && (
          <button
            type="button"
            onClick={() => {
              const missingFields: string[] = [];

              if (!formData.first_name?.trim()) {
                missingFields.push("First Name");
              }

              if (!formData.last_name?.trim()) {
                missingFields.push("Last Name");
              }

              if (!formData.email?.trim()) {
                missingFields.push("Email");
              }

              if (!formData.phone?.trim()) {
                missingFields.push("Phone");
              }

              if (missingFields.length > 0) {
                setError(missingFields);
                return;
              }

              setError([]);
              setActiveTab(1);
            }}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-sm hover:bg-indigo-700 transition-all"
          >
            Next
            <span>→</span>
          </button>
        )}

        {/* ADD MODE - TAB 2 */}
        {mode === "add" && activeTab === 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab(0)}
              className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={() => setActiveTab(2)}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-sm hover:bg-indigo-700 transition-all"
            >
              Next
              <span>→</span>
            </button>
          </>
        )}

        {/* ADD MODE - TAB 3 */}
        {mode === "add" && activeTab === 2 && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab(1)}
              className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            >
              ← Back
            </button>

            <button
              type="submit"
              formNoValidate
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow disabled:opacity-50 transition-all"
            >
              {isLoading && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}

              <span>Create Employee</span>
            </button>
          </>
        )}

        {/* EDIT MODE */}
        {mode === "edit" && (
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow disabled:opacity-50 transition-all"
          >
            {isLoading && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}

            <span>Update Profile</span>
          </button>
        )}

      </div>
      </form>
    </div>
  );
}

