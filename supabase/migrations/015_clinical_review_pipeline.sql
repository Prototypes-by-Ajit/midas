-- The clinical review pipeline: a human decision, a signature, and a release,
-- recorded where they cannot be quietly rewritten.
--
-- Three nullable columns on medical_analyses, two append-only tables, one
-- immutability trigger, two transaction-wrapping functions, deny-all RLS.
--
-- Re-runnable: every statement is guarded, so applying this twice succeeds and
-- changes no row.
--
-- ===========================================================================
-- ROLLBACK
--
--   drop trigger if exists report_versions_append_only on public.report_versions;
--   drop function if exists public.reject_signed_version_mutation();
--   drop function if exists public.record_case_decision(uuid, text, text, text, uuid, jsonb);
--   drop function if exists public.record_version_correction(uuid, text, jsonb);
--   alter table public.medical_analyses
--     drop constraint if exists medical_analyses_review_state_check;
--
-- That block is the whole down-path, and it is deliberately partial.
--
-- THE THREE COLUMNS AND BOTH TABLES ARE RETAINED. Do not add:
--
--   -- WRONG, this is data loss, not a rollback:
--   -- drop table public.report_versions;
--   -- drop table public.case_reviews;
--   -- alter table public.medical_analyses
--   --   drop column review_state, drop column claimed_by, drop column claimed_at;
--
-- Those rows are the only evidence that a person reviewed anything: who decided,
-- what they decided, who signed it, and when it was released to the patient.
-- None of it is reconstructable from another source -- the model output does not
-- carry it and the rendered PDF does not carry it in machine-readable form.
-- Reverting the code is enough, exactly as migration 014 argues for its own
-- provenance columns.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. medical_analyses -- the case root, extended additively (spec A4)
--
-- All three are nullable with NO DEFAULT, deliberately. A default would assert
-- that every analysis recorded before this migration is awaiting a clinician,
-- and no such record exists. NULL means the row predates this feature: unknown,
-- never "reviewed", never "awaiting review" (FR-044). A backfill here would drop
-- every historical analysis into a live clinician queue.
--
-- NOT TOUCHED: `status`. That column carries the inference vocabulary
-- (pending -> processing -> completed/failed) written by
-- api/analysis/analyze/route.ts. review_state is a third, separate vocabulary
-- (spec A8) and must not be overloaded onto it.
-- ---------------------------------------------------------------------------

alter table public.medical_analyses
  add column if not exists review_state text,
  add column if not exists claimed_by   text,
  add column if not exists claimed_at   timestamptz;

comment on column public.medical_analyses.review_state is
  'Where the case stands clinically. One of CASE_REVIEW_STATES. NULL means the row predates this feature: unknown, and excluded from every work list (FR-044).';

comment on column public.medical_analyses.claimed_by is
  'Clerk subject id of the clinician holding the case. NULL means unclaimed and visible to every clinician. Survives the more_data_requested round trip (D5).';

comment on column public.medical_analyses.claimed_at is
  'When the claim was taken (FR-011).';

-- CASE_REVIEW_STATES, mirrored in frontend/src/lib/clinical/contract.ts and
-- backend/app/contracts/clinical_contract.py. backend/tests/test_clinical_contract.py
-- reads all three as text and fails when one drifts.
--
-- NOT VALID for the same reason 014 uses it: historical rows are left unchecked.
-- Every one of them holds NULL, which this constraint permits anyway, but the
-- rule stands -- this feature does not validate a backlog it has decided not to
-- touch. New and updated rows are still checked.

alter table public.medical_analyses
  drop constraint if exists medical_analyses_review_state_check;

alter table public.medical_analyses
  add constraint medical_analyses_review_state_check
  check (review_state in ('awaiting_review', 'claimed', 'more_data_requested',
                          'decided', 'signed', 'released'))
  NOT VALID;

-- The work-list read path. The partial predicate is the same one that keeps
-- historical rows out of a live queue, so the index cannot serve a query that
-- would return them.

create index if not exists medical_analyses_review_queue_idx
  on public.medical_analyses (review_state, created_at)
  where review_state is not null;

-- ---------------------------------------------------------------------------
-- 2. report_versions -- new, append-only
--
-- FR-022 requires a correction to create a NEW version linked to what it
-- supersedes. A single mutable row cannot express that.
--
-- report_id has no ON DELETE clause on purpose. generated_reports.analysis_id
-- cascades from medical_analyses, so a cascade here would let deleting an
-- analysis destroy its signatures. NO ACTION means that delete is refused
-- instead.
-- ---------------------------------------------------------------------------

create table if not exists public.report_versions (
  id                     uuid primary key default gen_random_uuid(),
  report_id              uuid not null references public.generated_reports(id),
  version_number         int  not null,
  content                jsonb not null,
  content_digest         text,
  storage_path           text,
  state                  text not null,
  supersedes             uuid references public.report_versions(id),
  signed_by              text,
  signed_at              timestamptz,
  sign_rationale         text,
  released_by            text,
  released_at            timestamptz,
  correction_started_by  text,
  correction_started_at  timestamptz,
  created_at             timestamptz not null default now(),
  constraint report_versions_report_version_unique unique (report_id, version_number)
);

