import { createAdminClient } from "@/lib/supabase-server";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export function normalizeAccountName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function checkAuthEmailExists(
  admin: AdminClient,
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
      (user) => user.email?.toLowerCase() === email.toLowerCase()
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

export async function getAvailableOfficialEmail(
  admin: AdminClient,
  firstName: string,
  lastName: string
): Promise<string> {
  const first = normalizeAccountName(firstName);
  const last = normalizeAccountName(lastName);

  if (!first || !last) {
    throw new Error(
      "The accepted offer name cannot be used to generate an official email."
    );
  }

  async function isTaken(email: string): Promise<boolean> {
    const { data: employees, error } = await admin
      .from("employees")
      .select("id")
      .ilike("email", email)
      .limit(1);

    if (error) throw error;

    if ((employees ?? []).length > 0) {
      return true;
    }

    return checkAuthEmailExists(admin, email);
  }

  for (let length = 1; length <= last.length; length++) {
    const email = `${first}.${last.slice(0, length)}@teenss.com`;

    if (!(await isTaken(email))) {
      return email;
    }
  }

  for (let suffix = 2; suffix < 10000; suffix++) {
    const email = `${first}.${last}${suffix}@teenss.com`;

    if (!(await isTaken(email))) {
      return email;
    }
  }

  throw new Error(
    "Unable to generate a unique official email. Please contact the system administrator."
  );
}
