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
