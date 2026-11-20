-- Fase A · bloco 3 · Cérebro da Omnia — 4/4: seções novas do Painel Admin
-- (grupo Inteligência). Idempotente.
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('cerebro',     'Cérebro da Omnia', 'Brain',      'Inteligência', 5,  true),
  ('raioxequipe', 'Raio-X da equipe', 'ScanSearch', 'Inteligência', 35, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
