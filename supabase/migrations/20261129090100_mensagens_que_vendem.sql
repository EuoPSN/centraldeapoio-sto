-- Fase B · bloco 1 · "Mensagens que vendem" — 2/5: desempenho das mensagens, selo e sugestões.
-- Nada aqui guarda telefone, nome nem fala de cliente. Idempotente.

-- ------------------------------------------------------------
-- config_mensagens_vendem: regra do selo (uma linha só)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config_mensagens_vendem (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_envios INT NOT NULL DEFAULT 10 CHECK (min_envios >= 1),
  limite_baixo NUMERIC NOT NULL DEFAULT 0.7 CHECK (limite_baixo > 0 AND limite_baixo <= 1),
  -- Última vez que a verificação das mensagens abaixo do esperado rodou (no máximo a cada 6 horas).
  ultima_verificacao TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.config_mensagens_vendem TO authenticated;
GRANT ALL ON public.config_mensagens_vendem TO service_role;
ALTER TABLE public.config_mensagens_vendem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_mensagens_vendem_read" ON public.config_mensagens_vendem;
CREATE POLICY "config_mensagens_vendem_read" ON public.config_mensagens_vendem
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "config_mensagens_vendem_insert_admin" ON public.config_mensagens_vendem;
CREATE POLICY "config_mensagens_vendem_insert_admin" ON public.config_mensagens_vendem
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "config_mensagens_vendem_update_admin" ON public.config_mensagens_vendem;
CREATE POLICY "config_mensagens_vendem_update_admin" ON public.config_mensagens_vendem
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_config_mensagens_vendem_updated ON public.config_mensagens_vendem;
CREATE TRIGGER trg_config_mensagens_vendem_updated
  BEFORE UPDATE ON public.config_mensagens_vendem
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.config_mensagens_vendem (id, min_envios, limite_baixo) VALUES (1, 10, 0.7)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- mensagens_usos: "Copiar" das mensagens do "Fechar com este cliente" (fechamento_itens).
-- caso_id NÃO tem chave estrangeira: o caso é apagado quando a venda é concluída.
-- levou_fechamento vira true quando o caso chega em "venda concluída".
-- versao fica vazia: fechamento_itens não tem versões.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensagens_usos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  origem TEXT NOT NULL DEFAULT 'fechamento' CHECK (origem IN ('fechamento')),
  item_id UUID NOT NULL REFERENCES public.fechamento_itens(id) ON DELETE CASCADE,
  versao INT,
  caso_id UUID,
  levou_fechamento BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mensagens_usos TO authenticated;
GRANT ALL ON public.mensagens_usos TO service_role;
ALTER TABLE public.mensagens_usos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensagens_usos_insert_own" ON public.mensagens_usos;
CREATE POLICY "mensagens_usos_insert_own" ON public.mensagens_usos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND levou_fechamento = false);

