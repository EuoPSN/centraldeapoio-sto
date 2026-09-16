-- Caminhos (subfluxos) dentro de um Fluxo de Atendimento.
-- Um caminho começa logo depois de uma etapa (branches_from_stage_id) e,
-- opcionalmente, volta a se juntar numa etapa comum do tronco (merges_into_stage_id).
-- Se merges_into_stage_id for nulo, o caminho termina sozinho, sem se juntar a nada.
CREATE TABLE public.flow_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  branches_from_stage_id UUID NOT NULL REFERENCES public.message_flow_stages(id) ON DELETE CASCADE,
  merges_into_stage_id UUID REFERENCES public.message_flow_stages(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.flow_paths TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.flow_paths TO authenticated;
GRANT ALL ON public.flow_paths TO service_role;

ALTER TABLE public.flow_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flow_paths_read_auth" ON public.flow_paths
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "flow_paths_write_admin" ON public.flow_paths
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Cada etapa passa a poder pertencer a um caminho.
-- Nulo = etapa do tronco principal (fluxo continua funcionando exatamente
-- como antes pra quem não usa caminhos — os 5 fluxos já existentes não mudam).
ALTER TABLE public.message_flow_stages
  ADD COLUMN IF NOT EXISTS path_id UUID REFERENCES public.flow_paths(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_flow_paths_branches_from ON public.flow_paths(branches_from_stage_id);
CREATE INDEX IF NOT EXISTS idx_flow_paths_merges_into ON public.flow_paths(merges_into_stage_id);
CREATE INDEX IF NOT EXISTS idx_message_flow_stages_path ON public.message_flow_stages(path_id);
