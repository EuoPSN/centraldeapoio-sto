-- Fase E — Painel Admin organizado. Idempotente: só UPDATE/DELETE por chave. Não apaga tabelas nem dados de negócio.
-- Rodar no SQL editor do Lovable ANTES do merge.

-- 4) Páginas antigas sem link: tira do menu do site.
DELETE FROM public.nav_items
WHERE route IN ('/dashboard', '/funcionarios', '/crm-leads', '/crm-prospeccao', '/motor-decisao');

-- 1) Novos grupos, rótulos e posições (UPDATE por tab_key; rótulo só onde o prompt define, senão mantém o atual).

-- Atendimento
UPDATE public.admin_sections SET group_name = 'Atendimento', label = 'Mensagens e scripts', position = 10 WHERE tab_key = 'messages';
UPDATE public.admin_sections SET group_name = 'Atendimento', label = 'Fluxos', position = 20 WHERE tab_key = 'atendimentos';
UPDATE public.admin_sections SET group_name = 'Atendimento', label = 'Roteiros de áudio', position = 30 WHERE tab_key = 'roteirosaudio';
UPDATE public.admin_sections SET group_name = 'Atendimento', label = 'Scripts de ligação', position = 40 WHERE tab_key = 'scriptsligacao';
UPDATE public.admin_sections SET group_name = 'Atendimento', label = 'Amor Saúde', position = 50 WHERE tab_key = 'pricing';
UPDATE public.admin_sections SET group_name = 'Atendimento', label = 'Dúvidas frequentes', position = 60 WHERE tab_key = 'duvidas';
UPDATE public.admin_sections SET group_name = 'Atendimento', label = 'Contatos', position = 70 WHERE tab_key = 'contatos';

-- Vendas e retomada
UPDATE public.admin_sections SET group_name = 'Vendas e retomada', position = 10 WHERE tab_key = 'objecoes';
UPDATE public.admin_sections SET group_name = 'Vendas e retomada', position = 20 WHERE tab_key = 'objecoesnovas';
UPDATE public.admin_sections SET group_name = 'Vendas e retomada', position = 30 WHERE tab_key = 'fechamento';
UPDATE public.admin_sections SET group_name = 'Vendas e retomada', position = 40 WHERE tab_key = 'economia';
UPDATE public.admin_sections SET group_name = 'Vendas e retomada', position = 50 WHERE tab_key = 'cadencia';
UPDATE public.admin_sections SET group_name = 'Vendas e retomada', position = 60 WHERE tab_key = 'motivosperda';
UPDATE public.admin_sections SET group_name = 'Vendas e retomada', position = 70 WHERE tab_key = 'mensagensvendem';
UPDATE public.admin_sections SET group_name = 'Vendas e retomada', position = 80 WHERE tab_key = 'conversasenviadas';

-- Inteligência
UPDATE public.admin_sections SET group_name = 'Inteligência', label = 'Cérebro da Omnia', position = 10 WHERE tab_key = 'cerebro';
UPDATE public.admin_sections SET group_name = 'Inteligência', label = 'Base IA', position = 20 WHERE tab_key = 'knowledge';
UPDATE public.admin_sections SET group_name = 'Inteligência', label = 'IA e indexação', position = 30 WHERE tab_key = 'ai';
UPDATE public.admin_sections SET group_name = 'Inteligência', label = 'Conhecimento do cliente', position = 40 WHERE tab_key = 'clientknowledge';
UPDATE public.admin_sections SET group_name = 'Inteligência', label = 'MarcIAna', position = 50 WHERE tab_key = 'marciana';

-- Treino
UPDATE public.admin_sections SET group_name = 'Treino', position = 10 WHERE tab_key = 'perfis';
UPDATE public.admin_sections SET group_name = 'Treino', position = 20 WHERE tab_key = 'problemscenarios';
UPDATE public.admin_sections SET group_name = 'Treino', position = 30 WHERE tab_key = 'treinamentos';
UPDATE public.admin_sections SET group_name = 'Treino', position = 40 WHERE tab_key = 'checklist';
UPDATE public.admin_sections SET group_name = 'Treino', position = 50 WHERE tab_key = 'bancoexercicios';
UPDATE public.admin_sections SET group_name = 'Treino', position = 60 WHERE tab_key = 'aquecimentoadmin';

-- Equipe e resultados
UPDATE public.admin_sections SET group_name = 'Equipe e resultados', label = 'Raio-X da equipe', position = 10 WHERE tab_key = 'raioxequipe';
UPDATE public.admin_sections SET group_name = 'Equipe e resultados', label = 'Mapa da equipe', position = 20 WHERE tab_key = 'mapaequipe';
UPDATE public.admin_sections SET group_name = 'Equipe e resultados', label = 'Resultados do simulador', position = 30 WHERE tab_key = 'simuladorresultados';
UPDATE public.admin_sections SET group_name = 'Equipe e resultados', label = 'Ranking', position = 40 WHERE tab_key = 'rankingadmin';
UPDATE public.admin_sections SET group_name = 'Equipe e resultados', label = 'Extensão do WhatsApp', position = 50 WHERE tab_key = 'extensaoadmin';

-- Central de Ajuda
UPDATE public.admin_sections SET group_name = 'Central de Ajuda', position = 10 WHERE tab_key = 'procedimentos';
UPDATE public.admin_sections SET group_name = 'Central de Ajuda', position = 20 WHERE tab_key = 'problemastecnicos';
UPDATE public.admin_sections SET group_name = 'Central de Ajuda', label = 'Mudanças e novidades', position = 30 WHERE tab_key = 'changelog';
UPDATE public.admin_sections SET group_name = 'Central de Ajuda', position = 40 WHERE tab_key = 'suggestions';

-- Sistema
UPDATE public.admin_sections SET group_name = 'Sistema', position = 10 WHERE tab_key = 'users';
UPDATE public.admin_sections SET group_name = 'Sistema', position = 20 WHERE tab_key = 'unidades';
UPDATE public.admin_sections SET group_name = 'Sistema', label = 'Menu e abas', position = 30 WHERE tab_key = 'menu';
UPDATE public.admin_sections SET group_name = 'Sistema', label = 'Tela inicial', position = 40 WHERE tab_key = 'homemsg';
UPDATE public.admin_sections SET group_name = 'Sistema', label = 'Categorias', position = 50 WHERE tab_key = 'taxonomy';
UPDATE public.admin_sections SET group_name = 'Sistema', label = 'Biblioteca de imagens', position = 60 WHERE tab_key = 'imagelibrary';

-- Seções escondidas (visible = false): scriptreview, telemedicina, organizacao, promoplans — não mexe.

-- Seções mortas: Conteúdo (legado) e Identidade. Só as linhas de admin_sections; tabelas e tema ficam.
DELETE FROM public.admin_sections WHERE tab_key IN ('content', 'appearance');
