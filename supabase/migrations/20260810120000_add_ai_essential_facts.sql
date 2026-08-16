-- ============ Fatos Essenciais da IA ============
-- Bloco de fatos de alto risco (mensalidade, taxa de adesão, fidelidade,
-- formas de pagamento etc.) que é SEMPRE injetado no prompt da MarcIAna,
-- sem depender de busca por similaridade — evita que conteúdo antigo/duplicado
-- na base "vença" a informação correta.

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS essential_facts TEXT;
