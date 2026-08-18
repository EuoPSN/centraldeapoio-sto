-- Uma mensagem agora pode pertencer a VÁRIAS etapas de fluxo ao mesmo tempo
-- (ex: /Olá pode estar no fluxo de Filiação E no de Refiliação).
CREATE TABLE public.message_flow_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  flow_stage_id UUID NOT NULL REFERENCES public.message_flow_stages(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, flow_stage_id)
);

GRANT SELECT ON public.message_flow_links TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.message_flow_links TO authenticated;
GRANT ALL ON public.message_flow_links TO service_role;

ALTER TABLE public.message_flow_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_flow_links_read_auth" ON public.message_flow_links
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "message_flow_links_write_admin" ON public.message_flow_links
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Migra os vínculos que você já organizou (mensagem -> 1 etapa) para o novo formato
INSERT INTO public.message_flow_links (message_id, flow_stage_id, position)
SELECT id, flow_stage_id, position FROM public.messages WHERE flow_stage_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- A coluna antiga não é mais usada (mensagens podem estar em várias etapas agora)
ALTER TABLE public.messages DROP COLUMN IF EXISTS flow_stage_id;
