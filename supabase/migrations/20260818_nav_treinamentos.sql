-- Adiciona "Treinamentos" no menu lateral principal do site
INSERT INTO public.nav_items (label, icon, route, section, position, visible, admin_only)
VALUES ('Treinamentos', 'GraduationCap', '/treinamentos', 'main', 999, true, false);
