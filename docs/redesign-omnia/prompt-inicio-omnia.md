Página 1 do redesign OMNIA Apoio: a Início (src/routes/_authenticated/index.tsx). A base (cores, fontes, menu, tema, login) já está pronta; siga os mesmos tokens e regras da marca de docs/redesign-omnia/prompt-lovable-base-omnia.md.

Esboço aprovado: docs/redesign-omnia/inicio-B.png. Siga-o fielmente. Os números do esboço são ilustrativos: TUDO na página vem de dados reais do banco, nada de texto fixo de exemplo.

## Estrutura (de cima para baixo, só isto)

### 1. Faixa de boas-vindas
- Painel escuro com radius 16px, gradiente sutil #0B0B0B → #17131F → #2A1A42 (canto inferior direito) e duas órbitas douradas finas (#D4AF37, 1–1.5px, 25–40% de opacidade) cortando o canto direito. Igual nos temas claro e escuro.
- Linha 1 (overline, Montserrat 300, caixa alta, letter-spacing 0.22em, #B8B2A6): data de hoje por extenso em pt-BR ("Quarta-feira, 18 de novembro").
- Linha 2: "OLÁ, " + PRIMEIRO NOME do usuário em Cinzel 44/52, caixa alta, letter-spacing 0.1em; "OLÁ," em #F5F5F0 e o nome em #D4AF37.
- Linha 3: a mensagem do dia que já existe (pickHomeMessage, incluindo a de aniversário), como UMA linha em Montserrat 300 15px #D9D4C9 entre aspas, com o autor/título em seguida em #D4AF37, 13px, caixa alta. As cores e fontes escolhidas pelo admin para essa mensagem deixam de ser usadas aqui (a marca manda). Sem mensagem ativa: a linha some.
- Botões: "Continuar check-list" (fundo #D4AF37, texto #0B0B0B, leva a /checklist) e "Abrir Scripts" (contorno #6E6680, texto claro, leva a /scripts).
- À direita, um bloco discreto "CHECK-LIST DE HOJE" com o progresso real (getMyChecklistToday): número grande de itens feitos + "de N itens" + barra dourada. Check-list completo: "Tudo feito hoje" e o botão principal vira "Ver check-list". Sem itens configurados: o bloco e o botão principal somem, e "Abrir Scripts" vira o botão dourado.

### 2. Linha de pendências (SÓ para admin)
Logo abaixo da faixa, uma única linha de texto pequeno (13px): "Pendências" em ink 600 + "X scripts para aprovar · Y sugestões novas · Z sem check-list hoje" em ink-muted + link "Ver tudo →" em gold-text.
- X: rascunhos de mensagens aguardando aprovação (fila do Criar Script).
- Y: sugestões ainda não vistas/respondidas.
- Z: usuários ativos sem nenhum item marcado no check-list de hoje (reaproveite o resumo do admin do check-list).
- Cada parte é um link para a tela correspondente do admin. Partes com zero somem; tudo zero: a linha some. Não-admin nunca vê.

### 3. Busca central
- Título "DO QUE VOCÊ PRECISA AGORA?" em Cinzel 22px, letter-spacing 0.08em, centralizado.
- Campo grande (máx. 760px, centralizado, radius 14px, borda line-strong, padding 18px 20px, 16px de texto): placeholder "Busque um preço, uma mensagem, uma clínica ou pergunte à MarcIAna…", ícone de lupa à esquerda e "Ctrl K" à direita.
- Ao digitar, abre a busca global que já existe (GlobalSearch) com o texto digitado, mostrando os resultados de todas as fontes. No fim da lista, sempre a opção "Perguntar à MarcIAna: “<texto>”", que abre /marciana com uma conversa nova já enviando essa pergunta.
- Abaixo, 4 atalhos em pílula (borda line, radius 999px, 13px, Montserrat 500): Scripts (/scripts), Amor Saúde (página atual de preços, /precos), MarcIAna (/marciana), Simulador IA (/simulador).

E mais nada abaixo. A página termina aí.

## O que sai da Início
- Carrossel de planos em promoção, card antigo do check-list, ranking, contadores de preços/exames/procedimentos, os 6 atalhos coloridos, os cards "Vamos testar seu atendimento" e "Treinar Solução de Problemas" e o card grande colorido da mensagem do dia.
- Remova as queries que só serviam a esses blocos (pricing, exames, procedimentos, ranking-home, client_profiles de treino, promo-plans) para a página carregar mais rápido.
- NÃO apague as tabelas nem as telas de admin desses dados (planos em promoção vão para uma futura aba de Produtos).

## Também nesta etapa
- Remova do site inteiro o estilo de etiqueta de gôndola (preço com ponta recortada, vermelho ou amarelo) que sobrou do primeiro redesign. Onde houver preço, use texto normal da marca até a página ser redesenhada.
- No menu lateral, renomeie "Tabela de Preços" para "Amor Saúde" (mesma rota por enquanto).

## Comportamento
- Larguras: tela cheia é o uso principal; abaixo de 900px a faixa empilha (o bloco do check-list vai para baixo do texto) e a busca ocupa 100%.
- Estados de carregamento: esqueleto suave na faixa e na linha de pendências, sem "pulos" de layout.
- Respeite prefers-reduced-motion.

Trabalhe numa branch omnia-inicio, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR, liste o que foi removido e confirme que nenhum texto de exemplo do esboço ficou fixo no código.
