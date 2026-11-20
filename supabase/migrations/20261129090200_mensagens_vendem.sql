-- Fase B · bloco 1 · "Mensagens que vendem" — 3/4: regras do selo, usos das mensagens do
-- fechamento, sugestões da IA e funções de desempenho. Idempotente.

-- ------------------------------------------------------------
-- config_mensagens_vendem: regras do selo (uma única linha). Só o Admin lê e edita;
-- as funções abaixo (SECURITY DEFINER) leem por dentro.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config_mensagens_vendem (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_envios INT NOT NULL DEFAULT 10 CHECK (min_envios >= 1),
  -- "Vale testar outra" quando a taxa fica abaixo de limite_baixo × a média da etapa.
  limite_baixo NUMERIC(3,2) NOT NULL DEFAULT 0.70 CHECK (limite_baixo > 0 AND limite_baixo <= 1),
  -- Última vez que a IA procurou mensagens abaixo do esperado (no máximo a cada 6 horas).
  ultima_verificacao TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE ON public.config_mensagens_vendem TO authenticated;
GRANT ALL ON public.config_mensagens_vendem TO service_role;
ALTER TABLE public.config_mensagens_vendem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_mensagens_vendem_select_admin" ON public.config_mensagens_vendem;
CREATE POLICY "config_mensagens_vendem_select_admin" ON public.config_mensagens_vendem
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "config_mensagens_vendem_insert_admin" ON public.config_mensagens_vendem;
CREATE POLICY "config_mensagens_vendem_insert_admin" ON public.config_mensagens_vendem
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "config_mensagens_vendem_update_admin" ON public.config_mensagens_vendem;
CREATE POLICY "config_mensagens_vendem_update_admin" ON public.config_mensagens_vendem
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.config_mensagens_vendem (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- mensagens_usos: "Copiar" das mensagens do "Fechar com este cliente".
-- Sem telefone nem texto. fechou_em é preenchido quando o caso chega em "Venda concluída"
-- (o caso é apagado, por isso caso_id vira NULL; a linha continua).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensagens_usos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  origem TEXT NOT NULL DEFAULT 'fechamento' CHECK (origem IN ('fechamento')),
  item_id UUID NOT NULL REFERENCES public.fechamento_itens(id) ON DELETE CASCADE,
  versao INT NOT NULL DEFAULT 1,
  caso_id UUID REFERENCES public.fechamento_casos(id) ON DELETE SET NULL,
  fechou_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mensagens_usos TO authenticated;
GRANT ALL ON public.mensagens_usos TO service_role;
ALTER TABLE public.mensagens_usos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensagens_usos_select" ON public.mensagens_usos;
CREATE POLICY "mensagens_usos_select" ON public.mensagens_usos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "mensagens_usos_insert_own" ON public.mensagens_usos;
CREATE POLICY "mensagens_usos_insert_own" ON public.mensagens_usos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mensagens_usos_update_own" ON public.mensagens_usos;
CREATE POLICY "mensagens_usos_update_own" ON public.mensagens_usos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Uma mensagem conta uma vez por caso, por mais que seja copiada.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mensagens_usos_caso_item ON public.mensagens_usos(caso_id, item_id) WHERE caso_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensagens_usos_item ON public.mensagens_usos(item_id, created_at DESC);

-- ------------------------------------------------------------
-- mensagens_sugestoes: nova versão sugerida pela IA para uma mensagem abaixo do esperado.
-- Só o Admin vê e decide. UNIQUE (mensagem, versão): "Ignorar" não sugere de novo a mesma versão.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensagens_sugestoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES public.cadencia_mensagens(id) ON DELETE CASCADE,
  versao_base INT NOT NULL,
  texto_sugerido TEXT NOT NULL,
  por_que_mudar TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'ignorada')),
  decidido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em TIMESTAMPTZ,
  -- Versão que nasceu da aprovação (para o antes e depois).
  versao_criada INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, versao_base)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_sugestoes TO authenticated;
