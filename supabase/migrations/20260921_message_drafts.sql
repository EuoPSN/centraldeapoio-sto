CREATE TABLE public.message_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  nota_interna TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  revisado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_em TIMESTAMPTZ,
  nota_revisao TEXT,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_drafts TO authenticated;
GRANT ALL ON public.message_drafts TO service_role;
ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER message_drafts_updated BEFORE UPDATE ON public.message_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_message_drafts_status ON public.message_drafts(status);
CREATE INDEX idx_message_drafts_criado_por ON public.message_drafts(criado_por);

-- Qualquer funcionário só vê os próprios rascunhos (em qualquer status); admin vê todos.
CREATE POLICY "Read own drafts or admin" ON public.message_drafts
  FOR SELECT TO authenticated
  USING (criado_por = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Create own drafts" ON public.message_drafts
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

-- Autor só edita/exclui enquanto ainda estiver pendente; depois de revisado, fica travado pra ele.
CREATE POLICY "Update own pending draft" ON public.message_drafts
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() AND status = 'pendente')
  WITH CHECK (criado_por = auth.uid());
CREATE POLICY "Admin updates any draft" ON public.message_drafts
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Delete own pending draft" ON public.message_drafts
  FOR DELETE TO authenticated
  USING (criado_por = auth.uid() AND status = 'pendente');
CREATE POLICY "Admin deletes any draft" ON public.message_drafts
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('scriptreview', 'Análise de Scripts', 'ListChecks', 'Conteúdo & IA', 15)
ON CONFLICT (tab_key) DO NOTHING;
