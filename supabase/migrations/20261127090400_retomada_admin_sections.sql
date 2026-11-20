-- Fase A · bloco 2 · "Retomar hoje" — 5/5: seções novas do Painel Admin
-- (grupo Atendimento, depois de Economia). Idempotente.
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('cadencia',     'Cadência de retomada', 'Repeat2', 'Atendimento', 80, true),
  ('motivosperda', 'Motivos de perda',     'ListX',   'Atendimento', 90, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
