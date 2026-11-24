import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const path = request.nextUrl.pathname;
  const isDashboardPath = path.startsWith("/dashboard");
  const isPortalPath = path.startsWith("/portal");
  const isWorkspacePath = path.startsWith("/workspace");
  const isLoginPath = path === "/login";
  const isChangePasswordPath = path === "/change-password";
  const isApiPath = path.startsWith("/api/");
  const isChangePasswordApi = path === "/api/auth/change-password";
  const isLoginApi = path === "/api/auth/login";
  const isLogoutApi = path === "/api/auth/logout";
  const isProtectedAppPath =
    isDashboardPath || isPortalPath || isWorkspacePath;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("SUPABASE PROXY AUTH ERROR:", {
      message: error.message,
      status: error.status,
      name: error.name,
      path,
    });
  }

  const isTemporaryAuthFailure =
    error?.name === "AuthRetryableFetchError" ||
    error?.status === 0 ||
    error?.name === "AbortError";

  if (!user && isTemporaryAuthFailure && isApiPath) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication service temporarily unavailable.",
      },
      {
        status: 503,
        headers: { "Retry-After": "5" },
      }
    );
  }

  if (
    !user &&
    isTemporaryAuthFailure &&
    (isProtectedAppPath || isChangePasswordPath)
  ) {
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

  if (!user && (isProtectedAppPath || isChangePasswordPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("SUPABASE PROXY PROFILE ERROR:", {
        message: profileError.message,
        path,
        userId: user.id,
      });

      if (
        isProtectedAppPath ||
        isChangePasswordPath ||
        (isApiPath &&
          !isChangePasswordApi &&
          !isLoginApi &&
          !isLogoutApi)
      ) {
        return NextResponse.json(
          {
            error:
              "Unable to verify your account security status. Please try again.",
          },
          { status: 503 }
        );
      }
    }

    const role =
      profile?.role || user.user_metadata?.role || "employee";
    const mustChangePassword =
      role === "employee" && profile?.must_change_password === true;

    if (mustChangePassword) {
      if (
        isApiPath &&
        !isChangePasswordApi &&
        !isLoginApi &&
        !isLogoutApi
      ) {
        return NextResponse.json(
          {
            error:
              "You must change your initial password before accessing HRMS.",
            mustChangePassword: true,
            redirectTo: "/change-password",
          },
          { status: 403 }
        );
      }

      if (!isApiPath && !isChangePasswordPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/change-password";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }

    if (isLoginPath) {
      const destination = mustChangePassword
        ? "/change-password"
        : role === "employee"
          ? "/portal/profile"
          : "/dashboard";

      const url = request.nextUrl.clone();
      url.pathname = destination;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portal/:path*",
    "/workspace/:path*",
    "/change-password",
    "/login",
    "/api/:path*",
  ],
};
