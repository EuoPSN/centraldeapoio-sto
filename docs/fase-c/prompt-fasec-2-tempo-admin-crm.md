Fase C, prompt 2 de 2 da OMNIA Apoio: **cronômetro de primeira resposta** (varredura leve da lista de conversas), **Admin > Extensão do WhatsApp**, **Excel** e **upload semanal da planilha do CRM** (fecha os tickets certos e alimenta o pódio "Mais fechamentos" e o comparativo de 60 dias antes e depois).

Pré-requisito: o prompt 1 da Fase C na main (extension/, extensao_eventos, ticket_historico, extensao_ignorados, ferramenta `extensao`) e Fase B bloco 3 (ranking_podios, ranking_config, ranking_ocultos, ranking_hall, Admin > Ranking). Se faltar algo, pare e avise.

Esboços aprovados: docs/fase-c/painel-tempo.png, admin-extensao.png. Mesmas regras de trabalho do prompt 1: sem harness visual nem capturas; IA só por cerebro.ts/ai-models.ts; migrações em ordem com SQL para o SQL editor do Lovable e políticas explícitas de INSERT/UPDATE; admin com `private.has_role(auth.uid(), 'admin'::app_role)`; funções SECURITY DEFINER com `set search_path`; pagamento só cartão; só mensagem; nunca "não é plano de saúde".

## 1. Varredura leve da lista (extensão)
- Content script lê SOMENTE a lista de conversas visível (nome, prévia da última mensagem, horário, se há mensagem não lida, e se a última mensagem foi do atendente ou do cliente). NUNCA abre conversas, NUNCA rola a lista sozinho, NUNCA clica no WhatsApp. Ignore grupos, comunidades, listas de transmissão e Status (na dúvida, ignore) e contatos ignorados (compare o hash). Se Pausada, não faz nada.
- Isole os seletores da lista em `src/content/selectors.ts` com fallback e falha segura. Teste unitário com fixtures.
- Nada de nome nem prévia sai do navegador: do que foi lido, só uma chave `chat_key` = hash local (SHA-256) do identificador da conversa + o horário da última mensagem do cliente e a direção da última mensagem sobem para o backend.

## 2. Cálculo do tempo de primeira resposta
- Tabelas: `extensao_config` (uma linha: meta_minutos 5, nova_conversa_horas 12, horario jsonb com faixas por dia da semana, padrão seg a sex 08:00–18:00 e sábado 08:00–12:00, fuso America/Sao_Paulo) e `extensao_tempos` (user_id, chat_key, inicio_em, resposta_em, minutos_uteis, dentro_da_meta, dia). Sem nome, sem telefone, sem texto.
- Regras: **conversa nova** = o cliente escreve depois de 12 horas (configurável) sem mensagens; se o cliente mandar várias seguidas, o relógio começa na primeira; conta só dentro do horário de atendimento (`minutos_uteis`); mensagem automática ou de bot NÃO conta como resposta (se a prévia não permitir distinguir com segurança, registre como resposta humana e liste essa limitação no PR); sem resposta → aparece em "Conversas esperando resposta" quando passa da meta.
- RLS: o atendente lê e insere os próprios; admin lê todos.
- Função `extensao_tempo_resumo(dia)` devolve para o atendente (só os próprios dados): primeira resposta média do dia, conversas novas, dentro da meta, sem resposta e a lista de quem espera (nome/prévia ficam só no navegador; a lista usa o que foi lido na tela, sem enviar ao servidor).

## 3. Aba "Tempo de resposta" (painel-tempo.png)
Primeira resposta do dia contra a meta (barra), "Dentro da meta", "Sem resposta", lista de conversas esperando (nome e prévia lidos localmente, nunca enviados), e o texto explicativo do esboço. Sem pódio, sem comparação com colegas. Respeite o botão Pausar.

## 4. Admin > Extensão do WhatsApp (admin-extensao.png)
Seção nova em Treino e evolução, lista + painel de configurações (padrão do Admin):
- Tabela por atendente (esta semana / mês / pessoas): tickets criados, atualizados, 1ª resposta média, conversas ignoradas, vezes que pausou, e "Não instalou" quando não há eventos. Fonte: `extensao_eventos`, `ticket_historico` (só contagens) e `extensao_tempos`. **Nunca** conteúdo, nome nem telefone de cliente.
- Configurações: meta de 1ª resposta, conversa nova após X horas, horário de atendimento por dia da semana.
- Botão "Baixar relatório (Excel)" (item 6).
- Em "O que precisa de você": "Atendentes sem a extensão" (opcional, só contagem) e "Tempo de resposta acima da meta (semana)".

