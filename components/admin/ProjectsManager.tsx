"use client";

import { useState } from "react";
import { Project, HolidayCalendar, Employee } from "@/lib/types";
import { Globe, Plus, Clock, Calendar, CheckCircle2, XCircle, Users } from "lucide-react";

interface ProjectsManagerProps {
  initialProjects: Project[];
  calendars: HolidayCalendar[];
  employees: Employee[];
}

export default function ProjectsManager({
  initialProjects,
  calendars,
  employees,
}: ProjectsManagerProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCalendarTab, setSelectedCalendarTab] = useState<string>(calendars[0]?.id || "");

  const [formData, setFormData] = useState({
    name: "",
    client_country: "India",
    timezone: "Asia/Kolkata",
    calendar_id: calendars[0]?.id || "",
    shift_start_time: "09:00",
    shift_end_time: "18:00",
    grace_period_minutes: 30,
    half_day_cutoff_minutes: 150,
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    const newProj: Project = {
      id: "proj-" + Date.now(),
      ...formData,
      calendar: calendars.find((c) => c.id === formData.calendar_id),
    };
    setProjects([...projects, newProj]);
    setIsModalOpen(false);
    setFormData({
      name: "",
      client_country: "India",
      timezone: "Asia/Kolkata",
      calendar_id: calendars[0]?.id || "",
      shift_start_time: "09:00",
      shift_end_time: "18:00",
      grace_period_minutes: 30,
      half_day_cutoff_minutes: 150,
    });
  };

  const activeCalendar = calendars.find((c) => c.id === selectedCalendarTab) || calendars[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Projects, Shifts & Country Calendars</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage multi-country timelines, client shifts, and country holiday calendars. Employees inherit holidays and shift rules from their assigned project.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {projects.map((proj) => {
          const assignedCount = employees.filter((e) => e.project_id === proj.id).length;

          return (
            <div
              key={proj.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 uppercase">
                    {proj.client_country}
                  </span>
                  <span className="text-xs font-medium text-slate-400 font-mono">
                    {proj.timezone}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-2">{proj.name}</h3>

                <div className="mt-4 space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Shift Hours:</span>
                    <span className="font-semibold text-slate-800">
                      {proj.shift_start_time} - {proj.shift_end_time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Grace Period:</span>
                    <span className="font-semibold text-slate-800">
                      {proj.grace_period_minutes} mins
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Holiday Schedule:</span>
                    <span className="font-semibold text-indigo-700">
                      {proj.calendar?.name || "India Standard"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {assignedCount} {assignedCount === 1 ? "Employee" : "Employees"} Assigned
                  </span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-600">Active</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Country Holiday Calendars Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>Multi-Country Holiday Calendars</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Each country has distinct public holidays and gazetted calendar days.
            </p>
          </div>

          {/* Calendar Country Tabs */}
          <div className="flex gap-2">
            {calendars.map((cal) => (
              <button
                key={cal.id}
                onClick={() => setSelectedCalendarTab(cal.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  activeCalendar?.id === cal.id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {cal.country_name} ({cal.country_code})
              </button>
            ))}
          </div>
        </div>

        {/* Holidays List */}
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              {activeCalendar?.name} &bull; Timezone: {activeCalendar?.timezone}
            </span>
            <span className="text-[11px] text-slate-400">
              {activeCalendar?.holidays?.length || 0} Official Holidays in 2026
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCalendar?.holidays?.map((h) => (
              <div
                key={h.id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">{h.title}</span>
                  <span className="text-[11px] text-slate-500 font-mono">{h.holiday_date}</span>
                </div>
                <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  Holiday
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Create New Client Project</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. US Telecom Billing Suite"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Client Country</label>
                  <select
                    value={formData.client_country}
                    onChange={(e) => setFormData({ ...formData, client_country: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="India">India</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Holiday Calendar</label>
                  <select
                    value={formData.calendar_id}
                    onChange={(e) => setFormData({ ...formData, calendar_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  >
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    required
                    value={formData.shift_start_time}
                    onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Shift End Time</label>
                  <input
                    type="time"
                    required
                    value={formData.shift_end_time}
                    onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Grace Period (Minutes)</label>
                <input
                  type="number"
                  value={formData.grace_period_minutes}
                  onChange={(e) =>
                    setFormData({ ...formData, grace_period_minutes: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
