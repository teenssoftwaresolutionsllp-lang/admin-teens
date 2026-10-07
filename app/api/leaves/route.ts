import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { createClient } from "@/lib/supabase-server";

/* ============================================================
   HELPERS
============================================================ */

function normalize(value: any) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function getLeaveTypeCode(type: any) {
  return normalize(
    type?.code ??
      type?.leave_code ??
      type?.leaveCode ??
      type?.name ??
      ""
  );
}

function getLeaveTypeId(type: any) {
  return String(
    type?.id ??
      type?.leave_type_id ??
      type?.leaveTypeId ??
      ""
  );
}

function getRequestLeaveTypeId(request: any) {
  return String(
    request?.leave_type_id ??
      request?.leaveTypeId ??
      request?.leave_type?.id ??
      request?.leaveType?.id ??
      ""
  );
}

function getRequestLeaveTypeCode(request: any) {
  return normalize(
    request?.leave_type?.code ??
      request?.leave_type?.leave_code ??
      request?.leaveType?.code ??
      request?.leaveType?.leave_code ??
      request?.leave_type_code ??
      request?.leaveTypeCode ??
      ""
  );
}

/* ============================================================
   APPROVED LEAVE DAYS
============================================================ */

function getApprovedLeaveDays(request: any) {
  const isHalfDay =
    request?.is_half_day ??
    request?.isHalfDay ??
    false;

  if (Boolean(isHalfDay)) {
    return 0.5;
  }

  const value =
    request?.total_days ??
    request?.totalDays ??
    request?.days ??
    0;

  const days = Number(value);

  return Number.isFinite(days) && days > 0
    ? days
    : 0;
}

/* ============================================================
   LEAVE YEAR
============================================================ */

