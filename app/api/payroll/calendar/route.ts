import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";

// =========================================================
// HELPERS
// =========================================================

function getMonthDates(
  year: number,
  month: number
) {
  const monthStart =
    `${year}-${String(month).padStart(2, "0")}-01`;

  const daysInMonth =
    new Date(year, month, 0).getDate();

  const monthEnd =
    `${year}-${String(month).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;

  return {
    monthStart,
    monthEnd,
    daysInMonth,
  };
}

// =========================================================
// RESOLVE EMPLOYEE CALENDAR
// =========================================================

async function getEmployeeCalendarId(
  employeeId: string
): Promise<string | null> {
  const supabase =
    await createAdminClient();

  const {
    data: employee,
    error: employeeError,
  } = await supabase
    .from("employees")
    .select("id, project_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) {
    throw new Error(
      `Failed to load employee: ${employeeError.message}`
    );
  }

  if (!employee) {
    throw new Error(
      "Employee not found"
    );
  }

  if (!employee.project_id) {
    return null;
  }

  const {
    data: project,
    error: projectError,
  } = await supabase
    .from("projects")
    .select("calendar_id")
    .eq("id", employee.project_id)
    .maybeSingle();

  if (projectError) {
    throw new Error(
      `Failed to load project calendar: ${projectError.message}`
    );
  }

  return project?.calendar_id || null;
}

// =========================================================
// GET
//
// GET /api/payroll/calendar
// ?employeeId=xxx&month=10&year=2026
// =========================================================

export async function GET(
  request: Request
) {
  try {
    // -------------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------------

    const supabase =
      await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // -------------------------------------------------------
    // QUERY PARAMETERS
    // -------------------------------------------------------

    const { searchParams } =
      new URL(request.url);

    const employeeId =
      searchParams.get(
        "employeeId"
      );

    const month =
      Number(
        searchParams.get("month")
      );

    const year =
      Number(
        searchParams.get("year")
      );

    if (!employeeId) {
      return NextResponse.json(
        {
          error:
            "Employee ID is required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid month",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid year",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------------
    // GET EMPLOYEE CALENDAR
    // -------------------------------------------------------

    const calendarId =
      await getEmployeeCalendarId(
        employeeId
      );

    // -------------------------------------------------------
    // DATE RANGE
    // -------------------------------------------------------

    const {
      monthStart,
      monthEnd,
      daysInMonth,
    } = getMonthDates(
      year,
      month
    );

    const adminSupabase =
      await createAdminClient();

    // -------------------------------------------------------
    // LOAD HOLIDAYS
    // -------------------------------------------------------

    let holidayQuery =
      adminSupabase
        .from("holidays")
        .select(`
          id,
          calendar_id,
          holiday_date,
          title,
          is_optional,
          is_working_day
        `)
        .gte(
          "holiday_date",
          monthStart
        )
        .lte(
          "holiday_date",
          monthEnd
        );

    if (calendarId) {
      holidayQuery =
        holidayQuery.eq(
          "calendar_id",
          calendarId
        );
    } else {
      holidayQuery =
        holidayQuery.is(
          "calendar_id",
          null
        );
    }

    const {
      data: holidays,
      error: holidayError,
    } = await holidayQuery.order(
      "holiday_date",
      {
        ascending: true,
      }
    );

    if (holidayError) {
      throw new Error(
        `Failed to load holidays: ${holidayError.message}`
      );
    }

    // -------------------------------------------------------
    // WORKING SATURDAYS
    // -------------------------------------------------------

    const workingSaturdays =
      await DataStore.getWorkingSaturdays(
        year,
        month,
        calendarId
      );

    // -------------------------------------------------------
    // BUILD CALENDAR DAYS
    // -------------------------------------------------------

    const days = [];

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      const date =
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const currentDate =
        new Date(
          `${date}T00:00:00`
        );

      const dayOfWeek =
        currentDate.getDay();

      const holidaysForDate =
        (holidays || []).filter(
          (holiday: any) =>
            String(
              holiday.holiday_date
            ).slice(0, 10) === date
        );

      const isSunday =
        dayOfWeek === 0;

      const isSaturday =
        dayOfWeek === 6;

      const isWorkingSaturday =
        isSaturday &&
        workingSaturdays.includes(
          day
        );

      const isNormalHoliday =
        holidaysForDate.some(
          (holiday: any) =>
            holiday.is_working_day !==
              true &&
            holiday.is_optional !==
              true
        );

      let isWorkingDay = true;

      // Sunday
      if (isSunday) {
        isWorkingDay = false;
      }

      // Saturday
      if (
        isSaturday &&
        !isWorkingSaturday
      ) {
        isWorkingDay = false;
      }

      // Company holiday
      if (isNormalHoliday) {
        isWorkingDay = false;
      }

      // Working Saturday override
      if (
        isWorkingSaturday
      ) {
        isWorkingDay = true;
      }

      days.push({
        date,
        day,
        dayName:
          currentDate.toLocaleDateString(
            "en-US",
            {
              weekday: "short",
            }
          ),
        dayOfWeek,
        isSunday,
        isSaturday,
        isWorkingSaturday,
        isWorkingDay,
        holidays:
          holidaysForDate,
      });
    }

    // -------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------

    const workingDays =
      days.filter(
        (day) =>
          day.isWorkingDay
      ).length;

    const holidaysCount =
      days.filter(
        (day) =>
          !day.isWorkingDay
      ).length;

    return NextResponse.json({
      success: true,

      employeeId,

      calendarId,

      month,

      year,

      monthStart,

      monthEnd,

      daysInMonth,

      workingDays,

      holidaysCount,

      workingSaturdays,

      holidays:
        holidays || [],

      days,
    });
  } catch (error: any) {
    console.error(
      "Payroll calendar GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to load payroll calendar",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST
//
// POST /api/payroll/calendar
//
// {
//   employeeId: "...",
//   date: "2026-10-10",
//   enabled: true
// }
// =========================================================

export async function POST(
  request: Request
) {
  try {
    // -------------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------------

    const supabase =
      await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // -------------------------------------------------------
    // REQUEST BODY
    // -------------------------------------------------------

    const body =
      await request.json();

    const {
      employeeId,
      date,
      enabled,
    } = body;

    if (!employeeId) {
      return NextResponse.json(
        {
          error:
            "Employee ID is required",
        },
        {
          status: 400,
        }
      );
    }

    if (!date) {
      return NextResponse.json(
        {
          error:
            "Date is required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof enabled !==
      "boolean"
    ) {
      return NextResponse.json(
        {
          error:
            "Enabled must be true or false",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------------
    // VALIDATE DATE
    // -------------------------------------------------------

    const selectedDate =
      new Date(
        `${date}T00:00:00`
      );

    if (
      Number.isNaN(
        selectedDate.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid date",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------------
    // ONLY SATURDAY
    // -------------------------------------------------------

    if (
      selectedDate.getDay() !== 6
    ) {
      return NextResponse.json(
        {
          error:
            "Only Saturdays can be changed",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------------
    // GET EMPLOYEE CALENDAR
    // -------------------------------------------------------

    const calendarId =
      await getEmployeeCalendarId(
        employeeId
      );

    // -------------------------------------------------------
    // SAVE
    // -------------------------------------------------------

    await DataStore.setWorkingSaturday(
      date,
      enabled,
      calendarId
    );

    // -------------------------------------------------------
    // RETURN UPDATED DATA
    // -------------------------------------------------------

    const selectedYear =
      selectedDate.getFullYear();

    const selectedMonth =
      selectedDate.getMonth() + 1;

    const workingSaturdays =
      await DataStore.getWorkingSaturdays(
        selectedYear,
        selectedMonth,
        calendarId
      );

    return NextResponse.json({
      success: true,

      employeeId,

      calendarId,

      date,

      enabled,

      workingSaturdays,
    });
  } catch (error: any) {
    console.error(
      "Payroll calendar POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to update payroll calendar",
      },
      {
        status: 500,
      }
    );
  }
}