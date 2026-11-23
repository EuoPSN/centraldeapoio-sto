-- Fase D · 4/7 — Dúvidas frequentes (Amor Saúde). Idempotente.
-- Atendente lê só as publicadas; admin lê e escreve tudo. O seed entra como RASCUNHO: o Paulo
-- revisa e publica no Admin (nada é publicado sozinho).

CREATE TABLE IF NOT EXISTS public.duvidas_frequentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Planos, Pagamento, Cancelamento, Amor Saúde, Clínicas (texto livre: dá para criar outros temas).
  tema TEXT NOT NULL CHECK (char_length(tema) BETWEEN 1 AND 60),
  pergunta TEXT NOT NULL CHECK (char_length(pergunta) BETWEEN 1 AND 300),
  resposta TEXT NOT NULL DEFAULT '' CHECK (char_length(resposta) <= 4000),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'marciana')),
  position INT NOT NULL DEFAULT 0,
  copias_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Só publica com resposta escrita.
  CONSTRAINT duvidas_publicada_com_resposta CHECK (status = 'rascunho' OR char_length(btrim(resposta)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_duvidas_pergunta ON public.duvidas_frequentes (lower(pergunta));
CREATE INDEX IF NOT EXISTS idx_duvidas_status_tema ON public.duvidas_frequentes (status, tema, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duvidas_frequentes TO authenticated;
GRANT ALL ON public.duvidas_frequentes TO service_role;
ALTER TABLE public.duvidas_frequentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duvidas_frequentes_select" ON public.duvidas_frequentes;
CREATE POLICY "duvidas_frequentes_select" ON public.duvidas_frequentes
  FOR SELECT TO authenticated
  USING (status = 'publicada' OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "duvidas_frequentes_insert_admin" ON public.duvidas_frequentes;
CREATE POLICY "duvidas_frequentes_insert_admin" ON public.duvidas_frequentes
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "duvidas_frequentes_update_admin" ON public.duvidas_frequentes;
CREATE POLICY "duvidas_frequentes_update_admin" ON public.duvidas_frequentes
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "duvidas_frequentes_delete_admin" ON public.duvidas_frequentes;
CREATE POLICY "duvidas_frequentes_delete_admin" ON public.duvidas_frequentes
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_duvidas_frequentes_updated ON public.duvidas_frequentes;
CREATE TRIGGER trg_duvidas_frequentes_updated
  BEFORE UPDATE ON public.duvidas_frequentes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- "Copiar resposta" soma 1 (qualquer atendente; só em dúvida publicada).
CREATE OR REPLACE FUNCTION public.increment_duvida_copias(p_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.duvidas_frequentes SET copias_count = copias_count + 1 WHERE id = p_id AND status = 'publicada';
$$;
REVOKE ALL ON FUNCTION public.increment_duvida_copias(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_duvida_copias(UUID) TO authenticated;

-- Seed: docs/fase-d/base-duvidas.json, como rascunho (uma linha por pergunta; não duplica).
INSERT INTO public.duvidas_frequentes (tema, pergunta, resposta, status, origem, position)
SELECT v.tema, v.pergunta, v.resposta, 'rascunho', 'manual', v.pos
  FROM (VALUES
  ($q$Planos$q$, $q$Tem carência?$q$, $q$Não. Depois que a adesão é confirmada, o cliente já pode usar os benefícios, sem prazo de espera.$q$, 10),
  ($q$Pagamento$q$, $q$Como funciona o pagamento?$q$, $q$A mensalidade é cobrada no cartão de crédito ou débito, de forma automática. Não trabalhamos com boleto nem Pix recorrente.$q$, 20),
  ($q$Cancelamento$q$, $q$Posso cancelar quando quiser?$q$, $q$O contrato tem fidelidade de 12 meses. Cancelando antes disso, há multa de 50% sobre o que falta. Explique isso com calma e sem pressionar; se o cliente tiver dúvida, passe para o consultor.$q$, 30),
  ($q$Planos$q$, $q$Quais são os planos?$q$, $q$Prata, Ouro e Diamante. Os valores das mensalidades estão em Amor Saúde e na ferramenta de economia; não decore números, consulte sempre a base atualizada.$q$, 40),
  ($q$Planos$q$, $q$Dependentes entram no mesmo plano?$q$, $q$Sim, o cliente pode incluir dependentes. Confira na hora a regra e o valor do plano escolhido antes de prometer.$q$, 50),
  ($q$Planos$q$, $q$Depois de aderir, o que acontece?$q$, $q$Depois do cadastro, o cliente recebe um link para validar a identidade (KYC). Assim que o pagamento e a validação são confirmados, ele já pode usar.$q$, 60),
  ($q$Amor Saúde$q$, $q$O desconto vale em qualquer clínica?$q$, $q$Vale nas clínicas Amor Saúde. Veja a clínica mais próxima do cliente em Amor Saúde > Clínicas.$q$, 70),
  ($q$Amor Saúde$q$, $q$Como o cliente agenda uma consulta?$q$, $q$Pelo WhatsApp da clínica escolhida ou, para consulta por vídeo, pela teleconsulta. Os contatos e horários estão em Amor Saúde > Clínicas e Consultas.$q$, 80),
  ($q$Amor Saúde$q$, $q$Tem atendimento por vídeo?$q$, $q$Sim. Há teleconsulta por agendamento e PA digital, com clínico geral e pediatra, que atende em até 15 minutos depois de agendar. Veja os detalhes em Amor Saúde > Teleconsulta e PA digital.$q$, 90),
  ($q$Amor Saúde$q$, $q$O PA digital serve para emergência?$q$, $q$Não. Para urgência ou caso grave, o cliente deve procurar um pronto-socorro. O PA digital serve para o que não pode esperar uma consulta marcada, mas não é grave.$q$, 100),
  ($q$Clínicas$q$, $q$Vocês atendem na minha cidade?$q$, $q$Nossa unidade atende Ribeirão das Neves e Esmeraldas. Para o cliente de outra região, veja em Amor Saúde > Clínicas a unidade mais próxima.$q$, 110),
  ($q$Pagamento$q$, $q$Meu cartão foi recusado, e agora?$q$, $q$Peça ao cliente para conferir limite e dados do cartão, ou tentar outro cartão de crédito ou débito. Se continuar, passe para o consultor.$q$, 120)
  ) AS v(tema, pergunta, resposta, pos)
 WHERE NOT EXISTS (SELECT 1 FROM public.duvidas_frequentes d WHERE lower(d.pergunta) = lower(v.pergunta));
