-- Keep the Supabase migration history aligned with the Drizzle history.
-- This must be committed before a later migration can safely use the new
-- enum value in inserts/selects on PostgreSQL.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'consultant';
