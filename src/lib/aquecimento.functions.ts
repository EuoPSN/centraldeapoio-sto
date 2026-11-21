import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { removerDadosPessoais } from "@/lib/cliente-disse";
import { diaBR, somarDias } from "@/lib/retomada";
import {
  CONFIG_AQUECIMENTO_PADRAO, HABITOS, MSG_SEM_CORRECAO, calcularNivel, conferirPadraoEscrita, ehHabitoMecanico,
  habitoDaRegra, msgLimiteCorrecoes, NIVEL_ORDEM,
  type Cartao, type ConfigAquecimento, type MudancaNivel, type Nivel, type ResultadoCartao, type ResumoSessao, type SessaoAquecimento, type TipoExercicio,
} from "@/lib/aquecimento";

// Aquecimento — funções de servidor do atendente.
//
// O navegador nunca recebe a alternativa correta nem a resposta aprovada antes de
// responder. O texto digitado é corrigido e descartado: o banco guarda só acerto e nota.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
const UUID = z.string().uuid();
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

interface ExRow {
  id: string; tema_id: string; tipo: TipoExercicio; titulo: string; pergunta: string; contexto: string;
  alternativas: { texto: string; correta: boolean }[]; resposta_aprovada: string; habito_chave: string | null;
  explicacao: string; fonte: string; objecao_id: string | null;
}
interface MapaLinha { tema_id: string; respostas: number; acertos: number; nivel: Nivel }

async function lerConfig(ctx: Ctx): Promise<ConfigAquecimento> {
  const { data } = await db(ctx).from("aquecimento_config").select("*").eq("id", 1).maybeSingle();
  if (!data) return CONFIG_AQUECIMENTO_PADRAO;
  return {
    horarios: Array.isArray(data.horarios) && data.horarios.length ? data.horarios : CONFIG_AQUECIMENTO_PADRAO.horarios,
    cartoes_por_dia: Number(data.cartoes_por_dia), janela_dominio_dias: Number(data.janela_dominio_dias),
    min_respostas: Number(data.min_respostas), limiar_dominando: Number(data.limiar_dominando), nota_acerto: Number(data.nota_acerto),
  };
}

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const nomeSeguro = (v: unknown) => String(v ?? "");

/** Segunda a sexta da semana de `dia`. */
function semanaUtil(dia: string): { seg: string; sex: string } {
  const dow = new Date(`${dia}T12:00:00.000Z`).getUTCDay(); // 0 = domingo
  const seg = somarDias(dia, dow === 0 ? -6 : 1 - dow);
  return { seg, sex: somarDias(seg, 4) };
}

async function diasNaSemana(ctx: Ctx): Promise<number> {
  const { seg, sex } = semanaUtil(diaBR(new Date()));
  const { count } = await db(ctx).from("aquecimento_sessoes").select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId).eq("tipo", "diaria").eq("status", "concluida").gte("data", seg).lte("data", sex);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Status (faixa do Início, menu e avisos do Chrome)
// ---------------------------------------------------------------------------

export interface StatusAquecimento {
  /** Há exercício aprovado para montar o aquecimento. */
  disponivel: boolean;
  concluido_hoje: boolean;
  dias_semana: number;
  notificar: boolean;
  horarios: string[];
  primeira_vez: boolean;
}

export const getStatusAquecimento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatusAquecimento> => {
    const s = db(context);
    const hoje = diaBR(new Date());
    try {
      const [cfg, ex, hojeSes, todas, pref, dias] = await Promise.all([
        lerConfig(context),
        s.from("aquecimento_exercicios").select("id", { count: "exact", head: true }).eq("status", "aprovado"),
        s.from("aquecimento_sessoes").select("status").eq("user_id", context.userId).eq("tipo", "diaria").eq("data", hoje).maybeSingle(),
        s.from("aquecimento_sessoes").select("id", { count: "exact", head: true }).eq("user_id", context.userId),
        s.from("aquecimento_prefs").select("notificar").eq("user_id", context.userId).maybeSingle(),
        diasNaSemana(context),
      ]);
      return {
        disponivel: (ex.count ?? 0) > 0,
        concluido_hoje: hojeSes.data?.status === "concluida",
        dias_semana: dias,
        notificar: pref.data ? !!pref.data.notificar : true,
        horarios: cfg.horarios,
        primeira_vez: (todas.count ?? 0) === 0,
      };
    } catch (err) {
      // Migração pendente: a Omnia segue sem a faixa.
      console.error("Aquecimento indisponível (migração pendente?):", err);
      return { disponivel: false, concluido_hoje: false, dias_semana: 0, notificar: false, horarios: [], primeira_vez: false };
    }
  });

