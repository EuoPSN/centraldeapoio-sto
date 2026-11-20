# Bloco 2 · Retomar hoje — migrações em ordem

Rode no SQL editor do Lovable Cloud, uma de cada vez, nesta ordem. Todas são idempotentes.


## 1. `20261127090000_retomada_motivos_perda.sql`

```sql
-- Fase A · bloco 2 · "Retomar hoje" — 1/5: motivos de perda (lista editável no Admin).
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.motivos_perda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_perda TO authenticated;
GRANT ALL ON public.motivos_perda TO service_role;
ALTER TABLE public.motivos_perda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motivos_perda_read" ON public.motivos_perda;
CREATE POLICY "motivos_perda_read" ON public.motivos_perda
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "motivos_perda_write_admin" ON public.motivos_perda;
CREATE POLICY "motivos_perda_write_admin" ON public.motivos_perda
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_motivos_perda_updated ON public.motivos_perda;
CREATE TRIGGER trg_motivos_perda_updated
  BEFORE UPDATE ON public.motivos_perda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_motivos_perda_nome ON public.motivos_perda (lower(nome));

INSERT INTO public.motivos_perda (nome, ordem) VALUES
  ('Sem dinheiro agora', 10),
  ('Já tem outro cartão/plano', 20),
  ('Não vê necessidade', 30),
  ('Desconfiança', 40),
  ('Não respondeu mais', 50),
  ('Outro', 60)
ON CONFLICT (lower(nome)) DO NOTHING;
```


## 2. `20261127090100_retomada_cadencia.sql`

