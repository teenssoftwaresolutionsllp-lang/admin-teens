
import { NextResponse } from "next/server";
import { DataStore } from "@/lib/data-store";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SUPPORTING_DOCUMENT_BUCKET = "leave-medical-documents";
const MAX_SUPPORTING_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_SUPPORTING_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Calendar days: includes Saturdays and Sundays.
// Used for Maternity and Paternity leave.
function getInclusiveDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();

  return Math.floor((end - start) / 86400000) + 1;
}

// Working days: excludes Saturdays and Sundays.
// Used for regular leave types such as CL, SL, and LOP.
function getWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  let totalDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getUTCDay();

    if (day !== 0 && day !== 6) {
      totalDays++;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return totalDays;
}

function addCalendarDays(startDate: string, days: number): string {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

async function ensureSupportingDocumentBucket(
  admin: Awaited<ReturnType<typeof createAdminClient>>
) {
  const { data: buckets, error: listError } =
    await admin.storage.listBuckets();

  if (listError) {
    throw new Error(
      `Could not check supporting document storage: ${listError.message}`
    );
  }

  if (buckets?.some((bucket) => bucket.name === SUPPORTING_DOCUMENT_BUCKET)) {
    return;
  }

  const { error } = await admin.storage.createBucket(
    SUPPORTING_DOCUMENT_BUCKET,
    {
      public: false,
      fileSizeLimit: MAX_SUPPORTING_FILE_SIZE,
      allowedMimeTypes: [...ALLOWED_SUPPORTING_TYPES],
    }
  );

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(
      `Could not create supporting document storage: ${error.message}`
    );
  }
}

