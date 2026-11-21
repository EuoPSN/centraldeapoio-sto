import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";
import { diaBR } from "@/lib/retomada";
import { levelFromXp, xpForDifficulty } from "@/lib/gamification.functions";
import {
  mesDe, PODIOS, PODIOS_QUALIDADE,
  type CampeaoHall, type DestaqueMes, type Podio, type PodioPessoal, type RankingPodios, type TopItem,
} from "@/lib/ranking";

// Ranking mensal. Cada atendente recebe SÓ os 3 primeiros de cada pódio e o próprio valor
// (mês e mês anterior), nunca a posição de ninguém fora do top 3. O Admin recebe a lista completa.
// Os pódios de qualidade vêm das funções SQL (ranking_podios, ranking_admin); o Treino é calculado
// aqui com as regras de XP do Simulador.

type Ctx = { supabase: unknown; userId: string };
const db = (ctx: Ctx) => ctx.supabase as any;
function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdminUser(ctx.supabase, ctx.userId))) throw new Error("Apenas administradores.");
}
const MesZ = z.string().regex(/^\d{4}-\d{2}-01$/);
const mesAtual = () => mesDe(diaBR(new Date()));
const nomeDe = (p: { display_name: string | null; email: string | null }) =>
  p.display_name?.trim() || String(p.email ?? "").split("@")[0] || "Sem nome";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

interface ConfigRanking {
  ativos: Record<Podio, boolean>;
  minimo_retomadas: number;
  periodo: "mensal";
}

async function lerConfig(ctx: Ctx): Promise<ConfigRanking> {
  const { data } = await db(ctx).from("ranking_config").select("*").eq("id", 1).maybeSingle();
  return {
    ativos: {
      constantes: data?.podio_constantes ?? true, respondidas: data?.podio_respondidas ?? true,
      evoluiram: data?.podio_evoluiram ?? true, ensinam: data?.podio_ensinam ?? true, treino: data?.podio_treino ?? true,
    },
    minimo_retomadas: Number(data?.minimo_retomadas ?? 15),
    periodo: "mensal",
  };
}

// ---------------------------------------------------------------------------
// Treino no Simulador: pontos do mês (mesmas regras de XP; xp e xp_problemas continuam acumulando)
// ---------------------------------------------------------------------------

interface LinhaTreino { user_id: string; nome: string; pontos: number; simulacoes: number }

function limitesDoMes(mes: string): { ini: string; fim: string } {
  // Meia-noite de Brasília (UTC-3, sem horário de verão) do dia 1 e do dia 1 do mês seguinte.
  const ini = new Date(`${mes}T03:00:00.000Z`).toISOString();
  const fim = new Date(`${mesDe(mes, 1)}T03:00:00.000Z`).toISOString();
  return { ini, fim };
}

/** Pontos do mês de cada atendente (ativo, não admin, não oculto no mês). Service role: o atendente
 * nunca lê as simulações dos outros, só recebe o resultado já reduzido ao top 3. */
