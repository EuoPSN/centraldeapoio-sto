-- Nova aba "Unidades" no Painel Admin
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('unidades', 'Unidades', 'Globe', 'Sistema', 50)
ON CONFLICT (tab_key) DO NOTHING;
