import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============================================================
// CONTENT ITEMS (Conhecimento / Problemas / Tutoriais)
// ============================================================
const SectionEnum = z.enum(["conhecimento", "problemas", "tutoriais", "treinamentos"]);

export const listContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ section: SectionEnum }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("content_items")
      .select("*")
      .eq("section", data.section)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ContentInput = z.object({
  id: z.string().uuid().optional(),
  section: SectionEnum,
  category: z.string().nullable().optional(),
  title: z.string().min(1, "Título obrigatório").max(200),
  content: z.string().default(""),
  tags: z.array(z.string()).default([]),
  link_externo: z.string().nullable().optional(),
  link_label: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ContentInput.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores podem editar conteúdo.");

    const row = {
      ...data,
      created_by: context.userId,
    };
    const { data: result, error } = data.id
      ? await context.supabase.from("content_items").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("content_items").insert(row).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores podem remover conteúdo.");
    const { error } = await context.supabase.from("content_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// SCRIPTS
// ============================================================
export const listScripts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scripts")
      .select("*")
      .order("category", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ScriptInput = z.object({
  id: z.string().uuid().optional(),
  category: z.string().min(1).max(80),
  subcategory: z.string().nullable().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  usage_note: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScriptInput.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores podem editar scripts.");

    const row = { ...data, created_by: context.userId };
    const { data: result, error } = data.id
      ? await context.supabase.from("scripts").update(row).eq("id", data.id).select().single()
      : await context.supabase.from("scripts").insert(row).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores podem remover scripts.");
    const { error } = await context.supabase.from("scripts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// PRICING
// ============================================================
export const listPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pricing_items")
      .select("*")
      .order("category", { ascending: true })
      .order("position", { ascending: true })
      .order("specialty", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const PricingInput = z.object({
  id: z.string().uuid().optional(),
  specialty: z.string().min(1).max(120),
  cartao_price: z.number().nullable().optional(),
  particular_price: z.number().nullable().optional(),
  category: z.string().min(1).max(60).default("consulta"),
  notes: z.string().nullable().optional(),
  position: z.number().int().default(0),
});

export const upsertPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PricingInput.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores podem editar a tabela de preços.");
    const { data: result, error } = data.id
      ? await context.supabase.from("pricing_items").update(data).eq("id", data.id).select().single()
      : await context.supabase.from("pricing_items").insert(data).select().single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deletePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await isAdminUser(context.supabase, context.userId);
    if (!isAdmin) throw new Error("Apenas administradores podem remover preços.");
    const { error } = await context.supabase.from("pricing_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ME — role do usuário logado
// ============================================================
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    return {
      userId: context.userId,
      email: (context.claims as { email?: string })?.email ?? "",
      profile,
      isAdmin,
    };
  });
