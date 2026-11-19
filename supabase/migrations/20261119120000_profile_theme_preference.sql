-- OMNIA Apoio: preferência de tema (claro/escuro) por usuário.
-- Pode rodar mais de uma vez sem erro.
--
-- theme_preference: 'light', 'dark' ou 'system' (seguir o sistema).
-- NULL = a pessoa ainda não escolheu; o site mostra a pergunta no primeiro acesso.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_theme_preference_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_theme_preference_check
      CHECK (theme_preference IS NULL OR theme_preference IN ('light', 'dark', 'system'));
  END IF;
END $$;

-- O site grava a escolha por esta função, que só altera a coluna de tema
-- da própria pessoa (não depende da política geral de update de profiles).
CREATE OR REPLACE FUNCTION public.set_theme_preference(pref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pref IS NULL OR pref NOT IN ('light', 'dark', 'system') THEN
    RAISE EXCEPTION 'Preferência de tema inválida: %', pref;
  END IF;
  UPDATE public.profiles SET theme_preference = pref WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_theme_preference(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_theme_preference(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_theme_preference(text) TO authenticated;
