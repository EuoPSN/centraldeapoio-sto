-- Libera "pdf_library" como um novo tipo de escopo de categoria (pastas de PDF, separadas das de imagem)
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_scope_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_scope_check
  CHECK (scope IN ('message', 'flow', 'suggestion', 'content', 'client_profile', 'image_library', 'pdf_library'));

-- Biblioteca de PDFs
CREATE TABLE public.pdf_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  pdf_name TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pdf_library_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pdf_library_items TO authenticated;
GRANT ALL ON public.pdf_library_items TO service_role;
ALTER TABLE public.pdf_library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdf_library_items_read_auth" ON public.pdf_library_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "pdf_library_items_write_admin" ON public.pdf_library_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
