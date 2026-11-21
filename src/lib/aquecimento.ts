import { z } from "zod";

// Aquecimento de 5 minutos e Mapa de domínio — tipos, constantes e funções puras
// (sem banco nem IA). Usado no navegador e no servidor.
//
// PRIVACIDADE: o texto digitado pelo atendente nunca é guardado, nem a frase de
// feedback da IA. O banco só recebe acerto (e nota, nas escritas).

export const TIPOS_EXERCICIO = ["multipla_escolha", "escrita", "habito"] as const;
export type TipoExercicio = (typeof TIPOS_EXERCICIO)[number];
export const TIPO_LABEL: Record<TipoExercicio, string> = {
  multipla_escolha: "Múltipla escolha",
  escrita: "Escrita",
  habito: "Hábito de escrita",
};
/** Rótulo curto do cartão ("Cartão 2 de 3 · Objeção"). */
export const CARTAO_ROTULO: Record<TipoExercicio, string> = {
  multipla_escolha: "Produto",
  escrita: "Objeção",
  habito: "Hábito de escrita",
};

export const STATUS_EXERCICIO = ["rascunho", "aprovado", "arquivado"] as const;
export type StatusExercicio = (typeof STATUS_EXERCICIO)[number];
export const STATUS_LABEL: Record<StatusExercicio, string> = { rascunho: "Rascunho da IA", aprovado: "Aprovado", arquivado: "Arquivado" };

export type Nivel = "nao_testado" | "aprendendo" | "dominando";
export const NIVEL_LABEL: Record<Nivel, string> = { nao_testado: "Não testado", aprendendo: "Aprendendo", dominando: "Dominando" };
export const NIVEL_ORDEM: Record<Nivel, number> = { nao_testado: 0, aprendendo: 1, dominando: 2 };

export interface ConfigAquecimento {
  horarios: string[];
  cartoes_por_dia: number;
  janela_dominio_dias: number;
  min_respostas: number;
  limiar_dominando: number;
  nota_acerto: number;
}
export const CONFIG_AQUECIMENTO_PADRAO: ConfigAquecimento = {
  horarios: ["08:30", "12:00", "15:00"],
  cartoes_por_dia: 3,
  janela_dominio_dias: 60,
  min_respostas: 3,
  limiar_dominando: 0.75,
  nota_acerto: 7,
};

export const LIMITE_CORRECOES_PADRAO = 5;

export function calcularNivel(respostas: number, acertos: number, cfg: Pick<ConfigAquecimento, "min_respostas" | "limiar_dominando">): Nivel {
  if (respostas < cfg.min_respostas) return "nao_testado";
  return acertos / respostas >= cfg.limiar_dominando ? "dominando" : "aprendendo";
}

export const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------------------------------------------------------------------------
// Hábitos de escrita: regras mecânicas do Padrão de escrita, corrigidas em código
// ---------------------------------------------------------------------------

export const HABITOS = {
  abreviacoes: { titulo: "Sem abreviações de internet", regra: "Escreva \"você\", \"beleza\", \"também\" por extenso." },
  risadas: { titulo: "Sem \"kkk\" nem \"rs\" repetidos", regra: "Evite risadas repetidas na conversa com o cliente." },
  tratamento: { titulo: "Sem tratamentos íntimos", regra: "Chame o cliente pelo primeiro nome, sem \"amor\", \"querida\", \"flor\" ou \"mano\"." },
  uma_pergunta: { titulo: "Uma pergunta por mensagem", regra: "Faça uma pergunta de cada vez." },
  quebra_linhas: { titulo: "Mensagem curta, com quebra de linha", regra: "No máximo 4 linhas sem quebra." },
  plano_saude: { titulo: "Sem a frase proibida", regra: "Nunca use a frase que compara o cartão a plano de saúde." },
} as const;
export type HabitoChave = keyof typeof HABITOS;
export const HABITO_CHAVES = Object.keys(HABITOS) as HabitoChave[];
export const ehHabitoMecanico = (c: string | null | undefined): c is HabitoChave => !!c && c in HABITOS;

const ABREVIACOES = /(?<![\p{L}\d])(vc|vcs|blz|tbm|tb|pq|obg|pfv|ctz|mto|hj|vlw|flw)(?![\p{L}\d])/iu;
const RISADAS = /k{3,}|(?<![\p{L}])(rs){2,}(?![\p{L}])/iu;
const TRATAMENTO = /(?<![\p{L}])(amor|querida|querido|flor|mano)(?![\p{L}])/iu;
const FRASE_PROIBIDA = /n[ãa]o [ée] plano de sa[úu]de/i;
const LIMITE_CHARS_SEM_QUEBRA = 320;

export interface ProblemaEscrita { chave: HabitoChave; texto: string }

