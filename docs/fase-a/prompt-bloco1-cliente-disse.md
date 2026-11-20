Fase A, bloco 1 da OMNIA Apoio: ferramenta "O cliente disse…" (objeções, objeções novas e "Fechar com este cliente"), com as seções do Painel Admin. Siga os tokens e regras da marca (docs/redesign-omnia/prompt-lovable-base-omnia.md), o padrão de portas de Scripts e o padrão lista + painel de edição do Admin.

Esboços aprovados (siga fielmente):
- docs/fase-a/cliente-disse-objecao.png (fala com 2 objeções: leituras, 3 ângulos, pergunta para avançar, evite dizer)
- docs/fase-a/cliente-disse-nova.png (objeção nova com sugestão da IA não aprovada)
- docs/fase-a/cliente-disse-fechar.png (aba "Fechar com este cliente")
- docs/fase-a/cliente-disse-admin.png (fila "Objeções novas" no Admin)

Textos, valores, nomes e contagens dos esboços são ilustrativos.

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Valide com build e typecheck.
- Parta do estado atual da main. Use o Gemini pelas constantes de src/lib/ai-models.ts (não troque de modelo).
- Banco é Lovable Cloud: entregue as migrações em ordem, com o SQL pronto para colar no SQL editor do Lovable.

## Contexto do negócio (use nas regras e nos prompts da IA)
- Venda B2C do Cartão de TODOS por WhatsApp. Funil do CRM: Novo lead → Lead qualificado → Proposta enviada → Fechamento → Venda concluída.
- Pagamento: somente cartão de crédito ou cartão de débito.
- Nunca escrever "não é plano de saúde" em mensagem para cliente.
- A IA nunca inventa preço, carência, regra ou benefício: só usa o que está na base aprovada ou nos dados cadastrados na Omnia.

## 1. Dados (migrações)
- `objecoes`: nome, exemplos_de_fala text[] (como o cliente costuma dizer), leituras jsonb [{titulo, pergunta}], angulos jsonb [{tipo: logico|emocional|prova, rotulo, texto}], pergunta_avancar, evite_dizer, prioridade int (para ordenar quando vierem várias juntas; menor trata primeiro), status (rascunho|publicada), autor_id (quem sugeriu, opcional), created_at, updated_at.
- `objecoes_pendentes`: fala_exemplo, falas_parecidas text[], ocorrencias int, ultima_ocorrencia, sugestao_ia jsonb (mesmo formato de uma objeção), respostas_atendentes jsonb [{user_id, texto, created_at}], sugerida_por (user_id, opcional), status (pendente|aprovada|recusada), objecao_id (quando aprovada), created_at.
- `fechamento_itens`: tipo (sinal|mensagem_etapa|travamento), etapa (proposta|plano|dados|pagamento|link), titulo, exemplos_de_fala text[], mensagem (template com variáveis {nome}, {dependentes}, {plano}, {usos}, {economia}), passos text[], evite, ordem, status (rascunho|publicada), updated_at.
- `fechamento_casos`: user_id, primeiro_nome, dependentes int, plano (prata|ouro|diamante), usos jsonb (ids de itens da Amor Saúde + rótulo livre, ex.: "Cardiologista · mãe"), etapa, retomar_em (date, opcional), created_at, updated_at. **Sem CPF, telefone ou sobrenome.** Apague automaticamente casos com etapa "venda_concluida" e casos com mais de 30 dias (função agendada ou limpeza ao abrir a página).
- `config_economia`: mensalidade por plano (prata, ouro, diamante). Nos itens da Amor Saúde, adicione `preco_particular_medio` (opcional) e `usar_na_economia` (boolean).
- `cliente_disse_uso`: user_id, objecao_id ou fechamento_item_id, angulo (quando for objeção), created_at — registrado a cada "Copiar".
- RLS: atendentes leem só o que está publicado e só os próprios casos; admin lê e edita tudo.
- **Base inicial:** se existir `docs/fase-a/base-bloco1.json`, importe o conteúdo como status "rascunho". Se não existir, crie só as 5 objeções com nome e exemplos de fala (tá caro; vou pensar; vou falar com meu marido/esposa; já tenho plano / uso o SUS; desconfiança / medo de golpe) e as subetapas do fechamento com título, tudo como "rascunho" e sem textos inventados. O Paulo preenche e publica pelo Admin.

