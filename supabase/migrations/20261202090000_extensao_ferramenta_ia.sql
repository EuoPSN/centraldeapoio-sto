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
