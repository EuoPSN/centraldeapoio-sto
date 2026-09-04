-- Separa número do endereço, adiciona ponto de referência, e marca região
-- como "Principal" ou "Outras" (usado só em Cartão de Todos e Clínica Amor Saúde).
ALTER TABLE public.contatos_enderecos
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS ponto_referencia TEXT,
  ADD COLUMN IF NOT EXISTS destaque BOOLEAN NOT NULL DEFAULT false;
