import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

class DuplicateEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateEmailError";
  }
}

type StatutoryDetails = {
  pf_eligible: boolean;
  uan_number: string | null;
  esi_healthcare_eligible: boolean;
  esi_number: string | null;
  pt_eligible: boolean;
  pt_number: string | null;
  tds_eligible: boolean;
};

function validateStatutoryDetails(body: any): StatutoryDetails {
  const booleanFields = [
    "pf_eligible",
    "esi_healthcare_eligible",
    "pt_eligible",
    "tds_eligible",
  ] as const;

  for (const field of booleanFields) {
    if (typeof body?.[field] !== "boolean") {
      throw new Error(`Invalid statutory value: ${field}.`);
    }
  }

  const optionalNumber = (field: string): string | null => {
    const value = body?.[field];

    if (value == null || value === "") return null;

    if (typeof value !== "string") {
      throw new Error(`Invalid statutory value: ${field}.`);
    }

    return value.trim() || null;
  };

  return {
    pf_eligible: body.pf_eligible,
    uan_number: body.pf_eligible ? optionalNumber("uan_number") : null,

    esi_healthcare_eligible: body.esi_healthcare_eligible,
    esi_number: body.esi_healthcare_eligible
      ? optionalNumber("esi_number")
      : null,

    pt_eligible: body.pt_eligible,
    pt_number: body.pt_eligible ? optionalNumber("pt_number") : null,

    tds_eligible: body.tds_eligible,
  };
}

async function getAuthorizedHr() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      error: "Unable to verify HR access.",
      status: 500 as const,
    };
  }

  if (profile?.role !== "hr") {
    return { error: "HR access required.", status: 403 as const };
  }

  return { admin, user };
}

function addMonths(dateString: string, months: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0)
  ).getUTCDate();

  return [
    targetYear,
    String(normalizedMonth + 1).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
}

function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validateOfficialEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();

  // Accept company email addresses only.
  // Restrict the local part to avoid wildcard characters in duplicate checks.
  const emailPattern =
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*@teenss\.com$/;

  if (!email || !emailPattern.test(email)) {
    throw new Error(
      "Enter a valid official company email ending with @teenss.com."
    );
  }

  return email;
}

