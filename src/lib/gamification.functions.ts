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
