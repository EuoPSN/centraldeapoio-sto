# Bloco 3 · Mudanças e Ranking — migrações em ordem

Rode no SQL editor do Lovable Cloud, uma de cada vez, nesta ordem. Todas são idempotentes. Dependem dos blocos 1 e 2 da Fase B e da Fase A (`aquecimento_exercicios`, `cerebro_blocos`, `retomada_eventos`, `conversas_fichas`, `objecoes`, `admin_sections`, `private.has_role`).

Enquanto a 1 não rodar, a Omnia segue sem a faixa e a página de mudanças. Enquanto a 2 não rodar, o Cérebro segue sem o bloco "Mudanças recentes". Enquanto a 3 não rodar, o Ranking mostra estado vazio e o Excel sai sem as abas novas.

Testadas em PostgreSQL 16 com tabelas de teste: aplicam duas vezes sem erro; `ranking_podios` não devolve posição fora do top 3; `ranking_admin` e `changelog_resumo_confirmacoes` recusam quem não é admin.

## 1. `20261201090000_mudancas_tabelas.sql`

```sql
-- Fase B · bloco 3 — 1/3: Aviso de mudanças (Novidades com tipo e confirmação "Li e entendi").
-- Idempotente. Não apaga dados: as entradas existentes viram tipo "informativa".

-- ------------------------------------------------------------
-- changelog_entries: colunas novas
-- ------------------------------------------------------------
ALTER TABLE public.changelog_entries
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'informativa',
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS vale_a_partir DATE,
  ADD COLUMN IF NOT EXISTS validade DATE,
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS pergunta_checagem JSONB,
  ADD COLUMN IF NOT EXISTS exercicio_id UUID REFERENCES public.aquecimento_exercicios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usar_na_ia BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incorporada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publicada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS criada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'changelog_entries_tipo_check') THEN
    ALTER TABLE public.changelog_entries
      ADD CONSTRAINT changelog_entries_tipo_check CHECK (tipo IN ('informativa', 'importante', 'urgente'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'changelog_entries_origem_check') THEN
    ALTER TABLE public.changelog_entries
      ADD CONSTRAINT changelog_entries_origem_check CHECK (origem IN ('manual', 'auto'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'changelog_entries_link_check') THEN
    ALTER TABLE public.changelog_entries
      ADD CONSTRAINT changelog_entries_link_check CHECK (link IS NULL OR (link LIKE '/%' AND link NOT LIKE '//%' AND char_length(link) <= 200));
  END IF;
END;
$$;

-- As que já existiam foram publicadas na data de criação.
UPDATE public.changelog_entries SET publicada_em = created_at WHERE published AND publicada_em IS NULL;

-- Publicar pela primeira vez grava a data de publicação.
CREATE OR REPLACE FUNCTION public.changelog_set_publicada_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.published AND NEW.publicada_em IS NULL THEN
    NEW.publicada_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_changelog_publicada_em ON public.changelog_entries;
CREATE TRIGGER trg_changelog_publicada_em
  BEFORE INSERT OR UPDATE ON public.changelog_entries
  FOR EACH ROW EXECUTE FUNCTION public.changelog_set_publicada_em();

CREATE INDEX IF NOT EXISTS idx_changelog_tipo_publicada ON public.changelog_entries(tipo, published, publicada_em DESC);

-- Escrita: a política "changelog_write_admin" (FOR ALL, só admin) continua valendo.
-- Leitura: atendente só enxerga o que está publicado (rascunho é do Admin).
DROP POLICY IF EXISTS "changelog_read_auth" ON public.changelog_entries;
CREATE POLICY "changelog_read_auth" ON public.changelog_entries
  FOR SELECT TO authenticated
  USING (published OR private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- changelog_confirmacoes: "Li e entendi" (uma por pessoa por mudança)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.changelog_confirmacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.changelog_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Nulo quando a mudança não tem pergunta de checagem.
  acertou_checagem BOOLEAN,
  UNIQUE (entry_id, user_id)
);

GRANT SELECT, INSERT ON public.changelog_confirmacoes TO authenticated;
GRANT ALL ON public.changelog_confirmacoes TO service_role;
ALTER TABLE public.changelog_confirmacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "changelog_confirmacoes_insert_own" ON public.changelog_confirmacoes;
CREATE POLICY "changelog_confirmacoes_insert_own" ON public.changelog_confirmacoes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "changelog_confirmacoes_read" ON public.changelog_confirmacoes;
CREATE POLICY "changelog_confirmacoes_read" ON public.changelog_confirmacoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_changelog_confirmacoes_entry ON public.changelog_confirmacoes(entry_id);
CREATE INDEX IF NOT EXISTS idx_changelog_confirmacoes_user ON public.changelog_confirmacoes(user_id);

-- ------------------------------------------------------------
-- Resumo das confirmações por mudança (só admin). Denominador: usuários ativos que
-- não são admin (mesma regra de Funcionários e do check-list).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.changelog_resumo_confirmacoes()
RETURNS TABLE (
  entry_id UUID,
  total INT,
  confirmadas INT,
  acertos INT,
  com_checagem INT,
  faltam_ids UUID[]
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
  WITH atendentes AS (
    SELECT p.id FROM public.profiles p
     WHERE COALESCE(p.is_active, true)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role)
  )
  SELECT e.id,
         (SELECT count(*) FROM atendentes)::INT,
         (SELECT count(*) FROM public.changelog_confirmacoes c WHERE c.entry_id = e.id AND c.user_id IN (SELECT id FROM atendentes))::INT,
         (SELECT count(*) FROM public.changelog_confirmacoes c WHERE c.entry_id = e.id AND c.acertou_checagem IS TRUE AND c.user_id IN (SELECT id FROM atendentes))::INT,
         (SELECT count(*) FROM public.changelog_confirmacoes c WHERE c.entry_id = e.id AND c.acertou_checagem IS NOT NULL AND c.user_id IN (SELECT id FROM atendentes))::INT,
         COALESCE((SELECT array_agg(a.id) FROM atendentes a
                    WHERE NOT EXISTS (SELECT 1 FROM public.changelog_confirmacoes c WHERE c.entry_id = e.id AND c.user_id = a.id)), ARRAY[]::UUID[])
    FROM public.changelog_entries e
   WHERE e.published AND e.tipo IN ('importante', 'urgente');
END;
$$;

REVOKE ALL ON FUNCTION public.changelog_resumo_confirmacoes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.changelog_resumo_confirmacoes() TO authenticated, service_role;

-- ------------------------------------------------------------
-- Seção do Admin: "Novidades" vira "Mudanças" (mesma chave), no grupo Atendimento.
-- ------------------------------------------------------------
UPDATE public.admin_sections
   SET label = 'Mudanças', group_name = 'Atendimento', position = 100, visible = true
 WHERE tab_key = 'changelog';
```

