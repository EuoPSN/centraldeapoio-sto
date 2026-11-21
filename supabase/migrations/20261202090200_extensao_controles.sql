-- Fase C · extensão 1 — 3/4: contatos ignorados, aceite do aviso e eventos de uso da extensão.
-- Nenhuma destas tabelas guarda conteúdo de conversa, nome ou número em claro. Idempotente.

-- ------------------------------------------------------------
-- extensao_ignorados: hash do número normalizado (nunca o número). Só o dono lê, insere e apaga.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_ignorados (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  numero_hash TEXT NOT NULL CHECK (char_length(numero_hash) BETWEEN 32 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, numero_hash)
);

GRANT SELECT, INSERT, DELETE ON public.extensao_ignorados TO authenticated;
GRANT ALL ON public.extensao_ignorados TO service_role;
ALTER TABLE public.extensao_ignorados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_ignorados_select_own" ON public.extensao_ignorados;
CREATE POLICY "extensao_ignorados_select_own" ON public.extensao_ignorados
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_ignorados_insert_own" ON public.extensao_ignorados;
CREATE POLICY "extensao_ignorados_insert_own" ON public.extensao_ignorados
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_ignorados_delete_own" ON public.extensao_ignorados;
CREATE POLICY "extensao_ignorados_delete_own" ON public.extensao_ignorados
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- extensao_aceites: confirmação de "O que a extensão faz" (por versão do texto).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_aceites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  versao TEXT NOT NULL CHECK (char_length(versao) BETWEEN 1 AND 20),
  aceito_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, versao)
);

GRANT SELECT, INSERT ON public.extensao_aceites TO authenticated;
GRANT ALL ON public.extensao_aceites TO service_role;
ALTER TABLE public.extensao_aceites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_aceites_select_own" ON public.extensao_aceites;
CREATE POLICY "extensao_aceites_select_own" ON public.extensao_aceites
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_aceites_insert_own" ON public.extensao_aceites;
CREATE POLICY "extensao_aceites_insert_own" ON public.extensao_aceites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- extensao_eventos: só o TIPO e a hora (para o Admin contar). Nunca conteúdo, nome nem número.
-- O dono insere e lê os próprios; o Admin lê todos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_eventos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('ticket_criado','ticket_atualizado','conversa_ignorada','pausou','despausou','leitura')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.extensao_eventos TO authenticated;
GRANT ALL ON public.extensao_eventos TO service_role;
ALTER TABLE public.extensao_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_eventos_insert_own" ON public.extensao_eventos;
CREATE POLICY "extensao_eventos_insert_own" ON public.extensao_eventos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_eventos_read" ON public.extensao_eventos;
CREATE POLICY "extensao_eventos_read" ON public.extensao_eventos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_extensao_eventos_user ON public.extensao_eventos(user_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extensao_eventos_data ON public.extensao_eventos(created_at DESC);
