import "server-only"

import { clerkClient } from "@clerk/nextjs/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  ManagedUser,
  UserDetail,
  OverviewResponse,
  HealthServicesResponse,
  ServiceHealthDetail,
  AdminDocumentRow,
  RagIndexHealth,
  AuditListResponse,
  PolicyBlockListResponse,
  PolicyBlockSummary,
  PermissionsResponse,
} from "@/types/dashboard"
import { runGovernedAction, type GovernedActionOutcome, type GovernedActor } from "@/lib/admin/governed-action"
import { OPERATOR_ROLES } from "@/lib/admin/contract"

// Governed actions (T038-T040) — the shared atomicity helper lives in
// lib/admin/governed-action.ts, not here, because it doesn't itself need
// "server-only" (see that file's own module docstring for the full
// architecture decision: the BFF, not FastAPI, owns invite/role-change/
// offboard, since only Node can call Clerk). Re-exported here so route
// handlers that already import from this file don't need a second import
// path for the Clerk-calling functions below plus the orchestration helper.
export { runGovernedAction, type GovernedActionOutcome, type GovernedActor } from "@/lib/admin/governed-action"

/**
 * Governed Action pattern step 3 (spec.md): a role-denied write attempt
 * still writes a `refused` audit row, exactly as observable as a successful
 * one -- same as `require_role()`'s own denial-write on the read side
 * (admin.py). These three governed-action routes own their whole action in
 * the BFF (no downstream FastAPI layer to catch the denial this time), so
 * this write has to happen here, not assumed to happen somewhere else.
 */
export async function writeRoleDenialAuditRow(
  supabase: SupabaseClient,
  actor: GovernedActor,
  action: string,
  targetId: string,
): Promise<void> {
  try {
    await supabase.from("audit_events").insert({
      actor_id: actor.id,
      actor_role: actor.role,
      action,
      target_type: "route",
      target_id: targetId,
      reason: "(role not permitted)",
      outcome: "refused",
    })
  } catch (e) {
    console.error(`Failed to record role-denial audit row for ${action}:`, e)
  }
}

/**
 * Base URL for the Python backend, normalized. Copied rather than imported --
 * `services/dashboard.server.ts` has its own private copy of this same six
 * lines, and every BACKEND_URL call site in this app (`app/api/analysis/
 * analyze/route.ts`, etc.) does too; no shared helper exists yet and adding
 * one is a repo-wide refactor this feature's own Standing Prohibitions rule
 * out ("no unrelated cleanup").
 */
function backendBaseUrl(): string | null {
  const raw = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!raw) return null
  const trimmed = raw.trim()
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
  return withScheme.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "")
}

/**
 * Every read-only Admin Control Room page (T051-T055, T073) reaches
 * `admin.py`'s `/api/v1/admin/*` routes through this one function --
 * server-rendered, never a self-referencing fetch to this app's own BFF
 * (`nextjs-frontend-rules.md`'s "Default to Server Components": the page IS
 * the server, so it calls the real backend directly, the same shape
 * `getUsers()`/`getUserDetail()` already establish above).
 *
 * `X-Actor-Id`/`X-Actor-Role` are the auth mechanism `admin.py`'s own module
 * docstring documents (T024's correction) -- this is the one place in the
 * Next.js app that forwards them, so every admin read goes through FastAPI's
 * `require_role()` and its denial-write, never around it (spec.md's Access
 * Denial Logging pattern -- a page that skipped this and rendered its own
 * "not allowed" copy would silently undercount SC-003).
 */
