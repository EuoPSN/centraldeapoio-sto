-- Fase A · bloco 1 · "O cliente disse…" — 1/5: objeções e fila de objeções novas.
-- Idempotente: pode rodar de novo sem duplicar nada.

-- ------------------------------------------------------------
-- objecoes: respostas aprovadas pelo Paulo
-- leituras: [{titulo, pergunta}]
-- angulos:  [{tipo: logico|emocional|prova, rotulo, texto}]
-- prioridade: menor trata primeiro quando vierem várias juntas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objecoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  exemplos_de_fala TEXT[] NOT NULL DEFAULT '{}',
  leituras JSONB NOT NULL DEFAULT '[]'::jsonb,
  angulos JSONB NOT NULL DEFAULT '[]'::jsonb,
  pergunta_avancar TEXT,
  evite_dizer TEXT,
  prioridade INT NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objecoes TO authenticated;
GRANT ALL ON public.objecoes TO service_role;
ALTER TABLE public.objecoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "objecoes_read" ON public.objecoes;
CREATE POLICY "objecoes_read" ON public.objecoes
  FOR SELECT TO authenticated
  USING (status = 'publicada' OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "objecoes_write_admin" ON public.objecoes;
CREATE POLICY "objecoes_write_admin" ON public.objecoes
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_objecoes_updated ON public.objecoes;
CREATE TRIGGER trg_objecoes_updated
  BEFORE UPDATE ON public.objecoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_objecoes_status ON public.objecoes(status, prioridade);

-- ------------------------------------------------------------
-- objecoes_pendentes: falas sem resposta aprovada, agrupadas por semelhança
-- sugestao_ia: mesmo formato de uma objeção
-- respostas_atendentes: [{user_id, texto, created_at}]
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objecoes_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fala_exemplo TEXT NOT NULL,
  falas_parecidas TEXT[] NOT NULL DEFAULT '{}',
  ocorrencias INT NOT NULL DEFAULT 1,
  ultima_ocorrencia TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Data de cada ocorrência (para contar "N esta semana" na fila do Admin).
  ocorrencias_em TIMESTAMPTZ[] NOT NULL DEFAULT ARRAY[now()],
  sugestao_ia JSONB,
  respostas_atendentes JSONB NOT NULL DEFAULT '[]'::jsonb,
  sugerida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')),
  objecao_id UUID REFERENCES public.objecoes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atendentes não leem a fila: o registro é feito pelo servidor (service role)
-- depois de conferir o login. Só admin lê e edita direto.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objecoes_pendentes TO authenticated;
GRANT ALL ON public.objecoes_pendentes TO service_role;
ALTER TABLE public.objecoes_pendentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "objecoes_pendentes_admin" ON public.objecoes_pendentes;
CREATE POLICY "objecoes_pendentes_admin" ON public.objecoes_pendentes
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_objecoes_pendentes_status ON public.objecoes_pendentes(status, ultima_ocorrencia DESC);