comment on column public.report_versions.content_digest is
  'Digest of the PDF bytes as at signature time (D1). Detects that the stored document drifted from what was signed. It does NOT prove who changed it and is not cryptographic verification (FR-054).';

comment on column public.report_versions.released_at is
  'The patient-visibility gate -- not signed_at (FR-026). A signed version the patient can already read is the failure this column exists to prevent.';

comment on column public.report_versions.correction_started_at is
  'Non-null on the currently released version means the patient is shown "under revision" (FR-029), while that version stays readable.';

-- VERSION_STATES, the third of the four sources.

alter table public.report_versions
  drop constraint if exists report_versions_state_check;

alter table public.report_versions
  add constraint report_versions_state_check
  check (state in ('draft', 'signed', 'superseded'));

-- FR-028, enforced by the database rather than by application intent. This is
-- what makes "a patient never sees an unreleased artifact" unfalsifiable: the
-- row cannot exist, regardless of which code path attempted it.

alter table public.report_versions
  drop constraint if exists report_versions_release_requires_signature;

alter table public.report_versions
  add constraint report_versions_release_requires_signature
  check (released_at is null or signed_at is not null);

-- A signature always has an author.

alter table public.report_versions
  drop constraint if exists report_versions_signature_has_author;

alter table public.report_versions
  add constraint report_versions_signature_has_author
  check (signed_at is null or signed_by is not null);

create index if not exists report_versions_report_idx
  on public.report_versions (report_id, version_number desc);

-- ---------------------------------------------------------------------------
-- 3. case_reviews -- new, append-only
--
-- FR-008 requires a decision to stay retrievable and attributable. An
-- overwritten column cannot promise that, and FR-007's return-to-queue loop
-- means one case legitimately carries several rows.
--
-- `outcome` IS NOT A CLINICAL VOCABULARY. It records what kind of thing the
-- clinician did, never a diagnosis, risk tier, or recommendation. Constitution
-- Principle II forbids this feature inventing clinical labels; the clinical
-- content lives in `note`, authored by a person.
-- ---------------------------------------------------------------------------

create table if not exists public.case_reviews (
  id           uuid primary key default gen_random_uuid(),
  analysis_id  uuid not null references public.medical_analyses(id) on delete cascade,
  clinician_id text not null,
  outcome      text not null,
  note         text not null,
  created_at   timestamptz not null default now()
);

-- REVIEW_OUTCOMES, the third of the four sources.

alter table public.case_reviews
  drop constraint if exists case_reviews_outcome_check;

alter table public.case_reviews
  add constraint case_reviews_outcome_check
  check (outcome in ('decision_recorded', 'more_data_requested'));

