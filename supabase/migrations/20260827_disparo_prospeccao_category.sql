-- ============ Mensagens de Envio/Disparo (prospecção) ============
-- Reaproveita a taxonomia de mensagens já existente (public.categories, scope='message')
-- em vez de criar uma entidade nova: só adiciona uma categoria-raiz para separar
-- mensagens de disparo/prospecção das de atendimento em andamento.
-- Depois de aplicada, a categoria já aparece em Admin → Mensagens → "Gerar scripts com IA"
-- e é filtrável na Biblioteca pública (/scripts) sem nenhuma mudança de código.

INSERT INTO public.categories (scope, name, slug, position) VALUES
  ('message', 'Disparo / Prospecção', 'disparo-prospeccao', 100)
ON CONFLICT DO NOTHING;
