CREATE TABLE public.agent_workspace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID,
  thread_id UUID REFERENCES public.agent_threads(id) ON DELETE SET NULL,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  url TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'considering' CHECK (status IN ('considering','preparing','submitted','discarded')),
  decision TEXT,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, grant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_workspace TO authenticated;
GRANT ALL ON public.agent_workspace TO service_role;
ALTER TABLE public.agent_workspace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own workspace" ON public.agent_workspace FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX agent_workspace_user_idx ON public.agent_workspace (user_id, status);