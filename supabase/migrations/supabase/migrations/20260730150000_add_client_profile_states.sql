-- ============ Jornada do cliente (funil por estados) ============
-- Cada perfil de cliente pode ter uma sequência de estados (ex: Desconfiado →
-- Interessado → Convencido → Cadastro → Fechamento). Totalmente customizável
-- por perfil: o admin cria, edita, reordena e remove estados livremente.

CREATE TABLE public.client_profile_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  description TEXT,
  example_lines TEXT,
  advance_criteria TEXT,
  attachment_url TEXT,
  attachment_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX client_profile_states_profile_idx ON public.client_profile_states(profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_profile_states TO authenticated;
GRANT ALL ON public.client_profile_states TO service_role;
ALTER TABLE public.client_profile_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cps_read_auth" ON public.client_profile_states FOR SELECT TO authenticated USING (true);
CREATE POLICY "cps_write_admin" ON public.client_profile_states FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_client_profile_states_updated BEFORE UPDATE ON public.client_profile_states
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
