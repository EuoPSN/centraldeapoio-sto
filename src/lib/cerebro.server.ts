// Cérebro da Omnia — só servidor.
//
// ÚNICO PONTO de contato com a IA para o Cérebro: toda chamada nova (Copiloto,
// Raio-X) e as ferramentas ligadas ao Cérebro (MarcIAna, "O cliente disse…",
// Simulador) passam por `chamarIA` e montam suas instruções com `montarInstrucoes`.
// Para trocar de provedor (ex.: Gemini direto com chave própria), é só mudar
// `chamarIA` aqui.

import { chatCompletion, type ChatMessage, type ChatContentPart } from "@/lib/ai-gateway.server";
import { COPILOTO_MODEL, RAIOX_MODEL } from "@/lib/ai-models";
import { isAdminUser } from "@/lib/authz";
import { diaBR, inicioDiaBR } from "@/lib/retomada";
import {
  CopilotoRespostaSchema, RaioxRespostaSchema, ETAPAS_FUNIL, ETAPA_FUNIL_NOME, REGRAS_FIXAS_PADRAO,
  blocoVazio, CHAVE_MUDANCAS_RECENTES, calcularUso, contarPalavras, extrairJson, gerarEtapasFunil, gerarMudancasRecentes, gerarPadraoEscrita, limparTrecho, mensagemLimite,
  type CopilotoResposta, type Ferramenta, type FunilEtapa, type MudancaRecente, type PadraoEscritaItem, type RaioxResposta, type UsoStatus,
} from "@/lib/cerebro";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// ---------------------------------------------------------------------------
// Chamada de IA
// ---------------------------------------------------------------------------

