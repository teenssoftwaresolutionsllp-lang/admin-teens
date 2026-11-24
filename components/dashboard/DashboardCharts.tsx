"use client";

import DepartmentEmployeesWidget from "./DepartmentEmployeesWidget";
import { Employee } from "@/lib/types";

interface DashboardChartsProps {
  employees: Employee[];
}

export default function DashboardCharts({ employees }: DashboardChartsProps) {
  return <DepartmentEmployeesWidget employees={employees} />;
}

export { DepartmentEmployeesWidget };
