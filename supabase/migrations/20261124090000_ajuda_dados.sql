-- Central de Ajuda (página 7 do redesign OMNIA) — dados novos:
-- "Isso ajudou?" por artigo, contagem de "mais vistos esta semana",
-- vínculo opcional de uma sugestão/dúvida com o artigo que a originou,
-- e a data da última visita de cada usuário a Novidades (ponto dourado).

-- ============ ISSO AJUDOU? ============
CREATE TABLE IF NOT EXISTS public.ajuda_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  util BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_item_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.ajuda_feedback TO authenticated;
GRANT ALL ON public.ajuda_feedback TO service_role;
ALTER TABLE public.ajuda_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ajuda_feedback_select_own_or_admin" ON public.ajuda_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ajuda_feedback_insert_own" ON public.ajuda_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ajuda_feedback_update_own" ON public.ajuda_feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ajuda_feedback_updated') THEN
    CREATE TRIGGER trg_ajuda_feedback_updated BEFORE UPDATE ON public.ajuda_feedback
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ============ MAIS VISTOS ESTA SEMANA ============
CREATE TABLE IF NOT EXISTS public.content_item_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_item_views_item_created ON public.content_item_views(content_item_id, created_at);
GRANT SELECT, INSERT ON public.content_item_views TO authenticated;
GRANT ALL ON public.content_item_views TO service_role;
ALTER TABLE public.content_item_views ENABLE ROW LEVEL SECURITY;

-- Leitura agregada (contagem de visualizações) não é sensível: qualquer
-- pessoa autenticada pode ler, só não pode inserir em nome de outra.
CREATE POLICY "content_item_views_select_auth" ON public.content_item_views FOR SELECT TO authenticated USING (true);
CREATE POLICY "content_item_views_insert_own" ON public.content_item_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ SUGESTÕES VINDAS DE "NÃO RESOLVEU?" ============
ALTER TABLE public.suggestions
  ADD COLUMN IF NOT EXISTS content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL;

-- ============ NOVIDADES NÃO VISTAS (ponto dourado) ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ajuda_novidades_vistas_em TIMESTAMPTZ;

-- Grava a visita da própria pessoa (não depende da política geral de update de profiles).
CREATE OR REPLACE FUNCTION public.marcar_ajuda_novidades_vistas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET ajuda_novidades_vistas_em = now() WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_ajuda_novidades_vistas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_ajuda_novidades_vistas() FROM anon;
GRANT EXECUTE ON FUNCTION public.marcar_ajuda_novidades_vistas() TO authenticated;
