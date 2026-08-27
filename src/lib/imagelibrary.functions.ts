import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

export const listImageLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("image_library_items")
      .select("*, category:categories(id,name,icon,color)")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { signMessageImageToken } = await import("./message-image-token.server");
    return (data ?? []).map((item) => ({
      ...item,
      image_url: `/api/public/message-image?t=${encodeURIComponent(signMessageImageToken(item.image_path))}`,
      image_ext: item.image_path.split(".").pop() ?? "jpg",
    }));
  });

const Input = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  image_path: z.string().min(1),
  position: z.number().int().default(0),
});

export const upsertImageLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const row = { ...data, created_by: context.userId };
    const { data: r, error } = data.id
      ? await context.supabase.from("image_library_items").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("image_library_items").insert(row).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteImageLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("image_library_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
