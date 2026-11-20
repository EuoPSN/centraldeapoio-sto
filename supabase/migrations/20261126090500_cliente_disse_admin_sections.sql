-- Fase A · bloco 1 · "O cliente disse…" — 6/6: seções novas do Painel Admin
-- (grupo Atendimento, depois de Contatos). Idempotente.
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('objecoes',      'Objeções',        'MessageCircleQuestion', 'Atendimento', 40, true),
  ('objecoesnovas', 'Objeções novas',  'Inbox',                 'Atendimento', 50, true),
  ('fechamento',    'Fechamento',      'Handshake',             'Atendimento', 60, true),
  ('economia',      'Economia',        'PiggyBank',             'Atendimento', 70, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
