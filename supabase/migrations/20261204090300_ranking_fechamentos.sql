-- Fase C · extensão 2 — 4/4: pódio "Mais fechamentos" no Ranking e base do comparativo "Antes e depois". Idempotente.
-- Pré-requisito: migrações 1 a 3 desta fase (precisa de crm_fechamentos).

-- ------------------------------------------------------------
-- Sexto pódio: liga/desliga em ranking_config e Hall do mês
-- ------------------------------------------------------------
ALTER TABLE public.ranking_config ADD COLUMN IF NOT EXISTS podio_fechamentos BOOLEAN NOT NULL DEFAULT true;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname FROM pg_constraint c
     WHERE c.contype = 'c' AND c.conrelid = 'public.ranking_hall'::regclass
       AND pg_get_constraintdef(c.oid) ILIKE '%podio%' AND pg_get_constraintdef(c.oid) ILIKE '%constantes%'
  LOOP
    EXECUTE format('ALTER TABLE public.ranking_hall DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;
ALTER TABLE public.ranking_hall DROP CONSTRAINT IF EXISTS ranking_hall_podio_check;
ALTER TABLE public.ranking_hall ADD CONSTRAINT ranking_hall_podio_check
  CHECK (podio IN ('constantes', 'respondidas', 'evoluiram', 'ensinam', 'treino', 'fechamentos'));

-- ------------------------------------------------------------
-- Cálculo interno: os cinco pódios de qualidade do mês (os quatro de sempre + fechamentos).
-- Quem está oculto no mês, é admin ou está inativo não entra (igual aos outros).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ranking_calcular(p_mes DATE)
RETURNS TABLE (podio TEXT, user_id UUID, nome TEXT, valor NUMERIC, total INT, qualifica BOOLEAN, posicao INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes DATE := date_trunc('month', p_mes)::date;
  v_ini TIMESTAMPTZ := (v_mes::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_fim TIMESTAMPTZ := ((v_mes + interval '1 month')::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_ant TIMESTAMPTZ := ((v_mes - interval '1 month')::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_min INT; v_c BOOLEAN; v_r BOOLEAN; v_e BOOLEAN; v_n BOOLEAN; v_f BOOLEAN;
BEGIN
  SELECT c.minimo_retomadas, c.podio_constantes, c.podio_respondidas, c.podio_evoluiram, c.podio_ensinam, c.podio_fechamentos
    INTO v_min, v_c, v_r, v_e, v_n, v_f
    FROM public.ranking_config c WHERE c.id = 1;
  v_min := COALESCE(v_min, 15);
  v_c := COALESCE(v_c, true); v_r := COALESCE(v_r, true); v_e := COALESCE(v_e, true); v_n := COALESCE(v_n, true); v_f := COALESCE(v_f, true);

  RETURN QUERY
  WITH at AS (
    SELECT p.id AS uid,
           COALESCE(NULLIF(trim(p.display_name), ''), split_part(p.email, '@', 1), 'Sem nome') AS nm
      FROM public.profiles p
     WHERE COALESCE(p.is_active, true)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role)
       AND NOT EXISTS (SELECT 1 FROM public.ranking_ocultos o WHERE o.user_id = p.id AND o.mes = v_mes)
  ),
  unid AS (
    SELECT e.user_id AS uid, e.retomada_id, e.etapa,
           (min(e.prevista_em) AT TIME ZONE 'America/Sao_Paulo')::date AS prazo,
           ((min(e.created_at) FILTER (WHERE e.acao = 'enviei')) AT TIME ZONE 'America/Sao_Paulo')::date AS feito
      FROM public.retomada_eventos e
     WHERE e.acao IN ('recomendada', 'copiou', 'enviei') AND e.prevista_em IS NOT NULL
     GROUP BY e.user_id, e.retomada_id, e.etapa
  ),
  cons AS (
    SELECT u.uid, count(*)::int AS n,
           100.0 * count(*) FILTER (WHERE u.feito IS NOT NULL AND u.feito <= u.prazo) / count(*) AS v
      FROM unid u
     WHERE u.prazo >= v_mes AND u.prazo < (v_mes + interval '1 month')::date
       AND (u.prazo < v_hoje OR u.feito IS NOT NULL)
     GROUP BY u.uid
  ),
  env AS (
    SELECT e.user_id AS uid, e.retomada_id, min(e.created_at) AS primeiro
      FROM public.retomada_eventos e
     WHERE e.acao = 'enviei' AND e.created_at >= v_ini AND e.created_at < v_fim
     GROUP BY e.user_id, e.retomada_id
  ),
  resp AS (
    SELECT env.uid, count(*)::int AS n,
           100.0 * count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM public.retomada_eventos r
              WHERE r.retomada_id = env.retomada_id AND r.acao IN ('respondeu', 'fechou') AND r.created_at >= env.primeiro
           )) / count(*) AS v
      FROM env GROUP BY env.uid
  ),
  sim AS (
    SELECT s.user_id AS uid,
           avg(s.nota) FILTER (WHERE s.created_at >= v_ini) AS a,
           count(*) FILTER (WHERE s.created_at >= v_ini)::int AS na,
           avg(s.nota) FILTER (WHERE s.created_at < v_ini) AS b,
           count(*) FILTER (WHERE s.created_at < v_ini)::int AS nb
      FROM public.simulator_results s
     WHERE s.created_at >= v_ant AND s.created_at < v_fim
     GROUP BY s.user_id
  ),
  ens AS (
    SELECT x.uid, count(*)::int AS n FROM (
      SELECT f.autor_id AS uid FROM public.conversas_fichas f
       WHERE f.status = 'publicada' AND f.publicada_em >= v_ini AND f.publicada_em < v_fim
      UNION ALL
      SELECT o.autor_id FROM public.objecoes o
       WHERE o.status = 'publicada' AND o.autor_id IS NOT NULL AND o.created_at >= v_ini AND o.created_at < v_fim
    ) x GROUP BY x.uid
  ),
  fech AS (
    -- Mais fechamentos: vendas do mês confirmadas no CRM (uma linha por dia de venda). Sem mínimo de retomadas.
    SELECT f.user_id AS uid, sum(f.vendas)::int AS n
      FROM public.crm_fechamentos f
     WHERE f.periodo_ini >= v_mes AND f.periodo_ini < (v_mes + interval '1 month')::date
     GROUP BY f.user_id
  ),
  todos AS (
    SELECT 'constantes'::text AS pd, a.uid, a.nm, c.v AS vv, COALESCE(c.n, 0) AS tt,
           (COALESCE(c.n, 0) >= v_min AND c.v IS NOT NULL) AS q
      FROM at a LEFT JOIN cons c ON c.uid = a.uid WHERE v_c
    UNION ALL
    SELECT 'respondidas', a.uid, a.nm, r.v, COALESCE(r.n, 0),
           (COALESCE(r.n, 0) >= v_min AND r.v IS NOT NULL)
      FROM at a LEFT JOIN resp r ON r.uid = a.uid WHERE v_r
    UNION ALL
    SELECT 'evoluiram', a.uid, a.nm,
           CASE WHEN s.na >= 3 AND s.nb >= 3 AND s.b > 0 THEN 100.0 * (s.a - s.b) / s.b END,
           COALESCE(s.na, 0),
           (s.na >= 3 AND s.nb >= 3 AND s.b > 0 AND s.a > s.b)
      FROM at a LEFT JOIN sim s ON s.uid = a.uid WHERE v_e
    UNION ALL
    SELECT 'ensinam', a.uid, a.nm, COALESCE(n.n, 0)::numeric, COALESCE(n.n, 0), (COALESCE(n.n, 0) > 0)
      FROM at a LEFT JOIN ens n ON n.uid = a.uid WHERE v_n
    UNION ALL
    SELECT 'fechamentos', a.uid, a.nm, COALESCE(f.n, 0)::numeric, COALESCE(f.n, 0), (COALESCE(f.n, 0) > 0)
      FROM at a LEFT JOIN fech f ON f.uid = a.uid WHERE v_f
  )
  SELECT t.pd, t.uid, t.nm, round(t.vv, 1), t.tt::int, COALESCE(t.q, false),
         CASE WHEN COALESCE(t.q, false)
              THEN (row_number() OVER (PARTITION BY t.pd, COALESCE(t.q, false) ORDER BY t.vv DESC NULLS LAST, t.tt DESC, t.nm))::int
         END
    FROM todos t;
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_calcular(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ranking_calcular(DATE) TO service_role;

-- Fechamento do mês anterior: agora também grava o top 3 de "Mais fechamentos".
-- Meses já fechados antes desta migração não ganham o novo pódio (ficam como estão).
CREATE OR REPLACE FUNCTION public.ranking_fechar_mes(p_mes DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes DATE := date_trunc('month', p_mes)::date;
  v_atual DATE := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta.' USING ERRCODE = '42501';
  END IF;
  -- Só fecha mês que já acabou.
  IF v_mes >= v_atual THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ranking_hall h WHERE h.mes = v_mes AND h.podio IN ('constantes', 'respondidas', 'evoluiram', 'ensinam', 'fechamentos')) THEN
    RETURN;
  END IF;
  INSERT INTO public.ranking_hall (mes, podio, posicao, user_id, valor)
  SELECT v_mes, c.podio, c.posicao, c.user_id, c.valor
    FROM public.ranking_calcular(v_mes) c
   WHERE c.posicao BETWEEN 1 AND 3 AND c.valor IS NOT NULL
  ON CONFLICT (mes, podio, posicao) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_fechar_mes(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking_fechar_mes(DATE) TO authenticated, service_role;

-- ------------------------------------------------------------
-- extensao_inicio: data de início do "Antes e depois" escolhida pelo Admin (por atendente).
-- Sem linha, vale a data do primeiro evento da extensão. Só o Admin lê e escreve.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_inicio (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inicio DATE NOT NULL,
  definido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extensao_inicio TO authenticated;
GRANT ALL ON public.extensao_inicio TO service_role;
ALTER TABLE public.extensao_inicio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_inicio_read_admin" ON public.extensao_inicio;
CREATE POLICY "extensao_inicio_read_admin" ON public.extensao_inicio
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "extensao_inicio_insert_admin" ON public.extensao_inicio;
CREATE POLICY "extensao_inicio_insert_admin" ON public.extensao_inicio
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "extensao_inicio_update_admin" ON public.extensao_inicio;
CREATE POLICY "extensao_inicio_update_admin" ON public.extensao_inicio
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "extensao_inicio_delete_admin" ON public.extensao_inicio;
CREATE POLICY "extensao_inicio_delete_admin" ON public.extensao_inicio
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
