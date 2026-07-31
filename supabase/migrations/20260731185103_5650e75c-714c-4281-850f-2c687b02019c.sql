CREATE TABLE IF NOT EXISTS public.client_profile_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  description text,
  example_lines text,
  advance_criteria text,
  attachment_url text,
  attachment_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_profile_states TO authenticated;
GRANT ALL ON public.client_profile_states TO service_role;
ALTER TABLE public.client_profile_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cps read auth" ON public.client_profile_states FOR SELECT TO authenticated USING (true);
CREATE POLICY "cps admin write" ON public.client_profile_states FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_client_profile_states BEFORE UPDATE ON public.client_profile_states
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();