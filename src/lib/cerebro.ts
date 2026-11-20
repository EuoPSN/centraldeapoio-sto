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
// Conversa exportada do WhatsApp (.txt): limpeza no navegador, antes do envio
// ---------------------------------------------------------------------------

const MAX_MENSAGENS = 80;

export interface ConversaPreparada {
  /** Texto pronto para a IA (sem telefone, CPF, e-mail e com o cliente como "Cliente"). */
  texto: string;
  /** Primeiro nome do cliente, lido só no navegador (não vai para a IA). */
  primeiroNomeCliente: string | null;
  /** Calculado aqui, a partir dos horários do .txt, quando o atendente foi identificado. */
  tempoResposta: { mediaMin: number; maiorMin: number } | null;
  mensagens: number;
}

const CABECALHO = /^‎?\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*[ap]\.?m\.?)?\]?\s*(?:-\s*)?(.*)$/i;

function primeiroToken(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? "";
}
function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lê o .txt exportado do WhatsApp (formatos Android e iOS). `nomeAtendente` é
 * o nome de quem está usando a tela, para saber quem é o cliente. */
export function prepararConversaTxt(bruto: string, nomeAtendente = ""): ConversaPreparada {
  type Msg = { quem: string; texto: string; em: number | null };
  const msgs: Msg[] = [];
  for (const linhaCrua of bruto.replace(/\r/g, "").split("\n")) {
    const linha = linhaCrua.replace(/[‎‏]/g, "");
    const m = CABECALHO.exec(linha);
    if (m) {
      const resto = m[6];
      const idx = resto.indexOf(": ");
      if (idx <= 0) continue; // aviso do sistema (criptografia, entrou no grupo…)
      let ano = Number(m[3]);
      if (ano < 100) ano += 2000;
      const em = Date.UTC(ano, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
      msgs.push({ quem: resto.slice(0, idx).trim(), texto: resto.slice(idx + 2).trim(), em });
    } else if (msgs.length && linha.trim()) {
      msgs[msgs.length - 1].texto += `\n${linha.trim()}`;
    }
  }

  const recentes = msgs.slice(-MAX_MENSAGENS);
  const quemFala = [...new Set(recentes.map((m) => m.quem))];
  const alvo = primeiroToken(nomeAtendente).toLowerCase();
  const atendente = alvo.length >= 2 ? quemFala.find((q) => primeiroToken(q).toLowerCase() === alvo) ?? null : null;
  const clientes = atendente ? quemFala.filter((q) => q !== atendente) : [];

  const rotulo = new Map<string, string>();
  quemFala.forEach((q, i) => {
    if (atendente) rotulo.set(q, q === atendente ? "Atendente" : "Cliente");
    else rotulo.set(q, `Pessoa ${String.fromCharCode(65 + i)}`);
  });

  const primeiroNomeCliente = clientes.length === 1 && !/^[+\d\s()-]+$/.test(clientes[0]) ? primeiroToken(clientes[0]) : null;
  const nomesParaTrocar = (atendente ? clientes : []).flatMap((c) => [c, primeiroToken(c)]).filter((n) => n.length >= 3 && !/^[+\d\s()-]+$/.test(n));

  const linhas = recentes.map((m) => {
    let t = m.texto;
    for (const n of nomesParaTrocar) t = t.replace(new RegExp(`(?<![\\p{L}\\d])${escapar(n)}(?![\\p{L}\\d])`, "giu"), "Cliente");
    return `${rotulo.get(m.quem)}: ${removerDadosPessoais(t)}`;
  });

  // Tempo de resposta do atendente: espera entre a última fala do cliente e a resposta.
  let tempoResposta: ConversaPreparada["tempoResposta"] = null;
  if (atendente) {
    const esperas: number[] = [];
    let pendente: number | null = null;
    for (const m of recentes) {
      if (m.em == null) continue;
      if (m.quem === atendente) {
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

  return { texto: linhas.join("\n"), primeiroNomeCliente, tempoResposta, mensagens: recentes.length };
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
