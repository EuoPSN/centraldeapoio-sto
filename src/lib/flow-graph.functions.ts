import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function admin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

// Carrega flow + nodes + edges (autenticado)
export const getFlowGraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [flowRes, nodesRes, edgesRes] = await Promise.all([
      context.supabase.from("flows").select("*").eq("id", data.id).single(),
      context.supabase.from("flow_nodes").select("*").eq("flow_id", data.id),
      context.supabase.from("flow_edges").select("*").eq("flow_id", data.id),
    ]);
    if (flowRes.error) throw new Error(flowRes.error.message);
    if (nodesRes.error) throw new Error(nodesRes.error.message);
    if (edgesRes.error) throw new Error(edgesRes.error.message);
    return { flow: flowRes.data, nodes: nodesRes.data ?? [], edges: edgesRes.data ?? [] };
  });

// Salva o grafo inteiro (substitui nodes/edges deste flow). Admin-only.
const NodeIn = z.object({
  id: z.string().uuid(),
  node_type: z.enum(["start","step","question","answer","objection","script","action","end"]),
  title: z.string().min(1).max(200),
  message: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  position_x: z.number(),
  position_y: z.number(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});
const EdgeIn = z.object({
  id: z.string().uuid(),
  source_node_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
  source_handle: z.string().nullable().optional(),
  target_handle: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});
const SaveIn = z.object({
  flow_id: z.string().uuid(),
  nodes: z.array(NodeIn),
  edges: z.array(EdgeIn),
});

export const saveFlowGraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveIn.parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    // Estratégia: apagar tudo do flow e reinserir (transação simples; volume pequeno).
    const { error: e1 } = await context.supabase.from("flow_edges").delete().eq("flow_id", data.flow_id);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await context.supabase.from("flow_nodes").delete().eq("flow_id", data.flow_id);
    if (e2) throw new Error(e2.message);

    if (data.nodes.length > 0) {
      const nodeRows = data.nodes.map((n, i) => ({
        id: n.id,
        flow_id: data.flow_id,
        node_type: n.node_type,
        title: n.title,
        message: n.message ?? null,
        note: n.note ?? null,
        position: i,
        position_x: n.position_x,
        position_y: n.position_y,
        color: n.color ?? null,
        icon: n.icon ?? null,
        data: n.data ?? {},
      }));
      const { error } = await context.supabase.from("flow_nodes").insert(nodeRows as never);
      if (error) throw new Error(error.message);
    }
    if (data.edges.length > 0) {
      const edgeRows = data.edges.map((e) => ({
        id: e.id,
        flow_id: data.flow_id,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        source_handle: e.source_handle ?? null,
        target_handle: e.target_handle ?? null,
        label: e.label ?? null,
      }));
      const { error } = await context.supabase.from("flow_edges").insert(edgeRows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
