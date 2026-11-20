Fase A, bloco 2 da OMNIA Apoio: "Retomar hoje" (follow-up + cadência de retrabalho), roteiros de áudio, relatório Excel e as seções do Painel Admin. Siga os tokens e regras da marca (docs/redesign-omnia/prompt-lovable-base-omnia.md) e o padrão lista + painel do Admin.

Pré-requisito: o bloco 1 (docs/fase-a/prompt-bloco1-cliente-disse.md) já está na main. Este bloco usa `fechamento_casos`, `objecoes` e `cliente_disse_uso` dele. Se não estiver, pare e avise.

Esboços aprovados (siga fielmente):
- docs/fase-a/retomada-hoje.png
- docs/fase-a/retomada-adicionar.png
- docs/fase-a/retomada-admin.png

Nomes, números, mensagens e contagens dos esboços são ilustrativos.

IMPORTANTE SOBRE O MODO DE TRABALHO
- NÃO monte harness visual, servidor de preview com Playwright nem tire capturas de tela. Valide com build e typecheck.
- Banco é Lovable Cloud: entregue as migrações em ordem com o SQL pronto para o SQL editor do Lovable.

## Contexto do negócio
- A equipe só atende por mensagem (WhatsApp/Ztalk); não há ligações. Canais da cadência: texto ou áudio gravado pelo próprio atendente.
- Funil do CRM: Novo lead → Lead qualificado → Proposta enviada → Fechamento → Venda concluída.
- Nunca "não é plano de saúde" em mensagem para cliente.

## 1. Dados (migrações)
- `retomadas` (ticket): codigo curto legível (ex.: RT-0142), user_id (atendente), primeiro_nome, telefone (texto, opcional), observacao, ponto_parada (nao_respondeu_primeira | parou_explicativa | recebeu_proposta | travou_fechamento), ponto_parada_inicial, subetapa_fechamento (quando travou_fechamento, puxa do caso do bloco 1), fechamento_caso_id (opcional), origem (manual | fechamento | extensao), status (fila | respondeu | fechou | perdido | esfriou), etapa_atual (follow_up | d1 | d2 | d4 | d7 | d10), proxima_em (timestamptz), motivo_perda, vezes_voltou int, created_at, updated_at.
  - **Telefone**: visível e legível só pelo próprio atendente (RLS por user_id; o admin NÃO lê a coluna — use uma view para o admin sem o telefone). Apagar (set null) quando status sair de "fila"/"respondeu" para fechou/perdido/esfriou, ou 30 dias após created_at, o que vier primeiro (função agendada diária + limpeza ao abrir a página).
- `cadencia_mensagens`: ponto_parada (os 4 + follow_up), etapa (follow_up | d1 | d2 | d4 | d7 | d10), canal (texto | audio), papel (lembrete | beneficio | prova | audio | despedida | outro), texto (template com {nome} {atendente} {plano} {dependentes} {usos} {observacao}), por_que (frase que aparece para o atendente), audio_exemplo_url (Storage, opcional), versao int (incrementa a cada edição publicada; guarde as versões antigas em `cadencia_mensagens_versoes`), status (rascunho | publicada), updated_at.
- `retomada_eventos`: retomada_id, user_id, etapa, acao (recomendada | copiou | enviei | respondeu | fechou | perdido | voltou_fila | follow_up_agendado | esfriou), mensagem_id, mensagem_versao, usou_recomendada (boolean: true se houve "copiou" da mensagem da etapa antes do "enviei"), detalhe (ex.: motivo da perda), created_at.
- `motivos_perda`: lista editável no Admin (padrão: Sem dinheiro agora · Já tem outro cartão/plano · Não vê necessidade · Desconfiança · Não respondeu mais · Outro).
- Base inicial: crie as sequências dos 4 pontos de parada + follow-up com papel e canal (D+1 lembrete/texto, D+2 benefício/texto, D+4 prova/texto, D+7 áudio, D+10 despedida/texto) como "rascunho" e textos vazios ou marcados "[escrever]". Se existir docs/fase-a/base-bloco2.json, importe como rascunho. Não invente mensagens.

