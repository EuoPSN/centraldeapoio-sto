import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

export const listTrainingModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("training_modules")
      .select("*, images:training_module_images(position, image:image_library_items(id,title,image_path))")
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    const { signKnowledgeFileToken } = await import("./knowledge-file-token.server");
    return (data ?? []).map((m: any) => ({
      ...m,
      pdf_url: m.pdf_path ? `/api/public/knowledge-file?t=${encodeURIComponent(signKnowledgeFileToken(m.pdf_path))}` : null,
    }));
  });

const ModuleInput = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(200),
  descricao: z.string().nullable().optional(),
  pdf_path: z.string().nullable().optional(),
  pdf_name: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertTrainingModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ModuleInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("training_modules").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("training_modules").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteTrainingModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("training_modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ModuleImagesInput = z.object({
  training_module_id: z.string().uuid(),
  image_library_item_ids: z.array(z.string().uuid()).default([]),
});

export const setTrainingModuleImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ModuleImagesInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error: delErr } = await context.supabase
      .from("training_module_images").delete().eq("training_module_id", data.training_module_id);
    if (delErr) throw new Error(delErr.message);
    if (data.image_library_item_ids.length > 0) {
      const { error: insErr } = await context.supabase
        .from("training_module_images")
        .insert(data.image_library_item_ids.map((id, i) => ({ training_module_id: data.training_module_id, image_library_item_id: id, position: i * 10 })));
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });
