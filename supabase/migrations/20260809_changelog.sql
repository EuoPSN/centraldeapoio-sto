-- Central de Novidades (changelog) — mostrado num painel flutuante no site
CREATE TABLE public.changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.changelog_entries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.changelog_entries TO authenticated;
GRANT ALL ON public.changelog_entries TO service_role;

ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelog_read_auth" ON public.changelog_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "changelog_write_admin" ON public.changelog_entries
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Nova aba "Novidades" no Painel Admin (usa o sistema de organização de abas já existente)
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('changelog', 'Novidades', 'Star', 'Sistema', 40)
ON CONFLICT (tab_key) DO NOTHING;
