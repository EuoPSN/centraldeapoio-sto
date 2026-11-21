# Extensão 1 · migrações em ordem

Rode no SQL editor do Lovable Cloud, uma de cada vez, nesta ordem. Todas são idempotentes. Pré-requisito: Fase A e Fase B já aplicadas.

## 1. `20261202090000_extensao_ferramenta_ia.sql`

```sql
-- Fase C · extensão 1 — 1/4: ferramenta "extensao" nos limites de IA e no Cérebro. Idempotente.
-- Limite padrão: 60 leituras por atendente por dia (admin não tem limite). Editável no Admin.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tabela, c.conname
      FROM pg_constraint c
     WHERE c.contype = 'c'
       AND c.conrelid IN ('public.ia_uso'::regclass, 'public.ia_limites'::regclass,
                          'public.ia_limites_extra'::regclass, 'public.cerebro_blocos'::regclass)
       AND pg_get_constraintdef(c.oid) ILIKE '%simulador%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabela, r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.ia_uso ADD CONSTRAINT ia_uso_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca','aquecimento','extensao'));
ALTER TABLE public.ia_limites ADD CONSTRAINT ia_limites_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca','aquecimento','extensao'));
ALTER TABLE public.ia_limites_extra ADD CONSTRAINT ia_limites_extra_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca','aquecimento','extensao'));
ALTER TABLE public.cerebro_blocos ADD CONSTRAINT cerebro_blocos_ferramentas_check
  CHECK (ferramentas <@ ARRAY['marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca','aquecimento','extensao']::text[]);

INSERT INTO public.ia_limites (ferramenta, limite_diario) VALUES ('extensao', 60)
ON CONFLICT (ferramenta) DO NOTHING;

-- Matriz "Quem usa o quê": a extensão entra ligada em Playbook CDT, Etapas do funil,
-- Padrão de escrita e Mudanças recentes. (As Regras fixas valem para todas as ferramentas.)
UPDATE public.cerebro_blocos
   SET ferramentas = array_append(ferramentas, 'extensao')
 WHERE chave IN ('playbook_cdt', 'etapas_funil', 'padrao_escrita', 'mudancas_recentes')
   AND NOT ('extensao' = ANY (ferramentas));
```

## 2. `20261202090100_extensao_tickets.sql`

```sql
-- Fase C · extensão 1 — 2/4: campos novos do ticket (etapa do funil, plano, dependentes),
-- histórico do ticket e busca de número em tickets de OUTRO atendente (só devolve sim/não). Idempotente.

-- ------------------------------------------------------------
-- Campos novos em retomadas (continua só do dono: a política retomadas_own não muda).
-- ------------------------------------------------------------
ALTER TABLE public.retomadas ADD COLUMN IF NOT EXISTS etapa_funil TEXT;
ALTER TABLE public.retomadas ADD COLUMN IF NOT EXISTS plano TEXT;
ALTER TABLE public.retomadas ADD COLUMN IF NOT EXISTS dependentes INT;

ALTER TABLE public.retomadas DROP CONSTRAINT IF EXISTS retomadas_etapa_funil_check;
ALTER TABLE public.retomadas ADD CONSTRAINT retomadas_etapa_funil_check
  CHECK (etapa_funil IS NULL OR etapa_funil IN ('novo_lead','lead_qualificado','proposta_enviada','fechamento','venda_concluida'));
ALTER TABLE public.retomadas DROP CONSTRAINT IF EXISTS retomadas_plano_check;
ALTER TABLE public.retomadas ADD CONSTRAINT retomadas_plano_check
  CHECK (plano IS NULL OR plano IN ('Prata','Ouro','Diamante'));
ALTER TABLE public.retomadas DROP CONSTRAINT IF EXISTS retomadas_dependentes_check;
ALTER TABLE public.retomadas ADD CONSTRAINT retomadas_dependentes_check
  CHECK (dependentes IS NULL OR dependentes BETWEEN 0 AND 20);

-- View do Admin: continua SEM telefone; ganha só os campos novos (no fim, para o CREATE OR REPLACE valer).
CREATE OR REPLACE VIEW public.retomadas_admin AS
SELECT
  r.id, r.codigo, r.user_id,
  COALESCE(NULLIF(p.display_name, ''), split_part(p.email, '@', 1)) AS atendente,
  r.primeiro_nome, r.observacao, r.ponto_parada, r.ponto_parada_inicial, r.subetapa_fechamento,
  r.fechamento_caso_id, r.origem, r.status, r.etapa_atual, r.proxima_em, r.d10_enviado_em,
  r.motivo_perda, r.vezes_voltou, r.created_at, r.updated_at,
  r.etapa_funil, r.plano, r.dependentes
FROM public.retomadas r
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE private.has_role(auth.uid(), 'admin'::app_role);

REVOKE ALL ON public.retomadas_admin FROM PUBLIC, anon;
GRANT SELECT ON public.retomadas_admin TO authenticated;
GRANT ALL ON public.retomadas_admin TO service_role;

-- ------------------------------------------------------------
-- ticket_historico: uma linha por campo que mudou. O dono lê e insere; o Admin NÃO lê
-- o conteúdo (só contagens, via função própria no prompt 2). Apaga junto com o ticket.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.retomadas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  campo TEXT NOT NULL CHECK (campo IN ('ticket','etapa_funil','ponto_parada','plano','dependentes','observacao','retomar','status')),
  valor_anterior TEXT CHECK (valor_anterior IS NULL OR char_length(valor_anterior) <= 600),
  valor_novo TEXT CHECK (valor_novo IS NULL OR char_length(valor_novo) <= 600),
  origem TEXT NOT NULL CHECK (origem IN ('extensao','omnia')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ticket_historico TO authenticated;
GRANT ALL ON public.ticket_historico TO service_role;
ALTER TABLE public.ticket_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_historico_read_own" ON public.ticket_historico;
CREATE POLICY "ticket_historico_read_own" ON public.ticket_historico
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ticket_historico_insert_own" ON public.ticket_historico;
CREATE POLICY "ticket_historico_insert_own" ON public.ticket_historico
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.retomadas r WHERE r.id = ticket_id AND r.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_ticket_historico_ticket ON public.ticket_historico(ticket_id, created_at DESC);

-- ------------------------------------------------------------
-- Chave de comparação de telefone: DDD (se houver) + últimos 8 dígitos; ignora o 55 e o 9 inicial.
-- Igual à função chaveNumero do app e da extensão.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chave_telefone(_tel TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(d) < 8 THEN ''
    WHEN length(d) >= 10 THEN left(d, 2) || right(d, 8)
    ELSE right(d, 8)
  END
  FROM (
    SELECT CASE
      WHEN length(x) IN (12, 13) AND left(x, 2) = '55' THEN substr(x, 3)
      ELSE x
    END AS d
    FROM (SELECT regexp_replace(coalesce(_tel, ''), '\D', '', 'g') AS x) t
  ) u;
$$;

-- ------------------------------------------------------------
-- Este número já está com OUTRO atendente (ticket aberto)? Devolve só sim/não:
-- nunca quem, nem nada do ticket.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.numero_com_outro_atendente(_chave TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND length(coalesce(_chave, '')) >= 8 AND EXISTS (
    SELECT 1 FROM public.retomadas r
     WHERE r.user_id <> auth.uid()
       AND r.status IN ('fila', 'respondeu')
       AND r.telefone IS NOT NULL
       AND (
         public.chave_telefone(r.telefone) = _chave
         OR (length(public.chave_telefone(r.telefone)) <> length(_chave)
             AND right(public.chave_telefone(r.telefone), 8) = right(_chave, 8))
       )
  );
$$;

REVOKE ALL ON FUNCTION public.numero_com_outro_atendente(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_com_outro_atendente(TEXT) TO authenticated, service_role;
```

