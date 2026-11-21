-- Fase B · bloco 1 — 3/5: seções novas do Painel Admin (grupo Atendimento, depois de
-- Cadência de retomada e Motivos de perda). Idempotente.
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('mensagensvendem',   'Mensagens que vendem', 'BarChart2', 'Atendimento', 100, true),
  ('conversasenviadas', 'Conversas enviadas',   'Inbox',     'Atendimento', 110, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
