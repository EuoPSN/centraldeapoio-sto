-- Bloco 1: Unidades/Clínicas como entidade de verdade (nome + endereço),
-- usada tanto pela Tabela de Preços quanto (depois) pelo Catálogo de Exames.
CREATE TABLE public.unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.unidades TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades_read_auth" ON public.unidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "unidades_write_admin" ON public.unidades
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Popula Unidades a partir dos nomes de região já digitados na Tabela de Preços,
-- pra não perder nada do que você já cadastrou.
INSERT INTO public.unidades (nome)
SELECT DISTINCT trim(regiao) FROM (
  SELECT unnest(regioes_principais) AS regiao FROM public.pricing_items
  UNION
  SELECT unnest(regioes_outras) AS regiao FROM public.pricing_items
) t
WHERE trim(regiao) <> ''
ON CONFLICT (nome) DO NOTHING;

-- Vínculo item de preço <-> unidade (com "destaque" = aparece em Principais)
CREATE TABLE public.pricing_item_unidades (
  pricing_item_id UUID NOT NULL REFERENCES public.pricing_items(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  destaque BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (pricing_item_id, unidade_id)
);

GRANT SELECT ON public.pricing_item_unidades TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pricing_item_unidades TO authenticated;
GRANT ALL ON public.pricing_item_unidades TO service_role;

ALTER TABLE public.pricing_item_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_item_unidades_read_auth" ON public.pricing_item_unidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pricing_item_unidades_write_admin" ON public.pricing_item_unidades
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Migra os vínculos que já existiam como texto livre pro novo formato
INSERT INTO public.pricing_item_unidades (pricing_item_id, unidade_id, destaque)
SELECT p.id, u.id, true
FROM public.pricing_items p, unnest(p.regioes_principais) AS regiao
JOIN public.unidades u ON u.nome = trim(regiao)
ON CONFLICT DO NOTHING;

INSERT INTO public.pricing_item_unidades (pricing_item_id, unidade_id, destaque)
SELECT p.id, u.id, false
FROM public.pricing_items p, unnest(p.regioes_outras) AS regiao
JOIN public.unidades u ON u.nome = trim(regiao)
ON CONFLICT DO NOTHING;

-- As colunas antigas de texto livre não são mais usadas
ALTER TABLE public.pricing_items
  DROP COLUMN IF EXISTS regioes_principais,
  DROP COLUMN IF EXISTS regioes_outras;
