-- Fase D · 6/9 — Scripts de ligação com chave de liberação. Idempotente.
--
-- recursos_config: chaves de liberação (booleanas) que o admin liga e desliga. Nenhuma tabela
-- parecida existia (app_settings é uma linha só, com colunas fixas), então esta é a primeira.
-- Chave desta fase: scripts_ligacao_liberado (padrão: desligada).
--
-- Enquanto a chave estiver desligada, o BANCO também esconde os roteiros dos atendentes
-- (a política de leitura abaixo), não só a tela.

CREATE TABLE IF NOT EXISTS public.recursos_config (
  chave TEXT PRIMARY KEY CHECK (char_length(chave) BETWEEN 1 AND 80),
  valor BOOLEAN NOT NULL DEFAULT false,
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recursos_config TO authenticated;
GRANT ALL ON public.recursos_config TO service_role;
ALTER TABLE public.recursos_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recursos_config_select" ON public.recursos_config;
CREATE POLICY "recursos_config_select" ON public.recursos_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recursos_config_insert_admin" ON public.recursos_config;
CREATE POLICY "recursos_config_insert_admin" ON public.recursos_config
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "recursos_config_update_admin" ON public.recursos_config;
CREATE POLICY "recursos_config_update_admin" ON public.recursos_config
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "recursos_config_delete_admin" ON public.recursos_config;
CREATE POLICY "recursos_config_delete_admin" ON public.recursos_config
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_recursos_config_updated ON public.recursos_config;
CREATE TRIGGER trg_recursos_config_updated
  BEFORE UPDATE ON public.recursos_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.recursos_config (chave, valor) VALUES ('scripts_ligacao_liberado', false)
ON CONFLICT (chave) DO NOTHING;

-- ------------------------------------------------------------
-- roteiros_ligacao
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roteiros_ligacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 150),
  etapa TEXT NOT NULL CHECK (etapa IN ('Abertura', 'Sondagem', 'Apresentação', 'Objeções', 'Fechamento')),
  situacao TEXT NOT NULL DEFAULT '' CHECK (char_length(situacao) <= 400),
  texto TEXT NOT NULL DEFAULT '' CHECK (char_length(texto) <= 4000),
  dicas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roteiros_ligacao_publicado_com_texto CHECK (status = 'rascunho' OR char_length(btrim(texto)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_roteiros_ligacao_status ON public.roteiros_ligacao (status, etapa, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roteiros_ligacao TO authenticated;
GRANT ALL ON public.roteiros_ligacao TO service_role;
ALTER TABLE public.roteiros_ligacao ENABLE ROW LEVEL SECURITY;

-- Atendente: só publicados E só com a chave ligada. Admin: tudo.
DROP POLICY IF EXISTS "roteiros_ligacao_select" ON public.roteiros_ligacao;
CREATE POLICY "roteiros_ligacao_select" ON public.roteiros_ligacao
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR (
      status = 'publicada'
      AND EXISTS (SELECT 1 FROM public.recursos_config r WHERE r.chave = 'scripts_ligacao_liberado' AND r.valor)
    )
  );

DROP POLICY IF EXISTS "roteiros_ligacao_insert_admin" ON public.roteiros_ligacao;
CREATE POLICY "roteiros_ligacao_insert_admin" ON public.roteiros_ligacao
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "roteiros_ligacao_update_admin" ON public.roteiros_ligacao;
CREATE POLICY "roteiros_ligacao_update_admin" ON public.roteiros_ligacao
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "roteiros_ligacao_delete_admin" ON public.roteiros_ligacao;
CREATE POLICY "roteiros_ligacao_delete_admin" ON public.roteiros_ligacao
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_roteiros_ligacao_updated ON public.roteiros_ligacao;
CREATE TRIGGER trg_roteiros_ligacao_updated
  BEFORE UPDATE ON public.roteiros_ligacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: uma entrada de EXEMPLO por etapa, em rascunho, curta. Só entra se a tabela estiver vazia.
INSERT INTO public.roteiros_ligacao (titulo, etapa, situacao, texto, dicas, status, position)
SELECT v.titulo, v.etapa, 'EXEMPLO · reescreva antes de publicar.', v.texto, v.dicas, 'rascunho', v.pos
  FROM (VALUES
    ('Exemplo · Abertura', 'Abertura',
     E'Oi, [nome], tudo bem? Aqui é o/a [seu nome], do Cartão de TODOS. (sorria) Estou ligando rapidinho porque você pediu informações. Posso te explicar em dois minutos?',
     ARRAY['Sorria ao falar: a voz acompanha.', 'Espere a resposta antes de continuar.'], 10),
    ('Exemplo · Sondagem', 'Sondagem',
     E'Para eu te indicar o melhor plano: com que frequência você ou a sua família vão ao médico? (pausa curta) E hoje, vocês usam algum desconto?',
     ARRAY['Faça uma pergunta por vez.', 'Ouça mais do que fale.'], 20),
    ('Exemplo · Apresentação', 'Apresentação',
     E'Pelo que você me contou, o plano [plano] faz sentido para você. (pausa curta) O pagamento é no cartão de crédito ou débito. Faz sentido para você?',
     ARRAY['Fale só do que o cliente contou que precisa.'], 30),
    ('Exemplo · Objeções', 'Objeções',
     E'Entendo, [nome]. (pausa curta) Posso perguntar o que pesa mais: o valor ou a dúvida se vai usar? Assim eu te mostro só o que ajuda.',
     ARRAY['Não discuta: pergunte para entender.'], 40),
    ('Exemplo · Fechamento', 'Fechamento',
     E'Então vamos deixar tudo certo hoje? Eu te mando o link por mensagem e você escolhe o cartão de crédito ou débito. (pausa curta) Pode ser agora?',
     ARRAY['Termine com uma pergunta fácil de responder.'], 50)
  ) AS v(titulo, etapa, texto, dicas, pos)
 WHERE NOT EXISTS (SELECT 1 FROM public.roteiros_ligacao);
