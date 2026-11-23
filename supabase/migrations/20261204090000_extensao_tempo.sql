-- Fase C · extensão 2 — 1/5: tempo de primeira resposta (config + medições). Idempotente.
-- Nenhuma tabela guarda nome, telefone nem texto de cliente: só a chave em hash (chat_key), horários e minutos.

-- ------------------------------------------------------------
-- extensao_config: uma linha. Todos os atendentes leem (a extensão precisa); só o admin altera.
-- horario: {"0":[],"1":[{"de":"08:00","ate":"18:00"}],...} — chave = dia da semana (0 = domingo).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  meta_minutos INT NOT NULL DEFAULT 5 CHECK (meta_minutos BETWEEN 1 AND 240),
  nova_conversa_horas INT NOT NULL DEFAULT 12 CHECK (nova_conversa_horas BETWEEN 1 AND 168),
  horario JSONB NOT NULL DEFAULT '{"0":[],"1":[{"de":"08:00","ate":"18:00"}],"2":[{"de":"08:00","ate":"18:00"}],"3":[{"de":"08:00","ate":"18:00"}],"4":[{"de":"08:00","ate":"18:00"}],"5":[{"de":"08:00","ate":"18:00"}],"6":[{"de":"08:00","ate":"12:00"}]}'::jsonb,
  fuso TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.extensao_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.extensao_config TO authenticated;
GRANT ALL ON public.extensao_config TO service_role;
ALTER TABLE public.extensao_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_config_read" ON public.extensao_config;
CREATE POLICY "extensao_config_read" ON public.extensao_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "extensao_config_insert_admin" ON public.extensao_config;
CREATE POLICY "extensao_config_insert_admin" ON public.extensao_config
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "extensao_config_update_admin" ON public.extensao_config;
CREATE POLICY "extensao_config_update_admin" ON public.extensao_config
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- extensao_tempos: uma linha por conversa NOVA. Nasce sem resposta (resposta_em nulo) e é
-- atualizada quando o atendente responde. O atendente lê, insere e atualiza só as próprias;
-- o admin lê todas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_tempos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  chat_key TEXT NOT NULL CHECK (char_length(chat_key) BETWEEN 32 AND 128),
  inicio_em TIMESTAMPTZ NOT NULL,
  resposta_em TIMESTAMPTZ,
  minutos_uteis NUMERIC(10, 2) CHECK (minutos_uteis IS NULL OR minutos_uteis >= 0),
  dentro_da_meta BOOLEAN,
  dia DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_key, inicio_em),
  CHECK (resposta_em IS NULL OR resposta_em >= inicio_em)
);

GRANT SELECT, INSERT, UPDATE ON public.extensao_tempos TO authenticated;
GRANT ALL ON public.extensao_tempos TO service_role;
ALTER TABLE public.extensao_tempos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_tempos_read" ON public.extensao_tempos;
CREATE POLICY "extensao_tempos_read" ON public.extensao_tempos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "extensao_tempos_insert_own" ON public.extensao_tempos;
CREATE POLICY "extensao_tempos_insert_own" ON public.extensao_tempos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_tempos_update_own" ON public.extensao_tempos;
CREATE POLICY "extensao_tempos_update_own" ON public.extensao_tempos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_extensao_tempos_user_dia ON public.extensao_tempos(user_id, dia DESC);
CREATE INDEX IF NOT EXISTS idx_extensao_tempos_dia ON public.extensao_tempos(dia DESC);

-- ------------------------------------------------------------
-- Minutos dentro do horário de atendimento entre dois instantes (config id = 1, fuso da config).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extensao_minutos_uteis(_ini TIMESTAMPTZ, _fim TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_h JSONB; v_tz TEXT; v_ini TIMESTAMP; v_fim TIMESTAMP; v_dia DATE;
  v_total NUMERIC := 0; f JSONB; v_de TIMESTAMP; v_ate TIMESTAMP;
BEGIN
  IF _ini IS NULL OR _fim IS NULL OR _fim <= _ini THEN RETURN 0; END IF;
  -- Trava de segurança: janelas absurdas (mais de 60 dias) contam só os últimos 60.
  IF _fim - _ini > interval '60 days' THEN _ini := _fim - interval '60 days'; END IF;
  SELECT c.horario, c.fuso INTO v_h, v_tz FROM public.extensao_config c WHERE c.id = 1;
  v_tz := COALESCE(v_tz, 'America/Sao_Paulo');
  v_ini := _ini AT TIME ZONE v_tz;
  v_fim := _fim AT TIME ZONE v_tz;
  FOR v_dia IN SELECT d::date FROM generate_series(v_ini::date, v_fim::date, interval '1 day') d LOOP
    FOR f IN SELECT value FROM jsonb_array_elements(COALESCE(v_h -> (extract(dow FROM v_dia)::int)::text, '[]'::jsonb)) LOOP
      v_de := v_dia + (f ->> 'de')::time;
      v_ate := v_dia + (f ->> 'ate')::time;
      v_total := v_total + GREATEST(0, extract(epoch FROM (LEAST(v_ate, v_fim) - GREATEST(v_de, v_ini))) / 60.0);
    END LOOP;
  END LOOP;
  RETURN round(v_total, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.extensao_minutos_uteis(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extensao_minutos_uteis(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ------------------------------------------------------------
-- extensao_tempo_resumo(dia): SÓ os dados de quem chama (nunca de colegas).
-- "Sem resposta" = conversa nova do dia ainda sem resposta e já acima da meta (minutos úteis).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extensao_tempo_resumo(_dia DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu UUID := auth.uid();
  v_meta INT;
  v_novas INT; v_resp INT; v_dentro INT; v_sem INT; v_media NUMERIC;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta.' USING ERRCODE = '42501';
  END IF;
  SELECT c.meta_minutos INTO v_meta FROM public.extensao_config c WHERE c.id = 1;
  v_meta := COALESCE(v_meta, 5);

  SELECT count(*)::int,
         count(*) FILTER (WHERE t.resposta_em IS NOT NULL)::int,
         count(*) FILTER (WHERE t.dentro_da_meta IS TRUE)::int,
         avg(t.minutos_uteis) FILTER (WHERE t.resposta_em IS NOT NULL)
    INTO v_novas, v_resp, v_dentro, v_media
    FROM public.extensao_tempos t
   WHERE t.user_id = v_eu AND t.dia = _dia;

  SELECT count(*)::int INTO v_sem
    FROM public.extensao_tempos t
   WHERE t.user_id = v_eu AND t.dia = _dia AND t.resposta_em IS NULL
     AND public.extensao_minutos_uteis(t.inicio_em, now()) > v_meta;

  RETURN jsonb_build_object(
    'dia', _dia, 'meta_minutos', v_meta,
    'conversas_novas', COALESCE(v_novas, 0), 'respondidas', COALESCE(v_resp, 0),
    'dentro_da_meta', COALESCE(v_dentro, 0), 'sem_resposta', COALESCE(v_sem, 0),
    'media_minutos', round(v_media, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.extensao_tempo_resumo(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extensao_tempo_resumo(DATE) TO authenticated, service_role;
