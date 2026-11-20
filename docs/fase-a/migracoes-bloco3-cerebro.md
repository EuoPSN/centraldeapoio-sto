# Bloco 3 · Cérebro, Copiloto e Raio-X — migrações em ordem

Rode no SQL editor do Lovable Cloud, uma de cada vez, nesta ordem. Todas são idempotentes. Dependem das migrações do bloco 2 (`retomadas`) e das anteriores (`admin_sections`, `private.has_role`, `set_updated_at`).

Enquanto a migração 1 não rodar, as ferramentas seguem com as regras padrão (nada quebra); enquanto a 2 não rodar, não há limite de uso.


## 1. `20261128090000_cerebro_blocos.sql`

```sql
-- Fase A · bloco 3 · Cérebro da Omnia — 1/4: blocos de instruções (com versões),
-- regras fixas, padrão de escrita e etapas do funil. Idempotente.
-- Todas as tabelas são só do Admin: as ferramentas leem pelo servidor (service role).

-- ------------------------------------------------------------
-- cerebro_blocos: um texto longo por skill + as ferramentas que o usam.
-- gerado = true: o texto vem de outra tabela (padrao_escrita, funil_etapas) e
-- o campo conteudo fica vazio.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cerebro_blocos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descricao_curta TEXT NOT NULL DEFAULT '',
  conteudo TEXT NOT NULL DEFAULT '',
  ferramentas TEXT[] NOT NULL DEFAULT '{}'
    CHECK (ferramentas <@ ARRAY['marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador']::text[]),
  gerado BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cerebro_blocos TO authenticated;
GRANT ALL ON public.cerebro_blocos TO service_role;
ALTER TABLE public.cerebro_blocos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cerebro_blocos_admin" ON public.cerebro_blocos;
CREATE POLICY "cerebro_blocos_admin" ON public.cerebro_blocos
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- cerebro_blocos_versoes: cópia da versão anterior a cada edição de conteúdo,
-- ferramentas ou ativo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cerebro_blocos_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id UUID NOT NULL REFERENCES public.cerebro_blocos(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  ferramentas TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  salvo_em TIMESTAMPTZ NOT NULL,
  salvo_por UUID,
  substituida_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cerebro_blocos_versoes TO authenticated;
GRANT ALL ON public.cerebro_blocos_versoes TO service_role;
ALTER TABLE public.cerebro_blocos_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cerebro_versoes_read_admin" ON public.cerebro_blocos_versoes;
CREATE POLICY "cerebro_versoes_read_admin" ON public.cerebro_blocos_versoes
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cerebro_versoes_bloco ON public.cerebro_blocos_versoes(bloco_id, substituida_em DESC);

CREATE OR REPLACE FUNCTION public.cerebro_blocos_versionar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.conteudo IS DISTINCT FROM NEW.conteudo
     OR OLD.ferramentas IS DISTINCT FROM NEW.ferramentas
     OR OLD.ativo IS DISTINCT FROM NEW.ativo THEN
    INSERT INTO public.cerebro_blocos_versoes
      (bloco_id, chave, conteudo, ferramentas, ativo, salvo_em, salvo_por)
    VALUES
      (OLD.id, OLD.chave, OLD.conteudo, OLD.ferramentas, OLD.ativo, OLD.updated_at, OLD.updated_by);
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cerebro_blocos_versionar ON public.cerebro_blocos;
CREATE TRIGGER trg_cerebro_blocos_versionar
  BEFORE UPDATE ON public.cerebro_blocos
  FOR EACH ROW EXECUTE FUNCTION public.cerebro_blocos_versionar();

-- ------------------------------------------------------------
-- cerebro_regras_fixas: curtas, entram em TODA chamada de IA.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cerebro_regras_fixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto TEXT NOT NULL CHECK (char_length(texto) <= 300),
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cerebro_regras_fixas TO authenticated;
GRANT ALL ON public.cerebro_regras_fixas TO service_role;
ALTER TABLE public.cerebro_regras_fixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cerebro_regras_admin" ON public.cerebro_regras_fixas;
CREATE POLICY "cerebro_regras_admin" ON public.cerebro_regras_fixas
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_cerebro_regras_updated ON public.cerebro_regras_fixas;
CREATE TRIGGER trg_cerebro_regras_updated
  BEFORE UPDATE ON public.cerebro_regras_fixas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- padrao_escrita: o que pode e o que não pode no texto das mensagens.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.padrao_escrita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('pode', 'nao_pode')),
  item TEXT NOT NULL CHECK (char_length(item) <= 200),
  exemplo_errado TEXT NOT NULL DEFAULT '',
  exemplo_certo TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.padrao_escrita TO authenticated;
GRANT ALL ON public.padrao_escrita TO service_role;
ALTER TABLE public.padrao_escrita ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "padrao_escrita_admin" ON public.padrao_escrita;
CREATE POLICY "padrao_escrita_admin" ON public.padrao_escrita
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_padrao_escrita_updated ON public.padrao_escrita;
CREATE TRIGGER trg_padrao_escrita_updated
  BEFORE UPDATE ON public.padrao_escrita
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- funil_etapas: as 5 etapas do funil do CRM. Definição e sinais ficam vazios
-- até o Paulo preencher; o Copiloto e o Raio-X só classificam com o que está aqui.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funil_etapas (
  etapa TEXT PRIMARY KEY
    CHECK (etapa IN ('novo_lead', 'lead_qualificado', 'proposta_enviada', 'fechamento', 'venda_concluida')),
  nome TEXT NOT NULL,
  definicao TEXT NOT NULL DEFAULT '',
  sinais TEXT[] NOT NULL DEFAULT '{}',
  ordem INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funil_etapas TO authenticated;
GRANT ALL ON public.funil_etapas TO service_role;
ALTER TABLE public.funil_etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funil_etapas_admin" ON public.funil_etapas;
CREATE POLICY "funil_etapas_admin" ON public.funil_etapas
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_funil_etapas_updated ON public.funil_etapas;
CREATE TRIGGER trg_funil_etapas_updated
  BEFORE UPDATE ON public.funil_etapas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Base inicial (só insere o que não existe; não sobrescreve edição do Admin).
-- Conteúdo de vendas: "[escrever]" até o Paulo preencher (ignorado pela IA).
-- ------------------------------------------------------------
INSERT INTO public.cerebro_blocos (chave, titulo, descricao_curta, conteudo, ferramentas, gerado, ordem) VALUES
  ('playbook_cdt', 'Playbook de vendas CDT', 'Produtos, planos, regras da unidade', '[escrever]',
    ARRAY['marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador'], false, 10),
  ('spin_selling', 'SPIN Selling', 'Perguntas de situação, problema, implicação, necessidade', '[escrever]',
    ARRAY['copiloto','raiox','simulador'], false, 20),
  ('chris_voss', 'Chris Voss', 'Empatia tática, rótulos, perguntas calibradas', '[escrever]',
    ARRAY['cliente_disse','copiloto','raiox'], false, 30),
  ('mapeamento_objecoes', 'Mapeamento de objeções', 'Leituras e ângulos por objeção', '[escrever]',
    ARRAY['cliente_disse','copiloto'], false, 40),
  ('padrao_escrita', 'Padrão de escrita', 'O que pode e o que não pode no texto', '',
    ARRAY['marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador'], true, 50),
  ('etapas_funil', 'Etapas do funil', 'Definição e sinais de cada etapa', '',
    ARRAY['copiloto','raiox','retomada'], true, 60)
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.cerebro_regras_fixas (texto, ordem)
SELECT v.texto, v.ordem FROM (VALUES
  ('Nunca diga "não é plano de saúde".', 10),
  ('Pagamento: somente cartão de crédito ou cartão de débito.', 20),
  ('Nunca invente preço, carência, regra ou benefício: use só os dados da Omnia.', 30),
  ('Escreva em português do Brasil.', 40),
  ('Tom acolhedor de WhatsApp.', 50)
) AS v(texto, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.cerebro_regras_fixas);

INSERT INTO public.padrao_escrita (tipo, item, exemplo_errado, exemplo_certo, ordem)
SELECT v.tipo, v.item, v.errado, v.certo, v.ordem FROM (VALUES
  ('pode',     'Emoji com moderação (1 por mensagem)', '', '', 10),
  ('pode',     'Diminutivo leve', '', 'rapidinho, minutinhos', 20),
  ('pode',     '"Você" por extenso', 'vc', 'você', 30),
  ('pode',     'Usar o primeiro nome do cliente', '', '', 40),
  ('nao_pode', 'Abreviações de internet', 'vc, blz, tbm', 'você, beleza, também', 110),
  ('nao_pode', '"kkk" ou "rs" repetidos', 'kkkkk rsrs', '', 120),
  ('nao_pode', 'Tratamentos íntimos: "amor", "querida", "flor", "mano"', 'Oi, amor!', 'Oi, Joseane!', 130),
  ('nao_pode', 'Várias perguntas na mesma mensagem', '3 perguntas na mesma mensagem', 'uma pergunta por vez', 140),
  ('nao_pode', 'Mensagem com mais de 4 linhas sem quebra', '', '', 150),
  ('nao_pode', '"Não é plano de saúde"', '', '', 160)
) AS v(tipo, item, errado, certo, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.padrao_escrita);

INSERT INTO public.funil_etapas (etapa, nome, ordem) VALUES
  ('novo_lead',        'Novo lead',        1),
  ('lead_qualificado', 'Lead qualificado', 2),
  ('proposta_enviada', 'Proposta enviada', 3),
  ('fechamento',       'Fechamento',       4),
  ('venda_concluida',  'Venda concluída',  5)
ON CONFLICT (etapa) DO NOTHING;
```


