-- Fase B · bloco 2 — 1/3: Aquecimento de 5 minutos e Mapa de domínio (tabelas, RLS e funções).
-- O texto digitado pelo atendente NUNCA é guardado, nem a frase de feedback da IA:
-- só acerto e nota. Idempotente.

-- ------------------------------------------------------------
-- Ferramenta "aquecimento" nos limites de IA e no Cérebro
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tabela, c.conname
      FROM pg_constraint c
     WHERE c.contype = 'c'
       AND c.conrelid IN ('public.ia_uso'::regclass, 'public.ia_limites'::regclass,
                          'public.ia_limites_extra'::regclass, 'public.cerebro_blocos'::regclass)
       AND pg_get_constraintdef(c.oid) ILIKE '%simulador%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabela, r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.ia_uso ADD CONSTRAINT ia_uso_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca','aquecimento'));
ALTER TABLE public.ia_limites ADD CONSTRAINT ia_limites_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca','aquecimento'));
ALTER TABLE public.ia_limites_extra ADD CONSTRAINT ia_limites_extra_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca','aquecimento'));
ALTER TABLE public.cerebro_blocos ADD CONSTRAINT cerebro_blocos_ferramentas_check
  CHECK (ferramentas <@ ARRAY['marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca','aquecimento']::text[]);

-- Limite diário padrão: 5 correções por IA por dia por pessoa (editável no Admin).
INSERT INTO public.ia_limites (ferramenta, limite_diario) VALUES ('aquecimento', 5)
ON CONFLICT (ferramenta) DO NOTHING;

-- Blocos padrão: playbook, mapeamento de objeções, padrão de escrita, etapas do funil e SPIN.
UPDATE public.cerebro_blocos
   SET ferramentas = array_append(ferramentas, 'aquecimento')
 WHERE chave IN ('playbook_cdt', 'mapeamento_objecoes', 'padrao_escrita', 'etapas_funil', 'spin_selling')
   AND NOT ('aquecimento' = ANY (ferramentas));

-- ------------------------------------------------------------
-- dominio_temas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dominio_temas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 60),
  descricao TEXT NOT NULL DEFAULT '' CHECK (char_length(descricao) <= 200),
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dominio_temas TO authenticated;
GRANT ALL ON public.dominio_temas TO service_role;
ALTER TABLE public.dominio_temas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dominio_temas_read" ON public.dominio_temas;
CREATE POLICY "dominio_temas_read" ON public.dominio_temas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dominio_temas_insert_admin" ON public.dominio_temas;
CREATE POLICY "dominio_temas_insert_admin" ON public.dominio_temas
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "dominio_temas_update_admin" ON public.dominio_temas;
CREATE POLICY "dominio_temas_update_admin" ON public.dominio_temas
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "dominio_temas_delete_admin" ON public.dominio_temas;
CREATE POLICY "dominio_temas_delete_admin" ON public.dominio_temas
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_dominio_temas_updated ON public.dominio_temas;
CREATE TRIGGER trg_dominio_temas_updated
  BEFORE UPDATE ON public.dominio_temas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.dominio_temas (nome, descricao, ordem)
SELECT v.nome, v.descricao, v.ordem FROM (VALUES
  ('Planos',         'Prata, Ouro e Diamante: valores, dependentes, carência', 10),
  ('Amor Saúde',     'Consultas, exames, dentista e como agendar', 20),
  ('Fechamento',     'Pagamento no cartão de crédito ou débito, link e dados', 30),
  ('Objeções',       'Respostas e perguntas para avançar', 40),
  ('Refuturiza',     'Como funciona e para quem indicar', 50),
  ('Energia de Todos','Como funciona e para quem indicar', 60),
  ('TIM',            'Benefícios e como oferecer', 70)
) AS v(nome, descricao, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.dominio_temas);

