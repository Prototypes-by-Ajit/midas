import { NextResponse } from 'next/server';

// This route handles OAuth callbacks for Clerk
// Clerk automatically handles the callback, so we just redirect to the appropriate page
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get('redirect_url') || searchParams.get('next') || '/dashboard'
  
  // Ensure the redirect URL is safe (relative path)
  const safeNext = next.startsWith('/') ? next : '/dashboard'
  
  // Redirect to the intended destination
  return NextResponse.redirect(`${origin}${safeNext}`)
}
