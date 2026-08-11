-- Record what a report's narrative actually produced, and close the RLS policies
-- that can never match.
--
-- Re-runnable: every statement is guarded, so applying this twice succeeds and
-- changes no row (FR-051).
--
-- ===========================================================================
-- ROLLBACK
--
--   alter table public.generated_reports
--     drop constraint if exists generated_reports_generation_status_check;
--
-- That statement is the whole down-path. Run it and the table accepts any
-- generation_status again, which is exactly the state before this migration.
--
-- THE THREE COLUMNS ARE RETAINED. Do not add:
--
--   -- WRONG, this is data loss, not a rollback:
--   -- alter table public.generated_reports
--   --   drop column sections_generated, drop column generator, drop column degraded_reason;
--
-- Dropping them destroys the recorded provenance of every report generated
-- while this migration was in force. That provenance is the only evidence
-- distinguishing a complete report from one whose narrative partly failed, and
-- it cannot be reconstructed from anything else -- the model response is not
-- retained, and the rendered PDF does not carry it in machine-readable form.
-- Nullable columns nobody reads cost nothing; deleted columns cost the audit
-- trail. Reverting the code is enough (Assumption 2).
--
-- The RLS section below is likewise not rolled back. The four policies it
-- replaces compared two id spaces that never intersect, so restoring them
-- would restore the appearance of enforcement and none of the substance.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Provenance columns
--
-- All three are nullable, deliberately. A default would silently assert that
-- every report written before this migration was complete, and no such record
-- exists -- a historical row's provenance is genuinely unknown and must render as
-- "provenance unavailable", never as complete (Assumption 2).
-- ---------------------------------------------------------------------------

alter table public.generated_reports
  add column if not exists sections_generated jsonb,
  add column if not exists generator text,
  add column if not exists degraded_reason text;

comment on column public.generated_reports.sections_generated is
  'Which of the four narrative sections were produced: {"summary": bool, "observations": bool, "recommendations": bool, "limitations": bool}. NULL means unknown (pre-migration row), which is not the same as complete.';

comment on column public.generated_reports.generator is
  'Identity of the model that actually answered. Never a hardcoded label.';

comment on column public.generated_reports.degraded_reason is
  'Why sections are absent. NULL alongside a complete sections_generated is what completed means.';

-- ---------------------------------------------------------------------------
-- 2. Status vocabulary
--
-- The five members of REPORT_STATUSES, mirrored in
-- backend/app/contracts/report_contract.py and frontend/src/lib/reports/contract.ts.
--
-- Added as a not-valid constraint on purpose: existing rows are left unchecked.
-- A historical row
-- carrying a value outside this set is displayed verbatim and treated as
-- terminal, never rewritten (Assumption 2), so validating the backlog would fail
-- the migration over data this feature has decided not to touch. New and updated
-- rows are still checked.
--
-- 'processing' is absent because nothing has ever written it.
-- ---------------------------------------------------------------------------

alter table public.generated_reports
  drop constraint if exists generated_reports_generation_status_check;

alter table public.generated_reports
  add constraint generated_reports_generation_status_check
  check (generation_status in ('pending', 'generating', 'completed', 'degraded', 'failed'))
  NOT VALID;

-- ---------------------------------------------------------------------------
-- 3. Report number generator
--
-- Re-asserted with the uppercase body from 007. 005 defines this function with a
-- lowercase substring and 007 redefines it with upper(); re-applying 005 after
-- 007 restores the lowercase body and every insert then fails the
-- report_number_format CHECK, which requires [A-Z0-9]. Any later migration that
-- touches this function must end on the uppercase body, as this one does.
-- ---------------------------------------------------------------------------

create or replace function public.generate_report_number()
returns text
language sql
stable
as $$
  select
    'MIDAS-REP-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    upper(substring(md5(gen_random_uuid()::text) for 6));
$$;

-- ---------------------------------------------------------------------------
-- 4. Row-level security
--
-- The four policies from 005 compare auth.uid()::text with user_id. auth.uid()
-- returns a Supabase Auth UUID; user_id holds a Clerk subject id (user_2abc...).
-- The two id spaces never intersect, so those policies could not match a row
-- under any circumstances. They read as owner enforcement and enforce nothing.
--
-- AUTHORIZATION FOR THIS TABLE IS ENFORCED IN APPLICATION CODE.
-- Every read and write goes through a server route holding the service-role key,
-- which bypasses RLS entirely, and each of those queries is scoped with
-- .eq("user_id", userId) taken from Clerk auth(). See
-- frontend/src/services/reports.server.ts. RLS is not the control here and must
-- not be mistaken for it.
--
-- This tightens rather than loosens: after T028 no browser client reads this
-- table at all, and the deny policies below make the refusal explicit instead of
-- leaving it to the absence of a permissive policy (FR-052).
-- ---------------------------------------------------------------------------

alter table public.generated_reports enable row level security;

drop policy if exists "Users can view own reports" on public.generated_reports;
drop policy if exists "Users can insert own reports" on public.generated_reports;
drop policy if exists "Users can update own reports" on public.generated_reports;
drop policy if exists "Clinicians can view assigned reports" on public.generated_reports;

drop policy if exists "Deny anon access to generated_reports" on public.generated_reports;
create policy "Deny anon access to generated_reports"
  on public.generated_reports
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists "Deny authenticated access to generated_reports" on public.generated_reports;
create policy "Deny authenticated access to generated_reports"
  on public.generated_reports
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);
