-- Fase D · 7/7 — Seções novas do Painel Admin (padrão da 20261125090000). Idempotente.
-- Só INSERE: o que já existe não é alterado, removido nem reordenado (ON CONFLICT DO NOTHING).
--
-- telemedicina: fica DENTRO de Amor Saúde (aba "Teleconsulta e PA"), por isso visible = false;
--               o link /admin/telemedicina abre a seção Amor Saúde já nessa aba.
-- duvidas, roteirosaudio, scriptsligacao: grupo Atendimento, depois das seções que já existem.

INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('telemedicina',    'Teleconsulta e PA digital', 'Video',                  'Atendimento',  21, false),
  ('duvidas',         'Dúvidas frequentes',        'MessageCircleQuestion',  'Atendimento', 120, true),
  ('roteirosaudio',   'Roteiros de áudio',         'AudioLines',             'Atendimento', 130, true),
  ('scriptsligacao',  'Scripts de ligação',        'PhoneCall',              'Atendimento', 140, true)
ON CONFLICT (tab_key) DO NOTHING;
