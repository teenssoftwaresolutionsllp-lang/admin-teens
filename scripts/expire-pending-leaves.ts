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
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const BATCH_SIZE = 500;

function indiaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const today = indiaDate();

  console.log(`India date: ${today}`);
  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN"}`);

  // Fetch all pending leave requests whose final leave date has passed.
  // Fetch before updating so pagination cannot skip rows.
  const overdueLeaves: Array<{
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
  }> = [];

  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id, employee_id, start_date, end_date")
      .eq("status", "pending")
      .lt("end_date", today)
      .order("end_date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      throw new Error(
        `Could not fetch overdue leave requests: ${error.message}`
      );
    }

    const rows = data ?? [];
    overdueLeaves.push(...rows);

    if (rows.length < BATCH_SIZE) {
      break;
    }

    offset += BATCH_SIZE;
  }

  if (overdueLeaves.length === 0) {
    console.log("No overdue pending leave requests found.");
    return;
  }

  console.log(
    `Found ${overdueLeaves.length} overdue pending leave request(s).`
  );

  for (const leave of overdueLeaves) {
    console.log(
      `${execute ? "EXPIRING" : "DRY RUN"}: Leave ${leave.id}, ` +
        `employee ${leave.employee_id}, ` +
        `${leave.start_date} to ${leave.end_date}`
    );
  }

  if (!execute) {
    console.log("Dry run complete. No database records were changed.");
    return;
  }

  let expiredCount = 0;

  for (let index = 0; index < overdueLeaves.length; index += BATCH_SIZE) {
    const batch = overdueLeaves.slice(index, index + BATCH_SIZE);
    const ids = batch.map((leave) => leave.id);

    // Recheck status and end_date to avoid expiring a request
    // that was changed after the initial fetch.
    const { data: updatedRows, error: updateError } = await supabase
      .from("leave_requests")
      .update({ status: "expired" })
      .in("id", ids)
      .eq("status", "pending")
      .lt("end_date", today)
      .select("id");

    if (updateError) {
      throw new Error(
        `Could not expire leave requests: ${updateError.message}`
      );
    }

    expiredCount += updatedRows?.length ?? 0;
  }

  console.log(`Successfully expired ${expiredCount} leave request(s).`);
  console.log("Pending leave-expiry job finished.");
}

main().catch((error: unknown) => {
  console.error(
    "Leave-expiry job failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});