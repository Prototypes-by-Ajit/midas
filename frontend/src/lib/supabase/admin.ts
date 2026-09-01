import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client for Server Components and server services.
 *
 * The service-role key bypasses RLS — every query built on this client MUST be
 * scoped with `.eq("user_id", userId)` using the id from Clerk `auth()`, unless
 * the table is deliberately shared (see `services/documents.server.ts`).
 *
 * Returns `null` rather than throwing when unconfigured so callers can report a
 * degraded state instead of crashing the route. Route handlers each build their
 * own client with slightly different env precedence; this reads both spellings
 * of both vars so it works wherever any of them do.
 *
 * Extracted from `services/dashboard.server.ts` once a second and third service
 * needed the same rule.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}