export const definirAvisoAquecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ notificar: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    check(await db(context).from("aquecimento_prefs").upsert(
      { user_id: context.userId, notificar: data.notificar, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
    return { notificar: data.notificar };
  });

// ---------------------------------------------------------------------------
// Seleção dos cartões (escolherCartoes)
// ---------------------------------------------------------------------------

function paraCartao(e: ExRow, temaNome: string, userId: string, resultado: ResultadoCartao | null): Cartao {
  const alts = e.tipo === "multipla_escolha"
    ? e.alternativas.map((a, i) => ({ i, texto: a.texto })).sort((a, b) => hash(`${userId}${e.id}${a.i}`) - hash(`${userId}${e.id}${b.i}`))
    : [];
  return {
    exercicio_id: e.id, tipo: e.tipo, tema_id: e.tema_id, tema_nome: temaNome, titulo: e.titulo, pergunta: e.pergunta,
    contexto: e.contexto, alternativas: alts, habito_chave: e.habito_chave, resultado,
  };
}

/** Ordem dos temas do mais fraco ao mais forte: "não testado", depois menor % de acerto. */
function temasDoMaisFraco(temas: { id: string; ordem: number }[], mapa: MapaLinha[]): string[] {
  const m = new Map(mapa.map((x) => [x.tema_id, x]));
  const acc = (id: string) => { const x = m.get(id); return x && x.respostas ? x.acertos / x.respostas : 0; };
  return [...temas].sort((a, b) => {
    const na = NIVEL_ORDEM[m.get(a.id)?.nivel ?? "nao_testado"]; const nb = NIVEL_ORDEM[m.get(b.id)?.nivel ?? "nao_testado"];
    return na - nb || acc(a.id) - acc(b.id) || a.ordem - b.ordem;
  }).map((t) => t.id);
}

/** Exercício ligado a uma mudança importante ou urgente publicada nos últimos 3 dias que a pessoa
 * ainda não respondeu (em nenhuma sessão). Sem a migração das mudanças, devolve null. */
async function exercicioDeMudancaPendente(ctx: Ctx, aprovados: ExRow[]): Promise<ExRow | null> {
  try {
    const s = db(ctx);
    const desde3 = new Date(Date.now() - 3 * 86400_000).toISOString();
    const { data, error } = await s.from("changelog_entries").select("exercicio_id, publicada_em")
      .eq("published", true).in("tipo", ["importante", "urgente"]).not("exercicio_id", "is", null)
      .gte("publicada_em", desde3).order("publicada_em", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = ((data ?? []) as { exercicio_id: string }[]).map((r) => r.exercicio_id);
    if (!ids.length) return null;
    const resp = await s.from("aquecimento_respostas").select("exercicio_id").eq("user_id", ctx.userId).in("exercicio_id", ids);
    const respondidos = new Set(((resp.error ? [] : (resp.data ?? [])) as { exercicio_id: string | null }[]).map((r) => r.exercicio_id));
    for (const id of ids) {
      const e = aprovados.find((x) => x.id === id && x.tipo === "multipla_escolha");
      if (e && !respondidos.has(id)) return e;
    }
    return null;
  } catch (err) {
    console.error("Exercício de mudança indisponível:", err);
    return null;
  }
}

async function escolherCartoes(ctx: Ctx, cfg: ConfigAquecimento, opts: { total: number; temaId?: string; jaUsados: Set<string> }): Promise<{ ex: ExRow[]; temas: Map<string, string> }> {
  const s = db(ctx);
  const dia = diaBR(new Date());
  const desde14 = new Date(Date.now() - 14 * 86400_000).toISOString();
  const desde30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [temasR, exR, recentesR, mapaR] = await Promise.all([
    s.from("dominio_temas").select("id, nome, ordem").eq("ativo", true).order("ordem"),
    s.from("aquecimento_exercicios").select("*").eq("status", "aprovado"),
    s.from("aquecimento_respostas").select("exercicio_id").eq("user_id", ctx.userId).gte("created_at", desde14),
    s.rpc("aquecimento_meu_mapa"),
  ]);
  const temas = check(temasR) as { id: string; nome: string; ordem: number }[];
  const nomes = new Map(temas.map((t) => [t.id, t.nome]));
  const ativos = new Set(temas.map((t) => t.id));
  const todos = ((check(exR) ?? []) as ExRow[]).filter((e) => ativos.has(e.tema_id));
  const recentes = new Set(((check(recentesR) ?? []) as { exercicio_id: string | null }[]).map((r) => r.exercicio_id).filter(Boolean) as string[]);
  const mapa = (mapaR.error ? [] : (mapaR.data ?? [])) as MapaLinha[];

  const usados = new Set(opts.jaUsados);
  const livre = (e: ExRow) => !usados.has(e.id) && !recentes.has(e.id);
  const escolhe = (lista: ExRow[], sal: string) => lista.length ? lista[hash(`${ctx.userId}${dia}${sal}`) % lista.length] : null;
  const marca = (e: ExRow | null) => { if (e) usados.add(e.id); return e; };
  const out: ExRow[] = [];

  if (opts.temaId) {
    // Sessão de tema: cartões só daquele tema, misturando os tipos; prefere os que ainda não respondeu.
    const doTema = todos.filter((e) => e.tema_id === opts.temaId && !opts.jaUsados.has(e.id));
    const ordenados = [...doTema].sort((a, b) => Number(recentes.has(a.id)) - Number(recentes.has(b.id)) || hash(`${ctx.userId}${dia}${a.id}`) - hash(`${ctx.userId}${dia}${b.id}`));
    const porTipo = new Map<TipoExercicio, ExRow[]>();
    for (const e of ordenados) (porTipo.get(e.tipo) ?? porTipo.set(e.tipo, []).get(e.tipo)!).push(e);
    while (out.length < opts.total && [...porTipo.values()].some((l) => l.length)) {
      for (const l of porTipo.values()) { const e = l.shift(); if (e && out.length < opts.total) out.push(e); }
    }
    return { ex: out, temas: nomes };
  }

  // (1) Produto, múltipla escolha, do tema com pior nível. Antes dele: a pergunta de checagem de uma
  // mudança importante publicada nos últimos 3 dias que a pessoa ainda não respondeu ocupa o cartão 1.
  const ordemTemas = temasDoMaisFraco(temas, mapa);
  const daMudanca = await exercicioDeMudancaPendente(ctx, todos);
  const mc = daMudanca ?? (() => {
    for (const tid of ordemTemas) { const e = escolhe(todos.filter((x) => x.tipo === "multipla_escolha" && x.tema_id === tid && livre(x)), `mc${tid}`); if (e) return e; }
    return null;
  })();

  // (2) Objeção, escrita: a mais encontrada nos últimos 30 dias em cliente_disse_uso.
  const usoR = await s.from("cliente_disse_uso").select("objecao_id").eq("user_id", ctx.userId).not("objecao_id", "is", null).gte("created_at", desde30);
  const cont = new Map<string, number>();
  for (const r of (usoR.error ? [] : (usoR.data ?? [])) as { objecao_id: string }[]) cont.set(r.objecao_id, (cont.get(r.objecao_id) ?? 0) + 1);
  const objecoesTop = [...cont.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const escritas = todos.filter((e) => e.tipo === "escrita");
  let esc: ExRow | null = null;
  for (const oid of objecoesTop) { esc = escolhe(escritas.filter((e) => e.objecao_id === oid && livre(e)), `esc${oid}`); if (esc) break; }
  if (!esc) {
    const temaObj = temas.find((t) => t.nome === "Objeções")?.id;
    esc = escolhe(escritas.filter((e) => e.tema_id === temaObj && livre(e)), "escobj");
  }

  // (3) Hábito: o mais frequente nos Raio-X dos últimos 30 dias; sem dados, rodízio.
  const raioxR = await s.from("raiox_resultados").select("escrita").eq("user_id", ctx.userId).gte("created_at", desde30);
  const hc = new Map<string, number>();
  for (const r of (raioxR.error ? [] : (raioxR.data ?? [])) as { escrita: unknown }[]) {
    for (const it of Array.isArray(r.escrita) ? (r.escrita as { regra?: string }[]) : []) {
      const k = habitoDaRegra(nomeSeguro(it?.regra));
      if (k) hc.set(k, (hc.get(k) ?? 0) + 1);
    }
  }
  const habitos = todos.filter((e) => e.tipo === "habito");
  let hab: ExRow | null = null;
  for (const [k] of [...hc.entries()].sort((a, b) => b[1] - a[1])) { hab = escolhe(habitos.filter((e) => e.habito_chave === k && livre(e)), `hab${k}`); if (hab) break; }
  if (!hab) {
    const chaves = [...new Set(habitos.filter(livre).map((e) => e.habito_chave ?? ""))].sort();
    if (chaves.length) {
      const k = chaves[Math.floor(Date.now() / 86400_000) % chaves.length];
      hab = escolhe(habitos.filter((e) => (e.habito_chave ?? "") === k && livre(e)), `rod${k}`);
    }
  }

  const base: (ExRow | null)[] = [marca(mc), marca(esc), marca(hab)];
  for (const e of base) if (e) out.push(e);
  // Completa com exercícios da equipe toda (mesmo tipo faltante primeiro); nunca inventa.
  const faltam: TipoExercicio[] = ["multipla_escolha", "escrita", "habito"].filter((_, i) => !base[i]) as TipoExercicio[];
  while (out.length < opts.total) {
    const tipo = faltam.shift();
    const e = escolhe(todos.filter((x) => livre(x) && (!tipo || x.tipo === tipo)), `extra${out.length}`) ?? escolhe(todos.filter(livre), `extra2${out.length}`);
    if (!e) break;
    usados.add(e.id); out.push(e);
  }
  return { ex: out.slice(0, opts.total), temas: nomes };
}

// ---------------------------------------------------------------------------
// Iniciar a sessão
// ---------------------------------------------------------------------------

export const iniciarAquecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tema_id: UUID.nullish() }).parse(d))
  .handler(async ({ data, context }): Promise<SessaoAquecimento> => {
    const s = db(context);
    const cfg = await lerConfig(context);
    const hoje = diaBR(new Date());
    const tipo = data.tema_id ? "tema" : "diaria";

    let sessao: { id: string; status: string } | null = null;
    if (tipo === "diaria") {
      const r = await s.from("aquecimento_sessoes").select("id, status").eq("user_id", context.userId).eq("tipo", "diaria").eq("data", hoje).maybeSingle();
      sessao = r.data ?? null;
    } else {
      const r = await s.from("aquecimento_sessoes").select("id, status").eq("user_id", context.userId).eq("tipo", "tema").eq("tema_id", data.tema_id).eq("data", hoje).eq("status", "aberta").order("iniciada_em", { ascending: false }).limit(1).maybeSingle();
      sessao = r.data ?? null;
    }
    const { statusUso } = await import("@/lib/cerebro.server");
    const uso = await statusUso(context, "aquecimento");
    const limite = { usado: uso.usado, limite: uso.limite };

    if (sessao?.status === "concluida") {
      return { sessao_id: sessao.id, tipo, tema_id: data.tema_id ?? null, cartoes: [], concluida: true, limite, nota_acerto: cfg.nota_acerto };
    }
    if (!sessao) {
      sessao = check(await s.from("aquecimento_sessoes").insert({ user_id: context.userId, tipo, tema_id: data.tema_id ?? null, data: hoje }).select("id, status").single()) as { id: string; status: string };
    }

    // Retoma o que já foi respondido nesta sessão e completa com cartões novos.
    const resp = check(await s.from("aquecimento_respostas").select("exercicio_id, acertou, nota").eq("sessao_id", sessao.id).order("created_at")) as { exercicio_id: string | null; acertou: boolean; nota: number | null }[];
    const idsResp = resp.map((r) => r.exercicio_id).filter(Boolean) as string[];
    const jaRows = idsResp.length ? (check(await s.from("aquecimento_exercicios").select("*").in("id", idsResp)) as ExRow[]) : [];
    const { ex, temas } = await escolherCartoes(context, cfg, { total: Math.max(0, cfg.cartoes_por_dia - jaRows.length), temaId: data.tema_id ?? undefined, jaUsados: new Set(idsResp) });
    const respPor = new Map(resp.map((r) => [r.exercicio_id, r]));
    const cartoes: Cartao[] = [
      ...jaRows.map((e) => { const r = respPor.get(e.id)!; return paraCartao(e, temas.get(e.tema_id) ?? "", context.userId, { acertou: r.acertou, nota: r.nota }); }),
      ...ex.map((e) => paraCartao(e, temas.get(e.tema_id) ?? "", context.userId, null)),
    ];
    return { sessao_id: sessao.id, tipo, tema_id: data.tema_id ?? null, cartoes, concluida: false, limite, nota_acerto: cfg.nota_acerto };
  });

