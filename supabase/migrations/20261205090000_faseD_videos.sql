-- Fase D · 1/7 — Vídeos na Central de Ajuda e nos fluxos de Scripts.
-- Colunas opcionais (vazio = "Vídeo em breve"). Idempotente.
-- A validação principal fica no servidor e no formulário (src/lib/video.ts); aqui há uma
-- trava de segurança no banco: só https, e só YouTube, Vimeo ou arquivo .mp4/.webm.
--
-- `categories` guarda o fluxo que aparece nos cartões de Scripts ("Para quem é");
-- `flows` é o fluxo em grafo. As duas ganham as colunas, para o vídeo valer nos dois.

ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS video_duracao TEXT;
ALTER TABLE public.flows         ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.flows         ADD COLUMN IF NOT EXISTS video_duracao TEXT;
ALTER TABLE public.categories    ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.categories    ADD COLUMN IF NOT EXISTS video_duracao TEXT;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_items', 'flows', 'categories'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_video_url_check') THEN
      EXECUTE format($f$
        ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (
          video_url IS NULL OR (
            char_length(video_url) <= 500 AND (
              video_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com)([/?#:]|$)'
              OR video_url ~* '^https://[^ ]+\.(mp4|webm)(\?[^ ]*)?$'
            )
          )
        )$f$, t, t || '_video_url_check');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_video_duracao_check') THEN
      EXECUTE format($f$
        ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (
          video_duracao IS NULL OR video_duracao ~ '^([0-9]{1,2}:)?[0-5]?[0-9]:[0-5][0-9]$'
        )$f$, t, t || '_video_duracao_check');
    END IF;
  END LOOP;
END;
$$;

-- As políticas e GRANTs que já existem nessas tabelas continuam valendo
-- (leitura para autenticados; escrita só admin). Nada novo a liberar.
