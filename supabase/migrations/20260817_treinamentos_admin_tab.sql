-- Nova aba "Treinamentos" no Painel Admin
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('treinamentos', 'Treinamentos', 'GraduationCap', 'Conteúdo & IA', 40)
ON CONFLICT (tab_key) DO NOTHING;