// ---------------------------------------------------------------------------
// Responder
// ---------------------------------------------------------------------------

async function abrirSessaoEExercicio(ctx: Ctx, sessaoId: string, exercicioId: string) {
  const s = db(ctx);
  const [ses, ex, ja] = await Promise.all([
    s.from("aquecimento_sessoes").select("id, status, user_id").eq("id", sessaoId).eq("user_id", ctx.userId).maybeSingle(),
    s.from("aquecimento_exercicios").select("*").eq("id", exercicioId).eq("status", "aprovado").maybeSingle(),
    s.from("aquecimento_respostas").select("id", { count: "exact", head: true }).eq("sessao_id", sessaoId).eq("exercicio_id", exercicioId),
  ]);
  if (!ses.data || ses.data.status !== "aberta") throw new Error("Esta sessão já foi encerrada.");
  if (!ex.data) throw new Error("Este exercício não está mais disponível.");
  if ((ja.count ?? 0) > 0) throw new Error("Este cartão já foi respondido.");
  return ex.data as ExRow;
}

async function gravarResposta(ctx: Ctx, sessaoId: string, e: ExRow, acertou: boolean, nota: number | null) {
  check(await db(ctx).from("aquecimento_respostas").insert({
    sessao_id: sessaoId, user_id: ctx.userId, exercicio_id: e.id, tema_id: e.tema_id, tipo: e.tipo, acertou, nota,
  }));
}