## 2. Página — rota /scripts/cliente-disse (?aba=objecoes|fechar)
- Ative a porta "O cliente disse…" na entrada de Scripts (porta nova, antes das "em breve").
- Título "O cliente disse…" + linha "Cole a fala do cliente como veio. A ferramenta diz o que é e entrega a resposta aprovada." Abas: Objeções · Fechar com este cliente.

### Aba Objeções — cliente-disse-objecao.png
- Campo grande "Fala do cliente" (borda dourada no foco) + botão "Entender" (Enter também envia).
- Função de servidor `classificarFala`: remove da fala números de telefone, CPF e e-mails (regex) antes de mandar ao Gemini; envia a fala + a lista de objeções publicadas (id, nome, exemplos) + sinais de compra e travamentos publicados (id, título, exemplos). Resposta JSON validada: `{itens: [{tipo: objecao|sinal|travamento, id, ordem, motivo_ordem}], nova: boolean}`. A IA só pode devolver ids existentes.
- Resultado com 1 item: mostra a objeção inteira. Com 2 ou mais: etiqueta dourada "N objeções · trate nesta ordem", a primeira aberta e as outras como linhas recolhidas ("abrir →"), e a linha "Por que esta primeiro: …" (motivo_ordem).
- Layout da objeção: coluna esquerda (≈300px) com número + nome, bloco "O QUE ELE(A) PODE QUERER DIZER" (fundo sidebar: título 600 + "Pergunte:" em gold-text), bloco "Evite dizer:" (fio escuro à esquerda); coluna direita com os 3 ângulos em cartões (overline em gold-text, texto, botão "Copiar" e "usada N×"; o mais usado ganha borda dourada e "· mais usada") e, abaixo, a faixa tracejada "PARA AVANÇAR" com a pergunta e "Copiar".
- Se o resultado for sinal de compra ou travamento: abra a aba "Fechar com este cliente" já na etapa correspondente.

### Objeção nova — cliente-disse-nova.png
- Quando `nova = true`: etiqueta tracejada "Objeção nova" + "nenhuma resposta aprovada parecida. Já entrou na fila do Paulo."
- Gere a sugestão com uma segunda chamada ao Gemini (mesmo formato de objeção), com instruções explícitas: português do Brasil, tom acolhedor de WhatsApp, sem valores, carências ou regras que não estejam no contexto, sem "não é plano de saúde", cada ângulo com no máximo 3 frases.
- Mostre a sugestão numa moldura tracejada com a etiqueta "Sugestão da IA · não aprovada pelo Paulo" e "Confira antes de usar. Sem valores ou regras inventadas." Botões: "Contar o que respondi" (abre um campo de texto) e "Enviar para o Paulo" (dourado).
- Fila automática: toda fala com `nova = true` é registrada em `objecoes_pendentes`. Agrupe falas parecidas: antes de criar um grupo novo, peça ao Gemini para comparar com as falas pendentes existentes (só textos, sem dados pessoais) e somar ao grupo semelhante (ocorrencias + 1, adiciona a falas_parecidas). "Enviar para o Paulo" marca sugerida_por e prioriza o grupo; "Contar o que respondi" adiciona em respostas_atendentes.

