// Server-only authorization helpers. Replaces direct RPC calls to has_role
// after the helper was moved out of the public schema.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdminUser(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}
