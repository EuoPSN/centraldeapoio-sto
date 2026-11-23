-- Fase D · 2/9 — Exclusão em lote no Admin do Amor Saúde.
-- Uma função só por tipo de item, numa transação: apaga os vínculos (unidades e clínicas) e
-- depois os itens. Se qualquer id não existir, a função levanta erro e NADA é apagado.
-- Só admin (private.has_role). Idempotente (CREATE OR REPLACE).
--
-- O ramo 'telemedicina' usa a tabela criada na migração seguinte (20261205090200); como o
-- plpgsql só resolve tabelas ao executar, a ordem de criação não importa.

CREATE OR REPLACE FUNCTION public.amor_saude_excluir_lote(p_tipo TEXT, p_ids UUID[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids UUID[];
  achados INT;
  apagados INT;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::UUID[]) INTO ids FROM unnest(COALESCE(p_ids, ARRAY[]::UUID[])) AS x;
  IF cardinality(ids) = 0 THEN
    RAISE EXCEPTION 'Nenhum item selecionado.';
  END IF;
  IF cardinality(ids) > 200 THEN
    RAISE EXCEPTION 'Selecione no máximo 200 itens por vez.';
  END IF;

  IF p_tipo = 'consulta' THEN
    SELECT count(*) INTO achados FROM public.pricing_items WHERE id = ANY (ids);
    IF achados <> cardinality(ids) THEN RAISE EXCEPTION 'Algum item selecionado não existe mais. Atualize a lista e tente de novo.'; END IF;
    DELETE FROM public.pricing_item_unidades WHERE pricing_item_id = ANY (ids);
    DELETE FROM public.pricing_item_clinicas WHERE pricing_item_id = ANY (ids);
    DELETE FROM public.pricing_items WHERE id = ANY (ids);
  ELSIF p_tipo = 'exame' THEN
    SELECT count(*) INTO achados FROM public.exames WHERE id = ANY (ids);
    IF achados <> cardinality(ids) THEN RAISE EXCEPTION 'Algum item selecionado não existe mais. Atualize a lista e tente de novo.'; END IF;
    DELETE FROM public.exame_unidades WHERE exame_id = ANY (ids);
    DELETE FROM public.exame_clinicas WHERE exame_id = ANY (ids);
    DELETE FROM public.exames WHERE id = ANY (ids);
  ELSIF p_tipo = 'odontologia' THEN
    SELECT count(*) INTO achados FROM public.procedimentos_odontologicos WHERE id = ANY (ids);
    IF achados <> cardinality(ids) THEN RAISE EXCEPTION 'Algum item selecionado não existe mais. Atualize a lista e tente de novo.'; END IF;
    DELETE FROM public.procedimento_unidades WHERE procedimento_id = ANY (ids);
    DELETE FROM public.procedimento_clinicas WHERE procedimento_id = ANY (ids);
    DELETE FROM public.procedimentos_odontologicos WHERE id = ANY (ids);
  ELSIF p_tipo = 'telemedicina' THEN
    -- Teleconsulta e PA digital não têm vínculo com unidades nem clínicas.
    SELECT count(*) INTO achados FROM public.telemedicina_itens WHERE id = ANY (ids);
    IF achados <> cardinality(ids) THEN RAISE EXCEPTION 'Algum item selecionado não existe mais. Atualize a lista e tente de novo.'; END IF;
    DELETE FROM public.telemedicina_itens WHERE id = ANY (ids);
  ELSE
    RAISE EXCEPTION 'Tipo de item inválido.';
  END IF;

  GET DIAGNOSTICS apagados = ROW_COUNT;
  RETURN apagados;
END;
$$;

REVOKE ALL ON FUNCTION public.amor_saude_excluir_lote(TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amor_saude_excluir_lote(TEXT, UUID[]) TO authenticated;
