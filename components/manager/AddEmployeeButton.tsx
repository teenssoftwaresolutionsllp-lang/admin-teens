
"use client";

import { useState } from "react";

type Employee = {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Project = {
  id: string;
  name: string;
};

export default function AddEmployeeButton() {
  const [isOpen, setIsOpen] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function openModal() {
    setIsOpen(true);
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/manager", {
        method: "GET",
        cache: "no-store",
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          "API returned an invalid response. Please check your route."
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load data.");
      }

      setEmployees(result.employees || []);
      setProjects(result.projects || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!employeeId || !projectId) {
      setError("Please select an employee and a project.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          projectId,
        }),
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          "API returned an invalid response. Please check your route."
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Employee assignment failed.");
      }

      setSuccess("Employee assigned successfully!");

      setEmployeeId("");
      setProjectId("");

      setTimeout(() => {
        setIsOpen(false);
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add Employee
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Add Employee
              </h2>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-2xl text-gray-500 hover:text-gray-800"
              >
                ×
              </button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Loading employees and projects...
              </p>
            ) : (
              <div className="space-y-4">

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Employee Name
                  </label>

                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500"
                  >
                    <option value="">Select Employee</option>

                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name} (
                        {employee.employee_id})
                      </option>
                    ))}
                  </select>

                  {employees.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      No unassigned employees available.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Project Allocation
                  </label>

                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500"
                  >
                    <option value="">Select Project</option>

                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>

                  {projects.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      No projects available.
                    </p>
                  )}
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </p>
                )}

                {success && (
                  <p className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
                    {success}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={saving || employees.length === 0 || projects.length === 0}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Assigning..." : "Assign Employee"}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
