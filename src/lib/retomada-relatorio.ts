import type { DadosRelatorio } from "@/lib/retomada.functions";

// Relatório Excel das retomadas, feito para ser lido por pessoas e por IA:
// 1 linha de cabeçalho por aba, sem células mescladas, sem linhas em branco,
// datas ISO "AAAA-MM-DD HH:MM" (horário de Brasília), vocabulário fixo e cada
// aba como Tabela do Excel com filtro.
//
// NUNCA entram no arquivo: telefone e fala do cliente.

export type Cel = string | number | null;
export interface Coluna { nome: string; significado: string; valores: string; largura?: number }
export interface Aba { nome: string; tabela: string; colunas: Coluna[]; linhas: Cel[][] }

const BRT = 3 * 3600_000;
/** "AAAA-MM-DD HH:MM" em Brasília. */
export const isoBR = (v: string | Date | null | undefined): string =>
  v ? new Date(new Date(v).getTime() - BRT).toISOString().slice(0, 16).replace("T", " ") : "";
const diaDe = (v: string | Date) => isoBR(v).slice(0, 10);
const sn = (b: unknown) => (b === true ? "sim" : b === false ? "não" : "");
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const str = (v: unknown) => (v == null ? "" : String(v));

const PONTOS = "nao_respondeu_primeira | parou_explicativa | recebeu_proposta | travou_fechamento";
const ETAPAS = "follow_up | d1 | d2 | d4 | d7 | d10";
const STATUS = "fila | respondeu | fechou | perdido | esfriou";
const ACOES = "recomendada | copiou | enviei | respondeu | fechou | perdido | voltou_fila | follow_up_agendado | esfriou";

