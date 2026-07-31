import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const isAdmin = await isAdminUser(ctx.supabase, ctx.userId);
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
}

export const listClientProfileStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ profile_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_profile_states")
      .select("*")
      .eq("profile_id", data.profile_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const StateInput = z.object({
  id: z.string().uuid().optional(),
  profile_id: z.string().uuid(),
  position: z.number().int().default(0),
  name: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  example_lines: z.string().optional().nullable(),
  advance_criteria: z.string().optional().nullable(),
  attachment_url: z.string().optional().nullable(),
  attachment_label: z.string().optional().nullable(),
});

export const upsertClientProfileState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: result, error } = data.id
      ? await context.supabase.from("client_profile_states").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("client_profile_states").insert(data).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteClientProfileState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("client_profile_states").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
