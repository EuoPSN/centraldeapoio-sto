
-- Mover pgvector para schema dedicado (boa prática)
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role, anon;

-- Restringir execução das funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.match_knowledge(extensions.vector, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge(extensions.vector, int) TO authenticated, service_role;
