// import { authMiddleware } from '@clerk/nextjs'

// export default authMiddleware({
//   // Public routes that don't require authentication
//   publicRoutes: [
//     '/',
//     '/learn-more',
//     '/aboutus', 
//     '/contact',
//     '/terms',
//     '/privacy',
//     '/docs',
//     '/login',
//     '/signup',
//     '/sso-callback',
//     '/api/webhook/clerk', // For Clerk webhooks
//   ],
  
//   // Routes that are ignored by the auth middleware
//   ignoredRoutes: [
//     '/api/webhooks/(.*)',
//     '/_next/(.*)',
//     '/favicon.ico',
//     '/manifest.json',
//     '/(.*\\.(?:css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$)',
//   ],
  
//   // Redirect unauthenticated users to login
//   afterAuth(auth, req, evt) {
//     // Handle users who aren't authenticated trying to access protected routes
//     if (!auth.userId && !auth.isPublicRoute) {
//       // Redirect to login page
//       const loginUrl = new URL('/login', req.url)
//       loginUrl.searchParams.set('redirect_url', req.url)
//       return Response.redirect(loginUrl)
//     }
    
//     // Handle authenticated users trying to access auth pages
//     if (auth.userId && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
//       // Redirect to dashboard if already authenticated
//       return Response.redirect(new URL('/dashboard', req.url))
//     }
//   },
// })

// export const config = {
//   matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
// }