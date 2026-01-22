import { NextResponse } from "next/server";

/**
 * Health check endpoint for Docker and Railway
 * Returns 200 OK if the application is running
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "midas-frontend"
    },
    { status: 200 }
  );
}
