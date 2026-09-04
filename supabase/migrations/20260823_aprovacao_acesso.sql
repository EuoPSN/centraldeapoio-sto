-- Contas novas nascem inativas por padrão (precisam de aprovação de um admin).
-- Contas criadas diretamente pelo Admin são ativadas explicitamente no código (createUser).
ALTER TABLE public.profiles ALTER COLUMN is_active SET DEFAULT false;
