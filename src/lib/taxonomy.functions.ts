import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ScopeEnum = z.enum(["message", "flow", "suggestion", "content"]);

export const listCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scope: ScopeEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("categories")
      .select("*")
      .eq("scope", data.scope)
      .order("position", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CatInput = z.object({
  id: z.string().uuid().optional(),
  scope: ScopeEnum,
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

async function assertAdmin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const { data: ok } = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CatInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("categories").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("categories").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