```sql
-- Fase A · bloco 2 · "Retomar hoje" — 2/5: mensagens da cadência (com versões),
-- bucket dos áudios de exemplo e base inicial em rascunho. Idempotente.

-- ------------------------------------------------------------
-- cadencia_mensagens: uma mensagem por (ponto de parada, etapa)
-- texto: template com {nome} {atendente} {plano} {dependentes} {usos} {observacao}
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadencia_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ponto_parada TEXT NOT NULL
    CHECK (ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento', 'follow_up')),
  etapa TEXT NOT NULL CHECK (etapa IN ('follow_up', 'd1', 'd2', 'd4', 'd7', 'd10')),
  codigo TEXT GENERATED ALWAYS AS (ponto_parada || '_' || etapa) STORED,
  canal TEXT NOT NULL DEFAULT 'texto' CHECK (canal IN ('texto', 'audio')),
  papel TEXT NOT NULL DEFAULT 'outro'
    CHECK (papel IN ('lembrete', 'beneficio', 'prova', 'audio', 'despedida', 'outro')),
  texto TEXT NOT NULL DEFAULT '',
  por_que TEXT NOT NULL DEFAULT '',
  audio_exemplo_url TEXT,
  versao INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
  publicada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ponto_parada, etapa)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadencia_mensagens TO authenticated;
GRANT ALL ON public.cadencia_mensagens TO service_role;
ALTER TABLE public.cadencia_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cadencia_mensagens_read" ON public.cadencia_mensagens;
CREATE POLICY "cadencia_mensagens_read" ON public.cadencia_mensagens
  FOR SELECT TO authenticated
  USING (status = 'publicada' OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "cadencia_mensagens_write_admin" ON public.cadencia_mensagens;
CREATE POLICY "cadencia_mensagens_write_admin" ON public.cadencia_mensagens
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- cadencia_mensagens_versoes: cópia de cada versão publicada que foi substituída
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadencia_mensagens_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES public.cadencia_mensagens(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  versao INT NOT NULL,
  ponto_parada TEXT NOT NULL,
  etapa TEXT NOT NULL,
  canal TEXT NOT NULL,
  papel TEXT NOT NULL,
  texto TEXT NOT NULL,
  por_que TEXT NOT NULL,
  audio_exemplo_url TEXT,
  publicada_em TIMESTAMPTZ,
  substituida_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, versao)
);

GRANT SELECT ON public.cadencia_mensagens_versoes TO authenticated;
GRANT ALL ON public.cadencia_mensagens_versoes TO service_role;
ALTER TABLE public.cadencia_mensagens_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cadencia_versoes_read_admin" ON public.cadencia_mensagens_versoes;
CREATE POLICY "cadencia_versoes_read_admin" ON public.cadencia_mensagens_versoes
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- Versionamento: ao editar uma mensagem JÁ publicada (conteúdo mudou), guarda a
-- versão antiga e incrementa `versao`. Rascunho -> publicada marca publicada_em.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cadencia_mensagens_versionar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF OLD.status = 'publicada' AND NEW.status = 'publicada'
     AND (OLD.texto IS DISTINCT FROM NEW.texto
       OR OLD.por_que IS DISTINCT FROM NEW.por_que
       OR OLD.canal IS DISTINCT FROM NEW.canal
       OR OLD.papel IS DISTINCT FROM NEW.papel
       OR OLD.audio_exemplo_url IS DISTINCT FROM NEW.audio_exemplo_url) THEN
    INSERT INTO public.cadencia_mensagens_versoes
      (mensagem_id, codigo, versao, ponto_parada, etapa, canal, papel, texto, por_que, audio_exemplo_url, publicada_em, substituida_em)
    VALUES
      (OLD.id, OLD.codigo, OLD.versao, OLD.ponto_parada, OLD.etapa, OLD.canal, OLD.papel, OLD.texto, OLD.por_que, OLD.audio_exemplo_url, OLD.publicada_em, now())
    ON CONFLICT (mensagem_id, versao) DO NOTHING;
    NEW.versao := OLD.versao + 1;
    NEW.publicada_em := now();
  ELSIF OLD.status <> 'publicada' AND NEW.status = 'publicada' THEN
    NEW.publicada_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cadencia_mensagens_versionar ON public.cadencia_mensagens;
CREATE TRIGGER trg_cadencia_mensagens_versionar
  BEFORE UPDATE ON public.cadencia_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.cadencia_mensagens_versionar();

CREATE INDEX IF NOT EXISTS idx_cadencia_mensagens_ponto ON public.cadencia_mensagens(ponto_parada, etapa);

-- ------------------------------------------------------------
-- Bucket dos áudios de exemplo (privado). Admin envia; qualquer usuário logado
-- ouve (via URL assinada). Não guarda dado de cliente.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('cadencia-audios', 'cadencia-audios', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ca read" ON storage.objects;
CREATE POLICY "ca read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cadencia-audios');
DROP POLICY IF EXISTS "ca admin insert" ON storage.objects;
CREATE POLICY "ca admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cadencia-audios' AND private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "ca admin update" ON storage.objects;
CREATE POLICY "ca admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cadencia-audios' AND private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "ca admin delete" ON storage.objects;
CREATE POLICY "ca admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cadencia-audios' AND private.has_role(auth.uid(), 'admin'::public.app_role));

-- ------------------------------------------------------------
-- Base inicial: a estrutura da cadência, tudo em RASCUNHO e com texto "[escrever]".
-- Nenhuma mensagem é inventada aqui: o Paulo escreve e publica no Admin.
-- ------------------------------------------------------------
INSERT INTO public.cadencia_mensagens (ponto_parada, etapa, canal, papel, texto, por_que, status)
SELECT p.ponto, e.etapa, e.canal, e.papel, '[escrever]', '', 'rascunho'
FROM (VALUES ('nao_respondeu_primeira'), ('parou_explicativa'), ('recebeu_proposta'), ('travou_fechamento')) AS p(ponto)
CROSS JOIN (VALUES
  ('d1',  'texto', 'lembrete'),
  ('d2',  'texto', 'beneficio'),
  ('d4',  'texto', 'prova'),
  ('d7',  'audio', 'audio'),
  ('d10', 'texto', 'despedida')
) AS e(etapa, canal, papel)
ON CONFLICT (ponto_parada, etapa) DO NOTHING;

INSERT INTO public.cadencia_mensagens (ponto_parada, etapa, canal, papel, texto, por_que, status)
VALUES ('follow_up', 'follow_up', 'texto', 'lembrete', '[escrever]', '', 'rascunho')
ON CONFLICT (ponto_parada, etapa) DO NOTHING;
```


## 3. `20261127090200_retomada_tickets.sql`

