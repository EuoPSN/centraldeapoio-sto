-- Amor Saúde (página 3 do redesign OMNIA) — 3/3: rota nova no menu lateral.
-- /precos continua funcionando (redireciona para /amor-saude).
UPDATE public.nav_items
SET route = '/amor-saude', label = 'Amor Saúde', updated_at = now()
WHERE route = '/precos';
