-- ============ Biblioteca de Imagens com pastas (Iniciativa #4 do roadmap de conteúdo) ============
-- "Pasta" = categoria (reaproveita public.categories, um novo escopo 'image_library',
-- do mesmo jeito que 'client_profile' foi adicionado antes). Sem tabela de pastas separada.
-- Reaproveita o bucket message-images e o proxy /api/public/message-image já existentes
-- (Iniciativa #2) — nenhuma infraestrutura de Storage nova é necessária.

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_scope_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_scope_check
  CHECK (scope IN ('message','flow','suggestion','content','client_profile','image_library'));

CREATE TABLE public.image_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  image_path TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_library_items TO authenticated;
GRANT ALL ON public.image_library_items TO service_role;
ALTER TABLE public.image_library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ili_read_auth" ON public.image_library_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "ili_write_admin" ON public.image_library_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_image_library_items_updated BEFORE UPDATE ON public.image_library_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('imagelibrary', 'Biblioteca de Imagens', 'Image', 'Conteúdo & IA', 40)
ON CONFLICT (tab_key) DO NOTHING;

INSERT INTO public.nav_items (label, icon, route, section, position, admin_only)
SELECT 'Imagens', 'Image', '/imagens', 'main', 80, false
WHERE NOT EXISTS (SELECT 1 FROM public.nav_items WHERE route = '/imagens');
