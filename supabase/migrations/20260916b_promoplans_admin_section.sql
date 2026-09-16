-- Registra a aba "Planos em promoção" no menu do Painel Admin (aba de Organização
-- só gerencia abas existentes, não cria novas — por isso precisa entrar por aqui).
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('promoplans', 'Planos em promoção', 'DollarSign', 'Sistema', 65)
ON CONFLICT (tab_key) DO NOTHING;
