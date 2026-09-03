-- Copia o conteúdo institucional que hoje vive em content_items (seção "conhecimento")
-- pra dentro da Base de Conhecimento real (knowledge_entries), sem apagar o original.
INSERT INTO public.knowledge_entries (kind, title, content, tags, external_url, position)
SELECT
  CASE WHEN category ILIKE '%regra%' THEN 'regra' ELSE 'artigo' END,
  title,
  content,
  CASE WHEN category IS NOT NULL AND category <> '' THEN array_append(COALESCE(tags, '{}'), category) ELSE COALESCE(tags, '{}') END,
  link_externo,
  0
FROM public.content_items
WHERE section = 'conhecimento';
