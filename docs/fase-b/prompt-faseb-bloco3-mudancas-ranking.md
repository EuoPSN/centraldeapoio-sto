Fase B, bloco 3 da OMNIA Apoio: **Aviso de mudanças** (Novidades com tipo Importante/Urgente e confirmação "Li e entendi", numa página própria) e **Ranking de qualidade top 3** (pódios mensais, cada atendente vê só os 3 primeiros e a própria porcentagem). Também remove o botão flutuante de Novidades e Central de Ajuda. Siga os tokens e regras da marca (docs/redesign-omnia/prompt-lovable-base-omnia.md) e o padrão lista + painel do Admin.

Pré-requisitos: Fase A e blocos 1 e 2 da Fase B na main (conversas_fichas, aquecimento_exercicios, aquecimento_sessoes, retomadas, retomada_eventos, cerebro_blocos, ia_uso, ia_limites; `escolherCartoes` do aquecimento). Se algo faltar, pare e avise.

Esboços aprovados (siga fielmente; nomes, números e textos são ilustrativos):
- docs/fase-b/novidades.png (página /novidades)
- docs/fase-b/inicio-mudanca.png (Início aprovado + faixas, destaques do mês e item no menu; o restante do Início NÃO muda)
- docs/fase-b/ranking-podios.png (página /ranking)
- docs/fase-b/admin-mudancas.png
- docs/fase-b/admin-ranking.png

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Valide com build e typecheck.
- IA: use src/lib/cerebro.ts (montarInstrucoes) e o gateway do Lovable com as constantes de src/lib/ai-models.ts. Não crie outro caminho de chamada.
- Banco é Lovable Cloud: entregue as migrações em ordem, com o SQL pronto para o SQL editor do Lovable. Toda tabela com escrita precisa de política explícita de INSERT/UPDATE, não só SELECT. Admin: `private.has_role(auth.uid(), 'admin'::app_role)`. Funções SQL de ranking e confirmações: SECURITY DEFINER com `set search_path`, conferindo o papel dentro da função.
- Pagamento é só cartão de crédito ou débito. A equipe só atende por mensagem. Nunca escreva "não é plano de saúde" em nenhum texto.

## 1. Remover o botão flutuante
- Remova o `ChangelogWidget` (botão de estrela com as abas Novidades e Central de Ajuda) de src/routes/_authenticated/route.tsx e apague o componente se ficar sem uso. NÃO apague dados nem tabelas.
- A Central de Ajuda continua no rodapé do menu. Confira se o que aparecia na aba "Central de Ajuda" do widget (Regras, Procedimentos, Artigos, Conversas Modelo, Documentos, Treinamentos) continua acessível pela busca global (Ctrl K) e pelas páginas atuais. Se algum tipo de conteúdo deixar de ter caminho, NÃO invente tela: liste no PR e me avise.

## 2. Novidades e Mudanças — tabelas
Evolua `changelog_entries` (hoje: title, summary, published, created_at). As existentes viram tipo "informativa". Colunas novas: tipo (informativa | importante | urgente, padrão informativa), origem (manual | auto), vale_a_partir (date, opcional), validade (date, opcional), link (rota interna, opcional, para "Ver o que mudou"), pergunta_checagem (jsonb opcional: {tema_id, pergunta, alternativas[{texto, correta}], explicacao}), exercicio_id (opcional, ligado a `aquecimento_exercicios`), usar_na_ia (boolean, padrão false; padrão true para importante e urgente), incorporada (boolean, padrão false), lembrete_em (timestamptz), publicada_em, criada_por.
- `changelog_confirmacoes`: entry_id, user_id, confirmado_em, acertou_checagem (boolean, nulo se não houver pergunta). Uma por pessoa por mudança. RLS: a pessoa cria e lê as próprias; admin lê todas.
- As Novidades automáticas que já existem (ficha publicada, objeção aprovada, nova versão de mensagem) continuam, agora com tipo "informativa" e origem "auto". Não exigem confirmação.
- Denominador das confirmações: usuários ativos com papel de atendente (reutilize a lista usada em Funcionários/check-list).

