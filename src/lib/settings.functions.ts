import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

// ============ APP SETTINGS ============
// Settings is public-readable so the theme provider can hydrate without auth.
// Use the publishable client (no auth required, RLS lets anon read).
export async function fetchAppSettings() {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const SettingsInput = z.object({
  platform_name: z.string().min(1).max(80),
  tagline: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  favicon_url: z.string().nullable().optional(),
  cover_url: z.string().nullable().optional(),
  primary_color: z.string().nullable().optional(),
  secondary_color: z.string().nullable().optional(),
  accent_color: z.string().nullable().optional(),
  background_color: z.string().nullable().optional(),
  active_theme: z.string().default("corporate"),
});

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("app_settings").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ NAV ITEMS ============
export const listNavItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("nav_items").select("*")
      .order("section", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const NavInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(80),
  icon: z.string().min(1).max(60),
  route: z.string().min(1).max(120),
  section: z.string().min(1).default("main"),
  position: z.number().int().default(0),
  visible: z.boolean().default(true),
  admin_only: z.boolean().default(false),
});

export const upsertNavItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NavInput.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: r, error } = data.id
      ? await context.supabase.from("nav_items").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("nav_items").insert(data).select().single();
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteNavItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { error } = await context.supabase.from("nav_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ THEMES ============
export const listThemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("themes").select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
