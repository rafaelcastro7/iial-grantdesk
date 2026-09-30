GRANT SELECT ON public.agent_flags TO authenticated;
GRANT INSERT, UPDATE ON public.agent_flags TO authenticated;
GRANT ALL ON public.agent_flags TO service_role;
DROP POLICY IF EXISTS "agent_flags: authenticated can read" ON public.agent_flags;
CREATE POLICY "agent_flags: authenticated can read" ON public.agent_flags FOR SELECT TO authenticated USING (true);