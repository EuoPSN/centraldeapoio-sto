-- Cada Etapa do Fluxo passa a pertencer a uma Categoria (tipo de atendimento):
-- Filiação, Refiliação, Migração, EDT etc. Etapas com categoria NULA ficam no grupo "Geral".
ALTER TABLE public.message_flow_stages
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;
