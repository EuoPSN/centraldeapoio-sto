-- Fase D · 5/7 — Roteiros de áudio (Scripts). Sem seed: o Paulo e o Claude escrevem depois. Idempotente.
-- Atendente lê só as publicadas; admin lê e escreve tudo.

CREATE TABLE IF NOT EXISTS public.roteiros_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 150),
  -- Retomada, Objeção, Fechamento, Pós-venda (texto livre: dá para criar outras categorias).
  categoria TEXT NOT NULL CHECK (char_length(categoria) BETWEEN 1 AND 60),
  situacao TEXT NOT NULL DEFAULT '' CHECK (char_length(situacao) <= 400),
  -- Com marcações como [nome], (pausa curta), (sorria).
  texto TEXT NOT NULL DEFAULT '' CHECK (char_length(texto) <= 4000),
  dicas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Caminho do arquivo no bucket roteiros-audio (não é link público).
  audio_url TEXT CHECK (audio_url IS NULL OR char_length(audio_url) <= 300),
  duracao TEXT CHECK (duracao IS NULL OR duracao ~ '^([0-9]{1,2}:)?[0-5]?[0-9]:[0-5][0-9]$'),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roteiros_audio_publicado_com_texto CHECK (status = 'rascunho' OR char_length(btrim(texto)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_roteiros_audio_status ON public.roteiros_audio (status, categoria, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roteiros_audio TO authenticated;
GRANT ALL ON public.roteiros_audio TO service_role;
ALTER TABLE public.roteiros_audio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roteiros_audio_select" ON public.roteiros_audio;
CREATE POLICY "roteiros_audio_select" ON public.roteiros_audio
  FOR SELECT TO authenticated
  USING (status = 'publicada' OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "roteiros_audio_insert_admin" ON public.roteiros_audio;
CREATE POLICY "roteiros_audio_insert_admin" ON public.roteiros_audio
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "roteiros_audio_update_admin" ON public.roteiros_audio;
CREATE POLICY "roteiros_audio_update_admin" ON public.roteiros_audio
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "roteiros_audio_delete_admin" ON public.roteiros_audio;
CREATE POLICY "roteiros_audio_delete_admin" ON public.roteiros_audio
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_roteiros_audio_updated ON public.roteiros_audio;
CREATE TRIGGER trg_roteiros_audio_updated
  BEFORE UPDATE ON public.roteiros_audio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Bucket privado roteiros-audio: leitura para autenticados (URL assinada), escrita só admin.
-- mp3/m4a/ogg/wav, até 5 MB. As políticas do bucket dos áudios da cadência (cadencia-audios)
-- serviriam, mas aquele bucket não limita tamanho nem formato; este limita no próprio Storage.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'roteiros-audio', 'roteiros-audio', false, 5242880,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/ogg', 'application/ogg', 'audio/wav', 'audio/x-wav', 'audio/wave']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "ra read" ON storage.objects;
CREATE POLICY "ra read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'roteiros-audio');
DROP POLICY IF EXISTS "ra admin insert" ON storage.objects;
CREATE POLICY "ra admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'roteiros-audio' AND private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "ra admin update" ON storage.objects;
CREATE POLICY "ra admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'roteiros-audio' AND private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "ra admin delete" ON storage.objects;
CREATE POLICY "ra admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'roteiros-audio' AND private.has_role(auth.uid(), 'admin'::public.app_role));
