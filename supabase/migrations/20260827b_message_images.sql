-- ============ Imagem acoplada a uma mensagem (Iniciativa #2 do roadmap de conteúdo) ============
-- Uma mensagem pode ter no máximo 1 imagem (ex: foto do Hemograma de Centro de Neves
-- junto do texto sobre esse exame nessa unidade) — por isso é só um campo novo em
-- public.messages, não uma tabela de anexos.
-- Segue exatamente o padrão já usado pelo bucket knowledge-files: bucket privado,
-- só admin lê/escreve via storage API, e a imagem é servida a qualquer usuário
-- autenticado através de um proxy assinado (rota /api/public/message-image),
-- pra não depender de chamada direta ao domínio do Supabase.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('message-images', 'message-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mi admin select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "mi admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "mi admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'message-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "mi admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'message-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