GRANT ALL ON public.mensagens_sugestoes TO service_role;
ALTER TABLE public.mensagens_sugestoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensagens_sugestoes_select_admin" ON public.mensagens_sugestoes;
CREATE POLICY "mensagens_sugestoes_select_admin" ON public.mensagens_sugestoes
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
-- Cálculo (interno, schema private: ninguém chama direto, só as funções públicas abaixo).
--
-- Atribuição da cadência: a resposta ou o fechamento conta para a ÚLTIMA mensagem marcada
-- como "Enviei" daquela retomada antes do evento (ignorando o que veio antes de um
-- "voltou para a fila"). Fechou também conta como respondeu (quem fechou respondeu).
-- Por envio: conta uma vez, mesmo que haja mais de um evento.
--
-- Fechamento: "enviadas" = casos (salvos) em que a mensagem foi copiada; "fecharam" = desses, os que
-- chegaram em "Venda concluída". Não existe "respondeu" para elas; o selo usa só o fechamento.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.mensagens_selos(p_desde TIMESTAMPTZ)
RETURNS TABLE (
  origem TEXT, mensagem_id UUID, versao INT, ponto_parada TEXT, etapa TEXT,
  enviadas BIGINT, responderam BIGINT, fecharam BIGINT, media_taxa NUMERIC, selo TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT min_envios, limite_baixo FROM public.config_mensagens_vendem WHERE id = 1
  ),
  envios AS (
    SELECT e.id, e.mensagem_id, COALESCE(e.mensagem_versao, 1) AS versao
    FROM public.retomada_eventos e
    WHERE e.acao = 'enviei' AND e.mensagem_id IS NOT NULL AND (p_desde IS NULL OR e.created_at >= p_desde)
  ),
  desfechos AS (
    SELECT ev.acao,
      (SELECT en.id FROM public.retomada_eventos en
        WHERE en.retomada_id = ev.retomada_id AND en.acao = 'enviei' AND en.created_at < ev.created_at
          AND NOT EXISTS (
            SELECT 1 FROM public.retomada_eventos v
            WHERE v.retomada_id = ev.retomada_id AND v.acao = 'voltou_fila'
              AND v.created_at > en.created_at AND v.created_at < ev.created_at)
        ORDER BY en.created_at DESC LIMIT 1) AS envio_id
    FROM public.retomada_eventos ev
    WHERE ev.acao IN ('respondeu', 'fechou')
  ),
  por_envio AS (
    SELECT en.id, en.mensagem_id, en.versao,
           COALESCE(bool_or(d.acao IN ('respondeu', 'fechou')), false) AS respondeu,
           COALESCE(bool_or(d.acao = 'fechou'), false) AS fechou
    FROM envios en
    LEFT JOIN desfechos d ON d.envio_id = en.id
    GROUP BY en.id, en.mensagem_id, en.versao
  ),
  cadencia AS (
    SELECT 'cadencia'::text AS origem, pe.mensagem_id, pe.versao, cm.ponto_parada, cm.etapa,
           count(*)::bigint AS enviadas,
           count(*) FILTER (WHERE pe.respondeu)::bigint AS responderam,
           count(*) FILTER (WHERE pe.fechou)::bigint AS fecharam,
           -- métrica do selo: respondeu
           count(*) FILTER (WHERE pe.respondeu)::bigint AS metrica
    FROM por_envio pe
    JOIN public.cadencia_mensagens cm ON cm.id = pe.mensagem_id
    GROUP BY pe.mensagem_id, pe.versao, cm.ponto_parada, cm.etapa
  ),
  fechamento AS (
    SELECT 'fechamento'::text AS origem, u.item_id AS mensagem_id, 1 AS versao, 'fechamento'::text AS ponto_parada, fi.etapa,
           count(*)::bigint AS enviadas,
           0::bigint AS responderam,
           count(*) FILTER (WHERE u.fechou_em IS NOT NULL)::bigint AS fecharam,
           -- métrica do selo: fechou
           count(*) FILTER (WHERE u.fechou_em IS NOT NULL)::bigint AS metrica
    FROM public.mensagens_usos u
    JOIN public.fechamento_itens fi ON fi.id = u.item_id
    WHERE (p_desde IS NULL OR u.created_at >= p_desde)
    GROUP BY u.item_id, fi.etapa
  ),
  todas AS (SELECT * FROM cadencia UNION ALL SELECT * FROM fechamento),
  medias AS (
    SELECT t.origem, t.ponto_parada, t.etapa,
           sum(t.metrica)::numeric / NULLIF(sum(t.enviadas), 0) AS media
    FROM todas t
    GROUP BY t.origem, t.ponto_parada, t.etapa
  )
  SELECT t.origem, t.mensagem_id, t.versao, t.ponto_parada, t.etapa,
         t.enviadas, t.responderam, t.fecharam,
         COALESCE(m.media, 0) AS media_taxa,
         CASE
           WHEN t.enviadas < (SELECT min_envios FROM cfg) THEN NULL
           WHEN COALESCE(m.media, 0) > 0 AND t.metrica::numeric / t.enviadas >= m.media THEN 'funciona_bem'
           WHEN t.metrica::numeric / t.enviadas < (SELECT limite_baixo FROM cfg) * COALESCE(m.media, 0) THEN 'vale_testar'
           ELSE NULL
         END AS selo
  FROM todas t
  LEFT JOIN medias m ON m.origem = t.origem AND m.ponto_parada = t.ponto_parada AND m.etapa = t.etapa