## 3. `20261202090200_extensao_controles.sql`

```sql
-- Fase C · extensão 1 — 3/4: contatos ignorados, aceite do aviso e eventos de uso da extensão.
-- Nenhuma destas tabelas guarda conteúdo de conversa, nome ou número em claro. Idempotente.

-- ------------------------------------------------------------
-- extensao_ignorados: hash do número normalizado (nunca o número). Só o dono lê, insere e apaga.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_ignorados (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  numero_hash TEXT NOT NULL CHECK (char_length(numero_hash) BETWEEN 32 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, numero_hash)
);

GRANT SELECT, INSERT, DELETE ON public.extensao_ignorados TO authenticated;
GRANT ALL ON public.extensao_ignorados TO service_role;
ALTER TABLE public.extensao_ignorados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_ignorados_select_own" ON public.extensao_ignorados;
CREATE POLICY "extensao_ignorados_select_own" ON public.extensao_ignorados
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_ignorados_insert_own" ON public.extensao_ignorados;
CREATE POLICY "extensao_ignorados_insert_own" ON public.extensao_ignorados
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_ignorados_delete_own" ON public.extensao_ignorados;
CREATE POLICY "extensao_ignorados_delete_own" ON public.extensao_ignorados
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- extensao_aceites: confirmação de "O que a extensão faz" (por versão do texto).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_aceites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  versao TEXT NOT NULL CHECK (char_length(versao) BETWEEN 1 AND 20),
  aceito_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, versao)
);

GRANT SELECT, INSERT ON public.extensao_aceites TO authenticated;
GRANT ALL ON public.extensao_aceites TO service_role;
ALTER TABLE public.extensao_aceites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_aceites_select_own" ON public.extensao_aceites;
CREATE POLICY "extensao_aceites_select_own" ON public.extensao_aceites
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_aceites_insert_own" ON public.extensao_aceites;
CREATE POLICY "extensao_aceites_insert_own" ON public.extensao_aceites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- extensao_eventos: só o TIPO e a hora (para o Admin contar). Nunca conteúdo, nome nem número.
-- O dono insere e lê os próprios; o Admin lê todos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extensao_eventos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('ticket_criado','ticket_atualizado','conversa_ignorada','pausou','despausou','leitura')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.extensao_eventos TO authenticated;
GRANT ALL ON public.extensao_eventos TO service_role;
ALTER TABLE public.extensao_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensao_eventos_insert_own" ON public.extensao_eventos;
CREATE POLICY "extensao_eventos_insert_own" ON public.extensao_eventos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "extensao_eventos_read" ON public.extensao_eventos;
CREATE POLICY "extensao_eventos_read" ON public.extensao_eventos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_extensao_eventos_user ON public.extensao_eventos(user_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extensao_eventos_data ON public.extensao_eventos(created_at DESC);
```