create index if not exists case_reviews_analysis_idx
  on public.case_reviews (analysis_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Immutability trigger -- FR-021
--
-- A signed version is a person's name attached to a document. The guarded list
-- below is what that name covers; anything not named here is a write a signed
-- row must still accept.
--
-- GUARDED:   content, content_digest, storage_path, signed_by, signed_at,
--            supersedes, version_number
-- PERMITTED: released_by, released_at, state, correction_started_by,
--            correction_started_at -- release (FR-026), supersession (FR-022)
--            and the under-revision flag (FR-029) all happen after signature.
--
-- DELETE is refused for every row, signed or not. Append-only means append-only.
-- ---------------------------------------------------------------------------

create or replace function public.reject_signed_version_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'report_versions is append-only; version % cannot be deleted', old.id;
  end if;

  if old.signed_at is not null and (
       new.content        is distinct from old.content
    or new.content_digest is distinct from old.content_digest
    or new.storage_path   is distinct from old.storage_path
    or new.signed_by      is distinct from old.signed_by
    or new.signed_at      is distinct from old.signed_at
    or new.supersedes     is distinct from old.supersedes
    or new.version_number is distinct from old.version_number
  ) then
    raise exception 'version % is signed and immutable; a correction inserts a new version', old.id;
  end if;

  return new;
end $$;

drop trigger if exists report_versions_append_only on public.report_versions;

create trigger report_versions_append_only
  before update or delete on public.report_versions
  for each row execute function public.reject_signed_version_mutation();

-- ---------------------------------------------------------------------------
-- 5. The two multi-write paths, as functions (D3)
--
-- Each is called once via supabase.rpc() and is therefore one transaction. The
-- alternative -- two client round trips -- can leave a decision with no report,
-- or two versions both current, and no application-side retry can repair either.
-- Same trust boundary as the trigger above, same reasoning.
--
-- The state literals in both bodies are the FOURTH copy of the vocabulary (E6).
-- backend/tests/test_clinical_contract.py reads these bodies as text so this
-- copy cannot drift unseen from the other three.
-- ---------------------------------------------------------------------------

-- 5a. Record a decision, and create version 1 from it (D2).
--
-- Closes the hole where a clinician decides and has nothing to sign. Ordering is
-- load-bearing: the decision is written first, so a failure to build version 1
-- takes the decision down with it rather than leaving a decision the clinician
-- believes was recorded.

create or replace function public.record_case_decision(
  p_analysis_id  uuid,
  p_clinician_id text,
  p_outcome      text,
  p_note         text,
  p_report_id    uuid  default null,
  p_content      jsonb default null
)
returns uuid
language plpgsql
as $$
declare
  v_review_id uuid;
begin
  insert into public.case_reviews (analysis_id, clinician_id, outcome, note)
  values (p_analysis_id, p_clinician_id, p_outcome, p_note)
  returning id into v_review_id;

  if p_outcome = 'decision_recorded' then
    insert into public.report_versions (report_id, version_number, content, state)
    values (p_report_id, 1, p_content, 'draft');
  end if;

  update public.medical_analyses
     set review_state = case when p_outcome = 'decision_recorded'
                             then 'decided'
                             else 'more_data_requested'
                        end,
         updated_at = now()
   where id = p_analysis_id
     and claimed_by = p_clinician_id
     and review_state = 'claimed';

  if not found then
    raise exception 'case % is not held by % in a state a decision can be recorded from', p_analysis_id, p_clinician_id;
  end if;

  return v_review_id;
end $$;

-- 5b. Sign a correcting version, supersede the one it corrects, and move the
--     case back (FR-022).
--
-- The corrected row keeps its released_at and stays readable throughout -- state
-- is the version's lifecycle, released_at is the patient-visibility gate, and
-- they are not the same fact (FR-029, SC-012). correction_started_* is stamped
-- on the corrected row, which is what the patient's "under revision" notice
-- reads, and it clears for them when the new version is released.

create or replace function public.record_version_correction(
  p_supersedes_id uuid,
  p_clinician_id  text,
  p_content       jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_report_id   uuid;
  v_analysis_id uuid;
  v_next_number int;
  v_new_id      uuid;
begin
  select rv.report_id, gr.analysis_id
    into v_report_id, v_analysis_id
    from public.report_versions rv
    join public.generated_reports gr on gr.id = rv.report_id
   where rv.id = p_supersedes_id
     and rv.signed_at is not null;

  if not found then
    raise exception 'version % is absent or unsigned; only a signed version can be corrected', p_supersedes_id;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_number
    from public.report_versions
   where report_id = v_report_id;

  insert into public.report_versions (report_id, version_number, content, state,
                                      supersedes, signed_by, signed_at)
  values (v_report_id, v_next_number, p_content, 'signed',
          p_supersedes_id, p_clinician_id, now())
  returning id into v_new_id;

  update public.report_versions
     set state                 = 'superseded',
         correction_started_by = p_clinician_id,
         correction_started_at = now()
   where id = p_supersedes_id;

  update public.medical_analyses
     set review_state = 'signed',
         updated_at   = now()
   where id = v_analysis_id
     and review_state = 'released';

  if not found then
    raise exception 'case % is not in a state a correction can be signed from', v_analysis_id;
  end if;

  return v_new_id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Row-level security -- deny-all, for the reason 014 states
--
-- auth.uid() returns a Supabase Auth UUID; every id column here holds a Clerk
-- subject id. The two spaces never intersect, so a policy comparing them reads
-- as enforcement and enforces nothing.
--
-- AUTHORIZATION FOR THESE TABLES IS ENFORCED IN APPLICATION CODE.
-- Every read and write goes through a Next.js route handler holding the
-- service-role key, which bypasses RLS entirely, scoped by the Clerk identity
-- from auth(). See frontend/src/services/clinical.server.ts. RLS is not the
-- control here and must not be mistaken for it -- these policies exist to make
-- the refusal explicit rather than leaving it to the absence of a permissive
-- policy.
-- ---------------------------------------------------------------------------

alter table public.report_versions enable row level security;
alter table public.case_reviews    enable row level security;

drop policy if exists "Deny anon access to report_versions" on public.report_versions;
create policy "Deny anon access to report_versions"
  on public.report_versions as restrictive for all to anon
  using (false) with check (false);

drop policy if exists "Deny authenticated access to report_versions" on public.report_versions;
create policy "Deny authenticated access to report_versions"
  on public.report_versions as restrictive for all to authenticated
  using (false) with check (false);

drop policy if exists "Deny anon access to case_reviews" on public.case_reviews;
create policy "Deny anon access to case_reviews"
  on public.case_reviews as restrictive for all to anon
  using (false) with check (false);

drop policy if exists "Deny authenticated access to case_reviews" on public.case_reviews;
create policy "Deny authenticated access to case_reviews"
  on public.case_reviews as restrictive for all to authenticated
  using (false) with check (false);
