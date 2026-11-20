-- Reorganização do Painel Admin (redesign OMNIA Apoio, página 8):
-- novos grupos (Atendimento, Inteligência, Treino, Central de Ajuda, Equipe e
-- sistema), seções novas (Fluxos, MarcIAna, Resultados do simulador,
-- Procedimentos, Problemas técnicos) e seções que saem de vista (Aparência,
-- Planos em promoção, Análise de Scripts e Organização das abas — essas duas
-- últimas continuam existindo, só que fundidas dentro de outras seções).
-- Idempotente: pode rodar de novo sem duplicar nem perder dados.

INSERT INTO public.admin_sections (tab_key, label, icon, group_name, position, visible) VALUES
  -- Atendimento
  ('messages',          'Mensagens e scripts', 'MessageSquareQuote', 'Atendimento',       0, true),
  ('atendimentos',      'Fluxos',               'GitBranch',          'Atendimento',      10, true),
  ('pricing',           'Amor Saúde',           'Heart',              'Atendimento',      20, true),
  ('contatos',          'Contatos',             'Phone',              'Atendimento',      30, true),
  ('scriptreview',      'Análise de Scripts',   'ListChecks',         'Atendimento',      11, false),

  -- Inteligência
  ('knowledge',         'Base IA',              'Database',           'Inteligência',      0, true),
  ('ai',                'IA e indexação',       'Network',            'Inteligência',     10, true),
  ('clientknowledge',   'Conhecimento do cliente', 'BookOpen',        'Inteligência',     20, true),
  ('marciana',          'MarcIAna',             'Bot',                'Inteligência',     30, true),

  -- Treino
  ('perfis',            'Perfis de cliente',    'Briefcase',          'Treino',            0, true),
  ('problemscenarios',  'Situações-problema',   'Wrench',             'Treino',           10, true),
  ('simuladorresultados','Resultados do simulador', 'BarChart2',      'Treino',           20, true),
  ('treinamentos',      'Treinamentos',         'GraduationCap',      'Treino',           30, true),
  ('checklist',         'Check-list',           'ListChecks',         'Treino',           40, true),

  -- Central de Ajuda
  ('procedimentos',     'Procedimentos',        'FileText',           'Central de Ajuda',  0, true),
  ('problemastecnicos', 'Problemas técnicos',   'Wrench',             'Central de Ajuda', 10, true),
  ('changelog',         'Novidades',            'Star',               'Central de Ajuda', 20, true),
  ('suggestions',       'Sugestões',            'Lightbulb',          'Central de Ajuda', 30, true),
  ('content',           'Conteúdo (legado)',    'FileText',           'Central de Ajuda',  1, false),

  -- Equipe e sistema
  ('users',             'Usuários',             'Users',              'Equipe e sistema',  0, true),
  ('unidades',          'Unidades',             'Globe',              'Equipe e sistema', 10, true),
  ('menu',              'Menu e abas',          'Menu',               'Equipe e sistema', 20, true),
  ('homemsg',           'Tela inicial',         'LayoutDashboard',    'Equipe e sistema', 30, true),
  ('taxonomy',          'Categorias',           'Tag',                'Equipe e sistema', 40, true),
  ('imagelibrary',      'Imagens',              'Image',              'Equipe e sistema', 50, true),
  ('organizacao',       'Organização das abas', 'Layers',             'Equipe e sistema', 21, false),

  -- Saem de vista (dados mantidos; Planos volta numa futura aba Produtos)
  ('appearance',        'Identidade',           'Palette',            'Equipe e sistema', 60, false),
  ('promoplans',        'Planos em promoção',   'DollarSign',         'Equipe e sistema', 61, false)
ON CONFLICT (tab_key) DO UPDATE SET
  label = excluded.label,
  icon = excluded.icon,
  group_name = excluded.group_name,
  position = excluded.position,
  visible = excluded.visible;
