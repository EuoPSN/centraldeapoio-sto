-- Fase C · extensão 2 — 5/5: dados semanais para o relatório Excel (abas Extensao e Tempo_de_resposta). Idempotente.
-- Admin: toda a equipe (ou um atendente). Atendente: SÓ os próprios dados (o parâmetro de usuário é ignorado).
-- Só contagens e minutos: nunca conteúdo, nome nem telefone de cliente.

-- Tickets criados/atualizados pela extensão (ticket_historico, só contagens), ignorados e pausas (extensao_eventos), por semana.
CREATE OR REPLACE FUNCTION public.extensao_resumo_semanal(_ini TIMESTAMPTZ, _fim TIMESTAMPTZ, _user UUID DEFAULT NULL)
RETURNS TABLE (semana DATE, user_id UUID, tickets_criados INT, atualizados INT, ignorados INT, pausas INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu UUID := auth.uid();
  v_admin BOOLEAN;
  v_user UUID;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta.' USING ERRCODE = '42501';
  END IF;
  v_admin := private.has_role(v_eu, 'admin'::app_role);
  v_user := CASE WHEN v_admin THEN _user ELSE v_eu END; -- atendente: sempre e só o próprio id
  RETURN QUERY
  WITH hist AS (
    SELECT date_trunc('week', h.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS sem, h.user_id AS uid,
           count(*) FILTER (WHERE h.campo = 'ticket')::int AS criados,
           count(DISTINCT (h.ticket_id, h.created_at)) FILTER (WHERE h.campo <> 'ticket'
             AND NOT EXISTS (SELECT 1 FROM public.ticket_historico c WHERE c.ticket_id = h.ticket_id AND c.created_at = h.created_at AND c.campo = 'ticket'))::int AS atualiz
      FROM public.ticket_historico h
     WHERE h.origem = 'extensao' AND h.created_at >= _ini AND h.created_at < _fim AND (v_user IS NULL OR h.user_id = v_user)
     GROUP BY 1, 2
  ),
  ev AS (
    SELECT date_trunc('week', e.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS sem, e.user_id AS uid,
           count(*) FILTER (WHERE e.tipo = 'conversa_ignorada')::int AS ign,
           count(*) FILTER (WHERE e.tipo = 'pausou')::int AS paus
      FROM public.extensao_eventos e
     WHERE e.created_at >= _ini AND e.created_at < _fim AND (v_user IS NULL OR e.user_id = v_user)
     GROUP BY 1, 2
  )
  SELECT COALESCE(h.sem, e.sem), COALESCE(h.uid, e.uid),
         COALESCE(h.criados, 0), COALESCE(h.atualiz, 0), COALESCE(e.ign, 0), COALESCE(e.paus, 0)
    FROM hist h FULL JOIN ev e ON e.sem = h.sem AND e.uid = h.uid
   ORDER BY 1, 2;
END;
$$;

REVOKE ALL ON FUNCTION public.extensao_resumo_semanal(TIMESTAMPTZ, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extensao_resumo_semanal(TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated, service_role;

-- Tempo de primeira resposta por dia e atendente (extensao_tempos). "Sem resposta" = conversa nova ainda sem
-- resposta e já acima da meta, em minutos úteis.
CREATE OR REPLACE FUNCTION public.extensao_tempo_dia(_ini DATE, _fim DATE, _user UUID DEFAULT NULL)
RETURNS TABLE (dia DATE, user_id UUID, conversas_novas INT, dentro_da_meta INT, media_minutos NUMERIC, sem_resposta INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu UUID := auth.uid();
  v_user UUID;
  v_meta INT;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta.' USING ERRCODE = '42501';
  END IF;
  v_user := CASE WHEN private.has_role(v_eu, 'admin'::app_role) THEN _user ELSE v_eu END;
  SELECT c.meta_minutos INTO v_meta FROM public.extensao_config c WHERE c.id = 1;
  v_meta := COALESCE(v_meta, 5);
  RETURN QUERY
  SELECT t.dia, t.user_id, count(*)::int,
         count(*) FILTER (WHERE t.dentro_da_meta IS TRUE)::int,
         round(avg(t.minutos_uteis) FILTER (WHERE t.resposta_em IS NOT NULL), 2),
         count(*) FILTER (WHERE t.resposta_em IS NULL AND public.extensao_minutos_uteis(t.inicio_em, now()) > v_meta)::int
    FROM public.extensao_tempos t
   WHERE t.dia BETWEEN _ini AND _fim AND (v_user IS NULL OR t.user_id = v_user)
   GROUP BY t.dia, t.user_id
   ORDER BY t.dia, t.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.extensao_tempo_dia(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extensao_tempo_dia(DATE, DATE, UUID) TO authenticated, service_role;
