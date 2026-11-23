# Mapa do Painel Admin da OMNIA Apoio (23/11/2026)

Levantamento feito lendo o código: seções registradas no banco, o componente de cada uma, as tabelas que cada uma edita, o menu do site e a tela "O que precisa de você". Nada foi alterado.

## 1. Retrato hoje
- **47 seções** registradas; **41 visíveis** e 6 escondidas.
- Visíveis por grupo: Atendimento **15**, Inteligência 6, Treino **10**, Central de Ajuda 4, Equipe e sistema 6.
- 105 tabelas no banco; 24 não aparecem diretamente em nenhuma tela do Admin (são dados de uso, histórico ou sistema, como `access_logs`, `ticket_historico`, `tour_vistos`).
- Entrada do Admin: "O que precisa de você", com 15 tipos de pendência. Quase todas as linhas ficam em 0 e aparecem apagadas, misturadas com as que têm trabalho.

## 2. O que atrapalha de verdade
1. **Atendimento tem 15 seções.** Mistura o que o atendente consulta (Mensagens, Fluxos, Amor Saúde, Contatos, Dúvidas, Roteiros) com a máquina de vendas (Objeções, Fechamento, Economia, Cadência, Motivos de perda, Mensagens que vendem, Conversas enviadas). É a lista mais longa e a mais usada.
2. **Treino mistura conteúdo e números da equipe.** Mapa da equipe, Ranking, Resultados do simulador e Extensão do WhatsApp não são treino: são acompanhamento. Raio-X da equipe está em Inteligência pelo mesmo motivo.
3. **Seções escondidas que ainda existem no código:** Conteúdo (legado) abre a mesma tela de Procedimentos; Identidade não tem tela nenhuma; Planos em promoção espera a futura aba Produtos; Análise de Scripts, Organização das abas e Teleconsulta estão fundidas dentro de outras seções (isso é proposital).
4. **Nomes que confundem:** "Imagens" no Admin é a biblioteca de imagens, enquanto "Biblioteca" no site é de conversas que fecharam; "Novidades" no Admin é, na prática, o controle de mudanças e confirmações; "Conversas enviadas" é a fila de revisão da biblioteca.
5. **Entrada do Admin:** linhas zeradas ocupam espaço igual ao das que precisam de você. Os rascunhos novos de Roteiros de áudio e Scripts de ligação, e a Teleconsulta sem especialidades, não geram aviso (as Dúvidas frequentes já geram).
6. **Código:** `CoreTabs.tsx` guarda quatro seções sem relação (IA e indexação, Procedimentos, Problemas técnicos, Usuários); `ClienteDisseAdmin.tsx` guarda quatro; `PricingTab.tsx` tem mais de mil linhas. Não aparece para o usuário, mas torna cada ajuste mais lento e arriscado.

## 3. O que o site usa e não dá para editar pelo Admin
- **Textos dos tutoriais (tours):** estão no código (`src/lib/tours.ts`). Mudar uma frase exige pedido ao Claude Code e PR.
- **Páginas antigas sem link no menu:** `/dashboard`, `/funcionarios`, `/crm-leads`, `/crm-prospeccao` e `/motor-decisao`. Algumas ainda aparecem na busca global. A dúvida é se alguma ainda é usada.
- **Estatísticas de acesso:** `access_logs` é lido pela página `/dashboard`, que não tem link. Se você quer ver quem usa o quê, hoje só chega por endereço direto.
- O resto do que o site mostra (menu, mensagem do dia, categorias, imagens, quizzes, funil, planos, contatos, unidades) já tem tela de edição.

## 4. Proposta de nova organização (as mesmas 41 seções, em 7 grupos)
| Grupo | Seções |
|---|---|
| **Atendimento** (7) | Mensagens e scripts · Fluxos · Roteiros de áudio · Scripts de ligação · Amor Saúde (com Teleconsulta) · Dúvidas frequentes · Contatos |
| **Vendas e retomada** (8) | Objeções · Objeções novas · Fechamento · Economia · Cadência de retomada · Motivos de perda · Mensagens que vendem · Conversas enviadas |
| **Inteligência** (5) | Cérebro da Omnia · Base IA · IA e indexação · Conhecimento do cliente · MarcIAna |
| **Treino** (6) | Perfis de cliente · Situações-problema · Treinamentos · Check-list · Banco de exercícios · Aquecimento |
| **Equipe e resultados** (5) | Raio-X da equipe · Mapa da equipe · Resultados do simulador · Ranking · Extensão do WhatsApp |
| **Central de Ajuda** (4) | Procedimentos · Problemas técnicos · Mudanças e novidades · Sugestões |
| **Sistema** (6) | Usuários · Unidades · Menu e abas · Tela inicial · Categorias · Biblioteca de imagens |

Nenhuma das 41 seções visíveis some e nenhum dado muda: é só reagrupar e renomear (migração em `admin_sections`, sem tocar nas tabelas). Só saem do código as duas seções mortas (Conteúdo legado e Identidade).

## 5. O que entraria no prompt do Claude Code
1. Reagrupar e renomear conforme a tabela acima.
2. Remover do código as seções mortas (Conteúdo legado e Identidade); manter Planos em promoção até existir a aba Produtos.
3. Entrada do Admin: pendências com trabalho em cima; as zeradas recolhidas em "Em dia (N)"; novos avisos para rascunhos (Roteiros de áudio, Scripts de ligação, Teleconsulta vazia); contador por grupo no menu lateral do Admin.
4. Separar `CoreTabs.tsx`, `ClienteDisseAdmin.tsx` e as demais em um arquivo por seção, sem mudar o comportamento.
5. Conforme a sua decisão: tratar as páginas antigas (remover ou ligar ao menu) e a página de acessos.