function getLeaveYear(request: any) {
  const startDate =
    request?.start_date ??
    request?.startDate;

  if (!startDate) {
    return null;
  }

  const date = new Date(startDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getFullYear();
}

/* ============================================================
   GET INITIAL / HR APPROVED ALLOCATION
============================================================ */

/*
 * IMPORTANT
 *
 * HR-controlled leave allocation comes from leave type
 * annual_quota.
 *
 * Example:
 *
 * SL annual_quota = 12
 * CL annual_quota = 12
 *
 * HR changes:
 *
 * SL annual_quota = 19
 *
 * Employee page will automatically show:
 *
 * SL = 19
 *
 * We do NOT hardcode 12 here.
 */
function getAllocatedDays(type: any) {
  const value =
    type?.annual_quota ??
    type?.annualQuota ??
    type?.allocated_days ??
    type?.allocatedDays ??
    type?.default_days ??
    type?.defaultDays;

  const number = Number(value);

  if (
    Number.isFinite(number) &&
    number >= 0
  ) {
    return number;
  }

  /*
   * Initial default values.
   *
   * These are used only when HR has not configured
   * annual_quota yet.
   */
  const code = getLeaveTypeCode(type);

  if (code === "SL") {
    return 12;
  }

  if (code === "CL") {
    return 12;
  }

  return 0;
}

/* ============================================================
   CALCULATE LEAVE BALANCES
============================================================ */

function calculateLeaveBalances(
  leaveTypes: any[],
  leaveRequests: any[],
  year: number
) {
  return leaveTypes.map((type) => {
    const typeId = getLeaveTypeId(type);
    const code = getLeaveTypeCode(type);

    /*
     * IMPORTANT:
     *
     * Do NOT hardcode SL/CL to 12.
     *
     * Read the allocation from HR's leave type.
     */
    const yearlyBalance =
      getAllocatedDays(type);

    /*
     * Only APPROVED leave requests
     * reduce the balance.
     */
    const usedDays = leaveRequests
      .filter((request) => {
        const status = normalize(
          request?.status
        );

        if (status !== "APPROVED") {
          return false;
        }

        /*
         * Match leave type by ID first.
         */
        const requestTypeId =
          getRequestLeaveTypeId(
            request
          );

        if (
          typeId &&
          requestTypeId
        ) {
          if (
            typeId !== requestTypeId
          ) {
            return false;
          }
        } else {
          /*
           * Fallback to leave type code.
           */
          const requestCode =
            getRequestLeaveTypeCode(
              request
            );

          if (
            !requestCode ||
            requestCode !== code
          ) {
            return false;
          }
        }

        /*
         * Only current year leaves
         * affect current year balance.
         */
        const requestYear =
          getLeaveYear(request);

        if (
          requestYear !== null &&
          requestYear !== year
        ) {
          return false;
        }

        return true;
      })
      .reduce(
        (total, request) =>
          total +
          getApprovedLeaveDays(
            request
          ),
        0
      );

    /*
     * Remaining balance.
     *
     * Example:
     *
     * HR allocation = 19
     * Approved used = 3
     * Remaining = 16
     */
    const remaining = Math.max(
      0,
      yearlyBalance - usedDays
    );

    return {
      ...type,

      code,

      /*
       * Keep both formats because
       * different components use different names.
       */
      leaveType: type,
      leave_type: type,

      /*
       * HR allocation
       */
      allocated: yearlyBalance,

      allocated_days: yearlyBalance,

      /*
       * Approved leave used
       */
      used: usedDays,

      used_days: usedDays,

      /*
       * Remaining leave
       */
      remaining,

      balance_days: remaining,

      available: remaining,

      available_days: remaining,

      availableDays: remaining,
    };
  });
}

/* ============================================================
   GET LEAVES
============================================================ */

export async function GET(
  request: Request
) {
  try {
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

    const { searchParams } =
      new URL(request.url);

    const employeeId =
      searchParams.get(
        "employeeId"
      ) || undefined;

    const year =
      new Date().getFullYear();

    /* ========================================================
       GET LEAVE REQUESTS
    ======================================================== */

    const requests =
      await DataStore.getLeaveRequests(
        employeeId
      );

    /* ========================================================
       GET LEAVE TYPES
    ======================================================== */

    const leaveTypes =
      await DataStore.getLeaveTypes();

    /* ========================================================
       CALCULATE BALANCES
    ======================================================== */

    /*
     * Every GET request recalculates the balance.
     *
     * Therefore:
     *
     * HR changes SL 12 -> 19
     *
     * Employee refreshes page
     *
     * Employee sees SL = 19
     *
     * Approved leave then reduces 19.
     */
    const leaveBalances =
      calculateLeaveBalances(
        leaveTypes ?? [],
        requests ?? [],
        year
      );

    return NextResponse.json(
      {
        success: true,

        requests:
          requests ?? [],

        leaveRequests:
          requests ?? [],

        leaveTypes:
          leaveTypes ?? [],

        leaveBalances,

        balances:
          leaveBalances,

        year,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "GET /api/leaves error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to load leave information",
      },
      {
        status: 500,
      }
    );
  }
}

/* ============================================================
   CREATE LEAVE
============================================================ */

export async function POST(
  request: Request
) {
  try {
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

    const body =
      await request.json();

    const {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      totalDays,
      isHalfDay,
      reason,
    } = body;

    /* ========================================================
       VALIDATION
    ======================================================== */

    if (
      !employeeId ||
      !leaveTypeId ||
      !startDate ||
      !endDate ||
      totalDays === undefined ||
      totalDays === null
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required leave fields",
        },
        {
          status: 400,
        }
      );
    }

    const numericDays =
      Number(totalDays);

    if (
      !Number.isFinite(
        numericDays
      ) ||
      numericDays <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid total leave days",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================================
       CREATE PENDING REQUEST
    ======================================================== */

    /*
     * IMPORTANT:
     *
     * Applying leave does NOT reduce balance.
     *
     * HR approval reduces balance.
     */
    const leaveRequest =
      await DataStore.createLeaveRequest(
        {
          employeeId,
          leaveTypeId,
          startDate,
          endDate,
          totalDays:
            numericDays,
          isHalfDay:
            Boolean(isHalfDay),
          reason:
            String(
              reason ||
                "Personal Leave"
            ).trim(),
        }
      );

    /* ========================================================
       RETURN UPDATED BALANCE
    ======================================================== */

    const requests =
      await DataStore.getLeaveRequests(
        employeeId
      );

    const leaveTypes =
      await DataStore.getLeaveTypes();

    const year =
      new Date().getFullYear();

    const leaveBalances =
      calculateLeaveBalances(
        leaveTypes ?? [],
        requests ?? [],
        year
      );

    return NextResponse.json(
      {
        success: true,

        request:
          leaveRequest,

        leaveRequest:
          leaveRequest,

        requests:
          requests ?? [],

        leaveRequests:
          requests ?? [],

        leaveTypes:
          leaveTypes ?? [],

        leaveBalances,

        balances:
          leaveBalances,

        year,
      },
      {
        status: 201,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "POST /api/leaves error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to create leave request",
      },
      {
        status: 500,
      }
    );
  }
}