-- ------------------------------------------------------------
-- aquecimento_exercicios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aquecimento_exercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tema_id UUID NOT NULL REFERENCES public.dominio_temas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('multipla_escolha', 'escrita', 'habito')),
  titulo TEXT NOT NULL DEFAULT '' CHECK (char_length(titulo) <= 120),
  pergunta TEXT NOT NULL CHECK (char_length(pergunta) BETWEEN 1 AND 800),
  -- A fala do cliente (para escrita).
  contexto TEXT NOT NULL DEFAULT '' CHECK (char_length(contexto) <= 400),
  -- [{texto, correta}] (múltipla escolha).
  alternativas JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Resposta aprovada (escrita).
  resposta_aprovada TEXT NOT NULL DEFAULT '' CHECK (char_length(resposta_aprovada) <= 1000),
  -- Hábito: regra do Padrão de escrita ou técnica do Cérebro.
  habito_chave TEXT CHECK (habito_chave IS NULL OR char_length(habito_chave) <= 60),
  explicacao TEXT NOT NULL DEFAULT '' CHECK (char_length(explicacao) <= 800),
  fonte TEXT NOT NULL DEFAULT '' CHECK (char_length(fonte) <= 200),
  objecao_id UUID REFERENCES public.objecoes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aprovado', 'arquivado')),
  criado_por TEXT NOT NULL DEFAULT 'admin' CHECK (criado_por IN ('ia', 'admin')),
  aprovado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquecimento_exercicios TO authenticated;
GRANT ALL ON public.aquecimento_exercicios TO service_role;
ALTER TABLE public.aquecimento_exercicios ENABLE ROW LEVEL SECURITY;