```sql
-- Fase A · bloco 2 · "Retomar hoje" — 3/5: tickets de retomada, proteção do telefone,
-- view do Admin (sem telefone) e limpeza. Idempotente.

CREATE SEQUENCE IF NOT EXISTS public.retomadas_codigo_seq START 1;

-- ------------------------------------------------------------
-- retomadas: um ticket por cliente em retomada.
-- telefone: só o próprio atendente lê (RLS por user_id, SEM cláusula de admin).
-- O Admin enxerga os tickets pela view retomadas_admin, que não tem a coluna.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retomadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE DEFAULT ('RT-' || lpad(nextval('public.retomadas_codigo_seq')::text, 4, '0')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  primeiro_nome TEXT NOT NULL DEFAULT '' CHECK (char_length(primeiro_nome) <= 40),
  telefone TEXT CHECK (telefone IS NULL OR char_length(telefone) <= 20),
  observacao TEXT NOT NULL DEFAULT '' CHECK (char_length(observacao) <= 500),
  ponto_parada TEXT NOT NULL
    CHECK (ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  ponto_parada_inicial TEXT NOT NULL
    CHECK (ponto_parada_inicial IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  subetapa_fechamento TEXT,
  fechamento_caso_id UUID REFERENCES public.fechamento_casos(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'fechamento', 'extensao')),
  status TEXT NOT NULL DEFAULT 'fila' CHECK (status IN ('fila', 'respondeu', 'fechou', 'perdido', 'esfriou')),
  etapa_atual TEXT NOT NULL DEFAULT 'd1' CHECK (etapa_atual IN ('follow_up', 'd1', 'd2', 'd4', 'd7', 'd10')),
  proxima_em TIMESTAMPTZ,
  -- Preenchido quando o D+10 é enviado: 2 dias depois sem resposta, vira "esfriou".
  d10_enviado_em TIMESTAMPTZ,
  motivo_perda TEXT,
  vezes_voltou INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retomadas TO authenticated;
GRANT ALL ON public.retomadas TO service_role;
ALTER TABLE public.retomadas ENABLE ROW LEVEL SECURITY;

-- Só o dono. Nem o admin lê esta tabela (o telefone mora aqui).
DROP POLICY IF EXISTS "retomadas_own" ON public.retomadas;
CREATE POLICY "retomadas_own" ON public.retomadas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_retomadas_updated ON public.retomadas;
CREATE TRIGGER trg_retomadas_updated
  BEFORE UPDATE ON public.retomadas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Apaga o telefone na hora em que o ticket sai de "fila"/"respondeu".
CREATE OR REPLACE FUNCTION public.retomadas_apagar_telefone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('fila', 'respondeu') THEN
    NEW.telefone := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retomadas_apagar_telefone ON public.retomadas;
CREATE TRIGGER trg_retomadas_apagar_telefone
  BEFORE INSERT OR UPDATE ON public.retomadas
  FOR EACH ROW EXECUTE FUNCTION public.retomadas_apagar_telefone();

CREATE INDEX IF NOT EXISTS idx_retomadas_user_status ON public.retomadas(user_id, status, proxima_em);
CREATE INDEX IF NOT EXISTS idx_retomadas_status_proxima ON public.retomadas(status, proxima_em);

-- ------------------------------------------------------------
-- View do Admin: todos os tickets, SEM telefone. Roda com os direitos do dono da
-- view (por isso enxerga as linhas de todos) mas só devolve algo para admin.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.retomadas_admin AS
SELECT
  r.id, r.codigo, r.user_id,
  COALESCE(NULLIF(p.display_name, ''), split_part(p.email, '@', 1)) AS atendente,
  r.primeiro_nome, r.observacao, r.ponto_parada, r.ponto_parada_inicial, r.subetapa_fechamento,
  r.fechamento_caso_id, r.origem, r.status, r.etapa_atual, r.proxima_em, r.d10_enviado_em,
  r.motivo_perda, r.vezes_voltou, r.created_at, r.updated_at
FROM public.retomadas r
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE private.has_role(auth.uid(), 'admin'::app_role);

REVOKE ALL ON public.retomadas_admin FROM PUBLIC, anon;
GRANT SELECT ON public.retomadas_admin TO authenticated;
GRANT ALL ON public.retomadas_admin TO service_role;
```


