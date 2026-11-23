-- Fase E — Painel Admin organizado. Idempotente: só UPDATE/DELETE por chave. Não apaga tabelas nem dados de negócio.
-- Rodar no SQL editor do Lovable ANTES do merge.

-- 4) Páginas antigas sem link: tira do menu do site.
DELETE FROM public.nav_items
WHERE route IN ('/dashboard', '/funcionarios', '/crm-leads', '/crm-prospeccao', '/motor-decisao');
