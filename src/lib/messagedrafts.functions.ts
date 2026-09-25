import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const isAdmin = await isAdminUser(ctx.supabase, ctx.userId);
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
}

// ---- Funcionário: criar e ver os próprios rascunhos ----

export const listMyDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("message_drafts")
      .select("*, category:categories!message_drafts_category_id_fkey(id,name), subcategory:categories!message_drafts_subcategory_id_fkey(id,name)")
      .eq("criado_por", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const DraftInput = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(200),
  conteudo: z.string().min(1),
  nota_interna: z.string().optional().nullable(),
  category_id: z.string().uuid().nullable().optional(),
  subcategory_id: z.string().uuid().nullable().optional(),
});

// Cria um rascunho novo, ou atualiza um que o próprio autor ainda não teve revisado
// (a RLS trava a edição assim que o status deixa de ser "pendente").
export const upsertMyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DraftInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      titulo: data.titulo,
      conteudo: data.conteudo,
      nota_interna: data.nota_interna ?? null,
      category_id: data.category_id ?? null,
      subcategory_id: data.subcategory_id ?? null,
      criado_por: context.userId,
    };
    const { data: result, error } = data.id
      ? await context.supabase.from("message_drafts").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("message_drafts").insert(row).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteMyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("message_drafts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Admin: fila de análise ----

export const listDraftsForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.enum(["pendente", "aprovado", "rejeitado"]).default("pendente") }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: drafts, error } = await (supabaseAdmin as any)
      .from("message_drafts")
      .select(`*, category:categories!message_drafts_category_id_fkey(id,name), subcategory:categories!message_drafts_subcategory_id_fkey(id,name)`)
      .eq("status", data.status)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const authorIds = [...new Set((drafts ?? []).map((d: any) => d.criado_por))];
    let authorsById: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profs } = await (supabaseAdmin as any).from("profiles").select("id,display_name,email").in("id", authorIds);
      authorsById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name || p.email]));
    }
    return (drafts ?? []).map((d: any) => ({ ...d, autor_nome: authorsById[d.criado_por] || "—" }));
  });

const ApproveInput = z.object({
  id: z.string().uuid(),
  // O admin pode ajustar título/conteúdo/categoria antes de aprovar, sem precisar
  // mandar o funcionário refazer.
  titulo: z.string().min(1).max(200),
  conteudo: z.string().min(1),
  category_id: z.string().uuid().nullable().optional(),
  subcategory_id: z.string().uuid().nullable().optional(),
});

// Aprova: cria a mensagem de verdade em `messages` e marca o rascunho como aprovado,
// guardando o vínculo (message_id) pra referência.
export const approveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApproveInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: msg, error: msgErr } = await context.supabase
      .from("messages")
      .insert({
        title: data.titulo,
        content: data.conteudo,
        category_id: data.category_id ?? null,
        subcategory_id: data.subcategory_id ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (msgErr) throw new Error(msgErr.message);

    const { error: draftErr } = await context.supabase
      .from("message_drafts")
      .update({
        status: "aprovado",
        revisado_por: context.userId,
        revisado_em: new Date().toISOString(),
        message_id: msg.id,
      })
      .eq("id", data.id);
    if (draftErr) throw new Error(draftErr.message);
    return { ok: true, message_id: msg.id };
  });

export const rejectDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), nota_revisao: z.string().optional().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("message_drafts")
      .update({
        status: "rejeitado",
        revisado_por: context.userId,
        revisado_em: new Date().toISOString(),
        nota_revisao: data.nota_revisao ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
