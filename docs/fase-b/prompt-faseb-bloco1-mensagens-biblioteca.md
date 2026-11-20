Fase B, bloco 1 da OMNIA Apoio: **Mensagens que vendem** (selo de desempenho nas mensagens da retomada e do fechamento, com sugestão de nova versão pela IA) e **Conversas que fecharam** (biblioteca de fichas de aprendizado enviadas pelos atendentes e aprovadas pelo Paulo). Siga os tokens e regras da marca (docs/redesign-omnia/prompt-lovable-base-omnia.md) e o padrão lista + painel do Admin.

Pré-requisitos: Fase A inteira na main (objecoes, fechamento_casos, retomadas, cadencia_mensagens, retomada_eventos, cerebro_blocos, ia_uso, ia_limites; rotas /retomar, /copiloto, /raiox, /scripts/cliente-disse; leitor de conversa .txt do Copiloto, que aceita WhatsApp comum e Ztalk). Se algo faltar, pare e avise.

Esboços aprovados (siga fielmente; nomes, números e textos são ilustrativos):
- docs/fase-b/biblioteca-conversas.png (Biblioteca > aba "Conversas que fecharam")
- docs/fase-b/biblioteca-enviar.png (janela ao clicar "Fechou" na retomada)
- docs/fase-b/retomar-selo.png (selo nas mensagens do Retomar hoje)
- docs/fase-b/clientedisse-casos.png ("Casos parecidos que fecharam" em O cliente disse…; o mesmo bloco, compacto, vai no Copiloto)
- docs/fase-b/admin-mensagens-vendem.png
- docs/fase-b/admin-conversas-enviadas.png

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Valide com build e typecheck.
- IA: use o módulo central src/lib/cerebro.ts (montarInstrucoes) e o gateway do Lovable com as constantes de src/lib/ai-models.ts. Não crie outro caminho de chamada.
- Banco é Lovable Cloud: entregue as migrações em ordem, com o SQL pronto para o SQL editor do Lovable. Toda tabela com histórico ou escrita precisa de política explícita de INSERT/UPDATE, não só SELECT (já tivemos erro de RLS em cerebro_blocos_versoes). Use `private.has_role(auth.uid(), 'admin'::app_role)` para admin, como nas demais tabelas.
- Pagamento é só cartão de crédito ou débito. A equipe só atende por mensagem. Nunca escreva "não é plano de saúde" em nenhum texto.

## 1. Conversas que fecharam — tabelas e privacidade
- `conversas_fichas`: id, autor_id (quem enviou; o admin pode trocar o autor para o atendente da venda), retomada_id (opcional), objecao_id (opcional, ligada a `objecoes`), objecao_rotulo (texto), ponto_parada (mesmos 4 valores da retomada), plano (Prata | Ouro | Diamante | outro), perfil_cliente (texto curto, ex.: "Família com 4 dependentes · 1 idoso"), onde_travou (texto), o_que_fez (text[]), mensagem_chave (texto do vendedor, com [nome]), por_que_funcionou (texto), dias_ate_fechar (int), status (enviada | publicada | recusada), motivo_recusa, aprovada_por, publicada_em, created_at, updated_at.
- `conversas_fichas_feedback`: ficha_id, user_id, util (boolean), motivo (opcional), created_at. Um voto por pessoa por ficha.
- RLS: o autor vê e cria as próprias fichas; todo usuário autenticado vê as publicadas; admin vê e edita tudo. Ninguém mais edita.
- **A conversa bruta nunca é guardada.** O arquivo é lido no navegador, enviado para a função de servidor, processado em memória e descartado. Não grave o texto da conversa em tabela, log, Storage nem na resposta de erro.
- Antes de enviar para a IA: reutilize a remoção de telefone, CPF e e-mail do Copiloto, troque o rótulo "Cliente <número>" por "Cliente", troque o primeiro nome do cliente (da retomada, se houver, e qualquer nome citado pela própria cliente) por [nome], e nunca envie o cabeçalho do arquivo.
- Função de servidor `gerarFichaConversa` (ferramenta "biblioteca" no Cérebro; blocos: playbook CDT, mapeamento de objeções, padrão de escrita, etapas do funil, SPIN): devolve JSON com objecao_rotulo, ponto_parada, plano, perfil_cliente, onde_travou, o_que_fez (2 a 4 passos), mensagem_chave, por_que_funcionou. A IA só pode classificar objeção e etapa usando as definições do Cérebro.
- Validações em código, depois da IA (rejeite e peça para tentar de novo, sem perder o que o atendente digitou): (a) a mensagem_chave tem de existir, depois do mascaramento, dentro de uma mensagem do **atendente** (direção "<" na Ztalk); (b) nenhum campo pode conter telefone, CPF, e-mail ou nome próprio de cliente; (c) onde_travou descreve a fala do cliente só por resumo, nunca por citação entre aspas; (d) dias_ate_fechar é calculado no código pelas datas da conversa, não pela IA.
- Limite diário: registre em `ia_uso` com ferramenta "biblioteca" e adicione em `ia_limites` o padrão 10/dia. Inclua "biblioteca" na lista de ferramentas do Cérebro e na matriz "Quem usa o quê" do Admin.

