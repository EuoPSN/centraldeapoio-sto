// "O cliente disse…" — tipos, constantes e cálculos usados no navegador e no servidor.
// Só código puro aqui (sem acesso a banco nem IA).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Objeções
// ---------------------------------------------------------------------------

export const ANGULO_TIPOS = ["logico", "emocional", "prova"] as const;
export type AnguloTipo = (typeof ANGULO_TIPOS)[number];
export const ANGULO_LABEL: Record<AnguloTipo, string> = { logico: "Lógico", emocional: "Emocional", prova: "Prova" };

export const LeituraSchema = z.object({
  titulo: z.string().max(200).default(""),
  pergunta: z.string().max(500).default(""),
});
export const AnguloSchema = z.object({
  tipo: z.enum(ANGULO_TIPOS),
  rotulo: z.string().max(120).default(""),
  texto: z.string().max(2000).default(""),
});

/** Conteúdo de uma objeção (o que a IA sugere e o que o Admin edita). */
export const ObjecaoConteudoSchema = z.object({
  nome: z.string().max(200).default(""),
  exemplos_de_fala: z.array(z.string().max(300)).max(30).default([]),
  leituras: z.array(LeituraSchema).max(8).default([]),
  angulos: z.array(AnguloSchema).max(6).default([]),
  pergunta_avancar: z.string().max(1000).nullable().default(null),
  evite_dizer: z.string().max(1000).nullable().default(null),
});
export type ObjecaoConteudo = z.infer<typeof ObjecaoConteudoSchema>;
export type Leitura = z.infer<typeof LeituraSchema>;
export type Angulo = z.infer<typeof AnguloSchema>;

export type Status = "rascunho" | "publicada";

