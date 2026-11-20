Fase A, bloco 3 da OMNIA Apoio: Cérebro da Omnia (instruções centrais de IA), Copiloto, Raio-X da venda e a ligação das ferramentas de IA existentes ao Cérebro. Siga os tokens e regras da marca (docs/redesign-omnia/prompt-lovable-base-omnia.md), o padrão lista + painel do Admin e o olho da MarcIAna (componente MarcianaEye) como ícone das análises.

Pré-requisitos: blocos 1 e 2 da Fase A já na main (objecoes, fechamento_casos, retomadas, cadencia_mensagens). Se não estiverem, pare e avise.

Esboços aprovados (siga fielmente):
- docs/fase-a/copiloto.png
- docs/fase-a/raiox.png
- docs/fase-a/cerebro-admin.png

Conversas, análises, nomes e números dos esboços são ilustrativos.

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Valide com build e typecheck.
- IA: continue usando o gateway do Lovable com as constantes de src/lib/ai-models.ts. Centralize todas as chamadas novas num único módulo (ex.: src/lib/cerebro.ts) para que trocar de provedor no futuro (Gemini direto com chave própria) seja mudar um arquivo só.
- Banco é Lovable Cloud: entregue as migrações em ordem com o SQL pronto para o SQL editor do Lovable.

## 1. Cérebro da Omnia (dados + montagem de instruções)
- `cerebro_blocos`: chave, titulo, descricao_curta, conteudo (texto longo), ferramentas text[] (marciana | cliente_disse | mensagem_cliente | retomada | copiloto | raiox | simulador), ativo, updated_at, updated_by. Guarde versões anteriores em `cerebro_blocos_versoes`.
- Blocos iniciais (status ativo, conteúdo: se existir docs/fase-a/cerebro-inicial.md, importe cada seção "## <chave>" como bloco; se não existir, crie com conteúdo "[escrever]" — não invente conteúdo de vendas):
  - playbook_cdt (todas as ferramentas)
  - spin_selling (copiloto, raiox, simulador)
  - chris_voss (cliente_disse, copiloto, raiox)
  - mapeamento_objecoes (cliente_disse, copiloto)
  - padrao_escrita (todas) — gerado a partir da tabela da seção 2
  - etapas_funil (copiloto, raiox, retomada) — gerado a partir da tabela da seção 3
- `cerebro_regras_fixas` (sempre incluídas em toda chamada, curtas): nunca dizer "não é plano de saúde"; pagamento só cartão de crédito ou débito; nunca inventar preço, carência, regra ou benefício — usar só dados da Omnia; português do Brasil; tom acolhedor de WhatsApp. Editável no Admin.
- Função `montarInstrucoes(ferramenta, contextoExtra)`: junta regras fixas + blocos ativos marcados para aquela ferramenta + contexto da Omnia necessário (ex.: objeções publicadas, mensalidades, preços da Amor Saúde) — só o que a ferramenta precisa. Registre o tamanho aproximado (palavras) para mostrar no Admin.
- **Ligar as ferramentas existentes ao Cérebro**: MarcIAna (respostas e "Mensagem para o cliente"), "O cliente disse…" (classificação e sugestão de objeção nova), sugestões da retomada (se houver chamada de IA), avaliação do Simulador. Substitua instruções fixas espalhadas no código por `montarInstrucoes(...)`, mantendo o comportamento atual quando o bloco estiver vazio.

## 2. Padrão de escrita (Admin, aba do Cérebro)
- `padrao_escrita`: tipo (pode | nao_pode), item, exemplo_errado, exemplo_certo, ativo. Base inicial:
  - Pode: emoji com moderação (1 por mensagem); diminutivo leve ("rapidinho", "minutinhos"); "você" por extenso; usar o primeiro nome do cliente.
  - Não pode: "vc", "blz", "tbm"; "kkk"/"rs" repetidos; "amor", "querida", "flor", "mano"; várias perguntas na mesma mensagem; mensagem com mais de 4 linhas sem quebra; "não é plano de saúde".
- O bloco padrao_escrita do Cérebro é gerado a partir desta tabela.

## 3. Etapas do funil (Admin, aba do Cérebro)
- `funil_etapas`: etapa (novo_lead | lead_qualificado | proposta_enviada | fechamento | venda_concluida), nome, definicao (o que faz o cliente estar nesta etapa), sinais text[] (sinais na conversa), ordem. Base inicial com nome e ordem; definição e sinais vazios para o Paulo preencher.
- O bloco etapas_funil do Cérebro é gerado a partir desta tabela. Copiloto e Raio-X só podem classificar etapas usando essas definições.

