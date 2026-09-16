import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listPromoPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("promo_plans")
      .select("*")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const PlanInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(120),
  preco_primeiro_mes: z.number().nonnegative(),
  preco_demais_meses: z.number().nonnegative(),
  cor_fundo: z.string().min(1).max(20).default("#64748B"),
  cor_fundo_2: z.string().max(20).nullable().optional(),
  ativo: z.boolean().default(true),
  position: z.number().int().default(0),
});

export const upsertPromoPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("promo_plans").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("promo_plans").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deletePromoPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("promo_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
