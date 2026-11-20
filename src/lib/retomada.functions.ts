import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import { removerDadosPessoais, toCaso, type Caso } from "@/lib/cliente-disse";
import {
  ETAPAS_RETOMADA, PAPEIS, CANAIS, PONTOS, PONTOS_CADENCIA, QUANDO,
  agendarInicial, agendarProxima, diaBR, inicioDiaBR, somarDias,
  toCadenciaMensagem, toRetomada,
  type CadenciaMensagem, type EtapaRetomada, type Retomada,
} from "@/lib/retomada";

// "Retomar hoje" — funções de servidor da página /retomar, do aviso de follow-up,
// do relatório Excel e das seções do Painel Admin (Cadência, Motivos de perda).
//
// Telefone: a tabela `retomadas` só é legível pelo dono (RLS). O Admin lê os tickets
// pela view `retomadas_admin`, que não tem a coluna. Nenhuma função de Admin abaixo
// seleciona `telefone`, e o relatório nunca o inclui.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const UUID = z.string().uuid();
const PontoZ = z.enum(PONTOS);
const EtapaZ = z.enum(ETAPAS_RETOMADA);

/** Colunas de `retomadas` que o servidor devolve a quem não pode ver o telefone. */
const COLS_SEM_TELEFONE =
  "id, codigo, user_id, primeiro_nome, observacao, ponto_parada, ponto_parada_inicial, subetapa_fechamento, fechamento_caso_id, origem, status, etapa_atual, proxima_em, d10_enviado_em, motivo_perda, vezes_voltou, created_at, updated_at";

async function nomeDoAtendente(ctx: Ctx): Promise<string> {
  const { data } = await db(ctx).from("profiles").select("display_name, email").eq("id", ctx.userId).maybeSingle();
  const n = (data?.display_name as string | null)?.trim() || String(data?.email ?? "").split("@")[0] || "";
  return n.split(/\s+/)[0] ?? "";
}

// ---------------------------------------------------------------------------
// /retomar: dados da página
// ---------------------------------------------------------------------------

export interface RetomadaBase {
  atendente: string;
  retomadas: Retomada[];
  casos: Record<string, Caso>;
  mensagens: CadenciaMensagem[];
  motivos: { id: string; nome: string }[];
  /** Quantos "Enviei" cada ticket teve hoje (para "Feitos hoje"). */
  enviadosHoje: { retomada_id: string; etapa: EtapaRetomada; em: string }[];
}

export const getRetomadaBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RetomadaBase> => {
    const s = db(context);
    // Esfria quem já passou 2 dias do D+10 e apaga telefones com mais de 30 dias.
    await s.rpc("limpar_retomadas").then(() => undefined, () => undefined);
    const inicioHoje = inicioDiaBR(diaBR(new Date())).toISOString();
    const [ret, msgs, mot, ev, atendente] = await Promise.all([
      s.from("retomadas").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1000),
      s.from("cadencia_mensagens").select("*").eq("status", "publicada"),
      s.from("motivos_perda").select("id, nome").eq("ativo", true).order("ordem"),
      s.from("retomada_eventos").select("retomada_id, etapa, created_at").eq("user_id", context.userId).eq("acao", "enviei").gte("created_at", inicioHoje),
      nomeDoAtendente(context),
    ]);
    const retomadas = ((check(ret) ?? []) as Record<string, unknown>[]).map(toRetomada);
    const casoIds = [...new Set(retomadas.map((r) => r.fechamento_caso_id).filter(Boolean))] as string[];
    const casos: Record<string, Caso> = {};
    if (casoIds.length) {
      const rows = check(await s.from("fechamento_casos").select("*").eq("user_id", context.userId).in("id", casoIds)) ?? [];
      for (const c of rows as Record<string, unknown>[]) casos[String(c.id)] = toCaso(c);
    }
    return {
      atendente,
      retomadas,
      casos,
      mensagens: ((check(msgs) ?? []) as Record<string, unknown>[]).map(toCadenciaMensagem),
      motivos: (check(mot) ?? []) as { id: string; nome: string }[],
      enviadosHoje: ((check(ev) ?? []) as { retomada_id: string; etapa: EtapaRetomada; created_at: string }[]).map((e) => ({ retomada_id: e.retomada_id, etapa: e.etapa, em: e.created_at })),
    };
  });

