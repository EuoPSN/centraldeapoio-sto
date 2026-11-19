-- Amor Saúde (página 3 do redesign OMNIA) — 2/3: migração dos dados.
-- Rode depois de 20261121120000_amor_saude_campos.sql.
--
-- 1) Casa as regiões antigas (tabela unidades: "Justinopolis", "Venda Nova e
--    Belo Horizonte"…) com as clínicas Amor Saúde de Contatos e Endereços.
--    Cada nome antigo é quebrado em partes ("Venda Nova e Belo Horizonte" →
--    "Venda Nova", "Belo Horizonte"); uma parte casa quando aponta para UMA
--    única clínica (pela região ou pelo final do nome). Parte que aponta para
--    nenhuma ou para várias clínicas (ex.: "Belo Horizonte" tem 4) não casa e
--    o item fica marcado como pendente para revisão no Admin.
-- 2) Guarda o texto antigo "Principais: … / Outras regiões: …" em
--    pricing_items.clinicas_ref_antiga, visível no Admin até ser conferido.
-- 3) Preenche o preparo em itens dos exames a partir de jejum, preparo,
--    material/método e observações.
-- Pode ser rodada de novo sem duplicar nada.

CREATE OR REPLACE FUNCTION pg_temp.norm(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(regexp_replace(translate(coalesce(t, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'), '\s+', ' ', 'g')))
$$;

-- Vínculos antigos dos três tipos de item, num formato só.
DROP TABLE IF EXISTS pg_temp.amor_old_links;
CREATE TEMP TABLE amor_old_links AS
  SELECT 'consulta'::TEXT AS tipo, l.pricing_item_id AS item_id, u.nome AS antigo, l.destaque
  FROM public.pricing_item_unidades l JOIN public.unidades u ON u.id = l.unidade_id
  UNION ALL
  SELECT 'exame', l.exame_id, u.nome, true
  FROM public.exame_unidades l JOIN public.unidades u ON u.id = l.unidade_id
  UNION ALL
  SELECT 'odontologia', l.procedimento_id, u.nome, true
  FROM public.procedimento_unidades l JOIN public.unidades u ON u.id = l.unidade_id;

DROP TABLE IF EXISTS pg_temp.amor_parts;
CREATE TEMP TABLE amor_parts AS
  SELECT DISTINCT o.tipo, o.item_id, o.antigo,
         regexp_replace(pg_temp.norm(p), '^bh ', '') AS parte
  FROM amor_old_links o,
       regexp_split_to_table(o.antigo, '\s+e\s+|,|/') AS p
  WHERE trim(p) <> '';

DROP TABLE IF EXISTS pg_temp.amor_cand;
CREATE TEMP TABLE amor_cand AS
  SELECT pa.tipo, pa.item_id, pa.parte, c.id AS clinica_id
  FROM amor_parts pa
  JOIN public.contatos_enderecos c
    ON c.tipo = 'clinica_amor_saude'
   AND (pg_temp.norm(c.regiao) = pa.parte
        OR pg_temp.norm(c.nome_regiao) ~ ('(^| )' || pa.parte || '$'));

DROP TABLE IF EXISTS pg_temp.amor_match;
CREATE TEMP TABLE amor_match AS
  SELECT tipo, item_id, parte, (array_agg(DISTINCT clinica_id))[1] AS clinica_id
  FROM amor_cand
  GROUP BY tipo, item_id, parte
  HAVING count(DISTINCT clinica_id) = 1;

INSERT INTO public.pricing_item_clinicas (pricing_item_id, clinica_id)
SELECT DISTINCT item_id, clinica_id FROM amor_match WHERE tipo = 'consulta'
ON CONFLICT DO NOTHING;

INSERT INTO public.exame_clinicas (exame_id, clinica_id)
SELECT DISTINCT item_id, clinica_id FROM amor_match WHERE tipo = 'exame'
ON CONFLICT DO NOTHING;

INSERT INTO public.procedimento_clinicas (procedimento_id, clinica_id)
SELECT DISTINCT item_id, clinica_id FROM amor_match WHERE tipo = 'odontologia'
ON CONFLICT DO NOTHING;

-- Texto antigo como referência no Admin.
UPDATE public.pricing_items p
SET clinicas_ref_antiga = x.txt
FROM (
  SELECT item_id,
         concat_ws(' / ',
           'Principais: ' || string_agg(antigo, ', ' ORDER BY antigo) FILTER (WHERE destaque),
           'Outras regiões: ' || string_agg(antigo, ', ' ORDER BY antigo) FILTER (WHERE NOT destaque)
         ) AS txt
  FROM amor_old_links
  WHERE tipo = 'consulta'
  GROUP BY item_id
) x
WHERE x.item_id = p.id AND p.clinicas_ref_antiga IS NULL;

-- Pendente: alguma parte do texto antigo não casou, ou a especialidade
-- ficou sem nenhuma clínica.
UPDATE public.pricing_items p
SET clinicas_pendente = true
WHERE EXISTS (
        SELECT 1 FROM amor_parts pa
        WHERE pa.tipo = 'consulta' AND pa.item_id = p.id
          AND NOT EXISTS (SELECT 1 FROM amor_match m WHERE m.tipo = 'consulta' AND m.item_id = pa.item_id AND m.parte = pa.parte)
      )
   OR NOT EXISTS (SELECT 1 FROM public.pricing_item_clinicas pc WHERE pc.pricing_item_id = p.id);

-- Preparo em itens (só para exames que ainda não têm itens).
UPDATE public.exames e
SET preparo_itens = array_remove(ARRAY[
    nullif(trim(e.preparo), ''),
    CASE
      WHEN e.jejum AND coalesce(e.preparo, '') !~* 'jejum' THEN 'Jejum necessário (confirme o tempo com a clínica)'
      WHEN NOT e.jejum AND nullif(trim(e.preparo), '') IS NULL THEN 'Não é necessário jejum'
    END,
    CASE WHEN nullif(trim(e.material), '') IS NOT NULL THEN 'Material/método: ' || trim(e.material) END,
    nullif(trim(e.observacoes), '')
  ], NULL)
WHERE cardinality(e.preparo_itens) = 0;

DROP TABLE IF EXISTS pg_temp.amor_match, pg_temp.amor_cand, pg_temp.amor_parts, pg_temp.amor_old_links;

-- Resultado (aparece no SQL Editor):
SELECT 'Consultas com clínicas casadas' AS item,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.pricing_item_clinicas pc WHERE pc.pricing_item_id = p.id)) AS total
FROM public.pricing_items p
UNION ALL
SELECT 'Consultas que precisam de revisão no Admin', count(*) FILTER (WHERE clinicas_pendente) FROM public.pricing_items
UNION ALL
SELECT 'Exames com clínicas', count(DISTINCT exame_id) FROM public.exame_clinicas
UNION ALL
SELECT 'Exames sem clínica (marcar no Admin)', count(*) FROM public.exames e
  WHERE NOT EXISTS (SELECT 1 FROM public.exame_clinicas ec WHERE ec.exame_id = e.id)
UNION ALL
SELECT 'Procedimentos sem clínica (marcar no Admin)', count(*) FROM public.procedimentos_odontologicos o
  WHERE NOT EXISTS (SELECT 1 FROM public.procedimento_clinicas pc WHERE pc.procedimento_id = o.id);
