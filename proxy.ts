
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const path = request.nextUrl.pathname;

  const isDashboardPath = path.startsWith("/dashboard");
  const isPortalPath = path.startsWith("/portal");
  const isLoginPath = path === "/login";
  const isApiPath = path.startsWith("/api/");

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  console.log("PROXY REQUEST:", {
    path,
    authenticated: !!user,
    error: error?.message || null,
  });

  const isTemporaryAuthFailure =
    error?.name === "AuthRetryableFetchError" ||
    error?.status === 0 ||
    error?.name === "AbortError";

  // Never redirect API requests to an HTML login page.
  // API routes should return JSON authentication errors.
  if (isApiPath) {
    if (!user && isTemporaryAuthFailure) {
      return NextResponse.json(
        { success: false, error: "Authentication service temporarily unavailable." },
        {
          status: 503,
          headers: { "Retry-After": "5" },
        }
      );
    }

    return supabaseResponse;
  }

  // Temporary authentication failure
  if (!user && isTemporaryAuthFailure && (isDashboardPath || isPortalPath)) {
    return new NextResponse(
      "Authentication service is temporarily unavailable. Please try again.",
      {
        status: 503,
        headers: {
          "Retry-After": "5",
          "Content-Type": "text/plain",
        },
      }
    );
  }

  // Protect dashboard and employee portal pages
  if (!user && (isDashboardPath || isPortalPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);

    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login
  if (user && isLoginPath) {
    const role = user.user_metadata?.role || "hr";

    const destination =
      role === "employee" ? "/portal/profile" : "/dashboard";

    const url = request.nextUrl.clone();
    url.pathname = destination;

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portal/:path*",
    "/login",
    "/api/:path*",
  ],
};
