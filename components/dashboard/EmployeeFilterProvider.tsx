"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

type DashboardEmployeeFilter = {
  status: "active";
  departmentId: string | null;
  departmentName: string;
};

type EmployeeFilterContextType = {
  dashboardFilter: DashboardEmployeeFilter | null;
  applyDashboardFilter: (filter: DashboardEmployeeFilter) => void;
  clearDashboardFilter: () => void;
};

const EmployeeFilterContext =
  createContext<EmployeeFilterContextType | undefined>(undefined);

export function EmployeeFilterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [dashboardFilter, setDashboardFilter] =
    useState<DashboardEmployeeFilter | null>(null);

  const applyDashboardFilter = useCallback(
    (filter: DashboardEmployeeFilter) => {
      setDashboardFilter(filter);
    },
    []
  );

  const clearDashboardFilter = useCallback(() => {
    setDashboardFilter(null);
  }, []);

  const value = useMemo(
    () => ({
      dashboardFilter,
      applyDashboardFilter,
      clearDashboardFilter,
    }),
    [dashboardFilter, applyDashboardFilter, clearDashboardFilter]
  );

  return (
    <EmployeeFilterContext.Provider value={value}>
      {children}
    </EmployeeFilterContext.Provider>
  );
}

export function useEmployeeDashboardFilter() {
  const context = useContext(EmployeeFilterContext);

  if (!context) {
    throw new Error(
      "useEmployeeDashboardFilter must be used inside EmployeeFilterProvider"
    );
  }

  return context;
}
