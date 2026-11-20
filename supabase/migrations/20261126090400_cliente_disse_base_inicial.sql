-- Fase A · bloco 1 · "O cliente disse…" — 5/5: base inicial (tudo em rascunho).
-- docs/fase-a/base-bloco1.json não existe: entram só as 5 objeções com nome e
-- exemplos de fala e as subetapas do fechamento com título, sem textos inventados.
-- O Paulo preenche e publica pelo Admin. Idempotente (não duplica pelo nome/título).

INSERT INTO public.objecoes (nome, exemplos_de_fala, prioridade, status)
SELECT v.nome, v.exemplos, v.prioridade, 'rascunho'
FROM (VALUES
  ('Tá caro', ARRAY['Tá caro', 'Achei salgado', 'Não cabe no meu orçamento agora'], 10),
  ('Vou pensar', ARRAY['Vou pensar', 'Depois eu vejo', 'Me deixa pensar com calma'], 20),
  ('Vou falar com meu marido/esposa', ARRAY['Vou falar com meu marido', 'Vou ver com minha esposa', 'Preciso conversar com meu marido/esposa primeiro'], 30),
  ('Já tenho plano / uso o SUS', ARRAY['Já tenho plano', 'Uso o SUS', 'Já tenho convênio da empresa'], 40),
  ('Desconfiança / medo de golpe', ARRAY['Isso é golpe?', 'Tenho medo de golpe', 'Como sei que é verdade?'], 50)
) AS v(nome, exemplos, prioridade)
WHERE NOT EXISTS (SELECT 1 FROM public.objecoes o WHERE lower(o.nome) = lower(v.nome));

INSERT INTO public.fechamento_itens (tipo, etapa, titulo, ordem, status)
SELECT 'mensagem_etapa', v.etapa, v.titulo, v.ordem, 'rascunho'
FROM (VALUES
  ('proposta',  'Proposta enviada',  0),
  ('plano',     'Escolheu o plano', 10),
  ('dados',     'Mandou os dados',  20),
  ('pagamento', 'Pagamento',        30),
  ('link',      'Link concluído',   40)
) AS v(etapa, titulo, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.fechamento_itens f
  WHERE f.tipo = 'mensagem_etapa' AND f.etapa = v.etapa
);