## 5. Upload semanal da planilha do CRM
- Tela no Admin (mesma seção, bloco "Fechamentos do CRM"): "Enviar planilha" aceita .xlsx ou .csv exportado do CRM (colunas esperadas: Nome do cliente, Telefone, Vendedor, e datas de etapas, entre elas Venda). Se as colunas mudarem, mostre quais faltaram em vez de falhar calado.
- **Processamento no navegador**: leia o arquivo no navegador (SheetJS/xlsx), normalize os telefones (somente dígitos, últimos 9, ignorando 55) e calcule hashes; o servidor NUNCA recebe nome nem telefone do cliente em claro, e a planilha NÃO é guardada.
- Fluxo: (1) selecionar vendas com data de Venda dentro do período da planilha; (2) mapear Vendedor → usuário da Omnia pela tabela `crm_vendedor_map` (vendedor_nome_planilha, user_id), mostrando "N de M conferidos" e uma lista para o admin resolver os pendentes antes de gravar; (3) cruzar o hash do telefone com os tickets abertos do atendente certo (função SECURITY DEFINER `fechar_tickets_por_crm(user_id, hashes[], periodo)` que marca como "Venda concluída (CRM)" e registra em `ticket_historico` com origem 'crm'; o ticket sai da fila de retomada); (4) gravar totais.
- Para o cruzamento por hash funcionar, os tickets precisam de uma coluna `telefone_hash` (hash do número normalizado); acrescente-a (migração + preenchimento ao criar/atualizar tickets, e para os existentes, calcule no servidor a partir do telefone já guardado, sem expor o número). Use o mesmo hash com sal fixo no código da extensão e do Admin.
- Tabela `crm_fechamentos` (periodo_ini, periodo_fim, user_id, vendas, tickets_fechados, sem_ticket, enviado_por, enviado_em). **Cada envio substitui o período que a planilha cobre** (apague/atualize as linhas do mesmo período e usuário antes de gravar) para que reenviar semanas que se sobrepõem não conte vendas em dobro.
- Resumo na tela após o envio: "Período, N vendas, N tickets fechados, N sem ticket, vendedores conferidos X de Y". Vendedor da planilha sem correspondência na Omnia fica "pendente" e não conta até mapear.
- RLS: admin escreve e lê tudo; o atendente lê só as próprias linhas (para o pódio e o Excel dele).

## 6. Pódio "Mais fechamentos" e comparativo
- Sexto pódio em Ranking (bloco 3): "Mais fechamentos" = vendas do mês por atendente a partir de `crm_fechamentos` (soma das semanas do mês). Mesmas regras do ranking: top 3 visível, cada atendente vê só o próprio valor (sem posição) e o do mês passado, liga/desliga em `ranking_config`, "Ocultar do mês", Hall do mês, e inclusão em `ranking_podios`/`ranking_admin`. Sem mínimo de retomadas. Atualize "Como é calculado" e o Admin > Ranking.
- Comparativo "60 dias antes × 60 depois" por atendente, no Admin (Extensão do WhatsApp > "Antes e depois"): data de início configurável (padrão: data do primeiro evento da extensão do atendente ou data escolhida pelo admin) comparando vendas por semana antes e depois. Só o admin vê. Se não houver 60 dias de dados, mostre o que há e diga quantos dias faltam.

## 7. Excel (relatório de inteligência: 3B, bloco 1/2/3)
Abas novas: **Extensao** (admin: atendente, tickets criados, atualizados, ignorados, pausas, por semana; atendente: só os próprios), **Tempo_de_resposta** (dia, conversas novas, dentro da meta, média em minutos úteis, sem resposta; atendente só os próprios), **Fechamentos** (período, vendas, tickets fechados, sem ticket; atendente só os próprios). Atualize o LEIA-ME. Nunca telefone, nome nem fala de cliente.

## Geral
Branch `fase-c-extensao-2`, um commit por seção (1 lista, 2 cálculo, 3 aba, 4 Admin, 5 upload CRM, 6 pódio/comparativo, 7 Excel), build + typecheck + testes, Pull Request para a main sem merge. No PR: migrações em ordem com SQL para o SQL editor do Lovable, o que não foi possível validar sem WhatsApp Web, limitações do cálculo (ex.: distinguir bot de humano), como o hash do telefone é feito e onde está o sal.