export const responderMultipla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessao_id: UUID, exercicio_id: UUID, indice: z.number().int().min(0).max(9) }).parse(d))
  .handler(async ({ data, context }): Promise<ResultadoCartao> => {
    const e = await abrirSessaoEExercicio(context, data.sessao_id, data.exercicio_id);
    if (e.tipo !== "multipla_escolha") throw new Error("Este cartão não é de múltipla escolha.");
    const alt = e.alternativas[data.indice];
    if (!alt) throw new Error("Alternativa inválida.");
    const acertou = !!alt.correta;
    await gravarResposta(context, data.sessao_id, e, acertou, null);
    return { acertou, nota: null, correta_i: e.alternativas.findIndex((a) => a.correta), explicacao: e.explicacao, fonte: e.fonte };
  });

export const responderTexto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessao_id: UUID, exercicio_id: UUID, texto: z.string().trim().min(1, "Escreva a sua resposta.").max(1500) }).parse(d))
  .handler(async ({ data, context }): Promise<ResultadoCartao & { limite: { usado: number; limite: number | null } }> => {
    const e = await abrirSessaoEExercicio(context, data.sessao_id, data.exercicio_id);
    if (e.tipo === "multipla_escolha") throw new Error("Este cartão é de múltipla escolha.");
    const cfg = await lerConfig(context);
    const { statusUso, registrarUso } = await import("@/lib/cerebro.server");
    const antes = await statusUso(context, "aquecimento");
    const texto = removerDadosPessoais(data.texto);

    // Hábito mecânico: corrigido em código, sem IA.
    if (e.tipo === "habito" && ehHabitoMecanico(e.habito_chave)) {
      const problemas = conferirPadraoEscrita(texto);
      const acertou = problemas.length === 0;
      await gravarResposta(context, data.sessao_id, e, acertou, null);
      return {
        acertou, nota: null,
        texto: acertou ? `Você manteve a regra: ${HABITOS[e.habito_chave].regra}` : problemas.map((p) => p.texto).join(" "),
        resposta_aprovada: e.resposta_aprovada, explicacao: e.explicacao,
        limite: { usado: antes.usado, limite: antes.limite },
      };
    }

    // Objeção escrita e hábito subjetivo: IA, com limite diário.
    if (antes.bloqueado) throw new Error(msgLimiteCorrecoes(antes.limite));
    const { corrigirComIA } = await import("@/lib/aquecimento.server");
    const r = await corrigirComIA({ fala_cliente: e.contexto, resposta_aprovada: e.resposta_aprovada, criterio: e.explicacao, texto });
    if (!r) throw new Error(MSG_SEM_CORRECAO);
    await registrarUso(context, "aquecimento");
    const acertou = r.nota >= cfg.nota_acerto;
    await gravarResposta(context, data.sessao_id, e, acertou, r.nota);
    return { acertou, nota: r.nota, texto: r.frase, resposta_aprovada: e.resposta_aprovada, explicacao: e.explicacao, limite: { usado: antes.usado + 1, limite: antes.limite } };
  });

