
-- ============ KNOWLEDGE ENTRIES (base unificada da IA) ============
CREATE TABLE public.knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('regra','procedimento','artigo','conversa_modelo','documento','treinamento')),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  summary text,
  tags text[] NOT NULL DEFAULT '{}',
  file_url text,
  file_mime text,
  file_name text,
  external_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_entries TO authenticated;
GRANT ALL ON public.knowledge_entries TO service_role;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ke read all auth" ON public.knowledge_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "ke admin write" ON public.knowledge_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ke_updated BEFORE UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ke_kind_idx ON public.knowledge_entries(kind);
CREATE INDEX ke_cat_idx ON public.knowledge_entries(category_id);

-- ============ FLOW NODES — colunas para editor visual ============
ALTER TABLE public.flow_nodes
  ADD COLUMN IF NOT EXISTS position_x double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_y double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Permitir novos tipos de bloco
ALTER TABLE public.flow_nodes DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;
ALTER TABLE public.flow_nodes ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN ('start','step','question','answer','objection','script','action','end'));

-- ============ FLOW EDGES (arestas do React Flow) ============
CREATE TABLE public.flow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  source_handle text,
  target_handle text,
  label text,
  condition text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_edges TO authenticated;
GRANT ALL ON public.flow_edges TO service_role;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fe read all auth" ON public.flow_edges FOR SELECT TO authenticated USING (true);
CREATE POLICY "fe admin write" ON public.flow_edges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX fe_flow_idx ON public.flow_edges(flow_id);

-- ============ SIMULATOR SESSIONS ============
CREATE TABLE public.simulator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  path jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulator_sessions TO authenticated;
GRANT ALL ON public.simulator_sessions TO service_role;
ALTER TABLE public.simulator_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss own read" ON public.simulator_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ss own write" ON public.simulator_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ss own update" ON public.simulator_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ knowledge_chunks: aceitar novo source_type ============
-- (a tabela já existe; nada a alterar — source_type é text livre)
