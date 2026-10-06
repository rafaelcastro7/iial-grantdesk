-- Align grants schema with TypeScript types and server function queries
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS amount_min numeric;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS amount_max numeric;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS eligibility_note text;
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS eligible_applicant_types text[] DEFAULT '{}'::text[];
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS assistance_listings text[] DEFAULT '{}'::text[];
ALTER TABLE public.grants ADD COLUMN IF NOT EXISTS historical_awards jsonb DEFAULT '[]'::jsonb;
