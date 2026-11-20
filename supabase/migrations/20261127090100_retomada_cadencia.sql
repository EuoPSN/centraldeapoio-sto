-- Fase A · bloco 2 · "Retomar hoje" — 2/5: mensagens da cadência (com versões),
-- bucket dos áudios de exemplo e base inicial em rascunho. Idempotente.

-- ------------------------------------------------------------
-- cadencia_mensagens: uma mensagem por (ponto de parada, etapa)
-- texto: template com {nome} {atendente} {plano} {dependentes} {usos} {observacao}
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadencia_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ponto_parada TEXT NOT NULL
    CHECK (ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento', 'follow_up')),
  etapa TEXT NOT NULL CHECK (etapa IN ('follow_up', 'd1', 'd2', 'd4', 'd7', 'd10')),
  codigo TEXT GENERATED ALWAYS AS (ponto_parada || '_' || etapa) STORED,
  canal TEXT NOT NULL DEFAULT 'texto' CHECK (canal IN ('texto', 'audio')),
  papel TEXT NOT NULL DEFAULT 'outro'
    CHECK (papel IN ('lembrete', 'beneficio', 'prova', 'audio', 'despedida', 'outro')),
  texto TEXT NOT NULL DEFAULT '',
  por_que TEXT NOT NULL DEFAULT '',
  audio_exemplo_url TEXT,
  versao INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
  publicada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ponto_parada, etapa)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadencia_mensagens TO authenticated;
GRANT ALL ON public.cadencia_mensagens TO service_role;
ALTER TABLE public.cadencia_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cadencia_mensagens_read" ON public.cadencia_mensagens;
CREATE POLICY "cadencia_mensagens_read" ON public.cadencia_mensagens
  FOR SELECT TO authenticated
  USING (status = 'publicada' OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "cadencia_mensagens_write_admin" ON public.cadencia_mensagens;
CREATE POLICY "cadencia_mensagens_write_admin" ON public.cadencia_mensagens
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- cadencia_mensagens_versoes: cópia de cada versão publicada que foi substituída
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadencia_mensagens_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES public.cadencia_mensagens(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  versao INT NOT NULL,
  ponto_parada TEXT NOT NULL,
  etapa TEXT NOT NULL,
  canal TEXT NOT NULL,
  papel TEXT NOT NULL,
  texto TEXT NOT NULL,
  por_que TEXT NOT NULL,
  audio_exemplo_url TEXT,
  publicada_em TIMESTAMPTZ,
  substituida_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, versao)
);

GRANT SELECT ON public.cadencia_mensagens_versoes TO authenticated;
GRANT ALL ON public.cadencia_mensagens_versoes TO service_role;
ALTER TABLE public.cadencia_mensagens_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cadencia_versoes_read_admin" ON public.cadencia_mensagens_versoes;
CREATE POLICY "cadencia_versoes_read_admin" ON public.cadencia_mensagens_versoes
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- Versionamento: ao editar uma mensagem JÁ publicada (conteúdo mudou), guarda a
-- versão antiga e incrementa `versao`. Rascunho -> publicada marca publicada_em.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cadencia_mensagens_versionar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF OLD.status = 'publicada' AND NEW.status = 'publicada'
     AND (OLD.texto IS DISTINCT FROM NEW.texto
       OR OLD.por_que IS DISTINCT FROM NEW.por_que
       OR OLD.canal IS DISTINCT FROM NEW.canal
       OR OLD.papel IS DISTINCT FROM NEW.papel
       OR OLD.audio_exemplo_url IS DISTINCT FROM NEW.audio_exemplo_url) THEN
    INSERT INTO public.cadencia_mensagens_versoes
      (mensagem_id, codigo, versao, ponto_parada, etapa, canal, papel, texto, por_que, audio_exemplo_url, publicada_em, substituida_em)
    VALUES
      (OLD.id, OLD.codigo, OLD.versao, OLD.ponto_parada, OLD.etapa, OLD.canal, OLD.papel, OLD.texto, OLD.por_que, OLD.audio_exemplo_url, OLD.publicada_em, now())
    ON CONFLICT (mensagem_id, versao) DO NOTHING;
    NEW.versao := OLD.versao + 1;
    NEW.publicada_em := now();
  ELSIF OLD.status <> 'publicada' AND NEW.status = 'publicada' THEN
    NEW.publicada_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cadencia_mensagens_versionar ON public.cadencia_mensagens;
CREATE TRIGGER trg_cadencia_mensagens_versionar
  BEFORE UPDATE ON public.cadencia_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.cadencia_mensagens_versionar();

CREATE INDEX IF NOT EXISTS idx_cadencia_mensagens_ponto ON public.cadencia_mensagens(ponto_parada, etapa);

-- ------------------------------------------------------------
-- Bucket dos áudios de exemplo (privado). Admin envia; qualquer usuário logado
-- ouve (via URL assinada). Não guarda dado de cliente.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('cadencia-audios', 'cadencia-audios', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ca read" ON storage.objects;
CREATE POLICY "ca read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cadencia-audios');
DROP POLICY IF EXISTS "ca admin insert" ON storage.objects;
CREATE POLICY "ca admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cadencia-audios' AND private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "ca admin update" ON storage.objects;
CREATE POLICY "ca admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cadencia-audios' AND private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "ca admin delete" ON storage.objects;
CREATE POLICY "ca admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cadencia-audios' AND private.has_role(auth.uid(), 'admin'::public.app_role));

-- ------------------------------------------------------------
-- Base inicial: a estrutura da cadência, tudo em RASCUNHO e com texto "[escrever]".
-- Nenhuma mensagem é inventada aqui: o Paulo escreve e publica no Admin.
-- ------------------------------------------------------------
INSERT INTO public.cadencia_mensagens (ponto_parada, etapa, canal, papel, texto, por_que, status)
SELECT p.ponto, e.etapa, e.canal, e.papel, '[escrever]', '', 'rascunho'
FROM (VALUES ('nao_respondeu_primeira'), ('parou_explicativa'), ('recebeu_proposta'), ('travou_fechamento')) AS p(ponto)
CROSS JOIN (VALUES
  ('d1',  'texto', 'lembrete'),
  ('d2',  'texto', 'beneficio'),
  ('d4',  'texto', 'prova'),
  ('d7',  'audio', 'audio'),
  ('d10', 'texto', 'despedida')
) AS e(etapa, canal, papel)
ON CONFLICT (ponto_parada, etapa) DO NOTHING;

INSERT INTO public.cadencia_mensagens (ponto_parada, etapa, canal, papel, texto, por_que, status)
VALUES ('follow_up', 'follow_up', 'texto', 'lembrete', '[escrever]', '', 'rascunho')
ON CONFLICT (ponto_parada, etapa) DO NOTHING;
