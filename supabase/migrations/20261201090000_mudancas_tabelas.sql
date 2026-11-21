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
