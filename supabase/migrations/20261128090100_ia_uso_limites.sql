-- Fase A · bloco 3 · Cérebro da Omnia — 2/4: uso de IA e limites diários.
-- ia_uso não guarda conteúdo, só quem usou qual ferramenta e quando. Idempotente.

CREATE TABLE IF NOT EXISTS public.ia_uso (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  ferramenta TEXT NOT NULL
    CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ia_uso TO authenticated;
GRANT ALL ON public.ia_uso TO service_role;
ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_uso_insert_own" ON public.ia_uso;
CREATE POLICY "ia_uso_insert_own" ON public.ia_uso
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ia_uso_read" ON public.ia_uso;
CREATE POLICY "ia_uso_read" ON public.ia_uso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ia_uso_user_dia ON public.ia_uso(user_id, ferramenta, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_uso_data ON public.ia_uso(created_at DESC);

-- Limite diário por ferramenta (NULL = sem limite). Editável no Admin.
CREATE TABLE IF NOT EXISTS public.ia_limites (
  ferramenta TEXT PRIMARY KEY
    CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador')),
  limite_diario INT CHECK (limite_diario IS NULL OR limite_diario > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_limites TO authenticated;
GRANT ALL ON public.ia_limites TO service_role;
ALTER TABLE public.ia_limites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_limites_read" ON public.ia_limites;
CREATE POLICY "ia_limites_read" ON public.ia_limites FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ia_limites_write_admin" ON public.ia_limites;
CREATE POLICY "ia_limites_write_admin" ON public.ia_limites
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_ia_limites_updated ON public.ia_limites;
CREATE TRIGGER trg_ia_limites_updated
  BEFORE UPDATE ON public.ia_limites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ia_limites (ferramenta, limite_diario) VALUES
  ('copiloto', 30), ('raiox', 10),
  ('marciana', NULL), ('mensagem_cliente', NULL), ('cliente_disse', NULL), ('retomada', NULL), ('simulador', NULL)
ON CONFLICT (ferramenta) DO NOTHING;

-- Liberações extras do Admin para uma pessoa (soma ao limite diário até valido_ate).
CREATE TABLE IF NOT EXISTS public.ia_limites_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ferramenta TEXT NOT NULL
    CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador')),
  extra INT NOT NULL CHECK (extra > 0),
  valido_ate TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_limites_extra TO authenticated;
GRANT ALL ON public.ia_limites_extra TO service_role;
ALTER TABLE public.ia_limites_extra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ia_limites_extra_read" ON public.ia_limites_extra;
CREATE POLICY "ia_limites_extra_read" ON public.ia_limites_extra
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "ia_limites_extra_write_admin" ON public.ia_limites_extra;
CREATE POLICY "ia_limites_extra_write_admin" ON public.ia_limites_extra
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ia_limites_extra_user ON public.ia_limites_extra(user_id, ferramenta, valido_ate);