## 2. Menu e Início
- Item novo no grupo Atendimento: "Retomar hoje" (rota /retomar), logo abaixo de Scripts, com pílula dourada da contagem do dia (follow-ups vencidos + retrabalhos de hoje + atrasados).
- Na Início, abaixo da faixa escura: "Você tem N retomadas hoje" + "Abrir →" (some quando N = 0).

## 3. Página /retomar — retomada-hoje.png
- Cabeçalho: "Retomar hoje" + data por extenso; botão dourado "+ Adicionar à retomada"; linha-resumo: N follow-up · N retrabalhos · N atrasados · N feitos; à direita, link "Baixar relatório (Excel)" (seção 6, só os clientes do próprio atendente).
- Lista à esquerda (≈470px), grupos com overline: FOLLOW-UP · NA HORA (proxima_em vencida no dia, etapa follow_up; selo dourado "Follow-up"); RETRABALHO DE HOJE (selo com a etapa: D+1, D+2, D+4, "D+7 · áudio", D+10); ATRASADOS (proxima_em de dias anteriores; selo tracejado); FEITOS HOJE (esmaecidos, com "Enviei · próximo D+4 em dd/mm"). Linha: primeiro nome (600) + "onde parou · detalhe".
- Detalhe à direita: overline "RETRABALHO · D+2 · <ponto de parada>", nome + telefone (só se existir) + "Copiar número"; pílulas com plano/dependentes/usos quando vier do bloco 1 e "Entrou em dd/mm"; observação (fundo sidebar); régua da cadência (D+1 … D+10 — feitas em surface-2, atual com borda dourada); "MENSAGEM DO D+N" montada com o template publicado + variáveis, "Copiar" (registra evento copiou); "Por que esta mensagem: …"; se canal = áudio: mostra "ROTEIRO DO ÁUDIO (até 30 s)" + player do áudio de exemplo e a instrução "Grave com a sua voz no WhatsApp"; botões **Enviei** (dourado) · Respondeu · Fechou · Perdido; link "Abrir em 'Fechar com este cliente' →" quando houver caso do bloco 1; nota "O número some quando o cliente sai da fila ou em 30 dias. Só você vê o número."
- Ações:
  - Enviei → registra evento (usou_recomendada calculado), agenda a próxima etapa (D+1→D+2 em 1 dia, D+2→D+4 em 2 dias, D+4→D+7 em 3 dias, D+7→D+10 em 3 dias; follow_up→D+1 no dia seguinte). Após o envio do D+10, sem resposta em 2 dias → status esfriou (automático).
  - Respondeu → status respondeu (sai da lista do dia; aparece em "Respondidos" no seletor "Meus clientes"), com botão "Voltar para a fila" que pergunta o novo ponto de parada e recomeça no D+1 (vezes_voltou + 1).
  - Fechou → status fechou. Perdido → escolhe o motivo em pílulas (motivos_perda) → status perdido.
- Seletor "Meus clientes ⌄" (Na fila · Respondidos · Encerrados) para achar qualquer ticket.

## 4. Adicionar à retomada — retomada-adicionar.png
- Painel/popover: primeiro nome, WhatsApp (opcional, máscara BR), "ONDE PAROU" (4 pílulas), "QUANDO RETOMAR" (Follow-up em 2h · 3h · 4h · 5h · Amanhã (D+1)), observação, nota de privacidade, Adicionar / Cancelar.
- Também cria ticket a partir do bloco 1: o botão "Retomar depois" de "Fechar com este cliente" passa a criar uma `retomada` (origem fechamento, ponto travou_fechamento, subetapa do caso, D+1 amanhã), em vez de só gravar a data.
- Deixe pronta uma função de servidor `criarRetomadaExterna` (nome, telefone, observação, ponto de parada sugerido, quando) para a futura extensão do Chrome (origem extensao) — sem interface agora.

## 5. Avisos de follow-up
- Quando um follow-up vencer com a Omnia aberta: toast discreto "Hora do follow-up: Carla" com "Abrir". Peça permissão de notificação do navegador uma vez (botão "Ativar avisos" no cabeçalho de /retomar); com permissão, dispare Notification mesmo com a aba em segundo plano (checagem a cada minuto enquanto a Omnia estiver aberta em alguma aba).