DROP POLICY IF EXISTS "mensagens_usos_read" ON public.mensagens_usos;
CREATE POLICY "mensagens_usos_read" ON public.mensagens_usos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_mensagens_usos_item ON public.mensagens_usos(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_usos_caso ON public.mensagens_usos(caso_id) WHERE caso_id IS NOT NULL;

-- Marca como "levou ao fechamento" os usos do caso (só do próprio atendente). Chamada ao concluir a venda.
CREATE OR REPLACE FUNCTION public.mensagens_usos_marcar_fechamento(_caso_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sem sessão.' USING ERRCODE = '42501'; END IF;
  UPDATE public.mensagens_usos
     SET levou_fechamento = true
   WHERE caso_id = _caso_id AND user_id = auth.uid() AND levou_fechamento = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.mensagens_usos_marcar_fechamento(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mensagens_usos_marcar_fechamento(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------
-- mensagens_sugestoes: nova versão sugerida pela IA para mensagem abaixo do esperado.
-- Só o Admin lê e escreve. Uma sugestão por (mensagem, versão): "Ignorar" não sugere de novo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensagens_sugestoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES public.cadencia_mensagens(id) ON DELETE CASCADE,
  versao_base INT NOT NULL,
  texto_sugerido TEXT NOT NULL,
  por_que_mudar TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'ignorada')),
  -- Versão criada quando aprovada (para o antes e depois).
  versao_criada INT,
  decidido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, versao_base)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_sugestoes TO authenticated;
GRANT ALL ON public.mensagens_sugestoes TO service_role;
ALTER TABLE public.mensagens_sugestoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensagens_sugestoes_read_admin" ON public.mensagens_sugestoes;
CREATE POLICY "mensagens_sugestoes_read_admin" ON public.mensagens_sugestoes
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "mensagens_sugestoes_insert_admin" ON public.mensagens_sugestoes;
CREATE POLICY "mensagens_sugestoes_insert_admin" ON public.mensagens_sugestoes
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "mensagens_sugestoes_update_admin" ON public.mensagens_sugestoes;
CREATE POLICY "mensagens_sugestoes_update_admin" ON public.mensagens_sugestoes
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "mensagens_sugestoes_delete_admin" ON public.mensagens_sugestoes;
CREATE POLICY "mensagens_sugestoes_delete_admin" ON public.mensagens_sugestoes
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_mensagens_sugestoes_status ON public.mensagens_sugestoes(status, created_at DESC);

-- ------------------------------------------------------------
-- Cálculo do desempenho (interno; só as duas funções públicas abaixo o chamam).
--
-- ATRIBUIÇÃO: um "respondeu" ou "fechou" conta para a ÚLTIMA mensagem marcada como "Enviei"
-- daquela retomada antes do evento, dentro do mesmo ciclo (um "voltou_fila" entre os dois
-- zera a ligação). Cada "Enviei" conta uma vez em "responderam" (se teve respondeu OU fechou)
-- e uma vez em "fecharam" (se teve fechou), com a mensagem e a versão gravadas no "Enviei".
--
-- SELO (config_mensagens_vendem): sem selo abaixo de min_envios. Taxa = responderam/enviadas
-- (cadência) ou fecharam/usos (Fechar com este cliente, que não tem "respondeu"). Média da
-- etapa = taxa somada de todas as versões do mesmo ponto de parada e etapa.
-- Taxa >= média: "funciona_bem"; taxa < limite_baixo x média: "vale_testar_outra"; senão sem selo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._mensagens_calc(_desde TIMESTAMPTZ)
RETURNS TABLE (
  origem TEXT, ponto TEXT, etapa TEXT, mensagem_id UUID, versao INT, titulo TEXT,
  enviadas BIGINT, responderam BIGINT, fecharam BIGINT,
  media_resposta NUMERIC, media_fechamento NUMERIC, selo TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH cfg AS (
  SELECT COALESCE((SELECT min_envios FROM public.config_mensagens_vendem WHERE id = 1), 10) AS min_envios,
         COALESCE((SELECT limite_baixo FROM public.config_mensagens_vendem WHERE id = 1), 0.7) AS limite_baixo
),
envios AS (
  SELECT e.id, e.etapa, e.mensagem_id, e.mensagem_versao AS versao,
         CASE WHEN e.etapa = 'follow_up' THEN 'follow_up' ELSE COALESCE(e.ponto_parada, 'desconhecido') END AS ponto
    FROM public.retomada_eventos e
   WHERE e.acao = 'enviei' AND e.mensagem_id IS NOT NULL AND e.mensagem_versao IS NOT NULL
     AND (_desde IS NULL OR e.created_at >= _desde)
),
desfechos AS (
  SELECT d.acao,
         (SELECT s.id FROM public.retomada_eventos s
           WHERE s.retomada_id = d.retomada_id AND s.acao = 'enviei' AND s.created_at < d.created_at
             AND NOT EXISTS (
               SELECT 1 FROM public.retomada_eventos v
                WHERE v.retomada_id = d.retomada_id AND v.acao = 'voltou_fila'
                  AND v.created_at > s.created_at AND v.created_at < d.created_at)
           ORDER BY s.created_at DESC, s.id DESC
           LIMIT 1) AS envio_id
    FROM public.retomada_eventos d
   WHERE d.acao IN ('respondeu', 'fechou')
),
por_envio AS (
  SELECT ev.ponto, ev.etapa, ev.mensagem_id, ev.versao,
         EXISTS (SELECT 1 FROM desfechos x WHERE x.envio_id = ev.id) AS respondeu,
         EXISTS (SELECT 1 FROM desfechos x WHERE x.envio_id = ev.id AND x.acao = 'fechou') AS fechou
    FROM envios ev
),
cadencia AS (
  SELECT 'cadencia'::text AS origem, p.ponto, p.etapa, p.mensagem_id, p.versao, ''::text AS titulo,
         count(*)::bigint AS enviadas,
         (count(*) FILTER (WHERE p.respondeu))::bigint AS responderam,
         (count(*) FILTER (WHERE p.fechou))::bigint AS fecharam
    FROM por_envio p
   GROUP BY p.ponto, p.etapa, p.mensagem_id, p.versao
),
fechar AS (
  SELECT 'fechamento'::text AS origem, fi.tipo AS ponto, fi.etapa, u.item_id AS mensagem_id, NULL::int AS versao, fi.titulo,
         count(*)::bigint AS enviadas,
         NULL::bigint AS responderam,
         (count(*) FILTER (WHERE u.levou_fechamento))::bigint AS fecharam
    FROM public.mensagens_usos u
    JOIN public.fechamento_itens fi ON fi.id = u.item_id
   WHERE u.origem = 'fechamento' AND (_desde IS NULL OR u.created_at >= _desde)
   GROUP BY fi.tipo, fi.etapa, u.item_id, fi.titulo
),
todas AS (SELECT * FROM cadencia UNION ALL SELECT * FROM fechar),
medias AS (
  SELECT t.origem, t.ponto, t.etapa,
         sum(t.enviadas) AS env, sum(t.responderam) AS resp, sum(t.fecharam) AS fech
    FROM todas t
   GROUP BY t.origem, t.ponto, t.etapa
)
SELECT t.origem, t.ponto, t.etapa, t.mensagem_id, t.versao, t.titulo,
       t.enviadas, t.responderam, t.fecharam,
       CASE WHEN t.origem = 'cadencia' AND m.env > 0 THEN m.resp::numeric / m.env END AS media_resposta,
       CASE WHEN m.env > 0 THEN m.fech::numeric / m.env END AS media_fechamento,
       CASE
         WHEN t.enviadas < c.min_envios THEN NULL
         WHEN m.env = 0 THEN NULL
         WHEN (CASE WHEN t.origem = 'cadencia' THEN m.resp ELSE m.fech END) = 0 THEN NULL
         WHEN (CASE WHEN t.origem = 'cadencia' THEN t.responderam ELSE t.fecharam END)::numeric / t.enviadas
              >= (CASE WHEN t.origem = 'cadencia' THEN m.resp ELSE m.fech END)::numeric / m.env THEN 'funciona_bem'
         WHEN (CASE WHEN t.origem = 'cadencia' THEN t.responderam ELSE t.fecharam END)::numeric / t.enviadas
              < c.limite_baixo * ((CASE WHEN t.origem = 'cadencia' THEN m.resp ELSE m.fech END)::numeric / m.env) THEN 'vale_testar_outra'
         ELSE NULL
       END AS selo
  FROM todas t
  JOIN medias m ON m.origem = t.origem AND m.ponto = t.ponto AND m.etapa = t.etapa
  CROSS JOIN cfg c;
$$;

REVOKE ALL ON FUNCTION public._mensagens_calc(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mensagens_calc(TIMESTAMPTZ) TO service_role;

-- Admin: enviadas, responderam, fecharam e selo por ponto de parada, etapa e versão.
-- periodo_dias vazio = desde o começo.
CREATE OR REPLACE FUNCTION public.mensagens_desempenho(periodo_dias INT DEFAULT NULL)
RETURNS TABLE (
  origem TEXT, ponto TEXT, etapa TEXT, mensagem_id UUID, versao INT, titulo TEXT,
  enviadas BIGINT, responderam BIGINT, fecharam BIGINT,
  media_resposta NUMERIC, media_fechamento NUMERIC, selo TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT * FROM public._mensagens_calc(
      CASE WHEN periodo_dias IS NULL THEN NULL ELSE now() - make_interval(days => periodo_dias) END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.mensagens_desempenho(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mensagens_desempenho(INT) TO authenticated, service_role;

-- Qualquer usuário logado: só mensagem, versão, envios da equipe e selo. Sem percentuais
-- e sem dados de outros atendentes.
CREATE OR REPLACE FUNCTION public.mensagens_selo()
RETURNS TABLE (origem TEXT, mensagem_id UUID, versao INT, envios BIGINT, selo TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sem sessão.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.origem, c.mensagem_id, c.versao, c.enviadas, c.selo
      FROM public._mensagens_calc(NULL) c;
END;
$$;

REVOKE ALL ON FUNCTION public.mensagens_selo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mensagens_selo() TO authenticated, service_role;

-- Qualquer usuário logado: o texto da versão anterior (mais recente) com selo "Funciona bem",
-- para as mensagens publicadas que já tiveram versão nova ("Ver outra versão →").
CREATE OR REPLACE FUNCTION public.mensagens_versao_anterior()
RETURNS TABLE (mensagem_id UUID, versao INT, texto TEXT, canal TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sem sessão.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT DISTINCT ON (c.mensagem_id) c.mensagem_id, vv.versao, vv.texto, vv.canal
      FROM public._mensagens_calc(NULL) c
      JOIN public.cadencia_mensagens m ON m.id = c.mensagem_id AND m.status = 'publicada'
      JOIN public.cadencia_mensagens_versoes vv ON vv.mensagem_id = c.mensagem_id AND vv.versao = c.versao
     WHERE c.origem = 'cadencia' AND c.selo = 'funciona_bem' AND c.versao < m.versao
     ORDER BY c.mensagem_id, c.versao DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.mensagens_versao_anterior() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mensagens_versao_anterior() TO authenticated, service_role;

-- Índice que acelera a atribuição (último "Enviei" antes de cada resposta/fechamento).
CREATE INDEX IF NOT EXISTS idx_retomada_eventos_acao ON public.retomada_eventos(retomada_id, acao, created_at);
