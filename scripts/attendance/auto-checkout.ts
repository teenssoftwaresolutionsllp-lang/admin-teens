import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const execute = process.argv.includes("--execute");
const AUTO_CHECKOUT_HOURS = 9;
const AUTO_CHECKOUT_MS = AUTO_CHECKOUT_HOURS * 60 * 60 * 1000;

type OpenAttendance = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  session_check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | string | null;
  status: string;
  is_regularized: boolean;
};

async function main() {
  const now = new Date();

  const { data: openRows, error } = await supabase
    .from("attendance_logs")
    .select(
      "id, employee_id, attendance_date, check_in_time, session_check_in_time, check_out_time, total_hours, status, is_regularized"
    )
    .is("check_out_time", null)
    .not("session_check_in_time", "is", null);

  if (error) throw error;

  let eligible = 0;
  let checkedOut = 0;
  let skipped = 0;

  for (const row of (openRows ?? []) as OpenAttendance[]) {
    if (!row.session_check_in_time) {
      skipped++;
      continue;
    }

    const sessionStart = new Date(row.session_check_in_time);

    if (Number.isNaN(sessionStart.getTime())) {
      skipped++;
      console.log(`SKIP: Invalid session start | ${row.id}`);
      continue;
    }

    const deadline = new Date(
      sessionStart.getTime() + AUTO_CHECKOUT_MS
    );

    if (now.getTime() < deadline.getTime()) {
      continue;
    }

    eligible++;

    const previousHours = Number(row.total_hours ?? 0);

    if (!Number.isFinite(previousHours) || previousHours < 0) {
      skipped++;
      console.log(`REVIEW: Invalid total_hours | ${row.id}`);
      continue;
    }

    const totalHours = Number(
      (previousHours + AUTO_CHECKOUT_HOURS).toFixed(2)
    );

    console.log(
      `${execute ? "AUTO CHECKOUT" : "DRY RUN"}: ${row.employee_id} | ` +
      `${row.attendance_date} | ` +
      `Session start: ${sessionStart.toISOString()} | ` +
      `Checkout: ${deadline.toISOString()} | ` +
      `Total hours: ${totalHours}`
    );

    if (!execute) continue;

    // Conditional update protects against a manual checkout or
    // another automation run changing the session simultaneously.
    const { data: updated, error: updateError } = await supabase
      .from("attendance_logs")
      .update({
        check_out_time: deadline.toISOString(),
        session_check_in_time: null,
        total_hours: totalHours,
      })
      .eq("id", row.id)
      .is("check_out_time", null)
      .eq("session_check_in_time", row.session_check_in_time)
      .select("id");

    if (updateError) throw updateError;

    if (updated?.length) {
      checkedOut++;
    } else {
      console.log(
        `SKIP: Session changed before update | ${row.employee_id} | ${row.attendance_date}`
      );
    }
  }

  console.log("--- Automatic Checkout Summary ---");
  console.log(`Open sessions found: ${openRows?.length ?? 0}`);
  console.log(`Eligible for checkout: ${eligible}`);
  console.log(
    `${execute ? "Automatically checked out" : "Checkout previews"}: ${
      execute ? checkedOut : eligible
    }`
  );
  console.log(`Skipped/review required: ${skipped}`);
}

main().catch((error) => {
  console.error("Automatic checkout job failed:", error);
  process.exit(1);
});
