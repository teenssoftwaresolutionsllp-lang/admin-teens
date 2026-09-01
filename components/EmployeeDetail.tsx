"use client";

import { Employee, EmployeeDocument, UserRole } from "@/lib/types";
import { User, MapPin, Briefcase, CreditCard, FileText, Download, Edit } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import DocumentUpload from "./DocumentUpload";

interface EmployeeDetailProps {
  employee: Employee;
  documents: EmployeeDocument[];
  role: UserRole;
}

export default function EmployeeDetail({ employee, documents, role }: EmployeeDetailProps) {
  const [activeTab, setActiveTab] = useState(0);

  const maskString = (str?: string | null, visibleCount = 4) => {
    if (!str) return "N/A";
    if (str.length <= visibleCount) return str;
    return "*".repeat(str.length - visibleCount) + str.slice(-visibleCount);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    terminated: "bg-red-100 text-red-800",
    on_notice: "bg-yellow-100 text-yellow-800",
  };

  const tabs = [
    { name: "Personal", icon: User },
    { name: "Address & Emergency", icon: MapPin },
    { name: "Employment", icon: Briefcase },
    { name: "Bank & Identity", icon: CreditCard },
    { name: "Documents", icon: FileText },
  ];

  const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="mb-4">
      <dt className="text-sm font-medium text-slate-500 mb-1">{label}</dt>
      <dd className="text-sm text-slate-900">{value || "N/A"}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-2xl font-bold">
            {employee.first_name[0]}{employee.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {employee.first_name} {employee.last_name}
            </h1>
            <div className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
              <span>{employee.designation || "No Designation"}</span>
              <span>&bull;</span>
              <span>{employee.department?.name || "No Department"}</span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className={`px-2.5 py-0.5 rounded-full font-medium text-xs ${statusColors[employee.status]}`}>
                {employee.status.replace("_", " ").toUpperCase()}
              </span>
              <span className="text-slate-500 border border-slate-200 rounded px-2 py-0.5 bg-slate-50">
                {employee.employee_id}
              </span>
            </div>
          </div>
        </div>
        
        {role === "ceo" && (
          <Link
            href={`/dashboard/employees/${employee.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit Employee
          </Link>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.name}
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

        <div className="p-6">
          {/* Personal */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
              <DetailItem label="First Name" value={employee.first_name} />
              <DetailItem label="Last Name" value={employee.last_name} />
              <DetailItem label="Email" value={employee.email} />
              <DetailItem label="Phone" value={employee.phone} />
              <DetailItem label="Date of Birth" value={formatDate(employee.date_of_birth)} />
              <DetailItem label="Gender" value={<span className="capitalize">{employee.gender || "N/A"}</span>} />
              <DetailItem label="Blood Group" value={employee.blood_group} />
              <DetailItem label="Marital Status" value={<span className="capitalize">{employee.marital_status || "N/A"}</span>} />
            </div>
          )}

          {/* Address & Emergency */}
          {activeTab === 1 && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b">Current Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                  <div className="md:col-span-2">
                    <DetailItem label="Address" value={employee.address} />
                  </div>
                  <DetailItem label="City" value={employee.city} />
                  <DetailItem label="State" value={employee.state} />
                  <DetailItem label="Pincode" value={employee.pincode} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                  <DetailItem label="Name" value={employee.emergency_contact_name} />
                  <DetailItem label="Phone" value={employee.emergency_contact_phone} />
                  <DetailItem label="Relation" value={employee.emergency_contact_relation} />
                </div>
              </div>
            </div>
          )}

          {/* Employment */}
          {activeTab === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
              <DetailItem label="Employee ID" value={employee.employee_id} />
              <DetailItem label="Department" value={employee.department?.name} />
              <DetailItem label="Designation" value={employee.designation} />
              <DetailItem label="Employment Type" value={<span className="capitalize">{employee.employment_type?.replace("-", " ") || "N/A"}</span>} />
              <DetailItem label="Joining Date" value={formatDate(employee.joining_date)} />
              <DetailItem label="Probation End Date" value={formatDate(employee.probation_end_date)} />
              <DetailItem label="Confirmation Date" value={formatDate(employee.confirmation_date)} />
              <DetailItem label="Reporting Manager" value={employee.reporting_manager} />
              <DetailItem label="Work Location" value={employee.work_location} />
              <div className="md:col-span-3">
                <DetailItem label="Notes" value={employee.notes} />
              </div>
            </div>
          )}

          {/* Bank & Identity */}
          {activeTab === 3 && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b">Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                  <DetailItem label="Salary" value={employee.salary ? `₹${employee.salary.toLocaleString('en-IN')}` : "N/A"} />
                  <DetailItem label="Bank Name" value={employee.bank_name} />
                  <DetailItem label="Bank Account Number" value={maskString(employee.bank_account_number, 4)} />
                  <DetailItem label="IFSC Code" value={employee.ifsc_code} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b">Identity Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                  <DetailItem label="PAN Number" value={maskString(employee.pan_number, 4)} />
                  <DetailItem label="Aadhar Number" value={maskString(employee.aadhar_number, 4)} />
                  <DetailItem label="UAN Number" value={employee.uan_number} />
                  <DetailItem label="ESI Number" value={employee.esi_number} />
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          {activeTab === 4 && (
            <div>
              <DocumentUpload
                employeeId={employee.id}
                documents={documents || []}
                canUpload={role === "ceo" || role === "hr"}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
