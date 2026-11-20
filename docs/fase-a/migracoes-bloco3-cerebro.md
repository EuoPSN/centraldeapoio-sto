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
