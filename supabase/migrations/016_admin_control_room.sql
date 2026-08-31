-- The admin control room: an append-only audit trail for governed actions
-- (invite, role change, offboard), a separate append-only record of chat
-- safety-guardrail blocks, and a CHECK constraint formalizing documents.status's
-- already-live value set.
--
-- Two new tables, one shared append-only trigger function plus a narrower
-- variant for audit_events' one permitted reconciliation transition, three
-- governed-action RPC functions, one additive CHECK constraint, deny-all RLS.
--
-- Re-runnable: every statement is guarded, so applying this twice succeeds and
-- changes no row.
--
-- ===========================================================================
-- ROLLBACK
--
--   drop trigger if exists audit_events_append_only on public.audit_events;
--   drop trigger if exists policy_block_events_append_only on public.policy_block_events;
--   drop function if exists public.reject_audit_event_mutation();
--   drop function if exists public.reject_event_mutation();
--   drop function if exists public.invite_user(text, text, text, text, text, text, text, text);
--   drop function if exists public.offboard_user(text, text, text, text, text);
--   drop function if exists public.change_user_role(text, text, text, text, text, text);
--   alter table public.documents drop constraint if exists documents_status_check;
--   drop table if exists public.policy_block_events;
--   drop table if exists public.audit_events;
--
-- THE TWO TABLES ARE THE ONLY EVIDENCE THAT A GOVERNED ACTION HAPPENED OR THAT
-- THE SAFETY GUARDRAIL BLOCKED A QUERY. Do not drop them as part of a routine
-- rollback -- only as a deliberate, separately-decided data-loss action, same
-- reasoning as migration 015's own rollback note for report_versions/case_reviews.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. audit_events -- append-only, one row per governed action or denied
--    read/write attempt (data-model.md §1, FR-AUD-1/FR-AUD-2)
-- ---------------------------------------------------------------------------

create table if not exists public.audit_events (
  id          text primary key default ('evt_' || substr(gen_random_uuid()::text, 1, 20)),
  corr_id     text not null default ('corr_' || substr(gen_random_uuid()::text, 1, 20)),
  actor_id    text not null,          -- Clerk user ID of the operator
  actor_role  text not null,          -- role the operator held AT THE TIME of the action
  action      text not null,          -- closed vocabulary, application-enforced (contract.ts AUDIT_ACTIONS)
  target_type text not null,          -- 'user' | 'invite'
  target_id   text not null,
  reason      text not null,          -- operator-authored; never clinical content
  outcome     text not null check (outcome in ('allowed', 'refused', 'pending')),
  created_at  timestamptz not null default now(),
  constraint audit_events_reason_not_blank check (length(trim(reason)) > 0)
);

create index if not exists audit_events_created_at_idx
  on public.audit_events (created_at desc, id desc);  -- cursor pagination (R7)
create index if not exists audit_events_actor_idx on public.audit_events (actor_id);
create index if not exists audit_events_action_idx on public.audit_events (action);
create index if not exists audit_events_pending_idx
  on public.audit_events (created_at) where outcome = 'pending';  -- staleness scan, eng review finding 1

-- ---------------------------------------------------------------------------
-- 2. policy_block_events -- append-only, deliberately separate from
--    audit_events (data-model.md §2, FR-AUD-4, D8). No actor_id, no query
--    text, no free-text reasoning column -- by construction, not convention.
-- ---------------------------------------------------------------------------

create table if not exists public.policy_block_events (
  id                  text primary key default ('evt_' || substr(gen_random_uuid()::text, 1, 20)),
  corr_id             text not null default ('corr_' || substr(gen_random_uuid()::text, 1, 20)),
  subject_role        text not null check (subject_role in ('patient', 'clinician')),
  classification      text not null check (classification in (
    'no_dermatology_keywords', 'referential_without_context',
    'followup_new_topic', 'classifier_fail_closed'
  )),
  escalated_to_review boolean not null default true,
  created_at          timestamptz not null default now()
);

create index if not exists policy_block_events_created_at_idx
  on public.policy_block_events (created_at desc, id desc);