async function pontosTreino(mes: string, tipo: "atendimento" | "problema"): Promise<LinhaTreino[]> {
  const a = await adminDb();
  const { ini, fim } = limitesDoMes(mes);
  const [res, perfis, admins, ocultos] = await Promise.all([
    a.from("simulator_results").select("user_id, difficulty, nota").eq("tipo", tipo).gte("created_at", ini).lt("created_at", fim),
    a.from("profiles").select("id, display_name, email, is_active"),
    a.from("user_roles").select("user_id").eq("role", "admin"),
    a.from("ranking_ocultos").select("user_id").eq("mes", mes),
  ]);
  const ehAdmin = new Set(((check(admins) ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const oculto = new Set((ocultos.error ? [] : (ocultos.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const pessoas = new Map(
    ((check(perfis) ?? []) as { id: string; display_name: string | null; email: string | null; is_active: boolean | null }[])
      .filter((p) => p.is_active !== false && !ehAdmin.has(p.id) && !oculto.has(p.id))
      .map((p) => [p.id, nomeDe(p)] as const),
  );
  const mapa = new Map<string, LinhaTreino>();
  for (const [id, nome] of pessoas) mapa.set(id, { user_id: id, nome, pontos: 0, simulacoes: 0 });
  for (const r of (check(res) ?? []) as { user_id: string; difficulty: string; nota: number }[]) {
    const l = mapa.get(r.user_id);
    if (!l) continue;
    l.pontos += xpForDifficulty(r.difficulty, r.nota);
    l.simulacoes += 1;
  }
  return [...mapa.values()].sort((x, y) => y.pontos - x.pontos || y.simulacoes - x.simulacoes || x.nome.localeCompare(y.nome, "pt-BR"));
}

function podioDoTreino(linhas: LinhaTreino[], anteriores: LinhaTreino[], eu: string, nivel: string): PodioPessoal {
  const top: TopItem[] = linhas.filter((l) => l.pontos > 0).slice(0, 3)
    .map((l, i) => ({ posicao: i + 1, nome: l.nome, valor: l.pontos, voce: l.user_id === eu }));
  const meu = linhas.find((l) => l.user_id === eu);
  return {
    top,
    meu: meu ? { valor: meu.pontos, total: meu.simulacoes, qualifica: meu.pontos > 0, no_podio: top.some((t) => t.voce) } : null,
    anterior: anteriores.find((l) => l.user_id === eu)?.pontos ?? null,
    nivel,
  };
}

// ---------------------------------------------------------------------------
// Fechamento do mês anterior (sem cron)
// ---------------------------------------------------------------------------

/** Idempotente: grava o top 3 do mês anterior em ranking_hall se ainda não existir. Chamada ao abrir
 * /ranking e o Início. Falha de migração pendente não derruba a tela. */
export const garantirFechamentoDoMesAnterior = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ mes: string }> => {
    const mes = mesDe(mesAtual(), -1);
    try {
      check(await db(context).rpc("ranking_fechar_mes", { p_mes: mes }));
      const a = await adminDb();
      const { count } = await a.from("ranking_hall").select("id", { count: "exact", head: true }).eq("mes", mes).eq("podio", "treino");
      if (!count) {
        const cfg = await lerConfig(context);
        if (cfg.ativos.treino) {
          const top = (await pontosTreino(mes, "atendimento")).filter((l) => l.pontos > 0).slice(0, 3);
          if (top.length) {
            check(await a.from("ranking_hall").upsert(
              top.map((l, i) => ({ mes, podio: "treino", posicao: i + 1, user_id: l.user_id, valor: l.pontos })),
              { onConflict: "mes,podio,posicao", ignoreDuplicates: true },
            ));
          }
        }
      }
    } catch (err) {
      console.error("Fechamento do ranking indisponível (migração pendente?):", err);
    }
    return { mes };
  });

// ---------------------------------------------------------------------------
// Atendente: pódios, Hall e destaques
// ---------------------------------------------------------------------------

export const getRankingPodios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RankingPodios> => {
    const mes = mesAtual();
    const ant = mesDe(mes, -1);
    const [cfg, rpc] = await Promise.all([lerConfig(context), db(context).rpc("ranking_podios", { p_mes: mes })]);
    const json = check(rpc) as { minimo_retomadas?: number; podios?: Record<string, PodioPessoal> } | null;
    const vazio: PodioPessoal = { top: [], meu: null, anterior: null };
    const podios = Object.fromEntries(
      PODIOS_QUALIDADE.map((p) => [p, json?.podios?.[p] ?? vazio]),
    ) as RankingPodios["podios"];

    const { data: prof } = await db(context).from("profiles").select("xp, xp_problemas").eq("id", context.userId).maybeSingle();
    const [at, atAnt, pb, pbAnt] = cfg.ativos.treino
      ? await Promise.all([pontosTreino(mes, "atendimento"), pontosTreino(ant, "atendimento"), pontosTreino(mes, "problema"), pontosTreino(ant, "problema")])
      : [[], [], [], []] as LinhaTreino[][];
    return {
      mes,
      minimo_retomadas: json?.minimo_retomadas ?? cfg.minimo_retomadas,
      ativos: cfg.ativos,
      podios,
      treino: {
        atendimento: podioDoTreino(at, atAnt, context.userId, levelFromXp(prof?.xp ?? 0).label),
        problemas: podioDoTreino(pb, pbAnt, context.userId, levelFromXp(prof?.xp_problemas ?? 0).label),
      },
    };
  });

/** Campeões de cada pódio nos meses fechados (só o 1º lugar). */
export const getHallRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CampeaoHall[]> => {
    const r = await db(context).rpc("ranking_hall_campeoes", { p_meses: 12 });
    if (r.error) { console.error("Hall indisponível (migração pendente?):", r.error.message); return []; }
    return ((r.data ?? []) as { mes: string; podio: Podio; nome: string; valor: number }[])
      .filter((x) => PODIOS.includes(x.podio));
  });

/** Linha "Destaques de <mês anterior>" do Início. Nula se não houve fechamento do mês anterior. */
export const getDestaquesMes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ mes: string; destaques: DestaqueMes[] } | null> => {
    const mes = mesDe(mesAtual(), -1);
    const r = await db(context).rpc("ranking_hall_campeoes", { p_meses: 1 });
    if (r.error) return null;
    const lista = ((r.data ?? []) as { mes: string; podio: Podio; nome: string; valor: number }[]).filter((x) => x.mes === mes && x.podio !== "treino");
    if (!lista.length) return null;
    const ordem = new Map(PODIOS.map((p, i) => [p, i] as const));
    return {
      mes,
      destaques: lista.sort((a, b) => (ordem.get(a.podio) ?? 9) - (ordem.get(b.podio) ?? 9))
        .map((x) => ({ podio: x.podio, nome: x.nome.split(/\s+/)[0] ?? x.nome, valor: Number(x.valor) })),
    };
  });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface LinhaAdminRanking {
  user_id: string; nome: string; valor: number | null; total: number; entra_no_podio: boolean; posicao: number | null;
}

