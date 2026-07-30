
-- 1) ai_settings: admin-only SELECT
DROP POLICY IF EXISTS "Authenticated read AI settings" ON public.ai_settings;
CREATE POLICY "Admins read AI settings" ON public.ai_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) profiles: own profile or admin
DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 3) Restrict SECURITY DEFINER functions from being callable by signed-in users
REVOKE EXECUTE ON FUNCTION public.match_knowledge(extensions.vector, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge(extensions.vector, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
