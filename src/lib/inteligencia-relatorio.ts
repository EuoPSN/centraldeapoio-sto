import { removerDadosPessoais } from "@/lib/cliente-disse";
import { abasParaXlsx, isoBR, type Aba, type Cel, type Coluna } from "@/lib/retomada-relatorio";

// Relatório Excel da Inteligência (Raio-X + uso do Copiloto e das outras IAs),
// feito para ser lido por pessoas e por IA. Mesmo padrão do relatório de retomadas:
// 1 linha de cabeçalho por aba, sem células mescladas, sem linhas em branco, datas
// ISO "AAAA-MM-DD HH:MM" (Brasília), vocabulário fixo, cada aba uma Tabela do Excel.
//
// NUNCA entram no arquivo: telefone, e-mail, nome do cliente e fala do cliente.
// Do Raio-X só saem campos do lado do atendente e de padrões. Ficam de fora:
// onde_perdeu (descrição, fala do cliente e fala do atendente), a explicação de
// cada técnica que faltou e a descrição do hábito, porque podem citar o cliente.

// ---------------------------------------------------------------------------
// Dados (já limpos no servidor; o navegador nunca recebe os campos que ficam de fora)
// ---------------------------------------------------------------------------

export interface RaioxLinha {
  data_hora: string;
  user_id: string;
  etapa: string | null;
  /** Só o nome da técnica (sem a explicação). */
  tecnicas: string[];
  reescrita_original: string;
  reescrita_sugerida: string;
  erros: { errado: string; certo: string; regra: string }[];
  habito: string;
  veio_de_retomada: boolean;
}

export interface UsoLinha { dia: string; user_id: string; ferramenta: string; quantidade: number; limite_diario: number | null }

/** Uma resposta do aquecimento (nunca o texto digitado: ele não existe no banco). */
export interface AquecimentoLinha {
  data_hora: string;
  user_id: string;
  tema: string;
  tipo_cartao: string;
  tipo_sessao: string;
  acertou: boolean;
  nota: number | null;
}
/** Nível de um atendente em um tema (janela de domínio terminada no fim do período). */
export interface MapaDominioLinha {
  user_id: string;
  tema: string;
  nivel: string;
  respostas: number;
  acertos: number;
}

/** Fase B · bloco 3: mudança importante ou urgente publicada no período (só o Admin recebe). */
export interface MudancaLinha {
  titulo: string; tipo: string; publicada_em: string; vale_a_partir: string | null;
  confirmadas: number; total: number; pct_acerto: number | null;
}
/** "Li e entendi" de uma pessoa (o atendente só recebe as próprias). */
export interface ConfirmacaoLinha { titulo: string; user_id: string; confirmado_em: string; acertou: boolean | null }
/** Ranking do mês (só o Admin). */
export interface RankingLinha { mes: string; podio: string; user_id: string; valor: number | null; posicao: number | null; entra: boolean }
/** Ranking do atendente: só o próprio valor e o do mês anterior, sem posição. */
export interface MeuRankingLinha { mes: string; podio: string; valor: number | null; valor_anterior: number | null }

/** Fase C · extensão 2: uso da extensão por semana (só contagens). Atendente: só as próprias linhas. */
export interface ExtensaoLinha { semana: string; user_id: string; tickets_criados: number; atualizados: number; ignorados: number; pausas: number }
/** Tempo de primeira resposta por dia (minutos úteis). */
export interface TempoLinha { dia: string; user_id: string; conversas_novas: number; dentro_da_meta: number; media_minutos: number | null; sem_resposta: number }
/** Fechamentos do CRM por semana (segunda a domingo). */
export interface FechamentoLinha { periodo_ini: string; periodo_fim: string; user_id: string; vendas: number; tickets_fechados: number; sem_ticket: number }

export interface DadosInteligencia {
  de: string;
  ate: string;
  escopo: "atendente" | "equipe";
  exportadoPor: string;
  exportadoEm: string;
  atendentes: Record<string, string>;
  raiox: RaioxLinha[];
  uso: UsoLinha[];
  /** Fase B · bloco 2: aquecimento e mapa de domínio (ausentes se a migração ainda não rodou). */
  aquecimento?: AquecimentoLinha[];
  mapa?: MapaDominioLinha[];
  /** Fase B · bloco 3 (ausentes se a migração ainda não rodou). */
  mudancas?: MudancaLinha[];
  confirmacoes?: ConfirmacaoLinha[];
  ranking?: RankingLinha[];
  meuRanking?: MeuRankingLinha[];
  /** Fase C · extensão 2 (ausentes se as migrações ainda não rodaram). */
  extensao?: ExtensaoLinha[];
  tempo?: TempoLinha[];
  fechamentos?: FechamentoLinha[];
  /** Meta de 1ª resposta (minutos) configurada hoje no Admin, para o LEIA-ME. */
  metaTempoMinutos?: number;
  /** Regras do mapa e do acerto (aquecimento_config), para o LEIA-ME. */
  aquecimentoConfig?: { nota_acerto: number; janela_dominio_dias: number; min_respostas: number; limiar_dominando: number };
  /** Etapas do funil do Cérebro (tabela funil_etapas). */
  funil: { etapa: string; nome: string; definicao: string; sinais: string[] }[];
  /** Títulos dos blocos do Cérebro (para normalizar o nome das técnicas). */
  blocosCerebro: { chave: string; titulo: string }[];
}

// ---------------------------------------------------------------------------
// Limpeza de texto escrito pelo atendente
// ---------------------------------------------------------------------------