/** Leve: o que o menu, a Início e o aviso de follow-up precisam (a cada minuto). */
export const getRetomadaContagem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const agora = new Date();
    const fimHoje = inicioDiaBR(somarDias(diaBR(agora), 1)).toISOString();
    const rows = check(
      await db(context).from("retomadas").select("id, primeiro_nome, etapa_atual, proxima_em")
        .eq("user_id", context.userId).eq("status", "fila").lt("proxima_em", fimHoje),
    ) as { id: string; primeiro_nome: string; etapa_atual: EtapaRetomada; proxima_em: string }[];
    const followUps = rows.filter((r) => r.etapa_atual === "follow_up" && new Date(r.proxima_em) <= agora);
    // Follow-ups de hoje que ainda não deram a hora não entram na contagem.
    const total = rows.filter((r) => r.etapa_atual !== "follow_up" || new Date(r.proxima_em) <= agora).length;
    return { total, followUps: followUps.map((r) => ({ id: r.id, nome: r.primeiro_nome, em: r.proxima_em })) };
  });

// ---------------------------------------------------------------------------
// Criar tickets
// ---------------------------------------------------------------------------

const NovaRetomada = z.object({
  primeiro_nome: z.string().trim().min(1).max(80).transform((v) => removerDadosPessoais(v.split(/\s+/)[0] ?? "").slice(0, 40)),
  telefone: z.string().max(30).nullish().transform((v) => { const d = (v ?? "").replace(/\D/g, ""); return d.length >= 10 && d.length <= 13 ? d : null; }),
  observacao: z.string().max(500).default("").transform((v) => removerDadosPessoais(v).trim()),
  ponto_parada: PontoZ,
  quando: z.enum(QUANDO.map((q) => q.id) as [string, ...string[]]).default("amanha"),
});

async function inserirRetomada(
  ctx: Ctx,
  d: z.infer<typeof NovaRetomada>,
  extra: { origem: "manual" | "fechamento" | "extensao"; subetapa_fechamento?: string | null; fechamento_caso_id?: string | null },
): Promise<Retomada> {
  const s = db(ctx);
  const ag = agendarInicial(d.quando as never);
  const row = check(await s.from("retomadas").insert({
    user_id: ctx.userId,
    primeiro_nome: d.primeiro_nome,
    telefone: d.telefone,
    observacao: d.observacao,
    ponto_parada: d.ponto_parada,
    ponto_parada_inicial: d.ponto_parada,
    subetapa_fechamento: extra.subetapa_fechamento ?? null,
    fechamento_caso_id: extra.fechamento_caso_id ?? null,
    origem: extra.origem,
    status: "fila",
    etapa_atual: ag.etapa,
    proxima_em: ag.em.toISOString(),
  }).select("*").single()) as Record<string, unknown>;
  if (ag.etapa === "follow_up") {
    await s.from("retomada_eventos").insert({
      retomada_id: row.id, user_id: ctx.userId, ponto_parada: d.ponto_parada, etapa: "follow_up",
      acao: "follow_up_agendado", prevista_em: ag.em.toISOString(), detalhe: String(d.quando),
    });
  }
  return toRetomada(row);
}

export const criarRetomada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NovaRetomada.parse(d))
  .handler(async ({ data, context }) => inserirRetomada(context, data, { origem: "manual" }));

/** "Retomar depois" de "Fechar com este cliente": cria o ticket (origem fechamento) e marca o caso. */
export const criarRetomadaDeCaso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ caso_id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const s = db(context);
    const caso = toCaso(check(await s.from("fechamento_casos").select("*").eq("id", data.caso_id).eq("user_id", context.userId).single()) as Record<string, unknown>);
    // Já existe ticket na fila para este caso? Não duplica.
    const existente = check(await s.from("retomadas").select("*").eq("fechamento_caso_id", caso.id).eq("user_id", context.userId).in("status", ["fila", "respondeu"]).limit(1)) as Record<string, unknown>[];
    if (existente[0]) return toRetomada(existente[0]);
    const r = await inserirRetomada(
      context,
      { primeiro_nome: caso.primeiro_nome || "Cliente", telefone: null, observacao: "", ponto_parada: "travou_fechamento", quando: "amanha" },
      { origem: "fechamento", subetapa_fechamento: caso.etapa, fechamento_caso_id: caso.id },
    );
    check(await s.from("fechamento_casos").update({ retomar_em: diaBR(r.proxima_em ?? new Date()) }).eq("id", caso.id).eq("user_id", context.userId));
    return r;
  });

