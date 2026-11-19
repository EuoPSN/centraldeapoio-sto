-- MarcIAna §5: fontes passam a ficar numa coluna própria (não mais
-- concatenadas no texto da resposta) e a resposta pode ter uma "Mensagem
-- para o cliente" gerada e salva junto. §6: sinal explícito de resposta sem
-- base, usado pelo olho orbital (estado "miss") e pelo painel de feedback.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sources JSONB,
  ADD COLUMN IF NOT EXISTS cliente_mensagem TEXT,
  ADD COLUMN IF NOT EXISTS sem_base BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.chat_messages.sources IS
  'Fontes consultadas pela IA para esta resposta (array de {title, source_type}). Mensagens antigas trazem as fontes concatenadas no fim de "content" — ver SOURCES_MARKER no servidor/cliente.';
COMMENT ON COLUMN public.chat_messages.cliente_mensagem IS
  'Texto reescrito como mensagem de WhatsApp para o cliente, gerado sob demanda e salvo aqui para não gerar de novo ao reabrir a conversa.';
COMMENT ON COLUMN public.chat_messages.sem_base IS
  'true quando a MarcIAna não encontrou a resposta na base de conhecimento (estado "miss" do olho orbital; alimenta o painel de Perguntas sem boa resposta).';
