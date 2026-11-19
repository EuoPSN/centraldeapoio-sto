-- Central de Ajuda (página 7 do redesign OMNIA) — unifica /tutoriais, /problemas
-- e /sugestoes numa página só (/ajuda). As linhas de nav_items continuam
-- existindo (histórico/outras integrações), só ficam invisíveis no menu.
UPDATE public.nav_items
SET visible = false, updated_at = now()
WHERE route IN ('/problemas', '/tutoriais', '/sugestoes');
