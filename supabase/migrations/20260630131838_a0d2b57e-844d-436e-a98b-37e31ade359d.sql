
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.simulator_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID,
  profile_name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  nota INTEGER NOT NULL,
  resumo TEXT,
  pontos_fortes TEXT[] NOT NULL DEFAULT '{}',
  pontos_melhoria TEXT[] NOT NULL DEFAULT '{}',
  erros TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.simulator_results TO authenticated;
GRANT ALL ON public.simulator_results TO service_role;

ALTER TABLE public.simulator_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own simulator results" ON public.simulator_results;
CREATE POLICY "Users view own simulator results"
  ON public.simulator_results FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users insert own simulator results" ON public.simulator_results;
CREATE POLICY "Users insert own simulator results"
  ON public.simulator_results FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulator_results_user_id_fkey') THEN
    ALTER TABLE public.simulator_results
      ADD CONSTRAINT simulator_results_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS simulator_results_user_id_idx ON public.simulator_results(user_id);
