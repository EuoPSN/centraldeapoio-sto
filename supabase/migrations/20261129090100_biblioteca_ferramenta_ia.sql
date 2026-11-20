-- Fase B · bloco 1 · "Conversas que fecharam" — 2/4: nova ferramenta de IA "biblioteca"
-- (limite diário, blocos do Cérebro). Idempotente: rode uma vez; se rodar de novo,
-- só repete o que já está feito.

-- 1) Aceitar "biblioteca" nas listas de ferramentas (troca os CHECKs que listam "simulador").
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid IN ('public.ia_uso'::regclass, 'public.ia_limites'::regclass,
                         'public.ia_limites_extra'::regclass, 'public.cerebro_blocos'::regclass)
      AND pg_get_constraintdef(c.oid) ILIKE '%simulador%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.ia_uso ADD CONSTRAINT ia_uso_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.ia_limites ADD CONSTRAINT ia_limites_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.ia_limites_extra ADD CONSTRAINT ia_limites_extra_ferramenta_check
  CHECK (ferramenta IN ('marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca'));
ALTER TABLE public.cerebro_blocos ADD CONSTRAINT cerebro_blocos_ferramentas_check
  CHECK (ferramentas <@ ARRAY['marciana','cliente_disse','mensagem_cliente','retomada','copiloto','raiox','simulador','biblioteca']::text[]);

-- 2) Limite padrão: 10 fichas por dia por atendente (admin não tem limite).
INSERT INTO public.ia_limites (ferramenta, limite_diario) VALUES ('biblioteca', 10)
ON CONFLICT (ferramenta) DO NOTHING;

-- 3) Blocos padrão da "biblioteca": playbook CDT, mapeamento de objeções, padrão de escrita,
--    etapas do funil e SPIN. Só acrescenta a ferramenta; não mexe no conteúdo.
UPDATE public.cerebro_blocos
   SET ferramentas = array_append(ferramentas, 'biblioteca')
 WHERE chave IN ('playbook_cdt', 'mapeamento_objecoes', 'padrao_escrita', 'etapas_funil', 'spin_selling')
   AND NOT ('biblioteca' = ANY (ferramentas));
