Fase B, bloco 2 da OMNIA Apoio: **Aquecimento de 5 minutos** (treino diário sob medida, com aviso no começo do dia) e **Mapa de domínio** (nível de cada atendente por tema, com visão da equipe para o Paulo). Siga os tokens e regras da marca (docs/redesign-omnia/prompt-lovable-base-omnia.md), o padrão lista + painel do Admin e o olho da MarcIAna (componente MarcianaEye) no estado "pensando" quando a IA estiver corrigindo.

Pré-requisitos: Fase A inteira e o bloco 1 da Fase B na main (cerebro_blocos, ia_uso, ia_limites, raiox_resultados, retomadas, cliente_disse_uso, objecoes; Simulador IA; notificações do Chrome da retomada). Se algo faltar, pare e avise.

Esboços aprovados (siga fielmente; nomes, números e textos são ilustrativos):
- docs/fase-b/inicio-aquecimento.png (faixa no Início)
- docs/fase-b/aquecimento-cartao.png (cartão de objeção escrita, 2 de 3)
- docs/fase-b/aquecimento-resultado.png (fim do aquecimento)
- docs/fase-b/meu-mapa.png
- docs/fase-b/admin-mapa-equipe.png
- docs/fase-b/admin-banco-exercicios.png
- docs/fase-b/admin-aquecimento.png

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Valide com build e typecheck.
- IA: use src/lib/cerebro.ts (montarInstrucoes) e o gateway do Lovable com as constantes de src/lib/ai-models.ts. Não crie outro caminho de chamada.
- Banco é Lovable Cloud: entregue as migrações em ordem, com o SQL pronto para o SQL editor do Lovable. Toda tabela com escrita precisa de política explícita de INSERT/UPDATE, não só SELECT. Admin: `private.has_role(auth.uid(), 'admin'::app_role)`.
- Pagamento é só cartão de crédito ou débito. A equipe só atende por mensagem. Nunca escreva "não é plano de saúde" em nenhum texto. Nunca invente valores ou regras de produto: a IA só usa o que estiver no Cérebro e na base de conhecimento.

## 1. Tabelas
- `dominio_temas`: id, nome, descricao, ordem, ativo. Seed: Planos (Prata, Ouro e Diamante: valores, dependentes, carência), Amor Saúde (consultas, exames, dentista e como agendar), Fechamento (pagamento no cartão de crédito ou débito, link e dados), Objeções (respostas e perguntas para avançar), Refuturiza, Energia de Todos, TIM.
- `aquecimento_exercicios`: id, tema_id, tipo (multipla_escolha | escrita | habito), pergunta, contexto (a fala do cliente, para escrita), alternativas jsonb [{texto, correta}], resposta_aprovada (para escrita), habito_chave (para habito, ligado a uma regra do Padrão de escrita ou a uma técnica do Cérebro), explicacao, fonte, objecao_id (opcional), status (rascunho | aprovado | arquivado), criado_por (ia | admin), aprovado_por, created_at, updated_at. RLS: atendente lê só os aprovados; admin tudo.
- `aquecimento_sessoes`: id, user_id, data (date, fuso America/Sao_Paulo), tipo (diaria | tema), tema_id (para tipo tema), status (aberta | concluida), iniciada_em, concluida_em. No máximo uma sessão diária por pessoa por dia.
- `aquecimento_respostas`: sessao_id, user_id, exercicio_id, tema_id, tipo, acertou (boolean), nota (int 0–10, só escrita), created_at. **O texto digitado pelo atendente nunca é guardado**, nem a frase de feedback da IA: ela só aparece na tela. RLS: a pessoa lê e grava as próprias; admin lê todas.
- `aquecimento_prefs`: user_id, notificar (boolean, padrão true).
- `aquecimento_config` (uma linha): horarios text[] (padrão {08:30, 12:00, 15:00}), cartoes_por_dia (3), janela_dominio_dias (60), min_respostas (3), limiar_dominando (0.75), nota_acerto (7).
- Limite de correções por IA: use a tabela `ia_limites` (ferramenta "aquecimento", padrão 5 por dia) e `ia_uso`. Inclua "aquecimento" na lista de ferramentas do Cérebro e na matriz "Quem usa o quê" (blocos padrão: playbook, mapeamento de objeções, padrão de escrita, etapas do funil, SPIN).

