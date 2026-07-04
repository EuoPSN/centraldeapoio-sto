
DROP POLICY IF EXISTS "Admin edita tudo" ON public.relatorio_prospeccao;
DROP POLICY IF EXISTS "Admin ve tudo" ON public.relatorio_prospeccao;
DROP POLICY IF EXISTS "Funcionario edita somente hoje" ON public.relatorio_prospeccao;
DROP POLICY IF EXISTS "Funcionario insere proprios dados" ON public.relatorio_prospeccao;
DROP POLICY IF EXISTS "Funcionario ve proprios dados" ON public.relatorio_prospeccao;

CREATE POLICY "Admin edita tudo" ON public.relatorio_prospeccao
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Admin ve tudo" ON public.relatorio_prospeccao
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Funcionario ve proprios dados" ON public.relatorio_prospeccao
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Funcionario insere proprios dados" ON public.relatorio_prospeccao
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND data = CURRENT_DATE);

CREATE POLICY "Funcionario edita somente hoje" ON public.relatorio_prospeccao
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND data = CURRENT_DATE)
  WITH CHECK (auth.uid() = user_id AND data = CURRENT_DATE);

CREATE POLICY "Funcionario deleta somente hoje" ON public.relatorio_prospeccao
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND data = CURRENT_DATE);
