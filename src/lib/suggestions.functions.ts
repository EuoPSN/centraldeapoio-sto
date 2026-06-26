import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ all: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("suggestions").select("*, profile:profiles(display_name,email)").order("created_at", { ascending: false });
    if (!data.all) q = q.eq("user_id", context.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
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
    const { data: ok } = await s.rpc("has_role", { _user_id: context.userId, _role: "admin" });
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
