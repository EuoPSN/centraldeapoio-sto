-- Fase C · extensão 1 — 2/4: campos novos do ticket (etapa do funil, plano, dependentes),
-- histórico do ticket e busca de número em tickets de OUTRO atendente (só devolve sim/não). Idempotente.

-- ------------------------------------------------------------
-- Campos novos em retomadas (continua só do dono: a política retomadas_own não muda).
-- ------------------------------------------------------------
ALTER TABLE public.retomadas ADD COLUMN IF NOT EXISTS etapa_funil TEXT;
ALTER TABLE public.retomadas ADD COLUMN IF NOT EXISTS plano TEXT;
ALTER TABLE public.retomadas ADD COLUMN IF NOT EXISTS dependentes INT;

ALTER TABLE public.retomadas DROP CONSTRAINT IF EXISTS retomadas_etapa_funil_check;
ALTER TABLE public.retomadas ADD CONSTRAINT retomadas_etapa_funil_check
  CHECK (etapa_funil IS NULL OR etapa_funil IN ('novo_lead','lead_qualificado','proposta_enviada','fechamento','venda_concluida'));
ALTER TABLE public.retomadas DROP CONSTRAINT IF EXISTS retomadas_plano_check;
ALTER TABLE public.retomadas ADD CONSTRAINT retomadas_plano_check
  CHECK (plano IS NULL OR plano IN ('Prata','Ouro','Diamante'));
ALTER TABLE public.retomadas DROP CONSTRAINT IF EXISTS retomadas_dependentes_check;
ALTER TABLE public.retomadas ADD CONSTRAINT retomadas_dependentes_check
  CHECK (dependentes IS NULL OR dependentes BETWEEN 0 AND 20);

-- View do Admin: continua SEM telefone; ganha só os campos novos (no fim, para o CREATE OR REPLACE valer).
CREATE OR REPLACE VIEW public.retomadas_admin AS
SELECT
  r.id, r.codigo, r.user_id,
  COALESCE(NULLIF(p.display_name, ''), split_part(p.email, '@', 1)) AS atendente,
  r.primeiro_nome, r.observacao, r.ponto_parada, r.ponto_parada_inicial, r.subetapa_fechamento,
  r.fechamento_caso_id, r.origem, r.status, r.etapa_atual, r.proxima_em, r.d10_enviado_em,
  r.motivo_perda, r.vezes_voltou, r.created_at, r.updated_at,
  r.etapa_funil, r.plano, r.dependentes
FROM public.retomadas r
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE private.has_role(auth.uid(), 'admin'::app_role);

REVOKE ALL ON public.retomadas_admin FROM PUBLIC, anon;
GRANT SELECT ON public.retomadas_admin TO authenticated;
GRANT ALL ON public.retomadas_admin TO service_role;

-- ------------------------------------------------------------
-- ticket_historico: uma linha por campo que mudou. O dono lê e insere; o Admin NÃO lê
-- o conteúdo (só contagens, via função própria no prompt 2). Apaga junto com o ticket.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.retomadas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  campo TEXT NOT NULL CHECK (campo IN ('ticket','etapa_funil','ponto_parada','plano','dependentes','observacao','retomar','status')),
  valor_anterior TEXT CHECK (valor_anterior IS NULL OR char_length(valor_anterior) <= 600),
  valor_novo TEXT CHECK (valor_novo IS NULL OR char_length(valor_novo) <= 600),
  origem TEXT NOT NULL CHECK (origem IN ('extensao','omnia')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ticket_historico TO authenticated;
GRANT ALL ON public.ticket_historico TO service_role;
ALTER TABLE public.ticket_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_historico_read_own" ON public.ticket_historico;
CREATE POLICY "ticket_historico_read_own" ON public.ticket_historico
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ticket_historico_insert_own" ON public.ticket_historico;
CREATE POLICY "ticket_historico_insert_own" ON public.ticket_historico
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.retomadas r WHERE r.id = ticket_id AND r.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_ticket_historico_ticket ON public.ticket_historico(ticket_id, created_at DESC);

-- ------------------------------------------------------------
-- Chave de comparação de telefone: DDD (se houver) + últimos 8 dígitos; ignora o 55 e o 9 inicial.
-- Igual à função chaveNumero do app e da extensão.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chave_telefone(_tel TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(d) < 8 THEN ''
    WHEN length(d) >= 10 THEN left(d, 2) || right(d, 8)
    ELSE right(d, 8)
  END
  FROM (
    SELECT CASE
      WHEN length(x) IN (12, 13) AND left(x, 2) = '55' THEN substr(x, 3)
      ELSE x
    END AS d
    FROM (SELECT regexp_replace(coalesce(_tel, ''), '\D', '', 'g') AS x) t
  ) u;
$$;

-- ------------------------------------------------------------
-- Este número já está com OUTRO atendente (ticket aberto)? Devolve só sim/não:
-- nunca quem, nem nada do ticket.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.numero_com_outro_atendente(_chave TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND length(coalesce(_chave, '')) >= 8 AND EXISTS (
    SELECT 1 FROM public.retomadas r
     WHERE r.user_id <> auth.uid()
       AND r.status IN ('fila', 'respondeu')
       AND r.telefone IS NOT NULL
       AND (
         public.chave_telefone(r.telefone) = _chave
         OR (length(public.chave_telefone(r.telefone)) <> length(_chave)
             AND right(public.chave_telefone(r.telefone), 8) = right(_chave, 8))
       )
  );
$$;

REVOKE ALL ON FUNCTION public.numero_com_outro_atendente(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_com_outro_atendente(TEXT) TO authenticated, service_role;
