import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const xpForDifficulty = (difficulty: string, nota: number) => {
  const base: Record<string, number> = { facil: 10, medio: 20, dificil: 35, especialista: 50 };
  const multiplier = nota >= 70 ? 1 : nota >= 40 ? 0.6 : 0.3;
  return Math.round((base[difficulty] ?? 15) * multiplier);
};

export const levelFromXp = (xp: number) => {
  if (xp < 100) return { level: 1, label: "Iniciante" };
  if (xp < 300) return { level: 2, label: "Aprendiz" };
  if (xp < 600) return { level: 3, label: "Experiente" };
  if (xp < 1000) return { level: 4, label: "Especialista" };
  return { level: 5, label: "Mestre MarcIAna" };
};

export const saveSimulatorResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    profile_id: string; profile_name: string; difficulty: string;
    nota: number; resumo: string; pontos_fortes: string[];
    pontos_melhoria: string[]; erros: string[];
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("simulator_results").insert({
      user_id: context.userId,
      profile_id: data.profile_id,
      profile_name: data.profile_name,
      difficulty: data.difficulty,
      nota: data.nota,
      resumo: data.resumo,
      pontos_fortes: data.pontos_fortes,
      pontos_melhoria: data.pontos_melhoria,
      erros: data.erros,
    });
    if (error) throw error;

    const ganho = xpForDifficulty(data.difficulty, data.nota);
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("xp")
      .eq("id", context.userId)
      .single();
    const novoXp = (prof?.xp ?? 0) + ganho;
    await context.supabase.from("profiles").update({ xp: novoXp }).eq("id", context.userId);

    return { ganho, novoXp };
  });

export const getMyGamification = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("xp, display_name")
      .eq("id", context.userId)
      .single();
    const { data: results } = await context.supabase
      .from("simulator_results")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    return { xp: prof?.xp ?? 0, display_name: prof?.display_name, results: results ?? [] };
  });

export const getRanking = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("id, display_name, xp")
      .order("xp", { ascending: false })
      .limit(20);
    return data ?? [];
  });

// New function: getMyHistory
export const getMyHistory = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await context.supabase
      .from("profiles").select("xp, display_name").eq("id", context.userId).single();
    const { data: results } = await context.supabase
      .from("simulator_results").select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const all = results ?? [];
    const total = all.length;
    const media = total > 0 ? Math.round(all.reduce((s: number, r: any) => s + r.nota, 0) / total) : 0;
    const melhor = total > 0 ? Math.max(...all.map((r: any) => r.nota)) : 0;
    const maisUsado = total > 0
      ? Object.entries(all.reduce((acc: Record<string, number>, r: any) => {
          acc[r.profile_name] = (acc[r.profile_name] ?? 0) + 1; return acc;
        }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
      : "";
    return {
      xp: prof?.xp ?? 0,
      display_name: prof?.display_name,
      total, media, melhor, maisUsado,
      results: all
    };
  });

// New function: getRankingDetalhado
export const getRankingDetalhado = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profs } = await context.supabase
      .from("profiles").select("id, display_name, xp")
      .order("xp", { ascending: false }).limit(20);
    const ids = (profs ?? []).map((p: any) => p.id);
    if (ids.length === 0) return [];
    const { data: results } = await context.supabase
      .from("simulator_results").select("user_id, nota")
      .in("user_id", ids);
    const statsMap: Record<string, { total: number; soma: number }> = {};
    for (const r of results ?? []) {
      if (!statsMap[r.user_id]) statsMap[r.user_id] = { total: 0, soma: 0 };
      statsMap[r.user_id].total++;
      statsMap[r.user_id].soma += r.nota;
    }
    return (profs ?? []).map((p: any) => ({
      ...p,
      total: statsMap[p.id]?.total ?? 0,
      media: statsMap[p.id]?.total
        ? Math.round(statsMap[p.id].soma / statsMap[p.id].total)
        : 0,
    }));
  });
