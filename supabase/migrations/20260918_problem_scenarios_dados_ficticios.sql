ALTER TABLE public.problem_scenarios
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
  ADD COLUMN IF NOT EXISTS cliente_cpf TEXT,
  ADD COLUMN IF NOT EXISTS cliente_regiao TEXT,
  ADD COLUMN IF NOT EXISTS cliente_genero TEXT NOT NULL DEFAULT 'masculino',
  ADD COLUMN IF NOT EXISTS faixa_etaria TEXT;

ALTER TABLE public.problem_scenarios DROP CONSTRAINT IF EXISTS problem_scenarios_faixa_etaria_check;
ALTER TABLE public.problem_scenarios ADD CONSTRAINT problem_scenarios_faixa_etaria_check
  CHECK (faixa_etaria IS NULL OR faixa_etaria IN ('20-30', '30-40', '40-60', '60-80'));
