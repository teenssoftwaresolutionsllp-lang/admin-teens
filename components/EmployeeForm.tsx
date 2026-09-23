"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Department, Employee, UserRole, EmployeeDocument, Project } from "@/lib/types";
import { User, MapPin, Briefcase, CreditCard, FileText, Loader2, KeyRound } from "lucide-react";
import DocumentUpload from "./DocumentUpload";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Basic form state
  const [formData, setFormData] = useState<Partial<Employee>>({
    employee_id: employee?.employee_id || generatedEmployeeId || "",
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

  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value === "" ? null : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const url = mode === "add" ? "/api/employees" : `/api/employees/${employee?.id}`;
      const method = mode === "add" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save employee");
      }

      const savedEmployee = await res.json();
      router.push(`/dashboard/employees/${mode === "add" ? savedEmployee.id : employee?.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { name: "Personal Info", icon: User },
    { name: "Address & Emergency", icon: MapPin },
    { name: "Employment", icon: Briefcase },
    { name: "Bank & Identity", icon: CreditCard },
    { name: "Documents", icon: FileText },
  ];

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
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-3">
            <span>{error}</span>
          </div>
        )}

        {/* Tab 0: Personal */}
        <div className={activeTab === 0 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">First Name *</label>
              <input required type="text" name="first_name" value={formData.first_name || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Last Name *</label>
              <input required type="text" name="last_name" value={formData.last_name || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email (Official Login ID) *</label>
              <input required type="email" name="email" value={formData.email || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input type="tel" name="phone" value={formData.phone || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
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

        {/* Tab 1: Address */}
        <div className={activeTab === 1 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Street Address</label>
              <textarea name="address" rows={3} value={formData.address || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">City</label>
              <input type="text" name="city" value={formData.city || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">State</label>
              <input type="text" name="state" value={formData.state || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Pincode</label>
              <input type="text" name="pincode" value={formData.pincode || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Emergency Contact</h3>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Contact Name</label>
              <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Contact Phone</label>
              <input type="tel" name="emergency_contact_phone" value={formData.emergency_contact_phone || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Relation</label>
              <input type="text" name="emergency_contact_relation" value={formData.emergency_contact_relation || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
          </div>
        </div>

        {/* Tab 2: Employment */}
        <div className={activeTab === 2 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Employee ID (Assigned Automatically)</label>
              <input required type="text" name="employee_id" value={formData.employee_id || ""} readOnly={mode === "add"} placeholder={mode === "add" ? "Generated automatically on save" : "Employee ID"} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none read-only:bg-slate-100 read-only:text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Department</label>
              <select name="department_id" value={formData.department_id || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
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
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Designation</label>
              <input type="text" name="designation" value={formData.designation || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Employment Type</label>
              <select name="employment_type" value={formData.employment_type || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none">
                <option value="">Select Type</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Joining Date</label>
              <input type="date" name="joining_date" value={formData.joining_date || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Probation End Date</label>
              <input type="date" name="probation_end_date" value={formData.probation_end_date || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Confirmation Date</label>
              <input type="date" name="confirmation_date" value={formData.confirmation_date || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Reporting Manager</label>
              <input type="text" name="reporting_manager" value={formData.reporting_manager || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Work Location</label>
              <input type="text" name="work_location" value={formData.work_location || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
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
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea name="notes" rows={3} value={formData.notes || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
          </div>
        </div>

        {/* Tab 3: Bank & Identity */}
        <div className={activeTab === 3 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Base Monthly Salary (₹)</label>
              <input type="number" name="salary" value={formData.salary || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Bank Name</label>
              <input type="text" name="bank_name" value={formData.bank_name || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Bank Account Number</label>
              <input type="text" name="bank_account_number" value={formData.bank_account_number || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">IFSC Code</label>
              <input type="text" name="ifsc_code" value={formData.ifsc_code || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">PAN Number</label>
              <input type="text" name="pan_number" value={formData.pan_number || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Aadhaar Number</label>
              <input type="text" name="aadhar_number" value={formData.aadhar_number || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">UAN Number</label>
              <input type="text" name="uan_number" value={formData.uan_number || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">ESI Number</label>
              <input type="text" name="esi_number" value={formData.esi_number || ""} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" />
            </div>
          </div>
        </div>

        {/* Tab 4: Documents */}
        <div className={activeTab === 4 ? "block" : "hidden"}>
          {mode === "add" ? (
            <div className="p-10 text-center text-slate-500 bg-slate-50/70 rounded-2xl border border-dashed border-slate-300">
              <p className="text-sm font-semibold text-slate-700">Save this employee record first</p>
              <p className="text-xs text-slate-400 mt-1">Once created, you and the employee can upload compliance documents, offer letters, and KYC proofs.</p>
            </div>
          ) : (
            <DocumentUpload employeeId={employee?.id} documents={documents} />
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-end items-center gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow disabled:opacity-50 transition-all"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{mode === "add" ? "Save & Create Employee" : "Update Profile"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

