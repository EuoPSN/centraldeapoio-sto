import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Amor Saúde: consultas, exames, odontologia e clínicas numa leitura só.

export const getAmorSaude = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const [clinicas, consultas, exames, procedimentos, settings] = await Promise.all([
      db.from("contatos_enderecos").select("*").eq("tipo", "clinica_amor_saude")
        .order("position", { ascending: true }).order("nome_regiao", { ascending: true }),
      db.from("pricing_items").select("*, clinicas:pricing_item_clinicas(clinica_id)")
        .order("specialty", { ascending: true }),
      db.from("exames").select("*, clinicas:exame_clinicas(clinica_id)")
        .order("nome", { ascending: true }),
      db.from("procedimentos_odontologicos").select("*, clinicas:procedimento_clinicas(clinica_id)")
        .order("position", { ascending: true }).order("nome", { ascending: true }),
      db.from("app_settings").select("avaliacao_odonto_valor").eq("id", 1).maybeSingle(),
    ]);
    for (const r of [clinicas, consultas, exames, procedimentos]) {
      if (r.error) throw new Error(r.error.message);
    }
    return {
      clinicas: clinicas.data ?? [],
      consultas: consultas.data ?? [],
      exames: exames.data ?? [],
      procedimentos: procedimentos.data ?? [],
      // Coluna nova: se a migração ainda não rodou, a leitura falha e o bloco some.
      avaliacaoOdonto: settings.error ? null : (settings.data?.avaliacao_odonto_valor ?? null),
    };
  });

const Tipo = z.enum(["consulta", "exame", "odontologia"]);

/** Cada cópia feita no Amor Saúde soma 1 no item ("Mais procuradas"). */
export const registerAmorSaudeUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tipo: Tipo, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("increment_amor_saude_use", { item_tipo: data.tipo, item_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

/** Substitui as clínicas de um item (seleção múltipla no Admin). */
export const setItemClinicas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tipo: Tipo, item_id: z.string().uuid(), clinica_ids: z.array(z.string().uuid()).default([]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const db = context.supabase;
    const ids = [...new Set(data.clinica_ids)];
    if (data.tipo === "consulta") {
      const del = await db.from("pricing_item_clinicas").delete().eq("pricing_item_id", data.item_id);
      if (del.error) throw new Error(del.error.message);
      if (ids.length) {
        const ins = await db.from("pricing_item_clinicas").insert(ids.map((clinica_id) => ({ pricing_item_id: data.item_id, clinica_id })));
        if (ins.error) throw new Error(ins.error.message);
      }
    } else if (data.tipo === "exame") {
      const del = await db.from("exame_clinicas").delete().eq("exame_id", data.item_id);
      if (del.error) throw new Error(del.error.message);
      if (ids.length) {
        const ins = await db.from("exame_clinicas").insert(ids.map((clinica_id) => ({ exame_id: data.item_id, clinica_id })));
        if (ins.error) throw new Error(ins.error.message);
      }
    } else {
      const del = await db.from("procedimento_clinicas").delete().eq("procedimento_id", data.item_id);
      if (del.error) throw new Error(del.error.message);
      if (ids.length) {
        const ins = await db.from("procedimento_clinicas").insert(ids.map((clinica_id) => ({ procedimento_id: data.item_id, clinica_id })));
        if (ins.error) throw new Error(ins.error.message);
      }
    }
    return { ok: true };
  });

/** Valor geral da "Avaliação odontológica (Cartão de TODOS)". */
export const setAvaliacaoOdonto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ valor: z.number().nonnegative().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("app_settings").update({ avaliacao_odonto_valor: data.valor }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
