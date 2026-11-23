CREATE OR REPLACE FUNCTION private.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.is_active IS TRUE)
    OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'admin'::public.app_role)
  );
$$;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('decision_nodes','Autenticados leem nós'),('decision_edges','Autenticados leem arestas'),('decision_motors','Autenticados leem motores'),
    ('quiz_options','quiz_options_read_auth'),('marciana_sugestoes','marciana_sugestoes_read_auth'),('quiz_questions','quiz_questions_read_auth'),
    ('content_item_views','content_item_views_select_auth'),('exame_unidades','exame_unidades_read_auth'),('client_profile_states','cps read auth'),
    ('config_mensagens_vendem','config_mensagens_vendem_read'),('unidades','unidades_read_auth'),('training_module_images','training_module_images_read_auth'),
    ('aquecimento_config','aquecimento_config_read'),('themes','themes_read_all'),('training_modules','training_modules_read_auth'),
    ('ranking_hall','ranking_hall_read'),('message_flow_stages','message_flow_stages_read_auth'),('exames','exames_read_auth'),
    ('exame_clinicas','exame_clinicas_read_auth'),('flow_edges','fe read all auth'),('contatos_enderecos','contatos_enderecos_read_auth'),
    ('ranking_config','ranking_config_read'),('motivos_perda','motivos_perda_read'),('flow_paths','flow_paths_read_auth'),
    ('flow_nodes','node_read_auth'),('flows','flow_read_auth'),('ia_limites','ia_limites_read'),
    ('problem_scenarios','Authenticated read problem scenarios'),('config_economia','config_economia_read'),
    ('message_flow_links','message_flow_links_read_auth'),('admin_sections','admin_sections_read_auth'),('quizzes','quizzes_read_auth'),
    ('pdf_library_items','pdf_library_items_read_auth'),('messages','msg_read_auth'),('homepage_messages','homepage_messages_read_auth'),
    ('app_settings','settings_read_all'),('image_library_items','ili_read_auth')
  ) AS t(tbl, pol) LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (private.is_staff(auth.uid()))', r.pol, r.tbl);
  END LOOP;
END $$;

ALTER POLICY "ca read" ON storage.objects TO authenticated
  USING (bucket_id = 'cadencia-audios' AND private.is_staff(auth.uid()));

DROP POLICY IF EXISTS aquecimento_sessoes_insert_own ON public.aquecimento_sessoes;
DROP POLICY IF EXISTS aquecimento_sessoes_update_own ON public.aquecimento_sessoes;
DROP POLICY IF EXISTS aquecimento_respostas_insert_own ON public.aquecimento_respostas;
DROP POLICY IF EXISTS changelog_confirmacoes_insert_own ON public.changelog_confirmacoes;
DROP POLICY IF EXISTS "Users insert own simulator results" ON public.simulator_results;

REVOKE EXECUTE ON FUNCTION public.limpar_raiox() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.limpar_fechamento_casos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpar_raiox() TO service_role;
GRANT EXECUTE ON FUNCTION public.limpar_fechamento_casos() TO service_role;