DROP POLICY IF EXISTS "Leitura publica de imagens de chat" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios podem enviar suas imagens de chat" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios podem deletar suas imagens de chat" ON storage.objects;
DROP POLICY IF EXISTS "kf read auth" ON storage.objects;
CREATE POLICY "kf admin select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'knowledge-files' AND private.has_role(auth.uid(), 'admin'::app_role));