## 2. `20261128090100_ia_uso_limites.sql`

```sql
-- Fase A · bloco 3 · Cérebro da Omnia — 2/4: uso de IA e limites diários.
-- ia_uso não guarda conteúdo, só quem usou qual ferramenta e quando. Idempotente.

CREATE TABLE IF NOT EXISTS public.ia_uso (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  ferramenta TEXT NOT NULL
    CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ia_uso TO authenticated;
GRANT ALL ON public.ia_uso TO service_role;
ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_uso_insert_own" ON public.ia_uso;
CREATE POLICY "ia_uso_insert_own" ON public.ia_uso
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ia_uso_read" ON public.ia_uso;
CREATE POLICY "ia_uso_read" ON public.ia_uso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ia_uso_user_dia ON public.ia_uso(user_id, ferramenta, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_uso_data ON public.ia_uso(created_at DESC);

-- Limite diário por ferramenta (NULL = sem limite). Editável no Admin.
CREATE TABLE IF NOT EXISTS public.ia_limites (
  ferramenta TEXT PRIMARY KEY
    CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador')),
  limite_diario INT CHECK (limite_diario IS NULL OR limite_diario > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_limites TO authenticated;
GRANT ALL ON public.ia_limites TO service_role;
ALTER TABLE public.ia_limites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_limites_read" ON public.ia_limites;
CREATE POLICY "ia_limites_read" ON public.ia_limites FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ia_limites_write_admin" ON public.ia_limites;
CREATE POLICY "ia_limites_write_admin" ON public.ia_limites
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_ia_limites_updated ON public.ia_limites;
CREATE TRIGGER trg_ia_limites_updated
  BEFORE UPDATE ON public.ia_limites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ia_limites (ferramenta, limite_diario) VALUES
  ('copiloto', 30), ('raiox', 10),
  ('marciana', NULL), ('mensagem_cliente', NULL), ('cliente_disse', NULL), ('retomada', NULL), ('simulador', NULL)
ON CONFLICT (ferramenta) DO NOTHING;

-- Liberações extras do Admin para uma pessoa (soma ao limite diário até valido_ate).
CREATE TABLE IF NOT EXISTS public.ia_limites_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ferramenta TEXT NOT NULL
    CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador')),
  extra INT NOT NULL CHECK (extra > 0),
  valido_ate TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_limites_extra TO authenticated;
GRANT ALL ON public.ia_limites_extra TO service_role;
ALTER TABLE public.ia_limites_extra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_limites_extra_read" ON public.ia_limites_extra;
CREATE POLICY "ia_limites_extra_read" ON public.ia_limites_extra
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "ia_limites_extra_write_admin" ON public.ia_limites_extra;
CREATE POLICY "ia_limites_extra_write_admin" ON public.ia_limites_extra
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ia_limites_extra_user ON public.ia_limites_extra(user_id, ferramenta, valido_ate);
```


## 3. `20261128090200_raiox_resultados.sql`

```sql
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
```


## 4. `20261128090300_cerebro_admin_sections.sql`

```sql
-- Fase A · bloco 3 · Cérebro da Omnia — 4/4: seções novas do Painel Admin
-- (grupo Inteligência). Idempotente.
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('cerebro',     'Cérebro da Omnia', 'Brain',      'Inteligência', 5,  true),
  ('raioxequipe', 'Raio-X da equipe', 'ScanSearch', 'Inteligência', 35, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
```
