-- Bloco 2: Exames (Laboratoriais e de Imagem)
CREATE TABLE public.exames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'laboratorial' CHECK (tipo IN ('laboratorial', 'imagem')),
  categoria TEXT,
  material TEXT,
  jejum BOOLEAN NOT NULL DEFAULT false,
  preparo TEXT,
  descricao TEXT,
  observacoes TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exames TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exames TO authenticated;
GRANT ALL ON public.exames TO service_role;
ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exames_read_auth" ON public.exames FOR SELECT TO authenticated USING (true);
CREATE POLICY "exames_write_admin" ON public.exames FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Em quais Unidades cada exame é realizado
CREATE TABLE public.exame_unidades (
  exame_id UUID NOT NULL REFERENCES public.exames(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  PRIMARY KEY (exame_id, unidade_id)
);

GRANT SELECT ON public.exame_unidades TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exame_unidades TO authenticated;
GRANT ALL ON public.exame_unidades TO service_role;
ALTER TABLE public.exame_unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exame_unidades_read_auth" ON public.exame_unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "exame_unidades_write_admin" ON public.exame_unidades FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Bloco 3: Procedimentos Odontológicos
CREATE TABLE public.procedimentos_odontologicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT,
  descricao TEXT,
  cuidados_pos TEXT,
  observacoes TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.procedimentos_odontologicos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.procedimentos_odontologicos TO authenticated;
GRANT ALL ON public.procedimentos_odontologicos TO service_role;
ALTER TABLE public.procedimentos_odontologicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "procedimentos_odontologicos_read_auth" ON public.procedimentos_odontologicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "procedimentos_odontologicos_write_admin" ON public.procedimentos_odontologicos FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Em quais Unidades cada procedimento é realizado
CREATE TABLE public.procedimento_unidades (
  procedimento_id UUID NOT NULL REFERENCES public.procedimentos_odontologicos(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  PRIMARY KEY (procedimento_id, unidade_id)
);

GRANT SELECT ON public.procedimento_unidades TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.procedimento_unidades TO authenticated;
GRANT ALL ON public.procedimento_unidades TO service_role;
ALTER TABLE public.procedimento_unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "procedimento_unidades_read_auth" ON public.procedimento_unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "procedimento_unidades_write_admin" ON public.procedimento_unidades FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