const SAUDACAO = /(?<![\p{L}\d])(oi|oie|olá|ola|bom dia|boa tarde|boa noite|e aí|e ai|opa)([,!.]?\s+)(\p{L}{3,})/giu;
const NAO_E_NOME = new Set(["tudo", "td", "bem", "como", "gente", "pessoal", "senhor", "senhora", "sr", "sra", "tudo"]);
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const temAcento = (s: string) => s !== s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Tira telefone, CPF, e-mail e o primeiro nome do cliente de um texto do atendente.
 * Sem o nome conhecido, troca também o nome que vem logo depois de uma saudação
 * ("Oi Carla" → "Oi [cliente]"). É uma proteção em camadas, não uma garantia total. */
export function limparTextoExport(t: string, primeiroNome?: string | null): string {
  let r = removerDadosPessoais(String(t ?? ""));
  const n = (primeiroNome ?? "").trim();
  if (n.length >= 3) r = r.replace(new RegExp(`(?<![\\p{L}\\d])${escapar(n)}(?![\\p{L}\\d])`, "giu"), "[cliente]");
  r = r.replace(SAUDACAO, (m, s: string, sep: string, nome: string) =>
    /^\p{Lu}/u.test(nome) && !NAO_E_NOME.has(semAcento(nome)) ? `${s}${sep}[cliente]` : m);
  return r.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Vocabulário das técnicas (Cérebro): "SPIN · Implicação", "Voss · Pergunta calibrada"
// ---------------------------------------------------------------------------

const CURTO: Record<string, string> = { spin_selling: "SPIN", chris_voss: "Voss" };

function prefixosDoCerebro(blocos: DadosInteligencia["blocosCerebro"]): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of blocos) {
    const curto = CURTO[b.chave];
    if (!curto) continue;
    m.set(semAcento(curto), curto);
    m.set(semAcento(b.titulo), curto);
  }
  for (const [chave, curto] of Object.entries(CURTO)) m.set(semAcento(chave.replace(/_/g, " ")), curto);
  return m;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Leva o nome da técnica ao formato "Livro · Técnica" do Cérebro. */