export const adminRankingLista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ podio: z.enum(PODIOS), mes: MesZ.optional() }).parse(d))
  .handler(async ({ data, context }): Promise<{ mes: string; linhas: LinhaAdminRanking[] }> => {
    await requireAdmin(context);
    const mes = data.mes ?? mesAtual();
    if (data.podio === "treino") {
      const linhas = (await pontosTreino(mes, "atendimento")).map((l, i) => ({
        user_id: l.user_id, nome: l.nome, valor: l.pontos, total: l.simulacoes,
        entra_no_podio: l.pontos > 0 && i < 3, posicao: l.pontos > 0 ? i + 1 : null,
      }));
      return { mes, linhas };
    }
    const rows = check(await db(context).rpc("ranking_admin", { p_mes: mes, p_podio: data.podio })) as {
      user_id: string; nome: string; valor: number | null; total: number; entra_no_podio: boolean; posicao: number | null;
    }[];
    return { mes, linhas: (rows ?? []).map((r) => ({ ...r, valor: r.valor == null ? null : Number(r.valor) })) };
  });

export interface RankingAdminConfig {
  mes: string;
  ativos: Record<Podio, boolean>;
  minimo_retomadas: number;
  periodo: "mensal";
  ocultos: { user_id: string; nome: string }[];
  atendentes: { id: string; nome: string }[];
}

export const getRankingAdminConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RankingAdminConfig> => {
    await requireAdmin(context);
    const s = db(context);
    const mes = mesAtual();
    const [cfg, ocultos, perfis, admins] = await Promise.all([
      lerConfig(context),
      s.from("ranking_ocultos").select("user_id").eq("mes", mes),
      s.from("profiles").select("id, display_name, email, is_active"),
      s.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const ehAdmin = new Set(((check(admins) ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const atendentes = ((check(perfis) ?? []) as { id: string; display_name: string | null; email: string | null; is_active: boolean | null }[])
      .filter((p) => p.is_active !== false && !ehAdmin.has(p.id))
      .map((p) => ({ id: p.id, nome: nomeDe(p) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const nomes = new Map(atendentes.map((a) => [a.id, a.nome]));
    return {
      mes, ...cfg, atendentes,
      ocultos: (ocultos.error ? [] : (ocultos.data ?? []) as { user_id: string }[]).map((o) => ({ user_id: o.user_id, nome: nomes.get(o.user_id) ?? "Sem nome" })),
    };
  });

export const salvarRankingAdminConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ativos: z.object({ constantes: z.boolean(), respondidas: z.boolean(), evoluiram: z.boolean(), ensinam: z.boolean(), treino: z.boolean() }),
    minimo_retomadas: z.number().int().min(1).max(500),
    ocultar: z.array(z.string().uuid()).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const s = db(context);
    const mes = mesAtual();
    check(await s.from("ranking_config").upsert({
      id: 1, podio_constantes: data.ativos.constantes, podio_respondidas: data.ativos.respondidas,
      podio_evoluiram: data.ativos.evoluiram, podio_ensinam: data.ativos.ensinam, podio_treino: data.ativos.treino,
      minimo_retomadas: data.minimo_retomadas, periodo: "mensal", updated_at: new Date().toISOString(),
    }, { onConflict: "id" }));
    // Ocultos do mês: a lista enviada é a lista final.
    check(await s.from("ranking_ocultos").delete().eq("mes", mes));
    if (data.ocultar.length) {
      check(await s.from("ranking_ocultos").insert([...new Set(data.ocultar)].map((user_id) => ({ mes, user_id }))));
    }
    return { ok: true };
  });
