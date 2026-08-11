-- Allow analysis result fields to be populated after async inference
ALTER TABLE public.medical_analyses
  ALTER COLUMN diagnosis DROP NOT NULL,
  ALTER COLUMN confidence DROP NOT NULL,
  ALTER COLUMN risk_level DROP NOT NULL,
  ALTER COLUMN detected_features DROP NOT NULL,
  ALTER COLUMN recommendations DROP NOT NULL,
  ALTER COLUMN classification_metrics DROP NOT NULL,
  ALTER COLUMN heatmap_path DROP NOT NULL,
  ALTER COLUMN processing_time DROP NOT NULL;
