
DROP POLICY IF EXISTS "chat-images public read" ON storage.objects;
DROP POLICY IF EXISTS "chat-images read" ON storage.objects;
DROP POLICY IF EXISTS "chat-images select" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read chat images" ON storage.objects;
DROP POLICY IF EXISTS "chat-images owner select" ON storage.objects;
DROP POLICY IF EXISTS "chat-images owner insert" ON storage.objects;
DROP POLICY IF EXISTS "chat-images owner update" ON storage.objects;
DROP POLICY IF EXISTS "chat-images owner delete" ON storage.objects;

CREATE POLICY "chat-images owner select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    auth.uid()::text = split_part(name, '/', 1)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "chat-images owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "chat-images owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat-images'
  AND auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "chat-images owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    auth.uid()::text = split_part(name, '/', 1)
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
