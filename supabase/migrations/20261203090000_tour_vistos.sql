-- Tutoriais das páginas: guarda qual tour cada pessoa já viu (e em que versão),
-- para o tour abrir sozinho só na 1ª visita. Idempotente.

CREATE TABLE IF NOT EXISTS public.tour_vistos (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  tour_id TEXT NOT NULL CHECK (char_length(tour_id) BETWEEN 1 AND 60),
  versao INT NOT NULL DEFAULT 1 CHECK (versao >= 1),
  visto_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour_id)
);

GRANT SELECT, INSERT, UPDATE ON public.tour_vistos TO authenticated;
GRANT ALL ON public.tour_vistos TO service_role;
ALTER TABLE public.tour_vistos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tour_vistos_select_own" ON public.tour_vistos;
CREATE POLICY "tour_vistos_select_own" ON public.tour_vistos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tour_vistos_insert_own" ON public.tour_vistos;
CREATE POLICY "tour_vistos_insert_own" ON public.tour_vistos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tour_vistos_update_own" ON public.tour_vistos;
CREATE POLICY "tour_vistos_update_own" ON public.tour_vistos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Sem política de DELETE: a pessoa não apaga o próprio histórico.
