CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'binario' CHECK (tipo IN ('binario', 'meta')),
  meta_padrao INTEGER,
  position INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER checklist_items_updated BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated read checklist items" ON public.checklist_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write checklist items" ON public.checklist_items
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Um registro por (item, funcionário, dia). "Dia" é sempre calculado no fuso de
-- Brasília no servidor (Intl com timeZone explícito), nunca no relógio do navegador.
-- Cada dia vira uma linha nova — nada é "resetado" à meia-noite, o histórico fica gravado.
CREATE TABLE public.checklist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  marcado BOOLEAN NOT NULL DEFAULT false,
  valor INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_entries TO authenticated;
GRANT ALL ON public.checklist_entries TO service_role;
ALTER TABLE public.checklist_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER checklist_entries_updated BEFORE UPDATE ON public.checklist_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_checklist_entries_user_dia ON public.checklist_entries(user_id, dia);
CREATE INDEX idx_checklist_entries_dia ON public.checklist_entries(dia);

-- Funcionário só vê/edita as próprias marcações; admin vê todo mundo.
CREATE POLICY "Read own checklist entries or admin" ON public.checklist_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Insert own checklist entries" ON public.checklist_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own checklist entries" ON public.checklist_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

INSERT INTO public.checklist_items (titulo, tipo, meta_padrao, position) VALUES
  ('Preencher o controle de prospecções', 'binario', NULL, 0),
  ('Verificar e acompanhar o CRM', 'binario', NULL, 10),
  ('Acompanhar o KYC das vendas concluídas', 'binario', NULL, 20),
  ('Acompanhar a homologação dos clientes', 'binario', NULL, 30),
  ('Realizar o Follow-Up dos clientes estagnados', 'binario', NULL, 40),
  ('Realizar a meta diária de prospecções', 'meta', 100, 50);

INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('checklist', 'Check-list Diário', 'ListChecks', 'Pessoas', 20)
ON CONFLICT (tab_key) DO NOTHING;
