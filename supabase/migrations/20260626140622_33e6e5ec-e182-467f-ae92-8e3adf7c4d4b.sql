
-- ============ Trigger helper (re-use existing set_updated_at) ============

-- ============ CATEGORIES (taxonomia dinâmica) ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('message','flow','suggestion','content')),
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scope, parent_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_read_auth" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_write_admin" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MESSAGES (Biblioteca de Mensagens) ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  internal_note TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_read_auth" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "msg_write_admin" ON public.messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_messages_updated BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FLOWS (URA visual) ============
CREATE TABLE public.flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_training BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flows TO authenticated;
GRANT ALL ON public.flows TO service_role;
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow_read_auth" ON public.flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "flow_write_admin" ON public.flows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_flows_updated BEFORE UPDATE ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL DEFAULT 'step' CHECK (node_type IN ('start','step','question','answer','objection','action','end')),
  title TEXT NOT NULL,
  message TEXT,
  note TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX flow_nodes_flow_idx ON public.flow_nodes(flow_id);
CREATE INDEX flow_nodes_parent_idx ON public.flow_nodes(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_nodes TO authenticated;
GRANT ALL ON public.flow_nodes TO service_role;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "node_read_auth" ON public.flow_nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "node_write_admin" ON public.flow_nodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_flow_nodes_updated BEFORE UPDATE ON public.flow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ APP SETTINGS (singleton) ============
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_name TEXT NOT NULL DEFAULT 'Central CDT',
  tagline TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  cover_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  background_color TEXT,
  active_theme TEXT NOT NULL DEFAULT 'corporate',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings_update_admin" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ THEMES ============
CREATE TABLE public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.themes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.themes TO authenticated;
GRANT ALL ON public.themes TO service_role;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes_read_all" ON public.themes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "themes_write_admin" ON public.themes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_themes_updated BEFORE UPDATE ON public.themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.themes (name, is_preset, tokens) VALUES
  ('corporate', true, '{"primary":"#00A19A","secondary":"#7ED321","background":"#F5F7FA"}'::jsonb),
  ('light', true, '{"primary":"#0EA5E9","secondary":"#22C55E","background":"#FFFFFF"}'::jsonb),
  ('dark', true, '{"primary":"#22D3EE","secondary":"#A3E635","background":"#0F172A"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============ NAV ITEMS (menu dinâmico) ============
CREATE TABLE public.nav_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Circle',
  route TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'main',
  position INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  admin_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nav_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.nav_items TO authenticated;
GRANT ALL ON public.nav_items TO service_role;
ALTER TABLE public.nav_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nav_read_auth" ON public.nav_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "nav_write_admin" ON public.nav_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_nav_updated BEFORE UPDATE ON public.nav_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.nav_items (label, icon, route, section, position, admin_only) VALUES
  ('Início','Home','/','main',10,false),
  ('Conhecimento','BookOpen','/conhecimento','main',20,false),
  ('Scripts','MessageSquareQuote','/scripts','main',30,false),
  ('Tabela de Preços','DollarSign','/precos','main',40,false),
  ('Problemas Técnicos','Wrench','/problemas','main',50,false),
  ('Tutoriais','GraduationCap','/tutoriais','main',60,false),
  ('Sugestões','Lightbulb','/sugestoes','main',70,false),
  ('Assistente IA','Bot','/assistente','ai',10,false),
  ('Painel Admin','Settings','/admin','admin',10,true)
ON CONFLICT DO NOTHING;

-- ============ SUGGESTIONS ============
CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'sugestao',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','implementado','rejeitado')),
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sug_read_own_or_admin" ON public.suggestions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "sug_insert_self" ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "sug_update_admin" ON public.suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sug_delete_own_or_admin" ON public.suggestions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_suggestions_updated BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
