-- Fase A · bloco 1 · "O cliente disse…" — 3/5: cálculo de economia.
-- Idempotente.

-- Mensalidade de cada plano (uma linha por plano).
CREATE TABLE IF NOT EXISTS public.config_economia (
  plano TEXT PRIMARY KEY CHECK (plano IN ('prata', 'ouro', 'diamante')),
  mensalidade NUMERIC(10,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_economia TO authenticated;
GRANT ALL ON public.config_economia TO service_role;
ALTER TABLE public.config_economia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_economia_read" ON public.config_economia;
CREATE POLICY "config_economia_read" ON public.config_economia
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "config_economia_write_admin" ON public.config_economia;
CREATE POLICY "config_economia_write_admin" ON public.config_economia
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_config_economia_updated ON public.config_economia;
CREATE TRIGGER trg_config_economia_updated
  BEFORE UPDATE ON public.config_economia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sem valores inventados: as mensalidades começam vazias e o Paulo preenche no Admin.
INSERT INTO public.config_economia (plano) VALUES ('prata'), ('ouro'), ('diamante')
ON CONFLICT (plano) DO NOTHING;

-- Itens da Amor Saúde: preço particular médio e se entra no cálculo.
ALTER TABLE public.pricing_items
  ADD COLUMN IF NOT EXISTS preco_particular_medio NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS usar_na_economia BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.exames
  ADD COLUMN IF NOT EXISTS preco_particular_medio NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS usar_na_economia BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.procedimentos_odontologicos
  ADD COLUMN IF NOT EXISTS preco_particular_medio NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS usar_na_economia BOOLEAN NOT NULL DEFAULT false;
