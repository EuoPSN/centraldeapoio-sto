-- Colunas novas em contatos_enderecos (unidades CDT, suporte e clínicas Amor Saúde)
ALTER TABLE public.contatos_enderecos
  ADD COLUMN IF NOT EXISTS regiao text,
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS horario text,
  ADD COLUMN IF NOT EXISTS atende_tambem text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subtitulo text,
  ADD COLUMN IF NOT EXISTS quando_indicar text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

-- Valor geral da avaliação odontológica (Amor Saúde)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS avaliacao_odonto_valor numeric;

-- Campos Amor Saúde na tabela de preços
ALTER TABLE public.pricing_items
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS para_quem text,
  ADD COLUMN IF NOT EXISTS como_agendar text,
  ADD COLUMN IF NOT EXISTS clinicas_pendente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

-- Campos Amor Saúde em exames
ALTER TABLE public.exames
  ADD COLUMN IF NOT EXISTS media_referencia numeric,
  ADD COLUMN IF NOT EXISTS preparo_itens text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.procedimentos_odontologicos
  ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

-- Vínculo item de preço <-> clínica Amor Saúde
CREATE TABLE IF NOT EXISTS public.pricing_item_clinicas (
  pricing_item_id uuid NOT NULL REFERENCES public.pricing_items(id) ON DELETE CASCADE,
  clinica_id uuid NOT NULL REFERENCES public.contatos_enderecos(id) ON DELETE CASCADE,
  PRIMARY KEY (pricing_item_id, clinica_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_item_clinicas TO authenticated;
GRANT ALL ON public.pricing_item_clinicas TO service_role;
ALTER TABLE public.pricing_item_clinicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_item_clinicas_read_auth ON public.pricing_item_clinicas FOR SELECT TO authenticated USING (true);
CREATE POLICY pricing_item_clinicas_write_admin ON public.pricing_item_clinicas FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Vínculo exame <-> clínica Amor Saúde
CREATE TABLE IF NOT EXISTS public.exame_clinicas (
  exame_id uuid NOT NULL REFERENCES public.exames(id) ON DELETE CASCADE,
  clinica_id uuid NOT NULL REFERENCES public.contatos_enderecos(id) ON DELETE CASCADE,
  PRIMARY KEY (exame_id, clinica_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exame_clinicas TO authenticated;
GRANT ALL ON public.exame_clinicas TO service_role;
ALTER TABLE public.exame_clinicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY exame_clinicas_read_auth ON public.exame_clinicas FOR SELECT TO authenticated USING (true);
CREATE POLICY exame_clinicas_write_admin ON public.exame_clinicas FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Vínculo procedimento odontológico <-> clínica Amor Saúde
CREATE TABLE IF NOT EXISTS public.procedimento_clinicas (
  procedimento_id uuid NOT NULL REFERENCES public.procedimentos_odontologicos(id) ON DELETE CASCADE,
  clinica_id uuid NOT NULL REFERENCES public.contatos_enderecos(id) ON DELETE CASCADE,
  PRIMARY KEY (procedimento_id, clinica_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedimento_clinicas TO authenticated;
GRANT ALL ON public.procedimento_clinicas TO service_role;
ALTER TABLE public.procedimento_clinicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY procedimento_clinicas_read_auth ON public.procedimento_clinicas FOR SELECT TO authenticated USING (true);
CREATE POLICY procedimento_clinicas_write_admin ON public.procedimento_clinicas FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Contador de uso de contatos ("Mais procurados")
CREATE OR REPLACE FUNCTION public.increment_contato_use(contato_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.contatos_enderecos SET use_count = use_count + 1 WHERE id = contato_id;
$$;
REVOKE ALL ON FUNCTION public.increment_contato_use(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_contato_use(uuid) TO authenticated;

-- Contador de uso de itens Amor Saúde (consulta, exame, odontologia)
CREATE OR REPLACE FUNCTION public.increment_amor_saude_use(item_tipo text, item_id uuid)
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
REVOKE ALL ON FUNCTION public.increment_amor_saude_use(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_amor_saude_use(text, uuid) TO authenticated;