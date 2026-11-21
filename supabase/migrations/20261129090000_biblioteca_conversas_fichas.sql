-- Fase B · bloco 1 · "Conversas que fecharam" — 1/5: fichas de aprendizado e feedback.
-- A conversa bruta NUNCA é guardada: só a ficha (texto já sem telefone, CPF, e-mail
-- nem nome de cliente). Idempotente.

-- ------------------------------------------------------------
-- conversas_fichas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversas_fichas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem enviou. O admin pode trocar para o atendente da venda.
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  retomada_id UUID REFERENCES public.retomadas(id) ON DELETE SET NULL,
  objecao_id UUID REFERENCES public.objecoes(id) ON DELETE SET NULL,
  objecao_rotulo TEXT NOT NULL DEFAULT '' CHECK (char_length(objecao_rotulo) <= 120),
  titulo TEXT NOT NULL DEFAULT '' CHECK (char_length(titulo) <= 160),
  ponto_parada TEXT NOT NULL
    CHECK (ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  plano TEXT NOT NULL DEFAULT 'outro' CHECK (plano IN ('Prata', 'Ouro', 'Diamante', 'outro')),
  perfil_cliente TEXT NOT NULL DEFAULT '' CHECK (char_length(perfil_cliente) <= 160),
  onde_travou TEXT NOT NULL DEFAULT '' CHECK (char_length(onde_travou) <= 800),
  o_que_fez TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(o_que_fez) <= 6),
  mensagem_chave TEXT NOT NULL DEFAULT '' CHECK (char_length(mensagem_chave) <= 1200),
  por_que_funcionou TEXT NOT NULL DEFAULT '' CHECK (char_length(por_que_funcionou) <= 800),
  dias_ate_fechar INT CHECK (dias_ate_fechar IS NULL OR dias_ate_fechar >= 0),
  fechou_em DATE,
  status TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'publicada', 'recusada')),
  motivo_recusa TEXT,
  aprovada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  publicada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas_fichas TO authenticated;
GRANT ALL ON public.conversas_fichas TO service_role;
ALTER TABLE public.conversas_fichas ENABLE ROW LEVEL SECURITY;

-- Todo usuário logado vê as publicadas; o autor vê as próprias; o admin vê tudo.
DROP POLICY IF EXISTS "conversas_fichas_read" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_read" ON public.conversas_fichas
  FOR SELECT TO authenticated
  USING (status = 'publicada' OR autor_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- O autor cria as próprias fichas, sempre como "enviada" e sem aprovação.
DROP POLICY IF EXISTS "conversas_fichas_insert_own" ON public.conversas_fichas;
CREATE POLICY "conversas_fichas_insert_own" ON public.conversas_fichas
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid() AND status = 'enviada'
    AND aprovada_por IS NULL AND publicada_em IS NULL AND motivo_recusa IS NULL
  );

-- Só o admin edita, publica, recusa ou apaga.
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
CREATE INDEX IF NOT EXISTS idx_conversas_fichas_objecao ON public.conversas_fichas(objecao_id) WHERE status = 'publicada';
CREATE INDEX IF NOT EXISTS idx_conversas_fichas_retomada ON public.conversas_fichas(retomada_id);

-- ------------------------------------------------------------
-- conversas_fichas_feedback: um voto por pessoa por ficha ("Isso ajudou" 👍/👎)
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

DROP POLICY IF EXISTS "fichas_feedback_read" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_read" ON public.conversas_fichas_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- Vota (e troca o voto) só em ficha publicada.
DROP POLICY IF EXISTS "fichas_feedback_insert_own" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_insert_own" ON public.conversas_fichas_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.conversas_fichas f WHERE f.id = ficha_id AND f.status = 'publicada')
  );

DROP POLICY IF EXISTS "fichas_feedback_update_own" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_update_own" ON public.conversas_fichas_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "fichas_feedback_delete_own_or_admin" ON public.conversas_fichas_feedback;
CREATE POLICY "fichas_feedback_delete_own_or_admin" ON public.conversas_fichas_feedback
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- Ferramenta "biblioteca" no Cérebro: libera o valor nas tabelas que têm lista fechada.
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tabela, c.conname
      FROM pg_constraint c
     WHERE c.contype = 'c'
       AND c.conrelid IN ('public.ia_uso'::regclass, 'public.ia_limites'::regclass,
                          'public.ia_limites_extra'::regclass, 'public.cerebro_blocos'::regclass)
       AND pg_get_constraintdef(c.oid) ILIKE '%simulador%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabela, r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.ia_uso ADD CONSTRAINT ia_uso_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.ia_limites ADD CONSTRAINT ia_limites_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.ia_limites_extra ADD CONSTRAINT ia_limites_extra_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.cerebro_blocos ADD CONSTRAINT cerebro_blocos_ferramentas_check
  CHECK (ferramentas <@ ARRAY['marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca']::text[]);

-- Limite diário padrão: 10 fichas por dia por pessoa (editável no Admin).
INSERT INTO public.ia_limites (ferramenta, limite_diario) VALUES ('biblioteca', 10)
ON CONFLICT (ferramenta) DO NOTHING;

-- Blocos padrão da ferramenta: playbook CDT, mapeamento de objeções, padrão de escrita,
-- etapas do funil e SPIN Selling (o Paulo pode desmarcar no Cérebro).
UPDATE public.cerebro_blocos
   SET ferramentas = array_append(ferramentas, 'biblioteca')
 WHERE chave IN ('playbook_cdt', 'mapeamento_objecoes', 'padrao_escrita', 'etapas_funil', 'spin_selling')
   AND NOT ('biblioteca' = ANY (ferramentas));
