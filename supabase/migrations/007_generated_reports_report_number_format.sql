-- Align report_number format constraint with current generator

alter table public.generated_reports
  drop constraint if exists report_number_format;

update public.generated_reports
set report_number = 'MIDAS-REP-' ||
  to_char(now(), 'YYYYMMDD') ||
  '-' ||
  upper(substring(md5(gen_random_uuid()::text) for 6))
where report_number is null
  or report_number !~ '^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$';

alter table public.generated_reports
  add constraint report_number_format
  check (report_number ~ '^MIDAS-REP-[0-9]{8}-[A-Z0-9]{6}$');

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