/** Entrada para a futura extensão do Chrome (sem interface agora). Cria o ticket com origem "extensao". */
export const criarRetomadaExterna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    nome: z.string().trim().min(1).max(80),
    telefone: z.string().max(30).nullish(),
    observacao: z.string().max(500).optional(),
    ponto_parada_sugerido: PontoZ.default("nao_respondeu_primeira"),
    quando: z.enum(QUANDO.map((q) => q.id) as [string, ...string[]]).default("amanha"),
  }).parse(d))
  .handler(async ({ data, context }) =>
    inserirRetomada(
      context,
      NovaRetomada.parse({
        primeiro_nome: data.nome, telefone: data.telefone ?? null, observacao: data.observacao ?? "",
        ponto_parada: data.ponto_parada_sugerido, quando: data.quando,
      }),
      { origem: "extensao" },
    ),
  );

// ---------------------------------------------------------------------------
// Ações do atendente
// ---------------------------------------------------------------------------

function slotMensagem(r: Pick<Retomada, "ponto_parada" | "etapa_atual">) {
  return { ponto: r.etapa_atual === "follow_up" ? "follow_up" : r.ponto_parada, etapa: r.etapa_atual };
}

async function carregar(ctx: Ctx, id: string): Promise<Retomada> {
  return toRetomada(check(await db(ctx).from("retomadas").select("*").eq("id", id).eq("user_id", ctx.userId).single()) as Record<string, unknown>);
}
async function mensagemDoSlot(ctx: Ctx, r: Retomada) {
  const sl = slotMensagem(r);
  const { data } = await db(ctx).from("cadencia_mensagens").select("id, versao").eq("ponto_parada", sl.ponto).eq("etapa", sl.etapa).eq("status", "publicada").maybeSingle();
  return (data ?? null) as { id: string; versao: number } | null;
}

/** Eventos do ticket na etapa atual desde a última ação de avanço (para dedupe e usou_recomendada). */
async function eventosDaEtapa(ctx: Ctx, r: Retomada) {
  const evs = (check(await db(ctx).from("retomada_eventos").select("acao, etapa, created_at").eq("retomada_id", r.id).order("created_at", { ascending: false }).limit(60)) ?? []) as { acao: string; etapa: string; created_at: string }[];
  const corte = evs.find((e) => ["enviei", "voltou_fila"].includes(e.acao))?.created_at ?? "";
  return evs.filter((e) => e.created_at > corte && e.etapa === r.etapa_atual);
}

/** Registra que a Omnia recomendou a mensagem da etapa (uma vez por etapa) — chamada ao abrir o ticket. */
export const registrarRecomendada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await carregar(context, data.id);
    if (r.status !== "fila") return { ok: true };
    if ((await eventosDaEtapa(context, r)).some((e) => e.acao === "recomendada")) return { ok: true };
    const m = await mensagemDoSlot(context, r);
    check(await db(context).from("retomada_eventos").insert({
      retomada_id: r.id, user_id: context.userId, ponto_parada: r.ponto_parada, etapa: r.etapa_atual,
      acao: "recomendada", mensagem_id: m?.id ?? null, mensagem_versao: m?.versao ?? null, prevista_em: r.proxima_em,
    }));
    return { ok: true };
  });

/** "Copiar" na mensagem da etapa. */
export const registrarCopiouRetomada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await carregar(context, data.id);
    const m = await mensagemDoSlot(context, r);
    check(await db(context).from("retomada_eventos").insert({
      retomada_id: r.id, user_id: context.userId, ponto_parada: r.ponto_parada, etapa: r.etapa_atual,
      acao: "copiou", mensagem_id: m?.id ?? null, mensagem_versao: m?.versao ?? null, prevista_em: r.proxima_em,
    }));
    return { ok: true };
  });

