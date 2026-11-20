# Fase B · bloco 1 — migrações para o SQL editor do Lovable Cloud

Rode na ordem abaixo, uma por vez. Todas são idempotentes (podem ser rodadas de novo sem estragar).

## 1. 20261129090000_conversas_fichas.sql

```sql
-- Fase B · bloco 1 · "Conversas que fecharam" — 1/4: fichas de aprendizado e votos.
-- A conversa bruta NUNCA é guardada: só a ficha (sem telefone, CPF, e-mail, nome do
-- cliente ou fala do cliente). Idempotente.

CREATE TABLE IF NOT EXISTS public.conversas_fichas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  retomada_id UUID REFERENCES public.retomadas(id) ON DELETE SET NULL,
  objecao_id UUID REFERENCES public.objecoes(id) ON DELETE SET NULL,
  objecao_rotulo TEXT NOT NULL DEFAULT '' CHECK (char_length(objecao_rotulo) <= 120),
  ponto_parada TEXT NOT NULL
    CHECK (ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  plano TEXT NOT NULL DEFAULT 'outro' CHECK (plano IN ('Prata', 'Ouro', 'Diamante', 'outro')),
  perfil_cliente TEXT NOT NULL DEFAULT '' CHECK (char_length(perfil_cliente) <= 160),
  onde_travou TEXT NOT NULL DEFAULT '' CHECK (char_length(onde_travou) <= 800),
  o_que_fez TEXT[] NOT NULL DEFAULT '{}',
  mensagem_chave TEXT NOT NULL DEFAULT '' CHECK (char_length(mensagem_chave) <= 1500),
  por_que_funcionou TEXT NOT NULL DEFAULT '' CHECK (char_length(por_que_funcionou) <= 800),
  dias_ate_fechar INT CHECK (dias_ate_fechar IS NULL OR dias_ate_fechar >= 0),
  -- Data do fechamento (última mensagem da conversa), só a data.
  fechou_em DATE,
  status TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'publicada', 'recusada')),
  motivo_recusa TEXT CHECK (motivo_recusa IS NULL OR char_length(motivo_recusa) <= 500),
  aprovada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  publicada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas_fichas TO authenticated;
GRANT ALL ON public.conversas_fichas TO service_role;
ALTER TABLE public.conversas_fichas ENABLE ROW LEVEL SECURITY;

-- Ver: o autor vê as próprias; todos os logados veem as publicadas; admin vê tudo.
DROP POLICY IF EXISTS "conversas_fichas_select" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_select" ON public.conversas_fichas
  FOR SELECT TO authenticated
  USING (autor_id = auth.uid() OR status = 'publicada' OR private.has_role(auth.uid(), 'admin'::app_role));

-- Criar: o autor só cria ficha "enviada" e em nome próprio (nada de aprovar a si mesmo).
DROP POLICY IF EXISTS "conversas_fichas_insert_own" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_insert_own" ON public.conversas_fichas
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND status = 'enviada'
    AND aprovada_por IS NULL AND publicada_em IS NULL AND motivo_recusa IS NULL
    AND (retomada_id IS NULL OR EXISTS (
      SELECT 1 FROM public.retomadas r WHERE r.id = retomada_id AND r.user_id = auth.uid()
    ))
  );

-- Admin: cria (+ Enviar conversa), edita, aprova, recusa, despublica e apaga.
DROP POLICY IF EXISTS "conversas_fichas_insert_admin" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_insert_admin" ON public.conversas_fichas
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "conversas_fichas_update_admin" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_update_admin" ON public.conversas_fichas
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "conversas_fichas_delete_admin" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_delete_admin" ON public.conversas_fichas
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_conversas_fichas_updated ON public.conversas_fichas;
CREATE TRIGGER trg_conversas_fichas_updated
  BEFORE UPDATE ON public.conversas_fichas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_conversas_fichas_status ON public.conversas_fichas(status, publicada_em DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_fichas_autor ON public.conversas_fichas(autor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_fichas_objecao ON public.conversas_fichas(objecao_id);
CREATE INDEX IF NOT EXISTS idx_conversas_fichas_retomada ON public.conversas_fichas(retomada_id);

-- ------------------------------------------------------------
-- conversas_fichas_feedback: "Isso ajudou" / "Não ajudou". Um voto por pessoa por ficha.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversas_fichas_feedback (
  ficha_id UUID NOT NULL REFERENCES public.conversas_fichas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  util BOOLEAN NOT NULL,
  motivo TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ficha_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas_fichas_feedback TO authenticated;
GRANT ALL ON public.conversas_fichas_feedback TO service_role;
ALTER TABLE public.conversas_fichas_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fichas_feedback_select" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_select" ON public.conversas_fichas_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- Só vota em ficha publicada.
DROP POLICY IF EXISTS "fichas_feedback_insert_own" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_insert_own" ON public.conversas_fichas_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.conversas_fichas f WHERE f.id = ficha_id AND f.status = 'publicada'
  ));

-- Mudar o próprio voto.
DROP POLICY IF EXISTS "fichas_feedback_update_own" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_update_own" ON public.conversas_fichas_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "fichas_feedback_delete_own" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_delete_own" ON public.conversas_fichas_feedback
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_fichas_feedback_ficha ON public.conversas_fichas_feedback(ficha_id);
```

## 2. 20261129090100_biblioteca_ferramenta_ia.sql

```sql
-- Fase B · bloco 1 · "Conversas que fecharam" — 2/4: nova ferramenta de IA "biblioteca"
-- (limite diário, blocos do Cérebro). Idempotente: rode uma vez; se rodar de novo,
-- só repete o que já está feito.

-- 1) Aceitar "biblioteca" nas listas de ferramentas (troca os CHECKs que listam "simulador").
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid IN ('public.ia_uso'::regclass, 'public.ia_limites'::regclass,
                         'public.ia_limites_extra'::regclass, 'public.cerebro_blocos'::regclass)
      AND pg_get_constraintdef(c.oid) ILIKE '%simulador%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.ia_uso ADD CONSTRAINT ia_uso_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.ia_limites ADD CONSTRAINT ia_limites_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.ia_limites_extra ADD CONSTRAINT ia_limites_extra_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.cerebro_blocos ADD CONSTRAINT cerebro_blocos_ferramentas_check
  CHECK (ferramentas <@ ARRAY['marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca']::text[]);

-- 2) Limite padrão: 10 fichas por dia por atendente (admin não tem limite).
INSERT INTO public.ia_limites (ferramenta, limite_diario) VALUES ('biblioteca', 10)
ON CONFLICT (ferramenta) DO NOTHING;

-- 3) Blocos padrão da "biblioteca": playbook CDT, mapeamento de objeções, padrão de escrita,
--    etapas do funil e SPIN. Só acrescenta a ferramenta; não mexe no conteúdo.
UPDATE public.cerebro_blocos
   SET ferramentas = array_append(ferramentas, 'biblioteca')
 WHERE chave IN ('playbook_cdt', 'mapeamento_objecoes', 'padrao_escrita', 'etapas_funil', 'spin_selling')
   AND NOT ('biblioteca' = ANY (ferramentas));
```

## 3. 20261129090200_mensagens_vendem.sql

```sql
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
```

## 4. 20261129090300_fase_b_admin_sections.sql

```sql
-- Fase B · bloco 1 — 4/4: seções novas do Painel Admin (grupo Atendimento). Idempotente.
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('mensagensvendem',    'Mensagens que vendem', 'TrendingUp', 'Atendimento', 100, true),
  ('conversasenviadas',  'Conversas enviadas',   'Library',    'Atendimento', 110, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
```

