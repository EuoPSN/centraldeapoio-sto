INSERT INTO public.problem_scenarios (category_id, name, enredo, personalidade, solucao_esperada, difficulty)
SELECT
  (SELECT id FROM public.categories WHERE scope = 'problema' AND slug = 'erro-no-kyc'),
  'Marcos - documento recusado no KYC',
  'O cliente se filiou ontem e, na etapa de envio de documentos (KYC), mandou foto do RG e uma selfie. O sistema recusou automaticamente duas vezes seguidas, sempre com a mensagem "documento ilegível", mesmo com as fotos nítidas. Ele já tentou reenviar do jeito que pediram e continua travado, sem conseguir liberar o acesso ao cartão.',
  'Educado mas ansioso — já perdeu uma tarde tentando resolver sozinho e tem medo de ter caído em golpe. Fica mais tranquilo se o atendente explicar com calma o que está acontecendo.',
  'Pedir pra ele reenviar o RG em boa iluminação, sem reflexo e mostrando os 4 cantos do documento (a recusa automática geralmente é por foto cortada ou com brilho). Se recusar de novo mesmo assim, encaminhar o caso manualmente pro time de KYC via chamado interno, informando que a verificação automática está falhando, e avisar o cliente que o time humano vai revisar em até 24h.',
  'facil'
ON CONFLICT DO NOTHING;
