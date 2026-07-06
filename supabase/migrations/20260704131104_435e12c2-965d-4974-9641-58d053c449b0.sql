
ALTER TABLE public.relatorio_prospeccao DROP CONSTRAINT IF EXISTS relatorio_prospeccao_area_check;
ALTER TABLE public.relatorio_prospeccao ADD CONSTRAINT relatorio_prospeccao_area_check
  CHECK (area = ANY (ARRAY['Ligações'::text, 'Mensagens'::text, 'Ztalk'::text, 'Geral'::text, 'Clts'::text, 'Estágios Manhã'::text, 'Estágios Tarde'::text]));