## 2. Aquecimento — rota /aquecimento (esboços inicio-aquecimento, aquecimento-cartao, aquecimento-resultado)
- Início: **só acrescente** a faixa dourada "Seu aquecimento de hoje está pronto · 5 minutos" com "Começar", logo abaixo da faixa de boas-vindas (e da linha de Pendências do admin, quando houver) e acima da busca central, como no esboço. O restante do Início aprovado (boas-vindas, mensagem do dia, check-list, Pendências, busca central e atalhos) **não muda**; o esboço é a página aprovada (docs/redesign-omnia/inicio-B.png) com a faixa nova. Depois de concluído, a faixa vira uma linha discreta "Aquecimento de hoje concluído · N dias nesta semana". No menu Treino e evolução, itens "Aquecimento" (com ponto dourado enquanto pendente) e "Meu mapa".
- Seleção (função de servidor `escolherCartoes(user_id)`): 3 cartões por dia. (1) Produto, múltipla escolha, do tema com pior nível do atendente (ou "não testado"), sem repetir exercício respondido nos últimos 14 dias. (2) Objeção, escrita: a objeção que o atendente mais encontrou nos últimos 30 dias em `cliente_disse_uso`, ou a mais fraca do mapa; sem dados, o tema Objeções do banco. (3) Hábito de escrita: o hábito mais frequente nos `raiox_resultados` dos últimos 30 dias; sem dados, uma regra do Padrão de escrita em rodízio. Sem exercício aprovado suficiente, complete com a equipe-wide e mostre menos cartões em vez de inventar.
- Múltipla escolha: resposta imediata + a explicação. Sem IA.
- Hábito de escrita: o atendente reescreve uma mensagem. Corrija em **código** as regras mecânicas do Padrão de escrita (siglas como "vc", "kkk" repetido, mais de uma pergunta por mensagem, mais de 4 linhas sem quebra, tratamentos proibidos, "não é plano de saúde"). Só use IA para o que for subjetivo.
- Objeção escrita (esboço aquecimento-cartao): campo de texto + "Enviar para nota". Função de servidor `corrigirResposta`: tire telefone, CPF e e-mail do texto antes da IA, use o Cérebro (ferramenta "aquecimento") e devolva nota de 0 a 10 e uma frase do que melhorar, comparando com `resposta_aprovada`. Mostre a nota, a frase e a resposta aprovada (como no esboço de resultado). Grave só a nota e o acerto (nota >= nota_acerto). Passou do limite diário: "Você já usou as 5 correções de hoje. Este cartão volta amanhã." e os cartões sem IA continuam. "Pular este cartão" é permitido e não conta como erro. Erro da IA: "Não consegui corrigir agora. Tente de novo." sem perder o texto digitado.
- Resultado (esboço aquecimento-resultado): um bloco por cartão, "Acertou" ou "Nota N/10"; à direita, se foi mal em objeção (nota abaixo de nota_acerto): "Quer treinar 10 minutos no Simulador?" com o perfil de cliente mais parecido (reutilize a escolha de perfil do botão "Treinar no Simulador" do Raio-X) e "Treinar agora"/"Agora não"; abaixo, "Seu mapa" com a mudança de nível, se houve. Se a sessão foi concluída, grave status concluida.
- Primeira vez: aviso curto "O Paulo vê a sua adesão e o seu nível por tema, não o que você escreve." com "Entendi".
- O aquecimento **não** entra no Ranking.

## 3. Aviso no começo do dia
- Notificações do Chrome nos horários de `aquecimento_config.horarios` (padrão 08:30, 12:00 e 15:00, fuso America/Sao_Paulo), reaproveitando o mecanismo e o pedido de permissão das notificações da retomada.
- Regras: só dispara se a aba da Omnia estiver aberta, se a pessoa ainda não concluiu o aquecimento diário e se `aquecimento_prefs.notificar` for verdadeiro. No máximo uma notificação por horário por dia (controle por data + horário em localStorage). Se a pessoa abrir a Omnia depois de um horário, não dispare notificação atrasada: só a faixa no Início. Texto: "Seu aquecimento de hoje está pronto · 5 minutos"; clicar abre /aquecimento.
- O atendente liga/desliga em "Avisos do aquecimento" no mesmo lugar onde liga as notificações da retomada (se não houver tela de preferências, crie "Notificações" no menu do avatar). Desligar não afeta a faixa no Início.
- Nada de cobrança automática: faltar não gera mensagem para ninguém.

