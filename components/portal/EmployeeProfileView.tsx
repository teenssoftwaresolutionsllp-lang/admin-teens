"use client";

import { useState } from "react";
import { Employee, ProfileChangeRequest } from "@/lib/types";
import {
  User,
  MapPin,
  CreditCard,
  Briefcase,
  Edit3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Phone,
  Mail,
  Building,
} from "lucide-react";
import ProfileProgressBar from "./ProfileProgressBar";

interface EmployeeProfileViewProps {
  employee: Employee;
  pendingRequest: ProfileChangeRequest | null;
}

export default function EmployeeProfileView({
  employee,
  pendingRequest: initialPendingRequest,
}: EmployeeProfileViewProps) {
  const [activeTab, setActiveTab] = useState<"personal" | "address" | "bank" | "employment">("personal");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<ProfileChangeRequest | null>(initialPendingRequest);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state for editing
  const [editFormData, setEditFormData] = useState({
    phone: employee.phone || "",
    blood_group: employee.blood_group || "",
    marital_status: employee.marital_status || "single",
    address: employee.address || "",
    city: employee.city || "",
    state: employee.state || "",
    pincode: employee.pincode || "",
    emergency_contact_name: employee.emergency_contact_name || "",
    emergency_contact_phone: employee.emergency_contact_phone || "",
    emergency_contact_relation: employee.emergency_contact_relation || "",
    bank_name: employee.bank_name || "",
    bank_account_number: employee.bank_account_number || "",
    ifsc_code: employee.ifsc_code || "",
    pan_number: employee.pan_number || "",
    aadhar_number: employee.aadhar_number || "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/profile-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          requestedChanges: editFormData,
          previousValues: {
            phone: employee.phone,
            address: employee.address,
            bank_account_number: employee.bank_account_number,
            pan_number: employee.pan_number,
            aadhar_number: employee.aadhar_number,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPendingRequest(data.request);
        setIsEditModalOpen(false);
        setSuccessMessage("Your profile change request has been sent to HR for approval.");
      }
    } catch (err) {
      console.error("Submit edit error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Profile Completion Progress Bar */}
      <ProfileProgressBar employee={employee} />

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 2. Pending Change Request Banner (Maker-Checker Alert) */}
      {pendingRequest && pendingRequest.status === "pending" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-900">
                  Profile Edit Request Pending HR Approval
                </h4>
                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full uppercase">
                  Pending Review
                </span>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                You recently submitted changes to your profile. Once HR verifies and approves them,
                your employee master record and completion bar will automatically update.
              </p>

              <div className="mt-3 bg-white/80 p-3 rounded-lg border border-amber-200 text-xs text-slate-700 space-y-1">
                <span className="font-semibold text-slate-900 block mb-1">Requested modifications:</span>
                {Object.entries(pendingRequest.requested_changes)
                  .filter(([_, val]) => val !== null && val !== "")
                  .slice(0, 6)
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between border-b border-slate-100 py-1 last:border-0">
                      <span className="text-slate-500 capitalize">{key.replace(/_/g, " ")}:</span>
                      <span className="font-medium text-slate-800">{String(val)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 border-2 border-indigo-400/40 flex items-center justify-center text-white font-bold text-2xl shadow-inner shrink-0 backdrop-blur-xs">
              {employee.first_name[0]}
              {employee.last_name[0]}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {employee.first_name} {employee.last_name}
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                  {employee.status || "Active"}
                </span>
              </div>
              <p className="text-indigo-200 text-sm font-medium">
                {employee.designation || "Senior Software Engineer"} &bull; ID:{" "}
                <span className="font-mono font-bold text-white">{employee.employee_id}</span>
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-300" /> {employee.email}
                </span>
                {employee.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-indigo-300" /> {employee.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-300" /> {employee.work_location || "Hyderabad HQ"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all shrink-0 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Request Profile Edit</span>
          </button>
        </div>

        {/* Profile Tabs */}
        <div className="border-b border-slate-200 flex overflow-x-auto bg-slate-50/80 px-4 pt-2 gap-2">
          {[
            { id: "personal", label: "Personal Details", icon: User },
            { id: "address", label: "Address & Emergency", icon: MapPin },
            { id: "bank", label: "Bank & Statutory KYC", icon: CreditCard },
            { id: "employment", label: "Employment & Shift", icon: Briefcase },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="p-6 sm:p-8">
          {activeTab === "personal" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">First Name</span>
                <span className="font-bold text-slate-900 text-base">{employee.first_name}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Last Name</span>
                <span className="font-bold text-slate-900 text-base">{employee.last_name}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Official Email</span>
                <span className="font-medium text-slate-900 font-mono text-xs">{employee.email}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Phone Number</span>
                <span className="font-semibold text-slate-900">{employee.phone || "Not specified"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Date of Birth</span>
                <span className="font-semibold text-slate-900 font-mono">{employee.date_of_birth || "Not specified"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Gender</span>
                <span className="font-semibold text-slate-900 capitalize">{employee.gender || "Not specified"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Blood Group</span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">{employee.blood_group || "Not specified"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Marital Status</span>
                <span className="font-semibold text-slate-900 capitalize">{employee.marital_status || "Single"}</span>
              </div>
            </div>
          )}

          {activeTab === "address" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>Residential Address</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">
                  <div className="sm:col-span-2 md:col-span-3 p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Street Address</span>
                    <span className="font-semibold text-slate-800">{employee.address || "Not specified"}</span>
                  </div>
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">City</span>
                    <span className="font-semibold text-slate-800">{employee.city || "Not specified"}</span>
                  </div>
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">State</span>
                    <span className="font-semibold text-slate-800">{employee.state || "Not specified"}</span>
                  </div>
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Postal Pincode</span>
                    <span className="font-semibold text-slate-800 font-mono">{employee.pincode || "Not specified"}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200/80 pt-6">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-indigo-600" />
                  <span>Emergency Contact Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Contact Name</span>
                    <span className="font-bold text-slate-900">{employee.emergency_contact_name || "Not specified"}</span>
                  </div>
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Contact Phone</span>
                    <span className="font-semibold text-slate-900">{employee.emergency_contact_phone || "Not specified"}</span>
                  </div>
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Relationship</span>
                    <span className="font-semibold text-indigo-700">{employee.emergency_contact_relation || "Not specified"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "bank" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Bank Name</span>
                <span className="font-bold text-slate-900">{employee.bank_name || "Not specified"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Account Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {employee.bank_account_number ? `•••• •••• ${employee.bank_account_number.slice(-4)}` : "Not specified"}
                </span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">IFSC Code</span>
                <span className="font-mono font-bold text-indigo-700">{employee.ifsc_code || "Not specified"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">PAN Number</span>
                <span className="font-mono font-bold text-slate-900">{employee.pan_number || "Not specified"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Aadhaar Number</span>
                <span className="font-mono font-bold text-slate-900">
                  {employee.aadhar_number ? `•••• •••• ${employee.aadhar_number.slice(-4)}` : "Not specified"}
                </span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">UAN (PF Number)</span>
                <span className="font-mono font-bold text-slate-900">{employee.uan_number || "Auto-assigned by HR"}</span>
              </div>
            </div>
          )}

          {activeTab === "employment" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-sm">
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Department</span>
                <span className="font-bold text-slate-900">{employee.department?.name || "Engineering"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Designation</span>
                <span className="font-bold text-slate-900">{employee.designation || "Senior Software Engineer"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Employment Type</span>
                <span className="font-bold text-emerald-700 capitalize bg-emerald-50 px-2 py-0.5 rounded inline-block">{employee.employment_type || "Full-time"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Joining Date</span>
                <span className="font-mono font-semibold text-slate-900">{employee.joining_date || "2023-01-15"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Assigned Client Project</span>
                <span className="font-bold text-indigo-700">{employee.project?.name || "FinTech Enterprise Platform"}</span>
              </div>
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Shift Schedule</span>
                <span className="font-mono font-semibold text-slate-900">
                  {employee.project?.shift_start_time || "09:00"} - {employee.project?.shift_end_time || "18:00"} ({employee.project?.timezone || "Asia/Kolkata"})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Request Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Request Profile Update</h3>
                <p className="text-xs text-slate-500">
                  Edits will be submitted to HR for approval before updating the master record.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={editFormData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Blood Group</label>
                  <select
                    name="blood_group"
                    value={editFormData.blood_group}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Address</label>
                  <textarea
                    name="address"
                    rows={2}
                    value={editFormData.address}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={editFormData.city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={editFormData.pincode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    name="emergency_contact_name"
                    value={editFormData.emergency_contact_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Emergency Contact Phone</label>
                  <input
                    type="text"
                    name="emergency_contact_phone"
                    value={editFormData.emergency_contact_phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-2 border-t pt-3">
                  <h4 className="font-bold text-slate-800 text-xs mb-2">Bank & KYC Information</h4>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Bank Name</label>
                  <input
                    type="text"
                    name="bank_name"
                    value={editFormData.bank_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Account Number</label>
                  <input
                    type="text"
                    name="bank_account_number"
                    value={editFormData.bank_account_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">IFSC Code</label>
                  <input
                    type="text"
                    name="ifsc_code"
                    value={editFormData.ifsc_code}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">PAN Number</label>
                  <input
                    type="text"
                    name="pan_number"
                    value={editFormData.pan_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Aadhaar Number</label>
                  <input
                    type="text"
                    name="aadhar_number"
                    value={editFormData.aadhar_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit to HR for Approval</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
