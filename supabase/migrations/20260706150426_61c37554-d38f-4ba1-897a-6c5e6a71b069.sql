GRANT DELETE ON public.simulator_results TO authenticated;

DROP POLICY IF EXISTS "Admins delete simulator results" ON public.simulator_results;
CREATE POLICY "Admins delete simulator results"
  ON public.simulator_results FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));