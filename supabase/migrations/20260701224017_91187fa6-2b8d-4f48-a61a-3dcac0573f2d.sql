
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Rewrite policies to reference private.has_role
ALTER POLICY "Admins manage profiles" ON public.profiles
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Users read own roles" ON public.user_roles
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage roles" ON public.user_roles
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins write content" ON public.content_items
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins write scripts" ON public.scripts
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins write pricing" ON public.pricing_items
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Users see own conversations" ON public.chat_conversations
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Read messages of own conversations" ON public.chat_messages
  USING (EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = chat_messages.conversation_id AND ((c.user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role))));

ALTER POLICY "Admins write AI settings" ON public.ai_settings
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins read AI settings" ON public.ai_settings
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins read logs" ON public.access_logs
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY cat_write_admin ON public.categories
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY msg_write_admin ON public.messages
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY flow_write_admin ON public.flows
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY node_write_admin ON public.flow_nodes
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY settings_update_admin ON public.app_settings
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY themes_write_admin ON public.themes
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY nav_write_admin ON public.nav_items
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY sug_read_own_or_admin ON public.suggestions
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY sug_update_admin ON public.suggestions
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY sug_delete_own_or_admin ON public.suggestions
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "ke admin write" ON public.knowledge_entries
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "fe admin write" ON public.flow_edges
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "ss own read" ON public.simulator_sessions
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Users read own profile" ON public.profiles
  USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage client profiles" ON public.client_profiles
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Users view own simulator results" ON public.simulator_results
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "kf admin insert" ON storage.objects
  WITH CHECK ((bucket_id = 'knowledge-files'::text) AND private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "kf admin update" ON storage.objects
  USING ((bucket_id = 'knowledge-files'::text) AND private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "kf admin delete" ON storage.objects
  USING ((bucket_id = 'knowledge-files'::text) AND private.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop the public-schema function that triggered the linter
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