## 2. Envio pelo atendente — biblioteca-enviar.png
- Ao clicar **Fechou** na retomada (e depois de gravar o status), abra a janela do esboço: arquivo .txt (arrastar ou "Anexar"), contador de mensagens lido, "Ficha gerada · revise antes de enviar" com campos editáveis (objeção, parou em, o que você fez, mensagem-chave), aviso de privacidade e botões "Enviar para aprovação" (dourado) e "Agora não". Enquanto a IA trabalha, mostre o olho da MarcIAna "pensando". Erro: "Não consegui montar a ficha agora. Tente de novo." sem perder o arquivo.
- "Agora não" fecha sem enviar nada. Enquanto a venda estiver nos últimos 7 dias, o ticket fechado mostra o link "Enviar conversa para a biblioteca".
- A ficha entra com status "enviada" e aparece no Admin, em Conversas enviadas. O atendente vê "Enviada para aprovação" no ticket.

## 3. Biblioteca > "Conversas que fecharam" — biblioteca-conversas.png
- Na página Biblioteca, tabs "Materiais" (conteúdo atual) e "Conversas que fecharam" (rota /biblioteca?aba=conversas).
- Filtros em chips: Objeção (as objeções publicadas), Parou em, Plano, Perfil. Lista à esquerda (título, resumo, tags, "por <autor>") e ficha à direita: onde travou, o que a vendedora fez (passos numerados), mensagem-chave (com "Copiar"), por que funcionou, 👍/👎 "Isso ajudou" (👎 pergunta o motivo, opcional) e o botão "Abrir 'O cliente disse…' com esta objeção" (/scripts/cliente-disse com a objeção pré-selecionada). Rodapé: "Só a ficha fica guardada. A conversa original, nomes, telefones e falas do cliente não."
- Só fichas publicadas. Sem fichas: "Ainda não há conversas publicadas. Quando você fechar uma venda, pode enviar a sua."

## 4. Casos parecidos — clientedisse-casos.png
- Em O cliente disse… e no Copiloto, depois da análise, mostre até 2 fichas publicadas que combinem com a objeção detectada (objecao_id) ou, se não houver, com o ponto de parada. Cartão: pílula da objeção, título, "<autor> · plano · perfil", uma linha do que fez. Link "Ver todos os casos na Biblioteca →" com o filtro já aplicado. Sem chamada nova de IA: é só busca por etiquetas. Sem caso parecido, não mostre o bloco.

