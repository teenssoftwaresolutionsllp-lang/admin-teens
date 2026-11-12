import { Employee, LeaveType } from "@/lib/types";

export function isLeaveTypeApplicable(
  leaveType: LeaveType,
  employee?: Employee | null
): boolean {
  const code = leaveType.code?.trim().toUpperCase();

  if (code === "ML") {
    return employee?.gender === "female";
  }

  if (code === "PL") {
    return employee?.gender === "male";
  }

  // CL, SL, EL, LOP and other general leave types
  // remain available to all employees.
  return true;
}

export function getApplicableLeaveTypes(
  leaveTypes: LeaveType[],
  employee?: Employee | null
): LeaveType[] {
  return leaveTypes.filter((leaveType) =>
    isLeaveTypeApplicable(leaveType, employee)
  );
}
