-- Segunda cor opcional, pra virar gradiente em vez de cor sólida
ALTER TABLE public.homepage_messages ADD COLUMN IF NOT EXISTS cor_fundo_2 TEXT;
