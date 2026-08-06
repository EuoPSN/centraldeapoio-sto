-- Tabela de organização das abas do Painel Administrativo (barra lateral agrupada e editável)
CREATE TABLE public.admin_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Folder',
  group_name TEXT NOT NULL DEFAULT 'Sistema',
  position INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_sections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_sections TO authenticated;
GRANT ALL ON public.admin_sections TO service_role;

ALTER TABLE public.admin_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_sections_read_auth" ON public.admin_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_sections_write_admin" ON public.admin_sections
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_admin_sections_updated
  BEFORE UPDATE ON public.admin_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: os 12 itens existentes, já organizados nos 4 grupos combinados
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('knowledge',     'Base IA',              'Database',          'Conteúdo & IA', 0),
  ('taxonomy',      'Categorias',           'Tag',                'Conteúdo & IA', 10),
  ('content',       'Conteúdo (legado)',    'FileText',           'Conteúdo & IA', 20),
  ('ai',            'IA & Indexação',       'Network',            'Conteúdo & IA', 30),
  ('messages',      'Mensagens',            'MessageSquareQuote', 'Atendimento',   0),
  ('atendimentos',  'Atendimentos',         'Play',               'Atendimento',   10),
  ('suggestions',   'Sugestões',            'Lightbulb',          'Atendimento',   20),
  ('users',         'Usuários',             'Users',              'Pessoas',       0),
  ('perfis',        'Perfis de Cliente',    'Briefcase',          'Pessoas',       10),
  ('menu',          'Menu',                 'Menu',               'Sistema',       0),
  ('appearance',    'Aparência',            'Palette',            'Sistema',       10),
  ('pricing',       'Preços',               'DollarSign',         'Sistema',       20),
  ('organizacao',   'Organização das abas', 'Layers',             'Sistema',       30)
ON CONFLICT (tab_key) DO NOTHING;
