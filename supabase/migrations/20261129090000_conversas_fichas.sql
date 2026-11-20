-- Fase B · bloco 1 · "Conversas que fecharam" — 1/4: fichas de aprendizado e votos.
-- A conversa bruta NUNCA é guardada: só a ficha (sem telefone, CPF, e-mail, nome do
-- cliente ou fala do cliente). Idempotente.

CREATE TABLE IF NOT EXISTS public.conversas_fichas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  retomada_id UUID REFERENCES public.retomadas(id) ON DELETE SET NULL,
  objecao_id UUID REFERENCES public.objecoes(id) ON DELETE SET NULL,
  objecao_rotulo TEXT NOT NULL DEFAULT '' CHECK (char_length(objecao_rotulo) <= 120),
  ponto_parada TEXT NOT NULL
    CHECK (ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  plano TEXT NOT NULL DEFAULT 'outro' CHECK (plano IN ('Prata', 'Ouro', 'Diamante', 'outro')),
  perfil_cliente TEXT NOT NULL DEFAULT '' CHECK (char_length(perfil_cliente) <= 160),
  onde_travou TEXT NOT NULL DEFAULT '' CHECK (char_length(onde_travou) <= 800),
  o_que_fez TEXT[] NOT NULL DEFAULT '{}',
  mensagem_chave TEXT NOT NULL DEFAULT '' CHECK (char_length(mensagem_chave) <= 1500),
  por_que_funcionou TEXT NOT NULL DEFAULT '' CHECK (char_length(por_que_funcionou) <= 800),
  dias_ate_fechar INT CHECK (dias_ate_fechar IS NULL OR dias_ate_fechar >= 0),
  -- Data do fechamento (última mensagem da conversa), só a data.
  fechou_em DATE,
  status TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'publicada', 'recusada')),
  motivo_recusa TEXT CHECK (motivo_recusa IS NULL OR char_length(motivo_recusa) <= 500),
  aprovada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  publicada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas_fichas TO authenticated;
GRANT ALL ON public.conversas_fichas TO service_role;
ALTER TABLE public.conversas_fichas ENABLE ROW LEVEL SECURITY;

-- Ver: o autor vê as próprias; todos os logados veem as publicadas; admin vê tudo.
DROP POLICY IF EXISTS "conversas_fichas_select" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_select" ON public.conversas_fichas
  FOR SELECT TO authenticated
  USING (autor_id = auth.uid() OR status = 'publicada' OR private.has_role(auth.uid(), 'admin'::app_role));

-- Criar: o autor só cria ficha "enviada" e em nome próprio (nada de aprovar a si mesmo).
DROP POLICY IF EXISTS "conversas_fichas_insert_own" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_insert_own" ON public.conversas_fichas
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND status = 'enviada'
    AND aprovada_por IS NULL AND publicada_em IS NULL AND motivo_recusa IS NULL
    AND (retomada_id IS NULL OR EXISTS (
      SELECT 1 FROM public.retomadas r WHERE r.id = retomada_id AND r.user_id = auth.uid()
    ))
  );

-- Admin: cria (+ Enviar conversa), edita, aprova, recusa, despublica e apaga.
DROP POLICY IF EXISTS "conversas_fichas_insert_admin" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_insert_admin" ON public.conversas_fichas
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "conversas_fichas_update_admin" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_update_admin" ON public.conversas_fichas
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "conversas_fichas_delete_admin" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_delete_admin" ON public.conversas_fichas
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_conversas_fichas_updated ON public.conversas_fichas;
CREATE TRIGGER trg_conversas_fichas_updated
  BEFORE UPDATE ON public.conversas_fichas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_conversas_fichas_status ON public.conversas_fichas(status, publicada_em DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_fichas_autor ON public.conversas_fichas(autor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_fichas_objecao ON public.conversas_fichas(objecao_id);
CREATE INDEX IF NOT EXISTS idx_conversas_fichas_retomada ON public.conversas_fichas(retomada_id);

-- ------------------------------------------------------------
-- conversas_fichas_feedback: "Isso ajudou" / "Não ajudou". Um voto por pessoa por ficha.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversas_fichas_feedback (
  ficha_id UUID NOT NULL REFERENCES public.conversas_fichas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  util BOOLEAN NOT NULL,
  motivo TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ficha_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas_fichas_feedback TO authenticated;
GRANT ALL ON public.conversas_fichas_feedback TO service_role;
ALTER TABLE public.conversas_fichas_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fichas_feedback_select" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_select" ON public.conversas_fichas_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- Só vota em ficha publicada.
DROP POLICY IF EXISTS "fichas_feedback_insert_own" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_insert_own" ON public.conversas_fichas_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.conversas_fichas f WHERE f.id = ficha_id AND f.status = 'publicada'
  ));

-- Mudar o próprio voto.
DROP POLICY IF EXISTS "fichas_feedback_update_own" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_update_own" ON public.conversas_fichas_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "fichas_feedback_delete_own" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_delete_own" ON public.conversas_fichas_feedback
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_fichas_feedback_ficha ON public.conversas_fichas_feedback(ficha_id);