async function fetchAdminApi<T>(
  actor: GovernedActor,
  path: string,
  params?: Record<string, string | undefined>,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const base = backendBaseUrl()
  if (!base) return { ok: false, status: 500 }

  const url = new URL(`${base}/api/v1/admin${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value)
    }
  }

  try {
    const res = await fetch(url, {
      headers: { "X-Actor-Id": actor.id, "X-Actor-Role": actor.role },
      cache: "no-store",
    })
    if (!res.ok) return { ok: false, status: res.status }
    return { ok: true, data: (await res.json()) as T }
  } catch (e) {
    console.error(`admin API call to ${path} failed:`, e)
    return { ok: false, status: 502 }
  }
}

/** FR-OV-1/FR-OV-2. */
export async function getOverview(actor: GovernedActor) {
  return fetchAdminApi<OverviewResponse>(actor, "/overview")
}

/** FR-HLT-1. The 15s poll (T044's BFF route) calls this same function --
 * one code path for the initial SSR render and every subsequent tick. */
export async function getHealthServices(actor: GovernedActor) {
  return fetchAdminApi<HealthServicesResponse>(actor, "/health/services")
}

/** FR-HLT-2, the drill-down. Rendered by its own nested Server Component
 * route rather than a client fetch (research finding: no poll requirement
 * exists for this one, only the list above does — see FR-HLT-2's text). */
export async function getHealthServiceDetail(actor: GovernedActor, serviceId: string) {
  return fetchAdminApi<ServiceHealthDetail>(actor, `/health/services/${encodeURIComponent(serviceId)}`)
}

/** FR-RAG-1 (base half). No poll requirement in spec.md -- pure SSR. */
export async function getRagIngestion(actor: GovernedActor) {
  return fetchAdminApi<{ documents: AdminDocumentRow[] }>(actor, "/rag/ingestion")
}

/** FR-RAG-3. */
export async function getRagIndexHealth(actor: GovernedActor) {
  return fetchAdminApi<RagIndexHealth>(actor, "/rag/index-health")
}

/**
 * FR-AUD-2. Cursor pagination and free-text filtering are both plain URL
 * search params on `/dashboard/admin/audit` -- a `<form method="get">` and
 * `<Link>` navigation, not a client-side fetch (no live-update requirement
 * exists for this view; a page reload per filter/page change is standard,
 * accessible, works without JS, and needs no new BFF route).
 */
export async function getAuditEvents(
  actor: GovernedActor,
  params: { action?: string; q?: string; cursor?: string; limit?: string } = {},
) {
  return fetchAdminApi<AuditListResponse>(actor, "/audit", params)
}

/** T074 -- policy-block rows, same cursor shape as `/audit` so the Audit
 * page can merge-sort both by `created_at` into one timeline (FR-AUD-4). */
export async function getPolicyBlockEvents(
  actor: GovernedActor,
  params: { cursor?: string; limit?: string } = {},
) {
  return fetchAdminApi<PolicyBlockListResponse>(actor, "/audit/policy-blocks", params)
}

/** FR-AUD-4's aggregate signal. */
export async function getPolicyBlockSummary(actor: GovernedActor) {
  return fetchAdminApi<PolicyBlockSummary>(actor, "/audit/policy-blocks/summary")
}

/** FR-USR-6. All three operator roles, not gated by Users & Roles (T033). */
export async function getPermissionsMatrix(actor: GovernedActor) {
  return fetchAdminApi<PermissionsResponse>(actor, "/permissions")
}

/**
 * Current Admin count, for the last-admin guard (FR-USR-5). Clerk's List
 * Users API has no server-side metadata filter (`UserListParams` only
 * supports email/externalId/query, not privateMetadata/publicMetadata) — so
 * this fetches the same 500-user page `getUsers()` already does and filters
 * client-side, matching the existing PATCH handler's own established role
 * read (`privateMetadata.role ?? publicMetadata.role`). Not a second,
 * differently-shaped query; same page, same field read, just counted.
 */
async function countActiveAdmins(): Promise<number> {
  const client = await clerkClient()
  const { data: users } = await client.users.getUserList({ limit: 500 })
  return users.filter(
    (u) => ((u.privateMetadata?.role || u.publicMetadata?.role) as string) === "admin",
  ).length
}

/**
 * FR-USR-3: invite a user, governed. R10 §5's Clerk-side pre-check runs
 * before writing any audit row — Clerk's own live invitation list is the
 * authoritative signal for "does a real outstanding invite already exist",
 * closing the gap where a request timed out after Clerk actually succeeded
 * but before the caller's own audit-RPC call landed.
 */
export async function inviteUser(
  supabase: SupabaseClient,
  actor: GovernedActor,
  params: { email: string; role: string; site: string | null; reason: string },
): Promise<GovernedActionOutcome> {
  if (!params.reason?.trim()) {
    // Let runGovernedAction's own empty-reason branch write the refused row
    // and return — domainCall/rpcCall below never actually run.
    return runGovernedAction(
      supabase, actor, "user.invite", "invite", params.email, params.reason,
      async () => {}, async (id) => ({ evtId: id, outcome: "allowed" }),
    )
  }

  const client = await clerkClient()

  const existing = await client.invitations.getInvitationList({ status: "pending", query: params.email })
  const alreadyPending = existing.data.find((inv) => inv.emailAddress === params.email)

  if (alreadyPending) {
    const { data: priorRow } = await supabase
      .from("audit_events")
      .select("id")
      .eq("action", "user.invite")
      .eq("target_id", params.email)
      .eq("outcome", "allowed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (priorRow) return { outcome: "duplicate", evtId: priorRow.id }

    // The earlier attempt's Clerk call landed but its own audit-RPC call
    // never did -- write a fresh row pointing at the pre-existing invitation
    // rather than calling Clerk again.
    const { data: freshRow } = await supabase
      .from("audit_events")
      .insert({
        actor_id: actor.id, actor_role: actor.role, action: "user.invite",
        target_type: "invite", target_id: params.email,
        reason: params.reason, outcome: "allowed",
      })
      .select()
      .single()
    return { outcome: "duplicate", evtId: freshRow?.id ?? null }
  }

  return runGovernedAction(
    supabase, actor, "user.invite", "invite", params.email, params.reason,
    async () => {
      await client.invitations.createInvitation({
        emailAddress: params.email,
        expiresInDays: 7,
        publicMetadata: { role: params.role, site: params.site },
      })
    },
    async (pendingEvtId) => {
      const { data, error } = await supabase.rpc("invite_user", {
        p_actor_id: actor.id,
        p_actor_role: actor.role,
        p_email: params.email,
        p_role: params.role,
        p_site: params.site,
        p_reason: params.reason,
        p_pending_evt_id: pendingEvtId,
        p_idempotency_key: pendingEvtId,
      })
      if (error) throw new Error(error.message)
      const row = Array.isArray(data) ? data[0] : data
      return { evtId: row.evt_id, outcome: row.outcome }
    },
    async () => {
      // Compensate: revoke the invitation just created.
      const list = await client.invitations.getInvitationList({ status: "pending", query: params.email })
      const created = list.data.find((inv) => inv.emailAddress === params.email)
      if (created) await client.invitations.revokeInvitation(created.id)
    },
  )
}

/**
 * FR-USR-5 (role-change half): governed, takes effect only at the target's
 * next sign-in (Clerk session claims are not force-refreshed — spec.md's
 * own stated, deliberate window). Refuses before any write if this change
 * would leave zero Admins.
 */
export async function changeUserRole(
  supabase: SupabaseClient,
  actor: GovernedActor,
  targetUserId: string,
  newRole: string,
  reason: string,
): Promise<GovernedActionOutcome> {
  const client = await clerkClient()
  const target = await client.users.getUser(targetUserId)
  const targetCurrentRole = (target.privateMetadata?.role || target.publicMetadata?.role) as string

  if (targetCurrentRole === "admin" && newRole !== "admin") {
    const adminCount = await countActiveAdmins()
    if (adminCount <= 1) {
      console.warn(
        `admin_count_guard_check: refusing role change away from admin for ${targetUserId} -- would leave ${adminCount - 1} Admins`,
      )
      const { data } = await supabase
        .from("audit_events")
        .insert({
          actor_id: actor.id, actor_role: actor.role, action: "user.role_change",
          target_type: "user", target_id: targetUserId,
          reason: reason || "(no reason provided)", outcome: "refused",
        })
        .select()
        .single()
      return { outcome: "refused", evtId: data?.id ?? null, errorCode: "LAST_ADMIN_GUARD" }
    }
  }

  return runGovernedAction(
    supabase, actor, "user.role_change", "user", targetUserId, reason,
    async () => {
      await client.users.updateUserMetadata(targetUserId, { publicMetadata: { role: newRole } })
    },
    async (pendingEvtId) => {
      const { data, error } = await supabase.rpc("change_user_role", {
        p_actor_id: actor.id,
        p_actor_role: actor.role,
        p_target_user_id: targetUserId,
        p_new_role: newRole,
        p_reason: reason,
        p_pending_evt_id: pendingEvtId,
      })
      if (error) throw new Error(error.message)
      const row = Array.isArray(data) ? data[0] : data
      return { evtId: row.evt_id, outcome: row.outcome }
    },
    async () => {
      // Compensate: restore the target's previous role.
      await client.users.updateUserMetadata(targetUserId, { publicMetadata: { role: targetCurrentRole } })
    },
  )
}

/**
 * FR-USR-5 (offboard half): revokes active sessions/tokens immediately and
 * removes scopes. No compensate_call -- a revoked session has no undo
 * (eng review Tension 3); on RPC-finalize failure, runGovernedAction retries
 * the finalize alone rather than pretending to reverse the revocation.
 */
export async function offboardUser(
  supabase: SupabaseClient,
  actor: GovernedActor,
  targetUserId: string,
  reason: string,
): Promise<GovernedActionOutcome> {
  const client = await clerkClient()
  const target = await client.users.getUser(targetUserId)
  const targetCurrentRole = (target.privateMetadata?.role || target.publicMetadata?.role) as string

  if (targetCurrentRole === "admin") {
    const adminCount = await countActiveAdmins()
    if (adminCount <= 1) {
      console.warn(
        `admin_count_guard_check: refusing offboard of last Admin ${targetUserId}`,
      )
      const { data } = await supabase
        .from("audit_events")
        .insert({
          actor_id: actor.id, actor_role: actor.role, action: "user.offboard",
          target_type: "user", target_id: targetUserId,
          reason: reason || "(no reason provided)", outcome: "refused",
        })
        .select()
        .single()
      return { outcome: "refused", evtId: data?.id ?? null, errorCode: "LAST_ADMIN_GUARD" }
    }
  }

  return runGovernedAction(
    supabase, actor, "user.offboard", "user", targetUserId, reason,
    async () => {
      // Session/token revocation MUST complete before the RPC ever finalizes
      // (eng review Tension 3 -- access is cut the moment this succeeds,
      // never claimed by the audit row ahead of it actually happening).
      const sessions = await client.sessions.getSessionList({ userId: targetUserId, status: "active" })
      await Promise.all(sessions.data.map((s) => client.sessions.revokeSession(s.id)))
      // Remove scopes: clear the role metadata that grants dashboard access.
      await client.users.updateUserMetadata(targetUserId, { publicMetadata: { role: null } })
    },
    async (pendingEvtId) => {
      const { data, error } = await supabase.rpc("offboard_user", {
        p_actor_id: actor.id,
        p_actor_role: actor.role,
        p_target_user_id: targetUserId,
        p_reason: reason,
        p_pending_evt_id: pendingEvtId,
      })
      if (error) throw new Error(error.message)
      const row = Array.isArray(data) ? data[0] : data
      return { evtId: row.evt_id, outcome: row.outcome }
    },
    // No compensateCall -- see module docstring.
  )
}

const CLERK_PAGE_SIZE = 500
/** Hard stop against a runaway loop if Clerk's API ever misbehaves (offset
 * not advancing, etc.) -- 100 pages is 50,000 users, far past this app's
 * real scale. Ponytail: a bound, not a real capacity plan. */
const CLERK_MAX_PAGES = 100
import type { ManagedUser, UserDetail } from "@/types/dashboard"

/**
 * Server-side read of the Clerk user directory for the admin users page.
 *
 * Ported from `GET /api/admin/users`. This function does NOT check the caller's
 * role — the page gates on `getSessionUser().role === "admin"` before calling
 * it, and the route handler keeps its own check for the role-change mutation.
 *
 * Returns a result object rather than throwing so the page can render an error
 * state instead of blanking the dashboard shell.
 *
 * `options.operatorOnly` (FR-USR-1, T034): the directory's own "Operators
 * only" tab. Filtering happens after the fetch — Clerk's List Users API has
 * no server-side metadata filter (`countActiveAdmins`'s own comment, above).
 * Default (`false`) is today's unbroken behavior: every account, used by the
 * page's default "All users" tab for the patient/clinician/operator role
 * management this page has always done.
 *
 * `options.operatorOnly` was `undefined`-only before this feature; the 500-
 * user page cap was real and silent (T034's own finding) — now paginates the
 * full directory rather than truncating past the first page.
 */
export async function getUsers(
  options: { operatorOnly?: boolean } = {},
): Promise<{ ok: true; data: ManagedUser[] } | { ok: false }> {
  try {
    const client = await clerkClient()
    const all: ManagedUser[] = []

    for (let page = 0; page < CLERK_MAX_PAGES; page++) {
      const { data: users } = await client.users.getUserList({
        limit: CLERK_PAGE_SIZE,
        offset: page * CLERK_PAGE_SIZE,
      })
      for (const user of users) {
        all.push({
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || "No email",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          fullName:
            `${user.firstName || ""} ${user.lastName || ""}`.trim() || "No name",
          role:
            ((user.privateMetadata?.role || user.publicMetadata?.role) as string) ||
            "patient",
          createdAt: user.createdAt,
          lastSignInAt: user.lastSignInAt,
          imageUrl: user.imageUrl,
        })
      }
      if (users.length < CLERK_PAGE_SIZE) break

    for (let page = 0; page < CLERK_MAX_PAGES; page++) {
      const { data: users } = await client.users.getUserList({
        limit: CLERK_PAGE_SIZE,
        offset: page * CLERK_PAGE_SIZE,
      })
      for (const user of users) {
        all.push({
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || "No email",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          fullName:
            `${user.firstName || ""} ${user.lastName || ""}`.trim() || "No name",
          role:
            ((user.privateMetadata?.role || user.publicMetadata?.role) as string) ||
            "patient",
          createdAt: user.createdAt,
          lastSignInAt: user.lastSignInAt,
          imageUrl: user.imageUrl,
        })
      }
      if (users.length < CLERK_PAGE_SIZE) break
    }

    const data = options.operatorOnly
      ? all.filter((u) => (OPERATOR_ROLES as readonly string[]).includes(u.role))
      : all

    return { ok: true, data }
  } catch {
    return { ok: false }
  }
}

/**
 * FR-USR-2: one user's access facts + active sessions, for the detail view
 * linked from the directory row. Session-list read is ported from
 * `getSecurityOverview` (`security.server.ts`) — same Clerk call, no `current`
 * flag since this is always someone else's session from the admin's view.
 *
 * "Recent audit activity" (also FR-USR-2, T072) reads real `audit_events`
 * rows now that they exist — filtered by free-text `q` on this user's id,
 * matching either side (they were the actor, or the target of someone
 * else's governed action against them). Only fetched when `actor` (the
 * *viewing* admin's identity, for the X-Actor-Id/X-Actor-Role headers
 * `admin.py` requires) is passed — omitting it keeps this function callable
 * exactly as it always has been, with an honestly-empty `auditActivity: []`
 * rather than a second, differently-shaped return type.
 */
export async function getUserDetail(
  userId: string,
  actor?: GovernedActor,
): Promise<{ ok: true; data: UserDetail } | { ok: false }> {
  try {
    const client = await clerkClient()
    const [user, sessionList, auditActivity] = await Promise.all([
      client.users.getUser(userId),
      client.sessions.getSessionList({ userId, status: "active" }),
      actor
        ? getAuditEvents(actor, { q: userId, limit: "10" }).then((r) => (r.ok ? r.data.items : []))
        : Promise.resolve([]),
    ])

    return {
      ok: true,
      data: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "No email",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "No name",
        role:
          ((user.privateMetadata?.role || user.publicMetadata?.role) as string) ||
          "patient",
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        imageUrl: user.imageUrl,
        banned: user.banned,
        locked: user.locked,
        twoFactorEnabled: user.twoFactorEnabled,
        passwordEnabled: user.passwordEnabled,
        sessions: sessionList.data.map((s) => {
          const activity = s.latestActivity
          const device =
            [activity?.deviceType, activity?.browserName].filter(Boolean).join(" · ") ||
            null
          const location =
            [activity?.city, activity?.country].filter(Boolean).join(", ") || null

          return {
            id: s.id,
            device,
            location,
            lastActiveAt: new Date(s.lastActiveAt).toISOString(),
          }
        }),
        auditActivity,
      },
    }

    const data = options.operatorOnly
      ? all.filter((u) => (OPERATOR_ROLES as readonly string[]).includes(u.role))
      : all

    return { ok: true, data }
  } catch {
    return { ok: false }
  }
}

/**
 * FR-USR-2: one user's access facts + active sessions, for the detail view
 * linked from the directory row. Session-list read is ported from
 * `getSecurityOverview` (`security.server.ts`) — same Clerk call, no `current`
 * flag since this is always someone else's session from the admin's view.
 *
 * "Recent audit activity" (also FR-USR-2, T072) reads real `audit_events`
 * rows now that they exist — filtered by free-text `q` on this user's id,
 * matching either side (they were the actor, or the target of someone
 * else's governed action against them). Only fetched when `actor` (the
 * *viewing* admin's identity, for the X-Actor-Id/X-Actor-Role headers
 * `admin.py` requires) is passed — omitting it keeps this function callable
 * exactly as it always has been, with an honestly-empty `auditActivity: []`
 * rather than a second, differently-shaped return type.
 */
export async function getUserDetail(
  userId: string,
  actor?: GovernedActor,
): Promise<{ ok: true; data: UserDetail } | { ok: false }> {
  try {
    const client = await clerkClient()
    const [user, sessionList, auditActivity] = await Promise.all([
      client.users.getUser(userId),
      client.sessions.getSessionList({ userId, status: "active" }),
      actor
        ? getAuditEvents(actor, { q: userId, limit: "10" }).then((r) => (r.ok ? r.data.items : []))
        : Promise.resolve([]),
    ])

    return {
      ok: true,
      data: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "No email",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        fullName:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "No name",
        role:
          ((user.privateMetadata?.role || user.publicMetadata?.role) as string) ||
          "patient",
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        imageUrl: user.imageUrl,
        banned: user.banned,
        locked: user.locked,
        twoFactorEnabled: user.twoFactorEnabled,
        passwordEnabled: user.passwordEnabled,
        sessions: sessionList.data.map((s) => {
          const activity = s.latestActivity
          const device =
            [activity?.deviceType, activity?.browserName].filter(Boolean).join(" · ") ||
            null
          const location =
            [activity?.city, activity?.country].filter(Boolean).join(", ") || null

          return {
            id: s.id,
            device,
            location,
            lastActiveAt: new Date(s.lastActiveAt).toISOString(),
          }
        }),
        auditActivity,
      },
    }
  } catch {
    return { ok: false }
  }
}