### Aba "Fechar com este cliente" — cliente-disse-fechar.png
- Topo: o funil do CRM em 5 segmentos com rótulos em overline (Novo lead e Lead qualificado esmaecidos; etapas anteriores em dourado; a atual meio preenchida).
- Seletor "Meus casos em aberto ⌄" (casos do usuário, mais recentes primeiro) + "Novo caso".
- Coluna esquerda (cartão): CLIENTE — primeiro nome, dependentes (número), plano (pílulas Prata/Ouro/Diamante), "Vai usar primeiro" (pílulas: busca nos itens da Amor Saúde + rótulo livre, ex.: "· mãe"); ETAPA DO FECHAMENTO — clicar em "Proposta enviada" no funil mostra os sinais de compra; dentro de Fechamento, as subetapas Escolheu o plano → Mandou os dados → Pagamento → Link concluído (feitas com ✓ dourado, atual com "ESTÁ AQUI"). Botão "Venda concluída" ao final (encerra e apaga o caso). Aviso pequeno: "Nada aqui é salvo com CPF ou telefone. O caso some quando a venda é concluída ou em 30 dias." Tudo salva sozinho.
- Coluna direita: "PRÓXIMA MENSAGEM · <etapa>" (fundo surface-2, "Copiar") montada com o template publicado da etapa e as variáveis do caso; "O QUE VOCÊ LEVA (VAI JUNTO NA MENSAGEM)": para cada uso com `preco_particular_medio` e valor com o cartão, "particular → com o cartão", menos a mensalidade do plano (config_economia), e a linha "Economia já no primeiro uso". Se faltar preço, o item não entra e aparece a nota "sem preço particular cadastrado". Link "Tirar da mensagem" remove o bloco da cópia. Fonte em muted: "Preços médios da Amor Saúde cadastrados na Omnia".
- "Travou em <etapa>?": pílulas com os travamentos publicados daquela etapa; clicar mostra a mensagem do travamento (com variáveis), passos e evite.
- Faixa tracejada "O cliente sumiu nesta etapa?" + "Retomar depois": grava retomar_em = amanhã e mostra "Guardado para retomar amanhã". (A fila de retomada completa vem no bloco 2; por enquanto o caso aparece em "Meus casos em aberto" com a marca "retomar hoje" na data.)

## 3. Busca da Início
- Na busca central da Início, se o texto digitado tiver mais de 3 palavras e não houver resultado exato, o primeiro resultado é "O cliente disse: <texto> → ver resposta", que abre /scripts/cliente-disse com a fala já preenchida e classificada.

## 4. Painel Admin (grupo Atendimento, padrão lista + painel)
- **Objeções**: lista (nome, status, "usada N× em 30 dias", ângulo mais usado) + painel com todos os campos (exemplos de fala como etiquetas; leituras e ângulos como blocos repetíveis), Publicar / Voltar para rascunho.
- **Objeções novas** — cliente-disse-admin.png: lista dos grupos pendentes ordenada por ocorrências da semana ("N esta semana", autor ou "Detectada automaticamente", botão "Revisar"); painel com a fala, falas parecidas, o que os atendentes responderam e o formulário preenchido com a sugestão da IA; botões "Aprovar e publicar" (cria a objeção publicada com autor_id = sugerida_por e cria um item em Novidades: "Nova resposta: cliente diz '<fala>'"), "Salvar rascunho", "Recusar". Conte os pendentes no "O que precisa de você" ("Objeções novas para revisar") e no seletor de seções.
- **Fechamento**: itens agrupados por etapa (Proposta enviada · Escolheu o plano · Mandou os dados · Pagamento · Link concluído) e por tipo (sinal, mensagem da etapa, travamento); painel com título, exemplos de fala, mensagem com botões para inserir {nome} {dependentes} {plano} {usos} {economia}, passos, evite, status.
- **Economia**: mensalidade de cada plano; e, nos itens da Amor Saúde, os campos "Preço particular médio" e "Usar no cálculo de economia".
- Link "Editar" (ao lado do "?") em /scripts/cliente-disse abre /admin/objecoes.

## Geral
- Respeite temas claro e escuro. Estados vazios simples ("Nenhuma objeção publicada ainda." / "Nenhum caso em aberto.").
- Erros da IA: mensagem discreta "Não consegui entender agora. Tente de novo." sem travar a página.

Trabalhe numa branch fase-a-bloco1, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações em ordem com o SQL pronto para o SQL editor do Lovable, tabelas novas, seções novas do Admin e se a base inicial foi importada do JSON ou criada vazia.
