-- Past federal agreement values for the program (open.canada.ca proactive
-- disclosure), shown as context when a call does not publish its amount.
-- Additive and nullable; never used as the call's own amount.
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS historical_awards jsonb;
