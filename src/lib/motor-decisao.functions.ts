import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Forbidden");
}

export const listMotors = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("decision_motors")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getMotorFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { motorId: string })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const [motorRes, nodesRes, edgesRes] = await Promise.all([
      db.from("decision_motors").select("*").eq("id", data.motorId).single(),
      db.from("decision_nodes").select("*").eq("motor_id", data.motorId).order("created_at"),
      db.from("decision_edges").select("*").eq("motor_id", data.motorId).order("created_at"),
    ]);
    if (motorRes.error) throw motorRes.error;
    if (nodesRes.error) throw nodesRes.error;
    if (edgesRes.error) throw edgesRes.error;
    return { motor: motorRes.data, nodes: nodesRes.data ?? [], edges: edgesRes.data ?? [] };
  });

export const upsertMotor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    id?: string; name: string; category?: string; description?: string; is_active?: boolean;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row: any = {
      name: data.name,
      category: data.category ?? null,
      description: data.description ?? null,
      is_active: data.is_active ?? true,
    };
    if (data.id) row.id = data.id;
    const { data: result, error } = await (context.supabase as any)
      .from("decision_motors")
      .upsert(row)
      .select().single();
    if (error) throw error;
    return result;
  });

export const deleteMotor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("decision_motors")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const upsertNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as any)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row: any = {
      motor_id: data.motor_id,
      type: data.type,
      title: data.title,
      question_type: data.question_type ?? null,
      processo: data.processo ?? null,
      mensagem: data.mensagem ?? null,
      documentos: data.documentos ?? null,
      orientacoes: data.orientacoes ?? null,
      observacoes: data.observacoes ?? null,
      is_start: data.is_start ?? false,
    };
    if (data.id) row.id = data.id;
    const { data: result, error } = await (context.supabase as any)
      .from("decision_nodes")
      .upsert(row)
      .select().single();
    if (error) throw error;
    return result;
  });

export const deleteNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase as any;
    await db.from("decision_edges").delete().or(`from_node_id.eq.${data.id},to_node_id.eq.${data.id}`);
    const { error } = await db.from("decision_nodes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const upsertEdge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as {
    id?: string; motor_id: string; from_node_id: string; to_node_id: string; label: string;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row: any = {
      motor_id: data.motor_id,
      from_node_id: data.from_node_id,
      to_node_id: data.to_node_id,
      label: data.label,
    };
    if (data.id) row.id = data.id;
    const { data: result, error } = await (context.supabase as any)
      .from("decision_edges")
      .upsert(row)
      .select().single();
    if (error) throw error;
    return result;
  });

export const deleteEdge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("decision_edges")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
