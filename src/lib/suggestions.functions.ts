import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ all: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("suggestions").select("*").order("created_at", { ascending: false });
    if (!data.all) q = q.eq("user_id", context.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [] as Array<typeof rows[number] & { profile: { display_name: string | null; email: string } | null }>;
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await context.supabase.from("profiles").select("id,display_name,email").in("id", userIds);
    const map = new Map((profiles ?? []).map((p) => [p.id, { display_name: p.display_name as string | null, email: p.email as string }]));
    return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

const Input = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(2000),
  category: z.string().min(1).default("sugestao"),
});

export const createSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.from("suggestions")
      .insert({ ...data, user_id: context.userId }).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const updateSuggestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["pendente","em_analise","implementado","rejeitado"]),
    admin_response: z.string().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const s = context.supabase as unknown as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
    const { data: ok } = await isAdminUser(s, context.userId);
    if (!ok) throw new Error("Apenas administradores.");
    const { error } = await context.supabase.from("suggestions")
      .update({ status: data.status, admin_response: data.admin_response ?? null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("suggestions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
