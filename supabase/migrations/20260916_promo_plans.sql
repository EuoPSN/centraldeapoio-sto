CREATE TABLE public.promo_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  preco_primeiro_mes NUMERIC(10,2) NOT NULL,
  preco_demais_meses NUMERIC(10,2) NOT NULL,
  cor_fundo TEXT NOT NULL DEFAULT '#64748B',
  cor_fundo_2 TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_plans TO authenticated;
GRANT ALL ON public.promo_plans TO service_role;
ALTER TABLE public.promo_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX promo_plans_position_idx ON public.promo_plans(position);
CREATE TRIGGER promo_plans_updated BEFORE UPDATE ON public.promo_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated read promo plans" ON public.promo_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write promo plans" ON public.promo_plans
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Já entra com os 3 planos da sua imagem, pra você poder testar direto.
INSERT INTO public.promo_plans (nome, preco_primeiro_mes, preco_demais_meses, cor_fundo, cor_fundo_2, position) VALUES
  ('Plano Diamante', 68.39, 68.39, '#67B8C4', '#8FD3DD', 0),
  ('Plano Prata', 66.80, 33.40, '#4B4B4B', '#8A8A8A', 10),
  ('Plano Ouro', 38.39, 48.39, '#8A6A1A', '#D9A63B', 20);
