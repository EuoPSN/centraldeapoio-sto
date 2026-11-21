-- Fase B · bloco 3 — 2/3: bloco automático "Mudanças recentes" no Cérebro. Idempotente.
-- O texto é montado na hora, no servidor, a partir de changelog_entries (tipo importante ou urgente,
-- publicada, "usar na IA" ligado, não incorporada ao Playbook, publicada nos últimos 30 dias).
-- gerado = true: o Admin não edita o conteúdo nem a matriz "Quem usa o quê" desta linha.
INSERT INTO public.cerebro_blocos (chave, titulo, descricao_curta, conteudo, ferramentas, gerado, ordem) VALUES
  ('mudancas_recentes', 'Mudanças recentes', 'Mudanças importantes e urgentes dos últimos 30 dias (automático)', '',
    ARRAY['marciana','mensagem_cliente','cliente_disse','copiloto','retomada','biblioteca'], true, 70)
ON CONFLICT (chave) DO NOTHING;
