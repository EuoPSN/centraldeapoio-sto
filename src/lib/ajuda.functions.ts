import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============================================================
// CENTRAL DE AJUDA — visualizações, "isso ajudou?" e novidades não vistas.
// Procedimentos/Problemas continuam em content_items (ver content.functions.ts);
// Sugestões/dúvidas continuam em suggestions (ver suggestions.functions.ts).
// ============================================================

export const registerArticleView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ content_item_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("content_item_views")
      .insert({ content_item_id: data.content_item_id, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMostViewedArticles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    const db = context.supabase as any;
    const { data: views, error } = await db
      .from("content_item_views")
      .select("content_item_id")
      .gte("created_at", since.toISOString());
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const v of views ?? []) counts.set(v.content_item_id, (counts.get(v.content_item_id) ?? 0) + 1);
    const topIds = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    if (topIds.length === 0) return [];

    const { data: items, error: itemsError } = await db
      .from("content_items")
      .select("id,title,section")
      .in("id", topIds);
    if (itemsError) throw new Error(itemsError.message);
    type Item = { id: string; title: string; section: string };
    const byId = new Map<string, Item>((items ?? []).map((i: Item) => [i.id, i]));
    return topIds
      .map((id) => byId.get(id))
      .filter((i): i is Item => !!i)
      .map((i) => ({ ...i, views: counts.get(i.id) ?? 0 }));
  });

const FeedbackInput = z.object({ content_item_id: z.string().uuid(), util: z.boolean() });

export const submitAjudaFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FeedbackInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ajuda_feedback")
      .upsert(
        { content_item_id: data.content_item_id, user_id: context.userId, util: data.util },
        { onConflict: "content_item_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyAjudaFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ content_item_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ajuda_feedback")
      .select("util")
      .eq("content_item_id", data.content_item_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

// Admin: Sim/Não por artigo e a lista dos "Não" mais recentes (área de conteúdos).
export const getAjudaFeedbackSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ok = await isAdminUser(context.supabase, context.userId);
    if (!ok) throw new Error("Apenas administradores.");
    const db = context.supabase as any;
    const { data: rows, error } = await db
      .from("ajuda_feedback")
      .select("content_item_id, util, created_at, user_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: { user_id: string }) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id,display_name,email").in("id", userIds)
      : { data: [] as { id: string; display_name: string | null; email: string }[] };
    type ProfileRow = { id: string; display_name: string | null; email: string };
    const profileById = new Map<string, ProfileRow>((profiles ?? []).map((p: ProfileRow) => [p.id, p]));

    const bySection = new Map<string, { sim: number; nao: number; recentesNao: { data: string; pessoa: string }[] }>();
    for (const r of rows ?? []) {
      const s = bySection.get(r.content_item_id) ?? { sim: 0, nao: 0, recentesNao: [] };
      if (r.util) s.sim += 1;
      else {
        s.nao += 1;
        if (s.recentesNao.length < 5) {
          const p = profileById.get(r.user_id);
          s.recentesNao.push({ data: r.created_at, pessoa: p?.display_name || p?.email || "—" });
        }
      }
      bySection.set(r.content_item_id, s);
    }
    return Object.fromEntries(bySection);
  });

// Novidades: visita (ponto dourado) por usuário.
export const getAjudaNovidadesStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("ajuda_novidades_vistas_em")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const lastSeen = (profile as { ajuda_novidades_vistas_em?: string | null } | null)?.ajuda_novidades_vistas_em ?? null;

    const { data: entries, error: changelogError } = await context.supabase
      .from("changelog_entries")
      .select("created_at")
      .eq("published", true);
    if (changelogError) throw new Error(changelogError.message);
    const unseenCount = (entries ?? []).filter((e) => !lastSeen || new Date(e.created_at) > new Date(lastSeen)).length;
    return { lastSeen, unseenCount };
  });

export const markAjudaNovidadesSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: unknown }> };
    const { error } = await client.rpc("marcar_ajuda_novidades_vistas");
    if (error) throw new Error(String(error));
    return { ok: true };
  });
