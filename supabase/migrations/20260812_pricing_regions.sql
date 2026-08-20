-- Regiões onde cada especialidade/item da tabela de preços está disponível
ALTER TABLE public.pricing_items
  ADD COLUMN IF NOT EXISTS regioes_principais TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS regioes_outras TEXT[] NOT NULL DEFAULT '{}';
