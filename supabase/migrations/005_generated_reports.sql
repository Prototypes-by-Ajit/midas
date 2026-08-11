-- Create generated_reports table and report number helper

create extension if not exists pgcrypto;

create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  clinician_id text,
  analysis_id uuid not null references public.medical_analyses(id) on delete cascade,
  report_type text not null,
  report_number text not null,
  generation_status text not null default 'pending',
  report_config jsonb not null default '{}'::jsonb,
  storage_path text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists generated_reports_user_id_idx on public.generated_reports(user_id);
create index if not exists generated_reports_analysis_id_idx on public.generated_reports(analysis_id);

create or replace function public.generate_report_number()
returns text
language sql
stable
as $$
  select
    'MIDAS-REP-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    substring(md5(gen_random_uuid()::text) for 6);
$$;

alter table public.generated_reports enable row level security;

create policy "Users can view own reports"
  on public.generated_reports
  for select
  using (auth.uid()::text = user_id);

create policy "Users can insert own reports"
  on public.generated_reports
  for insert
  with check (auth.uid()::text = user_id);

create policy "Users can update own reports"
  on public.generated_reports
  for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "Clinicians can view assigned reports"
  on public.generated_reports
  for select
  using (auth.uid()::text = clinician_id);
