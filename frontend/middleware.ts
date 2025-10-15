import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

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
  // Protect dashboard routes - require authentication
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
  
  // Allow all public routes
  if (isPublicRoute(req)) {
    return
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
