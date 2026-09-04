import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TABLE = "contatos_enderecos";

export const listContatos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from(TABLE)
      .select("*")
      .order("position", { ascending: true })
      .order("nome_regiao", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

const ContatoInput = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum(["cartao_de_todos", "clinica_amor_saude", "outros"]),
  nome_regiao: z.string().min(1).max(200),
  endereco: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  ponto_referencia: z.string().nullable().optional(),
  contato1: z.string().nullable().optional(),
  contato2: z.string().nullable().optional(),
  contato3: z.string().nullable().optional(),
  destaque: z.boolean().default(false),
  position: z.number().int().default(0),
});

export const upsertContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ContatoInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const row = {
      tipo: data.tipo,
      nome_regiao: data.nome_regiao,
      endereco: data.endereco ?? null,
      contato1: data.contato1 ?? null,
      contato2: data.contato2 ?? null,
      contato3: data.contato3 ?? null,
      position: data.position,
    };
    const { data: r, error } = data.id
      ? await context.supabase.from(TABLE).update(row).eq("id", data.id).select().single()
      : await context.supabase.from(TABLE).insert(row).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from(TABLE).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
