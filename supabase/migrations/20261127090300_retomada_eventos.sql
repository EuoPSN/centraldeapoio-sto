-- Fase A · bloco 2 · "Retomar hoje" — 4/5: eventos da cadência e limpeza diária.
-- Idempotente.

-- ------------------------------------------------------------
-- retomada_eventos: uma linha por ação (copiou, enviei, respondeu…).
-- Não guarda telefone nem fala do cliente. O Admin lê tudo (só números/códigos).
-- prevista_em: quando a etapa deveria ser feita (para medir "feita no dia").
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retomada_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retomada_id UUID NOT NULL REFERENCES public.retomadas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  -- Ponto de parada do ticket no momento da ação (o ticket pode mudar de ponto ao voltar para a fila).
  ponto_parada TEXT CHECK (ponto_parada IS NULL OR ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  etapa TEXT NOT NULL CHECK (etapa IN ('follow_up', 'd1', 'd2', 'd4', 'd7', 'd10')),
  acao TEXT NOT NULL CHECK (acao IN (
    'recomendada', 'copiou', 'enviei', 'respondeu', 'fechou', 'perdido',
    'voltou_fila', 'follow_up_agendado', 'esfriou'
  )),
  mensagem_id UUID REFERENCES public.cadencia_mensagens(id) ON DELETE SET NULL,
  mensagem_versao INT,
  usou_recomendada BOOLEAN,
  prevista_em TIMESTAMPTZ,
  detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.retomada_eventos TO authenticated;
GRANT ALL ON public.retomada_eventos TO service_role;
ALTER TABLE public.retomada_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retomada_eventos_insert_own" ON public.retomada_eventos;
CREATE POLICY "retomada_eventos_insert_own" ON public.retomada_eventos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.retomadas r WHERE r.id = retomada_id AND r.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "retomada_eventos_read" ON public.retomada_eventos;
CREATE POLICY "retomada_eventos_read" ON public.retomada_eventos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_retomada_eventos_retomada ON public.retomada_eventos(retomada_id, created_at);
CREATE INDEX IF NOT EXISTS idx_retomada_eventos_user ON public.retomada_eventos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retomada_eventos_data ON public.retomada_eventos(created_at DESC);

-- ------------------------------------------------------------
-- Limpeza diária:
--  1) D+10 enviado há mais de 2 dias, sem resposta -> status "esfriou" (+ evento);
--  2) telefone apagado 30 dias após created_at.
-- Chamada ao abrir /retomar e, se o pg_cron existir, todo dia às 03:27.
-- O gatilho do telefone apaga o número na mesma atualização do "esfriou".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_retomadas()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT := 0; k INT;
BEGIN
  WITH esfriados AS (
    UPDATE public.retomadas
       SET status = 'esfriou', proxima_em = NULL
     WHERE status = 'fila' AND d10_enviado_em IS NOT NULL AND d10_enviado_em < now() - interval '2 days'
    RETURNING id, user_id, etapa_atual, ponto_parada
  )
  INSERT INTO public.retomada_eventos (retomada_id, user_id, ponto_parada, etapa, acao)
  SELECT id, user_id, ponto_parada, etapa_atual, 'esfriou' FROM esfriados;
  GET DIAGNOSTICS k = ROW_COUNT;
  n := n + k;

  UPDATE public.retomadas SET telefone = NULL
   WHERE telefone IS NOT NULL AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS k = ROW_COUNT;
  n := n + k;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_retomadas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpar_retomadas() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('limpar_retomadas');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule('limpar_retomadas', '27 3 * * *', 'SELECT public.limpar_retomadas();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível: a limpeza roda ao abrir a página.';
END;
$$;