export interface Objecao extends ObjecaoConteudo {
  id: string;
  prioridade: number;
  status: Status;
  autor_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Normaliza o que vem do banco (jsonb pode vir em formato inesperado). */
export function toObjecao(r: Record<string, unknown>): Objecao {
  const c = ObjecaoConteudoSchema.safeParse({
    nome: r.nome ?? "",
    exemplos_de_fala: Array.isArray(r.exemplos_de_fala) ? r.exemplos_de_fala : [],
    leituras: Array.isArray(r.leituras) ? r.leituras : [],
    angulos: Array.isArray(r.angulos) ? r.angulos : [],
    pergunta_avancar: r.pergunta_avancar ?? null,
    evite_dizer: r.evite_dizer ?? null,
  });
  const base = c.success ? c.data : ObjecaoConteudoSchema.parse({ nome: String(r.nome ?? "") });
  return {
    ...base,
    id: String(r.id),
    prioridade: Number(r.prioridade ?? 100),
    status: r.status === "publicada" ? "publicada" : "rascunho",
    autor_id: (r.autor_id as string | null) ?? null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export function objecaoVazia(): ObjecaoConteudo {
  return {
    nome: "",
    exemplos_de_fala: [],
    leituras: [{ titulo: "", pergunta: "" }],
    angulos: ANGULO_TIPOS.map((tipo) => ({ tipo, rotulo: "", texto: "" })),
    pergunta_avancar: null,
    evite_dizer: null,
  };
}

// ---------------------------------------------------------------------------
// Fechamento
// ---------------------------------------------------------------------------

export const ETAPAS = ["proposta", "plano", "dados", "pagamento", "link"] as const;
export type Etapa = (typeof ETAPAS)[number];
export const ETAPA_LABEL: Record<Etapa, string> = {
  proposta: "Proposta enviada",
  plano: "Escolheu o plano",
  dados: "Mandou os dados",
  pagamento: "Pagamento",
  link: "Link concluído",
};
/** Subetapas que ficam dentro de "Fechamento" no funil do CRM. */
export const SUBETAPAS: Etapa[] = ["plano", "dados", "pagamento", "link"];

export const ITEM_TIPOS = ["sinal", "mensagem_etapa", "travamento"] as const;
export type ItemTipo = (typeof ITEM_TIPOS)[number];
export const ITEM_TIPO_LABEL: Record<ItemTipo, string> = {
  sinal: "Sinal de compra",
  mensagem_etapa: "Mensagem da etapa",
  travamento: "Travamento",
};

export interface FechamentoItem {
  id: string;
  tipo: ItemTipo;
  etapa: Etapa;
  titulo: string;
  exemplos_de_fala: string[];
  mensagem: string | null;
  passos: string[];
  evite: string | null;
  ordem: number;
  status: Status;
  updated_at: string;
}

export function toFechamentoItem(r: Record<string, unknown>): FechamentoItem {
  return {
    id: String(r.id),
    tipo: (ITEM_TIPOS as readonly string[]).includes(String(r.tipo)) ? (r.tipo as ItemTipo) : "mensagem_etapa",
    etapa: (ETAPAS as readonly string[]).includes(String(r.etapa)) ? (r.etapa as Etapa) : "proposta",
    titulo: String(r.titulo ?? ""),
    exemplos_de_fala: Array.isArray(r.exemplos_de_fala) ? (r.exemplos_de_fala as string[]) : [],
    mensagem: (r.mensagem as string | null) ?? null,
    passos: Array.isArray(r.passos) ? (r.passos as string[]) : [],
    evite: (r.evite as string | null) ?? null,
    ordem: Number(r.ordem ?? 0),
    status: r.status === "publicada" ? "publicada" : "rascunho",
    updated_at: String(r.updated_at ?? ""),
  };
}

export const PLANOS = ["prata", "ouro", "diamante"] as const;
export type Plano = (typeof PLANOS)[number];
export const PLANO_LABEL: Record<Plano, string> = { prata: "Prata", ouro: "Ouro", diamante: "Diamante" };

export const CasoUsoSchema = z.object({
  item_tipo: z.enum(["consulta", "exame", "odontologia", "livre"]),
  item_id: z.string().max(64).nullable(),
  nome: z.string().max(120),
  rotulo: z.string().max(60).default(""),
});
export type CasoUso = z.infer<typeof CasoUsoSchema>;

export type CasoEtapa = Etapa | "venda_concluida";

export interface Caso {
  id: string;
  primeiro_nome: string;
  dependentes: number;
  plano: Plano | null;
  usos: CasoUso[];
  etapa: CasoEtapa;
  retomar_em: string | null;
  created_at: string;
  updated_at: string;
}

export function toCaso(r: Record<string, unknown>): Caso {
  const usos = Array.isArray(r.usos)
    ? (r.usos as unknown[]).map((u) => CasoUsoSchema.safeParse(u)).filter((p) => p.success).map((p) => p.data!)
    : [];
  return {
    id: String(r.id),
    primeiro_nome: String(r.primeiro_nome ?? ""),
    dependentes: Number(r.dependentes ?? 0),
    plano: (PLANOS as readonly string[]).includes(String(r.plano)) ? (r.plano as Plano) : null,
    usos,
    etapa: ([...ETAPAS, "venda_concluida"] as string[]).includes(String(r.etapa)) ? (r.etapa as CasoEtapa) : "proposta",
    retomar_em: (r.retomar_em as string | null) ?? null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

/** Item da Amor Saúde, só com o que o fechamento usa. */
export interface ItemAmor {
  tipo: "consulta" | "exame" | "odontologia";
  id: string;
  nome: string;
  /** Valor com o cartão (consulta: preço no cartão; exame: média de referência). */
  cartao: number | null;
  particularMedio: number | null;
  usarNaEconomia: boolean;
}

export type Mensalidades = Partial<Record<Plano, number | null>>;

// ---------------------------------------------------------------------------
// Economia e mensagens
// ---------------------------------------------------------------------------

export const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;

export interface LinhaEconomia { uso: CasoUso; particular: number; cartao: number }
export interface Economia {
  linhas: LinhaEconomia[];
  semPreco: CasoUso[];
  mensalidade: number | null;
  total: number | null;
}

export function usoLabel(u: CasoUso) {
  return u.rotulo ? `${u.nome} · ${u.rotulo}` : u.nome;
}

export function calcularEconomia(usos: CasoUso[], itens: ItemAmor[], plano: Plano | null, mensalidades: Mensalidades): Economia {
  const linhas: LinhaEconomia[] = [];
  const semPreco: CasoUso[] = [];
  for (const u of usos) {
    const it = u.item_id ? itens.find((i) => i.id === u.item_id && i.tipo === u.item_tipo) : undefined;
    if (it && it.usarNaEconomia && it.particularMedio != null && it.cartao != null) {
      linhas.push({ uso: u, particular: it.particularMedio, cartao: it.cartao });
    } else {
      semPreco.push(u);
    }
  }
  const mensalidade = plano ? mensalidades[plano] ?? null : null;
  const total = linhas.length && mensalidade != null
    ? linhas.reduce((s, l) => s + (l.particular - l.cartao), 0) - mensalidade
    : null;
  return { linhas, semPreco, mensalidade, total: total != null ? Math.round(total * 100) / 100 : null };
}

/** Texto do bloco "O que você leva", que vai junto na mensagem. */
export function textoEconomia(e: Economia, plano: Plano | null): string {
  if (!e.linhas.length) return "";
  const out = e.linhas.map((l) => `${usoLabel(l.uso)}: particular ${brl(l.particular)} → com o cartão ${brl(l.cartao)}`);
  if (e.mensalidade != null && plano) out.push(`Mensalidade do ${PLANO_LABEL[plano]}: ${brl(e.mensalidade)}`);
  if (e.total != null) out.push(`Economia já no primeiro uso: ${brl(e.total)}`);
  return out.join("\n");
}

function juntar(lista: string[]) {
  if (lista.length <= 1) return lista[0] ?? "";
  return `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
}

/** Preenche {nome} {dependentes} {plano} {usos} {economia} com os dados do caso. */
export function preencherTemplate(tpl: string, caso: Pick<Caso, "primeiro_nome" | "dependentes" | "plano" | "usos">, economia: Economia | null) {
  const vars: Record<string, string> = {
    nome: caso.primeiro_nome.trim(),
    dependentes: String(caso.dependentes ?? 0),
    plano: caso.plano ? PLANO_LABEL[caso.plano] : "",
    usos: juntar(caso.usos.map((u) => (u.rotulo ? `${u.nome} (${u.rotulo})` : u.nome))),
    economia: economia?.total != null ? brl(economia.total) : "",
  };
  return tpl.replace(/\{(nome|dependentes|plano|usos|economia)\}/g, (_, k: string) => vars[k] ?? "");
}

export const VARIAVEIS = ["{nome}", "{dependentes}", "{plano}", "{usos}", "{economia}"] as const;

// ---------------------------------------------------------------------------
// Privacidade: tira telefone, CPF e e-mail da fala antes de mandar para a IA
// ---------------------------------------------------------------------------

export function removerDadosPessoais(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]")
    .replace(/(\+?55[\s.-]?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g, "[telefone]")
    .replace(/\b\d{8,}\b/g, "[número]");
}

export const ERRO_IA = "Não consegui entender agora. Tente de novo.";
