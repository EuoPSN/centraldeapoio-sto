import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Etapas do Fluxo de Atendimento — separado das Categorias/Subcategorias das mensagens.

export const listFlowStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("message_flow_stages")
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

const StageInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  position: z.number().int().default(0),
});

export const upsertFlowStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StageInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("message_flow_stages").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("message_flow_stages").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteFlowStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("message_flow_stages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMessageFlowStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), flow_stage_id: z.string().uuid().nullable(), position: z.number().int().optional() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const update: Record<string, unknown> = { flow_stage_id: data.flow_stage_id };
    if (data.position !== undefined) update.position = data.position;
    const { error } = await context.supabase.from("messages").update(update).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
