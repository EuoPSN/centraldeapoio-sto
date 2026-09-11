import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

export const listPdfLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pdf_library_items")
      .select("*, category:categories(id,name,icon,color)")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { signKnowledgeFileToken } = await import("./knowledge-file-token.server");
    return (data ?? []).map((item: any) => ({
      ...item,
      pdf_url: `/api/public/knowledge-file?t=${encodeURIComponent(signKnowledgeFileToken(item.pdf_path))}`,
    }));
  });

const Input = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  pdf_path: z.string().min(1),
  pdf_name: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertPdfLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("pdf_library_items").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("pdf_library_items").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deletePdfLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("pdf_library_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
