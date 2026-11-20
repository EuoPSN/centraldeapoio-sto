-- Fase A · bloco 1 · "O cliente disse…" — 2/6: fechamento (itens e casos).
-- Idempotente.

-- ------------------------------------------------------------
-- fechamento_itens: sinais de compra, mensagens de cada etapa e travamentos
-- mensagem: template com {nome} {dependentes} {plano} {usos} {economia}
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fechamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('sinal', 'mensagem_etapa', 'travamento')),
  etapa TEXT NOT NULL CHECK (etapa IN ('proposta', 'plano', 'dados', 'pagamento', 'link')),
  titulo TEXT NOT NULL,
  exemplos_de_fala TEXT[] NOT NULL DEFAULT '{}',
  mensagem TEXT,
  passos TEXT[] NOT NULL DEFAULT '{}',
  evite TEXT,
  ordem INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fechamento_itens TO authenticated;
GRANT ALL ON public.fechamento_itens TO service_role;
ALTER TABLE public.fechamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_itens_read" ON public.fechamento_itens;
CREATE POLICY "fechamento_itens_read" ON public.fechamento_itens
  FOR SELECT TO authenticated
  USING (status = 'publicada' OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "fechamento_itens_write_admin" ON public.fechamento_itens;
CREATE POLICY "fechamento_itens_write_admin" ON public.fechamento_itens
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_fechamento_itens_updated ON public.fechamento_itens;
CREATE TRIGGER trg_fechamento_itens_updated
  BEFORE UPDATE ON public.fechamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fechamento_itens_etapa ON public.fechamento_itens(etapa, tipo, ordem);

-- ------------------------------------------------------------
-- fechamento_casos: o cliente que o atendente está fechando agora.
-- SEM CPF, telefone ou sobrenome. Some quando a venda é concluída ou em 30 dias.
-- usos: [{item_tipo: consulta|exame|odontologia, item_id, nome, rotulo}]
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fechamento_casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  primeiro_nome TEXT NOT NULL DEFAULT '' CHECK (char_length(primeiro_nome) <= 40),
  dependentes INT NOT NULL DEFAULT 0 CHECK (dependentes BETWEEN 0 AND 20),
  plano TEXT CHECK (plano IN ('prata', 'ouro', 'diamante')),
  usos JSONB NOT NULL DEFAULT '[]'::jsonb,
  etapa TEXT NOT NULL DEFAULT 'proposta'
    CHECK (etapa IN ('proposta', 'plano', 'dados', 'pagamento', 'link', 'venda_concluida')),
  retomar_em DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fechamento_casos TO authenticated;
GRANT ALL ON public.fechamento_casos TO service_role;
ALTER TABLE public.fechamento_casos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechamento_casos_own" ON public.fechamento_casos;
CREATE POLICY "fechamento_casos_own" ON public.fechamento_casos
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_fechamento_casos_updated ON public.fechamento_casos;
CREATE TRIGGER trg_fechamento_casos_updated
  BEFORE UPDATE ON public.fechamento_casos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fechamento_casos_user ON public.fechamento_casos(user_id, updated_at DESC);

-- Limpeza: apaga casos concluídos e casos com mais de 30 dias.
-- Chamada ao abrir a página e, se o pg_cron existir, todo dia às 03:17.
CREATE OR REPLACE FUNCTION public.limpar_fechamento_casos()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT;
BEGIN
  DELETE FROM public.fechamento_casos
  WHERE etapa = 'venda_concluida' OR created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_fechamento_casos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpar_fechamento_casos() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('limpar_fechamento_casos');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule('limpar_fechamento_casos', '17 3 * * *', 'SELECT public.limpar_fechamento_casos();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível: a limpeza roda ao abrir a página.';
END;
$$;