-- Atendente lê só os aprovados; admin lê tudo.
DROP POLICY IF EXISTS "aquecimento_exercicios_read" ON public.aquecimento_exercicios;
CREATE POLICY "aquecimento_exercicios_read" ON public.aquecimento_exercicios
  FOR SELECT TO authenticated
  USING (status = 'aprovado' OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "aquecimento_exercicios_insert_admin" ON public.aquecimento_exercicios;
CREATE POLICY "aquecimento_exercicios_insert_admin" ON public.aquecimento_exercicios
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "aquecimento_exercicios_update_admin" ON public.aquecimento_exercicios;
CREATE POLICY "aquecimento_exercicios_update_admin" ON public.aquecimento_exercicios
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "aquecimento_exercicios_delete_admin" ON public.aquecimento_exercicios;
CREATE POLICY "aquecimento_exercicios_delete_admin" ON public.aquecimento_exercicios
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_aquecimento_exercicios_updated ON public.aquecimento_exercicios;
CREATE TRIGGER trg_aquecimento_exercicios_updated
  BEFORE UPDATE ON public.aquecimento_exercicios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_aquecimento_exercicios_tema ON public.aquecimento_exercicios(tema_id, status);
CREATE INDEX IF NOT EXISTS idx_aquecimento_exercicios_status ON public.aquecimento_exercicios(status, created_at DESC);

-- ------------------------------------------------------------
-- aquecimento_sessoes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aquecimento_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  data DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  tipo TEXT NOT NULL CHECK (tipo IN ('diaria', 'tema')),
  tema_id UUID REFERENCES public.dominio_temas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'concluida')),
  iniciada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em TIMESTAMPTZ,
  CHECK (tipo = 'diaria' OR tema_id IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE ON public.aquecimento_sessoes TO authenticated;
GRANT ALL ON public.aquecimento_sessoes TO service_role;
ALTER TABLE public.aquecimento_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aquecimento_sessoes_read" ON public.aquecimento_sessoes;
CREATE POLICY "aquecimento_sessoes_read" ON public.aquecimento_sessoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "aquecimento_sessoes_insert_own" ON public.aquecimento_sessoes;
CREATE POLICY "aquecimento_sessoes_insert_own" ON public.aquecimento_sessoes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "aquecimento_sessoes_update_own" ON public.aquecimento_sessoes;
CREATE POLICY "aquecimento_sessoes_update_own" ON public.aquecimento_sessoes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No máximo uma sessão diária por pessoa por dia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_aquecimento_sessao_diaria
  ON public.aquecimento_sessoes(user_id, data) WHERE tipo = 'diaria';
CREATE INDEX IF NOT EXISTS idx_aquecimento_sessoes_user ON public.aquecimento_sessoes(user_id, data DESC);

-- ------------------------------------------------------------
-- aquecimento_respostas: só acerto e nota. Nunca o texto digitado.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aquecimento_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL REFERENCES public.aquecimento_sessoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  exercicio_id UUID REFERENCES public.aquecimento_exercicios(id) ON DELETE SET NULL,
  tema_id UUID REFERENCES public.dominio_temas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('multipla_escolha', 'escrita', 'habito')),
  acertou BOOLEAN NOT NULL,
  nota INT CHECK (nota IS NULL OR nota BETWEEN 0 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.aquecimento_respostas TO authenticated;
GRANT ALL ON public.aquecimento_respostas TO service_role;
ALTER TABLE public.aquecimento_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aquecimento_respostas_read" ON public.aquecimento_respostas;
CREATE POLICY "aquecimento_respostas_read" ON public.aquecimento_respostas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "aquecimento_respostas_insert_own" ON public.aquecimento_respostas;
CREATE POLICY "aquecimento_respostas_insert_own" ON public.aquecimento_respostas
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.aquecimento_sessoes s WHERE s.id = sessao_id AND s.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_aquecimento_respostas_user ON public.aquecimento_respostas(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aquecimento_respostas_sessao ON public.aquecimento_respostas(sessao_id);
CREATE INDEX IF NOT EXISTS idx_aquecimento_respostas_tema ON public.aquecimento_respostas(tema_id, created_at DESC);

-- ------------------------------------------------------------
-- aquecimento_prefs: aviso do Chrome ligado ou desligado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aquecimento_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  notificar BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.aquecimento_prefs TO authenticated;
GRANT ALL ON public.aquecimento_prefs TO service_role;
ALTER TABLE public.aquecimento_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aquecimento_prefs_read_own" ON public.aquecimento_prefs;
CREATE POLICY "aquecimento_prefs_read_own" ON public.aquecimento_prefs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "aquecimento_prefs_insert_own" ON public.aquecimento_prefs;
CREATE POLICY "aquecimento_prefs_insert_own" ON public.aquecimento_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "aquecimento_prefs_update_own" ON public.aquecimento_prefs;
CREATE POLICY "aquecimento_prefs_update_own" ON public.aquecimento_prefs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- aquecimento_config: uma linha só
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aquecimento_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  horarios TEXT[] NOT NULL DEFAULT ARRAY['08:30', '12:00', '15:00']
    CHECK (cardinality(horarios) BETWEEN 1 AND 6),
  cartoes_por_dia INT NOT NULL DEFAULT 3 CHECK (cartoes_por_dia BETWEEN 1 AND 6),
  janela_dominio_dias INT NOT NULL DEFAULT 60 CHECK (janela_dominio_dias BETWEEN 7 AND 365),
  min_respostas INT NOT NULL DEFAULT 3 CHECK (min_respostas BETWEEN 1 AND 50),
  limiar_dominando NUMERIC NOT NULL DEFAULT 0.75 CHECK (limiar_dominando > 0 AND limiar_dominando <= 1),
  nota_acerto INT NOT NULL DEFAULT 7 CHECK (nota_acerto BETWEEN 1 AND 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.aquecimento_config TO authenticated;
GRANT ALL ON public.aquecimento_config TO service_role;
ALTER TABLE public.aquecimento_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aquecimento_config_read" ON public.aquecimento_config;
CREATE POLICY "aquecimento_config_read" ON public.aquecimento_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "aquecimento_config_insert_admin" ON public.aquecimento_config;
CREATE POLICY "aquecimento_config_insert_admin" ON public.aquecimento_config
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "aquecimento_config_update_admin" ON public.aquecimento_config;
CREATE POLICY "aquecimento_config_update_admin" ON public.aquecimento_config
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.aquecimento_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Funções do mapa de domínio (SECURITY DEFINER)
-- Nível: janela de N dias; menos de min_respostas = nao_testado;
-- acertos/respostas >= limiar = dominando; senão aprendendo.
-- ------------------------------------------------------------

-- Só a própria pessoa (auth.uid()), nunca outra.
CREATE OR REPLACE FUNCTION public.aquecimento_meu_mapa()
RETURNS TABLE (tema_id UUID, respostas INT, acertos INT, nivel TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH c AS (SELECT janela_dominio_dias, min_respostas, limiar_dominando FROM public.aquecimento_config WHERE id = 1),
  r AS (
    SELECT a.tema_id, count(*)::int AS respostas, count(*) FILTER (WHERE a.acertou)::int AS acertos
      FROM public.aquecimento_respostas a, c
     WHERE a.user_id = auth.uid() AND a.tema_id IS NOT NULL
       AND a.created_at >= now() - make_interval(days => c.janela_dominio_dias)
     GROUP BY a.tema_id
  )
  SELECT t.id, COALESCE(r.respostas, 0), COALESCE(r.acertos, 0),
         CASE
           WHEN COALESCE(r.respostas, 0) < c.min_respostas THEN 'nao_testado'
           WHEN r.acertos::numeric / r.respostas >= c.limiar_dominando THEN 'dominando'
           ELSE 'aprendendo'
         END
    FROM public.dominio_temas t
    CROSS JOIN c
    LEFT JOIN r ON r.tema_id = t.id
   WHERE t.ativo
   ORDER BY t.ordem, t.nome;
$$;

-- Só admin: níveis e contagens de cada atendente por tema (nunca texto digitado).
CREATE OR REPLACE FUNCTION public.aquecimento_mapa_equipe()
RETURNS TABLE (user_id UUID, tema_id UUID, respostas INT, acertos INT, nivel TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;
  RETURN QUERY
  WITH c AS (SELECT janela_dominio_dias, min_respostas, limiar_dominando FROM public.aquecimento_config WHERE id = 1),
  r AS (
    SELECT a.user_id, a.tema_id, count(*)::int AS respostas, count(*) FILTER (WHERE a.acertou)::int AS acertos
      FROM public.aquecimento_respostas a, c
     WHERE a.tema_id IS NOT NULL
       AND a.created_at >= now() - make_interval(days => c.janela_dominio_dias)
     GROUP BY a.user_id, a.tema_id
  )
  SELECT r.user_id, r.tema_id, r.respostas, r.acertos,
         CASE
           WHEN r.respostas < c.min_respostas THEN 'nao_testado'
           WHEN r.acertos::numeric / r.respostas >= c.limiar_dominando THEN 'dominando'
           ELSE 'aprendendo'
         END
    FROM r CROSS JOIN c;
END;
$$;

-- Só admin: dias da semana (segunda a sexta, Brasília) com aquecimento diário concluído.
CREATE OR REPLACE FUNCTION public.aquecimento_adesao_semana()
RETURNS TABLE (user_id UUID, dias INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE seg DATE := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;
  RETURN QUERY
  SELECT s.user_id, count(*)::int
    FROM public.aquecimento_sessoes s
   WHERE s.tipo = 'diaria' AND s.status = 'concluida'
     AND s.data BETWEEN seg AND seg + 4
   GROUP BY s.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.aquecimento_meu_mapa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aquecimento_mapa_equipe() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aquecimento_adesao_semana() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aquecimento_meu_mapa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.aquecimento_mapa_equipe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.aquecimento_adesao_semana() TO authenticated;
