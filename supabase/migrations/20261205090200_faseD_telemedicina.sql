-- Fase D · 3/9 — Teleconsulta e PA digital (Amor Saúde). Idempotente.
-- Leitura para autenticados; escrita só admin. A teleconsulta nasce VAZIA (21 especialidades
-- que o Paulo cadastra, com "Adicionar várias"). O PA digital nasce com dois rascunhos editáveis.

CREATE TABLE IF NOT EXISTS public.telemedicina_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('teleconsulta', 'pa_digital')),
  nome TEXT NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 150),
  descricao TEXT,
  para_quem TEXT,
  cartao NUMERIC CHECK (cartao IS NULL OR cartao >= 0),
  particular NUMERIC CHECK (particular IS NULL OR particular >= 0),
  passos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  indique_quando TEXT,
  link_agendamento TEXT CHECK (link_agendamento IS NULL OR link_agendamento ~* '^https://'),
  tempo_espera_min INT CHECK (tempo_espera_min IS NULL OR tempo_espera_min BETWEEN 1 AND 600),
  ativo BOOLEAN NOT NULL DEFAULT true,
  position INT NOT NULL DEFAULT 0,
  use_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telemedicina_tipo_nome ON public.telemedicina_itens (tipo, lower(nome));
CREATE INDEX IF NOT EXISTS idx_telemedicina_tipo_pos ON public.telemedicina_itens (tipo, position, nome);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telemedicina_itens TO authenticated;
GRANT ALL ON public.telemedicina_itens TO service_role;
ALTER TABLE public.telemedicina_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telemedicina_itens_select" ON public.telemedicina_itens;
CREATE POLICY "telemedicina_itens_select" ON public.telemedicina_itens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "telemedicina_itens_insert_admin" ON public.telemedicina_itens;
CREATE POLICY "telemedicina_itens_insert_admin" ON public.telemedicina_itens
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "telemedicina_itens_update_admin" ON public.telemedicina_itens;
CREATE POLICY "telemedicina_itens_update_admin" ON public.telemedicina_itens
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "telemedicina_itens_delete_admin" ON public.telemedicina_itens;
CREATE POLICY "telemedicina_itens_delete_admin" ON public.telemedicina_itens
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_telemedicina_itens_updated ON public.telemedicina_itens;
CREATE TRIGGER trg_telemedicina_itens_updated
  BEFORE UPDATE ON public.telemedicina_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link do site/app da Amor Saúde (botão "Abrir o site da Amor Saúde"). Um item pode ter o seu
-- próprio link_agendamento, que vale no lugar deste.
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS amor_saude_site_url TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_amor_saude_site_url_check') THEN
    ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_amor_saude_site_url_check
      CHECK (amor_saude_site_url IS NULL OR (amor_saude_site_url ~* '^https://' AND char_length(amor_saude_site_url) <= 500));
  END IF;
END;
$$;

-- Cada cópia soma 1 no item (mesma função das consultas, exames e odontologia).
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
  ELSIF item_tipo = 'telemedicina' THEN
    UPDATE public.telemedicina_itens SET use_count = use_count + 1 WHERE id = item_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_amor_saude_use(TEXT, UUID) TO authenticated;

-- Seed (rascunho editável): PA digital com Clínico geral e Pediatra. Só entra se ainda não existir.
INSERT INTO public.telemedicina_itens (tipo, nome, descricao, para_quem, passos, indique_quando, tempo_espera_min, position)
SELECT 'pa_digital', v.nome,
       'Atendimento por vídeo em até 15 minutos depois de agendar.',
       v.para_quem,
       ARRAY[
         'Entra no site ou app da Amor Saúde e escolhe PA digital.',
         'Escolhe ' || lower(v.nome) || ' e agenda.',
         'Em até 15 minutos, abre o link recebido, com câmera e internet.'
       ],
       'Quando o cliente não pode esperar uma consulta marcada, mas não é grave. Em caso grave ou urgência, procurar um pronto-socorro.',
       15, v.pos
  FROM (VALUES
    ('Clínico geral', 'Adultos com sintomas do dia a dia que não podem esperar.', 10),
    ('Pediatra',      'Crianças com sintomas do dia a dia que não podem esperar.', 20)
  ) AS v(nome, para_quem, pos)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.telemedicina_itens t WHERE t.tipo = 'pa_digital' AND lower(t.nome) = lower(v.nome)
 );
