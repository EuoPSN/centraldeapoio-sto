-- Amplia o scope de categorias pra incluir "problema" (situações-problema dos simuladores)
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_scope_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_scope_check
  CHECK (scope IN ('message','flow','suggestion','content','client_profile','image_library','pdf_library','problema'));

INSERT INTO public.categories (scope, name, slug, position) VALUES
  ('problema', 'Cancelamento Refuturiza', 'cancelamento-refuturiza', 0),
  ('problema', 'Cancelamento Energia de Todos', 'cancelamento-energia-de-todos', 10),
  ('problema', 'Cancelamento Cartão de Todos', 'cancelamento-cartao-de-todos', 20),
  ('problema', 'Erro no KYC', 'erro-no-kyc', 30),
  ('problema', 'Encaminhar para o Suporte', 'encaminhar-para-o-suporte', 40)
ON CONFLICT DO NOTHING;

-- Cenários de situação-problema: o atendente lê o enredo (o que aconteceu),
-- entende o caso e conduz o atendimento até a solução correta.
-- solucao_esperada é o "gabarito" — nunca é devolvido pro navegador do atendente,
-- só é lido no servidor (chat e avaliação).
CREATE TABLE public.problem_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  enredo TEXT NOT NULL,
  personalidade TEXT NOT NULL DEFAULT '',
  solucao_esperada TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medio',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_scenarios TO authenticated;
GRANT ALL ON public.problem_scenarios TO service_role;
ALTER TABLE public.problem_scenarios ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER problem_scenarios_updated BEFORE UPDATE ON public.problem_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated read problem scenarios" ON public.problem_scenarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write problem scenarios" ON public.problem_scenarios
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Ranking separado pras simulações de situação-problema (não mistura com o XP de vendas)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp_problemas INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.simulator_results ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'atendimento';
ALTER TABLE public.simulator_results ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES public.problem_scenarios(id) ON DELETE SET NULL;
ALTER TABLE public.simulator_results DROP CONSTRAINT IF EXISTS simulator_results_tipo_check;
ALTER TABLE public.simulator_results ADD CONSTRAINT simulator_results_tipo_check CHECK (tipo IN ('atendimento','problema'));

-- Nova aba no Painel Admin
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('problemscenarios', 'Situações-Problema', 'Wrench', 'Atendimento', 15)
ON CONFLICT (tab_key) DO NOTHING;
