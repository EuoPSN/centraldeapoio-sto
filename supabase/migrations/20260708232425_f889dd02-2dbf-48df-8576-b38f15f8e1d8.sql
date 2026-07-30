
DROP POLICY IF EXISTS "Authenticated can read client profiles" ON public.client_profiles;
DROP POLICY IF EXISTS "Todos autenticados leem metas" ON public.funcionarios_metas;
DROP POLICY IF EXISTS "Todos autenticados leem leads funil" ON public.leads_funil;
DROP POLICY IF EXISTS "Todos autenticados leem prospecções" ON public.prospeccao_diaria;
