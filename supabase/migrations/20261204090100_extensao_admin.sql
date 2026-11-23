-- Fase C · extensão 2 — 2/4: Admin > Extensão do WhatsApp (só contagens, nunca conteúdo). Idempotente.

-- ------------------------------------------------------------
-- extensao_admin_resumo(ini, fim): uma linha por atendente ativo (não admin). SÓ admin.
-- Fontes: ticket_historico (só contagens), extensao_eventos e extensao_tempos.
-- Nunca devolve conteúdo, nome nem telefone de cliente.
--  tickets_criados : tickets criados pela extensão no período
--  atualizados     : edições de ticket pela extensão (uma por salvamento, sem contar a criação)
--  resposta_media  : média de minutos úteis da 1ª resposta (conversas novas com resposta no período)
--  instalou        : já houve algum evento ou medição da extensão (em qualquer data)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extensao_admin_resumo(_ini TIMESTAMPTZ, _fim TIMESTAMPTZ)
RETURNS TABLE (
  user_id UUID, nome TEXT, tickets_criados INT, atualizados INT, resposta_media NUMERIC,
  conversas_novas INT, dentro_da_meta INT, ignorados INT, pausas INT, instalou BOOLEAN, primeiro_evento TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH at AS (
    SELECT p.id AS uid, COALESCE(NULLIF(trim(p.display_name), ''), split_part(p.email, '@', 1), 'Sem nome') AS nm
      FROM public.profiles p
     WHERE COALESCE(p.is_active, true)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role)
  ),
  hist AS (
    SELECT h.user_id AS uid,
           count(*) FILTER (WHERE h.campo = 'ticket')::int AS criados,
           count(DISTINCT (h.ticket_id, h.created_at)) FILTER (WHERE h.campo <> 'ticket'
             AND NOT EXISTS (SELECT 1 FROM public.ticket_historico c WHERE c.ticket_id = h.ticket_id AND c.created_at = h.created_at AND c.campo = 'ticket'))::int AS atualiz
      FROM public.ticket_historico h
     WHERE h.origem = 'extensao' AND h.created_at >= _ini AND h.created_at < _fim
     GROUP BY h.user_id
  ),
  ev AS (
    SELECT e.user_id AS uid,
           count(*) FILTER (WHERE e.tipo = 'conversa_ignorada' AND e.created_at >= _ini AND e.created_at < _fim)::int AS ign,
           count(*) FILTER (WHERE e.tipo = 'pausou' AND e.created_at >= _ini AND e.created_at < _fim)::int AS paus,
           min(e.created_at) AS primeiro
      FROM public.extensao_eventos e GROUP BY e.user_id
  ),
  tp AS (
    SELECT t.user_id AS uid,
           count(*)::int AS novas,
           count(*) FILTER (WHERE t.dentro_da_meta IS TRUE)::int AS dentro,
           avg(t.minutos_uteis) FILTER (WHERE t.resposta_em IS NOT NULL) AS media,
           min(t.created_at) AS primeiro
      FROM public.extensao_tempos t
     WHERE t.inicio_em >= _ini AND t.inicio_em < _fim
     GROUP BY t.user_id
  ),
  tp_any AS (SELECT DISTINCT t.user_id AS uid FROM public.extensao_tempos t)
  SELECT a.uid, a.nm,
         COALESCE(h.criados, 0), COALESCE(h.atualiz, 0), round(tp.media, 2),
         COALESCE(tp.novas, 0), COALESCE(tp.dentro, 0),
         COALESCE(ev.ign, 0), COALESCE(ev.paus, 0),
         (ev.uid IS NOT NULL OR EXISTS (SELECT 1 FROM tp_any x WHERE x.uid = a.uid)),
         ev.primeiro
    FROM at a
    LEFT JOIN hist h ON h.uid = a.uid
    LEFT JOIN ev ON ev.uid = a.uid
    LEFT JOIN tp ON tp.uid = a.uid
   ORDER BY a.nm;
END;
$$;

REVOKE ALL ON FUNCTION public.extensao_admin_resumo(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extensao_admin_resumo(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Seção do Admin: Extensão do WhatsApp (grupo Treino e evolução)
-- ------------------------------------------------------------
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('extensaoadmin', 'Extensão do WhatsApp', 'Phone', 'Treino', 90, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