-- ---------------------------------------------------------------------------
-- 3. Append-only triggers (data-model.md §3, R4)
--
-- policy_block_events gets the fully unconditional function: it has no
-- `pending` state, the guardrail's write is one synchronous insert.
--
-- audit_events gets a narrower variant permitting exactly one transition --
-- `pending` -> `allowed`/`refused`, outcome column only (eng review finding 1).
-- Every other column stays immutable through that transition, and the row is
-- fully immutable again once it leaves `pending`.
-- ---------------------------------------------------------------------------

create or replace function public.reject_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; row % cannot be %', tg_table_name, old.id, tg_op;
end $$;

create or replace function public.reject_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'audit_events is append-only; row % cannot be deleted', old.id;
  end if;

  if old.outcome = 'pending' and new.outcome in ('allowed', 'refused')
     and new.id = old.id and new.corr_id = old.corr_id and new.actor_id = old.actor_id
     and new.actor_role = old.actor_role and new.action = old.action
     and new.target_type = old.target_type and new.target_id = old.target_id
     and new.reason = old.reason and new.created_at = old.created_at then
    return new;  -- the one permitted transition: reconciling a pending row, outcome only
  end if;

  raise exception 'audit_events row % is immutable once outcome is not pending', old.id;
end $$;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.reject_audit_event_mutation();

drop trigger if exists policy_block_events_append_only on public.policy_block_events;
create trigger policy_block_events_append_only
  before update or delete on public.policy_block_events
  for each row execute function public.reject_event_mutation();

-- ---------------------------------------------------------------------------
-- 4. Governed-action RPC functions (data-model.md §4, R3)
--
-- The domain change for all three actions is a Clerk API call, made by the
-- FastAPI handler BEFORE each of these RPCs runs (quickstart.md §4) -- Clerk
-- and Postgres cannot share one transaction. Each function's own job is
-- reconciling the audit_events row the handler already wrote with
-- outcome: 'pending', inside this function's own single, atomic transaction.
--
-- The last-admin guard (FR-USR-5) is NOT here: a plpgsql function cannot query
-- Clerk's live user list to count current Admins. It lives in the FastAPI
-- handler, before this RPC is ever called (data-model.md §4's load-bearing
-- note). Likewise, no advisory lock guards the last-admin race here --
-- `pg_advisory_lock` (session-scoped) does not survive across the separate
-- pooled `.rpc()` calls this backend makes; the race is accepted and logged
-- instead (eng review Tension 1; corrected speckit-analyze finding F3 in
-- data-model.md §8, which previously claimed a lock here that never existed).
-- ---------------------------------------------------------------------------

create or replace function public.invite_user(
  p_actor_id        text,
  p_actor_role      text,
  p_email           text,
  p_role            text,
  p_site            text,
  p_reason          text,
  p_pending_evt_id  text,   -- the audit_events.id already written as outcome: 'pending' by the handler
  p_idempotency_key text
) returns table (evt_id text, outcome text)
language plpgsql
as $$
begin
  -- Serializes same-email invites so two concurrent calls for the SAME email
  -- can't both pass the duplicate check below before either commits (design-
  -- then-build strengthening pass, 2026-08-29). Scoped to one email; a
  -- different email's invite is never blocked by it.
  perform pg_advisory_xact_lock(hashtext('invite_user:' || lower(p_email)));

  -- Catches an exact-duplicate RESUBMISSION of this same request (double-click,
  -- network retry) within a short window. Clerk's own live invitation list is
  -- the authoritative check for "does a real outstanding invite already exist"
  -- (checked by the FastAPI handler before this RPC ever runs, R10 §5) -- this
  -- is narrower and purely defensive (eng review Tension 4).
  --
  -- Every `audit_events` reference below is table-qualified (`audit_events.
  -- outcome`, not bare `outcome`) -- `RETURNS TABLE (evt_id text, outcome
  -- text)` implicitly declares `outcome` as a plpgsql variable in this
  -- function's scope, which collides with the table's own `outcome` column.
  -- Caught by real execution against the live database (2026-08-30): a bare
  -- `outcome` reference here raises "column reference is ambiguous" (42702),
  -- not caught by any offline/text-level check this migration had before.
  if exists (
    select 1 from public.audit_events
     where audit_events.action = 'user.invite'
       and audit_events.target_id = p_email
       and audit_events.id != p_pending_evt_id
       and audit_events.outcome = 'allowed'
       and audit_events.created_at > now() - interval '5 minutes'
  ) then
    update public.audit_events set outcome = 'refused'
     where audit_events.id = p_pending_evt_id and audit_events.outcome = 'pending';

    return query
      select ae.id, 'duplicate'::text
        from public.audit_events ae
       where ae.action = 'user.invite'
         and ae.target_id = p_email
         and ae.id != p_pending_evt_id
       order by ae.created_at desc
       limit 1;
    return;
  end if;

  update public.audit_events set outcome = 'allowed'
   where audit_events.id = p_pending_evt_id and audit_events.outcome = 'pending';

  return query select p_pending_evt_id, 'allowed'::text;
