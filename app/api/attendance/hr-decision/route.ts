import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase-server";

const ALLOWED_STATUSES = ["present", "absent", "half_day"] as const;

type DecisionStatus = (typeof ALLOWED_STATUSES)[number];


function indiaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getTimeInMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function getISTDateAtMinutes(date: string, minutes: number): Date {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, 0, minutes - 330)
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify logged-in user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Unauthorized. Please log in again.", 401);
    }

    const admin = await createAdminClient();

    // 2. Verify HR / CEO permission.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("HR decision profile lookup failed:", profileError);
      return errorResponse("Unable to verify user permissions.", 500);
    }

    if (!profile || !["hr", "ceo"].includes(profile.role)) {
      return errorResponse(
        "Only HR and CEO can submit attendance decisions.",
        403
      );
    }

    // 3. Validate request.
    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    const employeeId =
      typeof body.employeeId === "string" ? body.employeeId.trim() : "";

    const attendanceDate =
      typeof body.attendanceDate === "string"
        ? body.attendanceDate.trim()
        : "";

    const status = body.status as DecisionStatus;

    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        employeeId
      )
    ) {
      return errorResponse("Invalid employee ID.");
    }

    if (!isValidDate(attendanceDate)) {
      return errorResponse("Invalid attendance date.");
    }

    if (attendanceDate > indiaToday()) {
      return errorResponse(
        "Future attendance decisions are not allowed."
      );
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return errorResponse("Choose present, absent, or half_day.");
    }

    if (!reason || reason.length > 1000) {
      return errorResponse(
        "A reason is mandatory and must not exceed 1000 characters."
      );
    }

    // 4. Fetch employee eligibility information.
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select(
        "id, status, joining_date, exit_date, planned_last_working_date, project_id, shift_type, retained_calendar_id, retained_shift_start_time, retained_shift_end_time, shift_type"
      )
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup failed:", employeeError);
      return errorResponse("Unable to verify employee.", 500);
    }

    if (!employee) {
      return errorResponse("Employee not found.", 404);
    }

    if (!["active", "on_notice"].includes(employee.status)) {
      return errorResponse(
        "Attendance decisions are only allowed for active or on-notice employees."
      );
    }

    if (
      employee.joining_date &&
      employee.joining_date > attendanceDate
    ) {
      return errorResponse(
        "The employee had not joined on the selected attendance date."
      );
    }

    if (
      employee.exit_date &&
      employee.exit_date < attendanceDate
    ) {
      return errorResponse(
        "The selected attendance date is after the employee's exit date."
      );
    }

    if (
      employee.status === "on_notice" &&
      employee.planned_last_working_date &&
      attendanceDate > employee.planned_last_working_date
    ) {
      return errorResponse(
        "The selected date is after the employee's planned last working date."
      );
    }


    // 5. Resolve the employee's holiday calendar and shift.
    let calendarId: string | null = null;
    let shiftStartTime = "09:00";
    let shiftEndTime = "18:00";

    // Priority 1: Assigned project's actual calendar and timings.
    if (employee.project_id) {
      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("id, calendar_id, shift_start_time, shift_end_time")
        .eq("id", employee.project_id)
        .maybeSingle();

      if (projectError) {
        console.error("Project calendar lookup failed:", projectError);
        return errorResponse("Unable to verify project calendar.", 500);
      }

      if (!project) {
        return errorResponse(
          "The employee's assigned project could not be found. HR review is required.",
          409
        );
      }

      if (
        !project.calendar_id ||
        !project.shift_start_time ||
        !project.shift_end_time
      ) {
        return errorResponse(
          "The employee's assigned project has no holiday calendar or shift timings. HR review is required.",
          409
        );
      }

      calendarId = project.calendar_id;
      shiftStartTime = project.shift_start_time;
      shiftEndTime = project.shift_end_time;
    }

    // Priority 2: Retained project calendar and timings for bench employees.
    else if (
      employee.retained_calendar_id ||
      employee.retained_shift_start_time ||
      employee.retained_shift_end_time
    ) {
      if (
        !employee.retained_calendar_id ||
        !employee.retained_shift_start_time ||
        !employee.retained_shift_end_time
      ) {
        return errorResponse(
          "Retained project calendar or shift timings are incomplete. HR review is required.",
          409
        );
      }

      calendarId = employee.retained_calendar_id;
      shiftStartTime = employee.retained_shift_start_time;
      shiftEndTime = employee.retained_shift_end_time;
    }

    // Priority 3: Employee-level shift and matching India calendar.
    else {
      const shiftType =
        employee.shift_type === "night" ? "night" : "general";

      shiftStartTime =
        shiftType === "night" ? "18:30" : "09:00";

      shiftEndTime =
        shiftType === "night" ? "03:30" : "18:00";

      const { data: defaultCalendar, error: defaultCalendarError } =
        await admin
          .from("holiday_calendars")
          .select("id")
          .eq("country_code", "IN")
          .eq("shift_type", shiftType)
          .eq("calendar_year", Number(attendanceDate.slice(0, 4)))
          .maybeSingle();

      if (defaultCalendarError) {
        console.error(
          "Default India calendar lookup failed:",
          defaultCalendarError
        );
        return errorResponse(
          "Unable to verify the default India holiday calendar.",
          500
        );
      }

      calendarId = defaultCalendar?.id || null;
    }

    if (!calendarId) {
      return errorResponse(
        "No applicable holiday calendar was found. HR review is required.",
        409
      );
    }


    // Confirm that the selected calendar exists.
    const { data: calendar, error: calendarError } = await admin
      .from("holiday_calendars")
      .select("id")
      .eq("id", calendarId)
      .maybeSingle();

    if (calendarError) {
      console.error("Holiday calendar lookup failed:", calendarError);
      return errorResponse("Unable to verify holiday calendar.", 500);
    }

    if (!calendar) {
      return errorResponse(
        "The assigned holiday calendar does not exist. HR review is required.",
        409
      );
    }

    // 6. Check holiday and working-day rules.
    const { data: holiday, error: holidayError } = await admin
      .from("holidays")
      .select("id, title, is_working_day")
      .eq("calendar_id", calendarId)
      .eq("holiday_date", attendanceDate)
      .maybeSingle();

    if (holidayError) {
      console.error("Holiday lookup failed:", holidayError);
      return errorResponse("Unable to verify holiday.", 500);
    }

    if (holiday && holiday.is_working_day !== true) {
      return errorResponse(
        `Attendance decisions are not allowed on the non-working holiday: ${holiday.title}.`
      );
    }

    // A holiday explicitly marked as working overrides a weekend.
    if (!holiday && isWeekend(attendanceDate)) {
      return errorResponse(
        "Attendance decisions are not allowed on a weekend."
      );
    }

    // 7. Check approved leave covering this date.
    const { data: approvedLeaves, error: leaveError } = await admin
      .from("leave_requests")
      .select(
        "id, start_date, end_date, total_days, is_half_day, leave_duration"
      )
      .eq("employee_id", employeeId)
      .eq("status", "approved")
      .lte("start_date", attendanceDate)
      .gte("end_date", attendanceDate);

    if (leaveError) {
      console.error("Approved leave lookup failed:", leaveError);
      return errorResponse("Unable to verify approved leave.", 500);
    }

    if (approvedLeaves && approvedLeaves.length > 1) {
      return errorResponse(
        "Multiple approved leave requests overlap this date. Resolve the overlapping leave records before submitting an attendance decision.",
        409
      );
    }

    if (approvedLeaves?.length === 1) {
      const leave = approvedLeaves[0];

      const isSingleDay =
        leave.start_date === attendanceDate &&
        leave.end_date === attendanceDate;

      const isValidSingleDayHalfLeave =
        leave.is_half_day === true &&
        isSingleDay &&
        Number(leave.total_days) === 0.5 &&
        ["first_half", "second_half"].includes(
          leave.leave_duration ?? ""
        );
      if (leave.is_half_day === true && !isValidSingleDayHalfLeave) {
        return errorResponse(
          "This half-day leave has an ambiguous multi-day or duration pattern. HR review is required before recording attendance.",
          409
        );
      }

      if (!isValidSingleDayHalfLeave) {
        return errorResponse(
          "An approved full-day leave already covers this date. No attendance decision is required.",
          409
        );
      }

      // A valid single-day half-day leave may be explicitly reviewed
      // and decided by HR using the status submitted in this request.
    }

    // 8. Enforce the applicable 3-hour HR remark threshold.
    const shiftStartMinutes = getTimeInMinutes(shiftStartTime);
    let shiftEndMinutes = getTimeInMinutes(shiftEndTime);

    if (shiftEndMinutes <= shiftStartMinutes) {
      shiftEndMinutes += 1440;
    }

    let thresholdMinutes = shiftStartMinutes + 180;

    const approvedHalfLeave = approvedLeaves?.[0];

    if (approvedHalfLeave?.leave_duration === "first_half") {
      const shiftDuration = shiftEndMinutes - shiftStartMinutes;

      thresholdMinutes =
        shiftStartMinutes + Math.floor(shiftDuration / 2) + 180;
    }

    const thresholdTime = getISTDateAtMinutes(
      attendanceDate,
      thresholdMinutes
    );

    if (Date.now() < thresholdTime.getTime()) {
      return errorResponse(
        "HR remarks become available only after the applicable 3-hour attendance threshold.",
        403
      );
    }

    // 9. Approved regularization must not conflict with an HR decision.
    const { data: approvedRegularizations, error: regularizationError } =
      await admin
        .from("attendance_regularizations")
        .select("id")
        .eq("employee_id", employeeId)
        .eq("attendance_date", attendanceDate)
        .eq("status", "approved")
        .limit(1);

    if (regularizationError) {
      console.error("Regularization lookup failed:", regularizationError);
      return errorResponse(
        "Unable to check attendance regularization.",
        500
      );
    }

    if (approvedRegularizations?.length) {
      return errorResponse(
        "An approved regularization already exists for this date. Review that record instead.",
        409
      );
    }

    // 10. Check existing attendance.
    const { data: existing, error: attendanceError } = await admin
      .from("attendance_logs")
      .select(
        "id, check_in_time, session_check_in_time, hr_decision_by, is_regularized"
      )
      .eq("employee_id", employeeId)
      .eq("attendance_date", attendanceDate)
      .maybeSingle();

    if (attendanceError) {
      console.error("Attendance lookup failed:", attendanceError);
      return errorResponse(
        "Unable to check the attendance record.",
        500
      );
    }

    if (existing?.hr_decision_by) {
      return errorResponse(
        "An HR decision has already been saved for this employee and date.",
        409
      );
    }

    if (existing?.check_in_time || existing?.session_check_in_time) {
      return errorResponse(
        "The employee has already clocked in. Review the existing attendance record instead.",
        409
      );
    }

    if (existing?.is_regularized) {
      return errorResponse(
        "This attendance record is regularized. Review the regularization before changing it.",
        409
      );
    }

    // 11. Save decision and audit information.
    const decision = {
      status,
      hr_decision_by: user.id,
      hr_decision_at: new Date().toISOString(),
      hr_decision_reason: reason,
    };

    if (existing) {
      const { data: updated, error: updateError } = await admin
        .from("attendance_logs")
        .update(decision)
        .eq("id", existing.id)
        .is("hr_decision_by", null)
        .is("check_in_time", null)
        .is("session_check_in_time", null)
        .eq("is_regularized", false)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("HR decision update failed:", updateError);
        return errorResponse(
          "Unable to save the HR decision.",
          500
        );
      }

      if (!updated) {
        return errorResponse(
          "The attendance record changed while saving. Refresh and check the record.",
          409
        );
      }
    } else {
      const { error: insertError } = await admin
        .from("attendance_logs")
        .insert({
          employee_id: employeeId,
          attendance_date: attendanceDate,
          ...decision,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          return errorResponse(
            "An attendance record was created simultaneously. Refresh and check the record.",
            409
          );
        }

        console.error("HR decision insert failed:", insertError);
        return errorResponse(
          "Unable to save the HR decision.",
          500
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "HR attendance decision saved successfully.",
      decision: {
        employeeId,
        attendanceDate,
        status,
        reason,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("HR attendance decision API error:", error);

    return errorResponse(
      "Unexpected error while saving the HR decision.",
      500
    );
  }
}
