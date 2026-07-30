
CREATE TABLE IF NOT EXISTS public.training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  progress_pct integer NOT NULL DEFAULT 100 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_completions TO authenticated;
GRANT ALL ON public.training_completions TO service_role;

ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own training_completions"
  ON public.training_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users insert own training_completions"
  ON public.training_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own training_completions"
  ON public.training_completions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins delete training_completions"
  ON public.training_completions FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_access_logs_user_created ON public.access_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_resource_type ON public.access_logs (resource_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulator_results_user_created ON public.simulator_results (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulator_results_created ON public.simulator_results (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulator_sessions_user_started ON public.simulator_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated ON public.chat_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON public.chat_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_completions_user ON public.training_completions (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_completions_content ON public.training_completions (content_id);

INSERT INTO public.nav_items (label, icon, route, section, position, visible, admin_only)
SELECT 'Dashboard', 'LayoutDashboard', '/dashboard', 'admin', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.nav_items WHERE route = '/dashboard');
