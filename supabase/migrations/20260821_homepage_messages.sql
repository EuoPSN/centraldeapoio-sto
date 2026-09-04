-- Data de nascimento do usuário (usada pra detectar aniversário)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Mensagens editáveis da tela inicial (padrão / data especial / aniversário)
CREATE TABLE public.homepage_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  cor_fundo TEXT NOT NULL DEFAULT '#F1F5F9',
  fonte TEXT NOT NULL DEFAULT 'padrao' CHECK (fonte IN ('padrao', 'arredondada', 'elegante', 'festiva')),
  tipo TEXT NOT NULL DEFAULT 'padrao' CHECK (tipo IN ('padrao', 'data_especial', 'aniversario')),
  data_inicio TEXT, -- formato "MM-DD", só usado quando tipo = 'data_especial' (ex: "12-20" pro Natal)
  data_fim TEXT,    -- formato "MM-DD", só usado quando tipo = 'data_especial'
  ativo BOOLEAN NOT NULL DEFAULT true,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.homepage_messages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homepage_messages TO authenticated;
GRANT ALL ON public.homepage_messages TO service_role;
ALTER TABLE public.homepage_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homepage_messages_read_auth" ON public.homepage_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "homepage_messages_write_admin" ON public.homepage_messages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Nova aba no Painel Admin
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position) VALUES
  ('homemsg', 'Tela Inicial', 'LayoutDashboard', 'Sistema', 60)
ON CONFLICT (tab_key) DO NOTHING;

-- Semeia a mensagem que já está no ar, pra não ficar sem nada assim que a tabela é criada
INSERT INTO public.homepage_messages (titulo, subtitulo, cor_fundo, fonte, tipo, position) VALUES
  ('Tudo o que você precisa, num só lugar', 'Scripts, simulados e informações de atendimento pra sua equipe.', '#F1F5F9', 'padrao', 'padrao', 0);