/** Etapa da última mensagem enviada no ciclo atual (respostas, fechamentos e perdas contam nela). */
async function etapaDoUltimoEnvio(ctx: Ctx, r: Retomada): Promise<EtapaRetomada> {
  const evs = (check(await db(ctx).from("retomada_eventos").select("acao, etapa, created_at").eq("retomada_id", r.id).in("acao", ["enviei", "voltou_fila"]).order("created_at", { ascending: false }).limit(10)) ?? []) as { acao: string; etapa: EtapaRetomada }[];
  const ultimo = evs[0];
  return ultimo && ultimo.acao === "enviei" ? ultimo.etapa : r.etapa_atual;
}

const AcaoInput = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("enviei"), id: UUID }),
  z.object({ acao: z.literal("respondeu"), id: UUID }),
  z.object({ acao: z.literal("fechou"), id: UUID }),
  z.object({ acao: z.literal("perdido"), id: UUID, motivo: z.string().trim().min(1).max(120) }),
  z.object({ acao: z.literal("voltar_fila"), id: UUID, ponto_parada: PontoZ }),
]);

export type AcaoInputT = z.infer<typeof AcaoInput>;

export const acaoRetomada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AcaoInput.parse(d))
  .handler(async ({ data, context }): Promise<Retomada> => {
    const s = db(context);
    const r = await carregar(context, data.id);
    const base = { retomada_id: r.id, user_id: context.userId, ponto_parada: r.ponto_parada, etapa: r.etapa_atual, prevista_em: r.proxima_em };
    const agora = new Date();
    let patch: Record<string, unknown> = {};
    let evento: Record<string, unknown> = {};

    if (data.acao === "enviei") {
      if (r.status !== "fila") throw new Error("Este cliente não está na fila.");
      const m = await mensagemDoSlot(context, r);
      const usou = (await eventosDaEtapa(context, r)).some((e) => e.acao === "copiou");
      evento = { ...base, acao: "enviei", mensagem_id: m?.id ?? null, mensagem_versao: m?.versao ?? null, usou_recomendada: usou };
      const prox = agendarProxima(r.etapa_atual, agora);
      patch = prox
        ? { etapa_atual: prox.etapa, proxima_em: prox.em.toISOString() }
        // D+10 enviado: sem resposta em 2 dias o ticket esfria sozinho.
        : { proxima_em: null, d10_enviado_em: agora.toISOString() };
    } else if (data.acao === "respondeu") {
      evento = { ...base, etapa: await etapaDoUltimoEnvio(context, r), acao: "respondeu" };
      patch = { status: "respondeu", proxima_em: null };
    } else if (data.acao === "fechou") {
      evento = { ...base, etapa: await etapaDoUltimoEnvio(context, r), acao: "fechou" };
      patch = { status: "fechou", proxima_em: null };
    } else if (data.acao === "perdido") {
      evento = { ...base, etapa: await etapaDoUltimoEnvio(context, r), acao: "perdido", detalhe: data.motivo };
      patch = { status: "perdido", proxima_em: null, motivo_perda: data.motivo };
    } else {
      const prox = agendarProxima("follow_up", agora)!; // recomeça no D+1, amanhã
      evento = { ...base, ponto_parada: data.ponto_parada, etapa: "d1", acao: "voltou_fila", detalhe: data.ponto_parada };
      patch = {
        status: "fila", ponto_parada: data.ponto_parada, etapa_atual: "d1", proxima_em: prox.em.toISOString(),
        d10_enviado_em: null, motivo_perda: null, vezes_voltou: r.vezes_voltou + 1,
      };
    }

    const novo = check(await s.from("retomadas").update(patch).eq("id", r.id).eq("user_id", context.userId).select("*").single()) as Record<string, unknown>;
    check(await s.from("retomada_eventos").insert(evento));
    return toRetomada(novo);
  });

// ---------------------------------------------------------------------------
// Admin: Cadência de retomada
// ---------------------------------------------------------------------------

export const adminListCadencia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const rows = check(await db(context).from("cadencia_mensagens").select("*")) ?? [];
    return (rows as Record<string, unknown>[]).map(toCadenciaMensagem);
  });

const CadenciaInput = z.object({
  id: UUID,
  canal: z.enum(CANAIS),
  papel: z.enum(PAPEIS),
  texto: z.string().max(4000),
  por_que: z.string().max(600),
  audio_exemplo_url: z.string().max(300).nullable(),
  status: z.enum(["rascunho", "publicada"]),
});

