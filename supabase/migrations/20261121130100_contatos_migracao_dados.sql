-- Contatos e Endereços (página 4 do redesign OMNIA) — 2/2: migração de dados.
-- Rode depois de 20261121130000_contatos_campos.sql.
--
-- Preenche bairro/cidade das Unidades CDT (tipo = cartao_de_todos) a partir do
-- nome e do endereço já cadastrados, só nos casos em que dá pra ter certeza:
--   - "BH <bairro>" e "Barreiro" → bairro é um dos distritos/regionais de Belo
--     Horizonte (Centro Sul, Oeste, Venda Nova, Barreiro); cidade = Belo Horizonte.
--   - "Centro de Neves", "Justinópolis" e variações, "Veneza" → bairros de
--     Ribeirão das Neves (mesma convenção já usada na migração do Amor Saúde).
--   - Demais nomes (Betim, Contagem, Vespasiano, Santa Luzia, Ibirité, Curvelo,
--     Pará de Minas, Patrocínio, São João Del Rei, Sete Lagoas, Teófilo Otoni,
--     Vale do Aço) são cidades/região própria de Minas Gerais: só cidade,
--     sem bairro (o endereço cadastrado não traz essa informação).
--   - "João Pessoa Norte": bairro e cidade extraídos do próprio endereço
--     cadastrado ("...Centro, João Pessoa - PB...").
-- Só escreve onde a coluna ainda está vazia — não sobrescreve o que o Admin
-- já tiver preenchido manualmente. Pode rodar de novo sem problema.
-- Suporte e setores (tipo = outros) e Clínicas Amor Saúde não são tocados
-- aqui: não há dado de origem para bairro/cidade/subtítulo deles.

UPDATE public.contatos_enderecos c
SET
  bairro = COALESCE(c.bairro, v.bairro),
  cidade = COALESCE(c.cidade, v.cidade)
FROM (VALUES
  ('31d974c2-8fbd-4e86-8469-2c3a41526603'::uuid, 'Veneza',           'Ribeirão das Neves'),
  ('35d782ee-0967-4a3f-aabe-a055de7ad6f0'::uuid, 'Centro',           'Ribeirão das Neves'),
  ('8ce92d19-a42c-4d33-a9da-cb3194de9100'::uuid, 'Vila Santa Branca','Ribeirão das Neves'),
  ('870e672c-1f27-4ff1-8afb-990410a274d5'::uuid, 'Fortaleza',        'Ribeirão das Neves'),
  ('5697f21f-c8a9-4996-bb8c-4cef64c7060c'::uuid, 'Menezes',          'Ribeirão das Neves'),
  ('59717e24-c4e1-4826-9f84-4475757aa5a7'::uuid, 'Centro Sul',       'Belo Horizonte'),
  ('ee810305-e28a-4a33-a372-f0dad66345c0'::uuid, 'Centro Sul',       'Belo Horizonte'),
  ('cd056414-50f4-450d-9af0-d029be45f247'::uuid, 'Oeste',            'Belo Horizonte'),
  ('9e123fa6-d882-4549-a4d0-7958e19d3126'::uuid, 'Venda Nova',       'Belo Horizonte'),
  ('fcdf2df3-750c-4cb6-8fca-cd21e1c9149f'::uuid, 'Barreiro',         'Belo Horizonte'),
  ('131c84a4-8f1d-4880-9116-c30c0f03df67'::uuid, NULL,               'Betim'),
  ('5b9acb9b-cc8e-44e5-8efe-6e7efcfa7e82'::uuid, NULL,               'Patrocínio'),
  ('e6f5416c-a441-46e5-879a-289417a168a6'::uuid, NULL,               'Ibirité'),
  ('56f56ad9-18ed-465b-b4e6-ee00cf701aa1'::uuid, NULL,               'Contagem'),
  ('7a7d873f-61a3-4205-bb84-5b9a67734429'::uuid, NULL,               'Curvelo'),
  ('ecc2055c-881d-4b5e-91eb-a6f577109dcc'::uuid, NULL,               'Pará de Minas'),
  ('142ddbf1-84dc-406d-8b06-6f9cf95cfa67'::uuid, NULL,               'Santa Luzia'),
  ('66ff808b-f84e-446e-b17a-685a129f10af'::uuid, NULL,               'São João Del Rei'),
  ('54ffe97a-c46f-436e-8ca3-1747caef331d'::uuid, NULL,               'Sete Lagoas'),
  ('5fc8cf58-5c85-40a4-b65f-faac63e551de'::uuid, NULL,               'Teófilo Otoni'),
  ('cbd09ef5-75b1-46a8-b2cf-846e1940ee90'::uuid, NULL,               'Vale do Aço'),
  ('f0d4aac7-3c4a-4668-afd6-127205fe3694'::uuid, NULL,               'Vespasiano'),
  ('9a4edfc7-1b90-4806-9bd2-25474899bf28'::uuid, 'Centro',           'João Pessoa')
) AS v(id, bairro, cidade)
WHERE c.id = v.id AND c.tipo = 'cartao_de_todos';

-- Resultado (aparece no SQL Editor): quantas Unidades CDT ficaram com
-- bairro/cidade preenchidos e quantas ainda precisam de revisão manual.
SELECT
  count(*) FILTER (WHERE cidade IS NOT NULL AND bairro IS NOT NULL) AS "bairro e cidade preenchidos",
  count(*) FILTER (WHERE cidade IS NOT NULL AND bairro IS NULL) AS "só cidade preenchida",
  count(*) FILTER (WHERE cidade IS NULL) AS "sem bairro nem cidade (revisar no Admin)",
  count(*) AS "total de Unidades CDT"
FROM public.contatos_enderecos
WHERE tipo = 'cartao_de_todos';
