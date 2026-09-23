import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const isAdmin = await isAdminUser(ctx.supabase, ctx.userId);
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
}

// "Hoje" sempre no fuso de Brasília, calculado no servidor — nunca no relógio
// do navegador do funcionário. en-CA formata como AAAA-MM-DD, que é o formato
// de DATE do Postgres.
function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// ---- Itens (o "molde" do checklist, editado pelo admin) ----

export const listChecklistItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("checklist_items").select("*").eq("ativo", true).order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listChecklistItemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("checklist_items").select("*").order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ItemInput = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(300),
  tipo: z.enum(["binario", "meta"]).default("binario"),
  meta_padrao: z.number().int().nullable().optional(),
  position: z.number().int().default(0),
  ativo: z.boolean().default(true),
});

export const upsertChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ItemInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      titulo: data.titulo,
      tipo: data.tipo,
      meta_padrao: data.tipo === "meta" ? (data.meta_padrao ?? 100) : null,
      position: data.position,
      ativo: data.ativo,
    };
    const { data: result, error } = data.id
      ? await supabaseAdmin.from("checklist_items").update(row).eq("id", data.id).select().single()
      : await supabaseAdmin.from("checklist_items").insert(row).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("checklist_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Checklist do próprio funcionário ----

// Itens ativos + as marcações do PRÓPRIO usuário pra hoje (fuso de Brasília).
export const getMyChecklistToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const dia = hojeBrasilia();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [itemsRes, entriesRes] = await Promise.all([
      supabaseAdmin.from("checklist_items").select("*").eq("ativo", true).order("position", { ascending: true }),
      supabaseAdmin.from("checklist_entries").select("*").eq("user_id", context.userId).eq("dia", dia),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (entriesRes.error) throw new Error(entriesRes.error.message);
    return { dia, items: itemsRes.data ?? [], entries: entriesRes.data ?? [] };
  });

const EntryInput = z.object({
  item_id: z.string().uuid(),
  marcado: z.boolean().optional(),
  valor: z.number().int().nullable().optional(),
});

// Marca/atualiza um item do checklist de HOJE do próprio usuário (o dia nunca vem
// do cliente — é sempre recalculado aqui no servidor, no fuso de Brasília).
export const upsertChecklistEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntryInput.parse(d))
  .handler(async ({ data, context }) => {
    const dia = hojeBrasilia();
    const { error } = await context.supabase
      .from("checklist_entries")
      .upsert({
        item_id: data.item_id,
        user_id: context.userId,
        dia,
        marcado: data.marcado ?? false,
        valor: data.valor ?? null,
      }, { onConflict: "item_id,user_id,dia" });
    if (error) throw new Error(error.message);
    return { ok: true, dia };
  });

// ---- Acompanhamento do admin ----

// Progresso de todo mundo num dia (padrão: hoje, fuso de Brasília). A meta usada
// pra julgar itens do tipo "meta" é sempre a atual do item, não uma "congelada"
// do dia — se o admin mudar a meta, ela vale também pra trás nesta consulta.
export const getChecklistSummaryForDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dia: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const dia = data.dia || hojeBrasilia();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [itemsRes, usersRes, entriesRes] = await Promise.all([
      supabaseAdmin.from("checklist_items").select("*").eq("ativo", true),
      supabaseAdmin.from("profiles").select("id,email,display_name").eq("is_active", true),
      supabaseAdmin.from("checklist_entries").select("*").eq("dia", dia),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (usersRes.error) throw new Error(usersRes.error.message);
    if (entriesRes.error) throw new Error(entriesRes.error.message);

    const items = (itemsRes.data ?? []) as Array<{ id: string; tipo: string; meta_padrao: number | null }>;
    const totalItems = items.length;

    const entriesByUser = new Map<string, any[]>();
    for (const e of entriesRes.data ?? []) {
      const arr = entriesByUser.get(e.user_id) ?? [];
      arr.push(e);
      entriesByUser.set(e.user_id, arr);
    }

    const isDone = (item: { tipo: string; meta_padrao: number | null }, entry: any) => {
      if (!entry) return false;
      if (item.tipo === "meta") return (entry.valor ?? 0) >= (item.meta_padrao ?? 0);
      return !!entry.marcado;
    };

    const users = (usersRes.data ?? []).map((u: any) => {
      const entries = entriesByUser.get(u.id) ?? [];
      const done = items.filter((item) => isDone(item, entries.find((e) => e.item_id === item.id))).length;
      return {
        id: u.id,
        display_name: u.display_name,
        email: u.email,
        done,
        total: totalItems,
        pct: totalItems > 0 ? Math.round((done / totalItems) * 100) : 0,
      };
    }).sort((a, b) => b.pct - a.pct);

    const teamAveragePct = users.length > 0 ? Math.round(users.reduce((s, u) => s + u.pct, 0) / users.length) : 0;
    const zeroCount = users.filter((u) => u.done === 0).length;

    return { dia, totalItems, users, teamAveragePct, zeroCount };
  });