end $$;

create or replace function public.offboard_user(
  p_actor_id       text,
  p_actor_role     text,
  p_target_user_id text,
  p_reason         text,
  p_pending_evt_id text   -- the audit_events.id already written as outcome: 'pending' by the handler
) returns table (evt_id text, outcome text)
language plpgsql
as $$
begin
  -- Reconciles the pending row to allowed. Session/token revocation (the
  -- domain change) already happened via Clerk, before this RPC was called
  -- (quickstart.md §4) -- this function never re-checks or repeats it.
  -- Table-qualified for the same reason invite_user() above is -- RETURNS
  -- TABLE(..., outcome text) shadows the bare column name.
  update public.audit_events set outcome = 'allowed'
   where audit_events.id = p_pending_evt_id and audit_events.outcome = 'pending';

  return query select p_pending_evt_id, 'allowed'::text;
end $$;

create or replace function public.change_user_role(
  p_actor_id       text,
  p_actor_role     text,
  p_target_user_id text,
  p_new_role       text,
  p_reason         text,
  p_pending_evt_id text   -- the audit_events.id already written as outcome: 'pending' by the handler
) returns table (evt_id text, outcome text)
language plpgsql
as $$
begin
  -- Reconciles the pending row to allowed. The domain change (Clerk metadata
  -- write) already happened, before this RPC was called (quickstart.md §4).
  -- Table-qualified for the same reason invite_user() above is.
  update public.audit_events set outcome = 'allowed'
   where audit_events.id = p_pending_evt_id and audit_events.outcome = 'pending';

  return query select p_pending_evt_id, 'allowed'::text;
end $$;

-- ---------------------------------------------------------------------------
-- 5. documents.status -- extended additively (data-model.md §5, R6)
--
-- No new values. No column added. No existing row's status changes -- this
-- only formalizes the 4-value set app/api/document_processing.py already
-- writes today. VALIDATED (not NOT VALID): if a row already holds a 5th value,
-- this MUST fail loudly at migration time, not mask a pre-existing data
-- problem (data-model.md §9).
-- ---------------------------------------------------------------------------

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (status in ('pending', 'processing', 'processed', 'failed'));

-- ---------------------------------------------------------------------------
-- 6. RLS -- deny-all for anon/authenticated, same defense-in-depth pattern as
--    migration 015. The backend's service-role client bypasses RLS entirely
--    (Constitution Principle III) -- this is not the enforcement boundary,
--    application code is -- but it stops any client accidentally holding an
--    anon/authenticated key from touching either table directly.
-- ---------------------------------------------------------------------------

alter table public.audit_events         enable row level security;
alter table public.policy_block_events  enable row level security;

drop policy if exists "Deny anon access to audit_events" on public.audit_events;
create policy "Deny anon access to audit_events"
  on public.audit_events as restrictive for all to anon
  using (false) with check (false);

drop policy if exists "Deny authenticated access to audit_events" on public.audit_events;
create policy "Deny authenticated access to audit_events"
  on public.audit_events as restrictive for all to authenticated
  using (false) with check (false);

drop policy if exists "Deny anon access to policy_block_events" on public.policy_block_events;
create policy "Deny anon access to policy_block_events"
  on public.policy_block_events as restrictive for all to anon
  using (false) with check (false);

drop policy if exists "Deny authenticated access to policy_block_events" on public.policy_block_events;
create policy "Deny authenticated access to policy_block_events"
  on public.policy_block_events as restrictive for all to authenticated
  using (false) with check (false);
