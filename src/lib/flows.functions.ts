import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const { data: ok } = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

// ========== FLOWS ==========
export const listFlows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ training: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("flows").select("*").order("position", { ascending: true });
    if (data.training !== undefined) q = q.eq("is_training", data.training);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: flow, error: e1 } = await context.supabase.from("flows").select("*").eq("id", data.id).single();
    if (e1) throw new Error(e1.message);
    const { data: nodes, error: e2 } = await context.supabase
      .from("flow_nodes").select("*").eq("flow_id", data.id)
      .order("position", { ascending: true });
    if (e2) throw new Error(e2.message);
    return { flow, nodes: nodes ?? [] };
  });

const FlowInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  is_training: z.boolean().default(false),
  position: z.number().int().default(0),
});

export const upsertFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FlowInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const row = { ...data, created_by: context.userId };
    const { data: r, error } = data.id
      ? await context.supabase.from("flows").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("flows").insert(row).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("flows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========== NODES ==========
const NodeInput = z.object({
  id: z.string().uuid().optional(),
  flow_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  node_type: z.enum(["start","step","question","answer","objection","action","end"]).default("step"),
  title: z.string().min(1).max(200),
  message: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("flow_nodes").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("flow_nodes").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("flow_nodes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
