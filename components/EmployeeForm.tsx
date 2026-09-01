"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Department, Employee, UserRole, EmployeeDocument } from "@/lib/types";
import { User, MapPin, Briefcase, CreditCard, FileText, Loader2 } from "lucide-react";
import DocumentUpload from "./DocumentUpload";

interface EmployeeFormProps {
  employee?: Employee;
  departments: Department[];
  mode: "add" | "edit";
  role: UserRole;
}

export default function EmployeeForm({ employee, departments, mode, role }: EmployeeFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Basic form state
  const [formData, setFormData] = useState<Partial<Employee>>({
    employee_id: employee?.employee_id || (mode === "add" ? "TSS-" + Math.floor(1000 + Math.random() * 9000) : ""),
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
  });

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
    { name: "Address", icon: MapPin },
    { name: "Employment", icon: Briefcase },
    { name: "Bank & Identity", icon: CreditCard },
    { name: "Documents", icon: FileText },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.name}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === idx
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className={activeTab === 0 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
              <input required type="text" name="first_name" value={formData.first_name || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
              <input required type="text" name="last_name" value={formData.last_name || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input required type="email" name="email" value={formData.email || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="tel" name="phone" value={formData.phone || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input type="date" name="date_of_birth" value={formData.date_of_birth || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
              <select name="gender" value={formData.gender || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
              <select name="blood_group" value={formData.blood_group || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option><option value="A-">A-</option>
                <option value="B+">B+</option><option value="B-">B-</option>
                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                <option value="O+">O+</option><option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Marital Status</label>
              <select name="marital_status" value={formData.marital_status || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                <option value="">Select Marital Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
          </div>
        </div>

        <div className={activeTab === 1 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <textarea name="address" rows={3} value={formData.address || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input type="text" name="city" value={formData.city || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <input type="text" name="state" value={formData.state || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
              <input type="text" name="pincode" value={formData.pincode || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-medium text-slate-900 mb-4 border-b pb-2">Emergency Contact</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
              <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
              <input type="tel" name="emergency_contact_phone" value={formData.emergency_contact_phone || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Relation</label>
              <input type="text" name="emergency_contact_relation" value={formData.emergency_contact_relation || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div className={activeTab === 2 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employee ID *</label>
              <input required type="text" name="employee_id" value={formData.employee_id || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select name="department_id" value={formData.department_id || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
              <input type="text" name="designation" value={formData.designation || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type</label>
              <select name="employment_type" value={formData.employment_type || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                <option value="">Select Type</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Joining Date</label>
              <input type="date" name="joining_date" value={formData.joining_date || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Probation End Date</label>
              <input type="date" name="probation_end_date" value={formData.probation_end_date || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmation Date</label>
              <input type="date" name="confirmation_date" value={formData.confirmation_date || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reporting Manager</label>
              <input type="text" name="reporting_manager" value={formData.reporting_manager || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Work Location</label>
              <input type="text" name="work_location" value={formData.work_location || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            {mode === "edit" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select name="status" value={formData.status || "active"} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                  <option value="on_notice">On Notice</option>
                </select>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea name="notes" rows={3} value={formData.notes || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div className={activeTab === 3 ? "block" : "hidden"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Salary (₹)</label>
              <input type="number" name="salary" value={formData.salary || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
              <input type="text" name="bank_name" value={formData.bank_name || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bank Account Number</label>
              <input type="text" name="bank_account_number" value={formData.bank_account_number || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label>
              <input type="text" name="ifsc_code" value={formData.ifsc_code || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
              <input type="text" name="pan_number" value={formData.pan_number || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Aadhar Number</label>
              <input type="text" name="aadhar_number" value={formData.aadhar_number || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">UAN Number</label>
              <input type="text" name="uan_number" value={formData.uan_number || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ESI Number</label>
              <input type="text" name="esi_number" value={formData.esi_number || ""} onChange={handleChange} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div className={activeTab === 4 ? "block" : "hidden"}>
          {mode === "add" ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              Please save the employee first to upload documents.
            </div>
          ) : (
            <DocumentUpload employeeId={employee?.id} documents={documents} />
          )}
        </div>

        <div className="mt-8 flex justify-end space-x-4 border-t pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "add" ? "Save Employee" : "Update Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}
