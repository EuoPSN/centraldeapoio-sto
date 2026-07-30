import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminUser } from "@/lib/authz";

// ---------- helpers ----------
const OverviewInput = z.object({
  dias: z.number().int().min(1).max(365).default(30),
  cargo: z.string().optional(),
  userId: z.string().uuid().optional(),
});

type Profile = {
  id: string;
  display_name: string | null;
  email: string;
  cargo: string | null;
  last_seen_at: string | null;
  is_active: boolean | null;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function buildDayBuckets(dias: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ---------- getDashboardOverview ----------
export const getDashboardOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OverviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const db = context.supabase as any;
    const start = daysAgo(data.dias);
    const prevStart = daysAgo(data.dias * 2);
    const now = new Date().toISOString();

    // profiles + filter
    const { data: profilesRaw, error: pErr } = await db
      .from("profiles")
      .select("id, display_name, email, cargo, last_seen_at, is_active");
    if (pErr) throw new Error(pErr.message);
    let profiles: Profile[] = profilesRaw ?? [];
    if (data.cargo) profiles = profiles.filter((p) => p.cargo === data.cargo);
    const allowedIds = new Set(profiles.map((p) => p.id));
    const profileById: Record<string, Profile> = Object.fromEntries(profiles.map((p) => [p.id, p]));

    const filterUserId = data.userId && allowedIds.has(data.userId) ? data.userId : null;
    const scopeIds = filterUserId ? [filterUserId] : Array.from(allowedIds);

    // Parallel data fetches
    const [accessRes, simResCur, simResPrev, simSessRes, chatConvRes, chatMsgRes, trainRes, contentTrainCount] =
      await Promise.all([
        db.from("access_logs")
          .select("user_id, resource_type, resource_id, created_at")
          .gte("created_at", start)
          .in("user_id", scopeIds.length ? scopeIds : ["00000000-0000-0000-0000-000000000000"]),
        db.from("simulator_results")
          .select("user_id, nota, created_at")
          .gte("created_at", start)
          .in("user_id", scopeIds.length ? scopeIds : ["00000000-0000-0000-0000-000000000000"]),
        db.from("simulator_results")
          .select("user_id, nota, created_at")
          .gte("created_at", prevStart)
          .lt("created_at", start)
          .in("user_id", scopeIds.length ? scopeIds : ["00000000-0000-0000-0000-000000000000"]),
        db.from("simulator_sessions")
          .select("id, user_id, started_at, finished_at")
          .gte("started_at", start)
          .in("user_id", scopeIds.length ? scopeIds : ["00000000-0000-0000-0000-000000000000"]),
        db.from("chat_conversations")
          .select("id, user_id, updated_at")
          .gte("updated_at", start)
          .in("user_id", scopeIds.length ? scopeIds : ["00000000-0000-0000-0000-000000000000"]),
        db.from("chat_messages")
          .select("id, conversation_id, role, created_at")
          .gte("created_at", start),
        db.from("training_completions")
          .select("user_id, content_id, completed_at")
          .gte("completed_at", start)
          .in("user_id", scopeIds.length ? scopeIds : ["00000000-0000-0000-0000-000000000000"]),
        db.from("content_items")
          .select("id", { count: "exact", head: true })
          .eq("section", "treinamentos"),
      ]);

    if (accessRes.error) throw new Error(accessRes.error.message);
    if (simResCur.error) throw new Error(simResCur.error.message);
    if (simResPrev.error) throw new Error(simResPrev.error.message);
    if (simSessRes.error) throw new Error(simSessRes.error.message);
    if (chatConvRes.error) throw new Error(chatConvRes.error.message);
    if (chatMsgRes.error) throw new Error(chatMsgRes.error.message);
    if (trainRes.error) throw new Error(trainRes.error.message);
    if (contentTrainCount.error) throw new Error(contentTrainCount.error.message);

    const accessLogs = (accessRes.data ?? []) as any[];
    const simCur = (simResCur.data ?? []) as any[];
    const simPrev = (simResPrev.data ?? []) as any[];
    const simSess = (simSessRes.data ?? []) as any[];
    const chatConvs = (chatConvRes.data ?? []) as any[];
    const allChatMsgs = (chatMsgRes.data ?? []) as any[];
    const trainings = (trainRes.data ?? []) as any[];
    const totalTrainings = contentTrainCount.count ?? 0;

    // Map chat messages -> user via conversations
    const convUserById: Record<string, string> = Object.fromEntries(
      chatConvs.map((c) => [c.id, c.user_id]),
    );
    const chatMsgs = allChatMsgs.filter(
      (m) => m.role === "user" && convUserById[m.conversation_id] && allowedIds.has(convUserById[m.conversation_id]) &&
        (!filterUserId || convUserById[m.conversation_id] === filterUserId),
    );

    // ---------- cards ----------
    const totalUsuarios = profiles.length;
    const cutoffActive = daysAgo(30);
    const usuariosAtivos = profiles.filter(
      (p) => p.last_seen_at && p.last_seen_at >= cutoffActive,
    ).length;

    const simulacoesRealizadas = simSess.length;
    const simulacoesConcluidas = simCur.length;
    const notas = simCur.map((r) => Number(r.nota) || 0).filter((n) => n > 0);
    const mediaGeral = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
    const iaMensagens = chatMsgs.length;

    // Conteúdos mais acessados
    const contentAccessCount: Record<string, number> = {};
    for (const a of accessLogs) {
      if (a.resource_type === "content" && a.resource_id) {
        contentAccessCount[a.resource_id] = (contentAccessCount[a.resource_id] ?? 0) + 1;
      }
    }
    const topContentIds = Object.entries(contentAccessCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    let conteudosMaisAcessados: Array<{ id: string; title: string; acessos: number }> = [];
    if (topContentIds.length) {
      const { data: cItems } = await db
        .from("content_items")
        .select("id, title")
        .in("id", topContentIds.map((c) => c[0]));
      const titleById: Record<string, string> = Object.fromEntries((cItems ?? []).map((c: any) => [c.id, c.title]));
      conteudosMaisAcessados = topContentIds.map(([id, acessos]) => ({
        id, acessos, title: titleById[id] ?? "—",
      }));
    }

    // Training completion rate
    const uniqueCompletionsByUser: Record<string, Set<string>> = {};
    for (const t of trainings) {
      (uniqueCompletionsByUser[t.user_id] ??= new Set()).add(t.content_id);
    }
    const totalPossivel = totalTrainings * Math.max(profiles.length, 1);
    const totalConcluido = Object.values(uniqueCompletionsByUser).reduce((s, set) => s + set.size, 0);
    const taxaConclusao = totalPossivel > 0 ? (totalConcluido / totalPossivel) * 100 : 0;

    // ---------- charts (day series) ----------
    const buckets = buildDayBuckets(data.dias);
    const emptySeries = () => Object.fromEntries(buckets.map((d) => [d, 0]));

    const simSeries = emptySeries();
    const notaSum = emptySeries();
    const notaCount = emptySeries();
    for (const r of simCur) {
      const k = dayKey(r.created_at);
      if (k in simSeries) {
        simSeries[k]++;
        notaSum[k] += Number(r.nota) || 0;
        notaCount[k]++;
      }
    }
    const notaSeries = buckets.map((d) => ({
      dia: d,
      media: notaCount[d] > 0 ? Math.round((notaSum[d] / notaCount[d]) * 10) / 10 : 0,
    }));
    const simuladosSeries = buckets.map((d) => ({ dia: d, total: simSeries[d] }));

    const accessSeries = emptySeries();
    for (const a of accessLogs) {
      const k = dayKey(a.created_at);
      if (k in accessSeries) accessSeries[k]++;
    }
    const acessosSeries = buckets.map((d) => ({ dia: d, total: accessSeries[d] }));

    // ---------- rankings ----------
    const nameFor = (uid: string) => {
      const p = profileById[uid];
      return p?.display_name ?? p?.email ?? "—";
    };

    // Ranking IA (usuários com mais mensagens)
    const iaByUser: Record<string, number> = {};
    for (const m of chatMsgs) {
      const uid = convUserById[m.conversation_id];
      iaByUser[uid] = (iaByUser[uid] ?? 0) + 1;
    }
    const rankingIA = Object.entries(iaByUser)
      .map(([uid, total]) => ({ userId: uid, nome: nameFor(uid), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Ranking colaboradores (nota média)
    const scoreByUser: Record<string, { sum: number; count: number }> = {};
    for (const r of simCur) {
      const s = (scoreByUser[r.user_id] ??= { sum: 0, count: 0 });
      s.sum += Number(r.nota) || 0;
      s.count++;
    }
    const rankingColaboradores = Object.entries(scoreByUser)
      .filter(([, s]) => s.count > 0)
      .map(([uid, s]) => ({
        userId: uid,
        nome: nameFor(uid),
        cargo: profileById[uid]?.cargo ?? "—",
        media: Math.round((s.sum / s.count) * 10) / 10,
        simulados: s.count,
      }))
      .sort((a, b) => b.media - a.media)
      .slice(0, 10);

    // Ranking por cargo (equipe)
    const scoreByCargo: Record<string, { sum: number; count: number; membros: Set<string> }> = {};
    const acessosByCargo: Record<string, { total: number; membros: Set<string> }> = {};
    for (const p of profiles) {
      const c = p.cargo ?? "Sem cargo";
      (scoreByCargo[c] ??= { sum: 0, count: 0, membros: new Set() }).membros.add(p.id);
      (acessosByCargo[c] ??= { total: 0, membros: new Set() }).membros.add(p.id);
    }
    for (const r of simCur) {
      const cargo = profileById[r.user_id]?.cargo ?? "Sem cargo";
      const s = (scoreByCargo[cargo] ??= { sum: 0, count: 0, membros: new Set() });
      s.sum += Number(r.nota) || 0;
      s.count++;
    }
    for (const a of accessLogs) {
      const cargo = profileById[a.user_id]?.cargo ?? "Sem cargo";
      const s = (acessosByCargo[cargo] ??= { total: 0, membros: new Set() });
      s.total++;
    }
    const rankingCargos = Object.entries(scoreByCargo).map(([cargo, s]) => ({
      cargo,
      membros: s.membros.size,
      media: s.count > 0 ? Math.round((s.sum / s.count) * 10) / 10 : 0,
      simulados: s.count,
      acessosPorMembro: s.membros.size > 0
        ? Math.round(((acessosByCargo[cargo]?.total ?? 0) / s.membros.size) * 10) / 10
        : 0,
    }));
    const rankingCargosPorNota = [...rankingCargos].sort((a, b) => b.media - a.media);
    const cargosMenorEngajamento = [...rankingCargos].sort((a, b) => a.acessosPorMembro - b.acessosPorMembro);

    // Evolução (delta período atual vs anterior)
    const prevByUser: Record<string, { sum: number; count: number }> = {};
    for (const r of simPrev) {
      const s = (prevByUser[r.user_id] ??= { sum: 0, count: 0 });
      s.sum += Number(r.nota) || 0;
      s.count++;
    }
    const evolucao = Object.entries(scoreByUser).map(([uid, cur]) => {
      const prev = prevByUser[uid];
      const curMed = cur.count > 0 ? cur.sum / cur.count : 0;
      const prevMed = prev && prev.count > 0 ? prev.sum / prev.count : 0;
      return {
        userId: uid,
        nome: nameFor(uid),
        delta: Math.round((curMed - prevMed) * 10) / 10,
        atual: Math.round(curMed * 10) / 10,
        anterior: Math.round(prevMed * 10) / 10,
      };
    });
    const maiorEvolucao = [...evolucao].sort((a, b) => b.delta - a.delta).slice(0, 5);
    const quedaDesempenho = [...evolucao].filter((e) => e.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);

    // Sem acesso recente (>14 dias)
    const cutoffInativo = daysAgo(14);
    const semAcessoRecente = profiles
      .filter((p) => !p.last_seen_at || p.last_seen_at < cutoffInativo)
      .slice(0, 10)
      .map((p) => ({
        userId: p.id, nome: p.display_name ?? p.email, cargo: p.cargo ?? "—",
        ultimoAcesso: p.last_seen_at,
      }));

    return {
      cards: {
        totalUsuarios,
        usuariosAtivos,
        simulacoesRealizadas,
        simulacoesConcluidas,
        mediaGeral: Math.round(mediaGeral * 10) / 10,
        iaMensagens,
        taxaConclusao: Math.round(taxaConclusao * 10) / 10,
        totalTreinamentos: totalTrainings,
      },
      conteudosMaisAcessados,
      series: { simulados: simuladosSeries, notas: notaSeries, acessos: acessosSeries },
      rankings: {
        colaboradores: rankingColaboradores,
        ia: rankingIA,
        cargos: rankingCargosPorNota,
      },
      indicadores: {
        maiorEvolucao,
        quedaDesempenho,
        cargosDestaque: rankingCargosPorNota.slice(0, 3),
        cargosMenorEngajamento: cargosMenorEngajamento.slice(0, 3),
        semAcessoRecente,
      },
      meta: {
        dias: data.dias,
        inicio: start,
        fim: now,
        cargo: data.cargo ?? null,
        userId: filterUserId,
      },
    };
  });

// ---------- touchLastSeen ----------
export const touchLastSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- listCargos + listUsersLite ----------
export const listCargosAndUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    const { data, error } = await (context.supabase as any)
      .from("profiles")
      .select("id, display_name, email, cargo")
      .order("display_name", { ascending: true });
    if (error) throw new Error(error.message);
    const users = (data ?? []) as any[];
    const cargos = Array.from(new Set(users.map((u) => u.cargo).filter(Boolean))) as string[];
    return { users, cargos };
  });
