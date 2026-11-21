-- Fase B · bloco 2 — 2/2: seções novas do Painel Admin (grupo Treino). Idempotente.
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('mapaequipe',         'Mapa da equipe',      'LayoutGrid',    'Treino', 50, true),
  ('bancoexercicios',    'Banco de exercícios', 'ClipboardList', 'Treino', 60, true),
  ('aquecimentoadmin',   'Aquecimento',         'Flame',         'Treino', 70, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