// ---------------------------------------------------------------------------
// Concluir
// ---------------------------------------------------------------------------

export const concluirAquecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessao_id: UUID }).parse(d))
  .handler(async ({ data, context }): Promise<ResumoSessao & { concluida: boolean }> => {
    const s = db(context);
    const cfg = await lerConfig(context);
    const ses = check(await s.from("aquecimento_sessoes").select("id, tipo, status, iniciada_em, user_id").eq("id", data.sessao_id).eq("user_id", context.userId).maybeSingle()) as
      { id: string; tipo: string; status: string; iniciada_em: string } | null;
    if (!ses) throw new Error("Sessão não encontrada.");
    const resp = check(await s.from("aquecimento_respostas").select("exercicio_id, tema_id, tipo, acertou, nota").eq("sessao_id", ses.id)) as
      { exercicio_id: string | null; tema_id: string | null; tipo: TipoExercicio; acertou: boolean; nota: number | null }[];

    // Sessão sem nenhuma resposta (só pulou) não conta como concluída.
    let concluida = ses.status === "concluida";
    if (!concluida && resp.length > 0) {
      check(await s.from("aquecimento_sessoes").update({ status: "concluida", concluida_em: new Date().toISOString() }).eq("id", ses.id).eq("user_id", context.userId));
      concluida = true;
    }

    // Mudança de nível: com e sem as respostas desta sessão.
    const desde = new Date(Date.now() - cfg.janela_dominio_dias * 86400_000).toISOString();
    const todas = check(await s.from("aquecimento_respostas").select("sessao_id, tema_id, acertou").eq("user_id", context.userId).gte("created_at", desde)) as { sessao_id: string; tema_id: string | null; acertou: boolean }[];
    const temas = check(await s.from("dominio_temas").select("id, nome").eq("ativo", true)) as { id: string; nome: string }[];
    const nome = new Map(temas.map((t) => [t.id, t.nome]));
    const nivelDe = (tid: string, sem: boolean): Nivel => {
      const rs = todas.filter((r) => r.tema_id === tid && !(sem && r.sessao_id === ses.id));
      return calcularNivel(rs.length, rs.filter((r) => r.acertou).length, cfg);
    };
    const mudancas: MudancaNivel[] = [];
    for (const tid of new Set(resp.map((r) => r.tema_id).filter((t): t is string => !!t && nome.has(t)))) {
      const de = nivelDe(tid, true); const para = nivelDe(tid, false);
      if (de !== para && NIVEL_ORDEM[para] > NIVEL_ORDEM[de]) mudancas.push({ tema_id: tid, tema_nome: nome.get(tid)!, de, para });
    }

    // Foi mal em objeção (nota abaixo da nota de acerto): sugere o perfil mais parecido no Simulador.
    let simulador: ResumoSessao["simulador"] = null;
    const ruim = resp.find((r) => r.tipo === "escrita" && r.nota != null && r.nota < cfg.nota_acerto && r.exercicio_id);
    if (ruim) {
      const ex = check(await s.from("aquecimento_exercicios").select("titulo, contexto").eq("id", ruim.exercicio_id).maybeSingle()) as { titulo: string; contexto: string } | null;
      const alvo = `${ex?.titulo ?? ""} ${ex?.contexto ?? ""}`;
      const perfis = ((await s.from("client_profiles").select("id, name, personality, objections").limit(60)).data ?? []) as { id: string; name: string; personality: string | null; objections: string | null }[];
      const tokens = (t: string) => new Set(t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
      const a = tokens(alvo);
      const melhor = perfis.map((p) => ({ p, n: [...tokens(`${p.objections ?? ""} ${p.personality ?? ""}`)].filter((w) => a.has(w)).length })).sort((x, y) => y.n - x.n)[0];
      simulador = {
        objecao: ex?.titulo || "esta objeção",
        perfil: melhor && melhor.n > 0 ? { id: melhor.p.id, nome: melhor.p.name, descricao: (melhor.p.personality ?? "").slice(0, 120) } : null,
      };
    }

    const minutos = Math.max(1, Math.min(60, Math.round((Date.now() - new Date(ses.iniciada_em).getTime()) / 60000)));
    return { concluida, minutos, dias_semana: await diasNaSemana(context), mudancas, simulador };
  });
