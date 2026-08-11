-- Allow all supported report types in generated_reports

alter table public.generated_reports
  drop constraint if exists generated_reports_report_type_check;

alter table public.generated_reports
  add constraint generated_reports_report_type_check
  check (report_type in ('diagnostic_summary', 'detailed_analysis', 'patient_report', 'clinician_report'));