export function normalizarTecnica(bruto: string, blocos: DadosInteligencia["blocosCerebro"] = []): string {
  const t = String(bruto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const prefixos = prefixosDoCerebro(blocos);
  const partes = t.split(/\s*[·|:–—/-]\s*/).filter(Boolean);
  if (partes.length >= 2) {
    const livro = prefixos.get(semAcento(partes[0])) ?? partes[0];
    return `${livro} · ${cap(partes.slice(1).join(" ").toLowerCase())}`;
  }
  // "SPIN Implicação" sem separador: prefixo conhecido seguido da técnica.
  const sa = semAcento(t);
  for (const [chave, livro] of [...prefixos.entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (sa.startsWith(`${chave} `)) return `${livro} · ${cap(t.slice(chave.length).trim().toLowerCase())}`;
  }
  return cap(t);
}

// ---------------------------------------------------------------------------
// Colunas (dicionário)
// ---------------------------------------------------------------------------

const ETAPAS = "novo_lead | lead_qualificado | proposta_enviada | fechamento | venda_concluida | vazio";
const FERRAMENTAS = "copiloto | raiox | marciana | cliente_disse | mensagem_cliente | retomada | simulador | biblioteca | aquecimento";

const C = {
  extensao: [
    { nome: "semana_inicio", significado: "Segunda-feira da semana (Brasília). A linha cobre de segunda a domingo.", valores: "AAAA-MM-DD", largura: 14 },
    { nome: "atendente", significado: "Atendente.", valores: "nome do atendente", largura: 16 },
    { nome: "tickets_criados", significado: "Tickets criados pela extensão do WhatsApp na semana.", valores: "número inteiro", largura: 14 },
    { nome: "tickets_atualizados", significado: "Vezes em que a extensão atualizou um ticket existente na semana (um salvamento = uma atualização).", valores: "número inteiro", largura: 18 },
    { nome: "conversas_ignoradas", significado: "Contatos que o atendente mandou ignorar na extensão.", valores: "número inteiro", largura: 18 },
    { nome: "pausas", significado: "Vezes em que o atendente pausou a extensão.", valores: "número inteiro", largura: 10 },
  ],
  tempo: [
    { nome: "dia", significado: "Dia em que a conversa nova começou (Brasília).", valores: "AAAA-MM-DD", largura: 12 },
    { nome: "atendente", significado: "Atendente.", valores: "nome do atendente", largura: 16 },
    { nome: "conversas_novas", significado: "Conversas novas do dia: o cliente escreve depois de várias horas sem mensagens (padrão 12 h).", valores: "número inteiro", largura: 16 },
    { nome: "dentro_da_meta", significado: "Conversas novas respondidas dentro da meta de primeira resposta.", valores: "número inteiro", largura: 14 },
    { nome: "primeira_resposta_media_min", significado: "Média, em minutos úteis (só o horário de atendimento), do tempo até a primeira resposta humana. Vazio se nenhuma foi respondida.", valores: "número com até 2 casas decimais ou vazio", largura: 26 },
    { nome: "sem_resposta", significado: "Conversas novas ainda sem resposta e já acima da meta (contadas na hora do download).", valores: "número inteiro", largura: 14 },
  ],
  fechamentos: [
    { nome: "periodo_inicio", significado: "Segunda-feira do período (Brasília).", valores: "AAAA-MM-DD", largura: 15 },
    { nome: "periodo_fim", significado: "Domingo do período.", valores: "AAAA-MM-DD", largura: 13 },
    { nome: "atendente", significado: "Atendente (vendedor da planilha do CRM já ligado a um usuário da Omnia).", valores: "nome do atendente", largura: 16 },
    { nome: "vendas", significado: "Vendas com data de Venda no período, segundo a planilha do CRM enviada pelo Admin.", valores: "número inteiro", largura: 10 },
    { nome: "tickets_fechados", significado: "Vendas que casaram, pelo telefone, com um ticket da Omnia fechado como Venda concluída (CRM).", valores: "número inteiro", largura: 16 },
    { nome: "sem_ticket", significado: "Vendas sem ticket correspondente na Omnia (vendas − tickets_fechados).", valores: "número inteiro", largura: 12 },
  ],
  raiox: [
    { nome: "data_hora", significado: "Quando o Raio-X foi feito.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "atendente", significado: "Atendente que fez o Raio-X.", valores: "nome do atendente", largura: 16 },
    { nome: "etapa", significado: "Etapa do funil do Cérebro em que a venda se perdeu.", valores: ETAPAS, largura: 18 },
    { nome: "tecnica_que_faltou", significado: "Técnicas de venda que faltaram, no vocabulário do Cérebro. Mais de uma: separadas por \" | \".", valores: "Livro · Técnica, ex.: SPIN · Implicação | Voss · Pergunta calibrada; vazio se nenhuma", largura: 40 },
    { nome: "mensagem_original", significado: "Mensagem escrita pelo atendente (sem telefone, e-mail nem nome do cliente).", valores: "texto livre ou vazio", largura: 50 },
    { nome: "mensagem_sugerida", significado: "Reescrita sugerida pelo Raio-X para a mesma mensagem.", valores: "texto livre", largura: 50 },
    { nome: "erro_de_escrita", significado: "Trechos errados na escrita do atendente. Mais de um: separados por \" | \", na mesma ordem de correcao.", valores: "texto livre ou vazio", largura: 36 },
    { nome: "correcao", significado: "Forma certa de cada erro_de_escrita, na mesma ordem.", valores: "texto livre ou vazio", largura: 36 },
    { nome: "habito_para_treinar", significado: "Título do hábito que o atendente deve treinar (a descrição não entra no arquivo).", valores: "texto curto", largura: 40 },
    { nome: "veio_de_retomada", significado: "sim se o Raio-X foi aberto a partir de um ticket perdido da retomada.", valores: "sim | não", largura: 15 },
  ],
  tecnicas: [
    { nome: "atendente", significado: "Atendente.", valores: "nome do atendente", largura: 16 },
    { nome: "tecnica", significado: "Técnica que faltou, normalizada pelo vocabulário do Cérebro.", valores: "Livro · Técnica", largura: 40 },
    { nome: "quantidade", significado: "Em quantos Raio-X do atendente essa técnica faltou (cada Raio-X conta uma vez).", valores: "número inteiro", largura: 12 },
    { nome: "percentual_dos_raiox_do_atendente", significado: "quantidade ÷ total de Raio-X do atendente no período, em percentual.", valores: "0 a 100, uma casa decimal", largura: 22 },
  ],
  erros: [
    { nome: "atendente", significado: "Atendente.", valores: "nome do atendente", largura: 16 },
    { nome: "tipo_de_erro", significado: "Regra de escrita quebrada, como o Raio-X classificou.", valores: "texto curto; sem_classificacao se o Raio-X não informou", largura: 32 },
    { nome: "exemplo_errado", significado: "Exemplo mais frequente do trecho errado nesse tipo.", valores: "texto livre", largura: 36 },
    { nome: "exemplo_certo", significado: "Correção do exemplo acima.", valores: "texto livre", largura: 36 },
    { nome: "quantidade", significado: "Quantas vezes esse tipo de erro apareceu nos Raio-X do atendente.", valores: "número inteiro", largura: 12 },
  ],
  aquecimento: [
    { nome: "data_hora", significado: "Quando o cartão foi respondido.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "atendente", significado: "Atendente que respondeu.", valores: "nome do atendente", largura: 16 },
    { nome: "tema", significado: "Tema de domínio do exercício.", valores: "nome do tema (ex.: Planos, Objeções)", largura: 20 },
    { nome: "tipo_do_cartao", significado: "Tipo do exercício.", valores: "multipla_escolha | escrita | habito", largura: 18 },
    { nome: "tipo_da_sessao", significado: "diaria = aquecimento do dia (conta para a adesão). tema = treino de um tema pelo Meu mapa (conta para o mapa, não para a adesão).", valores: "diaria | tema", largura: 16 },
    { nome: "resultado", significado: "Múltipla escolha e hábito: acertou ou errou. Escrita (corrigida por IA): a nota de 0 a 10; acerta quem tira nota igual ou acima da nota de acerto.", valores: "acertou | errou | nota_0 a nota_10", largura: 14 },
  ],
  mapa: [
    { nome: "atendente", significado: "Atendente.", valores: "nome do atendente", largura: 16 },
    { nome: "tema", significado: "Tema de domínio.", valores: "nome do tema", largura: 20 },
    { nome: "nivel", significado: "Nível do atendente no tema na janela de domínio que termina no fim do período.", valores: "nao_testado | aprendendo | dominando", largura: 14 },
    { nome: "respostas_na_janela", significado: "Respostas do atendente nesse tema dentro da janela.", valores: "número inteiro", largura: 18 },
    { nome: "acertos", significado: "Quantas dessas respostas foram acertos.", valores: "número inteiro", largura: 10 },
  ],
  mudancas: [
    { nome: "mudanca", significado: "Título da mudança importante ou urgente publicada no período.", valores: "texto livre", largura: 50 },
    { nome: "tipo", significado: "Tipo da mudança.", valores: "importante | urgente", largura: 12 },
    { nome: "publicada_em", significado: "Quando a mudança foi publicada.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "vale_a_partir", significado: "Data em que a mudança passa a valer. Vazio = já valia ao publicar.", valores: "AAAA-MM-DD ou vazio", largura: 14 },
    { nome: "confirmadas", significado: "Atendentes ativos que já disseram Li e entendi.", valores: "número inteiro", largura: 12 },
    { nome: "total_de_atendentes", significado: "Atendentes ativos hoje (administradores não contam).", valores: "número inteiro", largura: 18 },
    { nome: "percentual_de_acerto", significado: "Das confirmações com pergunta de checagem, a % em que o atendente acertou. Vazio se a mudança não tem pergunta.", valores: "0 a 100, uma casa decimal, ou vazio", largura: 20 },
  ],
  confirmacoes: [
    { nome: "mudanca", significado: "Título da mudança confirmada.", valores: "texto livre", largura: 50 },
    { nome: "atendente", significado: "Atendente que confirmou.", valores: "nome do atendente", largura: 16 },
    { nome: "confirmado_em", significado: "Quando disse Li e entendi.", valores: "AAAA-MM-DD HH:MM", largura: 17 },
    { nome: "acertou_checagem", significado: "Se acertou a pergunta de checagem. Vazio quando a mudança não tem pergunta.", valores: "sim | não | vazio", largura: 16 },
  ],
  ranking: [
    { nome: "mes", significado: "Mês do ranking (o ranking é mensal e zera no dia 1º).", valores: "AAAA-MM", largura: 10 },
    { nome: "podio", significado: "Pódio.", valores: "constantes | respondidas | evoluiram | ensinam | treino | fechamentos", largura: 14 },
    { nome: "atendente", significado: "Atendente.", valores: "nome do atendente", largura: 16 },
    { nome: "valor", significado: "constantes e respondidas: percentual 0 a 100. evoluiram: variação percentual da nota sobre o mês anterior. ensinam: número de contribuições. treino: pontos do mês no Simulador (Atendimento). fechamentos: vendas do mês confirmadas no CRM.", valores: "número ou vazio", largura: 12 },
    { nome: "posicao", significado: "Posição entre quem entra no pódio. Vazio se não entra. Só o Admin vê posições.", valores: "número inteiro ou vazio", largura: 10 },
    { nome: "entra_no_podio", significado: "sim se tem o mínimo exigido (retomadas, simulações, contribuições ou vendas) para disputar.", valores: "sim | não", largura: 14 },
  ],
  meuRanking: [
    { nome: "mes", significado: "Mês do ranking.", valores: "AAAA-MM", largura: 10 },
    { nome: "podio", significado: "Pódio.", valores: "constantes | respondidas | evoluiram | ensinam | treino | fechamentos", largura: 14 },
    { nome: "meu_valor", significado: "O seu valor no mês (mesma unidade do pódio). Sem número de posição.", valores: "número ou vazio", largura: 12 },
    { nome: "valor_do_mes_anterior", significado: "O seu valor no mês anterior ao da linha.", valores: "número ou vazio", largura: 20 },
  ],
  uso: [
    { nome: "data", significado: "Dia do uso (Brasília).", valores: "AAAA-MM-DD", largura: 12 },
    { nome: "atendente", significado: "Atendente que usou.", valores: "nome do atendente", largura: 16 },
    { nome: "ferramenta", significado: "Ferramenta de IA usada.", valores: FERRAMENTAS, largura: 18 },
    { nome: "quantidade", significado: "Quantas vezes o atendente usou a ferramenta nesse dia.", valores: "número inteiro", largura: 12 },
    { nome: "limite_diario", significado: "Limite diário atual da ferramenta (ia_limites) somado às liberações extras do Admin válidas no dia (ia_limites_extra). Vazio = sem limite. Usa o limite configurado hoje, não o histórico.", valores: "número inteiro ou vazio", largura: 14 },
    { nome: "bateu_limite", significado: "sim se quantidade chegou ao limite_diario naquele dia.", valores: "sim | não", largura: 13 },
  ],
} satisfies Record<string, Coluna[]>;

const LEIA_ME_COLUNAS: Coluna[] = [
  { nome: "secao", significado: "Bloco do guia.", valores: "", largura: 22 },
  { nome: "item", significado: "Nome do que está sendo explicado.", valores: "", largura: 34 },
  { nome: "descricao", significado: "Explicação.", valores: "", largura: 90 },
  { nome: "valores_possiveis", significado: "Valores aceitos (vocabulário fixo).", valores: "", largura: 60 },
];

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const sn = (b: boolean) => (b ? "sim" : "não");
const ptBR = (a: string, b: string) => a.localeCompare(b, "pt-BR");

export function montarAbasInteligencia(d: DadosInteligencia): Aba[] {
  const nomeAt = (id: string) => d.atendentes[id] ?? "";
  const ordenados = [...d.raiox].sort((a, b) => a.data_hora.localeCompare(b.data_hora));

  // Mesma técnica com e sem acento vira um nome só (o mais frequente; no empate, o acentuado).
  const variantes = new Map<string, Map<string, number>>();
  for (const r of ordenados) for (const t of r.tecnicas) {
    const n = normalizarTecnica(t, d.blocosCerebro);
    if (!n) continue;
    const m = variantes.get(semAcento(n)) ?? variantes.set(semAcento(n), new Map()).get(semAcento(n))!;
    m.set(n, (m.get(n) ?? 0) + 1);
  }
  const nomeFinal = new Map<string, string>();
  for (const [k, m] of variantes) {
    nomeFinal.set(k, [...m.entries()].sort((a, b) => b[1] - a[1] || Number(temAcento(b[0])) - Number(temAcento(a[0])) || ptBR(a[0], b[0]))[0][0]);
  }

  // Cada Raio-X já passa pela limpeza e pela normalização aqui, uma vez só.
  const tratados = ordenados.map((r) => {
    const tecnicas = [...new Set(r.tecnicas.map((t) => normalizarTecnica(t, d.blocosCerebro)).filter(Boolean).map((n) => nomeFinal.get(semAcento(n)) ?? n))];
    const erros = r.erros.map((e) => ({
      errado: limparTextoExport(e.errado), certo: limparTextoExport(e.certo), regra: limparTextoExport(e.regra),
    }));
    return { r, atendente: nomeAt(r.user_id), tecnicas, erros };
  });

  const raioxLinhas: Cel[][] = tratados.map(({ r, atendente, tecnicas, erros }) => [
    isoBR(r.data_hora), atendente, r.etapa ?? "", tecnicas.join(" | "),
    limparTextoExport(r.reescrita_original), limparTextoExport(r.reescrita_sugerida),
    erros.map((e) => e.errado).join(" | "), erros.map((e) => e.certo).join(" | "),
    limparTextoExport(r.habito), sn(r.veio_de_retomada),
  ]);

  // Técnicas que faltam (por atendente)
  const totalPorAt = new Map<string, number>();
  const tecPorAt = new Map<string, Map<string, number>>();
  for (const t of tratados) {
    totalPorAt.set(t.atendente, (totalPorAt.get(t.atendente) ?? 0) + 1);
    const m = tecPorAt.get(t.atendente) ?? tecPorAt.set(t.atendente, new Map()).get(t.atendente)!;
    for (const k of t.tecnicas) m.set(k, (m.get(k) ?? 0) + 1);
  }
  const tecLinhas: Cel[][] = [];
  for (const [at, m] of [...tecPorAt.entries()].sort((a, b) => ptBR(a[0], b[0]))) {
    for (const [tec, n] of [...m.entries()].sort((a, b) => b[1] - a[1] || ptBR(a[0], b[0]))) {
      tecLinhas.push([at, tec, n, pct(n, totalPorAt.get(at) ?? 0)]);
    }
  }

  // Erros de escrita (por atendente e tipo)
  type G = { n: number; ex: Map<string, { errado: string; certo: string; n: number }> };
  const errPorAt = new Map<string, Map<string, G>>();
  for (const t of tratados) {
    for (const e of t.erros) {
      const tipo = e.regra || "sem_classificacao";
      const porTipo = errPorAt.get(t.atendente) ?? errPorAt.set(t.atendente, new Map()).get(t.atendente)!;
      const g = porTipo.get(tipo.toLowerCase()) ?? porTipo.set(tipo.toLowerCase(), { n: 0, ex: new Map() }).get(tipo.toLowerCase())!;
      g.n++;
      const ch = `${e.errado}→${e.certo}`;
      const ex = g.ex.get(ch) ?? g.ex.set(ch, { errado: e.errado, certo: e.certo, n: 0 }).get(ch)!;
      ex.n++;
    }
  }
  const errLinhas: Cel[][] = [];
  for (const [at, porTipo] of [...errPorAt.entries()].sort((a, b) => ptBR(a[0], b[0]))) {
    for (const [tipo, g] of [...porTipo.entries()].sort((a, b) => b[1].n - a[1].n || ptBR(a[0], b[0]))) {
      const melhor = [...g.ex.values()].sort((a, b) => b.n - a.n || ptBR(a.errado, b.errado))[0];
      errLinhas.push([at, tipo, melhor.errado, melhor.certo, g.n]);
    }
  }

  // Uso da IA
  const usoLinhas: Cel[][] = [...d.uso]
    .sort((a, b) => a.dia.localeCompare(b.dia) || ptBR(nomeAt(a.user_id), nomeAt(b.user_id)) || a.ferramenta.localeCompare(b.ferramenta))
    .map((u) => [u.dia, nomeAt(u.user_id), u.ferramenta, u.quantidade, u.limite_diario, sn(u.limite_diario != null && u.quantidade >= u.limite_diario)]);

  // Aquecimento e Mapa de domínio (Fase B · bloco 2): só acerto e nota, nunca o texto digitado.
  const aqLinhas: Cel[][] = [...(d.aquecimento ?? [])]
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora) || ptBR(nomeAt(a.user_id), nomeAt(b.user_id)))
    .map((a) => [isoBR(a.data_hora), nomeAt(a.user_id), a.tema, a.tipo_cartao, a.tipo_sessao, a.nota != null ? `nota_${a.nota}` : a.acertou ? "acertou" : "errou"]);
  const mapaLinhas: Cel[][] = [...(d.mapa ?? [])]
    .sort((a, b) => ptBR(nomeAt(a.user_id), nomeAt(b.user_id)) || ptBR(a.tema, b.tema))
    .map((m) => [nomeAt(m.user_id), m.tema, m.nivel, m.respostas, m.acertos]);

  // Mudanças e Ranking (Fase B · bloco 3).
  const mudLinhas: Cel[][] = [...(d.mudancas ?? [])]
    .sort((a, b) => a.publicada_em.localeCompare(b.publicada_em) || ptBR(a.titulo, b.titulo))
    .map((m) => [m.titulo, m.tipo, isoBR(m.publicada_em), m.vale_a_partir ?? "", m.confirmadas, m.total, m.pct_acerto]);
  const confLinhas: Cel[][] = [...(d.confirmacoes ?? [])]
    .sort((a, b) => a.confirmado_em.localeCompare(b.confirmado_em) || ptBR(nomeAt(a.user_id), nomeAt(b.user_id)))
    .map((c) => [c.titulo, nomeAt(c.user_id), isoBR(c.confirmado_em), c.acertou == null ? "" : sn(c.acertou)]);
  const mesAAAAMM = (m: string) => m.slice(0, 7);
  const rankLinhas: Cel[][] = [...(d.ranking ?? [])]
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.podio.localeCompare(b.podio) || (a.posicao ?? 999) - (b.posicao ?? 999) || ptBR(nomeAt(a.user_id), nomeAt(b.user_id)))
    .map((r) => [mesAAAAMM(r.mes), r.podio, nomeAt(r.user_id), r.valor, r.posicao, sn(r.entra)]);
  const meuLinhas: Cel[][] = [...(d.meuRanking ?? [])]
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.podio.localeCompare(b.podio))
    .map((r) => [mesAAAAMM(r.mes), r.podio, r.valor, r.valor_anterior]);

  // Fase C · extensão 2: extensão do WhatsApp, tempo de resposta e fechamentos do CRM (só contagens e minutos).
  const extLinhas: Cel[][] = [...(d.extensao ?? [])]
    .sort((a, b) => a.semana.localeCompare(b.semana) || ptBR(nomeAt(a.user_id), nomeAt(b.user_id)))
    .map((x) => [x.semana, nomeAt(x.user_id), x.tickets_criados, x.atualizados, x.ignorados, x.pausas]);
  const tempoLinhas: Cel[][] = [...(d.tempo ?? [])]
    .sort((a, b) => a.dia.localeCompare(b.dia) || ptBR(nomeAt(a.user_id), nomeAt(b.user_id)))
    .map((x) => [x.dia, nomeAt(x.user_id), x.conversas_novas, x.dentro_da_meta, x.media_minutos, x.sem_resposta]);
  const fechLinhas: Cel[][] = [...(d.fechamentos ?? [])]
    .sort((a, b) => a.periodo_ini.localeCompare(b.periodo_ini) || ptBR(nomeAt(a.user_id), nomeAt(b.user_id)))
    .map((x) => [x.periodo_ini, x.periodo_fim, nomeAt(x.user_id), x.vendas, x.tickets_fechados, x.sem_ticket]);

  return [
    { nome: "LEIA-ME", tabela: "tbl_leia_me", colunas: LEIA_ME_COLUNAS, linhas: montarLeiaMe(d) },
    { nome: "Raio-X", tabela: "tbl_raiox", colunas: C.raiox, linhas: raioxLinhas },
    { nome: "Tecnicas_que_faltam", tabela: "tbl_tecnicas_que_faltam", colunas: C.tecnicas, linhas: tecLinhas },
    { nome: "Erros_de_escrita", tabela: "tbl_erros_de_escrita", colunas: C.erros, linhas: errLinhas },
    { nome: "Uso_da_IA", tabela: "tbl_uso_da_ia", colunas: C.uso, linhas: usoLinhas },
    ...(d.aquecimento ? [{ nome: "Aquecimento", tabela: "tbl_aquecimento", colunas: C.aquecimento, linhas: aqLinhas }] : []),
    ...(d.mapa ? [{ nome: "Mapa_de_dominio", tabela: "tbl_mapa_de_dominio", colunas: C.mapa, linhas: mapaLinhas }] : []),
    ...(d.mudancas ? [{ nome: "Mudancas", tabela: "tbl_mudancas", colunas: C.mudancas, linhas: mudLinhas }] : []),
    ...(d.confirmacoes ? [{ nome: "Confirmacoes", tabela: "tbl_confirmacoes", colunas: C.confirmacoes, linhas: confLinhas }] : []),
    ...(d.ranking ? [{ nome: "Ranking", tabela: "tbl_ranking", colunas: C.ranking, linhas: rankLinhas }] : []),
    ...(d.meuRanking ? [{ nome: "Meu_ranking", tabela: "tbl_meu_ranking", colunas: C.meuRanking, linhas: meuLinhas }] : []),
    ...(d.extensao ? [{ nome: "Extensao", tabela: "tbl_extensao", colunas: C.extensao, linhas: extLinhas }] : []),
    ...(d.tempo ? [{ nome: "Tempo_de_resposta", tabela: "tbl_tempo_de_resposta", colunas: C.tempo, linhas: tempoLinhas }] : []),
    ...(d.fechamentos ? [{ nome: "Fechamentos", tabela: "tbl_fechamentos", colunas: C.fechamentos, linhas: fechLinhas }] : []),
  ];
}

function montarLeiaMe(d: DadosInteligencia): Cel[][] {
  const r: Cel[][] = [];
  const add = (secao: string, item: string, descricao: string, valores = "") => r.push([secao, item, descricao, valores]);

  add("arquivo", "o_que_e", "Relatório de inteligência da OMNIA Apoio (Cartão de TODOS): resultados do Raio-X das vendas perdidas e uso das ferramentas de IA (Copiloto e outras). Feito para ser analisado por pessoas ou por IA.");
  add("arquivo", "periodo", `De ${d.de} até ${d.ate} (datas de Brasília, ambas inclusas). O período máximo é de 90 dias.`);
  add("arquivo", "escopo", d.escopo === "equipe" ? "Equipe inteira (ou o atendente filtrado no Admin)." : "Somente os dados do atendente que exportou.", "atendente | equipe");
  add("arquivo", "exportado_por", d.exportadoPor);
  add("arquivo", "exportado_em", isoBR(d.exportadoEm), "AAAA-MM-DD HH:MM");
  add("arquivo", "privacidade", "Telefone, e-mail, nome do cliente e fala do cliente nunca entram neste arquivo. Do Raio-X só saem campos do lado do atendente e de padrões: etapa, técnica que faltou, mensagem original e sugerida, erros de escrita e hábito para treinar.");
  add("arquivo", "formato", "Cada aba é uma tabela com 1 linha de cabeçalho, sem células mescladas e sem linhas em branco. Datas em AAAA-MM-DD HH:MM (horário de Brasília). Os valores usam sempre o vocabulário descrito abaixo. Quando um campo traz mais de um valor, eles vêm separados por \" | \".");

  add("ferramentas", "copiloto", "Lê a conversa colada ou exportada e sugere a próxima mensagem do atendente. Não guarda a conversa nem o que foi copiado; só registra uso (quem, qual ferramenta, quando).", "copiloto");
  add("ferramentas", "raiox", "Analisa uma venda perdida: onde se perdeu, o que faltou de técnica, como responder melhor, erros de escrita e um hábito para treinar. Guarda só o resultado, por 90 dias, sem dados do cliente.", "raiox");
  add("ferramentas", "marciana", "Assistente de dúvidas do atendimento.", "marciana");
  add("ferramentas", "cliente_disse", "Ajuda a responder objeções do cliente.", "cliente_disse");
  add("ferramentas", "mensagem_cliente", "Escreve mensagens para o cliente.", "mensagem_cliente");
  add("ferramentas", "retomada", "Mensagens da cadência de retomada.", "retomada");
  add("ferramentas", "simulador", "Treino de conversa com clientes simulados.", "simulador");
  add("ferramentas", "biblioteca", "Monta a ficha de aprendizado de uma conversa de venda fechada.", "biblioteca");
  add("ferramentas", "aquecimento", "Corrige as respostas escritas do aquecimento de 5 minutos (nota de 0 a 10). Só o resultado é guardado.", "aquecimento");

  add("limites", "copiloto_nao_guarda", "O Copiloto não guarda a conversa nem o que foi copiado; só registra uso. Por isso este arquivo não tem o conteúdo das conversas do Copiloto.");
  add("limites", "raiox_90_dias", "O Raio-X guarda só o resultado, por 90 dias, sem dados do cliente. Resultados mais antigos já foram apagados.");
  add("limites", "uso_35_dias", "O registro de uso (aba Uso_da_IA) é apagado após 35 dias: em períodos maiores, só os últimos 35 dias têm linhas.");
  add("limites", "tecnica_no_vocabulario", "Os nomes das técnicas são normalizados para o formato Livro · Técnica do Cérebro. Nomes fora do vocabulário ficam como o Raio-X escreveu.");
  add("limites", "limite_diario", "limite_diario usa o limite configurado hoje no Admin; não há histórico de mudanças de limite. Administradores não têm limite (campo vazio).");
  add("limites", "campos_de_fora", "Ficam fora do arquivo, por poderem citar o cliente: onde_perdeu (descrição, fala do cliente e fala do atendente), a explicação de cada técnica que faltou e a descrição do hábito.");

  if (d.aquecimento) {
    const c = d.aquecimentoConfig;
    add("aquecimento", "o_que_e", "Treino diário de 3 cartões (produto, objeção e hábito de escrita). A aba Aquecimento tem uma linha por cartão respondido; a aba Mapa_de_dominio tem o nível de cada atendente por tema.");
    add("aquecimento", "privacidade", "O texto que o atendente digitou nos cartões nunca é guardado, nem a frase de feedback da IA: só o acerto e, nas respostas escritas, a nota. Por isso nenhum texto digitado entra neste arquivo.");
    add("aquecimento", "cartao_pulado", "Cartão pulado não gera linha e não conta como erro.");
    if (c) {
      add("aquecimento", "nota_de_acerto", `Resposta escrita acerta com nota igual ou acima de ${c.nota_acerto}.`, `${c.nota_acerto}`);
      add("mapa_de_dominio", "regra_do_nivel", `Janela de ${c.janela_dominio_dias} dias terminada no fim do período. Menos de ${c.min_respostas} respostas no tema = nao_testado; acertos ÷ respostas igual ou acima de ${Math.round(c.limiar_dominando * 100)}% = dominando; entre os dois = aprendendo.`, "nao_testado | aprendendo | dominando");
    }
    add("mapa_de_dominio", "so_aquecimento", "O nível vem só das respostas do aquecimento: as avaliações do Simulador não têm tema ligado e não entram no cálculo.");
    add("mapa_de_dominio", "sem_ranking", "O aquecimento não entra no Ranking.");
  }

  if (d.mudancas || d.confirmacoes) {
    add("mudancas", "o_que_e", "Avisos de mudança da Omnia. Importante e urgente pedem o Li e entendi do atendente; informativa não pede. A aba Mudancas (só do Admin) resume cada mudança publicada no período; a aba Confirmacoes lista quem confirmou e quando.");
    add("mudancas", "acerto_da_checagem", "Algumas mudanças têm uma pergunta de checagem (3 alternativas). O atendente vê a resposta certa e a explicação antes de confirmar; acertou_checagem registra se acertou. Vira também um cartão do aquecimento.");
    add("mudancas", "privacidade", d.escopo === "equipe" ? "Equipe inteira: uma linha por confirmação." : "Somente as suas próprias confirmações.");
  }
  if (d.ranking || d.meuRanking) {
    add("ranking", "o_que_e", "Ranking mensal de qualidade, zerado no dia 1º. Pódios: constantes, respondidas, evoluiram, ensinam, treino (pontos do Simulador) e fechamentos (vendas confirmadas no CRM). O aquecimento e o Raio-X não entram no ranking.");
    add("ranking", "constantes", "% das etapas de retomada com prazo no mês enviadas no dia do prazo (primeiro Enviei até o fim do dia do prazo, horário de Brasília). Etapa = um passo da régua de uma retomada.", "0 a 100");
    add("ranking", "respondidas", "Entre as retomadas com pelo menos um Enviei no mês, % em que o cliente respondeu ou fechou.", "0 a 100");
    add("ranking", "evoluiram", "Variação % da nota média do Simulador no mês sobre o mês anterior; precisa de 3 simulações em cada mês e só entra quem melhorou.");
    add("ranking", "ensinam", "Conversas publicadas na Biblioteca mais objeções aprovadas com crédito ao autor, no mês.");
    add("ranking", "fechamentos", "Vendas do mês confirmadas no CRM: soma das planilhas semanais enviadas pelo Admin. Não tem mínimo de retomadas.");
    add("ranking", "minimo", "Os pódios de porcentagem só contam quem tem o mínimo de retomadas no mês (padrão 15, definido no Admin).");
    add("ranking", "privacidade", d.escopo === "equipe"
      ? "Visão do Admin: lista completa com posições. O atendente vê só os 3 primeiros no site e, neste arquivo, só o próprio valor."
      : "Aba Meu_ranking: só o seu valor e o do mês anterior, sem posição e sem dados de outras pessoas.");
  }

  if (d.extensao || d.tempo || d.fechamentos) {
    const meta = d.metaTempoMinutos ?? 5;
    const proprio = d.escopo === "equipe" ? "Equipe inteira (ou o atendente filtrado)." : "Somente os seus próprios dados.";
    if (d.extensao) {
      add("extensao", "o_que_e", `Uso da extensão do WhatsApp por semana (segunda a domingo): tickets criados e atualizados pela extensão, contatos ignorados e vezes em que pausou. ${proprio}`);
      add("extensao", "privacidade", "Só contagens. A extensão lê apenas a conversa que o atendente manda ler; nada de conversa, nome nem telefone de cliente entra neste arquivo.");
    }
    if (d.tempo) {
      add("tempo_de_resposta", "o_que_e", `Tempo de primeira resposta por dia. Conversa nova = o cliente escreve depois de várias horas (padrão 12 h) sem mensagens; se mandar várias seguidas, o relógio começa na primeira. A meta atual é de ${meta} minutos. ${proprio}`, `${meta}`);
      add("tempo_de_resposta", "minutos_uteis", "Os minutos contam só dentro do horário de atendimento configurado no Admin (padrão: segunda a sexta 08:00–18:00 e sábado 08:00–12:00, horário de Brasília).");
      add("tempo_de_resposta", "limitacao", "A extensão lê só a lista de conversas. Mensagens automáticas ou de bot só deixam de contar quando a prévia tem um aviso automático inequívoco; na dúvida, a resposta é tratada como humana. Se o cliente escreve de novo antes de a extensão ver a resposta, o tempo pode sair maior que o real.");
      add("tempo_de_resposta", "privacidade", "O nome e a prévia da conversa ficam só no navegador do atendente. O que é guardado: uma chave em hash, o horário e os minutos.");
    }
    if (d.fechamentos) {
      add("fechamentos", "o_que_e", `Vendas do CRM por semana e atendente, a partir da planilha semanal enviada pelo Admin. Cada envio substitui os dias que a planilha cobre. ${proprio}`);
      add("fechamentos", "como_casa", "O telefone da planilha é lido no navegador do Admin e só um hash chega ao servidor; ele é comparado ao hash do telefone dos tickets abertos do atendente. A planilha não é guardada e nenhum telefone ou nome de cliente entra aqui.");
      add("fechamentos", "sem_ticket", "Venda sem ticket correspondente na Omnia (cliente que não passou pela retomada ou sem telefone na planilha).");
    }
  }

  d.funil.forEach((f, i) => {
    const def = f.definicao.trim() || "(definição ainda não preenchida no Cérebro)";
    const sinais = f.sinais.length ? ` Sinais: ${f.sinais.join("; ")}.` : "";
    add("funil_do_cerebro", `${i + 1}. ${f.nome}`, `${def}${sinais}`, f.etapa);
  });

  const abasDic: (readonly [string, Coluna[]])[] = [["Raio-X", C.raiox], ["Tecnicas_que_faltam", C.tecnicas], ["Erros_de_escrita", C.erros], ["Uso_da_IA", C.uso]];
  if (d.aquecimento) abasDic.push(["Aquecimento", C.aquecimento]);
  if (d.mapa) abasDic.push(["Mapa_de_dominio", C.mapa]);
  if (d.mudancas) abasDic.push(["Mudancas", C.mudancas]);
  if (d.confirmacoes) abasDic.push(["Confirmacoes", C.confirmacoes]);
  if (d.ranking) abasDic.push(["Ranking", C.ranking]);
  if (d.meuRanking) abasDic.push(["Meu_ranking", C.meuRanking]);
  if (d.extensao) abasDic.push(["Extensao", C.extensao]);
  if (d.tempo) abasDic.push(["Tempo_de_resposta", C.tempo]);
  if (d.fechamentos) abasDic.push(["Fechamentos", C.fechamentos]);
  for (const [aba, cols] of abasDic) {
    for (const c of cols) add("dicionario_de_colunas", `${aba}.${c.nome}`, c.significado, c.valores);
  }
  return r;
}

/** Monta o .xlsx (ArrayBuffer). Funciona no navegador e no Node. */
export async function montarRelatorioInteligenciaXlsx(d: DadosInteligencia): Promise<ArrayBuffer> {
  return abasParaXlsx(montarAbasInteligencia(d), d.exportadoEm, ["LEIA-ME"]);
}

export function nomeArquivoInteligencia(d: DadosInteligencia, atendente?: string | null): string {
  const quem = (d.escopo === "equipe" ? atendente || "equipe" : d.exportadoPor || "atendente")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "atendente";
  return `omnia-inteligencia_${quem}_${d.de}_a_${d.ate}.xlsx`;
}
