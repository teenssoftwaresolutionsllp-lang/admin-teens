import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isDashboardPath = path.startsWith('/dashboard')
  const isPortalPath = path.startsWith('/portal')
  const isLoginPath = path === '/login'

  // Unauthenticated user trying to access protected paths
  if (!user && (isDashboardPath || isPortalPath)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated user on login page -> redirect to appropriate portal
  if (user && isLoginPath) {
    const role = user.user_metadata?.role || 'hr'
    const destination = role === 'employee' ? '/portal' : '/dashboard'
    const url = request.nextUrl.clone()
    url.pathname = destination
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*', '/login'],
}
