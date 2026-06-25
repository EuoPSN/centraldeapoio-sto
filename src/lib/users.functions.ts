import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(ctx: { supabase: unknown; userId: string }) {
  // @ts-expect-error supabase typing
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Acesso restrito a administradores.");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,display_name,is_active,created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");
    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: byUser.get(p.id) ?? [],
    }));
  });

const RoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "funcionario"]),
});

export const promoteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // remove role anterior e insere a nova
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.userId,
      role: data.role,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ActiveInput = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ActiveInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.userId);
    // Ban no auth = "banned_until" no futuro distante / NULL para reativar
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.isActive ? "none" : "876000h", // ~100 anos
    });
    return { ok: true };
  });

const CreateInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
  role: z.enum(["admin", "funcionario"]).default("funcionario"),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });
    if (error) throw new Error(error.message);
    // Trigger handle_new_user já criou profile + role default. Promove se admin.
    if (data.role === "admin" && created.user) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    }
    return { ok: true, userId: created.user?.id };
  });

const ResetInput = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(8),
});

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResetInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Estatísticas básicas
export const getStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [usersRes, convsRes, msgsRes, chunksRes, scriptsRes, contentRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("chat_conversations").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("chat_messages").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabaseAdmin.from("knowledge_chunks").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("scripts").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("content_items").select("*", { count: "exact", head: true }),
    ]);
    return {
      totalUsers: usersRes.count ?? 0,
      totalConversations: convsRes.count ?? 0,
      totalUserMessages: msgsRes.count ?? 0,
      totalChunks: chunksRes.count ?? 0,
      totalScripts: scriptsRes.count ?? 0,
      totalContentItems: contentRes.count ?? 0,
    };
  });

// Lista todas as conversas (admin auditoria)
export const adminListConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("chat_conversations")
      .select("id,title,user_id,created_at,updated_at,profiles!chat_conversations_user_id_fkey(email,display_name)")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      // fallback sem join se a FK não existir
      const { data: d2 } = await supabaseAdmin
        .from("chat_conversations")
        .select("id,title,user_id,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      return d2 ?? [];
    }
    return data ?? [];
  });