## 2. `20261201090100_mudancas_cerebro.sql`

```sql
-- Fase B · bloco 3 — 2/3: bloco automático "Mudanças recentes" no Cérebro. Idempotente.
-- O texto é montado na hora, no servidor, a partir de changelog_entries (tipo importante ou urgente,
-- publicada, "usar na IA" ligado, não incorporada ao Playbook, publicada nos últimos 30 dias).
-- gerado = true: o Admin não edita o conteúdo nem a matriz "Quem usa o quê" desta linha.
INSERT INTO public.cerebro_blocos (chave, titulo, descricao_curta, conteudo, ferramentas, gerado, ordem) VALUES
  ('mudancas_recentes', 'Mudanças recentes', 'Mudanças importantes e urgentes dos últimos 30 dias (automático)', '',
    ARRAY['marciana','mensagem_cliente','cliente_disse','copiloto','retomada','biblioteca'], true, 70)
ON CONFLICT (chave) DO NOTHING;
```

## 3. `20261201090200_ranking.sql`

```sql
-- Fase B · bloco 3 — 3/3: Ranking de qualidade (pódios mensais). Idempotente.
-- Cada atendente vê só os 3 primeiros e o próprio valor, nunca a posição de ninguém fora do top 3.
-- O Admin vê a lista completa por ranking_admin. Os dados de retomada entram só como contagens.

-- ------------------------------------------------------------
-- ranking_config (uma linha) e ranking_ocultos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ranking_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  podio_constantes BOOLEAN NOT NULL DEFAULT true,
  podio_respondidas BOOLEAN NOT NULL DEFAULT true,
  podio_evoluiram BOOLEAN NOT NULL DEFAULT true,
  podio_ensinam BOOLEAN NOT NULL DEFAULT true,
  podio_treino BOOLEAN NOT NULL DEFAULT true,
  minimo_retomadas INT NOT NULL DEFAULT 15 CHECK (minimo_retomadas BETWEEN 1 AND 500),
  periodo TEXT NOT NULL DEFAULT 'mensal' CHECK (periodo IN ('mensal')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.ranking_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.ranking_config TO authenticated;
GRANT ALL ON public.ranking_config TO service_role;
ALTER TABLE public.ranking_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_config_read" ON public.ranking_config;
CREATE POLICY "ranking_config_read" ON public.ranking_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ranking_config_insert_admin" ON public.ranking_config;
CREATE POLICY "ranking_config_insert_admin" ON public.ranking_config
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "ranking_config_update_admin" ON public.ranking_config;
CREATE POLICY "ranking_config_update_admin" ON public.ranking_config
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Pessoas ocultas num mês (folga, afastamento): somem dos pódios, sem apagar dados.
CREATE TABLE IF NOT EXISTS public.ranking_ocultos (
  mes DATE NOT NULL CHECK (mes = date_trunc('month', mes)::date),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mes, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.ranking_ocultos TO authenticated;
GRANT ALL ON public.ranking_ocultos TO service_role;
ALTER TABLE public.ranking_ocultos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_ocultos_read_admin" ON public.ranking_ocultos;
CREATE POLICY "ranking_ocultos_read_admin" ON public.ranking_ocultos
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "ranking_ocultos_insert_admin" ON public.ranking_ocultos;
CREATE POLICY "ranking_ocultos_insert_admin" ON public.ranking_ocultos
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "ranking_ocultos_delete_admin" ON public.ranking_ocultos;
CREATE POLICY "ranking_ocultos_delete_admin" ON public.ranking_ocultos
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- ranking_hall: campeões (1º ao 3º) de cada pódio nos meses fechados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ranking_hall (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes DATE NOT NULL CHECK (mes = date_trunc('month', mes)::date),
  podio TEXT NOT NULL CHECK (podio IN ('constantes', 'respondidas', 'evoluiram', 'ensinam', 'treino')),
  posicao INT NOT NULL CHECK (posicao BETWEEN 1 AND 3),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mes, podio, posicao)
);

-- Escrita só por funções SECURITY DEFINER / service role (fechamento do mês) e pelo Admin.
GRANT SELECT, INSERT, UPDATE ON public.ranking_hall TO authenticated;
GRANT ALL ON public.ranking_hall TO service_role;
ALTER TABLE public.ranking_hall ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_hall_read" ON public.ranking_hall;
CREATE POLICY "ranking_hall_read" ON public.ranking_hall FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ranking_hall_insert_admin" ON public.ranking_hall;
CREATE POLICY "ranking_hall_insert_admin" ON public.ranking_hall
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "ranking_hall_update_admin" ON public.ranking_hall;
CREATE POLICY "ranking_hall_update_admin" ON public.ranking_hall
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ranking_hall_mes ON public.ranking_hall(mes DESC);

-- ------------------------------------------------------------
-- Cálculo (interno): os quatro pódios de qualidade de um mês.
--  constantes : % das retomadas com prazo no mês feitas no dia do prazo. Unidade = etapa de uma
--               retomada (prazo = primeira data prevista; "feita no dia" = primeiro "Enviei" até o
--               fim do dia do prazo, horário de Brasília). Só entram etapas com prazo vencido
--               (dia do prazo já passou) ou já enviadas.
--  respondidas: entre as retomadas com pelo menos um "Enviei" no mês, % em que o cliente respondeu
--               ou fechou depois do primeiro "Enviei" do mês.
--  evoluiram  : variação % da nota média do Simulador sobre a do mês anterior (mínimo 3 simulações
--               em cada mês; só entra no pódio quem melhorou).
--  ensinam    : conversas publicadas na biblioteca (publicada_em no mês) + objeções publicadas com
--               crédito ao autor (created_at no mês).
-- Pódios de % só qualificam com o mínimo de retomadas do mês (ranking_config). Quem está oculto no
-- mês, é admin ou está inativo não entra. O Treino no Simulador é calculado no servidor da Omnia.
-- Função interna: ninguém a chama direto (só as funções abaixo).
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
  v_min INT; v_c BOOLEAN; v_r BOOLEAN; v_e BOOLEAN; v_n BOOLEAN;
BEGIN
  SELECT c.minimo_retomadas, c.podio_constantes, c.podio_respondidas, c.podio_evoluiram, c.podio_ensinam
    INTO v_min, v_c, v_r, v_e, v_n
    FROM public.ranking_config c WHERE c.id = 1;
  v_min := COALESCE(v_min, 15);
  v_c := COALESCE(v_c, true); v_r := COALESCE(v_r, true); v_e := COALESCE(v_e, true); v_n := COALESCE(v_n, true);

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

-- ------------------------------------------------------------
-- ranking_podios(mes): qualquer autenticado. Devolve, por pódio, SÓ o top 3 (nome e valor) e o valor
-- da própria pessoa (mês e mês anterior). Nunca a posição de ninguém fora do top 3.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ranking_podios(p_mes DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes DATE := date_trunc('month', p_mes)::date;
  v_ant DATE := (date_trunc('month', p_mes) - interval '1 month')::date;
  v_eu UUID := auth.uid();
  v_min INT;
  v_out JSONB;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para ver o ranking.' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(c.minimo_retomadas, 15) INTO v_min FROM public.ranking_config c WHERE c.id = 1;

  WITH cur AS (SELECT * FROM public.ranking_calcular(v_mes)),
       ant AS (SELECT * FROM public.ranking_calcular(v_ant)),
       pds AS (SELECT DISTINCT cur.podio FROM cur)
  SELECT COALESCE(jsonb_object_agg(p.podio, jsonb_build_object(
    'top', COALESCE((SELECT jsonb_agg(jsonb_build_object('posicao', c.posicao, 'nome', c.nome, 'valor', c.valor, 'voce', c.user_id = v_eu) ORDER BY c.posicao)
                       FROM cur c WHERE c.podio = p.podio AND c.posicao <= 3), '[]'::jsonb),
    'meu', (SELECT jsonb_build_object('valor', c.valor, 'total', c.total, 'qualifica', c.qualifica, 'no_podio', COALESCE(c.posicao <= 3, false))
              FROM cur c WHERE c.podio = p.podio AND c.user_id = v_eu),
    'anterior', (SELECT a.valor FROM ant a WHERE a.podio = p.podio AND a.user_id = v_eu)
  )), '{}'::jsonb)
  INTO v_out
  FROM pds p;

  RETURN jsonb_build_object('mes', v_mes, 'minimo_retomadas', COALESCE(v_min, 15), 'podios', v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_podios(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking_podios(DATE) TO authenticated, service_role;

-- ------------------------------------------------------------
-- ranking_admin(mes, podio): só admin. Lista completa com valor, total e se entra no pódio.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ranking_admin(p_mes DATE, p_podio TEXT)
RETURNS TABLE (user_id UUID, nome TEXT, valor NUMERIC, total INT, entra_no_podio BOOLEAN, posicao INT)
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
  SELECT c.user_id, c.nome, c.valor, c.total, c.qualifica, c.posicao
    FROM public.ranking_calcular(p_mes) c
   WHERE c.podio = p_podio
   ORDER BY c.posicao NULLS LAST, c.valor DESC NULLS LAST, c.total DESC, c.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_admin(DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking_admin(DATE, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Fechamento do mês anterior, sem cron. Idempotente: o servidor chama ao abrir /ranking e o Início.
-- Grava o top 3 dos quatro pódios de qualidade; o Treino é gravado pelo servidor da Omnia.
-- ------------------------------------------------------------
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
  IF EXISTS (SELECT 1 FROM public.ranking_hall h WHERE h.mes = v_mes AND h.podio IN ('constantes', 'respondidas', 'evoluiram', 'ensinam')) THEN
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

-- Campeões (1º lugar) de cada pódio nos meses fechados, com o nome. Qualquer autenticado.
CREATE OR REPLACE FUNCTION public.ranking_hall_campeoes(p_meses INT DEFAULT 12)
RETURNS TABLE (mes DATE, podio TEXT, nome TEXT, valor NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT h.mes, h.podio,
         COALESCE(NULLIF(trim(p.display_name), ''), split_part(p.email, '@', 1), 'Sem nome'),
         h.valor
    FROM public.ranking_hall h
    LEFT JOIN public.profiles p ON p.id = h.user_id
   WHERE h.posicao = 1
     AND h.mes >= (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - make_interval(months => GREATEST(p_meses, 1)))::date
   ORDER BY h.mes DESC, h.podio;
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_hall_campeoes(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking_hall_campeoes(INT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Seção do Admin: Ranking (grupo Treino e evolução)
-- ------------------------------------------------------------
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('rankingadmin', 'Ranking', 'Trophy', 'Treino', 80, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
```
