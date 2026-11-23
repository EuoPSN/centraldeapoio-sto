# Extensão 2 · migrações em ordem

Rode no SQL editor do Lovable Cloud, uma de cada vez, nesta ordem. Todas são idempotentes. Pré-requisitos: Fase A e B aplicadas e as 4 migrações da extensão 1 (`docs/fase-c/migracoes-extensao-1.md`).

## 1. `20261204090000_extensao_tempo.sql`

```sql
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
```

## 2. `20261204090100_extensao_admin.sql`

```sql
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
```

## 3. `20261204090200_extensao_crm.sql`

```sql
-- Fase C · extensão 2 — 3/4: fechamentos do CRM (planilha semanal) e telefone_hash nos tickets. Idempotente.
-- A planilha é lida no NAVEGADOR do admin. O servidor só recebe hashes de telefone e nomes de VENDEDORES
-- (atendentes); nunca nome nem telefone de cliente em claro, e a planilha não é guardada.

-- ------------------------------------------------------------
-- 1. Histórico do ticket aceita a origem 'crm'
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname FROM pg_constraint c
     WHERE c.contype = 'c' AND c.conrelid = 'public.ticket_historico'::regclass
       AND pg_get_constraintdef(c.oid) ILIKE '%origem%' AND pg_get_constraintdef(c.oid) ILIKE '%extensao%'
  LOOP
    EXECUTE format('ALTER TABLE public.ticket_historico DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;
ALTER TABLE public.ticket_historico DROP CONSTRAINT IF EXISTS ticket_historico_origem_check;
ALTER TABLE public.ticket_historico ADD CONSTRAINT ticket_historico_origem_check CHECK (origem IN ('extensao', 'omnia', 'crm'));

-- ------------------------------------------------------------
-- 2. telefone_hash: SHA-256 (hex) de 'omnia-crm-v1:' + últimos 9 dígitos do número (sem o 55).
-- O SAL FIXO 'omnia-crm-v1' é o mesmo de src/lib/crm.ts (HASH_TELEFONE_SAL). Se mudar um, mude o outro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.telefone_hash(_tel TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN length(n) < 8 THEN NULL
              ELSE encode(sha256(convert_to('omnia-crm-v1:' || n, 'UTF8')), 'hex') END
  FROM (
    SELECT right(d2, 9) AS n
    FROM (
      SELECT CASE WHEN length(d) >= 12 AND left(d, 2) = '55' THEN substr(d, 3) ELSE d END AS d2
      FROM (SELECT regexp_replace(coalesce(_tel, ''), '\D', '', 'g') AS d) t
    ) u
  ) v;
$$;

ALTER TABLE public.retomadas ADD COLUMN IF NOT EXISTS telefone_hash TEXT;

-- Preenche ao criar/atualizar o telefone. Mantém o hash quando o telefone é apagado (ticket que saiu da fila).
-- O nome do gatilho vem antes de trg_retomadas_apagar_telefone na ordem alfabética (roda antes).
CREATE OR REPLACE FUNCTION public.retomadas_preencher_telefone_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.telefone IS NOT NULL THEN
    NEW.telefone_hash := public.telefone_hash(NEW.telefone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retomadas_a_telefone_hash ON public.retomadas;
CREATE TRIGGER trg_retomadas_a_telefone_hash
  BEFORE INSERT OR UPDATE OF telefone ON public.retomadas
  FOR EACH ROW EXECUTE FUNCTION public.retomadas_preencher_telefone_hash();

-- Tickets que já existem: calcula no servidor a partir do telefone guardado (o número não sai do banco).
-- O gatilho de updated_at fica desligado só durante esta carga, para não mexer na data dos tickets.
ALTER TABLE public.retomadas DISABLE TRIGGER trg_retomadas_updated;
UPDATE public.retomadas SET telefone_hash = public.telefone_hash(telefone)
 WHERE telefone IS NOT NULL AND telefone_hash IS NULL;
ALTER TABLE public.retomadas ENABLE TRIGGER trg_retomadas_updated;

CREATE INDEX IF NOT EXISTS idx_retomadas_user_hash ON public.retomadas(user_id, telefone_hash) WHERE telefone_hash IS NOT NULL;

-- A view do Admin continua SEM telefone e SEM hash (colunas inalteradas).

-- ------------------------------------------------------------
-- 3. crm_vendedor_map: nome do vendedor na planilha (normalizado: sem acento, minúsculo) → usuário da Omnia
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_vendedor_map (
  vendedor_nome_planilha TEXT PRIMARY KEY CHECK (char_length(vendedor_nome_planilha) BETWEEN 1 AND 120),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_vendedor_map TO authenticated;
GRANT ALL ON public.crm_vendedor_map TO service_role;
ALTER TABLE public.crm_vendedor_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_vendedor_map_read_admin" ON public.crm_vendedor_map;
CREATE POLICY "crm_vendedor_map_read_admin" ON public.crm_vendedor_map
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "crm_vendedor_map_insert_admin" ON public.crm_vendedor_map;
CREATE POLICY "crm_vendedor_map_insert_admin" ON public.crm_vendedor_map
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "crm_vendedor_map_update_admin" ON public.crm_vendedor_map;
CREATE POLICY "crm_vendedor_map_update_admin" ON public.crm_vendedor_map
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "crm_vendedor_map_delete_admin" ON public.crm_vendedor_map;
CREATE POLICY "crm_vendedor_map_delete_admin" ON public.crm_vendedor_map
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- 4. crm_fechamentos: UMA LINHA POR DIA de venda e atendente (periodo_ini = periodo_fim = o dia).
-- Assim, reenviar semanas que se sobrepõem substitui exatamente os dias cobertos, sem contar em dobro.
-- Admin lê e escreve tudo; o atendente lê só as próprias linhas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_ini DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendas INT NOT NULL DEFAULT 0 CHECK (vendas >= 0),
  tickets_fechados INT NOT NULL DEFAULT 0 CHECK (tickets_fechados >= 0),
  sem_ticket INT NOT NULL DEFAULT 0 CHECK (sem_ticket >= 0),
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (periodo_fim >= periodo_ini),
  UNIQUE (user_id, periodo_ini, periodo_fim)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_fechamentos TO authenticated;
GRANT ALL ON public.crm_fechamentos TO service_role;
ALTER TABLE public.crm_fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_fechamentos_read" ON public.crm_fechamentos;
CREATE POLICY "crm_fechamentos_read" ON public.crm_fechamentos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "crm_fechamentos_insert_admin" ON public.crm_fechamentos;
CREATE POLICY "crm_fechamentos_insert_admin" ON public.crm_fechamentos
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "crm_fechamentos_update_admin" ON public.crm_fechamentos;
CREATE POLICY "crm_fechamentos_update_admin" ON public.crm_fechamentos
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "crm_fechamentos_delete_admin" ON public.crm_fechamentos;
CREATE POLICY "crm_fechamentos_delete_admin" ON public.crm_fechamentos
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_crm_fechamentos_user ON public.crm_fechamentos(user_id, periodo_ini DESC);
CREATE INDEX IF NOT EXISTS idx_crm_fechamentos_ini ON public.crm_fechamentos(periodo_ini DESC);

-- ------------------------------------------------------------
-- 5. fechar_tickets_por_crm(user, hashes, periodo): SÓ admin.
-- Fecha como "Venda concluída (CRM)" os tickets ABERTOS (fila/respondeu) do atendente cujo
-- telefone_hash está na lista; registra em ticket_historico com origem 'crm' e em retomada_eventos
-- (o ticket sai da fila de retomada). Devolve só hashes: os recém-fechados e os que o CRM já tinha fechado
-- antes (para reenvios não zerarem a contagem). Nada de nome nem telefone.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fechar_tickets_por_crm(_user_id UUID, _hashes TEXT[], _ini DATE, _fim DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_novos TEXT[] := '{}';
  v_antes TEXT[] := '{}';
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _hashes IS NULL OR cardinality(_hashes) = 0 THEN
    RETURN jsonb_build_object('fechados', '[]'::jsonb, 'ja_fechados', '[]'::jsonb);
  END IF;
  IF cardinality(_hashes) > 5000 THEN
    RAISE EXCEPTION 'Lista grande demais (máximo 5000 telefones por vendedor).' USING ERRCODE = '22023';
  END IF;

  FOR r IN
    SELECT t.id, t.telefone_hash, t.etapa_funil, t.status, t.etapa_atual, t.ponto_parada
      FROM public.retomadas t
     WHERE t.user_id = _user_id AND t.telefone_hash = ANY (_hashes) AND t.status IN ('fila', 'respondeu')
  LOOP
    INSERT INTO public.ticket_historico (ticket_id, user_id, campo, valor_anterior, valor_novo, origem, created_at) VALUES
      (r.id, _user_id, 'etapa_funil', r.etapa_funil, 'venda_concluida', 'crm', v_agora),
      (r.id, _user_id, 'status', r.status, 'Venda concluída (CRM)', 'crm', v_agora);
    UPDATE public.retomadas SET status = 'fechou', etapa_funil = 'venda_concluida', proxima_em = NULL WHERE id = r.id;
    INSERT INTO public.retomada_eventos (retomada_id, user_id, ponto_parada, etapa, acao, detalhe)
      VALUES (r.id, _user_id, r.ponto_parada, r.etapa_atual, 'fechou', 'crm');
    v_novos := array_append(v_novos, r.telefone_hash);
  END LOOP;

  SELECT COALESCE(array_agg(DISTINCT t.telefone_hash), '{}') INTO v_antes
    FROM public.retomadas t
   WHERE t.user_id = _user_id AND t.telefone_hash = ANY (_hashes) AND t.status = 'fechou'
     AND NOT (t.telefone_hash = ANY (v_novos))
     AND EXISTS (SELECT 1 FROM public.ticket_historico h WHERE h.ticket_id = t.id AND h.origem = 'crm');

  RETURN jsonb_build_object('fechados', to_jsonb(v_novos), 'ja_fechados', to_jsonb(v_antes));
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_tickets_por_crm(UUID, TEXT[], DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_tickets_por_crm(UUID, TEXT[], DATE, DATE) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 6. crm_gravar_fechamentos(ini, fim, linhas): SÓ admin. Substitui TODOS os dias de [ini, fim]
-- (apaga as linhas do período e grava as novas) numa única transação.
-- linhas: [{"user_id": "...", "dia": "2026-11-14", "vendas": 3, "tickets_fechados": 2, "sem_ticket": 1}]
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_gravar_fechamentos(_ini DATE, _fim DATE, _linhas JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INT := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  IF _ini IS NULL OR _fim IS NULL OR _fim < _ini OR _fim - _ini > 400 THEN
    RAISE EXCEPTION 'Período inválido.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.crm_fechamentos WHERE periodo_ini >= _ini AND periodo_fim <= _fim;
  INSERT INTO public.crm_fechamentos (periodo_ini, periodo_fim, user_id, vendas, tickets_fechados, sem_ticket, enviado_por, enviado_em)
  SELECT (l ->> 'dia')::date, (l ->> 'dia')::date, (l ->> 'user_id')::uuid,
         GREATEST((l ->> 'vendas')::int, 0), GREATEST((l ->> 'tickets_fechados')::int, 0), GREATEST((l ->> 'sem_ticket')::int, 0),
         auth.uid(), now()
    FROM jsonb_array_elements(COALESCE(_linhas, '[]'::jsonb)) l
   WHERE (l ->> 'dia')::date BETWEEN _ini AND _fim
  ON CONFLICT (user_id, periodo_ini, periodo_fim) DO UPDATE
    SET vendas = EXCLUDED.vendas, tickets_fechados = EXCLUDED.tickets_fechados, sem_ticket = EXCLUDED.sem_ticket,
        enviado_por = EXCLUDED.enviado_por, enviado_em = EXCLUDED.enviado_em;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_gravar_fechamentos(DATE, DATE, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_gravar_fechamentos(DATE, DATE, JSONB) TO authenticated, service_role;
```

