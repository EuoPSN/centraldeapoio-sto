import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listProcedimentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("procedimentos_odontologicos")
      .select("*, unidades:procedimento_unidades(unidade:unidades(id,nome))")
      .order("position", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const ProcedimentoInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(150),
  categoria: z.string().nullable().optional(),
  descricao: z.string().nullable().optional(),
  cuidados_pos: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertProcedimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProcedimentoInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("procedimentos_odontologicos").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("procedimentos_odontologicos").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteProcedimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("procedimentos_odontologicos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ProcedimentoUnidadesInput = z.object({
  procedimento_id: z.string().uuid(),
  unidade_ids: z.array(z.string().uuid()).default([]),
});

export const setProcedimentoUnidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProcedimentoUnidadesInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error: delErr } = await context.supabase.from("procedimento_unidades").delete().eq("procedimento_id", data.procedimento_id);
    if (delErr) throw new Error(delErr.message);
    if (data.unidade_ids.length > 0) {
      const { error: insErr } = await context.supabase
        .from("procedimento_unidades")
        .insert(data.unidade_ids.map((unidade_id) => ({ procedimento_id: data.procedimento_id, unidade_id })));
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });
