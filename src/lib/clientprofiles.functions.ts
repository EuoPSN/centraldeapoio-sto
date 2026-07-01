import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(ctx: { supabase: unknown; userId: string }) {
  const supabase = ctx.supabase as {
    rpc: (fn: string, args: unknown) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  };
  const isAdmin = await isAdminUser(supabase, ctx.userId);
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
}

export const listClientProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("client_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ClientProfileInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  personality: z.string().default(""),
  difficulty: z.string().min(1).max(50),
  objectives: z.string().default(""),
  objections: z.string().default(""),
  behaviors: z.string().default(""),
});

export const upsertClientProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ClientProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const row = {
      name: data.name,
      personality: data.personality,
      difficulty: data.difficulty,
      objectives: data.objectives,
      objections: data.objections,
      behaviors: data.behaviors,
    };
    const { data: result, error } = data.id
      ? await db.from("client_profiles").update(row).eq("id", data.id).select().single()
      : await db.from("client_profiles").insert(row).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteClientProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("client_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
