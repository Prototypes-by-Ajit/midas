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
  
  // Allow all other requests
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
