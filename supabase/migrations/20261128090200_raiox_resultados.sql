-- Fase A · bloco 3 · Cérebro da Omnia — 3/4: resultados do Raio-X da venda.
-- Guarda só o resultado da análise (trechos já sem nome/telefone do cliente),
-- nunca a conversa. Apagado automaticamente após 90 dias. Idempotente.

CREATE TABLE IF NOT EXISTS public.raiox_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  retomada_id UUID REFERENCES public.retomadas(id) ON DELETE SET NULL,
  etapa TEXT,
  onde_perdeu JSONB NOT NULL DEFAULT '{}'::jsonb,
  faltou JSONB NOT NULL DEFAULT '[]'::jsonb,
  reescrita JSONB NOT NULL DEFAULT '{}'::jsonb,
  escrita JSONB NOT NULL DEFAULT '[]'::jsonb,
  habito JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.raiox_resultados TO authenticated;
GRANT ALL ON public.raiox_resultados TO service_role;
ALTER TABLE public.raiox_resultados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "raiox_insert_own" ON public.raiox_resultados;
CREATE POLICY "raiox_insert_own" ON public.raiox_resultados
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (retomada_id IS NULL OR EXISTS (
      SELECT 1 FROM public.retomadas r WHERE r.id = retomada_id AND r.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "raiox_read" ON public.raiox_resultados;
CREATE POLICY "raiox_read" ON public.raiox_resultados
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_raiox_user ON public.raiox_resultados(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raiox_data ON public.raiox_resultados(created_at DESC);

-- Limpeza: Raio-X com mais de 90 dias e registros de uso com mais de 35 dias.
-- Chamada ao abrir /raiox e, se o pg_cron existir, todo dia às 03:41.
CREATE OR REPLACE FUNCTION public.limpar_raiox()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT := 0; k INT;
BEGIN
  DELETE FROM public.raiox_resultados WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS k = ROW_COUNT;
  n := n + k;
  DELETE FROM public.ia_uso WHERE created_at < now() - interval '35 days';
  GET DIAGNOSTICS k = ROW_COUNT;
  n := n + k;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_raiox() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpar_raiox() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('limpar_raiox');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule('limpar_raiox', '41 3 * * *', 'SELECT public.limpar_raiox();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível: a limpeza roda ao abrir a página.';
END;
$$;
