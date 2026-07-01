import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("messages")
      .select("*, category:categories!messages_category_id_fkey(id,name,icon,color), subcategory:categories!messages_subcategory_id_fkey(id,name)")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const Input = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  subcategory_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  internal_note: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  position: z.number().int().default(0),
});

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const { data: ok } = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

export const upsertMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const row = { ...data, created_by: context.userId };
    const { data: r, error } = data.id
      ? await context.supabase.from("messages").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("messages").insert(row).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), position: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("messages").update({ position: data.position }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