## 6. Relatório Excel (.xlsx) — feito para ser analisado por IA
- Gere no navegador (SheetJS/xlsx) ou em função de servidor. Nome: `omnia-retomadas_<atendente|equipe>_<AAAA-MM-DD>_a_<AAAA-MM-DD>.xlsx`.
- Atendente: botão em /retomar, só os próprios tickets. Admin: botão na seção Cadência de retomada, com filtro de período e de atendente.
- **Telefone nunca vai no arquivo.** Fala do cliente nunca vai no arquivo.
- Regras de formato: 1 linha de cabeçalho por aba, sem células mescladas, sem linhas em branco, datas em ISO (AAAA-MM-DD HH:MM), nomes de colunas em português sem abreviação, valores com vocabulário fixo (os mesmos do LEIA-ME), cada aba como Tabela do Excel com filtro.
- Abas:
  1. **LEIA-ME**: o que é o arquivo; período e quem exportou; como funciona a cadência (Follow-up 2–5h; D+1, D+2, D+4, D+7 áudio, D+10; esfriou 2 dias após o D+10); os 4 pontos de parada; o funil do CRM; o significado de cada status e de cada ação; o limite "usou_recomendada = copiou a mensagem da etapa antes de clicar Enviei; a Omnia não vê se o texto foi editado no WhatsApp"; e o dicionário de todas as colunas de todas as abas (aba, coluna, significado, valores possíveis).
  2. **Clientes** (1 linha por ticket): codigo_ticket, primeiro_nome, atendente, origem, ponto_parada_inicial, ponto_parada_atual, subetapa_fechamento, status, etapa_atual, entrou_em, ultima_acao, ultima_acao_em, dias_na_fila, mensagens_enviadas, mensagens_recomendadas_usadas, vezes_voltou, motivo_perda, observacao.
  3. **Eventos** (1 linha por ação): data_hora, codigo_ticket, primeiro_nome, atendente, ponto_parada, etapa, acao, codigo_mensagem, versao_mensagem, usou_recomendada, detalhe.
  4. **Mensagens** (catálogo, incluindo versões antigas usadas no período): codigo_mensagem, versao, ponto_parada, etapa, canal, papel, texto_modelo, por_que, publicada_em, substituida_em.
  5. **Resumo**: por ponto_parada × etapa: enviadas, com_recomendada, respostas, taxa_resposta, fechamentos, perdidos; e por atendente: tickets, retomadas_no_dia_pct, atrasos, respostas, fechamentos.
  6. **Objeções** (bloco 1): data_hora, atendente, objecao, angulo_copiado, objecao_nova (sim/não). Sem a fala do cliente.

## 7. Painel Admin (grupo Atendimento) — retomada-admin.png
- **Cadência de retomada**: pílulas por ponto de parada (Não respondeu a 1ª · Parou na explicativa · Recebeu a proposta · Travou no fechamento · Follow-up); lista das etapas (etapa, canal, status, papel); painel com canal (Texto/Áudio), texto/roteiro com botões de variáveis, áudio de exemplo (upload para Storage), "Por que esta mensagem", Salvar (publicar gera nova versão).
- Bloco "EQUIPE · ÚLTIMOS 7 DIAS": na fila, % de retomadas feitas no dia, responderam, fecharam, perdidos + 1º motivo; "Ver por atendente →" (tabela só com números, nunca nomes de clientes nem telefones). Botão "Baixar relatório (Excel)" com filtros.
- **Motivos de perda**: lista editável.
- Contar no "O que precisa de você": "Atendentes com retomadas atrasadas" (quantos têm atrasos de mais de 1 dia).
- Link "Editar" (ao lado do "?") em /retomar abre /admin/cadencia.

## Geral
- Respeite temas claro e escuro. Estados vazios: "Nada para retomar hoje." com atalho "+ Adicionar à retomada".

Trabalhe numa branch fase-a-bloco2, um commit por seção, rode build e typecheck, e abra um Pull Request para a main. Não faça merge sozinho. No PR: migrações em ordem com o SQL pronto para o SQL editor do Lovable, tabelas novas, como ficou a proteção do telefone (RLS/view) e um arquivo .xlsx de exemplo gerado com dados fictícios em docs/fase-a/exemplo-relatorio-retomadas.xlsx.
