-- Redesign OMNIA · Página 6: Simulador IA.

-- Avaliação detalhada: trecho da conversa citado em cada ponto, a mensagem mais
-- fraca do atendente e a reescrita sugerida ("Como eu mandaria"). Tudo opcional
-- para não quebrar avaliações antigas.
ALTER TABLE public.simulator_results ADD COLUMN IF NOT EXISTS trechos JSONB;
ALTER TABLE public.simulator_results ADD COLUMN IF NOT EXISTS mensagem_fraca TEXT;
ALTER TABLE public.simulator_results ADD COLUMN IF NOT EXISTS reescrita TEXT;

-- "Nota de referência do simulador": linha de meta no gráfico de evolução de
-- Minhas simulações. Número opcional (vazio = sem linha), padrão 70.
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS simulador_nota_referencia INTEGER DEFAULT 70;

-- Origem do lead: dado real que o atendente teria sobre o cliente (ex.: "Anúncio
-- no Instagram"), mostrado no card do cliente durante a simulação quando definido.
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS cliente_origem_lead TEXT;
