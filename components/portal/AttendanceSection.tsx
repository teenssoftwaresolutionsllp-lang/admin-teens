"use client";

import { useState } from "react";

import AttendanceCalendar, {
  SelectedAttendance,
} from "@/components/portal/AttendanceCalendar";

import ClockInWidget from "@/components/portal/ClockInWidget";

import {
  AttendanceLog,
  LeaveRequest,
  Project,
} from "@/lib/types";

interface AttendanceSectionProps {
  attendanceLogs: AttendanceLog[];
  leaveRequests: LeaveRequest[];
  todayAttendance: AttendanceLog | null;
  employeeId: string;
  project?: Project;
}

export default function AttendanceSection({
  attendanceLogs,
  leaveRequests,
  todayAttendance,
  employeeId,
  project,
}: AttendanceSectionProps) {
  const today = new Date();

  const todayString = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Selected calendar date
  const [selectedDate, setSelectedDate] =
    useState<string>(todayString);

  // Selected date attendance details
  const [selectedAttendance, setSelectedAttendance] =
    useState<SelectedAttendance | null>(null);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_430px] gap-5 items-stretch">
      
      {/* Attendance Calendar */}
      <AttendanceCalendar
        logs={attendanceLogs}
        leaveRequests={leaveRequests}
        year={today.getFullYear()}
        month={today.getMonth()}
        onSelectedDateChange={setSelectedDate}
        onDateSelect={setSelectedAttendance}
      />

      {/* Clock In / Attendance Details */}
      <ClockInWidget
        employeeId={employeeId}
        initialLog={todayAttendance}
        project={project}
        compact
        selectedDate={selectedDate}
        selectedAttendance={selectedAttendance}
      />

    </div>
  );
}