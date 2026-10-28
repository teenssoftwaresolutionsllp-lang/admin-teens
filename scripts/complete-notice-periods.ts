
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const execute = process.argv.includes("--execute");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const title = "Notice Period Completed";
const notificationType = "resignation";

function indiaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function expiryFromExitDate(exitDate: string, days: number): string {
  const expiry = new Date(`${exitDate}T23:59:59.000Z`);

  if (Number.isNaN(expiry.getTime())) {
    throw new Error(`Invalid exit date: ${exitDate}`);
  }

  expiry.setUTCDate(expiry.getUTCDate() + days);
  return expiry.toISOString();
}

async function sendNotifications(employee: {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
}) {
  const { data: existing, error: existingError } = await supabase
    .from("notifications")
    .select("id, recipient_user_id, message")
    .eq("employee_id", employee.id)
    .eq("title", title)
    .eq("type", notificationType);

  if (existingError) {
    throw new Error(
      `Could not check existing notifications for ${employee.id}: ${existingError.message}`
    );
  }

  const employeeName = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ") || "an employee";

  const recipients: Array<{
    recipient_user_id: string;
    message: string;
  }> = [];

  if (employee.user_id) {
    recipients.push({
      recipient_user_id: employee.user_id,
      message: "Your notice period has been completed.",
    });
  }

  const { data: hrUsers, error: hrError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "hr");

  if (hrError) {
    throw new Error(`Could not fetch HR recipients: ${hrError.message}`);
  }

  for (const hr of hrUsers ?? []) {
    recipients.push({
      recipient_user_id: hr.id,
      message: `The notice period for ${employeeName} has been completed.`,
    });
  }

  const rows = recipients
    .filter((recipient) => {
      const alreadyExists = (existing ?? []).some(
        (notification) =>
          notification.recipient_user_id === recipient.recipient_user_id &&
          notification.message === recipient.message
      );
      return !alreadyExists;
    })
    .map((recipient) => ({
      employee_id: employee.id,
      recipient_user_id: recipient.recipient_user_id,
      title,
      message: recipient.message,
      type: notificationType,
      is_read: false,
    }));

  if (rows.length === 0) {
    console.log(`Notifications already exist for ${employeeName}.`);
    return;
  }

  const { error: insertError } = await supabase
    .from("notifications")
    .insert(rows);

  if (insertError) {
    throw new Error(
      `Could not create notifications for ${employeeName}: ${insertError.message}`
    );
  }

  console.log(`Created ${rows.length} notification(s) for ${employeeName}.`);
}

async function main() {
  const today = indiaDate();

  console.log(`India date: ${today}`);
  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN"}`);

  const { data: employees, error } = await supabase
    .from("employees")
    .select(
      "id, user_id, first_name, last_name, status, notice_status, planned_last_working_date, exit_date, temporary_login_days"
    )
    .eq("status", "on_notice")
    .eq("notice_status", "notice_period")
    .not("planned_last_working_date", "is", null)
    .lte("planned_last_working_date", today)
    .order("planned_last_working_date", { ascending: true });

  if (error) {
    throw new Error(`Could not fetch eligible employees: ${error.message}`);
  }

  if (!employees?.length) {
    console.log("No employees are due for notice completion.");
    return;
  }


  for (const employee of employees) {
    const name = [employee.first_name, employee.last_name]
      .filter(Boolean)
      .join(" ");

    const loginDays = employee.temporary_login_days;

    // Validate login duration before dry-run or execution.
    if (
      loginDays === null ||
      loginDays === undefined ||
      !Number.isInteger(loginDays) ||
      loginDays < 0 ||
      loginDays > 45
    ) {
      console.log(
        `SKIP: ${name} needs temporary_login_days configured to a whole number from 0 to 45.`
      );
      continue;
    }

    const plannedDate = employee.planned_last_working_date!;

    if (!execute) {
      console.log(
        `DRY RUN: Would complete notice period for ${name}, with temporary login for ${loginDays} day(s).`
      );
      continue;
    }

    const update: Record<string, unknown> = {
      status: "resigned",
      notice_status: "notice_completed",
      exit_date: plannedDate,
      temporary_login_expires_at: expiryFromExitDate(
        plannedDate,
        loginDays
      ),
    };

    // Recheck eligibility when updating the employee.
    const { data: updatedRows, error: updateError } = await supabase
      .from("employees")
      .update(update)
      .eq("id", employee.id)
      .eq("status", "on_notice")
      .eq("notice_status", "notice_period")
      .lte("planned_last_working_date", today)
      .select("id");

    if (updateError) {
      throw new Error(`Could not update ${name}: ${updateError.message}`);
    }

    if (!updatedRows?.length) {
      console.log(`Skipped ${name}: employee is no longer eligible.`);
      continue;
    }

    console.log(`Completed notice period for ${name}.`);

    await sendNotifications(employee);
  }


  console.log("Notice-period job finished.");
}

main().catch((error: unknown) => {
  console.error(
    "Notice-period job failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
