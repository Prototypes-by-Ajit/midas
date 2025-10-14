import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

// Make all routes public for now to avoid issues
// You can add authentication protection later as needed

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}