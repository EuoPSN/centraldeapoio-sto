-- Fase A · bloco 1 · "O cliente disse…" — 4/5: registro de uso (cada "Copiar").
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.cliente_disse_uso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  objecao_id UUID REFERENCES public.objecoes(id) ON DELETE CASCADE,
  fechamento_item_id UUID REFERENCES public.fechamento_itens(id) ON DELETE CASCADE,
  angulo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (objecao_id IS NOT NULL OR fechamento_item_id IS NOT NULL)
);

GRANT SELECT, INSERT ON public.cliente_disse_uso TO authenticated;
GRANT ALL ON public.cliente_disse_uso TO service_role;
ALTER TABLE public.cliente_disse_uso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cliente_disse_uso_insert_own" ON public.cliente_disse_uso;
CREATE POLICY "cliente_disse_uso_insert_own" ON public.cliente_disse_uso
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cliente_disse_uso_read" ON public.cliente_disse_uso;
CREATE POLICY "cliente_disse_uso_read" ON public.cliente_disse_uso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cliente_disse_uso_objecao ON public.cliente_disse_uso(objecao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cliente_disse_uso_item ON public.cliente_disse_uso(fechamento_item_id, created_at DESC);

-- Contagem de uso por objeção e ângulo (todos os atendentes), sem expor quem usou.
CREATE OR REPLACE FUNCTION public.cliente_disse_contagens(_dias INT DEFAULT NULL)
RETURNS TABLE (objecao_id UUID, angulo TEXT, total BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.objecao_id, u.angulo, count(*)::bigint
  FROM public.cliente_disse_uso u
  WHERE u.objecao_id IS NOT NULL
    AND (_dias IS NULL OR u.created_at >= now() - make_interval(days => _dias))
  GROUP BY u.objecao_id, u.angulo;
$$;

REVOKE ALL ON FUNCTION public.cliente_disse_contagens(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cliente_disse_contagens(INT) TO authenticated, service_role;