/** Salvar. Publicar uma mensagem já publicada e alterada gera nova versão (gatilho no banco). */
export const adminSalvarCadencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CadenciaInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { id, ...rest } = data;
    const row = check(await db(context).from("cadencia_mensagens").update(rest).eq("id", id).select("*").single());
    return toCadenciaMensagem(row as Record<string, unknown>);
  });

export const adminCriarCadencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ponto_parada: z.enum(PONTOS_CADENCIA as unknown as [string, ...string[]]), etapa: EtapaZ }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const row = check(await db(context).from("cadencia_mensagens").insert({ ...data, texto: "[escrever]" }).select("*").single());
    return toCadenciaMensagem(row as Record<string, unknown>);
  });

// ---------------------------------------------------------------------------
// Admin: motivos de perda
// ---------------------------------------------------------------------------

export const adminListMotivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const [m, usos] = await Promise.all([
      db(context).from("motivos_perda").select("*").order("ordem"),
      db(context).from("retomadas_admin").select("motivo_perda").eq("status", "perdido"),
    ]);
    const uso: Record<string, number> = {};
    for (const r of (usos.data ?? []) as { motivo_perda: string | null }[]) if (r.motivo_perda) uso[r.motivo_perda] = (uso[r.motivo_perda] ?? 0) + 1;
    return ((check(m) ?? []) as { id: string; nome: string; ordem: number; ativo: boolean }[]).map((x) => ({ ...x, usos: uso[x.nome] ?? 0 }));
  });

export const upsertMotivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: UUID.optional(), nome: z.string().trim().min(1).max(80), ordem: z.coerce.number().int().default(100), ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { id, ...rest } = data;
    check(id ? await db(context).from("motivos_perda").update(rest).eq("id", id) : await db(context).from("motivos_perda").insert(rest));
    return { ok: true };
  });

export const deleteMotivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    check(await db(context).from("motivos_perda").delete().eq("id", data.id));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin: equipe nos últimos 7 dias (só números)
// ---------------------------------------------------------------------------

export interface LinhaEquipe {
  user_id: string;
  atendente: string;
  na_fila: number;
  atrasados: number;
  enviadas: number;
  no_dia: number;
  responderam: number;
  fecharam: number;
  perdidos: number;
}
export interface EquipeResumo {
  naFila: number;
  pctNoDia: number | null;
  responderam: number;
  fecharam: number;
  perdidos: number;
  primeiroMotivo: string | null;
  porAtendente: LinhaEquipe[];
}

