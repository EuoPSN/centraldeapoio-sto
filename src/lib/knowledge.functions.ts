import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const KNOWLEDGE_KINDS = [
  "regra",
  "procedimento",
  "artigo",
  "conversa_modelo",
  "documento",
  "treinamento",
] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const { data: ok } = await s.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!ok) throw new Error("Apenas administradores.");
}

export const listKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(KNOWLEDGE_KINDS).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("knowledge_entries")
      .select("*, category:categories(id,name,icon,color)")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const KEInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(KNOWLEDGE_KINDS),
  category_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  file_url: z.string().nullable().optional(),
  file_mime: z.string().nullable().optional(),
  file_name: z.string().nullable().optional(),
  external_url: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  position: z.number().int().default(0),
});

export const upsertKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KEInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const row = { ...data, created_by: context.userId };
    const { data: r, error } = data.id
      ? await context.supabase.from("knowledge_entries").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("knowledge_entries").insert(row).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("knowledge_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Gera URL assinada (1h) para download de arquivo no bucket knowledge-files
export const signKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("knowledge-files")
      .createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