$$;

REVOKE ALL ON FUNCTION private.mensagens_selos(TIMESTAMPTZ) FROM PUBLIC;

-- ------------------------------------------------------------
-- Admin: desempenho completo (enviadas, % respondeu, % fechou) por versão.
-- p_dias NULL = desde o começo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mensagens_desempenho(p_dias INT DEFAULT 30)
RETURNS TABLE (
  origem TEXT, mensagem_id UUID, versao INT, ponto_parada TEXT, etapa TEXT,
  enviadas BIGINT, responderam BIGINT, fecharam BIGINT, media_taxa NUMERIC, selo TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.origem, s.mensagem_id, s.versao, s.ponto_parada, s.etapa,
           s.enviadas, s.responderam, s.fecharam, s.media_taxa, s.selo
    FROM private.mensagens_selos(CASE WHEN p_dias IS NULL THEN NULL ELSE now() - make_interval(days => p_dias) END) s;
END;
$$;

REVOKE ALL ON FUNCTION public.mensagens_desempenho(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mensagens_desempenho(INT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Qualquer atendente: só o selo e quantas vezes a equipe usou. Sem percentuais e
-- sem dados de outros atendentes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mensagens_selo()
RETURNS TABLE (origem TEXT, mensagem_id UUID, versao INT, envios BIGINT, selo TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre para ver.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.origem, s.mensagem_id, s.versao, s.enviadas AS envios, s.selo
    FROM private.mensagens_selos(NULL) s;
END;
$$;

REVOKE ALL ON FUNCTION public.mensagens_selo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mensagens_selo() TO authenticated, service_role;

-- ------------------------------------------------------------
-- Qualquer atendente: texto da versão anterior mais recente com selo "Funciona bem"
-- (só mensagens da cadência já publicadas e substituídas).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mensagens_versao_boa()
RETURNS TABLE (mensagem_id UUID, versao INT, texto TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre para ver.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT DISTINCT ON (v.mensagem_id) v.mensagem_id, v.versao, v.texto
    FROM private.mensagens_selos(NULL) s
    JOIN public.cadencia_mensagens_versoes v ON v.mensagem_id = s.mensagem_id AND v.versao = s.versao
    WHERE s.origem = 'cadencia' AND s.selo = 'funciona_bem'
    ORDER BY v.mensagem_id, v.versao DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.mensagens_versao_boa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mensagens_versao_boa() TO authenticated, service_role;
