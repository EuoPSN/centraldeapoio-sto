import { z } from "zod";
import { removerDadosPessoais } from "@/lib/cliente-disse";

// Cérebro da Omnia — tipos, constantes e funções puras (sem banco nem IA).
// Usado no navegador (Admin, Copiloto, Raio-X) e no servidor (cerebro.server.ts).

// ---------------------------------------------------------------------------
// Ferramentas que usam o Cérebro
// ---------------------------------------------------------------------------

export const FERRAMENTAS = ["marciana", "cliente_disse", "mensagem_cliente", "retomada", "copiloto", "raiox", "simulador"] as const;
export type Ferramenta = (typeof FERRAMENTAS)[number];

export const FERRAMENTA_LABEL: Record<Ferramenta, string> = {
  marciana: "MarcIAna",
  cliente_disse: "Cliente disse",
  mensagem_cliente: "Mensagem para o cliente",
  retomada: "Retomada",
  copiloto: "Copiloto",
  raiox: "Raio-X",
  simulador: "Simulador",
};

/** Colunas mostradas no Admin ("Quem usa o quê"). A "Mensagem para o cliente"
 * faz parte da MarcIAna: marcar uma marca a outra. */
export const FERRAMENTAS_COLUNAS = ["marciana", "cliente_disse", "retomada", "copiloto", "raiox", "simulador"] as const;
export type FerramentaColuna = (typeof FERRAMENTAS_COLUNAS)[number];

export function ferramentasDaColuna(c: FerramentaColuna): Ferramenta[] {
  return c === "marciana" ? ["marciana", "mensagem_cliente"] : [c];
}
export function colunaUsa(ferramentas: readonly string[], c: FerramentaColuna): boolean {
  return ferramentasDaColuna(c).some((f) => ferramentas.includes(f));
}
export function alternarColuna(ferramentas: readonly string[], c: FerramentaColuna): Ferramenta[] {
  const fs = ferramentasDaColuna(c);
  const base = ferramentas.filter((f) => !fs.includes(f as Ferramenta)) as Ferramenta[];
  return colunaUsa(ferramentas, c) ? base : [...base, ...fs];
}

// ---------------------------------------------------------------------------
// Blocos, regras, padrão de escrita e etapas do funil
// ---------------------------------------------------------------------------

export interface CerebroBloco {
  id: string;
  chave: string;
  titulo: string;
  descricao_curta: string;
  conteudo: string;
  ferramentas: Ferramenta[];
  gerado: boolean;
  ativo: boolean;
  ordem: number;
  updated_at: string;
}
export interface RegraFixa { id: string; texto: string; ordem: number; ativo: boolean }
export interface PadraoEscritaItem {
  id: string; tipo: "pode" | "nao_pode"; item: string; exemplo_errado: string; exemplo_certo: string; ativo: boolean; ordem: number;
}

export const ETAPAS_FUNIL = ["novo_lead", "lead_qualificado", "proposta_enviada", "fechamento", "venda_concluida"] as const;
export type EtapaFunil = (typeof ETAPAS_FUNIL)[number];
export const ETAPA_FUNIL_NOME: Record<EtapaFunil, string> = {
  novo_lead: "Novo lead",
  lead_qualificado: "Lead qualificado",
  proposta_enviada: "Proposta enviada",
  fechamento: "Fechamento",
  venda_concluida: "Venda concluída",
};
export interface FunilEtapa { etapa: EtapaFunil; nome: string; definicao: string; sinais: string[]; ordem: number }

/** Regras que valem se o banco ainda não tiver as do Admin (migração pendente). */
export const REGRAS_FIXAS_PADRAO: readonly string[] = [
  'Nunca diga "não é plano de saúde".',
  "Pagamento: somente cartão de crédito ou cartão de débito.",
  "Nunca invente preço, carência, regra ou benefício: use só os dados da Omnia.",
  "Escreva em português do Brasil.",
  "Tom acolhedor de WhatsApp.",
];

/** Texto "[escrever]" (ou vazio) significa "ainda sem conteúdo": a IA ignora. */
export function blocoVazio(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  return !t || t.toLowerCase() === "[escrever]";
}

