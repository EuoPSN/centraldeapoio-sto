-- MarcIAna §3: sugestões de pergunta mostradas na tela inicial do /assistente
-- (pílulas clicáveis). Editável no Admin, dentro da área de IA/MarcIAna.
CREATE TABLE public.marciana_sugestoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.marciana_sugestoes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marciana_sugestoes TO authenticated;
GRANT ALL ON public.marciana_sugestoes TO service_role;

ALTER TABLE public.marciana_sugestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marciana_sugestoes_read_auth" ON public.marciana_sugestoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "marciana_sugestoes_write_admin" ON public.marciana_sugestoes
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_marciana_sugestoes_updated
  BEFORE UPDATE ON public.marciana_sugestoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_marciana_sugestoes_ordem ON public.marciana_sugestoes(ordem);

-- 5 sugestões iniciais, conforme o prompt do redesign.
INSERT INTO public.marciana_sugestoes (texto, ordem) VALUES
  ('Qual a diferença do Prata para o Ouro?', 0),
  ('Quem pode ser dependente?', 1),
  ('Como funciona a carência?', 2),
  ('O que o Energia de TODOS oferece?', 3),
  ('Cliente negativado pode aderir?', 4);
