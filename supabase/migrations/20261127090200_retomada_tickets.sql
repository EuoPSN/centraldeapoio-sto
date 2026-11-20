-- Fase A · bloco 2 · "Retomar hoje" — 3/5: tickets de retomada, proteção do telefone,
-- view do Admin (sem telefone) e limpeza. Idempotente.

CREATE SEQUENCE IF NOT EXISTS public.retomadas_codigo_seq START 1;

-- ------------------------------------------------------------
-- retomadas: um ticket por cliente em retomada.
-- telefone: só o próprio atendente lê (RLS por user_id, SEM cláusula de admin).
-- O Admin enxerga os tickets pela view retomadas_admin, que não tem a coluna.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retomadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE DEFAULT ('RT-' || lpad(nextval('public.retomadas_codigo_seq')::text, 4, '0')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  primeiro_nome TEXT NOT NULL DEFAULT '' CHECK (char_length(primeiro_nome) <= 40),
  telefone TEXT CHECK (telefone IS NULL OR char_length(telefone) <= 20),
  observacao TEXT NOT NULL DEFAULT '' CHECK (char_length(observacao) <= 500),
  ponto_parada TEXT NOT NULL
    CHECK (ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  ponto_parada_inicial TEXT NOT NULL
    CHECK (ponto_parada_inicial IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  subetapa_fechamento TEXT,
  fechamento_caso_id UUID REFERENCES public.fechamento_casos(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'fechamento', 'extensao')),
  status TEXT NOT NULL DEFAULT 'fila' CHECK (status IN ('fila', 'respondeu', 'fechou', 'perdido', 'esfriou')),
  etapa_atual TEXT NOT NULL DEFAULT 'd1' CHECK (etapa_atual IN ('follow_up', 'd1', 'd2', 'd4', 'd7', 'd10')),
  proxima_em TIMESTAMPTZ,
  -- Preenchido quando o D+10 é enviado: 2 dias depois sem resposta, vira "esfriou".
  d10_enviado_em TIMESTAMPTZ,
  motivo_perda TEXT,
  vezes_voltou INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retomadas TO authenticated;
GRANT ALL ON public.retomadas TO service_role;
ALTER TABLE public.retomadas ENABLE ROW LEVEL SECURITY;

-- Só o dono. Nem o admin lê esta tabela (o telefone mora aqui).
DROP POLICY IF EXISTS "retomadas_own" ON public.retomadas;
CREATE POLICY "retomadas_own" ON public.retomadas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_retomadas_updated ON public.retomadas;
CREATE TRIGGER trg_retomadas_updated
  BEFORE UPDATE ON public.retomadas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Apaga o telefone na hora em que o ticket sai de "fila"/"respondeu".
CREATE OR REPLACE FUNCTION public.retomadas_apagar_telefone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('fila', 'respondeu') THEN
    NEW.telefone := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retomadas_apagar_telefone ON public.retomadas;
CREATE TRIGGER trg_retomadas_apagar_telefone
  BEFORE INSERT OR UPDATE ON public.retomadas
  FOR EACH ROW EXECUTE FUNCTION public.retomadas_apagar_telefone();

CREATE INDEX IF NOT EXISTS idx_retomadas_user_status ON public.retomadas(user_id, status, proxima_em);
CREATE INDEX IF NOT EXISTS idx_retomadas_status_proxima ON public.retomadas(status, proxima_em);

-- ------------------------------------------------------------
-- View do Admin: todos os tickets, SEM telefone. Roda com os direitos do dono da
-- view (por isso enxerga as linhas de todos) mas só devolve algo para admin.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.retomadas_admin AS
SELECT
  r.id, r.codigo, r.user_id,
  COALESCE(NULLIF(p.display_name, ''), split_part(p.email, '@', 1)) AS atendente,
  r.primeiro_nome, r.observacao, r.ponto_parada, r.ponto_parada_inicial, r.subetapa_fechamento,
  r.fechamento_caso_id, r.origem, r.status, r.etapa_atual, r.proxima_em, r.d10_enviado_em,
  r.motivo_perda, r.vezes_voltou, r.created_at, r.updated_at
FROM public.retomadas r
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE private.has_role(auth.uid(), 'admin'::app_role);

REVOKE ALL ON public.retomadas_admin FROM PUBLIC, anon;
GRANT SELECT ON public.retomadas_admin TO authenticated;
GRANT ALL ON public.retomadas_admin TO service_role;
