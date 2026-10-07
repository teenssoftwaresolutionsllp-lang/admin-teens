"use client";

import { Employee, EmployeeDocument, UserRole } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { toast } from "react-hot-toast";
import { User, MapPin, Briefcase, CreditCard, FileText, Gift, Edit, DeleteIcon, LaptopMinimal, Phone, File } from "lucide-react";
import Link from "next/link";
import { useEffect,useState } from "react";
import DocumentUpload from "./DocumentUpload";

interface EmployeeDetailProps {
  employee: Employee;
  documents: EmployeeDocument[];
  role: UserRole;
}

export default function EmployeeDetail({ employee, documents, role }: EmployeeDetailProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [gratuity, setGratuity] = useState<any>(null);
  const [gratuityLoading, setGratuityLoading] = useState(false);
  const [gratuityProcessing, setGratuityProcessing] = useState(false);
  const [gratuityConfirm, setGratuityConfirm] = useState(false);
  const [gratuityMessage, setGratuityMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showExitMenu, setShowExitMenu] = useState(false);
  const [exitAction, setExitAction] = useState< "resigned" | "laid_off" | "terminated" | null > (null);
  const handleExitAction = (action: "resigned" | "laid_off" | "terminated" | "deleted")=>{
    console.log("Selected action:", action);
  }
  const [exitReason, setExitReason] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [exitLoginDays, setExitLoginDays] = useState("45");
  const [exitDocument, setExitDocument] = useState<File | null>(null);

  const maskString = (str?: string | null, visibleCount = 4) => {
    if (!str) return "N/A";
    if (str.length <= visibleCount) return str;
    return "*".repeat(str.length - visibleCount) + str.slice(-visibleCount);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const loadGratuity = async () => {
    try {
      setGratuityLoading(true);

      const response = await fetch(
        `/api/employees/${employee.id}/gratuity`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load gratuity"
        );
      }

      setGratuity(result);
    } catch (error: any) {
      console.error("Gratuity load error:", error);
      toast.error(
        error.message || "Failed to load gratuity"
      );
    } finally {
      setGratuityLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 7) {
      loadGratuity();
    }
  }, [activeTab]);

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

  const handleConfirmExit = async () => {
    if (!exitAction) return;

    if (!exitReason.trim()) {
      toast.error("Please enter the reason");
      return;
    }

    if (!exitDocument) {
      toast.error("Please upload a supporting document");
      return;
    }

    if (!exitDate) {
      toast.error("Please select the exit date");
      return;
    }

    if (!employee?.id) {
      toast.error("Employee ID not found");
      return;
    }

    try {
      setIsLoading(true);

      const supabase = createClient();

      const fileExtension = exitDocument.name.split(".").pop() || "file";
      const fileName = `${crypto.randomUUID()}.${fileExtension}`;
      const filePath = `${employee.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-exit-documents")
        .upload(filePath, exitDocument);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: exitAction,
          exit_reason: exitReason.trim(),
          exit_document_url: filePath,
          exit_document_name: exitDocument.name,
          exit_date: exitDate,
          temporary_login_days: Number(exitLoginDays),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update employee");
      }

      toast.success("Employee exit updated successfully");

      setExitAction(null);
      setShowExitMenu(false);
      setExitReason("");
      setExitDate("");
      setExitDocument(null);

      router.refresh();
    } catch (error: any) {
      console.error("Exit employee error:", error);
      toast.error(error.message || "Failed to process employee exit");
    } finally {
      setIsLoading(false);
    }
  };

const isExitStatus = [
  "resigned",
  "laid_off",
  "terminated",
  "inactive",
].includes(employee.status?.toLowerCase());

  const tabs = [
    { name: "Personal", icon: User },
    { name: "Employment", icon: Briefcase },
    { name: "Bank & Identity", icon: CreditCard },
    { name: "Address & Emergency", icon: MapPin },
    { name: "Documentation", icon: FileText },
    { name:"Accessory Management", icon: LaptopMinimal},
    { name: "Statutory", icon: File},
    { name: "Gratuity", icon: Gift },

    ...(!isExitStatus ? [{ name: "Terminated", icon: DeleteIcon }] : []),
  ];

  const DetailTile = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100/90">
      <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 break-words">{value || "N/A"}</dd>
    </div>
  );

  const handleTakeGratuity = () => {
    setGratuityConfirm(true);
  };

  const processGratuity = async () => {
    if (!gratuityConfirm) return;

    setGratuityConfirm(false);

    try {
      setGratuityProcessing(true);

      const response = await fetch(
        `/api/employees/${employee.id}/gratuity`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to process gratuity"
        );
      }

      await loadGratuity();

      setGratuityMessage({
        type: "success",
        message: `Gratuity of ₹${Number(
          result.amount
        ).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
        })} processed successfully.`,
      });
    } catch (error: any) {
      console.error(
        "Gratuity processing error:",
        error
      );

      setGratuityMessage({
        type: "error",
        message:
          error.message ||
          "Failed to process gratuity",
      });
    } finally {
      setGratuityProcessing(false);
    }
  };

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
        
        {role === "ceo" || role === "hr" &&  !["resigned", "laid_off", "terminated", "inactive"].includes(employee.status?.toLowerCase()) &&(
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

          {/* Employment */}
          {activeTab === 1 && (
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
            </div>
          )}

          {/* Bank & Identity */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailTile label="Annual CTC" value={employee.salary ? `₹${employee.salary.toLocaleString('en-IN')}` : "N/A"} />
                  <DetailTile label="Bank Name" value={employee.bank_name} />
                  <DetailTile label="Bank Account Number" value={maskString(employee.bank_account_number, 4)} />
                  <DetailTile label="IFSC Code" value={employee.ifsc_code} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">Official Identification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailTile label="PAN Number" value={maskString(employee.pan_number, 4)} />
                  <DetailTile label="Aadhaar Number" value={maskString(employee.aadhar_number, 4)} />
                  <DetailTile label="Passport Number" value={maskString(employee.passport_number, 4)} />
                </div>
              </div>
            </div>
          )}

          {/* Address & Emergency */}
          {activeTab === 3 && (
            <div className="space-y-8">

              {/* ================= PERMANENT ADDRESS ================= */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Permanent Address
                    </h3>
                    <p className="text-xs text-slate-500">
                      Employee&apos;s permanent residential address
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <DetailTile
                      label="Address"
                      value={employee.permanent_address}
                    />
                  </div>

                  <DetailTile
                    label="City"
                    value={employee.permanent_city}
                  />

                  <DetailTile
                    label="State"
                    value={employee.permanent_state}
                  />

                  <DetailTile
                    label="Pincode"
                    value={employee.permanent_pincode}
                  />
                </div>
              </div>


              {/* ================= COMMUNICATION ADDRESS ================= */}
              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Communication Address
                    </h3>
                    <p className="text-xs text-slate-500">
                      Employee&apos;s current or temporary residential address
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <DetailTile
                      label="Address"
                      value={employee.temporary_address}
                    />
                  </div>

                  <DetailTile
                    label="City"
                    value={employee.temporary_city}
                  />

                  <DetailTile
                    label="State"
                    value={employee.temporary_state}
                  />

                  <DetailTile
                    label="Pincode"
                    value={employee.temporary_pincode}
                  />
                </div>
              </div>


              {/* ================= EMERGENCY CONTACTS ================= */}
              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-rose-600" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Emergency Contacts
                    </h3>
                    <p className="text-xs text-slate-500">
                      People to contact in case of an emergency
                    </p>
                  </div>
                </div>

                <div className="space-y-6">

                  {/* ================= CONTACT 1 ================= */}
                  <div className="rounded-xl border border-slate-200 p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-4">
                      Emergency Contact 1
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <DetailTile
                        label="Contact Name"
                        value={employee.emergency_contact_name}
                      />

                      <DetailTile
                        label="Relationship"
                        value={employee.emergency_contact_relation}
                      />

                      <DetailTile
                        label="Contact Phone"
                        value={employee.emergency_contact_phone}
                      />
                    </div>
                  </div>


                  {/* ================= CONTACT 2 ================= */}
                  <div className="rounded-xl border border-slate-200 p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-4">
                      Emergency Contact 2
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <DetailTile
                        label="Contact Name"
                        value={employee.emergency_contact_name_2}
                      />

                      <DetailTile
                        label="Relationship"
                        value={employee.emergency_contact_relation_2}
                      />

                      <DetailTile
                        label="Contact Phone"
                        value={employee.emergency_contact_phone_2}
                      />
                    </div>
                  </div>


                  {/* ================= CONTACT 3 ================= */}
                  <div className="rounded-xl border border-slate-200 p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-4">
                      Emergency Contact 3
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <DetailTile
                        label="Contact Name"
                        value={employee.emergency_contact_name_3}
                      />

                      <DetailTile
                        label="Relationship"
                        value={employee.emergency_contact_relation_3}
                      />

                      <DetailTile
                        label="Contact Phone"
                        value={employee.emergency_contact_phone_3}
                      />
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* Documents */}
          {activeTab === 4 && (
            <div>
              <DocumentUpload
                employeeId={employee.id}
                documents={documents}
                canUpload={false}
              />
            </div>
          )}


          {/* Tab 5: Accessory Management*/}
          {activeTab === 5 && (
            <div className="space-y-6">

              {/* Main Accessory */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">
                  Assigned Equipment
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                  <DetailTile
                    label="Accessory Type"
                    value={employee.accessory_type}
                  />

                  <DetailTile
                    label="Serial Number"
                    value={employee.accessory_serial}
                  />

                </div>
              </div>

              {/* Peripherals */}
              <div className="pt-5 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">
                  Peripherals
                </h3>

                {employee.peripherals && employee.peripherals.length > 0 ? (
                  <div className="space-y-3">

                    {employee.peripherals.map((item, index) => (
                      <div
                        key={index}
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

                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600">
                          Assigned
                        </span>
                      </div>
                    ))}

                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <p className="text-sm text-slate-500">
                      No peripherals assigned
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* {tab 6: options to selct eligabilty of pt ,tds} */}
          {activeTab === 6 && (
            <div className="space-y-6">

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-slate-400">
                  Statutory Eligibility
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                  {/* ESI */}
                  <DetailTile
                    label="ESI / Health Care Eligible"
                    value={
                      employee.esi_healthcare_eligible
                        ? "Yes"
                        : "No"
                    }
                  />

                  {employee.esi_healthcare_eligible && (
                    <DetailTile
                      label="ESI Number"
                      value={employee.esi_number}
                    />
                  )}

                  {/* PF */}
                  <DetailTile
                    label="P.F Eligible"
                    value={
                      employee.pf_eligible
                        ? "Yes"
                        : "No"
                    }
                  />

                  {employee.pf_eligible && (
                    <DetailTile
                      label="UAN Number"
                      value={employee.uan_number}
                    />
                  )}

                  {/* PT */}
                  <DetailTile
                    label="P.T Eligible"
                    value={
                      employee.pt_eligible
                        ? "Yes"
                        : "No"
                    }
                  />

                  {employee.pt_eligible && (
                    <DetailTile
                      label="P.T Number"
                      value={employee.pt_number}
                    />
                  )}

                  {/* TDS */}
                  <DetailTile
                    label="T.D.S Eligible"
                    value={
                      employee.tds_eligible
                        ? "Yes"
                        : "No"
                    }
                  />

                </div>
              </div>

            </div>
          )}

          {/* ================= GRATUITY ================= */}
          {activeTab === 7 && (
            <div className="space-y-6">

              {/* HEADER */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Gratuity
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Gratuity is automatically calculated based on
                  completed service and the latest basic salary.
                </p>
              </div>

              {gratuityLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Loading gratuity details...
                </div>
              ) : gratuity ? (
                <>
                  {/* =====================================================
                      SERVICE INFORMATION
                  ===================================================== */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                    <DetailTile
                      label="Joining Date"
                      value={formatDate(employee.joining_date)}
                    />

                    <DetailTile
                      label="Service Period"
                      value={gratuity.serviceYearsText}
                    />

                    <DetailTile
                      label="Gratuity Service Years"
                      value={`${gratuity.gratuityServiceYears} ${
                        gratuity.gratuityServiceYears === 1
                          ? "Year"
                          : "Years"
                      }`}
                    />

                    <DetailTile
                      label="Monthly Basic"
                      value={`₹${Number(
                        gratuity.monthlyBasic
                      ).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}`}
                    />

                  </div>

                  {/* =====================================================
                      CURRENT GRATUITY
                  ===================================================== */}
                  <div className="rounded-xl border border-slate-200 p-5">

                    <div className="flex items-center justify-between gap-4 mb-5">

                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {gratuity.serviceYearsText} Gratuity
                        </h4>

                        <p className="text-xs text-slate-500 mt-1">
                          Current gratuity based on actual service period.
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          gratuity.gratuity5YearTaken
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : gratuity.gratuityServiceYears >= 5
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                      >
                        {gratuity.gratuity5YearTaken
                          ? "Taken"
                          : gratuity.gratuityServiceYears >= 5
                          ? "Available"
                          : "Not Eligible"}
                      </span>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      {/* CURRENT AMOUNT */}
                      <DetailTile
                        label="Current Gratuity Amount"
                        value={
                          gratuity.gratuityServiceYears >= 5
                            ? `₹${Number(
                                gratuity.gratuityAmount
                              ).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}`
                            : "₹0.00"
                        }
                      />

                      {/* SERVICE YEARS */}
                      <DetailTile
                        label="Calculation Service"
                        value={
                          gratuity.gratuityServiceYears >= 5
                            ? `${gratuity.gratuityServiceYears} ${
                                gratuity.gratuityServiceYears === 1
                                  ? "Year"
                                  : "Years"
                              }`
                            : "Not Eligible"
                        }
                      />

                      {/* STATUS */}
                      <DetailTile
                        label="Status"
                        value={
                          gratuity.gratuity5YearTaken
                            ? "Taken"
                            : gratuity.gratuityServiceYears >= 5
                            ? "Available"
                            : "Not Eligible"
                        }
                      />

                    </div>

                    {/* ===================================================
                        TAKEN INFORMATION
                    =================================================== */}
                    {gratuity.gratuity5YearTaken && (
                      <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
                        Gratuity already taken on{" "}
                        {gratuity.gratuity5YearTakenDate
                          ? formatDate(
                              gratuity.gratuity5YearTakenDate
                            )
                          : "N/A"}
                        .
                        {gratuity.gratuity5YearTakenAmount
                          ? ` Amount: ₹${Number(
                              gratuity.gratuity5YearTakenAmount
                            ).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}.`
                          : ""}
                      </div>
                    )}

                    {/* ===================================================
                        TAKE GRATUITY
                    =================================================== */}
                    {!gratuity.gratuity5YearTaken &&
                      gratuity.gratuityServiceYears >= 5 &&
                      (role === "hr" || role === "ceo") && (
                        <button
                          type="button"
                          disabled={gratuityProcessing}
                          onClick={handleTakeGratuity}
                          className="mt-5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
                        >
                          {gratuityProcessing
                            ? "Processing..."
                            : "Take Gratuity"}
                        </button>
                      )}

                  </div>

                  {/* =====================================================
                      FORMULA
                  ===================================================== */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                    <p className="text-xs font-semibold text-slate-700">
                      Gratuity Calculation
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Monthly Basic × 15 × Gratuity Service Years ÷ 26
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Service of 6 months or more after a completed year
                      is rounded up to the next year for gratuity
                      calculation.
                    </p>

                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  Gratuity information is unavailable.
                </div>
              )}

            </div>
          )}

          {/* Delete */}
          {!isExitStatus && activeTab === 8 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-center text-slate-400"> Employee Exit </h3>

                <div className="flex justify-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowExitMenu(true)}
                    className="px-6 py-2.5 rounded-lg bg-[#4F46E5] text-white font-medium hover:bg-[#4338CA] disabled:opacity-50"
                  >
                    Employee Exit
                  </button>
                </div>
              </div>

              {showExitMenu && (
                <div className="border rounded-xl p-4 bg-white shadow-sm space-y-3">
                  <h4 className="font-semibold text-slate-900 text-center">
                    Select Exit Action
                  </h4>

                  <div className="flex justify-center gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setExitAction("resigned");
                        setShowExitMenu(false);
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-300"
                    >
                      Resign
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExitAction("laid_off");
                        setShowExitMenu(false);
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-300"
                    >
                      Lay Off
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                       setExitAction("terminated");
                       setShowExitMenu(false);
                      }}
                      className="px-6 py-2.5 rounded-lg bg-[#4F46E5] text-white font-medium hover:bg-[#4338CA] disabled:opacity-50"
                    >
                      Terminate
                    </button>
                  </div>
                </div>
              )}

              {exitAction && (
                <div className="border rounded-xl p-5 bg-white shadow-sm space-y-5">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    {exitAction === "resigned"
                      ? "Resignation Details"
                      : exitAction === "laid_off"
                      ? "Lay Off Details"
                      : "Termination Details"}
                  </h4>

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Reason <span className="text-red-500">*</span>
                    </label>

                    <textarea
                      value={exitReason}
                      onChange={(e) => setExitReason(e.target.value)}
                      placeholder="Enter reason"
                      rows={4}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Supporting Document */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Supporting Document <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="file"
                      onChange={(e) => {
                        setExitDocument(e.target.files?.[0] || null);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />

                    {exitDocument && (
                      <p className="mt-2 text-sm text-slate-500">
                        Selected: {exitDocument.name}
                      </p>
                    )}
                  </div>

                  {/* Exit Date */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Exit Date <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="date"
                      value={exitDate}
                      onChange={(e) => setExitDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  {/* Login Access Period */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Login Access After Exit <span className="text-red-500">*</span>
                    </label>

                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="45"
                        value={exitLoginDays}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (value > 45) {
                            setExitLoginDays("45");
                            return;
                          }
                          else if(value < 0){
                            setExitLoginDays("0");
                            return;
                          }
                          setExitLoginDays(e.target.value);
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Enter number of days"
                      />

                      <span className="text-sm text-slate-500 whitespace-nowrap">
                        days
                      </span>
                    </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Maximum login access allowed is 45 days after exit.
                      </p>
                  </div>
                  {/* Confirm */}
                 <div className="flex justify-end gap-4 mt-4">
                  <button
                      type="button"
                      onClick={() => {
                        setExitAction(null);
                        setExitReason("");
                        setExitDate("");
                        setExitDocument(null);
                      }}
                      disabled={isLoading}
                      className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancle
                    </button>

                  
                    <button
                      type="button"
                      onClick={handleConfirmExit}
                      disabled={isLoading}
                      className="px-6 py-2.5 rounded-lg bg-[#4F46E5] text-white font-medium hover:bg-[#4338CA] disabled:opacity-50"
                    >
                      {isLoading
                        ? "Processing..."
                        : exitAction === "resigned"
                        ? "Confirm Resignation"
                        : exitAction === "laid_off"
                        ?"Confirm Lay Off"
                        :"Confirm Termination"
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* =========================================================
          GRATUITY CONFIRMATION MODAL
      ========================================================= */}
      {gratuityConfirm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">

          {/* FULL SCREEN BACKDROP */}
          <div
            className="absolute inset-0 bg-black/50"
            style={{
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          />

          {/* CONFIRMATION BOX */}
          <div className="relative z-10 w-[90%] max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-center">

              {/* ICON */}
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <span className="text-xl font-bold text-amber-600">
                  !
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900">
                Confirm Gratuity
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to process the
                <span className="font-semibold text-gray-900">
                  {" "}current gratuity amount
                </span>
                ?
              </p>

              {gratuity && (
                <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Service Period
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {gratuity.serviceYearsText}
                  </p>

                  <p className="mt-3 text-xs text-slate-500">
                    Gratuity Amount
                  </p>

                  <p className="mt-1 text-lg font-bold text-indigo-600">
                    ₹{Number(
                      gratuity.gratuityAmount
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-center gap-3">

                {/* CANCEL */}
                <button
                  type="button"
                  onClick={() => setGratuityConfirm(false)}
                  disabled={gratuityProcessing}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                {/* CONFIRM */}
                <button
                  type="button"
                  onClick={processGratuity}
                  disabled={gratuityProcessing}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {gratuityProcessing
                    ? "Processing..."
                    : "Confirm"}
                </button>

              </div>
            </div>
          </div>
        </div>
      )}
      {/* =========================================================
          GRATUITY RESULT MODAL
      ========================================================= */}
      {gratuityMessage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">

          {/* FULL SCREEN BACKDROP */}
          <div
            className="absolute inset-0 bg-black/50"
            style={{
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          />

          {/* RESULT BOX */}
          <div className="relative z-10 w-[90%] max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">

            {/* ICON */}
            <div
              className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                gratuityMessage.type === "success"
                  ? "bg-green-100"
                  : "bg-red-100"
              }`}
            >
              <span
                className={`text-2xl font-bold ${
                  gratuityMessage.type === "success"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {gratuityMessage.type === "success"
                  ? "✓"
                  : "!"}
              </span>
            </div>

            {/* TITLE */}
            <h3 className="text-lg font-semibold text-gray-900">
              {gratuityMessage.type === "success"
                ? "Gratuity Taken"
                : "Failed"}
            </h3>

            {/* MESSAGE */}
            <p className="mt-2 text-sm text-gray-600">
              {gratuityMessage.message}
            </p>

            {/* OK */}
            <button
              type="button"
              onClick={() => setGratuityMessage(null)}
              className={`mt-5 rounded-lg px-6 py-2.5 text-sm font-medium text-white ${
                gratuityMessage.type === "success"
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              OK
            </button>

          </div>
        </div>
      )}
    </div>
  );
}