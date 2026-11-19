Página 6 do redesign OMNIA Apoio: Simulador IA (rota /simulador-ia, componentes src/components/SimuladorIA.tsx e SimuladorProblema.tsx, resultados em simulator_results) e a retirada do histórico pessoal da página Ranking. Siga os tokens e regras da marca de docs/redesign-omnia/prompt-lovable-base-omnia.md.

Esboços aprovados (siga fielmente):
- docs/redesign-omnia/simulador-lista.png (escolha do cliente)
- docs/redesign-omnia/simulador-conversa.png (simulação)
- docs/redesign-omnia/simulador-avaliacao.png (avaliação)
- docs/redesign-omnia/simulador-minhas.png (Minhas simulações)

Perfis, notas, nomes e conversa dos esboços são ilustrativos.

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Eu reviso as telas. Valide com build e typecheck.
- Parta do estado atual da main. Mantenha o modelo de IA atual (constantes de src/lib/ai-models.ts), os estados do perfil (client_profile_states), os atalhos "/" e o fluxo de várias mensagens antes de "Aguardar resposta". Mantenha o XP da gamificação como está.

## 1. Cabeçalho e abas
- Título "Simulador IA" (24px) + linha "Treine com clientes virtuais antes de falar com os reais."
- Abas de texto: Atendimentos · Solução de problemas · Minhas simulações. A aba fica na URL (?aba=atendimentos|problemas|minhas). Mantenha ?perfil=<id> abrindo direto a simulação com aquele perfil (usado pela Início).

## 2. Escolha do cliente — simulador-lista.png
- Faixa "TREINE ESTE HOJE" (borda dourada): o perfil com a menor melhor-nota do usuário entre os já treinados, ou, se houver, um perfil nunca treinado (prioridade para nunca treinado de dificuldade Fácil/Médio). Mostra iniciais, nome do perfil, "Sua menor nota até agora: X. <categoria> · <dificuldade>" (ou "Você ainda não treinou com este perfil."), botões "Cliente surpresa" (contorno) e "Começar" (dourado).
- "Cliente surpresa": sorteia um perfil respeitando os filtros de categoria/dificuldade ativos e abre a simulação sem mostrar qual perfil foi sorteado (o nome do perfil só aparece na avaliação).
- Filtros como menus (Categoria: Todas ⌄, Dificuldade: Todas ⌄) + busca "Buscar perfil…".
- Lista em linhas de 50px: Perfil (600) · Categoria (muted) · Dificuldade (ponto 8px + palavra: Fácil = line-strong, Médio = gold, Difícil = ink) · Sua melhor nota ("88 · 5×", ou "Nunca treinou" em muted) · "Treinar →" (link dourado). Clique na linha também abre.
- Sem selos coloridos (verde/amarelo/vermelho) em lugar nenhum desta página.

## 3. Simulação — simulador-conversa.png
- Coluna esquerda (≈260px): círculo com as iniciais do nome do cliente virtual (substitui o ClienteAvatar ilustrado), nome, "Cliente virtual", e só os dados que o atendente teria de verdade: Região, CPF e, se existir no perfil, Origem do lead. **Não mostrar personalidade, nome do perfil nem dificuldade durante a conversa.** No lugar, um aviso com borda tracejada: "A personalidade e o perfil desta cliente aparecem na avaliação, quando você encerrar." Botão "Trocar cliente".
- Chat com forma de WhatsApp nas cores OMNIA (sem verde do WhatsApp): cabeçalho com iniciais, nome e "online"; área de mensagens em fundo sidebar; mensagens do cliente à esquerda (surface com borda line, canto superior esquerdo reto), do atendente à direita (surface-2, canto superior direito reto); horário pequeno em cada balão; mensagens seguidas do mesmo lado ficam agrupadas; indicador "<Nome> está digitando…" enquanto a IA responde.
- Rodapé: campo "Digite sua mensagem… (use / para respostas rápidas)", botões "Enviar" (contorno) e "Aguardar resposta" (dourado), e a linha de ajuda "Você pode mandar várias mensagens seguidas; a cliente responde quando você clicar em 'Aguardar resposta'." Anexo de imagem continua.
- Botão "Encerrar e avaliar" (dourado) no cabeçalho do chat.

## 4. Avaliação — simulador-avaliacao.png
- Coluna esquerda (cartão): overline "SUA NOTA", nota grande em Cinzel (gold-text) "/100", barra fina dourada com o progresso, linha "+N XP · melhor nota com este perfil: X", bloco "ELA ERA / ELE ERA" (surface-2) com o nome do perfil em negrito + resumo da personalidade, botões "Treinar de novo com este cliente" (dourado, reabre o mesmo perfil) e "Outro cliente" (contorno, volta à lista).
- Coluna direita: seções com overline — Pontos fortes (✓ dourado), O que melhorar (→), Erros (×) — cada item com o trecho citado da conversa embaixo (texto muted com fio à esquerda), quando houver; e "COMO EU MANDARIA": a mensagem mais fraca do atendente riscada + a reescrita, num bloco com borda dourada à esquerda.
- Ajuste o prompt de avaliação para devolver também: `trechos` (para cada ponto, o trecho exato da conversa a que se refere, opcional), `mensagem_fraca` (texto exato) e `reescrita`. Salve tudo em simulator_results (novas colunas jsonb/text, opcionais). Avaliações antigas sem esses campos continuam abrindo (só não mostram trechos/reescrita).
- Sem cores verde/amarelo/vermelho na nota.

## 5. Solução de problemas
- Mesma moldura das seções 2 a 4: lista de cenários (com sua melhor nota e "Treinar →"), simulação e avaliação no mesmo visual. Mantenha a lógica atual de SimuladorProblema; mude só a apresentação. Sem "Treine este hoje" nesta aba.

## 6. Minhas simulações — simulador-minhas.png
- 4 indicadores em cartões simples: Simulações · Média geral · Melhor nota · Mais treinado (dados que hoje estão em "Meu desempenho" no Ranking).
- Gráfico de linha "Evolução · últimas 10 simulações" (linha e pontos dourados, sem área preenchida). Linha tracejada de meta só se houver meta configurada: crie a configuração "Nota de referência do simulador" no Admin (número opcional, padrão 70; vazio = sem linha).
- Histórico: Data · Cliente (nome do perfil) · Dificuldade (ponto) · Nota · "Ver →", abrindo a avaliação completa (mesmo layout da seção 4). Filtro simples por aba (Atendimentos / Solução de problemas).
- Admin (aba de resultados do simulador que já existe): continua vendo as simulações de todos.

## 7. Ranking
- Remova da página /ranking o bloco "Meu desempenho" (4 números) e o "Histórico de simulações" com o diálogo de avaliação. A página fica só com o ranking da equipe (o redesign dela vem depois). Onde houver texto/link apontando para o histórico, aponte para /simulador-ia?aba=minhas.

## Geral
- Estados vazios simples ("Nenhuma simulação ainda. Comece pelo Treine este hoje.").
- Respeite temas claro e escuro.

Trabalhe numa branch omnia-simulador, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações a rodar no SQL Editor do Supabase (em ordem), colunas novas, a configuração nova no Admin e o que saiu do Ranking.
