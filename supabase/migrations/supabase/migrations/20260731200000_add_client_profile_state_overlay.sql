-- ============ Overlay de dados fictícios sobre a imagem do documento ============
-- Permite marcar, em % da largura/altura da imagem, onde o nome e o CPF do
-- perfil devem ser desenhados por cima do molde do documento fictício.

ALTER TABLE public.client_profile_states
  ADD COLUMN IF NOT EXISTS overlay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overlay_nome_x numeric,
  ADD COLUMN IF NOT EXISTS overlay_nome_y numeric,
  ADD COLUMN IF NOT EXISTS overlay_cpf_x numeric,
  ADD COLUMN IF NOT EXISTS overlay_cpf_y numeric;
