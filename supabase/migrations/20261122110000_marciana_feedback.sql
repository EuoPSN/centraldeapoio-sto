-- MarcIAna §6: feedback (útil / não útil) por resposta.
CREATE TABLE public.marciana_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('util', 'nao_util')),
  motivos TEXT[] NOT NULL DEFAULT '{}',
  comentario TEXT,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Um feedback por usuário por mensagem; editar substitui (upsert).
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marciana_feedback TO authenticated;
GRANT ALL ON public.marciana_feedback TO service_role;
ALTER TABLE public.marciana_feedback ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_marciana_feedback_updated BEFORE UPDATE ON public.marciana_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_marciana_feedback_message ON public.marciana_feedback(message_id);
CREATE INDEX idx_marciana_feedback_created ON public.marciana_feedback(created_at DESC);

-- Cada usuário cria e vê o próprio feedback; admin vê todos.
CREATE POLICY "marciana_feedback_read_own_or_admin" ON public.marciana_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "marciana_feedback_insert_own" ON public.marciana_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "marciana_feedback_update_own" ON public.marciana_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "marciana_feedback_update_admin" ON public.marciana_feedback
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "marciana_feedback_delete_own" ON public.marciana_feedback
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "marciana_feedback_delete_admin" ON public.marciana_feedback
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
