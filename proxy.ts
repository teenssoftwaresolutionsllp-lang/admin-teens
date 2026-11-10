import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error("SUPABASE PROXY AUTH ERROR:", {
      message: error.message,
      status: error.status,
      name: error.name,
      path: request.nextUrl.pathname,
    })
  }

  console.log("SUPABASE PROXY SESSION:", {
    authenticated: !!user,
    path: request.nextUrl.pathname,
  })

  const path = request.nextUrl.pathname
  const isDashboardPath = path.startsWith('/dashboard')
  const isPortalPath = path.startsWith('/portal')
  const isLoginPath = path === '/login'
  const isTemporaryAuthFailure =
    error?.name === "AuthRetryableFetchError" ||
    error?.status === 0 ||
    error?.name === "AbortError";

  if (!user && isTemporaryAuthFailure && (isDashboardPath || isPortalPath)) {
    return new NextResponse(
      "Authentication service is temporarily unavailable. Please try again.",
      {status: 503,headers: {"Retry-After": "5","Content-Type": "text/plain",},}
    );
  }

  if (!user && (isDashboardPath || isPortalPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPath) {
    const role = user.user_metadata?.role || 'hr'
    const destination = role === 'employee' ? '/portal/profile' : '/dashboard'
    const url = request.nextUrl.clone()
    url.pathname = destination
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*', '/login','/api/:path*',],
}
