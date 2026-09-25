ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_scope_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_scope_check
  CHECK (scope IN ('message', 'flow', 'suggestion', 'content', 'client_profile', 'problema', 'image_library', 'pdf_library', 'knowledge_product'));

INSERT INTO public.categories (scope, name, slug, position) VALUES
  ('knowledge_product', 'Conteúdo CDT', 'conteudo-cdt', 0),
  ('knowledge_product', 'Conteúdo Refuturiza', 'conteudo-refuturiza', 10),
  ('knowledge_product', 'Conteúdo Energia de Todos', 'conteudo-energia-de-todos', 20),
  ('knowledge_product', 'Conteúdo Clínica', 'conteudo-clinica', 30),
  ('knowledge_product', 'Conteúdos Extras', 'conteudos-extras', 40);
