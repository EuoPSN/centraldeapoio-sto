-- Atalho tipo "/palavra" pras mensagens da aba Mensagens, usado no simulador de atendimento
ALTER TABLE public.messages ADD COLUMN shortcut TEXT;

-- Garante que não existam dois atalhos iguais (ignorando maiúsc/minúsc), permitindo vários em branco
CREATE UNIQUE INDEX messages_shortcut_unique_idx
  ON public.messages (lower(shortcut))
  WHERE shortcut IS NOT NULL AND shortcut <> '';
