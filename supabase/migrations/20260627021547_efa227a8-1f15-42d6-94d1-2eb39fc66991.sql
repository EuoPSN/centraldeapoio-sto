
CREATE POLICY "kf read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-files');
CREATE POLICY "kf admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-files' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "kf admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'knowledge-files' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "kf admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-files' AND public.has_role(auth.uid(),'admin'));