const C = {
  clientes: [
    { nome: "codigo_ticket", significado: "Código curto do ticket de retomada.", valores: "RT-0001, RT-0002…", largura: 14 },
    { nome: "primeiro_nome", significado: "Primeiro nome do cliente (nunca o sobrenome).", valores: "texto livre", largura: 16 },
    { nome: "atendente", significado: "Atendente dono do ticket.", valores: "nome do atendente", largura: 16 },
    { nome: "origem", significado: "Como o ticket nasceu.", valores: "manual | fechamento | extensao", largura: 12 },
    { nome: "ponto_parada_inicial", significado: "Onde a conversa parou quando o ticket foi criado.", valores: PONTOS, largura: 24 },
    { nome: "ponto_parada_atual", significado: "Onde a conversa parou agora (muda quando o cliente volta para a fila).", valores: PONTOS, largura: 24 },
    { nome: "subetapa_fechamento", significado: "Só para travou_fechamento: etapa do fechamento em que o cliente travou.", valores: "proposta | plano | dados | pagamento | link | vazio", largura: 18 },
    { nome: "status", significado: "Situação atual do ticket.", valores: STATUS, largura: 11 },
    { nome: "etapa_atual", significado: "Etapa da cadência que o ticket está esperando.", valores: ETAPAS, largura: 11 },
    { nome: "entrou_em", significado: "Data e hora em que o ticket foi criado.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "ultima_acao", significado: "Última ação registrada no período.", valores: ACOES, largura: 18 },
    { nome: "ultima_acao_em", significado: "Data e hora da última ação registrada no período.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "dias_na_fila", significado: "Dias entre a entrada e hoje (ticket na fila) ou entre a entrada e a última atualização (ticket encerrado).", valores: "número inteiro", largura: 12 },
    { nome: "mensagens_enviadas", significado: "Quantas vezes o atendente clicou Enviei no período.", valores: "número inteiro", largura: 12 },
    { nome: "mensagens_recomendadas_usadas", significado: "Dos envios, quantos tiveram a mensagem da etapa copiada antes (usou_recomendada = sim).", valores: "número inteiro", largura: 14 },
    { nome: "vezes_voltou", significado: "Quantas vezes o cliente respondeu e voltou para a fila.", valores: "número inteiro", largura: 11 },
    { nome: "motivo_perda", significado: "Motivo escolhido ao marcar como perdido.", valores: "lista editável no Admin; vazio se não foi perdido", largura: 24 },
    { nome: "observacao", significado: "Observação escrita pelo atendente (nunca telefone nem fala do cliente).", valores: "texto livre", largura: 40 },
  ],
  eventos: [
    { nome: "data_hora", significado: "Quando a ação aconteceu.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "codigo_ticket", significado: "Ticket da ação (liga com a aba Clientes).", valores: "RT-0001…", largura: 14 },
    { nome: "primeiro_nome", significado: "Primeiro nome do cliente.", valores: "texto livre", largura: 16 },
    { nome: "atendente", significado: "Atendente que fez a ação.", valores: "nome do atendente", largura: 16 },
    { nome: "ponto_parada", significado: "Ponto de parada do ticket no momento da ação.", valores: PONTOS, largura: 24 },
    { nome: "etapa", significado: "Etapa da cadência da ação. Em respondeu, fechou e perdido é a etapa da última mensagem enviada (a que gerou o resultado).", valores: ETAPAS, largura: 11 },
    { nome: "acao", significado: "O que aconteceu.", valores: ACOES, largura: 18 },
    { nome: "codigo_mensagem", significado: "Mensagem da cadência ligada à ação (liga com a aba Mensagens).", valores: "<ponto_parada>_<etapa>, ex.: recebeu_proposta_d2", largura: 28 },
    { nome: "versao_mensagem", significado: "Versão da mensagem no momento da ação.", valores: "número inteiro", largura: 12 },
    { nome: "usou_recomendada", significado: "Só em acao = enviei: sim se a mensagem da etapa foi copiada antes do Enviei. A Omnia não vê se o texto foi editado no WhatsApp.", valores: "sim | não | vazio", largura: 14 },
    { nome: "detalhe", significado: "Complemento: motivo da perda, novo ponto de parada ao voltar para a fila, ou quando o follow-up foi agendado.", valores: "texto curto ou vazio", largura: 28 },
  ],
  mensagens: [
    { nome: "codigo_mensagem", significado: "Identifica o encaixe da mensagem na cadência.", valores: "<ponto_parada>_<etapa>", largura: 28 },
    { nome: "versao", significado: "Número da versão (cresce a cada edição publicada).", valores: "número inteiro", largura: 9 },
    { nome: "ponto_parada", significado: "Ponto de parada a que a mensagem pertence.", valores: `${PONTOS} | follow_up`, largura: 24 },
    { nome: "etapa", significado: "Etapa da cadência.", valores: ETAPAS, largura: 11 },
    { nome: "canal", significado: "Como o atendente envia.", valores: "texto | audio", largura: 9 },
    { nome: "papel", significado: "Função da mensagem na cadência.", valores: "lembrete | beneficio | prova | audio | despedida | outro", largura: 12 },
    { nome: "texto_modelo", significado: "Texto com variáveis {nome} {atendente} {plano} {dependentes} {usos} {observacao} (ou roteiro do áudio).", valores: "texto livre", largura: 60 },
    { nome: "por_que", significado: "Frase que explica ao atendente por que esta mensagem.", valores: "texto livre", largura: 40 },
    { nome: "publicada_em", significado: "Quando esta versão foi publicada.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "substituida_em", significado: "Quando outra versão tomou o lugar desta. Vazio = é a versão atual.", valores: "AAAA-MM-DD HH:MM ou vazio", largura: 17 },
  ],
  resumo: [
    { nome: "tipo_resumo", significado: "Qual leitura a linha traz.", valores: "ponto_parada_etapa | atendente", largura: 18 },
    { nome: "ponto_parada", significado: "Só em ponto_parada_etapa.", valores: PONTOS, largura: 24 },
    { nome: "etapa", significado: "Só em ponto_parada_etapa.", valores: ETAPAS, largura: 11 },
    { nome: "atendente", significado: "Só em atendente.", valores: "nome do atendente", largura: 16 },
    { nome: "enviadas", significado: "Quantos Enviei no período.", valores: "número inteiro", largura: 10 },
    { nome: "com_recomendada", significado: "Dos Enviei, quantos com a mensagem da etapa copiada antes.", valores: "número inteiro", largura: 14 },
    { nome: "respostas", significado: "Quantas vezes o cliente respondeu.", valores: "número inteiro", largura: 10 },
    { nome: "taxa_resposta", significado: "respostas ÷ enviadas, em percentual.", valores: "0 a 100, uma casa decimal; vazio se enviadas = 0", largura: 13 },
    { nome: "fechamentos", significado: "Quantos clientes fecharam.", valores: "número inteiro", largura: 11 },
    { nome: "perdidos", significado: "Quantos clientes foram marcados como perdidos.", valores: "número inteiro", largura: 10 },
    { nome: "tickets", significado: "Só em atendente: tickets do atendente no arquivo.", valores: "número inteiro", largura: 9 },
    { nome: "retomadas_no_dia_pct", significado: "Só em atendente: percentual de Enviei feitos no dia previsto (ou antes).", valores: "0 a 100, uma casa decimal", largura: 18 },
    { nome: "atrasos", significado: "Só em atendente: Enviei feitos depois do dia previsto.", valores: "número inteiro", largura: 9 },
  ],
  objecoes: [
    { nome: "data_hora", significado: "Quando o atendente copiou o ângulo de resposta.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "atendente", significado: "Atendente que copiou.", valores: "nome do atendente", largura: 16 },
    { nome: "objecao", significado: "Nome da objeção aprovada (a fala do cliente NÃO é guardada).", valores: "texto", largura: 36 },
    { nome: "angulo_copiado", significado: "Ângulo de resposta copiado.", valores: "logico | emocional | prova | vazio", largura: 16 },
    { nome: "objecao_nova", significado: "sim se a objeção foi aprovada a partir da fila de objeções novas.", valores: "sim | não", largura: 13 },
  ],
} satisfies Record<string, Coluna[]>;

export function montarAbas(d: DadosRelatorio): Aba[] {
  const nomeAt = (id: unknown) => d.atendentes[str(id)] ?? "";
  const ticketPorId = new Map(d.tickets.map((t) => [str(t.id), t]));

  // Mensagens: versão atual de cada encaixe + versões antigas realmente usadas no período.
  const usadas = new Set(d.eventos.filter((e) => e.mensagem_id).map((e) => `${e.mensagem_id}:${e.mensagem_versao}`));
  const codigoDe = new Map<string, string>();
  const msgLinhas: Cel[][] = [];
  for (const m of d.mensagens) {
    codigoDe.set(str(m.id), str(m.codigo));
    msgLinhas.push([str(m.codigo), Number(m.versao), str(m.ponto_parada), str(m.etapa), str(m.canal), str(m.papel), str(m.texto), str(m.por_que), isoBR(m.publicada_em as string), ""]);
  }
  for (const v of d.versoes) {
    if (!usadas.has(`${v.mensagem_id}:${v.versao}`)) continue;
    msgLinhas.push([str(v.codigo), Number(v.versao), str(v.ponto_parada), str(v.etapa), str(v.canal), str(v.papel), str(v.texto), str(v.por_que), isoBR(v.publicada_em as string), isoBR(v.substituida_em as string)]);
  }
  msgLinhas.sort((a, b) => str(a[0]).localeCompare(str(b[0])) || Number(a[1]) - Number(b[1]));

  // Eventos
  const eventos = [...d.eventos].sort((a, b) => str(a.created_at).localeCompare(str(b.created_at)));
  const evLinhas: Cel[][] = eventos.map((e) => {
    const t = ticketPorId.get(str(e.retomada_id));
    return [
      isoBR(e.created_at as string), str(t?.codigo), str(t?.primeiro_nome), nomeAt(e.user_id),
      str(e.ponto_parada ?? t?.ponto_parada), str(e.etapa), str(e.acao),
      codigoDe.get(str(e.mensagem_id)) ?? "", e.mensagem_versao == null ? null : Number(e.mensagem_versao),
      e.acao === "enviei" ? sn(e.usou_recomendada) : "", str(e.detalhe),
    ];
  });

  // Clientes
  const porTicket = new Map<string, typeof eventos>();
  for (const e of eventos) { const k = str(e.retomada_id); (porTicket.get(k) ?? porTicket.set(k, []).get(k)!).push(e); }
  const fimExport = new Date(d.exportadoEm).getTime();
  const tickets = [...d.tickets].sort((a, b) => str(a.codigo).localeCompare(str(b.codigo)));
  const clLinhas: Cel[][] = tickets.map((t) => {
    const evs = porTicket.get(str(t.id)) ?? [];
    const ult = evs[evs.length - 1];
    const env = evs.filter((e) => e.acao === "enviei");
    const fim = t.status === "fila" ? fimExport : new Date(str(t.updated_at)).getTime();
    return [
      str(t.codigo), str(t.primeiro_nome), nomeAt(t.user_id) || str(t.atendente), str(t.origem),
      str(t.ponto_parada_inicial), str(t.ponto_parada), str(t.subetapa_fechamento), str(t.status), str(t.etapa_atual),
      isoBR(t.created_at as string), str(ult?.acao), isoBR(ult?.created_at as string),
      Math.max(0, Math.floor((fim - new Date(str(t.created_at)).getTime()) / 86400_000)),
      env.length, env.filter((e) => e.usou_recomendada === true).length,
      Number(t.vezes_voltou ?? 0), str(t.motivo_perda), str(t.observacao),
    ];
  });

  // Resumo
  type Ac = { env: number; rec: number; resp: number; fech: number; perd: number; noDia: number; atr: number };
  const zero = (): Ac => ({ env: 0, rec: 0, resp: 0, fech: 0, perd: 0, noDia: 0, atr: 0 });
  const porPE = new Map<string, Ac>();
  const porAt = new Map<string, Ac>();
  const soma = (a: Ac, e: (typeof eventos)[number]) => {
    if (e.acao === "enviei") {
      a.env++;
      if (e.usou_recomendada === true) a.rec++;
      if (e.prevista_em) { if (diaDe(e.created_at as string) > diaDe(e.prevista_em as string)) a.atr++; else a.noDia++; }
    } else if (e.acao === "respondeu") a.resp++;
    else if (e.acao === "fechou") a.fech++;
    else if (e.acao === "perdido") a.perd++;
  };
  for (const e of eventos) {
    const t = ticketPorId.get(str(e.retomada_id));
    const ponto = str(e.ponto_parada ?? t?.ponto_parada);
    if (ponto) soma(porPE.get(`${ponto}|${e.etapa}`) ?? porPE.set(`${ponto}|${e.etapa}`, zero()).get(`${ponto}|${e.etapa}`)!, e);
    const at = nomeAt(e.user_id);
    soma(porAt.get(at) ?? porAt.set(at, zero()).get(at)!, e);
  }
  const ticketsPorAt = new Map<string, number>();
  for (const l of clLinhas) ticketsPorAt.set(str(l[2]), (ticketsPorAt.get(str(l[2])) ?? 0) + 1);
  for (const at of ticketsPorAt.keys()) if (!porAt.has(at)) porAt.set(at, zero());

  const rsLinhas: Cel[][] = [];
  for (const [k, a] of [...porPE.entries()].sort()) {
    const [ponto, etapa] = k.split("|");
    rsLinhas.push(["ponto_parada_etapa", ponto, etapa, "", a.env, a.rec, a.resp, pct(a.resp, a.env), a.fech, a.perd, null, null, null]);
  }
  for (const [at, a] of [...porAt.entries()].sort((x, y) => x[0].localeCompare(y[0], "pt-BR"))) {
    rsLinhas.push(["atendente", "", "", at, a.env, a.rec, a.resp, pct(a.resp, a.env), a.fech, a.perd, ticketsPorAt.get(at) ?? 0, pct(a.noDia, a.env), a.atr]);
  }

  // Objeções
  const obLinhas: Cel[][] = [...d.objecoes]
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora))
    .map((o) => [isoBR(o.data_hora), o.atendente, o.objecao, o.angulo_copiado, sn(o.objecao_nova) || "não"]);

  const leiaMe = montarLeiaMe(d);
  return [
    { nome: "LEIA-ME", tabela: "tbl_leia_me", colunas: LEIA_ME_COLUNAS, linhas: leiaMe },
    { nome: "Clientes", tabela: "tbl_clientes", colunas: C.clientes, linhas: clLinhas },
    { nome: "Eventos", tabela: "tbl_eventos", colunas: C.eventos, linhas: evLinhas },
    { nome: "Mensagens", tabela: "tbl_mensagens", colunas: C.mensagens, linhas: msgLinhas },
    { nome: "Resumo", tabela: "tbl_resumo", colunas: C.resumo, linhas: rsLinhas },
    { nome: "Objeções", tabela: "tbl_objecoes", colunas: C.objecoes, linhas: obLinhas },
  ];
}

const LEIA_ME_COLUNAS: Coluna[] = [
  { nome: "secao", significado: "Bloco do guia.", valores: "", largura: 22 },
  { nome: "item", significado: "Nome do que está sendo explicado.", valores: "", largura: 30 },
  { nome: "descricao", significado: "Explicação.", valores: "", largura: 90 },
  { nome: "valores_possiveis", significado: "Valores aceitos (vocabulário fixo).", valores: "", largura: 60 },
];

function montarLeiaMe(d: DadosRelatorio): Cel[][] {
  const r: Cel[][] = [];
  const add = (secao: string, item: string, descricao: string, valores = "") => r.push([secao, item, descricao, valores]);

  add("arquivo", "o_que_e", "Relatório das retomadas da OMNIA Apoio (Cartão de TODOS): clientes que pararam de responder no WhatsApp e a cadência de mensagens usada para retomá-los. Feito para ser analisado por pessoas ou por IA.");
  add("arquivo", "periodo", `De ${d.de} até ${d.ate} (datas de Brasília, ambas inclusas).`);
  add("arquivo", "escopo", d.escopo === "equipe" ? "Equipe inteira (ou o atendente filtrado no Admin)." : "Somente os clientes do atendente que exportou.", "atendente | equipe");
  add("arquivo", "exportado_por", d.exportadoPor);
  add("arquivo", "exportado_em", isoBR(d.exportadoEm), "AAAA-MM-DD HH:MM");
  add("arquivo", "privacidade", "Telefone e fala do cliente nunca entram neste arquivo. Só primeiro nome e a observação escrita pelo atendente.");
  add("arquivo", "formato", "Cada aba é uma tabela com 1 linha de cabeçalho, sem células mescladas e sem linhas em branco. Datas em AAAA-MM-DD HH:MM (horário de Brasília). Os valores usam sempre o mesmo vocabulário descrito abaixo.");

  add("cadencia", "visao_geral", "Cada cliente que para de responder vira um ticket. O atendente escolhe quando retomar. A cadência tem texto ou áudio gravado pelo próprio atendente (não há ligações).");
  add("cadencia", "follow_up", "Retomada no mesmo dia, 2 a 5 horas depois do combinado. Depois do follow-up o ticket entra no D+1 (no dia seguinte).", "follow_up");
  add("cadencia", "d1", "Primeiro retrabalho, 1 dia depois. Lembrete leve.", "d1");
  add("cadencia", "d2", "1 dia depois do D+1. Benefício do que o cliente disse que usaria.", "d2");
  add("cadencia", "d4", "2 dias depois do D+2. Prova (caso real de economia).", "d4");
  add("cadencia", "d7", "3 dias depois do D+4. Áudio curto e pessoal, gravado pelo atendente.", "d7");
  add("cadencia", "d10", "3 dias depois do D+7. Despedida com porta aberta.", "d10");
  add("cadencia", "esfriou", "Se, 2 dias depois do D+10, o cliente não respondeu, o ticket vira esfriou automaticamente.", "esfriou");

  add("pontos_de_parada", "nao_respondeu_primeira", "O cliente não respondeu a primeira mensagem.", "nao_respondeu_primeira");
  add("pontos_de_parada", "parou_explicativa", "O cliente parou depois da mensagem explicativa.", "parou_explicativa");
  add("pontos_de_parada", "recebeu_proposta", "O cliente recebeu a proposta e sumiu.", "recebeu_proposta");
  add("pontos_de_parada", "travou_fechamento", "O cliente travou numa etapa do fechamento (ver subetapa_fechamento).", "travou_fechamento");

  add("funil_crm", "etapas", "Funil do CRM: Novo lead → Lead qualificado → Proposta enviada → Fechamento → Venda concluída. As retomadas acontecem entre Lead qualificado e Fechamento.", "Novo lead | Lead qualificado | Proposta enviada | Fechamento | Venda concluída");

  add("status", "fila", "Ticket ativo, esperando a próxima etapa da cadência.", "fila");
  add("status", "respondeu", "O cliente respondeu e saiu da lista do dia. Pode voltar para a fila.", "respondeu");
  add("status", "fechou", "O cliente fechou a venda.", "fechou");
  add("status", "perdido", "O cliente foi dado como perdido (ver motivo_perda).", "perdido");
  add("status", "esfriou", "Passaram 2 dias do D+10 sem resposta.", "esfriou");

  add("acoes", "recomendada", "A Omnia recomendou a mensagem da etapa (registrada ao abrir o ticket na etapa).", "recomendada");
  add("acoes", "copiou", "O atendente copiou a mensagem da etapa.", "copiou");
  add("acoes", "enviei", "O atendente clicou Enviei. Agenda a próxima etapa.", "enviei");
  add("acoes", "respondeu", "O cliente respondeu.", "respondeu");
  add("acoes", "fechou", "O cliente fechou.", "fechou");
  add("acoes", "perdido", "O cliente foi marcado como perdido; detalhe traz o motivo.", "perdido");
  add("acoes", "voltou_fila", "O cliente respondeu antes e voltou para a fila; detalhe traz o novo ponto de parada. Recomeça no D+1.", "voltou_fila");
  add("acoes", "follow_up_agendado", "Follow-up marcado ao criar o ticket; detalhe traz 2h, 3h, 4h ou 5h.", "follow_up_agendado");
  add("acoes", "esfriou", "O sistema marcou o ticket como esfriou (2 dias após o D+10).", "esfriou");

  add("limites", "usou_recomendada", "usou_recomendada = sim significa que o atendente copiou a mensagem da etapa antes de clicar Enviei. A Omnia não vê se o texto foi editado no WhatsApp: sim não garante que a mensagem foi enviada igual.", "sim | não");
  add("limites", "objecao_nova", "Na aba Objeções, objecao_nova = sim quando a objeção foi aprovada a partir da fila de objeções novas (só aparece no arquivo da equipe).", "sim | não");
  add("limites", "versoes", "A aba Mensagens traz a versão atual de cada mensagem usada no período e as versões antigas que foram usadas. Use codigo_mensagem + versao para ligar com a aba Eventos.");

  for (const [aba, cols] of [["Clientes", C.clientes], ["Eventos", C.eventos], ["Mensagens", C.mensagens], ["Resumo", C.resumo], ["Objeções", C.objecoes]] as const) {
    for (const c of cols) add("dicionario_de_colunas", `${aba}.${c.nome}`, c.significado, c.valores);
  }
  return r;
}

/** Monta o .xlsx (ArrayBuffer). Funciona no navegador e no Node. */
export async function montarRelatorioXlsx(d: DadosRelatorio): Promise<ArrayBuffer> {
  return abasParaXlsx(montarAbas(d), d.exportadoEm);
}

/** Escreve as abas como Tabelas do Excel (compartilhado com o relatório de inteligência). */
export async function abasParaXlsx(abas: Aba[], exportadoEm: string, abasComQuebra: string[] = ["LEIA-ME", "Mensagens"]): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "OMNIA Apoio";
  wb.created = new Date(exportadoEm);
  for (const aba of abas) {
    const ws = wb.addWorksheet(aba.nome, { views: [{ state: "frozen", ySplit: 1 }] });
    aba.colunas.forEach((c, i) => { ws.getColumn(i + 1).width = c.largura ?? 16; });
    // Tabela do Excel com filtro. Sem linhas, uma linha vazia para a tabela existir.
    const linhas = aba.linhas.length ? aba.linhas : [aba.colunas.map(() => null)];
    ws.addTable({
      name: aba.tabela,
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleLight1", showRowStripes: true },
      columns: aba.colunas.map((c) => ({ name: c.nome, filterButton: true })),
      rows: linhas,
    });
    if (abasComQuebra.includes(aba.nome)) {
      ws.eachRow((row) => row.eachCell((cell) => { cell.alignment = { vertical: "top", wrapText: true }; }));
    }
  }
  const out = await wb.xlsx.writeBuffer();
  return out as ArrayBuffer;
}

export function nomeArquivoRelatorio(d: DadosRelatorio, atendente?: string | null): string {
  const quem = (d.escopo === "equipe" ? atendente || "equipe" : d.exportadoPor || "atendente")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "atendente";
  return `omnia-retomadas_${quem}_${d.de}_a_${d.ate}.xlsx`;
}
