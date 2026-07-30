
-- Tighten SELECT policies on public branding tables to authenticated only
DROP POLICY IF EXISTS settings_read_all ON public.app_settings;
CREATE POLICY settings_read_all ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS themes_read_all ON public.themes;
CREATE POLICY themes_read_all ON public.themes FOR SELECT TO authenticated USING (true);

-- funcionarios_metas: restrict role from public to authenticated
DROP POLICY IF EXISTS "Admins gerenciam metas" ON public.funcionarios_metas;
DROP POLICY IF EXISTS "Todos autenticados leem metas" ON public.funcionarios_metas;
CREATE POLICY "Admins gerenciam metas" ON public.funcionarios_metas
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Todos autenticados leem metas" ON public.funcionarios_metas
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- leads_funil: restrict role from public to authenticated
DROP POLICY IF EXISTS "Admins gerenciam leads funil" ON public.leads_funil;
DROP POLICY IF EXISTS "Todos autenticados leem leads funil" ON public.leads_funil;
CREATE POLICY "Admins gerenciam leads funil" ON public.leads_funil
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Todos autenticados leem leads funil" ON public.leads_funil
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- prospeccao_diaria: restrict role from public to authenticated
DROP POLICY IF EXISTS "Admins gerenciam prospecções" ON public.prospeccao_diaria;
DROP POLICY IF EXISTS "Todos autenticados leem prospecções" ON public.prospeccao_diaria;
CREATE POLICY "Admins gerenciam prospecções" ON public.prospeccao_diaria
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Todos autenticados leem prospecções" ON public.prospeccao_diaria
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Revoke anon table grants for the branding tables since anon can no longer SELECT
REVOKE SELECT ON public.app_settings FROM anon;
REVOKE SELECT ON public.themes FROM anon;
