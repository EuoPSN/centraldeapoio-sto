-- ============ Descrição por IA na tabela de preços (busca por sinônimos) ============
-- Cada item de preço pode ter uma descrição gerada por IA, com palavras-chave e
-- sinônimos (sintomas, área de atuação etc.), usada para tornar a busca mais inteligente
-- sem precisar manter uma lista de sinônimos manualmente.

ALTER TABLE public.pricing_items
  ADD COLUMN IF NOT EXISTS description TEXT;
