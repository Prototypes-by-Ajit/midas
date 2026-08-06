import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/learn-more',
  '/aboutus',
  '/contact',
  '/terms',
  '/privacy',
  '/docs',
  '/login',
  '/signup',
  '/sso-callback',
  '/auth/(.*)',
  '/api/webhook/clerk',
])

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  const { pathname } = req.nextUrl

  // If trying to access protected route without authentication
  if (isProtectedRoute(req) && !userId) {
    // Redirect to login page with return URL
    const signInUrl = new URL('/login', req.url)
    signInUrl.searchParams.set('redirect_url', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // If authenticated user tries to access login page, redirect to dashboard
  if (userId && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Signed-in users skip the marketing landing page.
  // Done here rather than with auth() inside app/(home)/page.tsx so that `/`
  // stays a static Server Component and the Railway healthcheck (healthcheckPath
  // = "/") does not depend on Clerk. Redirects at the edge, before any render.
  if (userId && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Allow all other requests
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params.
    // The `\\.` is load-bearing: written as `\.` in a single-quoted string it
    // collapses to `.` (any character), so the extension list matched bare path
    // segments too — `/dashboard/documents` hit the `docx?` branch via "/doc"
    // and was excluded from clerkMiddleware() entirely, which made `auth()`
    // throw in the dashboard layout and returned a 500 for that route.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