/** Confere as regras mecânicas do Padrão de escrita. Lista vazia = tudo certo. */
export function conferirPadraoEscrita(texto: string): ProblemaEscrita[] {
  const t = texto.trim();
  const p: ProblemaEscrita[] = [];
  if (!t) return p;
  const add = (chave: HabitoChave, txt: string) => p.push({ chave, texto: txt });

  if (ABREVIACOES.test(t)) add("abreviacoes", "Tem abreviação de internet (como \"vc\" ou \"blz\").");
  if (RISADAS.test(t)) add("risadas", "Tem \"kkk\" ou \"rs\" repetido.");
  // "Amor Saúde" é o nome do parceiro, não um tratamento.
  if (TRATAMENTO.test(t.replace(/amor\s+sa[úu]de/gi, ""))) add("tratamento", "Tem tratamento íntimo (\"amor\", \"querida\", \"flor\" ou \"mano\").");
  const perguntas = (t.match(/\?+/g) ?? []).length;
  if (perguntas > 1) add("uma_pergunta", `Tem ${perguntas} perguntas na mesma mensagem. Faça uma por vez.`);
  const blocos = t.split(/\n\s*\n/);
  const longoDemais = blocos.some((b) => b.split("\n").filter((l) => l.trim()).length > 4 || (!b.includes("\n") && b.length > LIMITE_CHARS_SEM_QUEBRA));
  if (longoDemais) add("quebra_linhas", "Tem mais de 4 linhas sem quebra.");
  if (FRASE_PROIBIDA.test(t)) add("plano_saude", "Usa a frase que não pode ser usada.");
  return p;
}

/** Liga o nome de uma regra do Raio-X/Padrão de escrita a uma chave de hábito. */
export function habitoDaRegra(regra: string): HabitoChave | null {
  const r = regra.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/abrevia|vc\b|blz|tbm|internet|sigla/.test(r)) return "abreviacoes";
  if (/kkk|\brs\b|risada/.test(r)) return "risadas";
  if (/amor|querida|flor|mano|intim|tratamento/.test(r)) return "tratamento";
  if (/pergunta/.test(r)) return "uma_pergunta";
  if (/linha|quebra|longa|curta|comprida/.test(r)) return "quebra_linhas";
  if (/plano de saude/.test(r)) return "plano_saude";
  return null;
}

// ---------------------------------------------------------------------------
// Cartões (o que o navegador recebe: nunca a alternativa correta nem a resposta aprovada)
// ---------------------------------------------------------------------------

export interface CartaoAlternativa { i: number; texto: string }
export interface Cartao {
  exercicio_id: string;
  tipo: TipoExercicio;
  tema_id: string;
  tema_nome: string;
  titulo: string;
  pergunta: string;
  contexto: string;
  alternativas: CartaoAlternativa[];
  habito_chave: string | null;
  /** Já respondido nesta sessão (retomada da sessão aberta). */
  resultado: ResultadoCartao | null;
}
export interface ResultadoCartao {
  acertou: boolean;
  nota: number | null;
  /** Só nas múltiplas e nos hábitos: explicação ou lista de problemas. A frase da IA nunca é guardada. */
  texto?: string;
  resposta_aprovada?: string;
  correta_i?: number;
  explicacao?: string;
  fonte?: string;
}

export interface SessaoAquecimento {
  sessao_id: string;
  tipo: "diaria" | "tema";
  tema_id: string | null;
  cartoes: Cartao[];
  concluida: boolean;
  limite: { usado: number; limite: number | null };
  nota_acerto: number;
}

export interface MudancaNivel { tema_id: string; tema_nome: string; de: Nivel; para: Nivel }
export interface ResumoSessao {
  minutos: number;
  dias_semana: number;
  mudancas: MudancaNivel[];
  /** Sugestão de treino no Simulador quando foi mal em objeção. */
  simulador: { objecao: string; perfil: { id: string; nome: string; descricao: string } | null } | null;
}

export const MSG_SEM_CORRECAO = "Não consegui corrigir agora. Tente de novo.";
export const msgLimiteCorrecoes = (n: number | null) =>
  `Você já usou as ${n ?? 5} correções de hoje. Este cartão volta amanhã.`;

// ---------------------------------------------------------------------------
// Esquemas
// ---------------------------------------------------------------------------

export const CorrecaoIASchema = z.object({
  nota: z.coerce.number().int().min(0).max(10),
  frase: z.string().trim().min(1).max(400),
});

export const AlternativaSchema = z.object({ texto: z.string().trim().min(1).max(300), correta: z.boolean() });
export const RascunhoSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  pergunta: z.string().trim().min(1).max(800),
  contexto: z.string().trim().max(400).default(""),
  alternativas: z.array(AlternativaSchema).max(5).default([]),
  resposta_aprovada: z.string().trim().max(1000).default(""),
  habito_chave: z.string().trim().max(60).nullish(),
  explicacao: z.string().trim().min(1).max(800),
  fonte: z.string().trim().max(200).default(""),
});
export type Rascunho = z.infer<typeof RascunhoSchema>;

/** Valida um exercício conforme o tipo. Devolve o problema em português ou null. */
export function validarExercicio(e: {
  tipo: TipoExercicio; alternativas: { texto: string; correta: boolean }[]; resposta_aprovada: string; contexto: string; habito_chave?: string | null;
}): string | null {
  if (e.tipo === "multipla_escolha") {
    if (e.alternativas.length < 2) return "Coloque pelo menos 2 alternativas.";
    if (e.alternativas.filter((a) => a.correta).length !== 1) return "Marque exatamente 1 alternativa como a certa.";
  }
  if (e.tipo === "escrita") {
    if (!e.contexto.trim()) return "Escreva a fala do cliente.";
    if (!e.resposta_aprovada.trim()) return "Escreva a resposta aprovada.";
  }
  if (e.tipo === "habito" && !e.habito_chave?.trim()) return "Escolha o hábito de escrita.";
  return null;
}

export const semPlanoDeSaude = (t: string) =>
  t.replace(/n[ãa]o [ée] plano de sa[úu]de/gi, "").replace(/\s{2,}/g, " ").trim();