## 4. Meu mapa — rota /meu-mapa (esboço meu-mapa)
- Lista dos temas ativos com nível (Não testado | Aprendendo | Dominando), contagem de respostas e % de acertos, e "Treinar este tema". O botão abre /aquecimento?tema=<id>: sessão de 3 cartões só daquele tema (sessão tipo "tema": conta para o mapa, não conta para a adesão diária).
- Nível: janela de 60 dias; menos de 3 respostas = "Não testado"; acertos/respostas >= limiar_dominando = "Dominando"; entre o mínimo e o limiar = "Aprendendo". Função SQL com SECURITY DEFINER que devolve só os dados da própria pessoa.
- Se as avaliações do Simulador já tiverem informação que permita ligar a um tema (por exemplo objeções, com nota >= nota_acerto), inclua; se não, calcule só com o aquecimento e ajuste o texto do rodapé do esboço para dizer a verdade. Diga no PR qual caminho tomou.
- Rodapé do esboço mantido: o nível vem do que a pessoa acertou; o Paulo vê o mapa da equipe; o aquecimento não entra no Ranking.

## 5. Admin (grupo Treino e evolução)
- **Mapa da equipe** (admin-mapa-equipe.png): grade temas × atendentes com os três níveis; painel do tema mais fraco (contagem por nível, quem mais precisa de reforço) e "Abrir treinamento sobre <tema>", que abre a página Treinamentos já com o tema na busca. O Paulo vê níveis e contagens, nunca texto digitado. Função SQL de admin que devolve o mapa da equipe; o atendente não acessa.
- **Banco de exercícios** (admin-banco-exercicios.png): lista (tema, tipo, status "Rascunho da IA" ou "Aprovado") e painel de edição (pergunta, alternativas com a correta marcada, "Por que esta é a certa", fonte, aviso para conferir valores). Botão "Gerar rascunhos para um tema": função `gerarRascunhosExercicios(tema, tipo, quantidade)` (somente admin, ferramenta "aquecimento" do Cérebro, só com fatos do Cérebro e da base de conhecimento; sem fato disponível, não gera). Ações: "Aprovar", "Salvar edição", "Descartar". Nenhum exercício chega à equipe sem aprovação. Conte os rascunhos pendentes em "O que precisa de você" ("Exercícios para aprovar").
- **Aquecimento** (admin-aquecimento.png): adesão da semana por atendente ("N de 5" dias com aquecimento diário concluído), os 3 horários dos avisos (editáveis), o limite de correções por IA por dia (edita a linha "aquecimento" de ia_limites) e os temas de domínio (adicionar, renomear, desativar, reordenar). Aviso: "O atendente sabe que você vê a adesão. Faltar não gera cobrança automática."

## 6. Relatório Excel
No relatório de inteligência (3B), acrescente as abas **Aquecimento** (data, atendente, tema, tipo do cartão, tipo da sessão, resultado: acertou/errou ou nota) e **Mapa_de_dominio** (atendente, tema, nível, respostas na janela, acertos). Atualize o LEIA-ME com as colunas novas. Nunca o texto digitado pelo atendente. O atendente baixa só os próprios dados; o admin, os da equipe.

## Geral
- Respeite temas claro e escuro, estados vazios e de erro, e o padrão lista + painel do Admin.
- Trabalhe numa branch fase-b-bloco2, **um commit por seção** (1 tabelas, 2 aquecimento, 3 avisos e Início/menu, 4 Meu mapa, 5 Admin, 6 Excel), rode build e typecheck e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações em ordem com o SQL pronto para o SQL editor do Lovable, tabelas e funções novas, como ficou a seleção dos cartões, se o Simulador entrou no mapa, e como ficaram os limites de IA e a privacidade (o que é e o que não é guardado).
