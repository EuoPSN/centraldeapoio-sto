Página 2 do redesign OMNIA Apoio: a aba Scripts (hoje src/routes/_authenticated/scripts.tsx, com Biblioteca e Fluxo de Atendimento). Siga os tokens e regras da marca de docs/redesign-omnia/prompt-lovable-base-omnia.md.

Esboços aprovados (siga fielmente):
- docs/redesign-omnia/scripts-hub.png (entrada da aba)
- docs/redesign-omnia/scripts-biblioteca-v2.png (Biblioteca de mensagens)
- docs/redesign-omnia/fluxo-catalogo.png (escolha do fluxo)
- docs/redesign-omnia/fluxo-dentro.png (dentro de um fluxo)

Os textos, números e durações dos esboços são ilustrativos: tudo vem do banco. Esta etapa é SÓ redesign: não crie tabelas, colunas nem funcionalidades novas, e não mude como o admin cadastra mensagens, etapas e caminhos.

## Rotas
- /scripts → entrada (hub)
- /scripts/biblioteca → Biblioteca (aceita ?categoria=&sub=&msg= para links diretos)
- /scripts/fluxo → escolha do fluxo
- /scripts/fluxo/<fluxo> → dentro do fluxo (aceita ?etapa=)
Links antigos para /scripts com parâmetros devem continuar funcionando (redirecione para a tela certa). A busca global (Ctrl K) deve abrir a mensagem direto na Biblioteca com ela selecionada.

## 1. Entrada (hub) — scripts-hub.png
- Overline "SCRIPTS", título "O QUE VOCÊ VAI USAR AGORA?" (Cinzel 44/52, caixa alta, letter-spacing 0.08em), subtítulo em ink-muted.
- 4 cards de 232px lado a lado (empilham em telas estreitas), radius 14px, borda line, ícone em círculo de traço dourado:
  1. Fluxo de atendimento — selo "RECOMENDADO" (fundo gold, texto on-gold) e borda dourada. Rodapé: "N etapas por produto" ou equivalente real.
  2. Biblioteca de mensagens — rodapé com o total real de mensagens.
  3. Scripts de ligação — selo "EM BREVE", fundo sidebar, sem link.
  4. Roteiros de áudio — selo "EM BREVE", fundo sidebar, sem link.
- Abaixo, campo de busca (640px): "Ou busque uma mensagem pelo nome, texto ou atalho (/lead)…" que abre a busca global filtrada por mensagens.
- Sem mais nada na página.

## 2. Biblioteca — scripts-biblioteca-v2.png
- Cabeçalho: "Biblioteca de mensagens" (24px, Montserrat 600) + link "Ir para o Fluxo de atendimento →" em gold-text.
- Categorias como abas de texto no topo (sublinhado dourado na ativa, SEM contagem) e, à direita, "Buscar nesta categoria…".
- Três colunas:
  - Subcategorias à ESQUERDA (≈190px): lista de texto simples, sem caixas e sem contagem; só a selecionada mostra a contagem em gold-text, peso 600 e uma linha dourada de 2px à esquerda. Nomes curtos: remova do nome da subcategoria o prefixo que repete a categoria/grupo ("Filiação: Leads frios" → "Leads frios") apenas na exibição. Mostre as 9 com mais mensagens e um link "+ N subcategorias" que expande o resto. "Todas" no topo.
  - Lista de mensagens (≈400px): sem linhas divisórias, só espaço; TODAS as linhas com a mesma altura (64px): título (600) + 1 linha de prévia (ink-muted, cortada com reticências) + ícone de copiar à direita (sem moldura; com moldura só na selecionada). Fundo sidebar na linha selecionada. Ordenada por mais usadas (use a contagem de cópias que já existe).
  - Detalhe (resto): overline "CATEGORIA · SUBCATEGORIA", título 22px, linha de metadados (atalho, "usada N×", data de atualização), a mensagem num bloco surface-2 radius 12px renderizada como no WhatsApp (*negrito*, _itálico_, ~tachado~, emojis), botões "Copiar mensagem" (gold) e "Sem formatação" (contorno). Abaixo, a descrição/observação que já existe em cada mensagem (hoje aparece com 📝), como "Quando usar: …". Sem descrição: o bloco some.
- Campos para preencher dentro da mensagem (ex.: a palavra nome em itálico, ou o padrão de variável que o projeto já usa) aparecem em gold-text com sublinhado tracejado, só na visualização; o texto copiado continua igual ao original.
- "Copiar mensagem" copia com a formatação do WhatsApp (asteriscos, sublinhados); "Sem formatação" copia o texto limpo. Continue registrando a cópia na contagem de uso.
- Abrir a Biblioteca seleciona a primeira mensagem da lista automaticamente.

## 3. Escolha do fluxo — fluxo-catalogo.png
- Título "Fluxo de atendimento" + subtítulo "Escolha o fluxo pelo perfil do cliente."
- Categorias do fluxo como abas de texto (mesmo estilo da Biblioteca).
- Grade de cards (3 por linha em tela cheia): cada fluxo (subcategoria do fluxo) vira um card com:
  - Capa escura (120px) no gradiente da marca (#0B0B0B → #17131F → #2A1A42) com overline "PARA QUEM É" em #D4AF37. Nesta etapa NÃO há vídeo: no lugar do botão de play, deixe a capa só com o overline e o nome do fluxo em Cinzel. Prepare o componente para receber um vídeo no futuro (prop opcional), sem criar campo no banco.
  - Corpo: nome do fluxo (16px 600), uma linha de descrição se já existir algum campo de descrição para essa subcategoria (senão, nada), e "N etapas" em gold-text.

## 4. Dentro do fluxo — fluxo-dentro.png
- Coluna principal + painel à direita (≈340px) com a mensagem selecionada.
- Topo: nome do fluxo (24px) + "Categoria · N etapas". O bloco "Para quem é este fluxo" com vídeo fica de fora nesta etapa (virá na fase de funcionalidade); não deixe espaço vazio para ele.
- Trilha de etapas horizontal: círculos numerados ligados por linhas finas; etapas anteriores com ✓, a atual com círculo dourado e nome em peso 600. Clicar numa etapa vai até ela. Se não couber na largura, rola horizontalmente.
- Abaixo: "N. Nome da etapa" + "X mensagens" e as mensagens SÓ daquela etapa, no formato de linha da Biblioteca (título + atalho num selo pequeno + prévia de 1 linha + Copiar).
- Caminhos (sub-fluxos que já existem): quando a etapa tiver caminhos, mostre "O cliente respondeu…" com um botão contornado (borda tracejada) por caminho; ao escolher, a trilha passa a mostrar as etapas daquele caminho até ele voltar à etapa compartilhada.
- Rodapé: botão "← Etapa anterior" (contorno) e "Próxima etapa: <nome> →" (gold).
- Painel direito: overline "MENSAGEM SELECIONADA", título, a mensagem formatada, "Copiar mensagem" (gold, largura total) e a descrição como dica.

## Geral
- Remova os blocos que abrem e fecham por etapa e os cards dentro de cards do layout atual.
- Estados vazios com uma frase simples (ex.: "Nenhuma mensagem nesta subcategoria ainda.").
- Teste nos temas claro e escuro, em 1280px e 1920px.

Trabalhe numa branch omnia-scripts, rode build e typecheck e abra um Pull Request para a main. Não faça merge sozinho. No PR, liste as rotas novas e confirme que os links antigos e a busca global continuam funcionando.
