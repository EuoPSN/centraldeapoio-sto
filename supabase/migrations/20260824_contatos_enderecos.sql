-- Contatos e Endereços: Cartão de Todos, Clínica Amor Saúde, Outros
CREATE TABLE public.contatos_enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('cartao_de_todos', 'clinica_amor_saude', 'outros')),
  nome_regiao TEXT NOT NULL,
  endereco TEXT,
  contato1 TEXT,
  contato2 TEXT,
  contato3 TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contatos_enderecos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contatos_enderecos TO authenticated;
GRANT ALL ON public.contatos_enderecos TO service_role;
ALTER TABLE public.contatos_enderecos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contatos_enderecos_read_auth" ON public.contatos_enderecos FOR SELECT TO authenticated USING (true);
CREATE POLICY "contatos_enderecos_write_admin" ON public.contatos_enderecos FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Nova aba no Painel Admin
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('contatos', 'Contatos e Endereços', 'Phone', 'Conteúdo & IA', 50)
ON CONFLICT (tab_key) DO NOTHING;

-- Item no menu lateral do site
INSERT INTO public.nav_items (label, icon, route, section, position, visible, admin_only)
VALUES ('Contatos e Endereços', 'Phone', '/contatos', 'main', 998, true, false);
