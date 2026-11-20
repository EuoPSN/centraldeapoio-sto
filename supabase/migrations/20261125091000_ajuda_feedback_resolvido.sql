-- "Isso ajudou?" negativo passa a poder ser marcado como tratado pelo admin
-- (usado na lista de pendências "O que precisa de você" da entrada do Admin).
ALTER TABLE public.ajuda_feedback ADD COLUMN IF NOT EXISTS resolvido_em TIMESTAMPTZ;

DROP POLICY IF EXISTS "ajuda_feedback_update_admin" ON public.ajuda_feedback;
CREATE POLICY "ajuda_feedback_update_admin" ON public.ajuda_feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