export function contarPalavras(texto: string): number {
  const t = texto.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Texto do bloco "padrao_escrita", gerado da tabela. */
export function gerarPadraoEscrita(itens: PadraoEscritaItem[]): string {
  const ativos = itens.filter((i) => i.ativo).sort((a, b) => a.ordem - b.ordem);
  const linha = (i: PadraoEscritaItem) => {
    const ex = [i.exemplo_errado && `errado: "${i.exemplo_errado}"`, i.exemplo_certo && `certo: "${i.exemplo_certo}"`].filter(Boolean).join(" · ");
    return `- ${i.item}${ex ? ` (${ex})` : ""}`;
  };
  const pode = ativos.filter((i) => i.tipo === "pode").map(linha);
  const nao = ativos.filter((i) => i.tipo === "nao_pode").map(linha);
  if (!pode.length && !nao.length) return "";
  return [pode.length && `PADRÃO DE ESCRITA — pode:\n${pode.join("\n")}`, nao.length && `PADRÃO DE ESCRITA — não pode:\n${nao.join("\n")}`].filter(Boolean).join("\n\n");
}

/** Texto do bloco "etapas_funil", gerado da tabela (só etapas com definição). */
export function gerarEtapasFunil(etapas: FunilEtapa[]): string {
  const com = etapas.filter((e) => e.definicao.trim() || e.sinais.length).sort((a, b) => a.ordem - b.ordem);
  if (!com.length) return "";
  const corpo = com.map((e) => {
    const sinais = e.sinais.length ? `\n  Sinais na conversa: ${e.sinais.join("; ")}` : "";
    return `- ${e.etapa} (${e.nome}): ${e.definicao.trim() || "[sem definição]"}${sinais}`;
  });
  return `ETAPAS DO FUNIL (classifique só com estas definições, usando exatamente estes códigos):\n${corpo.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Limites de uso
// ---------------------------------------------------------------------------

export const LIMITE_AVISO = 0.8;

export interface UsoStatus {
  ferramenta: Ferramenta;
  usado: number;
  /** null = sem limite (admin ou ferramenta sem limite definido). */
  limite: number | null;
  bloqueado: boolean;
  /** Passou de 80% do limite. */
  aviso: boolean;
}

export function calcularUso(ferramenta: Ferramenta, usado: number, limite: number | null): UsoStatus {
  return {
    ferramenta, usado, limite,
    bloqueado: limite != null && usado >= limite,
    aviso: limite != null && usado < limite && usado >= Math.ceil(limite * LIMITE_AVISO),
  };
}

export function mensagemLimite(ferramenta: Ferramenta): string {
  return `Você chegou ao limite de hoje do ${FERRAMENTA_LABEL[ferramenta]}. Volta amanhã ou peça ao Paulo para liberar mais.`;
}

export const ERRO_ANALISE = "Não consegui analisar agora. Tente de novo.";

// ---------------------------------------------------------------------------
// Conversa exportada (.txt): leitura e limpeza no navegador, antes do envio.
// Formatos: Ztalk, WhatsApp Android ("dd/mm/aaaa hh:mm - Nome: texto") e
// WhatsApp iOS ("[dd/mm/aaaa hh:mm] Nome: texto"). O formato é detectado sozinho.
// A conversa bruta nunca é guardada: só o resultado limpo desta função.
// ---------------------------------------------------------------------------

/** Mensagens enviadas à IA: as primeiras e as últimas, quando a conversa é longa. */
export const MAX_PRIMEIRAS = 10;
export const MAX_ULTIMAS = 80;
const MAX_CARACTERES_MENSAGEM = 900;

export type DeQuem = "cliente" | "atendente" | "pessoa";

export interface UltimaMensagem { de: DeQuem; /** ISO com fuso de Brasília. */ em: string }

export interface ConversaPreparada {
  /** Texto pronto para a IA (sem telefone, CPF, e-mail; cliente como "Cliente"; sem cabeçalho do arquivo). */
  texto: string;
  /** Primeiro nome do cliente, lido só no navegador (não vai para a IA). */
  primeiroNomeCliente: string | null;
  /** Calculado aqui, a partir dos horários, quando o atendente foi identificado. */
  tempoResposta: { mediaMin: number; maiorMin: number } | null;
  /** Total real de mensagens da conversa (avisos do sistema não contam). */
  mensagens: number;
  /** null quando não deu para saber quem é o atendente. */
  doCliente: number | null;
  doAtendente: number | null;
  /** Data e hora da primeira e da última mensagem (dd/mm/aaaa hh:mm). */
  primeira: string | null;
  ultima: string | null;
  /** Linhas que não consegui interpretar. */
  naoReconhecidas: number;
  /** Quantas mensagens vão para a IA e quantas ficaram de fora (conversa longa). */
  enviadas: number;
  cortadas: number;
  /** Quem falou por último e quando (para o servidor calcular "há quanto tempo"). */
  ultimaMensagem: UltimaMensagem | null;
  /** Últimas mensagens já limpas, só para mostrar na tela. */
  previa: { de: DeQuem; texto: string }[];
}

const ZTALK_MSG = /^\[(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})\]\[[^\]]*\]\[([^\]]*)\]\[([^\]]*)\]\s*-\s?(.*)$/;
const ZTALK_ID = /^ID:\s*\S+\s+-\s+Tipo:/;
const ZTALK_INICIO = /^Iniciado em:/;
const COMECA_COM_DATA = /^\[\d{1,2}\/\d{1,2}\/\d{2,4}[ ,]+\d{1,2}:\d{2}/;
const CABECALHO = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*[ap]\.?m\.?)?\]?\s*(?:-\s*)?(.*)$/i;
const SO_NUMERO = /^[+\d\s()-]+$/;

function primeiroToken(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? "";
}
function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const dois = (n: number) => String(n).padStart(2, "0");

function formatarData(em: number): string {
  const d = new Date(em);
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
}
function isoBrasilia(em: number): string {
  const d = new Date(em);
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}T${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}:${dois(d.getUTCSeconds())}-03:00`;
}

/** "13h46", "25 min", "2 dias e 3h". */
export function formatarEspera(min: number): string {
  const m = Math.round(min);
  if (m < 1) return "menos de 1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return r ? `${h}h${dois(r)}` : `${h}h`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return `${d} ${d === 1 ? "dia" : "dias"}${hh ? ` e ${hh}h` : ""}`;
}

/** Linha que diz à IA quem falou por último e há quanto tempo (calculada no servidor, na hora da análise). */
export function linhaUltimaMensagem(u: UltimaMensagem | null, agora = Date.now()): string {
  if (!u) return "";
  const t = Date.parse(u.em);
  if (Number.isNaN(t)) return "";
  const quem = u.de === "cliente" ? "do cliente" : u.de === "atendente" ? "do atendente" : "de uma das pessoas (atendente não identificado)";
  return `ÚLTIMA MENSAGEM: ${quem}, há ${formatarEspera(Math.max(0, (agora - t) / 60000))}.`;
}

interface Msg { quem: string; de: DeQuem | null; texto: string; em: number }

/** Lê o .txt exportado (Ztalk ou WhatsApp). `nomeAtendente` é o nome de quem usa a tela
 * e só serve para o WhatsApp comum, onde o arquivo não diz quem é o atendente. */
export function prepararConversaTxt(bruto: string, nomeAtendente = ""): ConversaPreparada {
  const linhas = bruto.replace(/\r/g, "").split("\n").map((l) => l.replace(/[‎‏﻿]/g, ""));
  const ztalk = linhas.some((l) => ZTALK_MSG.test(l));

  const msgs: Msg[] = [];
  let atual: Msg | null = null;
  let aviso = false; // dentro de um aviso do sistema (suas linhas seguintes são ignoradas)
  let brancas = 0;
  let naoReconhecidas = 0;

  for (const l of linhas) {
    if (!l.trim()) { brancas++; continue; }

    if (ztalk) {
      if (ZTALK_ID.test(l) || ZTALK_INICIO.test(l)) { atual = null; aviso = false; brancas = 0; continue; } // cabeçalho
      const z = ZTALK_MSG.exec(l);
      if (z) {
        brancas = 0;
        const dir = z[7].trim();
        const em = Date.UTC(Number(z[3]), Number(z[2]) - 1, Number(z[1]), Number(z[4]), Number(z[5]), Number(z[6]));
        if (dir === "I") { atual = null; aviso = true; continue; }
        if (dir !== ">" && dir !== "<") { naoReconhecidas++; atual = null; aviso = false; continue; }
        aviso = false;
        atual = { quem: z[8].trim(), de: dir === ">" ? "cliente" : "atendente", texto: z[9].trim(), em };
        msgs.push(atual);
        continue;
      }
      if (COMECA_COM_DATA.test(l)) { naoReconhecidas++; atual = null; aviso = false; brancas = 0; continue; }
    } else {
      const m = CABECALHO.exec(l);
      if (m) {
        brancas = 0;
        const resto = m[7];
        const idx = resto.indexOf(": ");
        if (idx <= 0) { atual = null; aviso = true; continue; } // aviso do sistema (criptografia, entrou no grupo…)
        aviso = false;
        let ano = Number(m[3]);
        if (ano < 100) ano += 2000;
        const em = Date.UTC(ano, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
        atual = { quem: resto.slice(0, idx).trim(), de: null, texto: resto.slice(idx + 2).trim(), em };
        msgs.push(atual);
        continue;
      }
    }

    // Linha sem data: continua a mensagem anterior (linhas em branco no meio viram quebra de linha).
    if (atual) atual.texto += `${"\n".repeat(brancas + 1)}${l.trim()}`;
    else if (!aviso) naoReconhecidas++;
    brancas = 0;
  }

  // Quem é quem.
  let clientes: string[] = [];
  const rotulo = new Map<string, string>();
  if (ztalk) {
    clientes = [...new Set(msgs.filter((m) => m.de === "cliente").map((m) => m.quem))];
  } else {
    const quemFala = [...new Set(msgs.map((m) => m.quem))];
    const alvo = primeiroToken(nomeAtendente).toLowerCase();
    const atendente = alvo.length >= 2 ? quemFala.find((q) => primeiroToken(q).toLowerCase() === alvo) ?? null : null;
    clientes = atendente ? quemFala.filter((q) => q !== atendente) : [];
    quemFala.forEach((q, i) => rotulo.set(q, atendente ? (q === atendente ? "Atendente" : "Cliente") : `Pessoa ${String.fromCharCode(65 + i)}`));
    for (const m of msgs) m.de = atendente ? (m.quem === atendente ? "atendente" : "cliente") : "pessoa";
  }
  const identificado = ztalk || msgs.some((m) => m.de !== "pessoa");

  // Nome do cliente: só no navegador (não vai para a IA).
  const nomesCliente = clientes.map((c) => (ztalk ? c.replace(/^Cliente\s*/i, "") : c));
  const nomeUnico = nomesCliente.length === 1 ? nomesCliente[0] : "";
  const primeiroNomeCliente = nomeUnico && !SO_NUMERO.test(nomeUnico) ? primeiroToken(nomeUnico) : null;
  const nomesParaTrocar = nomesCliente.flatMap((c) => [c, primeiroToken(c)]).filter((n) => n.length >= 3 && !SO_NUMERO.test(n));

  const limpar = (texto: string) => {
    let t = texto;
    for (const n of nomesParaTrocar) t = t.replace(new RegExp(`(?<![\\p{L}\\d])${escapar(n)}(?![\\p{L}\\d])`, "giu"), "Cliente");
    t = removerDadosPessoais(t).trim() || "(sem texto)";
    return t.length > MAX_CARACTERES_MENSAGEM ? `${t.slice(0, MAX_CARACTERES_MENSAGEM)}…` : t;
  };
  const nomeDe = (m: Msg) => (ztalk ? (m.de === "cliente" ? "Cliente" : "Atendente") : rotulo.get(m.quem) ?? "Pessoa");

  // Totais reais, antes de qualquer corte.
  const total = msgs.length;
  const doCliente = identificado ? msgs.filter((m) => m.de === "cliente").length : null;
  const doAtendente = identificado ? msgs.filter((m) => m.de === "atendente").length : null;

  // Conversa longa: 10 primeiras + 80 últimas.
  const limite = MAX_PRIMEIRAS + MAX_ULTIMAS;
  const cortadas = Math.max(0, total - limite);
  const indices = msgs.map((_, i) => i);
  const enviar = cortadas ? [...indices.slice(0, MAX_PRIMEIRAS), ...indices.slice(total - MAX_ULTIMAS)] : indices;

  const saida: string[] = [];
  const previa: ConversaPreparada["previa"] = [];
  if (enviar.length) saida.push("Formato de cada mensagem: [data e hora · quem · tempo desde a mensagem anterior] texto");
  enviar.forEach((i, pos) => {
    if (cortadas && pos === MAX_PRIMEIRAS) saida.push(`[… ${cortadas} ${cortadas === 1 ? "mensagem do meio omitida" : "mensagens do meio omitidas"} …]`);
    const m = msgs[i];
    const espera = i > 0 ? ` · ${formatarEspera((m.em - msgs[i - 1].em) / 60000)} depois` : "";
    const t = limpar(m.texto);
    saida.push(`[${formatarData(m.em)} · ${nomeDe(m)}${espera}] ${t}`);
    previa.push({ de: m.de ?? "pessoa", texto: t });
  });

  // Tempo de resposta do atendente: espera entre a última fala do cliente e a resposta.
  let tempoResposta: ConversaPreparada["tempoResposta"] = null;
  if (identificado) {
    const esperas: number[] = [];
    let pendente: number | null = null;
    for (const m of msgs) {
      if (m.de === "atendente") {
        if (pendente != null) { esperas.push((m.em - pendente) / 60000); pendente = null; }
      } else if (pendente == null) pendente = m.em;
    }
    if (esperas.length) {
      tempoResposta = {
        mediaMin: Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length),
        maiorMin: Math.round(Math.max(...esperas)),
      };
    }
  }

  const fim = msgs[total - 1];
  return {
    texto: saida.join("\n"),
    primeiroNomeCliente,
    tempoResposta,
    mensagens: total,
    doCliente,
    doAtendente,
    primeira: total ? formatarData(msgs[0].em) : null,
    ultima: fim ? formatarData(fim.em) : null,
    naoReconhecidas,
    enviadas: enviar.length,
    cortadas,
    ultimaMensagem: fim ? { de: fim.de ?? "pessoa", em: isoBrasilia(fim.em) } : null,
    previa: previa.slice(-12),
  };
}

// ---------------------------------------------------------------------------
// Respostas da IA (JSON validado)
// ---------------------------------------------------------------------------

const txt = (max: number) => z.string().trim().max(max).catch("");
const OpcaoSchema = z.object({ texto: z.string().trim().min(1).max(900), porque: txt(400) });

export const CopilotoRespostaSchema = z.object({
  etapa: z.enum(ETAPAS_FUNIL),
  resumo_onde_esta: z.string().trim().min(1).max(400),
  objecoes_detectadas: z.array(z.string()).catch([]),
  opcao_direta: OpcaoSchema,
  opcao_consultiva: OpcaoSchema,
  primeiro_nome_cliente: z.string().trim().max(60).nullable().catch(null),
  ponto_parada_sugerido: z.enum(["nao_respondeu_primeira", "parou_explicativa", "recebeu_proposta", "travou_fechamento"]).nullable().catch(null),
});
export type CopilotoResposta = z.infer<typeof CopilotoRespostaSchema>;

export const RaioxRespostaSchema = z.object({
  etapa: z.enum(ETAPAS_FUNIL).nullable().catch(null),
  onde_perdeu: z.object({ descricao: z.string().trim().min(1).max(600), fala_cliente: txt(400), fala_atendente: txt(500) }),
  faltou: z.array(z.object({ tecnica: z.string().trim().min(1).max(80), explicacao: z.string().trim().min(1).max(500) })).max(6),
  reescrita: z.object({ original: txt(600), sugerida: z.string().trim().min(1).max(700) }),
  escrita: z.array(z.object({ errado: z.string().trim().min(1).max(200), certo: z.string().trim().min(1).max(200), regra: txt(200) })).max(8).catch([]),
  habito: z.object({
    titulo: z.string().trim().min(1).max(120),
    descricao: z.string().trim().max(400).catch(""),
    perfil_simulador_sugerido: z.string().nullable().catch(null),
  }),
});
export type RaioxResposta = z.infer<typeof RaioxRespostaSchema> & {
  tempo_resposta: { mediaMin: number; maiorMin: number } | null;
  /** Perfil do Simulador já validado (id existente) ou null. */
  perfil_id: string | null;
};

/** Tira JSON de uma resposta de IA que pode vir com ```json. */
export function extrairJson(raw: string): unknown {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.search(/[[{]/);
  if (start < 0) throw new Error("Resposta da IA sem JSON.");
  return JSON.parse(clean.slice(start));
}

/** Tira dados pessoais que a IA possa ter repetido num texto que vai ser guardado. */
export function limparTrecho(t: string, primeiroNome?: string | null): string {
  let r = removerDadosPessoais(t);
  const n = (primeiroNome ?? "").trim();
  if (n.length >= 3) r = r.replace(new RegExp(`(?<![\\p{L}\\d])${escapar(n)}(?![\\p{L}\\d])`, "giu"), "Cliente");
  return r;
}
