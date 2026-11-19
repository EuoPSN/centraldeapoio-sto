-- Segurança: impede que um usuário comum altere colunas sensíveis do próprio perfil.
-- Pode rodar mais de uma vez sem erro.
--
-- Problema: a política "Users update own profile" deixa qualquer usuário logado
-- fazer UPDATE na própria linha de public.profiles, em QUALQUER coluna. Com a anon
-- key pública dava para rodar, pelo navegador:
--   update profiles set is_active = true where id = auth.uid();
-- e pular a aprovação do admin, ou mexer em xp, xp_problemas, cargo,
-- nivel_lideranca, perfis_maturidade (ranking e painel P1–P4).
--
-- Correção: trigger BEFORE UPDATE com lista de colunas PERMITIDAS. Quando quem
-- faz o UPDATE é um usuário comum pela API (papel authenticated/anon) e não é
-- admin, qualquer mudança fora da lista é recusada. Colunas novas que forem
-- criadas no futuro ficam protegidas por padrão.
--
-- Continua funcionando:
--   * admins (política "Admins manage profiles"): podem alterar tudo;
--   * service role (supabaseAdmin no servidor): o trigger não se aplica;
--   * funções SECURITY DEFINER (ex.: set_theme_preference) e o SQL Editor:
--     rodam como o dono (postgres), o trigger não se aplica.

CREATE OR REPLACE FUNCTION public.profiles_guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Colunas que o próprio usuário pode alterar no seu perfil.
  allowed text[] := ARRAY[
    'display_name',
    'data_nascimento',
    'last_seen_at',
    'theme_preference',
    'updated_at'
  ];
  changed text[];
BEGIN
  -- Só vale para chamadas da API com o token do usuário (ou anônimas).
  -- service_role, postgres (SQL Editor) e funções SECURITY DEFINER passam direto.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(n.key ORDER BY n.key)
    INTO changed
    FROM jsonb_each(to_jsonb(NEW)) AS n
    JOIN jsonb_each(to_jsonb(OLD)) AS o USING (key)
   WHERE n.value IS DISTINCT FROM o.value
     AND NOT (n.key = ANY (allowed));

  IF changed IS NOT NULL THEN
    RAISE EXCEPTION 'Sem permissão para alterar: %', array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profiles_guard_protected_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS profiles_guard_protected_columns ON public.profiles;
CREATE TRIGGER profiles_guard_protected_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_protected_columns();