## 4. `20261127090300_retomada_eventos.sql`

```sql
-- Fase A · bloco 2 · "Retomar hoje" — 4/5: eventos da cadência e limpeza diária.
-- Idempotente.

-- ------------------------------------------------------------
-- retomada_eventos: uma linha por ação (copiou, enviei, respondeu…).
-- Não guarda telefone nem fala do cliente. O Admin lê tudo (só números/códigos).
-- prevista_em: quando a etapa deveria ser feita (para medir "feita no dia").
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retomada_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retomada_id UUID NOT NULL REFERENCES public.retomadas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  -- Ponto de parada do ticket no momento da ação (o ticket pode mudar de ponto ao voltar para a fila).
  ponto_parada TEXT CHECK (ponto_parada IS NULL OR ponto_parada IN ('nao_respondeu_primeira', 'parou_explicativa', 'recebeu_proposta', 'travou_fechamento')),
  etapa TEXT NOT NULL CHECK (etapa IN ('follow_up', 'd1', 'd2', 'd4', 'd7', 'd10')),
  acao TEXT NOT NULL CHECK (acao IN (
    'recomendada', 'copiou', 'enviei', 'respondeu', 'fechou', 'perdido',
    'voltou_fila', 'follow_up_agendado', 'esfriou'
  )),
  mensagem_id UUID REFERENCES public.cadencia_mensagens(id) ON DELETE SET NULL,
  mensagem_versao INT,
  usou_recomendada BOOLEAN,
  prevista_em TIMESTAMPTZ,
  detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.retomada_eventos TO authenticated;
GRANT ALL ON public.retomada_eventos TO service_role;
ALTER TABLE public.retomada_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retomada_eventos_insert_own" ON public.retomada_eventos;
CREATE POLICY "retomada_eventos_insert_own" ON public.retomada_eventos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.retomadas r WHERE r.id = retomada_id AND r.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "retomada_eventos_read" ON public.retomada_eventos;
CREATE POLICY "retomada_eventos_read" ON public.retomada_eventos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_retomada_eventos_retomada ON public.retomada_eventos(retomada_id, created_at);
CREATE INDEX IF NOT EXISTS idx_retomada_eventos_user ON public.retomada_eventos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retomada_eventos_data ON public.retomada_eventos(created_at DESC);

-- ------------------------------------------------------------
-- Limpeza diária:
--  1) D+10 enviado há mais de 2 dias, sem resposta -> status "esfriou" (+ evento);
--  2) telefone apagado 30 dias após created_at.
-- Chamada ao abrir /retomar e, se o pg_cron existir, todo dia às 03:27.
-- O gatilho do telefone apaga o número na mesma atualização do "esfriou".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_retomadas()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT := 0; k INT;
BEGIN
  WITH esfriados AS (
    UPDATE public.retomadas
       SET status = 'esfriou', proxima_em = NULL
     WHERE status = 'fila' AND d10_enviado_em IS NOT NULL AND d10_enviado_em < now() - interval '2 days'
    RETURNING id, user_id, etapa_atual, ponto_parada
  )
  INSERT INTO public.retomada_eventos (retomada_id, user_id, ponto_parada, etapa, acao)
  SELECT id, user_id, ponto_parada, etapa_atual, 'esfriou' FROM esfriados;
  GET DIAGNOSTICS k = ROW_COUNT;
  n := n + k;

  UPDATE public.retomadas SET telefone = NULL
   WHERE telefone IS NOT NULL AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS k = ROW_COUNT;
  n := n + k;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_retomadas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpar_retomadas() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('limpar_retomadas');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule('limpar_retomadas', '27 3 * * *', 'SELECT public.limpar_retomadas();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível: a limpeza roda ao abrir a página.';
END;
$$;
```


## 5. `20261127090400_retomada_admin_sections.sql`

```sql
-- Fase A · bloco 2 · "Retomar hoje" — 5/5: seções novas do Painel Admin
-- (grupo Atendimento, depois de Economia). Idempotente.
INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  ('cadencia',     'Cadência de retomada', 'Repeat2', 'Atendimento', 80, true),
  ('motivosperda', 'Motivos de perda',     'ListX',   'Atendimento', 90, true)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
```
