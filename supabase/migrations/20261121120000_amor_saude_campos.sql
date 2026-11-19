-- Amor Saúde (página 3 do redesign OMNIA) — 1/3: campos e tabelas novas.
-- Nada é apagado: as colunas e vínculos antigos (unidades, pricing_item_unidades,
-- exame_unidades, procedimento_unidades) continuam no banco como referência.

-- ------------------------------------------------------------
-- Clínicas Amor Saúde = registros de contatos_enderecos com tipo 'clinica_amor_saude'.
-- "principal" continua sendo a coluna destaque; telefone/WhatsApp é contato1.
-- ------------------------------------------------------------
ALTER TABLE public.contatos_enderecos
  ADD COLUMN IF NOT EXISTS regiao TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT;

-- Região de cada clínica, deduzida do nome (só onde ainda não há região).
UPDATE public.contatos_enderecos c
SET regiao = CASE
    WHEN lower(c.nome_regiao) LIKE '%neves%' THEN 'Ribeirão das Neves'
    WHEN lower(c.nome_regiao) ~ 'justin[oó]polis' THEN 'Justinópolis'
    WHEN lower(c.nome_regiao) LIKE '%veneza%' THEN 'Veneza'
    WHEN lower(c.nome_regiao) LIKE '%venda nova%' THEN 'Venda Nova'
    WHEN lower(c.nome_regiao) LIKE '%barreiro%'
      OR c.nome_regiao ~ '\mBH\M'
      OR lower(c.nome_regiao) LIKE '%belo horizonte%' THEN 'Belo Horizonte'
    ELSE nullif(trim(regexp_replace(c.nome_regiao, '^\s*Cl[íi]nica\s+Amor\s+Sa[úu]de\s*', '', 'i')), '')
  END
WHERE c.tipo = 'clinica_amor_saude' AND (c.regiao IS NULL OR trim(c.regiao) = '');

-- ------------------------------------------------------------
-- Consultas (pricing_items): área, para quem indicar, como agendar,
-- referência do texto antigo de regiões e contagem de cópias.
-- ------------------------------------------------------------
ALTER TABLE public.pricing_items
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS para_quem TEXT,
  ADD COLUMN IF NOT EXISTS como_agendar TEXT,
  ADD COLUMN IF NOT EXISTS clinicas_ref_antiga TEXT,
  ADD COLUMN IF NOT EXISTS clinicas_pendente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;

-- Exames: média de referência, preparo em itens e contagem de cópias.
ALTER TABLE public.exames
  ADD COLUMN IF NOT EXISTS media_referencia NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS preparo_itens TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;

-- Odontologia: contagem de cópias.
ALTER TABLE public.procedimentos_odontologicos
  ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;

-- Valor geral da "Avaliação odontológica (Cartão de TODOS)", configurável no Admin.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS avaliacao_odonto_valor NUMERIC(10,2);

-- ------------------------------------------------------------
-- Vínculos item ↔ clínica (muitos-para-muitos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_item_clinicas (
  pricing_item_id UUID NOT NULL REFERENCES public.pricing_items(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL REFERENCES public.contatos_enderecos(id) ON DELETE CASCADE,
  PRIMARY KEY (pricing_item_id, clinica_id)
);

CREATE TABLE IF NOT EXISTS public.exame_clinicas (
  exame_id UUID NOT NULL REFERENCES public.exames(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL REFERENCES public.contatos_enderecos(id) ON DELETE CASCADE,
  PRIMARY KEY (exame_id, clinica_id)
);

CREATE TABLE IF NOT EXISTS public.procedimento_clinicas (
  procedimento_id UUID NOT NULL REFERENCES public.procedimentos_odontologicos(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL REFERENCES public.contatos_enderecos(id) ON DELETE CASCADE,
  PRIMARY KEY (procedimento_id, clinica_id)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pricing_item_clinicas', 'exame_clinicas', 'procedimento_clinicas'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_auth', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_read_auth', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write_admin', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (private.has_role(auth.uid(), ''admin''::app_role))',
      t || '_write_admin', t
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Uso: cada cópia feita no Amor Saúde soma 1 no item (alimenta "Mais procuradas").
-- Mesmo modelo de increment_message_use_count: SECURITY DEFINER libera só o
-- incremento para qualquer atendente autenticado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_amor_saude_use(item_tipo TEXT, item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF item_tipo = 'consulta' THEN
    UPDATE public.pricing_items SET use_count = use_count + 1 WHERE id = item_id;
  ELSIF item_tipo = 'exame' THEN
    UPDATE public.exames SET use_count = use_count + 1 WHERE id = item_id;
  ELSIF item_tipo = 'odontologia' THEN
    UPDATE public.procedimentos_odontologicos SET use_count = use_count + 1 WHERE id = item_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_amor_saude_use(TEXT, UUID) TO authenticated;