async function checkAuthEmailExists(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  email: string
): Promise<boolean> {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(
        `Unable to verify whether ${email} is already registered: ${error.message}`
      );
    }

    const matchingUser = data.users.find(
      (user) => user.email?.toLowerCase() === email
    );

    if (matchingUser) {
      return true;
    }

    if (data.users.length < perPage) {
      return false;
    }

    page += 1;
  }
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const auth = await getAuthorizedHr();

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const { admin } = auth;
  const { id } = await context.params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    return NextResponse.json(
      { error: "Invalid candidate ID." },
      { status: 400 }
    );
  }

  // Read the official email supplied by HR.
  let email: string;
  let statutory: StatutoryDetails;

  try {
    const body = await request.json();
    email = validateOfficialEmail(body?.official_email);
    statutory = validateStatutoryDetails(body);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid request. Please provide an official company email.",
      },
      { status: 400 }
    );
  }

  try {
    const { data: candidate, error: candidateError } = await admin
      .from("joining_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (candidateError) throw candidateError;

    if (!candidate) {
      return NextResponse.json(
        { error: "Joining candidate not found." },
        { status: 404 }
      );
    }

    // Return the linked employee if conversion is already complete.
    if (
      candidate.conversion_status === "completed" &&
      candidate.employee_record_id
    ) {
      const { data: existingEmployee, error } = await admin
        .from("employees")
        .select("id, employee_id, first_name, last_name, email")
        .eq("id", candidate.employee_record_id)
        .maybeSingle();

      if (error) throw error;

      if (!existingEmployee) {
        return NextResponse.json(
          { error: "The linked employee record no longer exists." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        message: "This candidate has already been converted.",
        employee: existingEmployee,
        already_completed: true,
      });
    }

    if (candidate.status !== "joining_letter_sent") {
      return NextResponse.json(
        { error: "The candidate must have a sent joining letter." },
        { status: 409 }
      );
    }

    if (candidate.joining_letter_send_status !== "sent") {
      return NextResponse.json(
        { error: "The joining letter has not been confirmed as sent." },
        { status: 409 }
      );
    }

    if (!candidate.joining_date) {
      return NextResponse.json(
        { error: "The candidate's joining date is missing." },
        { status: 400 }
      );
    }

    if (
      ![0, 3, 6, 12].includes(
        Number(candidate.probation_period_months)
      )
    ) {
      return NextResponse.json(
        { error: "The candidate's probation duration is invalid." },
        { status: 400 }
      );
    }

    // Atomically claim this conversion to prevent concurrent processing.
    const { data: claimed, error: claimError } = await admin
      .from("joining_candidates")
      .update({
        conversion_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "joining_letter_sent")
      .eq("joining_letter_send_status", "sent")
      .in("conversion_status", ["not_started", "failed"])
      .is("employee_record_id", null)
      .select("*")
      .maybeSingle();

    if (claimError) throw claimError;

    if (!claimed) {
      const { data: latest, error } = await admin
        .from("joining_candidates")
        .select("conversion_status, employee_record_id")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (
        latest?.conversion_status === "completed" &&
        latest.employee_record_id
      ) {
        const { data: employee, error: employeeError } = await admin
          .from("employees")
          .select("id, employee_id, first_name, last_name, email")
          .eq("id", latest.employee_record_id)
          .maybeSingle();

        if (employeeError) throw employeeError;

        if (employee) {
          return NextResponse.json({
            message: "This candidate has already been converted.",
            employee,
            already_completed: true,
          });
        }
      }

      return NextResponse.json(
        {
          error:
            latest?.conversion_status === "processing"
              ? "Conversion is already in progress. Refresh in a moment."
              : "This candidate cannot be converted in the current state.",
        },
        { status: 409 }
      );

    }

    

    let employeeRecordId: string | null = null;
    let createdAuthUserId: string | null = null;

    try {
      const firstName = String(claimed.first_name ?? "").trim();
      const lastName = String(claimed.last_name ?? "").trim();

      if (!firstName || !lastName) {
        throw new Error(
          "The candidate's first name and last name are required."
        );
      }

      // The official email is supplied and confirmed by HR.
      // The candidate's personal email remains unchanged.

      // Check whether the email is already assigned to an employee.
      const { data: matchingEmployees, error: matchingError } =
        await admin
          .from("employees")
          .select("id, employee_id, first_name, last_name, email")
          .ilike("email", email)
          .limit(2);

      if (matchingError) throw matchingError;

      if ((matchingEmployees ?? []).length > 0) {
        throw new DuplicateEmailError(
          `The official email ${email} is already assigned to an employee. Please enter a different email.`
        );
      }

      // Check Supabase Auth as well, so an existing login is not reused.
      const authEmailExists = await checkAuthEmailExists(
        admin,
        email
      );

      if (authEmailExists) {
        throw new DuplicateEmailError(
          `The official email ${email} is already registered in the login system. Please enter a different email.`
        );
      }

      let departmentId: string | null = null;

      if (claimed.department) {
        const requestedDepartment = String(claimed.department).trim();

        // Map legacy department names to the existing department names.
        const departmentAliases: Record<string, string> = {
          "human resources": "HR",
        };

        const normalizedDepartment =
          departmentAliases[requestedDepartment.toLowerCase()] ??
          requestedDepartment;

        const { data: departments, error } = await admin
          .from("departments")
          .select("id, name")
          .ilike("name", normalizedDepartment)
          .limit(2);

        if (error) throw error;

        if ((departments ?? []).length > 1) {
          throw new Error(
            `Multiple departments match "${normalizedDepartment}".`
          );
        }

        departmentId = departments?.[0]?.id ?? null;

        if (!departmentId) {
          throw new Error(
            `Department "${normalizedDepartment}" was not found.`
          );
        }
      }

      // Actual joining date is the date HR clicks Confirm Joined (IST).
      const joiningDate = getTodayIST();

      const probationMonths = Number(
        claimed.probation_period_months
      );

      const probationEndDate = probationMonths > 0 ? addMonths(joiningDate, probationMonths) : null;

      // Create a separate Auth login for the employee.
      const { data: authData, error: authCreateError } =
        await admin.auth.admin.createUser({
          email,
          password: "Employee@123",
          email_confirm: true,
          user_metadata: {
            full_name: `${firstName} ${lastName}`.trim(),
            role: "employee",
          },
        });

      if (authCreateError) {
        if (
          authCreateError.message.toLowerCase().includes("already") ||
          authCreateError.message.toLowerCase().includes("exists")
        ) {
          throw new DuplicateEmailError(
            `The official email ${email} is already registered in the login system. Please enter a different email.`
          );
        }

        throw new Error(
          `Unable to create the employee login: ${authCreateError.message}`
        );
      }

      const authUser = authData.user;

      if (!authUser) {
        throw new Error("Unable to create the employee login.");
      }

      createdAuthUserId = authUser.id;

      const fullName = `${firstName} ${lastName}`.trim();

      const { error: profileError } = await admin
        .from("profiles")
        .upsert({
          id: authUser.id,
          email,
          full_name: fullName,
          role: "employee",
        });

      if (profileError) throw profileError;

      // annual_ctc is stored in rupees: ₹1,200,000 / 12 = ₹100,000.
      const annualCtcInRupees = Number(claimed.annual_ctc);

      if (
        !Number.isFinite(annualCtcInRupees) ||
        annualCtcInRupees < 0
      ) {
        throw new Error(
          "The candidate's annual CTC is invalid."
        );
      }

      // Do not pass employee_id. DataStore generates the next ID.
      const employee = await DataStore.createEmployee({
        user_id: authUser.id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: claimed.mobile_number,
        gender: claimed.gender || null,
        department_id: departmentId,
        designation: claimed.designation,
        employment_type:
          claimed.employment_type === "full_time"
            ? "full-time"
            : claimed.employment_type || "full-time",
        joining_date: joiningDate,
        probation_duration: probationMonths,
        probation_end_date: probationEndDate,
        appointment_date: joiningDate,
        work_location: claimed.work_location || null,
        salary: annualCtcInRupees,
        status: "active",
      } as any);

      if (!employee?.id || !employee?.employee_id) {
        throw new Error("Employee creation did not return a valid employee record and ID.");
      }

      employeeRecordId = employee.id;

      // Save statutory details against the newly created employee.
      const { error: statutoryUpdateError } = await admin
        .from("employees")
        .update({
          pf_eligible: statutory.pf_eligible,
          uan_number: statutory.uan_number,
          esi_healthcare_eligible: statutory.esi_healthcare_eligible,
          esi_number: statutory.esi_number,
          pt_eligible: statutory.pt_eligible,
          pt_number: statutory.pt_number,
          tds_eligible: statutory.tds_eligible,
        })
        .eq("id", employee.id);

      if (statutoryUpdateError) {
        throw new Error(`Employee was created, but statutory details could not be saved: ${statutoryUpdateError.message}`);
      }

      // Register the latest Offer Letter and Joining Letter
      // in employee_documents without duplicating Cloudinary files.

      const { data: joiningDocuments, error: joiningDocumentsError } = await admin
          .from("joining_documents")
          .select("id, document_type, version")
          .eq("candidate_id", claimed.id)
          .in("document_type", ["offer_letter", "joining_letter"])
          .order("version", { ascending: false });

      if (joiningDocumentsError) {
        throw new Error(
          `Unable to fetch joining documents: ${joiningDocumentsError.message}`
        );
      }

      const latestDocuments = new Map<string, (typeof joiningDocuments)[number]>();

      for (const document of joiningDocuments ?? []) {
        if (!latestDocuments.has(document.document_type)) {
          latestDocuments.set(document.document_type, document);
        }
      }

      for (const document of latestDocuments.values()) {
        const { data: existingDocument, error: existingError } = await admin
          .from("employee_documents")
          .select("id")
          .eq("source_joining_document_id", document.id)
          .maybeSingle();

        if (existingError) {
          throw new Error(
            `Unable to check existing employee document: ${existingError.message}`
          );
        }

        if (existingDocument) continue;

        const isOfferLetter = document.document_type === "offer_letter";

        const { error: insertError } = await admin
          .from("employee_documents")
          .insert({
            employee_id: employee.id,
            document_type: isOfferLetter ? "Offer Letter" : "Joining Letter",
            document_name: isOfferLetter
              ? "Offer Letter.pdf"
              : "Joining Letter.pdf",
            document_url: `joining-document://${document.id}`,
            source_joining_document_id: document.id,
            verification_status: "approved",
          });

        if (insertError && insertError.code !== "23505") {
          throw new Error(
            `Unable to register ${isOfferLetter ? "Offer Letter" : "Joining Letter"}: ${insertError.message}`
          );
        }
      }

      // Initialize missing default salary components without overwriting
      // any existing component values.
      const defaultCodes = [
        "BASIC",
        "HRA",
        "SPECIAL_ALLOWANCE",
        "PF",
        "ESI",
        "PT",
        "TDS",
      ];

      const { data: masters, error: mastersError } = await admin
        .from("salary_components")
        .select("id, calculation_type, value")
        .in("code", defaultCodes)
        .eq("is_active", true);

      if (mastersError) throw mastersError;

      if (masters?.length) {
        const { data: existingComponents, error: existingError } =
          await admin
            .from("employee_salary_components")
            .select("salary_component_id")
            .eq("employee_id", employee.id);

        if (existingError) throw existingError;

        const existingIds = new Set(
          (existingComponents ?? []).map(
            (component) => component.salary_component_id
          )
        );

        const missingComponents = masters
          .filter((component) => !existingIds.has(component.id))
          .map((component) => ({
            employee_id: employee.id,
            salary_component_id: component.id,
            calculation_type: component.calculation_type,
            value: Number(component.value || 0),
            is_active: true,
            gratuity_5_year_taken: false,
            gratuity_5_year_taken_date: null,
            gratuity_5_year_amount: 0,
            gratuity_10_year_taken: false,
            gratuity_10_year_taken_date: null,
            gratuity_10_year_amount: 0,
          }));

        if (missingComponents.length) {
          const { error: insertError } = await admin
            .from("employee_salary_components")
            .insert(missingComponents);

          if (insertError) throw insertError;
        }
      }

      // Initialize leave balances before marking the conversion complete.
      await DataStore.getLeaveBalances(employee.id);

      const { data: completed, error: completeError } = await admin
        .from("joining_candidates")
        .update({
          employee_record_id: employee.id,
          employee_id: employee.employee_id,
          conversion_status: "completed",
          status: "joined",
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("conversion_status", "processing")
        .is("employee_record_id", null)
        .select("id")
        .maybeSingle();

      if (completeError) throw completeError;

      if (!completed) {
        const { data: latest, error: latestError } = await admin
          .from("joining_candidates")
          .select("conversion_status, employee_record_id")
          .eq("id", id)
          .maybeSingle();

        if (latestError) throw latestError;

        if (
          latest?.conversion_status !== "completed" ||
          latest.employee_record_id !== employee.id
        ) {
          throw new Error(
            "Employee exists, but candidate linking failed. Manual reconciliation is required before retrying."
          );
        }
      }

      // Notify the HR user who created the joining candidate
      // and welcome the newly created employee.
      const candidateName = `${firstName} ${lastName}`.trim();

      const joiningNotifications = [
        ...(typeof claimed.created_by === "string"
          ? [
              {
                recipient_user_id: claimed.created_by,
                employee_id: null,
                title: "Candidate Joined",
                message: `${candidateName} has been confirmed as joined. Employee ID: ${employee.employee_id}.`,
                type: "joining",
                is_read: false,
              },
            ]
          : []),

        {
          recipient_user_id: authUser.id,
          employee_id: employee.id,
          title: "Welcome to Teens Software Solutions",
          message: `Your joining has been confirmed. Your employee ID is ${employee.employee_id}.`,
          type: "joining",
          is_read: false,
        },
      ];

      const { error: joiningNotificationError } = await admin
        .from("notifications")
        .insert(joiningNotifications);

      if (joiningNotificationError) {
        console.error(
          "Joining notification insert failed:",
          joiningNotificationError.message
        );
      }

      return NextResponse.json({
        message: "Candidate confirmed joined and employee record created.",
        employee: {
          id: employee.id,
          employee_id: employee.employee_id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
        },
      });
    } catch (error) {
      console.error("Confirm joined conversion failed:", error);

      // Do not reset a candidate after its employee has been linked.
      const { error: resetError } = await admin
        .from("joining_candidates")
        .update({
          conversion_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("conversion_status", "processing")
        .is("employee_record_id", null);

      if (resetError) {
        console.error(
          "Failed to mark conversion as failed:",
          resetError
        );
      }

      // If an Auth account was created but no employee record was created,
      // remove the orphaned account so a clean retry can be attempted.
      // Never delete the account if an employee record was created.
      if (createdAuthUserId && !employeeRecordId) {
        const { error: deleteAuthError } =
          await admin.auth.admin.deleteUser(createdAuthUserId);

        if (deleteAuthError) {
          console.error(
            "Failed to clean up orphaned Auth user:",
            deleteAuthError
          );
        } else {
          const { error: deleteProfileError } = await admin
            .from("profiles")
            .delete()
            .eq("id", createdAuthUserId);

          if (deleteProfileError) {
            console.error(
              "Failed to clean up orphaned profile:",
              deleteProfileError
            );
          }
        }
      }

      const isDuplicateEmail =
        error instanceof DuplicateEmailError;

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to confirm joining.",
          employee_created: Boolean(employeeRecordId),
          manual_reconciliation_required: Boolean(employeeRecordId),
        },
        { status: isDuplicateEmail ? 409 : 500 }
      );
    }
  } catch (error) {
    console.error(
      "POST /api/joining/[id]/confirm-joined failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to confirm joining.",
      },
      { status: 500 }
    );
  }
}