async function uploadSupportingDocument(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  employeeId: string,
  file: File
): Promise<{ path: string; name: string }> {
  if (file.size <= 0) {
    throw new Error("Please select a valid supporting document.");
  }

  if (file.size > MAX_SUPPORTING_FILE_SIZE) {
    throw new Error("Supporting document must be smaller than 5 MB.");
  }

  if (!ALLOWED_SUPPORTING_TYPES.has(file.type)) {
    throw new Error(
      "Upload a PDF, JPG, JPEG, or PNG supporting document."
    );
  }

  await ensureSupportingDocumentBucket(admin);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  const path = `${employeeId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await admin.storage
    .from(SUPPORTING_DOCUMENT_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Supporting document upload failed: ${error.message}`
    );
  }

  return {
    path,
    name: file.name,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get("employeeId") || undefined;

    const requests = await DataStore.getLeaveRequests(employeeId);
    const leaveTypes = await DataStore.getLeaveTypes();

    const leaveBalances = employeeId
      ? await DataStore.getLeaveBalances(employeeId)
      : [];

    return NextResponse.json(
      {
        success: true,
        requests,
        leaveRequests: requests,
        leaveTypes,
        leaveBalances,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    console.error("GET /api/leaves error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load leave information.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  let admin: Awaited<ReturnType<typeof createAdminClient>> | null = null;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    let body: Record<string, unknown>;
    let supportingFile: File | null = null;

    // Read multipart form data when the frontend uploads a document.
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      body = Object.fromEntries(
        Array.from(formData.entries())
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => [key, value])
      );

      const newFile = formData.get("supportingDocument");
      const oldFile = formData.get("medicalDocument");

      const fileValue = newFile || oldFile;

      if (fileValue instanceof File && fileValue.size > 0) {
        supportingFile = fileValue;
      }
    } else {
      body = await request.json();
    }

    const employeeId = String(body.employeeId || "");
    const leaveTypeId = String(body.leaveTypeId || "");

    const startDate = String(body.startDate || "");
    const endDate = String(body.endDate || "");

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    const isHalfDay =
      body.isHalfDay === true || body.isHalfDay === "true";

    const submittedDays = Number(body.totalDays);

    // This value is normalized to calendar days for maternity leave
    // after the leave type is identified.
    let days = submittedDays;

    const halfDayDuration =
      body.leaveDuration === "first_half" ||
      body.leaveDuration === "second_half"
        ? body.leaveDuration
        : null;

    const maternityDays = Number(
      body.maternityDays ?? body.specialLeaveDuration
    );

    const paternityDuration = Number(
      body.specialLeaveDuration
    );

    // Required field validation.
    if (
      !employeeId ||
      !leaveTypeId ||
      !startDate ||
      !endDate ||
      body.totalDays === undefined ||
      body.totalDays === null
    ) {
      return NextResponse.json(
        { error: "Missing required leave fields." },
        { status: 400 }
      );
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json(
        { error: "Please provide valid leave dates." },
        { status: 400 }
      );
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { error: "To Date cannot be before From Date." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(submittedDays) || submittedDays <= 0) {
      return NextResponse.json(
        { error: "Please select a valid leave duration." },
        { status: 400 }
      );
    }

    if (
      isHalfDay &&
      (startDate !== endDate ||
        submittedDays !== 0.5 ||
        !halfDayDuration)
    ) {
      return NextResponse.json(
        {
          error:
            "Half-day leave must be for one date, total 0.5 days, and specify First Half or Second Half.",
        },
        { status: 400 }
      );
    }

    // Find employee record.
    const employee = await DataStore.getEmployeeById(employeeId);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee record not found. Please contact HR." },
        { status: 404 }
      );
    }

    // Read the authenticated user's role.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    const role = profile?.role;

    const isOwnEmployee =
      employee.id === employeeId &&
      employee.user_id === user.id;

    const isAdmin =
      role === "hr" ||
      role === "ceo" ||
      role === "admin";

    if (!isOwnEmployee && !isAdmin) {
      console.error("Leave authorization failed:", {
        authUserId: user.id,
        employeeId,
        employeeUserId: employee.user_id,
        role,
      });

      return NextResponse.json(
        {
          error: "You are not authorized to submit leave for this employee.",
        },
        { status: 403 }
      );
    }

    // Check employee joining date.
    const joiningDate = employee.joining_date
      ? String(employee.joining_date).split("T")[0]
      : "";

    if (!isValidDate(joiningDate)) {
      return NextResponse.json(
        {
          error: "Your joining date is not available. Please contact HR.",
        },
        { status: 400 }
      );
    }

    if (startDate < joiningDate) {
      return NextResponse.json(
        {
          error: `You cannot apply for leave before your joining date (${joiningDate}).`,
        },
        { status: 400 }
      );
    }

    admin = await createAdminClient();

    // Read leave type from database.
    const { data: leaveType, error: leaveTypeError } = await admin
      .from("leave_types")
      .select("id, name, code, is_active")
      .eq("id", leaveTypeId)
      .maybeSingle();

    if (leaveTypeError) {
      throw new Error(leaveTypeError.message);
    }

    if (!leaveType || !leaveType.is_active) {
      return NextResponse.json(
        { error: "Invalid or inactive leave type." },
        { status: 400 }
      );
    }

    const code = String(leaveType.code).toUpperCase();

    // Calculate both calendar days and working days.
    const inclusiveDays = getInclusiveDays(startDate, endDate);
    const workingDays = getWorkingDays(startDate, endDate);

    // =====================================================
    // MATERNITY AND PATERNITY VALIDATIONS
    // =====================================================

    if (code === "ML" || code === "PL") {
      if (!supportingFile) {
        return NextResponse.json(
          {
            error:
              "Upload a supporting document for maternity or paternity leave.",
          },
          { status: 400 }
        );
      }

      if (isHalfDay) {
        return NextResponse.json(
          {
            error: "Maternity and paternity leave cannot be half-day.",
          },
          { status: 400 }
        );
      }

      // Always read gender from the database.
      const { data: employeeRecord, error: employeeError } = await admin
        .from("employees")
        .select("gender")
        .eq("id", employeeId)
        .maybeSingle();

      if (employeeError) {
        throw new Error(employeeError.message);
      }

      if (!employeeRecord) {
        return NextResponse.json(
          { error: "Employee record not found." },
          { status: 404 }
        );
      }

      const employeeGender = String(
        employeeRecord.gender || ""
      ).toLowerCase();

      // =====================================================
      // MATERNITY LEAVE
      // 3 months = 90 calendar days
      // 6 months = 180 calendar days
      // Weekends are included.
      // =====================================================

      if (code === "ML") {
        if (employeeGender !== "female") {
          return NextResponse.json(
            {
              error:
                "Maternity leave is available for female employees only.",
            },
            { status: 400 }
          );
        }

        if (![90, 180].includes(maternityDays)) {
          return NextResponse.json(
            {
              error:
                "Select maternity leave for 3 months (90 days) or 6 months (180 days).",
            },
            { status: 400 }
          );
        }

        // Calculate the expected end date using calendar days.
        const expectedEndDate = addCalendarDays(
          startDate,
          maternityDays - 1
        );

        // Validate the selected dates against the duration.
        if (
          inclusiveDays !== maternityDays ||
          endDate !== expectedEndDate
        ) {
          return NextResponse.json(
            {
              error: `For ${maternityDays} days of maternity leave, the end date must be ${expectedEndDate}.`,
            },
            { status: 400 }
          );
        }

        // Store maternity leave using calendar days,
        // not working days.
        days = maternityDays;
      }

      // =====================================================
      // PATERNITY LEAVE
      // =====================================================

      if (code === "PL") {
        if (employeeGender !== "male") {
          return NextResponse.json(
            {
              error:
                "Paternity leave is available for male employees only.",
            },
            { status: 400 }
          );
        }

        if (![2, 7, 14, 21, 28].includes(paternityDuration)) {
          return NextResponse.json(
            {
              error:
                "Select paternity leave for 2 days, 1, 2, 3, or 4 weeks.",
            },
            { status: 400 }
          );
        }

        if (
          inclusiveDays !== paternityDuration ||
          submittedDays !== paternityDuration
        ) {
          return NextResponse.json(
            {
              error:
                "Paternity leave duration must match the selected dates.",
            },
            { status: 400 }
          );
        }

        days = paternityDuration;
      }
    } else if (
      !isHalfDay &&
      Math.abs(days - workingDays) > 0.001
    ) {
      return NextResponse.json(
        {
          error:
            "Leave duration must match the selected working days (excluding Saturday and Sunday).",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CHECK OVERLAPPING LEAVE REQUESTS
    // Check pending and approved requests for this employee.
    // This applies to every leave type.
    // =====================================================

    const { data: overlappingLeaves, error: overlapError } =
      await admin
        .from("leave_requests")
        .select("id, leave_type_id, start_date, end_date, status")
        .eq("employee_id", employeeId)
        .in("status", ["pending", "approved"])
        .lte("start_date", endDate)
        .gte("end_date", startDate);

    if (overlapError) {
      throw new Error(
        `Could not validate existing leave dates: ${overlapError.message}`
      );
    }

    if (overlappingLeaves && overlappingLeaves.length > 0) {
      const conflictingLeave = overlappingLeaves[0];

      return NextResponse.json(
        {
          success: false,
          code: "LEAVE_DATE_OVERLAP",
          error:
            `You already have a ${conflictingLeave.status} leave request ` +
            `from ${conflictingLeave.start_date} to ${conflictingLeave.end_date}. ` +
            "You cannot apply for leave on overlapping dates.",
          overlappingLeaves,
        },
        { status: 409 }
      );
    }

    // Validate and upload an optional supporting document.
    // Upload happens only after overlap validation succeeds.
    let supportingDocumentName: string | null = null;

    if (supportingFile) {
      const uploaded = await uploadSupportingDocument(
        admin,
        employeeId,
        supportingFile
      );

      uploadedPath = uploaded.path;
      supportingDocumentName = uploaded.name;
    }

    // =====================================================
    // CREATE LEAVE REQUEST
    // =====================================================

    const leaveReq = await DataStore.createLeaveRequest({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      totalDays: days,
      isHalfDay,
      reason: reason || "Personal Leave",
      halfDayDuration: isHalfDay ? halfDayDuration : null,
      supportingDocumentUrl: uploadedPath || undefined,
      leaveDuration:
        code === "ML"
          ? maternityDays
          : code === "PL"
            ? paternityDuration
            : undefined,
      leaveDurationUnit:
        code === "ML" || code === "PL" ? "days" : undefined,
    });

    const leaveRequestId = (
      leaveReq as { id?: string }
    )?.id;

    if (!leaveRequestId) {
      throw new Error("Leave request ID was not returned.");
    }

    // =====================================================
    // NOTIFY HR USERS
    // =====================================================

    try {
      const { data: hrProfiles, error: hrProfilesError } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "hr");

      if (hrProfilesError) {
        throw new Error(hrProfilesError.message);
      }

      if (hrProfiles && hrProfiles.length > 0) {
        const notificationRows = hrProfiles.map((hrProfile) => ({
          recipient_user_id: hrProfile.id,
          title: "New Leave Request",
          message: `An employee has submitted a ${leaveType.name} leave request from ${startDate} to ${endDate}.`,
          type: "leave",
          is_read: false,
        }));

        const { error: notificationInsertError } = await admin
          .from("notifications")
          .insert(notificationRows);

        if (notificationInsertError) {
          throw new Error(notificationInsertError.message);
        }

        console.log(
          `Created leave notifications for ${hrProfiles.length} HR user(s).`
        );
      } else {
        console.warn(
          "No profiles with role 'hr' were found. Leave notification was not created."
        );
      }
    } catch (notificationError) {
      console.error(
        "HR leave notification creation failed:",
        notificationError
      );
    }

    // =====================================================
    // SAVE SUPPORTING DOCUMENT AND SPECIAL LEAVE DURATION
    // =====================================================

    const updateData: Record<string, unknown> = {};

    if (supportingFile && uploadedPath) {
      updateData.medical_document_url = uploadedPath;
      updateData.medical_document_name = supportingDocumentName;
    }

    if (code === "ML") {
      updateData.leave_duration = maternityDays;
      updateData.leave_duration_unit = "days";
    }

    if (code === "PL") {
      updateData.leave_duration = paternityDuration;
      updateData.leave_duration_unit = "days";
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await admin
        .from("leave_requests")
        .update(updateData)
        .eq("id", leaveRequestId);

      if (updateError) {
        throw new Error(
          `Could not save leave details: ${updateError.message}`
        );
      }
    }

    // =====================================================
    // SUCCESS RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        leaveRequest: {
          ...leaveReq,
          ...(supportingFile
            ? {
                medical_document_url: uploadedPath,
                medical_document_name: supportingDocumentName,
              }
            : {}),
          ...(code === "ML"
            ? {
                leave_duration: maternityDays,
                leave_duration_unit: "days",
              }
            : {}),
          ...(code === "PL"
            ? {
                leave_duration: paternityDuration,
                leave_duration_unit: "days",
              }
            : {}),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/leaves error:", error);

    // Remove uploaded document if leave creation/update fails.
    if (admin && uploadedPath) {
      try {
        await admin.storage
          .from(SUPPORTING_DOCUMENT_BUCKET)
          .remove([uploadedPath]);
      } catch (cleanupError) {
        console.error(
          "Supporting document cleanup error:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit leave application.",
      },
      { status: 500 }
    );
  }
}
