-- Contatos e Endereços (página 4 do redesign OMNIA) — 1/2: campos novos.
-- Nada é apagado; tudo é opcional. Vale para as três tipos (cartao_de_todos,
-- clinica_amor_saude, outros) na mesma tabela; cada tela só usa os campos que precisa.

ALTER TABLE public.contatos_enderecos
  -- Unidades CDT: bairro/cidade (subtítulo e busca), horário, cidades/bairros
  -- próximos também atendidos, e-mail/site genéricos ficam livres para qualquer tipo.
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS horario TEXT,
  ADD COLUMN IF NOT EXISTS atende_tambem TEXT[] NOT NULL DEFAULT '{}',
  -- Suporte e setores: subtítulo curto, quando indicar (só para o atendente),
  -- WhatsApp, e-mail e site.
  ADD COLUMN IF NOT EXISTS subtitulo TEXT,
  ADD COLUMN IF NOT EXISTS quando_indicar TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS site TEXT,
  -- Quando cada contato foi editado pela última vez.
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Conta cada cópia feita nesta página (mesmo modelo de increment_message_use_count).
  ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;

-- Atualiza updated_at sozinho a cada edição (função já existe desde a Central original).
-- "UPDATE OF <colunas>" faz o gatilho disparar só quando o conteúdo muda —
-- não quando increment_contato_use() só soma 1 em use_count.
DROP TRIGGER IF EXISTS contatos_enderecos_updated ON public.contatos_enderecos;
CREATE TRIGGER contatos_enderecos_updated BEFORE UPDATE OF
  tipo, nome_regiao, endereco, numero, ponto_referencia, contato1, contato2, contato3,
  destaque, position, regiao, maps_url, bairro, cidade, horario, atende_tambem,
  subtitulo, quando_indicar, whatsapp, email, site
  ON public.contatos_enderecos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.increment_contato_use(contato_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.contatos_enderecos SET use_count = use_count + 1 WHERE id = contato_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_contato_use(uuid) TO authenticated;