## 3. Página /novidades — novidades.png
- Item "Novidades" no menu, logo abaixo de Início, com bolinha dourada enquanto houver mudança importante ou urgente pendente para a pessoa.
- Tabs: "Para confirmar (N)", "Todas", "Importantes", "Informativas". Cartões de mudança importante (borda dourada; selo "Urgente" em vermelho discreto quando for o caso; "Vale a partir de <data> · publicada em <data>"; resumo; "Ver o que mudou →" quando houver link). Se houver pergunta de checagem, ela aparece dentro do cartão: a pessoa escolhe uma alternativa, vê a resposta certa e a explicação (acertando ou errando) e só então o botão "Li e entendi" fica ativo. Mudanças já confirmadas mostram "✓ Você confirmou em <data>". Informativas em lista simples por data. Rodapé: "Novidades importantes pedem "Li e entendi". Aqui você encontra o histórico de tudo o que mudou."
- Gravar a confirmação em `changelog_confirmacoes` (com acertou_checagem). Depois de passada a validade, a mudança sai de "Para confirmar" mas continua no histórico.
- Sem mudança pendente: estado vazio "Tudo em dia."

## 4. Avisos
- Início (inicio-mudanca.png): **só acrescente** (a) uma faixa dourada "N mudança(s) importante(s) para confirmar" com o título da mais antiga e o botão "Ver e confirmar" (leva a /novidades), (b) a faixa do aquecimento do bloco 2, que fica em estilo contornado (sem fundo dourado) quando houver a faixa de mudança acima dela e dourada quando for a única, e (c) a linha "Destaques de <mês anterior>" com um selo por pódio de porcentagem e ensina (nome do líder + "mais constante/respondida/evoluiu/ensina"), clique abre /ranking?aba=hall. A linha de destaques some se não houver fechamento do mês anterior. O restante do Início aprovado (boas-vindas, mensagem do dia, check-list, Pendências do admin, busca central, atalhos) NÃO muda.
- Notificação do Chrome **só para mudança Urgente**: uma vez por mudança por pessoa (controle em localStorage), reaproveitando o mecanismo e a permissão das notificações da retomada; só com a Omnia aberta; ao abrir a página e a cada 10 minutos, consulte as urgentes pendentes. Texto: "Mudança importante: <título>". Clicar abre /novidades. O botão "Lembrar quem falta" do Admin (seção 6) grava `lembrete_em` e dispara a mesma notificação, uma vez por valor de lembrete_em, para quem ainda não confirmou.
- Nada de mensagem automática para ninguém e nenhum bloqueio de tela.

## 5. IA sabe das mudanças e a checagem vira cartão
- Novo bloco automático **"Mudanças recentes"** no Cérebro: montado na hora a partir de `changelog_entries` com tipo importante ou urgente, publicada, usar_na_ia = true, incorporada = false e publicada nos últimos 30 dias, no formato "Mudança (vale a partir de DD/MM): título — resumo". Marque-o como linha automática na matriz "Quem usa o quê" (não editável, com selo "automático") e ligue por padrão em MarcIAna, O cliente disse, Copiloto, Retomada e Biblioteca. Quando a mudança for marcada como "Incorporada ao Playbook", sai do bloco.
- Pergunta de checagem: ao publicar uma mudança com pergunta, crie (ou atualize) um `aquecimento_exercicios` aprovado, tipo multipla_escolha, no tema escolhido, e ligue em `exercicio_id`. Altere `escolherCartoes` (bloco 2): se existir exercício de mudança publicado nos últimos 3 dias que a pessoa ainda não respondeu, ele ocupa o cartão 1 do aquecimento do dia seguinte.

## 6. Admin > Mudanças — admin-mudancas.png
- A seção atual "Novidades" do Admin vira **Mudanças** (mesmo lugar, grupo Atendimento): lista à esquerda (título, tipo, "N de M" confirmações, selo Publicada/Rascunho) com filtro por tipo e botão "+ Nova mudança"; painel à direita com tipo (Informativa, Importante, Urgente), vale a partir de, validade (opcional), "O que mudou" (texto), link para "Ver o que mudou" (rota interna), chave "Pergunta de checagem" (abre pergunta, 3 alternativas com a correta marcada, explicação e tema), chave "Usar na IA", barra de confirmações, "Falta confirmar: <nomes>", e botões "Lembrar quem falta", "Salvar edição" e "Incorporada ao Playbook". Mostre também a % de acerto da checagem.
- Em "O que precisa de você": "Mudanças sem confirmar" (importantes ou urgentes cuja data de vigência já chegou e ainda faltam confirmações).

