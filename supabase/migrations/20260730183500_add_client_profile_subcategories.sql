-- ============ Simulador IA: subcategorias de Perfis de Cliente ============
-- Reaproveita a taxonomia dinâmica já existente (public.categories) adicionando
-- o escopo 'client_profile', e liga cada perfil de cliente a uma subcategoria.

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_scope_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_scope_check
  CHECK (scope IN ('message','flow','suggestion','content','client_profile'));

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

INSERT INTO public.categories (scope, name, slug, position) VALUES
  ('client_profile', 'Filiação', 'filiacao', 10),
  ('client_profile', 'Refiliação', 'refiliacao', 20),
  ('client_profile', 'Migração', 'migracao', 30),
  ('client_profile', 'EDT', 'edt', 40)
ON CONFLICT DO NOTHING;