export async function chamarIA(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<string> {
  return chatCompletion(opts);
}

export async function chamarIAJson(opts: { model: string; messages: ChatMessage[]; temperature?: number }): Promise<unknown> {
  return extrairJson(await chamarIA(opts));
}

// ---------------------------------------------------------------------------
// Montagem das instruções
// ---------------------------------------------------------------------------

export type ContextoOmnia = "objecoes" | "mensalidades" | "amor_saude";

/** O que cada ferramenta recebe de dados da Omnia por padrão (só o necessário). */
const CONTEXTO_PADRAO: Record<Ferramenta, ContextoOmnia[]> = {
  marciana: [],
  mensagem_cliente: [],
  cliente_disse: [],
  retomada: [],
  simulador: [],
  copiloto: ["objecoes", "mensalidades", "amor_saude"],
  raiox: ["mensalidades"],
  biblioteca: ["objecoes"],
  aquecimento: [],
  extensao: [],
};

interface DadosCerebro {
  blocos: { chave: string; titulo: string; conteudo: string; ferramentas: string[]; gerado: boolean; ordem: number }[];
  regras: string[];
  padrao: PadraoEscritaItem[];
  etapas: FunilEtapa[];
  mudancas: MudancaRecente[];
}

/** Mudanças importantes/urgentes publicadas nos últimos 30 dias, marcadas "usar na IA" e ainda não
 * incorporadas ao Playbook. Colunas novas: se a migração ainda não rodou, devolve lista vazia. */
export async function lerMudancasRecentes(): Promise<MudancaRecente[]> {
  try {
    const a = await adminDb();
    const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data, error } = await a.from("changelog_entries")
      .select("title, summary, vale_a_partir")
      .in("tipo", ["importante", "urgente"]).eq("published", true).eq("usar_na_ia", true).eq("incorporada", false)
      .gte("publicada_em", desde).order("publicada_em", { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as MudancaRecente[];
  } catch (err) {
    console.error("Mudanças recentes indisponíveis:", err);
    return [];
  }
}

/** Lê o Cérebro do banco. Se as tabelas ainda não existem (migração pendente) ou
 * der erro, devolve null e as ferramentas seguem com as regras padrão. */
async function carregarCerebro(): Promise<DadosCerebro | null> {
  try {
    const a = await adminDb();
    const [b, r, p, e, mudancas] = await Promise.all([
      a.from("cerebro_blocos").select("chave, titulo, conteudo, ferramentas, gerado, ativo, ordem").eq("ativo", true).order("ordem"),
      a.from("cerebro_regras_fixas").select("texto, ordem").eq("ativo", true).order("ordem"),
      a.from("padrao_escrita").select("*").eq("ativo", true).order("ordem"),
      a.from("funil_etapas").select("*").order("ordem"),
      lerMudancasRecentes(),
    ]);
    if (b.error || r.error) throw new Error(b.error?.message ?? r.error?.message);
    return {
      blocos: b.data ?? [],
      regras: ((r.data ?? []) as { texto: string }[]).map((x) => x.texto),
      padrao: (p.data ?? []) as PadraoEscritaItem[],
      etapas: (e.data ?? []) as FunilEtapa[],
      mudancas,
    };
  } catch (err) {
    console.error("Cérebro indisponível; usando regras padrão:", err);
    return null;
  }
}

async function contextoDaOmnia(tipos: ContextoOmnia[]): Promise<string[]> {
  if (!tipos.length) return [];
  const a = await adminDb();
  const partes: string[] = [];
  try {
    if (tipos.includes("objecoes")) {
      const { data } = await a.from("objecoes").select("id, nome, exemplos_de_fala").eq("status", "publicada").order("prioridade").order("nome");
      const lista = ((data ?? []) as { id: string; nome: string; exemplos_de_fala: string[] }[])
        .map((o) => `- ${o.id} | ${o.nome}${o.exemplos_de_fala?.length ? ` | ex.: ${o.exemplos_de_fala.slice(0, 2).join(" / ")}` : ""}`);
      if (lista.length) partes.push(`OBJEÇÕES PUBLICADAS (id | nome | exemplos de fala):\n${lista.join("\n")}`);
    }
    if (tipos.includes("mensalidades")) {
      const { data } = await a.from("config_economia").select("plano, mensalidade");
      const lista = ((data ?? []) as { plano: string; mensalidade: number | null }[])
        .filter((m) => m.mensalidade != null)
        .map((m) => `- ${m.plano}: R$ ${Number(m.mensalidade).toFixed(2).replace(".", ",")} por mês`);
      if (lista.length) partes.push(`MENSALIDADES DOS PLANOS:\n${lista.join("\n")}`);
    }
    if (tipos.includes("amor_saude")) {
      const { data } = await a.from("pricing_items").select("specialty, cartao_price").order("specialty").limit(80);
      const lista = ((data ?? []) as { specialty: string; cartao_price: number | null }[])
        .filter((p) => p.cartao_price != null)
        .map((p) => `- ${p.specialty}: R$ ${Number(p.cartao_price).toFixed(2).replace(".", ",")}`);
      if (lista.length) partes.push(`CONSULTAS NA AMOR SAÚDE (preço com o cartão):\n${lista.join("\n")}`);
    }
  } catch (err) {
    console.error("Contexto da Omnia indisponível:", err);
  }
  return partes;
}

export interface Instrucoes { texto: string; palavras: number }

/** Monta as instruções de uma ferramenta: regras fixas + blocos ativos marcados
 * para ela + só o contexto da Omnia de que precisa + o contexto extra da chamada.
 * Blocos vazios ("[escrever]") são ignorados, então nada muda enquanto o Paulo
 * não preencher. `override` permite testar um bloco em edição sem salvar. */
export async function montarInstrucoes(
  ferramenta: Ferramenta,
  contextoExtra = "",
  opts: {
    contexto?: ContextoOmnia[];
    override?: { chave: string; conteudo: string; ferramentas: string[] };
  } = {},
): Promise<Instrucoes> {
  const dados = await carregarCerebro();
  const secoes: string[] = [];

  const regras = dados?.regras.length ? dados.regras : REGRAS_FIXAS_PADRAO;
  secoes.push(`REGRAS FIXAS (valem sempre):\n${regras.map((r) => `- ${r}`).join("\n")}`);

  if (dados) {
    for (const b of dados.blocos) {
      const ov = opts.override?.chave === b.chave ? opts.override : null;
      const ferramentas = ov ? ov.ferramentas : b.ferramentas;
      if (!ferramentas.includes(ferramenta)) continue;
      let corpo: string;
      if (b.chave === "padrao_escrita") corpo = gerarPadraoEscrita(dados.padrao);
      else if (b.chave === "etapas_funil") corpo = gerarEtapasFunil(dados.etapas);
      else if (b.chave === CHAVE_MUDANCAS_RECENTES) corpo = gerarMudancasRecentes(dados.mudancas);
      else corpo = ov ? ov.conteudo : b.conteudo;
      if (blocoVazio(corpo)) continue;
      secoes.push(b.gerado ? corpo.trim() : `${b.titulo.toUpperCase()}:\n${corpo.trim()}`);
    }
    // Bloco em edição que ainda não estava marcado para esta ferramenta.
    if (opts.override && !dados.blocos.some((b) => b.chave === opts.override!.chave)) {
      if (opts.override.ferramentas.includes(ferramenta) && !blocoVazio(opts.override.conteudo)) secoes.push(opts.override.conteudo.trim());
    }
  }

  secoes.push(...(await contextoDaOmnia(opts.contexto ?? CONTEXTO_PADRAO[ferramenta])));
  if (contextoExtra.trim()) secoes.push(contextoExtra.trim());

  const texto = secoes.join("\n\n");
  return { texto, palavras: contarPalavras(texto) };
}

// ---------------------------------------------------------------------------
// Limites de uso
// ---------------------------------------------------------------------------

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;

/** Quanto a pessoa já usou hoje (horário de Brasília) e qual o limite. Admin não tem limite. */
export async function statusUso(ctx: Ctx, ferramenta: Ferramenta): Promise<UsoStatus> {
  try {
    if (await isAdminUser(ctx.supabase, ctx.userId)) return calcularUso(ferramenta, 0, null);
    const s = db(ctx);
    const agora = new Date();
    const desde = inicioDiaBR(diaBR(agora)).toISOString();
    const [lim, extras, uso] = await Promise.all([
      s.from("ia_limites").select("limite_diario").eq("ferramenta", ferramenta).maybeSingle(),
      s.from("ia_limites_extra").select("extra").eq("user_id", ctx.userId).eq("ferramenta", ferramenta).gt("valido_ate", agora.toISOString()),
      s.from("ia_uso").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("ferramenta", ferramenta).gte("created_at", desde),
    ]);
    if (lim.error || uso.error) throw new Error(lim.error?.message ?? uso.error?.message);
    const base = lim.data?.limite_diario as number | null | undefined;
    const limite = base == null ? null : base + ((extras.data ?? []) as { extra: number }[]).reduce((a, x) => a + x.extra, 0);
    return calcularUso(ferramenta, uso.count ?? 0, limite);
  } catch (err) {
    console.error("Limite de uso indisponível (migração pendente?):", err);
    return calcularUso(ferramenta, 0, null);
  }
}

/** Registra um uso (sem guardar conteúdo). Falha silenciosa: não derruba a ferramenta. */
export async function registrarUso(ctx: Ctx, ferramenta: Ferramenta): Promise<void> {
  try {
    const r = await db(ctx).from("ia_uso").insert({ user_id: ctx.userId, ferramenta });
    if (r?.error) throw new Error(r.error.message);
  } catch (err) {
    console.error("Não consegui registrar o uso de IA:", err);
  }
}

/** Confere o limite e registra o uso. Lança a mensagem pronta para a tela quando
 * o limite do dia foi atingido. Para ferramentas que só contam uso com sucesso
 * (Copiloto, Raio-X), use `statusUso` antes e `registrarUso` depois. */
export async function consumirUso(ctx: Ctx, ferramenta: Ferramenta): Promise<UsoStatus> {
  const st = await statusUso(ctx, ferramenta);
  if (st.bloqueado) throw new Error(mensagemLimite(ferramenta));
  await registrarUso(ctx, ferramenta);
  return calcularUso(ferramenta, st.usado + 1, st.limite);
}

// ---------------------------------------------------------------------------
// Copiloto e Raio-X
// ---------------------------------------------------------------------------

const AVISO_IMAGENS = "Se houver imagens (prints da conversa), leia só o que for conversa. IGNORE e NÃO repita telefones, CPFs, e-mails, endereços ou nomes completos que aparecerem.";
const LISTA_ETAPAS = ETAPAS_FUNIL.map((e) => `${e} (${ETAPA_FUNIL_NOME[e]})`).join(", ");

function conteudoUsuario(texto: string, imagens: string[]): string | ChatContentPart[] {
  const base = texto.trim() ? `CONVERSA:\n${texto}` : "A conversa está nas imagens anexadas.";
  if (!imagens.length) return base;
  return [{ type: "text", text: base }, ...imagens.map((url) => ({ type: "image_url" as const, image_url: { url } }))];
}

const semPlanoDeSaude = (t: string) => t.replace(/n[ãa]o [ée] plano de sa[úu]de/gi, "").replace(/\s{2,}/g, " ").trim();

export interface CopilotoResultado extends CopilotoResposta {
  objecoes: { id: string; nome: string }[];
}

export async function analisarCopiloto(input: {
  texto: string;
  imagens: string[];
  override?: { chave: string; conteudo: string; ferramentas: string[] };
}): Promise<CopilotoResultado> {
  const tarefa = `Você é o Copiloto de vendas: lê a conversa de WhatsApp entre um atendente do Cartão de TODOS e um cliente e sugere a PRÓXIMA mensagem do atendente.
${AVISO_IMAGENS}
Etapas do funil (use exatamente um destes códigos): ${LISTA_ETAPAS}. Classifique usando as definições do funil acima, quando houver; sem definição, use o nome da etapa.
Regras:
- "objecoes_detectadas": só ids da lista de OBJEÇÕES PUBLICADAS; a primeira é a que o atendente deve tratar primeiro. Lista vazia se não houver.
- "opcao_direta": puxa o próximo passo da venda. "opcao_consultiva": aprofunda a necessidade com uma pergunta. Cada uma é a mensagem pronta, escrita pelo atendente, com no máximo 4 linhas e uma só pergunta.
- "porque": uma frase curta explicando a escolha.
- "primeiro_nome_cliente": só se aparecer na conversa; senão null.
- "ponto_parada_sugerido": nao_respondeu_primeira | parou_explicativa | recebeu_proposta | travou_fechamento (onde a conversa parou) ou null.
- Nunca invente valores, carências ou benefícios fora do contexto acima.
Responda APENAS com JSON:
{"etapa":"...","resumo_onde_esta":"...","objecoes_detectadas":["id"],"opcao_direta":{"texto":"...","porque":"..."},"opcao_consultiva":{"texto":"...","porque":"..."},"primeiro_nome_cliente":null,"ponto_parada_sugerido":null}`;
  const { texto: system } = await montarInstrucoes("copiloto", tarefa, { override: input.override });
  const raw = await chamarIAJson({
    model: COPILOTO_MODEL,
    temperature: 0.4,
    messages: [{ role: "system", content: system }, { role: "user", content: conteudoUsuario(input.texto, input.imagens) }],
  });
  const r = CopilotoRespostaSchema.parse(raw);
  const a = await adminDb();
  const { data } = await a.from("objecoes").select("id, nome").eq("status", "publicada");
  const validas = new Map(((data ?? []) as { id: string; nome: string }[]).map((o) => [o.id, o.nome]));
  const ids = r.objecoes_detectadas.filter((id) => validas.has(id));
  return {
    ...r,
    objecoes_detectadas: ids,
    objecoes: ids.map((id) => ({ id, nome: validas.get(id)! })),
    opcao_direta: { ...r.opcao_direta, texto: semPlanoDeSaude(r.opcao_direta.texto) },
    opcao_consultiva: { ...r.opcao_consultiva, texto: semPlanoDeSaude(r.opcao_consultiva.texto) },
    primeiro_nome_cliente: r.primeiro_nome_cliente ? r.primeiro_nome_cliente.split(/\s+/)[0] : null,
  };
}

export async function analisarRaiox(input: {
  texto: string;
  imagens: string[];
  tempoResposta: { mediaMin: number; maiorMin: number } | null;
  primeiroNomeCliente: string | null;
}): Promise<RaioxResposta> {
  const a = await adminDb();
  const { data: perfisRaw } = await a.from("client_profiles").select("id, name, personality, difficulty, objectives, objections").limit(60);
  const perfis = (perfisRaw ?? []) as { id: string; name: string; personality: string | null; difficulty: string | null; objectives: string | null; objections: string | null }[];

  const tarefa = `Você faz o RAIO-X de uma venda perdida no WhatsApp do Cartão de TODOS: mostra onde a venda se perdeu, o que faltou de técnica, como responder melhor e a qualidade da escrita.
${AVISO_IMAGENS}
Etapas do funil (use exatamente um destes códigos): ${LISTA_ETAPAS}. Use as definições do funil acima quando houver.
Regras:
- "onde_perdeu": descricao (2 frases no máximo), fala_cliente e fala_atendente (citações curtas do momento, exatamente como foram ditas).
- "faltou": até 4 itens. "tecnica" no formato "SPIN · Implicação" ou "Voss · Pergunta calibrada" (use só técnicas dos blocos acima, quando houver); "explicacao" em uma frase.
- "reescrita": original (fala do atendente, copiada) e sugerida (como você responderia, no padrão de escrita acima, até 4 linhas, uma só pergunta).
- "escrita": até 5 itens {errado, certo, regra} só com erros que de fato aparecem, conforme o padrão de escrita. Lista vazia se não houver.
- "habito": titulo curto e descricao de uma frase com o hábito a treinar; "perfil_simulador_sugerido" = id de UM perfil da lista abaixo que mais se parece com este cliente, ou null.
- Nunca repita nome, telefone, CPF ou e-mail do cliente: chame-o de "Cliente".
Perfis do Simulador (id | nome | dificuldade | personalidade):
${perfis.map((p) => `${p.id} | ${p.name} | ${p.difficulty ?? ""} | ${(p.personality ?? "").slice(0, 120)}`).join("\n") || "(nenhum)"}
Responda APENAS com JSON:
{"etapa":"...","onde_perdeu":{"descricao":"...","fala_cliente":"...","fala_atendente":"..."},"faltou":[{"tecnica":"...","explicacao":"..."}],"reescrita":{"original":"...","sugerida":"..."},"escrita":[{"errado":"...","certo":"...","regra":"..."}],"habito":{"titulo":"...","descricao":"...","perfil_simulador_sugerido":null}}`;
  const { texto: system } = await montarInstrucoes("raiox", tarefa);
  const raw = await chamarIAJson({
    model: RAIOX_MODEL,
    temperature: 0.3,
    messages: [{ role: "system", content: system }, { role: "user", content: conteudoUsuario(input.texto, input.imagens) }],
  });
  const r = RaioxRespostaSchema.parse(raw);
  const nome = input.primeiroNomeCliente;
  const l = (t: string) => limparTrecho(t, nome);
  const perfilId = r.habito.perfil_simulador_sugerido && perfis.some((p) => p.id === r.habito.perfil_simulador_sugerido)
    ? r.habito.perfil_simulador_sugerido : null;
  return {
    etapa: r.etapa,
    onde_perdeu: { descricao: l(r.onde_perdeu.descricao), fala_cliente: l(r.onde_perdeu.fala_cliente), fala_atendente: l(r.onde_perdeu.fala_atendente) },
    faltou: r.faltou.map((f) => ({ tecnica: f.tecnica, explicacao: l(f.explicacao) })),
    reescrita: { original: l(r.reescrita.original), sugerida: semPlanoDeSaude(l(r.reescrita.sugerida)) },
    escrita: r.escrita.map((e) => ({ errado: l(e.errado), certo: l(e.certo), regra: e.regra })),
    habito: { ...r.habito, perfil_simulador_sugerido: perfilId },
    tempo_resposta: input.tempoResposta,
    perfil_id: perfilId,
  };
}