## 4. Copiloto — rota /copiloto (menu Inteligência, abaixo de MarcIAna) — copiloto.png
- Título "Copiloto" + "Cole o print ou anexe a conversa exportada. Ele sugere a próxima mensagem." e, à direita, "N de M hoje".
- Coluna esquerda (moldura tracejada "CONVERSA"): aceita **imagens coladas com Ctrl+V** (até 4, miniaturas, reaproveite o upload da MarcIAna) e **arquivo .txt exportado do WhatsApp** (botão "Anexar .txt"; ler no navegador). Nota: "Telefone, CPF e e-mail são apagados antes da análise." Botões "+ Outro print", "Anexar .txt", "Analisar" (dourado).
- Antes de enviar à IA: no .txt, remover telefones, CPFs e e-mails por regex e trocar o nome do cliente por "Cliente" quando possível; limitar às últimas ~80 mensagens. Imagens vão como estão (instrua a IA a ignorar dados pessoais e a não repeti-los). **Não salvar a conversa nem as imagens** (apagar do Storage após a análise).
- Resposta (JSON validado): etapa (uma das etapas do funil), resumo_onde_esta (1 frase), objecoes_detectadas [ids de objeções publicadas], opcao_direta {texto, porque}, opcao_consultiva {texto, porque}, primeiro_nome_cliente (se aparecer), ponto_parada_sugerido.
- Tela de resultado: cartão "ONDE ESTÁ A CONVERSA" (olho da MarcIAna 26px, etapa em negrito + resumo, pílulas das objeções — a primeira dourada); dois cartões "DIRETA · PUXA O PRÓXIMO PASSO" e "CONSULTIVA · APROFUNDA" (texto, linha do porquê, Copiar); atalhos: "Objeção encontrada: <nome> · Ver em O cliente disse →" e "<nome> · <ponto de parada> · Adicionar à retomada →" (abre o formulário do bloco 2 preenchido; o telefone não vem da IA).
- Registrar uso (para limite e métricas) sem guardar conteúdo: `ia_uso` (user_id, ferramenta, created_at).

## 5. Raio-X — rota /raiox (menu Inteligência) — raiox.png
- Entradas: mesmo campo de conversa do Copiloto; e o botão "Fazer Raio-X desta venda" no fluxo "Perdido" da retomada (abre /raiox?retomada=<id> com cabeçalho "Venda perdida · <nome> · <ponto de parada> · <data>").
- Resposta (JSON validado): onde_perdeu {descricao, fala_cliente, fala_atendente}, faltou [{tecnica (ex.: "SPIN · Implicação", "Voss · Pergunta calibrada"), explicacao}], reescrita {original, sugerida}, escrita [{errado, certo, regra}] (usando o padrão de escrita), habito {titulo, descricao, perfil_simulador_sugerido}, tempo_resposta (se o .txt tiver horários: média e maior espera do atendente).
- Tela: ONDE PERDEU (bloco com fio dourado, falas citadas), O QUE FALTOU (pílula com a técnica + explicação), COMO EU RESPONDERIA (original riscada + sugerida), QUALIDADE DA ESCRITA (errado riscado → certo); coluna direita: cartão "HÁBITO PARA TREINAR" com "Treinar no Simulador" (abre /simulador-ia?perfil=<id> com o perfil mais parecido, escolhido pela IA entre os perfis existentes) e o aviso tracejado: "O Paulo vê o resumo dos seus Raio-X (técnicas e trechos, sem dados do cliente) para te ajudar a evoluir. A conversa completa não fica guardada."
- Guardar só o resultado: `raiox_resultados` (user_id, retomada_id opcional, etapa, onde_perdeu, faltou, reescrita, escrita, habito, created_at), com os trechos já sem nome/telefone do cliente. Apagar automaticamente após 90 dias. RLS: o próprio vendedor e o admin.

## 6. Limites de uso
- `ia_limites`: ferramenta, limite_diario (padrões: copiloto 30, raiox 10; MarcIAna e demais conforme o Admin definir, padrão sem limite), e `ia_limites_extra` (user_id, ferramenta, extra, valido_ate) para o admin liberar mais para alguém.
- Contador "N de M hoje" nas páginas. Ao chegar em 80%: aviso discreto. Ao atingir o limite: bloqueia só aquela ferramenta até 00:00 (horário de Brasília) com a mensagem "Você chegou ao limite de hoje do Copiloto. Volta amanhã ou peça ao Paulo para liberar mais." Admin não tem limite.

## 7. Painel Admin — grupo Inteligência — cerebro-admin.png
- **Cérebro da Omnia** com abas: Skills · Etapas do funil · Padrão de escrita · Regras fixas · Limites de uso.
  - Skills: lista (título, descrição curta, pílulas das ferramentas que usam) + tabela "QUEM USA O QUÊ" (skills × ferramentas, ● dourado); painel: Instruções (texto longo), "Usado por" (pílulas selecionáveis), Tamanho ("≈ N palavras · blocos maiores gastam mais da cota de IA"), Salvar e "Testar com uma conversa" (abre um campo para colar um trecho e mostra a resposta do Copiloto com as instruções em edição, sem salvar).
  - Etapas do funil, Padrão de escrita, Regras fixas: listas editáveis no padrão lista + painel.
  - Limites de uso: limite diário por ferramenta + liberações extras por pessoa + uso dos últimos 7 dias por ferramenta (números).
- **Raio-X da equipe**: por vendedor (só números e padrões, nunca conversa completa nem dados de cliente): Raio-X feitos, técnicas que mais faltam (top 3), erros de escrita mais frequentes (top 3), etapa em que mais perde; ao abrir um vendedor, lista dos resultados com os trechos citados (90 dias). Equipe: os mesmos padrões agregados.
- Link "Editar" (ao lado do "?") em /copiloto e /raiox abre /admin/cerebro.

## Geral
- Respeite temas claro e escuro. Durante a análise, mostre o olho da MarcIAna no estado "pensando". Erro da IA: "Não consegui analisar agora. Tente de novo." sem perder o que foi colado.

Trabalhe numa branch fase-a-bloco3, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações em ordem com o SQL pronto para o SQL editor do Lovable, tabelas novas, quais ferramentas existentes passaram a usar o Cérebro, e como ficou a remoção de dados pessoais antes da IA.
