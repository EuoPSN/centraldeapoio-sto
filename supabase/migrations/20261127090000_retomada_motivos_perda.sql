-- Fase A · bloco 2 · "Retomar hoje" — 1/5: motivos de perda (lista editável no Admin).
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.motivos_perda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_perda TO authenticated;
GRANT ALL ON public.motivos_perda TO service_role;
ALTER TABLE public.motivos_perda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motivos_perda_read" ON public.motivos_perda;
CREATE POLICY "motivos_perda_read" ON public.motivos_perda
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "motivos_perda_write_admin" ON public.motivos_perda;
CREATE POLICY "motivos_perda_write_admin" ON public.motivos_perda
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_motivos_perda_updated ON public.motivos_perda;
CREATE TRIGGER trg_motivos_perda_updated
  BEFORE UPDATE ON public.motivos_perda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_motivos_perda_nome ON public.motivos_perda (lower(nome));

INSERT INTO public.motivos_perda (nome, ordem) VALUES
  ('Sem dinheiro agora', 10),
  ('Já tem outro cartão/plano', 20),
  ('Não vê necessidade', 30),
  ('Desconfiança', 40),
  ('Não respondeu mais', 50),
  ('Outro', 60)
ON CONFLICT (lower(nome)) DO NOTHING;
