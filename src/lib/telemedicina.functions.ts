import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { tabela } from "@/lib/db-novas-tabelas";
import { linhasDoColar } from "@/lib/telemedicina";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const ok = await isAdminUser(ctx.supabase as never, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const vazio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const Texto = (max: number) => z.preprocess(vazio, z.string().trim().max(max).nullable().optional());
const Valor = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.number().nonnegative().max(100000).nullable().optional());
const Https = z.preprocess(vazio, z.string().trim().max(500).regex(/^https:\/\//i, "O link precisa começar com https://").nullable().optional());

const ItemInput = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum(["teleconsulta", "pa_digital"]),
  nome: z.string().trim().min(1, "Informe a especialidade.").max(150),
  descricao: Texto(1000),
  para_quem: Texto(600),
  cartao: Valor,
  particular: Valor,
  passos: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  indique_quando: Texto(600),
  link_agendamento: Https,
  tempo_espera_min: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.number().int().min(1).max(600).nullable().optional()),
  ativo: z.boolean().default(true),
  position: z.number().int().default(0),
});

export const listTelemedicina = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await tabela(context.supabase, "telemedicina_itens")
      .select("*").order("tipo").order("position").order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const upsertTelemedicina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ItemInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const q = tabela(context.supabase, "telemedicina_itens");
    const { data: r, error } = data.id
      ? await q.update(data).eq("id", data.id).select().single()
      : await q.insert(data).select().single();
    if (error) throw new Error(error.code === "23505" ? "Já existe um item com esse nome neste tipo." : error.message);
    return r as any;
  });

export const deleteTelemedicina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await tabela(context.supabase, "telemedicina_itens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** "Adicionar várias": uma especialidade por linha, mesmo tipo; as que já existem são puladas. */
export const addManyTelemedicina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tipo: z.enum(["teleconsulta", "pa_digital"]), texto: z.string().max(8000) }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const nomes = linhasDoColar(data.texto);
    if (nomes.length === 0) throw new Error("Cole pelo menos uma especialidade.");
    if (nomes.length > 100) throw new Error("No máximo 100 por vez.");
    const q = tabela(context.supabase, "telemedicina_itens");
    const { data: existentes, error: e1 } = await q.select("nome,position").eq("tipo", data.tipo);
    if (e1) throw new Error(e1.message);
    const jaTem = new Set((existentes ?? []).map((r: { nome: string }) => r.nome.trim().toLowerCase()));
    const novos = nomes.filter((n) => !jaTem.has(n.toLowerCase()));
    const base = Math.max(0, ...((existentes ?? []).map((r: { position: number }) => r.position))) + 10;
    if (novos.length) {
      const { error } = await q.insert(novos.map((nome, i) => ({ tipo: data.tipo, nome, position: base + i * 10 })));
      if (error) throw new Error(error.message);
    }
    return { criadas: novos.length, puladas: nomes.length - novos.length };
  });

/** Link do site/app da Amor Saúde (vale quando o item não tem link próprio). */
export const setAmorSaudeSiteUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: Https }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await tabela(context.supabase, "app_settings").update({ amor_saude_site_url: data.url ?? null }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
