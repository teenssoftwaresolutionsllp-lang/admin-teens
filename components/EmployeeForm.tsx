"use client";

import { useState , useEffect, useRef} from "react";
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation";
import { Department, Employee, UserRole, EmployeeDocument, Project, } from "@/lib/types";
import { User, Briefcase, Loader2, KeyRound, File, CreditCard, FileText, MapPin, Copy, LaptopMinimal } from "lucide-react";
import companiesData from "@/data/companies.json";
import DocumentUpload from "./DocumentUpload";

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
  const [esiEligible, setEsiEligible] = useState(false);
  const [esiNumber, setEsiNumber] = useState("");
  const [pfEligible, setPfEligible] = useState(false);
  const [ptEligible, setPtEligible] = useState(false);
  const [ptNumber, setPtNumber] = useState("");
  const [accessoryType, setAccessoryType] = useState( employee?.accessory_type || "");
  const [accessorySerial,setAccessorySerial] = useState(employee?.accessory_serial || "");
  const [peripheralType,setPeripheralType] = useState("");
  const [peripheralSerial,setPeripheralSerial] = useState("");
  const [peripherals,setPeripherals] = useState<{ type: string; serial: string }[]>(employee?.peripherals || []);
  const [tdsEligible, setTdsEligible] = useState(false);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
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
  const [formData, setFormData] = useState<Partial<Employee>& { initial_password?: string }>({

    // Personal Information
    first_name: employee?.first_name || "",
    last_name: employee?.last_name || "",
    email: employee?.email || "",
    phone: employee?.phone || "",
    date_of_birth: employee?.date_of_birth?.split("T")[0] || "",
    gender: employee?.gender || null,
    blood_group: employee?.blood_group || "",
    marital_status: employee?.marital_status || null,


    // Employment Information
    employee_id: employee?.employee_id || "",
    department_id: employee?.department_id || "",
    project_id: employee?.project_id || "",
    designation: employee?.designation || "",
    employment_type: employee?.employment_type || null,
    joining_date: employee?.joining_date?.split("T")[0] || "",
    probation_duration: employee?.probation_duration || 6,
    appointment_date :employee?.appointment_date?.split("T")[0] || "",
    probation_end_date: employee?.probation_end_date?.split("T")[0] || "",
    confirmation_date: employee?.confirmation_date?.split("T")[0] || "",
    reporting_manager: employee?.reporting_manager || "",
    work_location: employee?.work_location || "",

    // Client / Project Information
    client_type: employee?.client_type || "",
    company_name: employee?.company_name || "",

    // Salary Information
    salary: employee?.salary || undefined,

    // Bank & Identity Information
    bank_name: employee?.bank_name || "",
    bank_account_number: employee?.bank_account_number || "",
    ifsc_code: employee?.ifsc_code || "",
    pan_number: employee?.pan_number || "",
    aadhar_number: employee?.aadhar_number || "",
    passport_number : employee?.passport_number||"",

    // Address Information
    permanent_address: employee?.permanent_address || "",
    permanent_city: employee?.permanent_city || "",
    permanent_state: employee?.permanent_state || "",
    permanent_pincode: employee?.permanent_pincode || "",

    temporary_address: employee?.temporary_address || "",
    temporary_city: employee?.temporary_city || "",
    temporary_state: employee?.temporary_state || "",
    temporary_pincode: employee?.temporary_pincode || "",

    // Emergency Contact 1
    emergency_contact_name: employee?.emergency_contact_name || "",
    emergency_contact_relation: employee?.emergency_contact_relation || "",
    emergency_contact_phone: employee?.emergency_contact_phone || "",

    // Emergency Contact 2
    emergency_contact_name_2: employee?.emergency_contact_name_2 || "",
    emergency_contact_relation_2: employee?.emergency_contact_relation_2 || "",
    emergency_contact_phone_2: employee?.emergency_contact_phone_2 || "",

    // Emergency Contact 3
    emergency_contact_name_3: employee?.emergency_contact_name_3 || "",
    emergency_contact_relation_3: employee?.emergency_contact_relation_3 || "",
    emergency_contact_phone_3: employee?.emergency_contact_phone_3 || "",


    // Accessories 
    accessory_type: employee?.accessory_type || "",
    accessory_serial: employee?.accessory_serial || "",
    peripherals: employee?.peripherals || [],

    // Statutory Information
    esi_number: employee?.esi_number || "",
    uan_number: employee?.uan_number || "",

    // Profile / Status
    status: employee?.status || "active",

    // Initial Login
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

  useEffect(() => {
    if (!employee) return;

    // =========================
    // STATUTORY
    // =========================
    setEsiEligible(employee.esi_healthcare_eligible ?? false);
    setEsiNumber(employee.esi_number ?? "");

    setPfEligible(employee.pf_eligible ?? false);

    setPtEligible(employee.pt_eligible ?? false);
    setPtNumber(employee.pt_number ?? "");

    setTdsEligible(employee.tds_eligible ?? false);

    // =========================
    // ACCESSORIES
    // =========================
    setAccessoryType(employee.accessory_type ?? "");
    setAccessorySerial(employee.accessory_serial ?? "");
    setPeripherals(employee.peripherals ?? []);

    // Documents
    setDocuments(employee.documents ?? []);

    // =========================
    // CLIENT
    // =========================
    setCompanySearch(employee.company_name ?? "");

    // =========================
    // FORM DATA
    // =========================
    setFormData({
      first_name: employee.first_name ?? "",
      last_name: employee.last_name ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",

      date_of_birth: employee.date_of_birth
        ? employee.date_of_birth.split("T")[0]
        : "",

      gender: employee.gender ?? null,
      blood_group: employee.blood_group ?? "",
      marital_status: employee.marital_status ?? null,

      employee_id: employee.employee_id ?? "",
      department_id: employee.department_id ?? "",
      project_id: employee.project_id ?? "",
      designation: employee.designation ?? "",
      employment_type: employee.employment_type ?? null,

      joining_date: employee.joining_date
        ? employee.joining_date.split("T")[0]
        : "",

      probation_duration: employee.probation_duration ?? 6,

      appointment_date: employee.appointment_date
        ? employee.appointment_date.split("T")[0]
        : "",

      probation_end_date: employee.probation_end_date
        ? employee.probation_end_date.split("T")[0]
        : "",

      confirmation_date: employee.confirmation_date
        ? employee.confirmation_date.split("T")[0]
        : "",

      reporting_manager: employee.reporting_manager ?? "",
      work_location: employee.work_location ?? "",

      // Client
      client_type: employee.client_type ?? "",
      company_name: employee.company_name ?? "",

      // Salary
      salary: employee.salary ?? undefined,

      // Bank & Identity
      bank_name: employee.bank_name ?? "",
      bank_account_number: employee.bank_account_number ?? "",
      ifsc_code: employee.ifsc_code ?? "",
      pan_number: employee.pan_number ?? "",
      aadhar_number: employee.aadhar_number ?? "",
      passport_number: employee.passport_number ?? "",

      // Permanent Address
      permanent_address: employee.permanent_address ?? "",
      permanent_city: employee.permanent_city ?? "",
      permanent_state: employee.permanent_state ?? "",
      permanent_pincode: employee.permanent_pincode ?? "",

      // Temporary Address
      temporary_address: employee.temporary_address ?? "",
      temporary_city: employee.temporary_city ?? "",
      temporary_state: employee.temporary_state ?? "",
      temporary_pincode: employee.temporary_pincode ?? "",

      // Emergency Contact 1
      emergency_contact_name: employee.emergency_contact_name ?? "",
      emergency_contact_relation:
        employee.emergency_contact_relation ?? "",
      emergency_contact_phone:
        employee.emergency_contact_phone ?? "",

      // Emergency Contact 2
      emergency_contact_name_2:
        employee.emergency_contact_name_2 ?? "",
      emergency_contact_relation_2:
        employee.emergency_contact_relation_2 ?? "",
      emergency_contact_phone_2:
        employee.emergency_contact_phone_2 ?? "",

      // Emergency Contact 3
      emergency_contact_name_3:
        employee.emergency_contact_name_3 ?? "",
      emergency_contact_relation_3:
        employee.emergency_contact_relation_3 ?? "",
      emergency_contact_phone_3:
        employee.emergency_contact_phone_3 ?? "",

      // Accessories
      accessory_type: employee.accessory_type ?? "",
      accessory_serial: employee.accessory_serial ?? "",
      peripherals: employee.peripherals ?? [],

      // Statutory
      esi_number: employee.esi_number ?? "",
      uan_number: employee.uan_number ?? "",
      // Status
      status: employee.status ?? "active",

      // Don't change this in edit
      initial_password: "Employee@123",
    } as any);
  }, [employee]);



  
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

  // ---------------------------------------------------------
  // VALIDATION FOR ADD MODE
  // ---------------------------------------------------------
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

    if (
      formData.salary === undefined ||
      formData.salary === null
    ) {
      missingFields.push("CTC");
    }

    // Statutory
    if (esiEligible && !esiNumber.trim()) {
      missingFields.push("ESI Number");
    }

    if (ptEligible && !ptNumber.trim()) {
      missingFields.push("P.T Number");
    }

    // ---------------------------------------------------------
    // SHOW VALIDATION ERRORS
    // ---------------------------------------------------------
    if (missingFields.length > 0) {
      setError(missingFields);

      const employmentFields = [
        "Employee ID",
        "Department",
        "Designation",
        "Employment Type",
        "Joining Date",
        "Probation End Date",
        "Work Location",
        "CTC",
        "Client Type",
        "Client Name",
        "Project",
      ];

      const statutoryFields = [
        "ESI Number",
        "P.T Number",
      ];

      if (
        missingFields.some((field) =>
          statutoryFields.includes(field)
        )
      ) {
        setActiveTab(2);
      } else if (
        missingFields.some((field) =>
          employmentFields.includes(field)
        )
      ) {
        setActiveTab(1);
      } else {
        setActiveTab(0);
      }

      return;
    }
  }

  // ---------------------------------------------------------
  // SAVE
  // ---------------------------------------------------------
  setIsLoading(true);

  try {
    const url =
      mode === "add"
        ? "/api/employees"
        : `/api/employees/${employee?.id}`;

    const method = mode === "add" ? "POST" : "PUT";

      const {
        initial_password,
        ...employeeData
      } = formData;


    let payload: any = {
      ...employeeData,

      // Client
      client_type: formData.client_type || null,
      company_name: formData.company_name || null,

      // Statutory
      esi_healthcare_eligible: esiEligible,
      esi_number: esiEligible ? esiNumber : null,

      pf_eligible: pfEligible,
      uan_number: pfEligible ? formData.uan_number : null,

      pt_eligible: ptEligible,
      pt_number: ptEligible ? ptNumber : null,

      tds_eligible: tdsEligible,

      //accessory
      accessory_type: accessoryType || null,
      accessory_serial: accessorySerial || null,
      peripherals: peripherals || [],
          
    };

    if (mode === "add") {
      payload.initial_password = formData.initial_password || "Employee@123";
    }

    console.log("Saving employee:", payload);

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    console.log("Employee API response:", {
      status: res.status,
      ok: res.ok,
      data,
    });

    if (!res.ok) {
      throw new Error(
        data.error || "Failed to save employee"
      );
    }

    toast.success(
      mode === "add"
        ? "Employee created successfully"
        : "Employee profile updated successfully"
    );

    const employeeId = mode === "add" ? data.id : employee?.id;
    
    if (!employeeId) {
      throw new Error("Employee ID not found after saving");
    }



    router.push(
      `/dashboard/employees/${employeeId}`
    );

    router.refresh();
  } catch (err: any) {
    console.error("Employee save error:", err);

    const message =
      err?.message || "Failed to save employee";

    setError([message]);
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};

  const tabs = [
    { name: "Personal Info", icon: User },
    { name: "Employment", icon: Briefcase },
    { name: "Bank & Identity", icon: CreditCard },
    { name: "Address & Emergency", icon: MapPin },
    { name: "Documentation", icon: FileText },
    { name:"Accessory Management", icon: LaptopMinimal},
    { name: "Statutory", icon: File},
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
                  SurName *
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input type="tel" name="phone" value={formData.phone || ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData((prev) => ({
                    ...prev,
                    phone: value,
                  }));
                }} inputMode="numeric" maxLength={10} pattern="[0-9]{10}" required placeholder="Enter 10-digit phone number" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
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

            {/* Employee ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Employee ID
              </label>

              <input
                required
                type="text"
                name="employee_id"
                value={formData.employee_id || ""}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Department
              </label>

              <select
                name="department_id"
                value={formData.department_id || ""}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              >
                <option value="">Select Department</option>

                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Designation */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Designation
              </label>

              <input
                type="text"
                name="designation"
                value={formData.designation || ""}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* Employment Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Employment Type
              </label>

              <select
                name="employment_type"
                value={formData.employment_type || ""}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              >
                <option value="">Select Type</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>

            {/* Joining Date */}
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

            {/* Probation Duration */}
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
            

            {/* Probation End Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Probation End Date
              </label>

              <input
                type="date"
                name="probation_end_date"
                value={formData.probation_end_date || ""}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* Appointment Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Appointment Date
              </label>

              <input
                type="date"
                name="appointment_date"
                value={formData.appointment_date || ""}
                onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    appointment_date: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* Reporting Manager */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reporting Manager
              </label>

              <input
                type="text"
                name="reporting_manager"
                value={formData.reporting_manager || ""}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* Work Location */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Work Location
              </label>

              <select
                name="work_location"
                value={formData.work_location || ""}
                onChange={handleChange}
                required 
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                >
                  <option value="">Select Work Location</option>
                  <option value="Onsite">Onsite</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
              </select>
            </div>

            {/* CTC */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                CTC (Lakhs / Year)
              </label>

              <input
                type="number"
                name="salary"
                step="0.01"
                min="0"
                value={formData.salary ?? ""}
                onChange={(e)=>{
                  const value = e.target.value;

                  setFormData((prev) => ({
                    ...prev,
                    salary: value === "" ? undefined : Number(value),
                  }))
                }}
                required
                placeholder="e.g. 5.5"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">Enter annual CTC in lakhs. Example: 5.5 = ₹5.5 Lakhs per year. </p>
            </div>

            
            {/* Client Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Client Type
              </label>

              <select
                name="client_type"
                value={formData.client_type || ""}
                required
                onChange={(e) => {
                  const value = e.target.value as "in-house" | "outsource";
                  setFormData((prev) => ({
                    ...prev,
                    client_type: value,
                    project_id:
                      value === "outsource" ? "" : prev.project_id,
                  }));
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              >
                <option value="">Select Client Type</option>
                <option value="in-house">In-House</option>
                <option value="outsource">Outsource</option>
              </select>
            </div>

            {/* Client Name - Only Outsource */}
            {formData.client_type === "outsource" && (
              <div ref={companyRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Client Name
                </label>

                <input
                  type="text"
                  name="company_name"
                  value={companySearch}
                  onChange={(e) => {const value = e.target.value;

                    setCompanySearch(value);

                    setFormData((prev) => ({
                      ...prev,
                      company_name: value,
                    }));

                    setShowCompanyDropdown(true);
                  }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  placeholder="Search company"
                  autoComplete="off"
                  required={formData.client_type === "outsource"}
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
            )}

            {/* Project - Only In-House */}
            {formData.client_type === "in-house" && (
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Project & Work Calendar
                </label>

                <select
                  name="project_id"
                  value={formData.project_id || ""}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                >
                  <option value="">Select Project</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} | {project.timezone} |{" "}
                      {project.shift_start_time}-{project.shift_end_time}
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-slate-500 mt-1.5">
                  The selected project's timezone, shift rules, and linked holiday
                  calendar will apply to this employee.
                </p>
              </div>
            )}

            {/* Status - Edit Only */}
            {mode === "edit" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status
                </label>

                <select
                  name="status"
                  value={formData.status || "active"}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                  <option value="on_notice">On Notice</option>
                </select>
              </div>
            )}

          </div>
        </div>

        {/* Tab 2:  Bank & Identity*/}
        <div className={activeTab === 2 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Bank Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Bank Name
              </label>

              <input
                type="text"
                name="bank_name"
                value={formData.bank_name || ""}
                onChange={handleChange}
                placeholder="Enter bank name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* Bank Account Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Bank Account Number
              </label>

              <input
                type="text"
                name="bank_account_number"
                value={formData.bank_account_number || ""}
                onChange={handleChange}
                placeholder="Enter account number"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* IFSC Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                IFSC Code
              </label>

              <input
                type="text"
                name="ifsc_code"
                value={formData.ifsc_code || ""}
                onChange={handleChange}
                placeholder="e.g. SBIN0001234"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 uppercase focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* PAN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                PAN Number
              </label>

              <input
                type="text"
                name="pan_number"
                value={formData.pan_number || ""}
                onChange={handleChange}
                placeholder="Enter PAN number"
                maxLength={10}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 uppercase focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

            {/* Aadhaar */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Aadhaar Number
              </label>

              <input
                type="text"
                name="aadhar_number"
                value={formData.aadhar_number || ""}
                onChange={handleChange}
                placeholder="Enter Aadhaar number"
                maxLength={12}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Passport Number
              </label>

              <input
                type="text"
                name="passport_number"
                value={formData.passport_number || ""}
                onChange={handleChange}
                placeholder="Enter Passport number"
                maxLength={12}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              />
            </div>

          </div>
        </div>
        {/* Tab 3 : ADDRESS & EMERGENCY */}
        <div className={activeTab === 3 ? "block" : "hidden"}>

          {/* Main Address Container */}
          <div className="space-y-8">

            {/* ================= PERMANENT ADDRESS ================= */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Permanent Address
                  </h3>
                  <p className="text-xs text-gray-500">
                    Employee&apos;s permanent residential address
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Permanent Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Address
                  </label>

                  <textarea
                    name="permanent_address"
                    value={formData.permanent_address || ""}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter permanent address"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Permanent City */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    City
                  </label>

                  <input
                    type="text"
                    name="permanent_city"
                    value={formData.permanent_city || ""}
                    onChange={handleChange}
                    placeholder="Enter city"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Permanent State */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    State
                  </label>

                  <input
                    type="text"
                    name="permanent_state"
                    value={formData.permanent_state || ""}
                    onChange={handleChange}
                    placeholder="Enter state"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Permanent Pincode */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Pincode
                  </label>

                  <input
                    type="text"
                    name="permanent_pincode"
                    value={formData.permanent_pincode || ""}
                    onChange={handleChange}
                    placeholder="Enter pincode"
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

              </div>
            </section>


            {/* ================= SAME AS PERMANENT ================= */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    temporary_address: prev.permanent_address || "",
                    temporary_city: prev.permanent_city || "",
                    temporary_state: prev.permanent_state || "",
                    temporary_pincode: prev.permanent_pincode || "",
                  }));
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 hover:border-indigo-300 transition-all"
              >
                <Copy className="w-4 h-4" />
                Same as Permanent Address
              </button>
            </div>


            {/* ================= TEMPORARY ADDRESS ================= */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Communication Address
                  </h3>
                  <p className="text-xs text-gray-500">
                    Employee&apos;s current or temporary residential address
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Temporary Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Address
                  </label>

                  <textarea
                    name="temporary_address"
                    value={formData.temporary_address || ""}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter temporary address"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Temporary City */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    City
                  </label>

                  <input
                    type="text"
                    name="temporary_city"
                    value={formData.temporary_city || ""}
                    onChange={handleChange}
                    placeholder="Enter city"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Temporary State */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    State
                  </label>

                  <input
                    type="text"
                    name="temporary_state"
                    value={formData.temporary_state || ""}
                    onChange={handleChange}
                    placeholder="Enter state"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Temporary Pincode */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Pincode
                  </label>

                  <input
                    type="text"
                    name="temporary_pincode"
                    value={formData.temporary_pincode || ""}
                    onChange={handleChange}
                    placeholder="Enter pincode"
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

              </div>
            </section>


            {/* ================= EMERGENCY CONTACT ================= */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <User className="w-4 h-4 text-red-600" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Emergency Contacts
                  </h3>
                  <p className="text-xs text-gray-500">
                    People to contact in case of an emergency
                  </p>
                </div>
              </div>

              <div className="space-y-6">

                {/* ================= CONTACT 1 ================= */}
                <div className="rounded-xl border border-gray-200 p-5">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">
                    Emergency Contact 1
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Contact Name
                      </label>

                      <input
                        type="text"
                        name="emergency_contact_name"
                        value={formData.emergency_contact_name || ""}
                        onChange={handleChange}
                        placeholder="Enter contact name"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    {/* Relationship */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Relationship
                      </label>

                      <select
                        name="emergency_contact_relation"
                        value={formData.emergency_contact_relation || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Select relationship</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Brother">Brother</option>
                        <option value="Sister">Sister</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Contact Phone
                      </label>

                      <input
                        type="tel"
                        name="emergency_contact_phone"
                        value={formData.emergency_contact_phone || ""}
                        onChange={handleChange}
                        placeholder="Enter emergency contact number"
                        maxLength={10}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                  </div>
                </div>


                {/* ================= CONTACT 2 ================= */}
                <div className="rounded-xl border border-gray-200 p-5">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">
                    Emergency Contact 2
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Contact Name
                      </label>

                      <input
                        type="text"
                        name="emergency_contact_name_2"
                        value={formData.emergency_contact_name_2 || ""}
                        onChange={handleChange}
                        placeholder="Enter contact name"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    {/* Relationship */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Relationship
                      </label>

                      <select
                        name="emergency_contact_relation_2"
                        value={formData.emergency_contact_relation_2 || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Select relationship</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Brother">Brother</option>
                        <option value="Sister">Sister</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Contact Phone
                      </label>

                      <input
                        type="tel"
                        name="emergency_contact_phone_2"
                        value={formData.emergency_contact_phone_2 || ""}
                        onChange={handleChange}
                        placeholder="Enter emergency contact number"
                        maxLength={10}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                  </div>
                </div>


                {/* ================= CONTACT 3 ================= */}
                <div className="rounded-xl border border-gray-200 p-5">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">
                    Emergency Contact 3
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Contact Name
                      </label>

                      <input
                        type="text"
                        name="emergency_contact_name_3"
                        value={formData.emergency_contact_name_3 || ""}
                        onChange={handleChange}
                        placeholder="Enter contact name"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    {/* Relationship */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Relationship
                      </label>

                      <select
                        name="emergency_contact_relation_3"
                        value={formData.emergency_contact_relation_3 || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Select relationship</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Brother">Brother</option>
                        <option value="Sister">Sister</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        Contact Phone
                      </label>

                      <input
                        type="tel"
                        name="emergency_contact_phone_3"
                        value={formData.emergency_contact_phone_3 || ""}
                        onChange={handleChange}
                        placeholder="Enter emergency contact number"
                        maxLength={10}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                  </div>
                </div>

              </div>
            </section>
          </div>
        </div>
        {/* Tab 4: Documents */}
        {activeTab === 4 && (
          <div>
            <DocumentUpload
            documents={documents || []}
            employeeId={employee?.id}
            />
          </div>
        )}

        {/* Tab 5: Accessory management*/}
        {activeTab === 5 && (
          <div className="space-y-6">

            {/* ================= ASSIGNED EQUIPMENT ================= */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Accessory Type
              </label>

              <select
                value={accessoryType}
                onChange={(e) => {
                  setAccessoryType(e.target.value);

                  if (e.target.value === "") {
                    setAccessorySerial("");
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
              >
                <option value="">No Main Accessory</option>
                <option value="Desktop">Desktop</option>
                <option value="Laptop">Laptop</option>
              </select>
            </div>

            {/* Desktop / Laptop Serial Number */}
            {(accessoryType === "Desktop" || accessoryType === "Laptop") && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {accessoryType} S.No
                </label>

                <input
                  type="text"
                  value={accessorySerial}
                  onChange={(e) => setAccessorySerial(e.target.value)}
                  placeholder={`Enter ${accessoryType} S.No`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                />
              </div>
            )}

            {/* ================= PERIPHERALS ================= */}
            <div className="border-t border-slate-200 pt-6 space-y-4">

              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Peripherals
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Add peripherals assigned to this employee.
                </p>
              </div>

              {/* Add Peripheral */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Peripheral
                  </label>

                  <select
                    value={peripheralType}
                    onChange={(e) => setPeripheralType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  >
                    <option value="">Select Peripheral</option>
                    <option value="Mouse">Mouse</option>
                    <option value="Keyboard">Keyboard</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Headset">Headset</option>
                    <option value="Webcam">Webcam</option>
                    <option value="Printer">Printer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    S.No
                  </label>

                  <input
                    type="text"
                    value={peripheralSerial}
                    onChange={(e) => setPeripheralSerial(e.target.value)}
                    placeholder="Enter S.No"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  />
                </div>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!peripheralType || !peripheralSerial.trim()) return;

                  setPeripherals((prev) => [
                    ...prev,
                    {
                      type: peripheralType,
                      serial: peripheralSerial.trim(),
                    },
                  ]);

                  setPeripheralType("");
                  setPeripheralSerial("");
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all"
              >
                + Add Peripheral
              </button>

              {/* ================= EXISTING PERIPHERALS ================= */}
              {peripherals.length > 0 && (
                <div className="space-y-2">

                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Assigned Peripherals
                  </h4>

                  {peripherals.map((item, index) => (
                    <div
                      key={`${item.type}-${item.serial}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {item.type}
                        </p>

                        <p className="text-xs text-slate-500">
                          S.No: {item.serial}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPeripherals((prev) =>
                            prev.filter((_, i) => i !== index)
                          );
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}

        {/* {tab 6: options to selct eligabilty of pt ,tds} */}
        <div className={activeTab === 6 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* ESI */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={esiEligible}
                  onChange={(e) => {
                    const checked = e.target.checked;

                    setEsiEligible(checked);

                    if (!checked) {
                      setEsiNumber("");
                    }
                  }}
                />

                <span>Is he Eligible for ESI/Health Care</span>
              </label>

              {esiEligible && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    ESI Number
                  </label>

                  <input
                    type="text"
                    value={esiNumber}
                    onChange={(e) => setEsiNumber(e.target.value)}
                    required
                    placeholder="Enter ESI Number"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  />
                </div>
              )}
            </div>

            {/* PF */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={pfEligible}
                  onChange={(e) => {
                   const checked = e.target.checked;
                   setPfEligible(checked);

                   setFormData((prev) => ({
                    ...prev,
                    pf_eligible: checked,
                   }))
                  }}
                />
                <span>Is he Eligible for P.F</span>
              </label>
                {pfEligible && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      UAN Number
                    </label>

                    <input
                      type="text"
                      name="uan_number"
                      value={formData.uan_number || ""}
                      onChange={handleChange}
                      placeholder="Enter UAN number"
                      maxLength={12}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />

                    <p className="text-xs text-gray-400 mt-1">
                      Enter the employee&apos;s 12-digit Universal Account Number.
                    </p>
                  </div>
                )}
            </div>

            {/* PT */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={ptEligible}
                  onChange={(e) => { 
                    const checked = e.target.checked;
                    setPtEligible(checked);

                    if (!checked) {
                      setPtNumber("");
                    }
                   }}
                />

                <span>Is he Eligible for P.T</span>
              </label>

              {ptEligible && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    P.T Number
                  </label>

                  <input
                    type="text"
                    value={ptNumber}
                    onChange={(e) => setPtNumber(e.target.value)}
                    required
                    placeholder="Enter P.T Number"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  />
                </div>
              )}
            </div>

            {/* TDS */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={tdsEligible}
                  onChange={(e) => {
                    setTdsEligible(e.target.checked);
                  }}
                />

                <span>Is he Eligible for T.D.S</span>
              </label>
            </div>

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

              if (!formData.phone?.trim() || formData.phone.trim().length !== 10) {
                missingFields.push("Phone (10 digits)");
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

        {/* ADD MODE - TAB 2-5 */}
        {mode === "add" && activeTab >= 1 && activeTab < 6 && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab - 1)}
              className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => {
                const missingFields: string[] = [];

                // TAB 1 - Employment
                if (activeTab === 1) {
                  if (!formData.employee_id?.trim()) {
                    missingFields.push("Employee ID");
                  }

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

                  if (!formData.work_location) {
                    missingFields.push("Work Location");
                  }

                  if (formData.salary === undefined || formData.salary === null) {
                    missingFields.push("CTC");
                  }

                  if (!formData.client_type) {
                    missingFields.push("Client Type");
                  }

                  // Client Name required ONLY for Outsource
                  if (
                    formData.client_type === "outsource" &&
                    !formData.company_name?.trim()
                  ) {
                    missingFields.push("Client Name");
                  }

                  // Project required ONLY for In-House
                  if (
                    formData.client_type === "in-house" &&
                    !formData.project_id
                  ) {
                    missingFields.push("Project");
                  }
                }

                // TAB 5 - Statutory
                if (activeTab === 5) {
                  if (esiEligible && !esiNumber?.trim()) {
                    missingFields.push("ESI Number");
                  }

                  if (ptEligible && !ptNumber?.trim()) {
                    missingFields.push("PT Number");
                  }
                }

                // No required validation for:
                // TAB 2 - Personal
                // TAB 3 - Bank & Identity
                // TAB 4 - Address & Emergency
                // Documents
                // Accessories

                if (missingFields.length > 0) {
                  setError(missingFields);
                  return;
                }

                setError([]);
                setActiveTab(activeTab + 1);
              }}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-sm hover:bg-indigo-700 transition-all"
            >
              Next
              <span>→</span>
            </button>
          </>
        )}

        {/* ADD MODE - TAB 6 */}
        {mode === "add" && activeTab === 6 && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab(4)}
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