export const adminEquipe7Dias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EquipeResumo> => {
    await requireAdmin(context);
    const s = db(context);
    const desde = new Date(Date.now() - 7 * 86400_000).toISOString();
    const hoje = diaBR(new Date());
    const [fila, ev, perd] = await Promise.all([
      s.from("retomadas_admin").select("user_id, atendente, proxima_em").eq("status", "fila"),
      s.from("retomada_eventos").select("user_id, acao, prevista_em, created_at").gte("created_at", desde).in("acao", ["enviei", "respondeu", "fechou", "perdido"]),
      s.from("retomadas_admin").select("motivo_perda").eq("status", "perdido").gte("updated_at", desde),
    ]);
    const nomes = new Map<string, string>();
    const linhas = new Map<string, LinhaEquipe>();
    const linha = (uid: string): LinhaEquipe => {
      let l = linhas.get(uid);
      if (!l) { l = { user_id: uid, atendente: nomes.get(uid) ?? "—", na_fila: 0, atrasados: 0, enviadas: 0, no_dia: 0, responderam: 0, fecharam: 0, perdidos: 0 }; linhas.set(uid, l); }
      return l;
    };
    for (const r of (check(fila) ?? []) as { user_id: string; atendente: string; proxima_em: string | null }[]) {
      nomes.set(r.user_id, r.atendente);
      const l = linha(r.user_id);
      l.atendente = r.atendente;
      l.na_fila++;
      if (r.proxima_em && diaBR(r.proxima_em) < somarDias(hoje, -1)) l.atrasados++;
    }
    const evs = (check(ev) ?? []) as { user_id: string; acao: string; prevista_em: string | null; created_at: string }[];
    const faltam = [...new Set(evs.map((e) => e.user_id).filter((u) => !nomes.has(u)))];
    if (faltam.length) {
      const { data } = await s.from("profiles").select("id, display_name, email").in("id", faltam);
      for (const p of (data ?? []) as { id: string; display_name: string | null; email: string }[]) nomes.set(p.id, p.display_name?.trim() || p.email.split("@")[0]);
    }
    let enviadas = 0, noDia = 0, resp = 0, fech = 0, perdidos = 0;
    for (const e of evs) {
      const l = linha(e.user_id);
      l.atendente = nomes.get(e.user_id) ?? l.atendente;
      if (e.acao === "enviei") {
        enviadas++; l.enviadas++;
        if (e.prevista_em && diaBR(e.created_at) <= diaBR(e.prevista_em)) { noDia++; l.no_dia++; }
      } else if (e.acao === "respondeu") { resp++; l.responderam++; }
      else if (e.acao === "fechou") { fech++; l.fecharam++; }
      else if (e.acao === "perdido") { perdidos++; l.perdidos++; }
    }
    const motivos: Record<string, number> = {};
    for (const r of (check(perd) ?? []) as { motivo_perda: string | null }[]) if (r.motivo_perda) motivos[r.motivo_perda] = (motivos[r.motivo_perda] ?? 0) + 1;
    const primeiroMotivo = Object.entries(motivos).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      naFila: [...linhas.values()].reduce((a, l) => a + l.na_fila, 0),
      pctNoDia: enviadas ? Math.round((noDia / enviadas) * 100) : null,
      responderam: resp, fecharam: fech, perdidos, primeiroMotivo,
      porAtendente: [...linhas.values()].sort((a, b) => a.atendente.localeCompare(b.atendente, "pt-BR")),
    };
  });

/** Quantos atendentes têm retomadas atrasadas há mais de 1 dia ("O que precisa de você"). */
export async function contarAtendentesAtrasados(supabase: unknown): Promise<{ atendentes: number; tickets: number }> {
  const corte = inicioDiaBR(somarDias(diaBR(new Date()), -1)).toISOString();
  const { data, error } = await (supabase as any).from("retomadas_admin").select("user_id").eq("status", "fila").lt("proxima_em", corte);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { user_id: string }[];
  return { atendentes: new Set(rows.map((r) => r.user_id)).size, tickets: rows.length };
}

// ---------------------------------------------------------------------------
// Relatório Excel: dados brutos (o arquivo é montado no navegador)
// ---------------------------------------------------------------------------

type Linha = Record<string, string | number | boolean | null>;

export interface DadosRelatorio {
  de: string;
  ate: string;
  escopo: "atendente" | "equipe";
  exportadoPor: string;
  exportadoEm: string;
  tickets: Linha[];
  eventos: Linha[];
  mensagens: Linha[];
  versoes: Linha[];
  objecoes: { data_hora: string; atendente: string; objecao: string; angulo_copiado: string; objecao_nova: boolean }[];
  atendentes: Record<string, string>;
  /** Só no arquivo da equipe (Admin): o que aconteceu depois de cada versão enviada. Vazio no arquivo do atendente. */
  desempenho: { mensagem_id: string; versao: number; enviadas: number; responderam: number; fecharam: number; selo: string }[];
  /** Fichas de "Conversas que fecharam": as publicadas e, no arquivo do atendente, as dele. */
  biblioteca: {
    id: string; autor: string; status: string; objecao: string; ponto_parada: string; plano: string; perfil: string;
    onde_travou: string; o_que_fez: string[]; mensagem_chave: string; dias_ate_fechar: number | null; util: number; nao_util: number;
  }[];
}

