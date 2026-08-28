-- Contador de uso por mensagem (incrementado quando o botão "Copiar" é clicado
-- na tela pública de Mensagens). Usa uma função com SECURITY DEFINER porque a
-- tabela messages só permite escrita direta a admins — isso libera só o
-- incremento desse campo específico pra qualquer atendente autenticado.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_message_use_count(msg_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.messages SET use_count = use_count + 1 WHERE id = msg_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_message_use_count(uuid) TO authenticated;
