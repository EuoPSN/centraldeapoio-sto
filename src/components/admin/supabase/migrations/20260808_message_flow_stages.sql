-- Etapas do Fluxo de Atendimento (separado das Categorias/Subcategorias das mensagens)
CREATE TABLE public.message_flow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.message_flow_stages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.message_flow_stages TO authenticated;
GRANT ALL ON public.message_flow_stages TO service_role;

ALTER TABLE public.message_flow_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_flow_stages_read_auth" ON public.message_flow_stages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "message_flow_stages_write_admin" ON public.message_flow_stages
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Cada mensagem pode (opcionalmente) pertencer a uma etapa do fluxo, além da sua Categoria normal
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS flow_stage_id UUID REFERENCES public.message_flow_stages(id) ON DELETE SET NULL;

INSERT INTO public.message_flow_stages (name, position) VALUES
  ('Apresentação', 0),
  ('Documentos', 10),
  ('Pagamento', 20),
  ('Fidelidade', 30),
  ('Fechamento', 40);
