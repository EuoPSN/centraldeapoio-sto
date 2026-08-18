import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Etapas do Fluxo de Atendimento — separado das Categorias/Subcategorias das mensagens.
// Cada etapa pertence a uma Categoria (tipo de atendimento) ou fica em "Geral" (category_id nulo).
// Uma mensagem pode estar ligada a várias etapas ao mesmo tempo (via message_flow_links).

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
  category_id: z.string().uuid().nullable().optional(),
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

// Liga uma mensagem a uma etapa. Se ela já estiver em OUTRA etapa da MESMA categoria
// (mesmo fluxo), remove esse vínculo antigo antes — uma mensagem só ocupa um lugar por fluxo.
// Vínculos em fluxos de OUTRAS categorias não são afetados (é assim que ela pode
// aparecer tanto em Filiação quanto em Refiliação, por exemplo).
export const linkMessageToStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ message_id: z.string().uuid(), flow_stage_id: z.string().uuid(), position: z.number().int().default(0) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: stage, error: stageErr } = await context.supabase
      .from("message_flow_stages").select("category_id").eq("id", data.flow_stage_id).single();
    if (stageErr) throw new Error(stageErr.message);

    let siblingQuery = context.supabase.from("message_flow_stages").select("id");
    siblingQuery = stage.category_id === null
      ? siblingQuery.is("category_id", null)
      : siblingQuery.eq("category_id", stage.category_id);
    const { data: siblings, error: sibErr } = await siblingQuery;
    if (sibErr) throw new Error(sibErr.message);
    const siblingIds = (siblings ?? []).map((s: { id: string }) => s.id);

    if (siblingIds.length > 0) {
      const { error: delErr } = await context.supabase
        .from("message_flow_links").delete().eq("message_id", data.message_id).in("flow_stage_id", siblingIds);
      if (delErr) throw new Error(delErr.message);
    }

    const { error: insErr } = await context.supabase
      .from("message_flow_links")
      .upsert({ message_id: data.message_id, flow_stage_id: data.flow_stage_id, position: data.position }, { onConflict: "message_id,flow_stage_id" });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

export const unlinkMessageFromStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("message_flow_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderFlowLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), position: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("message_flow_links").update({ position: data.position }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
