ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS client_knowledge TEXT NOT NULL DEFAULT '';

INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('clientknowledge', 'Conhecimento do Cliente', 'BookOpen', 'Atendimento', 16)
ON CONFLICT (tab_key) DO NOTHING;
