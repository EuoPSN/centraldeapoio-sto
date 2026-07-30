import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAllSimulatorResults = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("simulator_results")
      .select("*, profiles!simulator_results_user_id_fkey(display_name, email)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const deleteSimulatorResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    const { data: role, error: roleErr } = await (context.supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (!role) throw new Error("Forbidden");
    const { error } = await (context.supabase as any)
      .from("simulator_results")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