## 5. Mensagens que vendem — selo e desempenho
- Fonte: `retomada_eventos` (acao enviei/respondeu/fechou, mensagem_id, mensagem_versao). Atribuição: a resposta ou o fechamento conta para a **última mensagem marcada como "Enviei"** daquela retomada antes do evento. Por versão: enviadas, responderam, fecharam.
- Mensagens do "Fechar com este cliente" (fechamento_itens): se a estrutura do bloco 1 permitir, registre o "Copiar" em `mensagens_usos` (user_id, origem, item_id, versao, caso_id, created_at) e conte "levou ao fechamento" quando o caso chegar em "Link concluído". Para elas não existe "respondeu"; o selo usa só o fechamento. Se não for viável sem mudar muito o bloco 1, entregue só a cadência e descreva no PR o que ficou de fora.
- Função de servidor `mensagens_desempenho(periodo)` (admin): devolve enviadas, % responderam, % fecharam por ponto de parada, etapa e versão. Função `mensagens_selo()` (qualquer autenticado): devolve só mensagem_id, versao, envios e selo, **sem percentuais e sem dados de outros atendentes**. Ambas como funções SQL com SECURITY DEFINER e `set search_path`, conferindo o papel dentro da função.
- Regra do selo (configurável em `config_mensagens_vendem`, padrão min_envios = 10, limite_baixo = 0.7): sem selo abaixo de 10 envios; "Funciona bem" se a taxa de resposta for igual ou maior que a média da etapa (todas as versões do mesmo ponto de parada e etapa); "Vale testar outra" se for menor que 70% da média; sem selo no meio.
- Retomar hoje — retomar-selo.png: no cartão da mensagem, o selo ("Funciona bem" com ponto dourado; "Vale testar outra" tracejado) e "Usada N vezes pela equipe". O atendente nunca vê percentuais. "Ver outra versão →" só aparece quando existe versão anterior da mesma mensagem com selo "Funciona bem"; abre esse texto com o rótulo "Versão anterior · Funciona bem", que o atendente pode copiar.
- Mensagem abaixo do esperado: `mensagens_sugestoes` (mensagem_id, versao_base, texto_sugerido, por_que_mudar, status pendente | aprovada | ignorada, decidido_por, created_at). Uma função `verificarMensagensAbaixoDoEsperado` roda ao abrir o Admin (no máximo a cada 6 horas) e, para cada mensagem com selo "Vale testar outra" e sem sugestão pendente, pede à IA (ferramenta "retomada" do Cérebro + padrão de escrita) uma nova versão e o "por que mudar". Mantenha as variáveis {nome} {atendente} {plano} {dependentes} {usos} {observacao}. Aprovar cria a versão seguinte em `cadencia_mensagens` (a anterior vai para `cadencia_mensagens_versoes`); "Editar" abre o texto antes de aprovar; "Ignorar" marca como ignorada e não sugere de novo para a mesma versão.
- Depois de aprovada, quando a versão nova tiver 10 envios, mostre no Admin o antes e depois (taxa de resposta e de fechamento).

## 6. Admin
- **Mensagens que vendem** (grupo Atendimento) — admin-mensagens-vendem.png: título, faixa dourada "N mensagens abaixo do esperado, com sugestão de nova versão", chips por ponto de parada, tabela (Etapa, Versão, Enviadas, Responderam, Fecharam, Selo; percentuais baixos em vermelho; "Poucos envios" quando faltar amostra) e painel à direita da linha selecionada com os 3 números, a versão atual × a sugerida, "Por que mudar", e os botões "Aprovar como v<N>", "Editar", "Ignorar". Link "Ajustar regras do selo" para min_envios e limite. Conte as sugestões pendentes em "O que precisa de você" ("Mensagens abaixo do esperado").
- **Conversas enviadas** (grupo Atendimento) — admin-conversas-enviadas.png: filtros Novas · Publicadas · Recusadas; lista (autor, objeção, ponto de parada, data, selo "Nova"/"Publicada") e painel com todos os campos editáveis, o aviso de checagem automática e os botões "Aprovar e publicar", "Salvar edição", "Recusar" (pede motivo, que o atendente vê no ticket). Botão "+ Enviar conversa" para o Paulo subir um .txt de qualquer venda concluída, escolhendo o autor. Aprovar e publicar cria um item em Novidades ("Nova conversa que fechou: <título>", crédito ao autor). Conte as novas em "O que precisa de você" ("Conversas para revisar"). Nesta mesma seção o Paulo despublica ou edita fichas já publicadas.
- Cérebro da Omnia: acrescente a ferramenta "biblioteca" à matriz "Quem usa o quê", com os blocos padrão marcados (playbook, mapeamento de objeções, padrão de escrita, etapas do funil, SPIN).

## 7. Relatórios Excel
- No relatório de retomadas da equipe (admin), aba Mensagens: acrescente enviadas, responderam, fecharam, % responderam, % fecharam e selo por versão. Nova aba **Biblioteca** com as fichas aprovadas (id, autor, objeção, parou em, plano, perfil, onde travou, o que fez, mensagem-chave, dias até fechar, útil e não útil). Atualize o LEIA-ME com as novas colunas. Nunca telefone, nome nem fala do cliente. O arquivo do atendente não traz percentuais de outras pessoas; só a aba Biblioteca com as fichas publicadas e as dele.

## Geral
- Respeite temas claro e escuro, estados vazios e de erro, e o padrão lista + painel do Admin.
- Trabalhe numa branch fase-b-bloco1, **um commit por seção** (1 tabelas e fichas, 2 envio, 3 biblioteca, 4 casos parecidos, 5 mensagens que vendem, 6 Admin, 7 Excel), rode build e typecheck e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações em ordem com o SQL pronto para o SQL editor do Lovable, tabelas e funções novas, como ficou a atribuição "última mensagem enviada", o que ficou de fora das mensagens do fechamento (se algo), e como ficou a remoção de dados pessoais antes da IA e as validações da ficha.
