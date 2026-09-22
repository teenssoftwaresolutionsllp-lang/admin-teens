"use client";

import { Employee, EmployeeDocument, UserRole } from "@/lib/types";
import { User, MapPin, Briefcase, CreditCard, FileText, Download, Edit, Building, Calendar, Phone, Mail } from "lucide-react";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "terminated":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "on_notice":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const tabs = [
    { name: "Personal", icon: User },
    { name: "Address & Emergency", icon: MapPin },
    { name: "Employment", icon: Briefcase },
    { name: "Bank & Identity", icon: CreditCard },
    { name: "Documents", icon: FileText },
  ];

  const DetailTile = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100/90">
      <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 break-words">{value || "N/A"}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-5">
          <div className="w-18 h-18 sm:w-20 sm:h-20 bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-md shadow-indigo-100">
            {employee.first_name[0]}{employee.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {employee.first_name} {employee.last_name}
            </h1>
            <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-medium">
              <span className="text-indigo-600 font-semibold">{employee.designation || "No Designation"}</span>
              <span>&bull;</span>
              <span>{employee.department?.name || "General"}</span>
              <span>&bull;</span>
              <span className="font-mono text-slate-400">{employee.email}</span>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider border ${getStatusBadge(employee.status)}`}>
                {employee.status.replace("_", " ")}
              </span>
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                {employee.employee_id}
              </span>
            </div>
          </div>
        </div>
        
        {role === "ceo" && (
          <Link
            href={`/dashboard/employees/${employee.id}/edit`}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Profile</span>
          </Link>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-3 pt-2 overflow-x-auto gap-2">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === idx;
            return (
              <button
                key={tab.name}
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

        <div className="p-6 sm:p-7">
          {/* Personal */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <DetailTile label="First Name" value={employee.first_name} />
              <DetailTile label="Last Name" value={employee.last_name} />
              <DetailTile label="Email Address" value={employee.email} />
              <DetailTile label="Phone Number" value={employee.phone} />
              <DetailTile label="Date of Birth" value={formatDate(employee.date_of_birth)} />
              <DetailTile label="Gender" value={<span className="capitalize">{employee.gender || "N/A"}</span>} />
              <DetailTile label="Blood Group" value={employee.blood_group} />
              <DetailTile label="Marital Status" value={<span className="capitalize">{employee.marital_status || "N/A"}</span>} />
            </div>
          )}

          {/* Address & Emergency */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">Residential Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <DetailTile label="Address Line" value={employee.address} />
                  </div>
                  <DetailTile label="City" value={employee.city} />
                  <DetailTile label="State" value={employee.state} />
                  <DetailTile label="Pincode" value={employee.pincode} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailTile label="Contact Name" value={employee.emergency_contact_name} />
                  <DetailTile label="Phone Number" value={employee.emergency_contact_phone} />
                  <DetailTile label="Relationship" value={employee.emergency_contact_relation} />
                </div>
              </div>
            </div>
          )}

          {/* Employment */}
          {activeTab === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <DetailTile label="Employee ID" value={employee.employee_id} />
              <DetailTile label="Department" value={employee.department?.name} />
              <DetailTile label="Designation" value={employee.designation} />
              <DetailTile label="Employment Type" value={<span className="capitalize">{employee.employment_type?.replace("-", " ") || "N/A"}</span>} />
              <DetailTile label="Joining Date" value={formatDate(employee.joining_date)} />
              <DetailTile label="Probation End Date" value={formatDate(employee.probation_end_date)} />
              <DetailTile label="Confirmation Date" value={formatDate(employee.confirmation_date)} />
              <DetailTile label="Reporting Manager" value={employee.reporting_manager} />
              <DetailTile label="Work Location" value={employee.work_location} />
              {employee.notes && (
                <div className="md:col-span-3">
                  <DetailTile label="Internal Notes" value={employee.notes} />
                </div>
              )}
            </div>
          )}

          {/* Bank & Identity */}
          {activeTab === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailTile label="Monthly Fixed Salary" value={employee.salary ? `₹${employee.salary.toLocaleString('en-IN')}` : "N/A"} />
                  <DetailTile label="Bank Name" value={employee.bank_name} />
                  <DetailTile label="Bank Account Number" value={maskString(employee.bank_account_number, 4)} />
                  <DetailTile label="IFSC Code" value={employee.ifsc_code} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">Statutory & Identity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailTile label="PAN Number" value={maskString(employee.pan_number, 4)} />
                  <DetailTile label="Aadhaar Number" value={maskString(employee.aadhar_number, 4)} />
                  <DetailTile label="UAN Number" value={employee.uan_number} />
                  <DetailTile label="ESI Number" value={employee.esi_number} />
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