## 4. `20261204090300_ranking_fechamentos.sql`

```sql
-- Fase C · extensão 2 — 4/4: pódio "Mais fechamentos" no Ranking e base do comparativo "Antes e depois". Idempotente.
-- Pré-requisito: migrações 1 a 3 desta fase (precisa de crm_fechamentos).

-- ------------------------------------------------------------
-- Sexto pódio: liga/desliga em ranking_config e Hall do mês
-- ------------------------------------------------------------
ALTER TABLE public.ranking_config ADD COLUMN IF NOT EXISTS podio_fechamentos BOOLEAN NOT NULL DEFAULT true;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname FROM pg_constraint c
     WHERE c.contype = 'c' AND c.conrelid = 'public.ranking_hall'::regclass
       AND pg_get_constraintdef(c.oid) ILIKE '%podio%' AND pg_get_constraintdef(c.oid) ILIKE '%constantes%'
  LOOP
    EXECUTE format('ALTER TABLE public.ranking_hall DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;
ALTER TABLE public.ranking_hall DROP CONSTRAINT IF EXISTS ranking_hall_podio_check;
ALTER TABLE public.ranking_hall ADD CONSTRAINT ranking_hall_podio_check
  CHECK (podio IN ('constantes', 'respondidas', 'evoluiram', 'ensinam', 'treino', 'fechamentos'));

-- ------------------------------------------------------------
-- Cálculo interno: os cinco pódios de qualidade do mês (os quatro de sempre + fechamentos).
-- Quem está oculto no mês, é admin ou está inativo não entra (igual aos outros).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ranking_calcular(p_mes DATE)
RETURNS TABLE (podio TEXT, user_id UUID, nome TEXT, valor NUMERIC, total INT, qualifica BOOLEAN, posicao INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes DATE := date_trunc('month', p_mes)::date;
  v_ini TIMESTAMPTZ := (v_mes::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_fim TIMESTAMPTZ := ((v_mes + interval '1 month')::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_ant TIMESTAMPTZ := ((v_mes - interval '1 month')::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_min INT; v_c BOOLEAN; v_r BOOLEAN; v_e BOOLEAN; v_n BOOLEAN; v_f BOOLEAN;
BEGIN
  SELECT c.minimo_retomadas, c.podio_constantes, c.podio_respondidas, c.podio_evoluiram, c.podio_ensinam, c.podio_fechamentos
    INTO v_min, v_c, v_r, v_e, v_n, v_f
    FROM public.ranking_config c WHERE c.id = 1;
  v_min := COALESCE(v_min, 15);
  v_c := COALESCE(v_c, true); v_r := COALESCE(v_r, true); v_e := COALESCE(v_e, true); v_n := COALESCE(v_n, true); v_f := COALESCE(v_f, true);

  RETURN QUERY
  WITH at AS (
    SELECT p.id AS uid,
           COALESCE(NULLIF(trim(p.display_name), ''), split_part(p.email, '@', 1), 'Sem nome') AS nm
      FROM public.profiles p
     WHERE COALESCE(p.is_active, true)
       AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role)
       AND NOT EXISTS (SELECT 1 FROM public.ranking_ocultos o WHERE o.user_id = p.id AND o.mes = v_mes)
  ),
  unid AS (
    SELECT e.user_id AS uid, e.retomada_id, e.etapa,
           (min(e.prevista_em) AT TIME ZONE 'America/Sao_Paulo')::date AS prazo,
           ((min(e.created_at) FILTER (WHERE e.acao = 'enviei')) AT TIME ZONE 'America/Sao_Paulo')::date AS feito
      FROM public.retomada_eventos e
     WHERE e.acao IN ('recomendada', 'copiou', 'enviei') AND e.prevista_em IS NOT NULL
     GROUP BY e.user_id, e.retomada_id, e.etapa
  ),
  cons AS (
    SELECT u.uid, count(*)::int AS n,
           100.0 * count(*) FILTER (WHERE u.feito IS NOT NULL AND u.feito <= u.prazo) / count(*) AS v
      FROM unid u
     WHERE u.prazo >= v_mes AND u.prazo < (v_mes + interval '1 month')::date
       AND (u.prazo < v_hoje OR u.feito IS NOT NULL)
     GROUP BY u.uid
  ),
  env AS (
    SELECT e.user_id AS uid, e.retomada_id, min(e.created_at) AS primeiro
      FROM public.retomada_eventos e
     WHERE e.acao = 'enviei' AND e.created_at >= v_ini AND e.created_at < v_fim
     GROUP BY e.user_id, e.retomada_id
  ),
  resp AS (
    SELECT env.uid, count(*)::int AS n,
           100.0 * count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM public.retomada_eventos r
              WHERE r.retomada_id = env.retomada_id AND r.acao IN ('respondeu', 'fechou') AND r.created_at >= env.primeiro
           )) / count(*) AS v
      FROM env GROUP BY env.uid
  ),
  sim AS (
    SELECT s.user_id AS uid,
           avg(s.nota) FILTER (WHERE s.created_at >= v_ini) AS a,
           count(*) FILTER (WHERE s.created_at >= v_ini)::int AS na,
           avg(s.nota) FILTER (WHERE s.created_at < v_ini) AS b,
           count(*) FILTER (WHERE s.created_at < v_ini)::int AS nb
      FROM public.simulator_results s
     WHERE s.created_at >= v_ant AND s.created_at < v_fim
     GROUP BY s.user_id
  ),
  ens AS (
    SELECT x.uid, count(*)::int AS n FROM (
      SELECT f.autor_id AS uid FROM public.conversas_fichas f
       WHERE f.status = 'publicada' AND f.publicada_em >= v_ini AND f.publicada_em < v_fim
      UNION ALL
      SELECT o.autor_id FROM public.objecoes o
       WHERE o.status = 'publicada' AND o.autor_id IS NOT NULL AND o.created_at >= v_ini AND o.created_at < v_fim
    ) x GROUP BY x.uid
  ),
  fech AS (
    -- Mais fechamentos: vendas do mês confirmadas no CRM (uma linha por dia de venda). Sem mínimo de retomadas.
    SELECT f.user_id AS uid, sum(f.vendas)::int AS n
      FROM public.crm_fechamentos f
     WHERE f.periodo_ini >= v_mes AND f.periodo_ini < (v_mes + interval '1 month')::date
     GROUP BY f.user_id
  ),
  todos AS (
    SELECT 'constantes'::text AS pd, a.uid, a.nm, c.v AS vv, COALESCE(c.n, 0) AS tt,
           (COALESCE(c.n, 0) >= v_min AND c.v IS NOT NULL) AS q
      FROM at a LEFT JOIN cons c ON c.uid = a.uid WHERE v_c
    UNION ALL
    SELECT 'respondidas', a.uid, a.nm, r.v, COALESCE(r.n, 0),
           (COALESCE(r.n, 0) >= v_min AND r.v IS NOT NULL)
      FROM at a LEFT JOIN resp r ON r.uid = a.uid WHERE v_r
    UNION ALL
    SELECT 'evoluiram', a.uid, a.nm,
           CASE WHEN s.na >= 3 AND s.nb >= 3 AND s.b > 0 THEN 100.0 * (s.a - s.b) / s.b END,
           COALESCE(s.na, 0),
           (s.na >= 3 AND s.nb >= 3 AND s.b > 0 AND s.a > s.b)
      FROM at a LEFT JOIN sim s ON s.uid = a.uid WHERE v_e
    UNION ALL
    SELECT 'ensinam', a.uid, a.nm, COALESCE(n.n, 0)::numeric, COALESCE(n.n, 0), (COALESCE(n.n, 0) > 0)
      FROM at a LEFT JOIN ens n ON n.uid = a.uid WHERE v_n
    UNION ALL
    SELECT 'fechamentos', a.uid, a.nm, COALESCE(f.n, 0)::numeric, COALESCE(f.n, 0), (COALESCE(f.n, 0) > 0)
      FROM at a LEFT JOIN fech f ON f.uid = a.uid WHERE v_f
  )
  SELECT t.pd, t.uid, t.nm, round(t.vv, 1), t.tt::int, COALESCE(t.q, false),
         CASE WHEN COALESCE(t.q, false)
              THEN (row_number() OVER (PARTITION BY t.pd, COALESCE(t.q, false) ORDER BY t.vv DESC NULLS LAST, t.tt DESC, t.nm))::int
         END
    FROM todos t;
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_calcular(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ranking_calcular(DATE) TO service_role;

-- Fechamento do mês anterior: agora também grava o top 3 de "Mais fechamentos".
-- Meses já fechados antes desta migração não ganham o novo pódio (ficam como estão).
CREATE OR REPLACE FUNCTION public.ranking_fechar_mes(p_mes DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes DATE := date_trunc('month', p_mes)::date;
  v_atual DATE := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta.' USING ERRCODE = '42501';
  END IF;
  -- Só fecha mês que já acabou.
  IF v_mes >= v_atual THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ranking_hall h WHERE h.mes = v_mes AND h.podio IN ('constantes', 'respondidas', 'evoluiram', 'ensinam', 'fechamentos')) THEN
    RETURN;
  END IF;
  INSERT INTO public.ranking_hall (mes, podio, posicao, user_id, valor)
  SELECT v_mes, c.podio, c.posicao, c.user_id, c.valor
    FROM public.ranking_calcular(v_mes) c
   WHERE c.posicao BETWEEN 1 AND 3 AND c.valor IS NOT NULL
  ON CONFLICT (mes, podio, posicao) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_fechar_mes(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking_fechar_mes(DATE) TO authenticated, service_role;

-- ------------------------------------------------------------
-- extensao_inicio: data de início do "Antes e depois" escolhida pelo Admin (por atendente).
-- Sem linha, vale a data do primeiro evento da extensão. Só o Admin lê e escreve.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_inicio (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inicio DATE NOT NULL,
  definido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extensao_inicio TO authenticated;
GRANT ALL ON public.extensao_inicio TO service_role;
ALTER TABLE public.extensao_inicio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_inicio_read_admin" ON public.extensao_inicio;
CREATE POLICY "extensao_inicio_read_admin" ON public.extensao_inicio
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "extensao_inicio_insert_admin" ON public.extensao_inicio;
CREATE POLICY "extensao_inicio_insert_admin" ON public.extensao_inicio
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "extensao_inicio_update_admin" ON public.extensao_inicio;
CREATE POLICY "extensao_inicio_update_admin" ON public.extensao_inicio
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "extensao_inicio_delete_admin" ON public.extensao_inicio;
CREATE POLICY "extensao_inicio_delete_admin" ON public.extensao_inicio
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
```

## 5. `20261204090400_extensao_relatorio.sql`

```sql
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
```