/** Atendente: só os próprios tickets. Admin: todos, com filtro opcional de atendente. */
export const getDadosRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    atendente_id: UUID.nullish(),
    equipe: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }): Promise<DadosRelatorio> => {
    const s = db(context);
    const ehAdmin = await isAdminUser(context.supabase, context.userId);
    const equipe = data.equipe && ehAdmin;
    const filtroUser = equipe ? (data.atendente_id ?? null) : context.userId;
    const ini = inicioDiaBR(data.de).toISOString();
    const fim = inicioDiaBR(somarDias(data.ate, 1)).toISOString();

    // Telefone NUNCA é selecionado: o Admin lê pela view e o atendente pela lista de colunas.
    const tabela = equipe ? "retomadas_admin" : "retomadas";
    const colsTickets = equipe ? "*" : COLS_SEM_TELEFONE;
    let qEv = s.from("retomada_eventos").select("id, retomada_id, user_id, ponto_parada, etapa, acao, mensagem_id, mensagem_versao, usou_recomendada, prevista_em, detalhe, created_at").gte("created_at", ini).lt("created_at", fim).order("created_at");
    let qTk = s.from(tabela).select(colsTickets).gte("created_at", ini).lt("created_at", fim);
    let qUso = s.from("cliente_disse_uso").select("user_id, objecao_id, angulo, created_at").not("objecao_id", "is", null).gte("created_at", ini).lt("created_at", fim).order("created_at");
    if (filtroUser) { qEv = qEv.eq("user_id", filtroUser); qTk = qTk.eq("user_id", filtroUser); qUso = qUso.eq("user_id", filtroUser); }
    const [ev, tk, uso] = await Promise.all([qEv, qTk, qUso]);
    const eventos = (check(ev) ?? []) as Linha[];
    const tickets = (check(tk) ?? []) as Linha[];

    // Tickets criados antes do período, mas com ação dentro dele.
    const tem = new Set(tickets.map((t) => String(t.id)));
    const faltam = [...new Set(eventos.map((e) => String(e.retomada_id)).filter((id) => !tem.has(id)))];
    for (let i = 0; i < faltam.length; i += 200) {
      const rows = check(await s.from(tabela).select(colsTickets).in("id", faltam.slice(i, i + 200))) ?? [];
      tickets.push(...(rows as Linha[]));
    }

    const ids = [...new Set([...tickets.map((t) => String(t.user_id)), ...eventos.map((e) => String(e.user_id)), ...(((uso.data ?? []) as { user_id: string }[]).map((u) => u.user_id))])];
    const atendentes: Record<string, string> = {};
    if (ids.length) {
      const { data: perfis } = await s.from("profiles").select("id, display_name, email").in("id", ids);
      for (const p of (perfis ?? []) as { id: string; display_name: string | null; email: string }[]) atendentes[p.id] = p.display_name?.trim() || p.email.split("@")[0];
    }

    // Catálogo: versão atual + versões antigas que aparecem nos eventos do período.
    const msgIds = [...new Set(eventos.map((e) => e.mensagem_id).filter(Boolean))] as string[];
    const [mAtual, mVers] = msgIds.length
      ? await Promise.all([
          s.from("cadencia_mensagens").select("*").in("id", msgIds),
          s.from("cadencia_mensagens_versoes").select("*").in("mensagem_id", msgIds),
        ])
      : [{ data: [] }, { data: [] }];

    // Objeções copiadas (sem a fala do cliente).
    const usos = (uso.data ?? []) as { user_id: string; objecao_id: string; angulo: string | null; created_at: string }[];
    const objIds = [...new Set(usos.map((u) => u.objecao_id))];
    const nomeObj = new Map<string, string>();
    const vieramDaFila = new Set<string>();
    if (objIds.length) {
      const [o, pend] = await Promise.all([
        s.from("objecoes").select("id, nome").in("id", objIds),
        equipe ? s.from("objecoes_pendentes").select("objecao_id").in("objecao_id", objIds) : Promise.resolve({ data: [] }),
      ]);
      for (const r of (o.data ?? []) as { id: string; nome: string }[]) nomeObj.set(r.id, r.nome);
      for (const r of (pend.data ?? []) as { objecao_id: string | null }[]) if (r.objecao_id) vieramDaFila.add(r.objecao_id);
    }

    // Mensagens que vendem (só equipe): desde a data inicial até agora, na equipe toda.
    // Se as funções do banco ainda não existem, as colunas ficam vazias.
    let desempenho: DadosRelatorio["desempenho"] = [];
    if (equipe) {
      try {
        const dias = Math.max(1, Math.ceil((Date.now() - new Date(ini).getTime()) / 86400_000));
        const [rd, cfg] = await Promise.all([
          s.rpc("mensagens_desempenho", { p_dias: dias }),
          s.from("config_mensagens_vendem").select("min_envios").eq("id", 1).maybeSingle(),
        ]);
        const minEnvios = Number(cfg.data?.min_envios ?? 10);
        if (!rd.error) {
          desempenho = ((rd.data ?? []) as Record<string, unknown>[])
            .filter((r) => r.origem === "cadencia")
            .map((r) => ({
              mensagem_id: String(r.mensagem_id), versao: Number(r.versao), enviadas: Number(r.enviadas),
              responderam: Number(r.responderam), fecharam: Number(r.fecharam),
              selo: Number(r.enviadas) < minEnvios ? "poucos_envios" : r.selo ? String(r.selo) : "",
            }));
        }
      } catch { desempenho = []; }
    }

    // Biblioteca: fichas (sem conversa, sem nome, sem telefone) e os votos de "Isso ajudou".
    let biblioteca: DadosRelatorio["biblioteca"] = [];
    try {
      let qf = s.from("conversas_fichas").select("*").order("created_at", { ascending: false }).limit(2000);
      qf = equipe ? qf.eq("status", "publicada") : qf.or(`status.eq.publicada,autor_id.eq.${context.userId}`);
      const fichas = (check(await qf) ?? []) as Record<string, unknown>[];
      if (fichas.length) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const adm = supabaseAdmin as any;
        const fids = fichas.map((f) => String(f.id));
        const autorIds = [...new Set(fichas.map((f) => String(f.autor_id)))];
        const [vt, pf] = await Promise.all([
          adm.from("conversas_fichas_feedback").select("ficha_id, util").in("ficha_id", fids),
          adm.from("profiles").select("id, display_name, email").in("id", autorIds),
        ]);
        const nomes = new Map(((pf.data ?? []) as { id: string; display_name: string | null; email: string }[]).map((p) => [p.id, p.display_name?.trim() || p.email.split("@")[0]]));
        const votos = new Map<string, { u: number; n: number }>();
        for (const v of (vt.data ?? []) as { ficha_id: string; util: boolean }[]) {
          const x = votos.get(v.ficha_id) ?? { u: 0, n: 0 };
          if (v.util) x.u++; else x.n++;
          votos.set(v.ficha_id, x);
        }
        biblioteca = fichas.map((f) => ({
          id: String(f.id), autor: nomes.get(String(f.autor_id)) ?? "", status: String(f.status), objecao: String(f.objecao_rotulo ?? ""),
          ponto_parada: String(f.ponto_parada), plano: String(f.plano ?? ""), perfil: String(f.perfil_cliente ?? ""),
          onde_travou: String(f.onde_travou ?? ""), o_que_fez: Array.isArray(f.o_que_fez) ? (f.o_que_fez as unknown[]).map(String) : [],
          mensagem_chave: String(f.mensagem_chave ?? ""), dias_ate_fechar: f.dias_ate_fechar == null ? null : Number(f.dias_ate_fechar),
          util: votos.get(String(f.id))?.u ?? 0, nao_util: votos.get(String(f.id))?.n ?? 0,
        }));
      }
    } catch { biblioteca = []; }

    return {
      de: data.de, ate: data.ate, escopo: equipe ? "equipe" : "atendente",
      exportadoPor: await nomeDoAtendente(context),
      exportadoEm: new Date().toISOString(),
      tickets, eventos,
      mensagens: (mAtual.data ?? []) as Linha[],
      versoes: (mVers.data ?? []) as Linha[],
      objecoes: usos.map((u) => ({
        data_hora: u.created_at,
        atendente: atendentes[u.user_id] ?? "",
        objecao: nomeObj.get(u.objecao_id) ?? "",
        angulo_copiado: u.angulo ?? "",
        objecao_nova: vieramDaFila.has(u.objecao_id),
      })),
      atendentes,
      desempenho,
      biblioteca,
    };
  });

/** Lista de atendentes para o filtro do relatório do Admin. */
export const adminListAtendentesRetomada = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data } = await db(context).from("retomadas_admin").select("user_id, atendente");
    const m = new Map<string, string>();
    for (const r of (data ?? []) as { user_id: string; atendente: string }[]) m.set(r.user_id, r.atendente);
    return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });
