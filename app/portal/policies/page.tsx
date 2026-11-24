import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmployeePoliciesPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Fetch Active policies through the authenticated Supabase client.
  // RLS also restricts employees to permitted policies.
  const { data: policies, error } = await supabase
    .from("policies")
    .select(`
      id,
      title,
      category,
      description,
      effective_date,
      document_name,
      cloudinary_public_id,
      status
    `)
    .eq("status", "Active")
    .order("effective_date", { ascending: false });

  if (error) {
    console.error("Failed to load employee policies:", error);

    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Unable to load policies. Please try again later.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Company Policies
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View and download the active company policies and guidelines.
        </p>
      </div>

      {policies && policies.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {policy.category || "General"}
                  </span>

                  <h2 className="mt-3 text-lg font-semibold text-slate-900">
                    {policy.title}
                  </h2>
                </div>

                <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  Active
                </span>
              </div>

              {policy.description && (
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {policy.description}
                </p>
              )}

              <div className="mt-4 space-y-1 text-xs text-slate-500">
                {policy.effective_date && (
                  <p>
                    Effective date:{" "}
                    {new Date(
                      `${policy.effective_date}T00:00:00`
                    ).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}

                {policy.document_name && (
                  <p className="break-all">
                    Document: {policy.document_name}
                  </p>
                )}
              </div>

              {policy.cloudinary_public_id && (
                <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <a
                    href={`/api/policies/${policy.id}/document`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    View Policy
                  </a>

                  <a
                    href={`/api/policies/${policy.id}/document`}
                    className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Download
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-slate-800">
            No active policies available
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Active company policies will appear here when they are published.
          </p>
        </div>
      )}
    </div>
  );
}
