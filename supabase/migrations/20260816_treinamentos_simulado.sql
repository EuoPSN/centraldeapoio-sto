-- ============ Currículo de Treinamento ============
CREATE TABLE public.training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  pdf_path TEXT,      -- caminho no bucket "knowledge-files" (reaproveitado), prefixo "treinamento/"
  pdf_name TEXT,      -- nome original do arquivo, pra exibição
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_modules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.training_modules TO authenticated;
GRANT ALL ON public.training_modules TO service_role;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_modules_read_auth" ON public.training_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_modules_write_admin" ON public.training_modules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Vínculo do módulo com imagens já existentes na Biblioteca de Imagens
CREATE TABLE public.training_module_images (
  training_module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  image_library_item_id UUID NOT NULL REFERENCES public.image_library_items(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (training_module_id, image_library_item_id)
);

GRANT SELECT ON public.training_module_images TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.training_module_images TO authenticated;
GRANT ALL ON public.training_module_images TO service_role;
ALTER TABLE public.training_module_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_module_images_read_auth" ON public.training_module_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_module_images_write_admin" ON public.training_module_images FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ Simulado (Quiz) ============
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  training_module_id UUID REFERENCES public.training_modules(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quizzes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes_read_auth" ON public.quizzes FOR SELECT TO authenticated USING (true);
CREATE POLICY "quizzes_write_admin" ON public.quizzes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'multipla_escolha' CHECK (tipo IN ('multipla_escolha', 'aberta')),
  pergunta TEXT NOT NULL,
  resposta_esperada TEXT,  -- só usado quando tipo = 'aberta' (a IA compara a resposta do atendente com isso)
  position INT NOT NULL DEFAULT 0
);

GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_questions_read_auth" ON public.quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "quiz_questions_write_admin" ON public.quiz_questions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0
);

GRANT SELECT ON public.quiz_options TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quiz_options TO authenticated;
GRANT ALL ON public.quiz_options TO service_role;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_options_read_auth" ON public.quiz_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "quiz_options_write_admin" ON public.quiz_options FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Resultado de cada simulado feito por um atendente (sem nenhum vínculo com funcionarios/P1-P4)
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  respostas JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_attempts_read_own_or_admin" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "quiz_attempts_insert_own" ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "quiz_attempts_delete_admin" ON public.quiz_attempts FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
