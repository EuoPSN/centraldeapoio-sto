
-- Extensão pgvector para embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'funcionario');
CREATE TYPE public.content_section AS ENUM ('conhecimento', 'problemas', 'tutoriais');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============================================================
-- TRIGGER: criar profile + role no signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );

  IF lower(NEW.email) = 'paulops2005samuel@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'funcionario');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS profiles / user_roles
-- ============================================================
CREATE POLICY "Authenticated read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- CONTENT ITEMS (Conhecimento, Problemas Técnicos, Tutoriais)
-- ============================================================
CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section content_section NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;
GRANT ALL ON public.content_items TO service_role;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX content_items_section_idx ON public.content_items(section, position);
CREATE TRIGGER content_items_updated BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated read content" ON public.content_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write content" ON public.content_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- SCRIPTS
-- ============================================================
CREATE TABLE public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  usage_note TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE INDEX scripts_category_idx ON public.scripts(category, position);
CREATE TRIGGER scripts_updated BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated read scripts" ON public.scripts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write scripts" ON public.scripts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- PRICING
-- ============================================================
CREATE TABLE public.pricing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty TEXT NOT NULL,
  cartao_price NUMERIC(10,2),
  particular_price NUMERIC(10,2),
  category TEXT NOT NULL DEFAULT 'consulta',
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_items TO authenticated;
GRANT ALL ON public.pricing_items TO service_role;
ALTER TABLE public.pricing_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX pricing_items_category_idx ON public.pricing_items(category, position);
CREATE TRIGGER pricing_items_updated BEFORE UPDATE ON public.pricing_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated read pricing" ON public.pricing_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write pricing" ON public.pricing_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- RAG: knowledge_chunks (1536-dim para suporte a HNSW)
-- ============================================================
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE INDEX knowledge_chunks_embedding_idx ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX knowledge_chunks_source_idx ON public.knowledge_chunks(source_type, source_id);

CREATE POLICY "Authenticated read chunks" ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(1536),
  match_count int DEFAULT 8
) RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity float
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    k.id, k.source_type, k.source_id, k.title, k.content, k.metadata,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks k
  WHERE k.embedding IS NOT NULL
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- CHAT
-- ============================================================
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX chat_conversations_user_idx ON public.chat_conversations(user_id, updated_at DESC);
CREATE TRIGGER chat_conversations_updated BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users see own conversations" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own conversations" ON public.chat_conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own conversations" ON public.chat_conversations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own conversations" ON public.chat_conversations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX chat_messages_conv_idx ON public.chat_messages(conversation_id, created_at);

CREATE POLICY "Read messages of own conversations" ON public.chat_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "Insert messages in own conversations" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "Delete messages of own conversations" ON public.chat_messages
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- ============================================================
-- AI SETTINGS (singleton)
-- ============================================================
CREATE TABLE public.ai_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ai_settings_updated BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated read AI settings" ON public.ai_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write AI settings" ON public.ai_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.ai_settings (id, system_prompt) VALUES (
  1,
  E'Você é o Assistente IA do Cartão de Todos, criado para apoiar os atendentes durante os atendimentos ao cliente.\n\nDIRETRIZES:\n- Sempre responda em português do Brasil, com tom profissional, claro, objetivo e acolhedor.\n- Baseie suas respostas EXCLUSIVAMENTE no conteúdo fornecido como contexto (Conhecimento Geral, Scripts, Tabela de Preços, Problemas Técnicos e Tutoriais).\n- NUNCA invente preços, regras, procedimentos ou informações que não estejam no contexto. Se a informação não estiver disponível, oriente o atendente a procurar o supervisor.\n- Quando citar um script, retorne o texto exato dentro de um bloco de código (```), para que o atendente possa copiar e colar diretamente.\n- Use formatação markdown: **negrito** para destaques, listas, e blocos de código para scripts.\n- Seja direto: vá ao ponto, sem rodeios. O atendente está atendendo o cliente em tempo real.\n- Se a pergunta for ambígua, peça esclarecimento em uma frase curta.'
);

-- ============================================================
-- ACCESS LOGS (estatísticas)
-- ============================================================
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX access_logs_created_idx ON public.access_logs(created_at DESC);

CREATE POLICY "Users insert own logs" ON public.access_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read logs" ON public.access_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