## 7. Ranking — rota /ranking, ranking-podios.png
- Quatro pódios de qualidade + Treino. Cada cartão mostra **só os 3 primeiros** (número 1, 2, 3 no círculo dourado, nome, valor) e, embaixo, a linha da própria pessoa **só com o valor e o mês passado**, nunca o número da posição dela nem nomes fora do top 3. Se a pessoa estiver no pódio, a linha acrescenta "Você está no pódio.". "Como é calculado" abre uma explicação curta de cada pódio.
  1. **Mais constantes**: % das retomadas do mês feitas no dia do prazo (retomadas com prazo vencido no mês; "feita no dia" = primeiro "Enviei" até o fim do dia do prazo). Mínimo de retomadas no mês (config, padrão 15). Inspecione o esquema de `retomadas` e `retomada_eventos` para os nomes das colunas.
  2. **Mais respondidas**: entre as retomadas com pelo menos um "Enviei" no mês, % em que o cliente respondeu ou fechou. Mesmo mínimo.
  3. **Que mais evoluíram**: variação % da nota média do Simulador do mês sobre a do mês anterior, com pelo menos 3 simulações em cada mês.
  4. **Que mais ensinam**: conversas publicadas na biblioteca (`conversas_fichas` com autor e publicada_em no mês) + objeções aprovadas com crédito ao autor no mês. Valor em número de contribuições.
  5. **Treino no Simulador**: pontos do mês, com abas Atendimento e Solução de problemas (reutilize `getRankingPorPeriodo` e as regras de XP atuais; `xp`/`xp_problemas` continuam acumulando para os níveis).
- Tabs: Pódios, Hall do mês (campeões de cada pódio nos meses anteriores) e Meu histórico (o atual, sem mudança). O botão de zerar XP sai da tela; o ranking passa a ser mensal automático. Não apague a função antiga sem confirmar que nada mais a usa.
- O aquecimento e o Raio-X NÃO entram no Ranking.
- Fechamento do mês: tabela `ranking_hall` (mes, podio, posicao 1 a 3, user_id, valor, created_at; único por mes+podio+posicao). Sem cron: uma função idempotente `garantirFechamentoDoMesAnterior()` é chamada quando alguém abre /ranking ou o Início e grava o fechamento do mês anterior se ainda não existir.
- Funções SQL: `ranking_podios(mes)` (qualquer autenticado) devolve, por pódio, apenas o top 3 (nome e valor) e o valor da própria pessoa e do mês anterior; `ranking_admin(mes, podio)` (admin) devolve a lista completa com valor, total de retomadas e se entra no pódio. Nunca devolva a posição de ninguém fora do top 3 para atendentes.
- `ranking_config` (uma linha): podios ativos (um boolean por pódio), minimo_retomadas (15), periodo ('mensal'). `ranking_ocultos` (mes, user_id): pessoas ocultas no mês somem dos pódios, sem apagar dados.

## 8. Admin > Ranking — admin-ranking.png
- Seção **Ranking** (grupo Treino e evolução): chips por pódio, tabela completa do mês (posição, atendente, valor, total no mês, "Entra no pódio" ou "Abaixo do mínimo") que só o admin vê; painel com liga/desliga de cada pódio, mínimo de retomadas, período e "Ocultar do mês" (escolher a pessoa). Rodapé: "Cada atendente vê só os 3 primeiros e a própria porcentagem, sem número de posição."

## 9. Relatório Excel
No relatório de inteligência (3B e bloco 2): aba **Mudancas** (admin: mudança, tipo, publicada em, vale a partir de, confirmadas, total, % de acerto da checagem; e aba **Confirmacoes**: mudança, atendente, confirmado em, acertou; o atendente recebe só as próprias confirmações) e aba **Ranking** (admin: mês, pódio, atendente, valor, posição, entra no pódio; atendente: aba "Meu_ranking" com pódio, o próprio valor e o do mês anterior, sem posição). Atualize o LEIA-ME. Nunca telefone, nome nem fala de cliente.

## Geral
- Respeite temas claro e escuro, estados vazios e de erro, e o padrão lista + painel do Admin.
- Trabalhe numa branch fase-b-bloco3, **um commit por seção** (1 remover widget, 2 tabelas de mudanças, 3 página /novidades, 4 avisos e Início, 5 IA e aquecimento, 6 Admin Mudanças, 7 Ranking, 8 Admin Ranking, 9 Excel), rode build e typecheck e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações em ordem com o SQL pronto para o SQL editor do Lovable, o que ficou sem caminho depois de remover o widget (se algo), como ficou a definição de "feita no dia" nas retomadas, e a lista do que o ranking mostra para atendente e para admin.
