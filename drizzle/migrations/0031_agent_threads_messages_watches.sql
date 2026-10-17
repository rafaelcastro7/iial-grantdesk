CREATE TABLE public.agent_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  org_id uuid,
  title text NOT NULL DEFAULT 'Nueva conversación',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_threads TO authenticated;
GRANT ALL ON public.agent_threads TO service_role;
ALTER TABLE public.agent_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.agent_threads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX agent_threads_user_idx ON public.agent_threads(user_id, updated_at DESC);

CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.agent_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  ai_message_id text NOT NULL,
  role text NOT NULL,
  message jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, ai_message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.agent_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX agent_messages_thread_idx ON public.agent_messages(thread_id, created_at);

CREATE TABLE public.agent_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  org_id uuid,
  query text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  paused boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  seen_grant_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_watches TO authenticated;
GRANT ALL ON public.agent_watches TO service_role;
ALTER TABLE public.agent_watches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watches" ON public.agent_watches FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.agent_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  watch_id uuid REFERENCES public.agent_watches(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('new_grant','deadline_soon','draft','info')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  grant_id uuid,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','approved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.agent_inbox TO authenticated;
GRANT ALL ON public.agent_inbox TO service_role;
ALTER TABLE public.agent_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inbox read" ON public.agent_inbox FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own inbox update" ON public.agent_inbox FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own inbox delete" ON public.agent_inbox FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX agent_inbox_user_idx ON public.agent_inbox(user_id, status, created_at DESC);